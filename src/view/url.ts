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
//   #/node/vit?year=2020&lanes=cv,nlp&kinds=direct,fusion
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
  /** timeline position, as a year; null means "all of it" */
  year: number | null
  /** lanes switched OFF, sorted; empty means every lane is showing */
  lanesOff: string[]
  /** edge kinds switched OFF, sorted */
  kindsOff: string[]
}

export const EMPTY: UrlState = {
  sel: null, listOpen: false, walk: null, year: null, lanesOff: [], kindsOff: [],
}

/** ids are lowercase alphanumeric slugs; anything else did not come from us */
const ID = /^[a-z0-9]+$/

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

  const yearRaw = Number(q.get('year'))
  // a year outside the sheet is someone's typo, not a filter
  const year = Number.isFinite(yearRaw) && yearRaw >= 1900 && yearRaw <= 2100
    ? Math.round(yearRaw)
    : null

  return {
    sel, listOpen, walk, year,
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
  if (s.year != null) q.set('year', String(s.year))
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
  toHash({ ...a, year: null, lanesOff: [], kindsOff: [] }) !==
  toHash({ ...b, year: null, lanesOff: [], kindsOff: [] })
