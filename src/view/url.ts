// ── Shareable state ───────────────────────────────────────────────────────
// What a link to this app carries. Before this the site had exactly one URL,
// so a reader could not send anyone to a model, could not bookmark one, and
// could not use the back button — ten clicks into a lineage the only way out
// was to leave.
//
//   #/                      nothing selected
//   #/node/resnet           that model, its panel open
//   #/edge/vgg/resnet       that lineage arrow
//   #/list                  the reading list
//
// with the view carried as a query, and omitted wherever it is at its default
// so an ordinary link stays short:
//
//   #/node/vit?lanes=cv,nlp&kinds=direct,fusion
//
// The hash is deliberate. A path (`/node/resnet`) would need the server to
// serve the app for URLs that are not files, which GitHub Pages does only via
// a 404 page — and a 404 status is not indexed, so it buys nothing that this
// does not. Real indexing means pre-rendering a page per entry, which this
// does not preclude.

export interface UrlState {
  /** what is selected, if anything */
  sel: { kind: 'node'; id: string } | { kind: 'edge'; from: string; to: string } | null
  listOpen: boolean
  /**
   * A lineage being walked, and how far in. `path` is a curated journey's id;
   * `trace` is a model whose ancestry was traced on the spot. A walk is
   * shareable at the step someone reached, which is the point of putting it
   * here rather than in component state.
   */
  walk: { kind: 'path'; id: string; step: number }
    | { kind: 'trace'; id: string; step: number }
    | null
  /** lanes switched OFF, sorted; empty means every lane is showing */
  lanesOff: string[]
  /** edge kinds switched OFF, sorted */
  kindsOff: string[]
}

export const EMPTY: UrlState = {
  sel: null, listOpen: false, walk: null, lanesOff: [], kindsOff: [],
}

/** ids are lowercase alphanumeric slugs; anything else did not come from us */
const ID = /^[a-z0-9]+$/

/**
 * Is this fragment an auth redirect's, rather than ours?
 *
 * OAuth's implicit flow returns the whole session in the fragment. This app
 * writes the fragment on load, and the auth client is imported lazily, so
 * writing ours first destroys the tokens before anything can read them — a
 * session on the server and nothing in the browser, with no error anywhere.
 * The flow is configured as PKCE so this should never arise; the guard stays
 * because a fragment that is plainly not ours is not ours to overwrite, and
 * because the failure it prevents is completely silent.
 */
export const isAuthFragment = (hash: string) =>
  /[#&](access_token|refresh_token|provider_token|error_code|error_description)=/
    .test(String(hash ?? ''))

const list = (v: string | null) =>
  (v ?? '').split(',').map((s) => s.trim()).filter((s) => ID.test(s)).sort()

export function parseHash(hash: string): UrlState {
  const raw = String(hash ?? '').replace(/^#/, '')
  const [path, query] = raw.split('?')
  const q = new URLSearchParams(query ?? '')
  const parts = path.split('/').filter(Boolean)

  let sel: UrlState['sel'] = null
  let listOpen = false
  let walk: UrlState['walk'] = null
  const stepOf = () => {
    const v = Number(q.get('step'))
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
  }
  if ((parts[0] === 'path' || parts[0] === 'trace') && ID.test(parts[1] ?? '')) {
    walk = { kind: parts[0], id: parts[1], step: stepOf() }
  } else if (parts[0] === 'node' && ID.test(parts[1] ?? '')) {
    sel = { kind: 'node', id: parts[1] }
  } else if (parts[0] === 'edge' && ID.test(parts[1] ?? '') && ID.test(parts[2] ?? '')) {
    sel = { kind: 'edge', from: parts[1], to: parts[2] }
  } else if (parts[0] === 'list') {
    listOpen = true
  }

  // `year` used to live here, from the timeline. Links carrying it still open
  // — the parameter is simply not read any more.
  return {
    sel, listOpen, walk,
    lanesOff: list(q.get('lanes')), kindsOff: list(q.get('kinds')),
  }
}

export function toHash(s: UrlState): string {
  let path = '/'
  if (s.walk) path = `/${s.walk.kind}/${s.walk.id}`
  else if (s.listOpen) path = '/list'
  else if (s.sel?.kind === 'node') path = `/node/${s.sel.id}`
  else if (s.sel?.kind === 'edge') path = `/edge/${s.sel.from}/${s.sel.to}`

  const q = new URLSearchParams()
  if (s.walk && s.walk.step > 0) q.set('step', String(s.walk.step))
  if (s.lanesOff.length) q.set('lanes', [...s.lanesOff].sort().join(','))
  if (s.kindsOff.length) q.set('kinds', [...s.kindsOff].sort().join(','))
  const query = q.toString()
  // URLSearchParams escapes the commas; they are legal in a fragment and far
  // more readable left alone
  return '#' + path + (query ? '?' + query.replace(/%2C/g, ',') : '')
}

/** Two states are the same link if they serialise the same way. */
export const sameUrl = (a: UrlState, b: UrlState) => toHash(a) === toHash(b)

/**
 * Does moving from `a` to `b` deserve its own history entry?
 *
 * Selecting something does — the back button should walk back through what
 * you looked at. Nudging the timeline or toggling a lane does not, or one
 * exploration would bury the page you arrived from under fifty entries.
 */
export const isNavigation = (a: UrlState, b: UrlState) =>
  toHash({ ...a, lanesOff: [], kindsOff: [] }) !==
  toHash({ ...b, lanesOff: [], kindsOff: [] })
