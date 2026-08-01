// ── Moving through the graph from the keyboard ────────────────────────────
// The sheet had no keyboard path at all: no tab stop, no key handler, no
// roles. Without a mouse or a finger it was a picture. For a public teaching
// resource that is a defect rather than a missing feature.
//
// 189 tab stops would be worse than none, so the canvas takes a single stop
// and the arrows move a cursor within it — the pattern a tree view uses. The
// axes are chosen to match what the graph means: left and right run along
// time within a lane, up and down run along descent.

export interface KeyNode {
  id: string
  lane: string
  year: number
  /** x on the sheet, to break ties between models of the same year */
  x: number
}

export interface KeyEdge {
  from: string
  to: string
  kind: string
}

export type Direction = 'left' | 'right' | 'up' | 'down'

/** lineage runs along descent; an alternative is a rival, not a parent */
const DESCENT = new Set(['direct', 'cross', 'fusion'])

const byTime = (a: KeyNode, b: KeyNode) => (a.x - b.x) || a.id.localeCompare(b.id)

/**
 * Where the cursor goes next, or null if there is nowhere to go.
 *
 * left / right — the previous or next model in the same lane, in time order,
 * which is how the sheet is laid out and so how it reads.
 *
 * up / down — one step against or along descent. Where a model has several
 * parents or children the earliest is taken, so repeated presses are stable
 * and reversible rather than wandering.
 */
export function move(
  nodes: KeyNode[], edges: KeyEdge[], current: string | null, dir: Direction,
): string | null {
  if (!nodes.length) return null

  // nothing selected: the first press lands on the oldest model on the sheet
  if (!current) return [...nodes].sort(byTime)[0]?.id ?? null

  const here = nodes.find((n) => n.id === current)
  if (!here) return null

  if (dir === 'left' || dir === 'right') {
    const lane = nodes.filter((n) => n.lane === here.lane).sort(byTime)
    const i = lane.findIndex((n) => n.id === current)
    if (i < 0) return null
    const next = lane[dir === 'right' ? i + 1 : i - 1]
    return next ? next.id : null
  }

  const linked = edges.filter((e) =>
    DESCENT.has(e.kind) && (dir === 'up' ? e.to === current : e.from === current))
  const ids = linked.map((e) => (dir === 'up' ? e.from : e.to))
  const candidates = nodes.filter((n) => ids.includes(n.id)).sort(byTime)
  return candidates[0]?.id ?? null
}
