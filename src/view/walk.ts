// ── Walking a lineage ─────────────────────────────────────────────────────
// The essays are written so that each arrow explains what the next model
// fixed about the last one. Read in order they are an argument; read by
// clicking about they are an encyclopedia. This turns a chain of models into
// the alternating sequence the writing was built for:
//
//   Perceptron → [no XOR in one layer → hidden layers] → MLP → […] → …
//
// Pure over plain records rather than over the built graph, so the awkward
// cases — a node with two parents, a cycle in hand-edited data, an id that
// does not exist — can be tested with three-line fixtures.

export interface WalkNode {
  id: string
  year: number
}

export interface WalkEdge {
  from: string
  to: string
  kind: string
  /** marked in the data as a spine of the tree */
  hi?: boolean
}

export type Step =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; from: string; to: string }

/**
 * Pick the one parent to follow back from `id`.
 *
 * A `direct` edge is the line of descent and is taken first: 156 of the 160
 * nodes that have one have exactly one, so this usually decides nothing.
 * Where it must, a spine edge wins, then the older parent, on the grounds
 * that the longer-running line is the story.
 *
 * When the direct line runs out the walk continues along a borrowed idea —
 * `cross` or `fusion` — because that is often where the interesting answer
 * is. ViT has no direct parent at all; its whole story is a Transformer
 * transplanted into vision, and stopping there would hide it. An `alt` edge
 * is never followed: the data marks those as competing paths, not descent.
 */
const DESCENT = ['direct', 'cross', 'fusion']

function parentOf(id: string, edges: WalkEdge[], year: Map<string, number>): string | null {
  const inbound = edges.filter((e) => e.to === id && year.has(e.from))
  for (const kind of DESCENT) {
    const pool = inbound.filter((e) => e.kind === kind)
    if (!pool.length) continue
    const spine = pool.filter((e) => e.hi)
    return (spine.length ? spine : pool)
      .slice()
      .sort((a, b) => (year.get(a.from)! - year.get(b.from)!) || a.from.localeCompare(b.from))[0]
      .from
  }
  return null
}

/**
 * The chain of direct ancestors ending at `id`, oldest first and including
 * `id` itself. An unknown id gives an empty chain rather than throwing.
 */
export function ancestry(nodes: WalkNode[], edges: WalkEdge[], id: string): string[] {
  const year = new Map(nodes.map((n) => [n.id, n.year]))
  if (!year.has(id)) return []
  const chain: string[] = [id]
  const seen = new Set([id])
  let cur: string | null = id
  // hand-edited data could describe a cycle; stop rather than hang
  while ((cur = parentOf(cur, edges, year)) && !seen.has(cur)) {
    seen.add(cur)
    chain.push(cur)
  }
  return chain.reverse()
}

/**
 * Interleave a chain of nodes with the arrows between them. A pair with no
 * edge between it simply gets no edge step — a curated path that has drifted
 * away from the graph degrades to a list of models rather than breaking.
 */
export function steps(chain: string[], edges: WalkEdge[]): Step[] {
  const has = new Set(edges.map((e) => `${e.from}>${e.to}`))
  const out: Step[] = []
  chain.forEach((id, i) => {
    if (i > 0 && has.has(`${chain[i - 1]}>${id}`)) {
      out.push({ kind: 'edge', from: chain[i - 1], to: id })
    }
    out.push({ kind: 'node', id })
  })
  return out
}

/** Clamp a step index onto a walk, so a stale link lands somewhere valid. */
export const clampStep = (i: number, total: number) =>
  total <= 0 ? 0 : Math.min(total - 1, Math.max(0, Math.floor(i) || 0))

/** One journey: a chain of models, read in order. */
export interface WalkPath {
  id: string
  title: string
  blurb: string
  nodes: string[]
}

/** A field of research, holding the journeys through it. */
export interface WalkCourse {
  id: string
  title: string
  /** one line above the title, naming what the field is about */
  kicker: string
  blurb: string
  courses: WalkPath[]
}

/** Every journey across every field, for looking one up by id. */
export const allPaths = (courses: WalkCourse[]): WalkPath[] =>
  courses.flatMap((c) => c.courses)

export interface Progress {
  done: number
  total: number
  complete: boolean
}

/**
 * How far through a journey a reader is, measured against their reading list.
 *
 * Walking a course does NOT tick anything: the reading log is the visitor's
 * own record of papers they have actually read, and marking one on their
 * behalf because they clicked past it would quietly falsify it. Progress here
 * is therefore a report on that log, not a second kind of state.
 */
export function progressOf(nodes: string[], read: Record<string, unknown>): Progress {
  const seen = new Set(nodes)
  const total = seen.size
  let done = 0
  seen.forEach((id) => { if (read[id]) done++ })
  return { done, total, complete: total > 0 && done === total }
}

/** A field is complete when every journey through it is. */
export function courseProgress(c: WalkCourse, read: Record<string, unknown>): Progress {
  const done = c.courses.filter((p) => progressOf(p.nodes, read).complete).length
  return { done, total: c.courses.length, complete: done === c.courses.length }
}
