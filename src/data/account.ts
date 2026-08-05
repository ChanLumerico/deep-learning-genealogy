// ── Accounts ──────────────────────────────────────────────────────────────
// Signing in carries the reading list between browsers. Everything else about
// the site is unchanged, and that is deliberate: the graph, the essays and the
// walks stay readable with no account at all, and a visitor who never signs in
// keeps working exactly as before, in localStorage.
//
// There is no server. Supabase provides the OAuth dance and a Postgres table,
// and row-level security means the browser can talk to it directly — the
// policies in supabase/schema.sql are what stop one reader seeing another's
// rows, so they are the security model rather than a formality.
//
// The keys below are the publishable ones and are meant to ship in the bundle.
// If they are absent the module reports "not configured" and the app runs as a
// purely local site, which is what happens on a fork with no Supabase project.

import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { ReadMap } from './readingLog'
import { toMap } from './sync'

export type Provider = 'google' | 'github'

export interface Account {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false on a fork with no project of its own; the app then stays local-only */
export const accountsAvailable = !!(URL_ && KEY)

/**
 * Which providers to offer, in order.
 *
 * Listed rather than assumed: a provider that is offered but not registered
 * in Supabase sends the reader to an error page, which is worse than not
 * offering it. Set VITE_AUTH_PROVIDERS to the ones actually configured.
 */
export const PROVIDERS: Provider[] = String(
  import.meta.env.VITE_AUTH_PROVIDERS ?? 'google,github',
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s): s is Provider => s === 'google' || s === 'github')

// The client is imported on demand. supabase-js is 57 kB gzipped — more than
// a fifth of everything else here — and most readers never sign in, so it must
// not sit in the initial bundle. Vite splits it into its own chunk.
let pending: Promise<SupabaseClient> | null = null
function db(): Promise<SupabaseClient> {
  if (!accountsAvailable) return Promise.reject(new Error('accounts are not configured'))
  pending ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // the OAuth callback comes back on the URL; take the session out of it
        // and put the address bar back the way the reader left it
        detectSessionInUrl: true,
      },
    }))
  return pending
}

/**
 * Should the client be loaded before anyone asks for it?
 *
 * Two cases need it immediately: the reader is returning from the OAuth
 * provider, where the code in the URL is only exchanged if the client exists
 * to see it; and a session is already stored, so they expect to be signed in
 * on arrival. Otherwise it waits until the reading list is opened.
 *
 * The stored-session check reads Supabase's own key format. If that ever
 * changes the failure is graceful — the client simply loads a moment later,
 * when the panel opens — so it is a shortcut, not a dependency.
 */
export function accountNeededNow(): boolean {
  if (!accountsAvailable) return false
  const u = new URL(window.location.href)
  if (u.searchParams.has('code') || /[#&]access_token=/.test(window.location.hash)) return true
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
  } catch { /* private mode — treat as no session */ }
  return false
}

export function toAccount(session: Session | null): Account | null {
  const u = session?.user
  if (!u) return null
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
  return {
    id: u.id,
    email: u.email ?? null,
    name: str('full_name') ?? str('name') ?? str('user_name'),
    avatar: str('avatar_url') ?? str('picture'),
  }
}

/** Calls back with the account now, and again whenever it changes. */
export function watchAccount(fn: (a: Account | null) => void): () => void {
  if (!accountsAvailable) { fn(null); return () => {} }
  let stop = () => {}
  let dead = false
  db().then((c) => {
    if (dead) return
    c.auth.getSession().then(({ data }) => { if (!dead) fn(toAccount(data.session)) })
    const { data } = c.auth.onAuthStateChange((_e, s) => { if (!dead) fn(toAccount(s)) })
    stop = () => data.subscription.unsubscribe()
  }).catch(() => fn(null))
  return () => { dead = true; stop() }
}

export async function signIn(provider: Provider): Promise<void> {
  // Come back to the page the reader was on, hash and all, so signing in from
  // halfway through a walk does not lose their place.
  const c = await db()
  await c.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.href },
  })
}

export const signOut = async () => (await db()).auth.signOut()

// ── the reading list, stored ───────────────────────────────────────────────

export async function fetchReading(): Promise<ReadMap> {
  const { data, error } = await (await db()).from('reading').select('node_id')
  if (error) throw error
  return toMap(data ?? [])
}

/** Add ids. Upsert, so re-sending one already stored is not an error. */
export async function addReading(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await (await db()).from('reading')
    .upsert(ids.map((node_id) => ({ user_id: userId, node_id })),
      { onConflict: 'user_id,node_id' })
  if (error) throw error
}

export async function removeReading(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await (await db()).from('reading').delete().in('node_id', ids)
  if (error) throw error
}

/** Everything, gone — the reader's data is theirs to destroy. */
export async function clearReading(): Promise<void> {
  const { error } = await (await db()).rpc('clear_my_reading')
  if (error) throw error
}
