// ── Reconciling two reading lists ─────────────────────────────────────────
// Signing in brings two lists together: what this browser has been keeping in
// localStorage, and what the account holds. Pure functions, because getting
// this wrong loses somebody's record of what they have read, and that is the
// one piece of state this app has always promised is theirs.
//
// The rule is union, never subtraction. A tick is evidence that a paper was
// read; the absence of one is not evidence that it was not. Two devices that
// have each read different things should end up with both, and neither should
// be able to un-tick the other's work by merely connecting.
//
// Un-ticking is therefore an explicit act, handled by `remove` below rather
// than falling out of a merge.

import type { ReadMap } from './readingLog'

export interface SyncPlan {
  /** the list both sides should end up with */
  merged: ReadMap
  /** ids present locally but not on the server — these need uploading */
  toUpload: string[]
  /** true when the account already agreed with this browser */
  inSync: boolean
}

/**
 * Work out what a sign-in should do.
 *
 * @param local  what this browser has, from localStorage
 * @param remote what the account has, from the database
 */
export function plan(local: ReadMap, remote: ReadMap): SyncPlan {
  const merged: ReadMap = { ...remote }
  const toUpload: string[] = []
  for (const id of Object.keys(local)) {
    if (!merged[id]) {
      merged[id] = 1
      toUpload.push(id)
    }
  }
  return { merged, toUpload: toUpload.sort(), inSync: toUpload.length === 0 }
}

/** Ids the account holds that this browser did not — for reporting a merge. */
export function gained(local: ReadMap, remote: ReadMap): string[] {
  return Object.keys(remote).filter((id) => !local[id]).sort()
}

/**
 * A one-line account of what signing in changed, or null when nothing did.
 * Shown to the reader, because a list quietly growing on sign-in is alarming
 * if it is not explained.
 */
export function describe(local: ReadMap, remote: ReadMap): string | null {
  const up = plan(local, remote).toUpload.length
  const down = gained(local, remote).length
  if (!up && !down) return null
  const parts: string[] = []
  if (down) parts.push(`${down} from your account`)
  if (up) parts.push(`${up} from this browser`)
  return `Reading list merged — ${parts.join(', ')}.`
}

/** Rows as the database stores them. */
export interface ReadingRow {
  node_id: string
}

export const toMap = (rows: ReadingRow[]): ReadMap => {
  const out: ReadMap = {}
  for (const r of rows) if (r?.node_id) out[r.node_id] = 1
  return out
}
