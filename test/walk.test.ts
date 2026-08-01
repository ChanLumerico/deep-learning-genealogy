// Two things are checked here. The tracing rule, against fixtures small
// enough to reason about — and the curated paths, against the real graph,
// because a path that names a step the graph has no arrow for reads as a
// jump with no explanation, which is exactly what this feature exists to
// avoid.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { allPaths, ancestry, clampStep, steps } from '../src/view/walk'
import type { WalkCourse, WalkEdge, WalkNode } from '../src/view/walk'
import { loadGraphData } from './snapshot'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── the rule, on fixtures ──────────────────────────────────────────────────
const n = (id: string, year: number): WalkNode => ({ id, year })
const e = (from: string, to: string, kind = 'direct', hi?: boolean): WalkEdge =>
  ({ from, to, kind, hi })

describe('tracing a line of descent', () => {
  const nodes = [n('a', 1990), n('b', 2000), n('c', 2010)]

  it('walks back to a root, oldest first', () => {
    expect(ancestry(nodes, [e('a', 'b'), e('b', 'c')], 'c')).toEqual(['a', 'b', 'c'])
  })

  it('gives a root just itself', () => {
    expect(ancestry(nodes, [e('a', 'b')], 'a')).toEqual(['a'])
  })

  it('gives an unknown id nothing, rather than throwing', () => {
    expect(ancestry(nodes, [], 'nope')).toEqual([])
  })

  it('never follows an alternative — that is a rival, not a parent', () => {
    expect(ancestry(nodes, [e('a', 'c', 'alt')], 'c')).toEqual(['c'])
  })

  it('prefers the spine when a node has two direct parents', () => {
    const edges = [e('a', 'c'), e('b', 'c', 'direct', true)]
    expect(ancestry(nodes, edges, 'c')).toEqual(['b', 'c'])
  })

  it('takes the older parent when neither is a spine', () => {
    // the longer-running line is the story worth telling
    expect(ancestry(nodes, [e('a', 'c'), e('b', 'c')], 'c')).toEqual(['a', 'c'])
  })

  it('follows a borrowed idea once the direct line runs out', () => {
    // ViT has no direct parent at all; its story is a transplant, and
    // stopping at ViT would hide the only interesting thing about it
    expect(ancestry(nodes, [e('a', 'b'), e('b', 'c', 'cross')], 'c'))
      .toEqual(['a', 'b', 'c'])
  })

  it('prefers descent over borrowing when both are on offer', () => {
    const edges = [e('a', 'c', 'cross'), e('b', 'c', 'direct')]
    expect(ancestry(nodes, edges, 'c')).toEqual(['b', 'c'])
  })

  it('stops on a cycle instead of hanging', () => {
    // hand-edited data can describe one; the walk must still terminate
    const edges = [e('a', 'b'), e('b', 'c'), e('c', 'a')]
    expect(ancestry(nodes, edges, 'c').length).toBeLessThanOrEqual(3)
  })
})

describe('turning a chain into steps', () => {
  const edges = [e('a', 'b'), e('b', 'c')]

  it('alternates model, arrow, model', () => {
    expect(steps(['a', 'b', 'c'], edges)).toEqual([
      { kind: 'node', id: 'a' },
      { kind: 'edge', from: 'a', to: 'b' },
      { kind: 'node', id: 'b' },
      { kind: 'edge', from: 'b', to: 'c' },
      { kind: 'node', id: 'c' },
    ])
  })

  it('omits an arrow the graph does not have, rather than inventing one', () => {
    expect(steps(['a', 'c'], edges)).toEqual([
      { kind: 'node', id: 'a' },
      { kind: 'node', id: 'c' },
    ])
  })

  it('handles a chain of one', () => {
    expect(steps(['a'], edges)).toEqual([{ kind: 'node', id: 'a' }])
  })

  it('clamps a stale step index onto the walk', () => {
    expect(clampStep(99, 5)).toBe(4)
    expect(clampStep(-3, 5)).toBe(0)
    expect(clampStep(2, 5)).toBe(2)
    expect(clampStep(0, 0)).toBe(0)
  })
})

// ── the curated paths, against the real graph ──────────────────────────────
const { nodes: gNodes, edges: gEdges } = loadGraphData()
const courses: WalkCourse[] = JSON.parse(
  readFileSync(join(ROOT, 'public', 'data', 'paths.json'), 'utf8'))
const paths = allPaths(courses)
const nodeIds = new Set(gNodes.map((x) => x.id))
const edgeKeys = new Set(gEdges.map((x) => `${x.f}>${x.t}`))

describe('the curated paths', () => {
  it('has a unique id, a title and a blurb for each journey', () => {
    // ids must be unique across every field, not only within one: a link
    // carries #/path/<id> with no field in it
    const ids = new Set<string>()
    for (const p of paths) {
      expect(p.id, 'path id').toMatch(/^[a-z0-9]+$/)
      expect(ids.has(p.id), `duplicate path id "${p.id}"`).toBe(false)
      ids.add(p.id)
      expect(p.title?.trim(), p.id).toBeTruthy()
      expect(p.blurb?.trim(), p.id).toBeTruthy()
    }
    expect(paths.length).toBeGreaterThan(12)
  })

  it('groups them into fields, each with a kicker and journeys of its own', () => {
    const ids = new Set<string>()
    for (const c of courses) {
      expect(c.id).toMatch(/^[a-z0-9]+$/)
      expect(ids.has(c.id), `duplicate field id "${c.id}"`).toBe(false)
      ids.add(c.id)
      expect(c.title?.trim(), c.id).toBeTruthy()
      expect(c.kicker?.trim(), c.id).toBeTruthy()
      expect(c.blurb?.trim(), c.id).toBeTruthy()
      expect(c.courses.length, `${c.id} has no journeys`).toBeGreaterThan(1)
    }
    expect(courses.length).toBeGreaterThanOrEqual(5)
  })

  it('names only models that exist', () => {
    for (const p of paths) {
      for (const id of p.nodes) expect(nodeIds, `${p.id}: unknown node "${id}"`).toContain(id)
    }
  })

  it('follows a real arrow at every step', () => {
    // the whole point is that each step is explained by the edge entry
    // between the two models; a gap would be an unexplained jump
    for (const p of paths) {
      for (let i = 1; i < p.nodes.length; i++) {
        const key = `${p.nodes[i - 1]}>${p.nodes[i]}`
        expect(edgeKeys, `${p.id}: no arrow ${key}`).toContain(key)
      }
    }
  })

  it('runs forwards in time', () => {
    const year = new Map(gNodes.map((x) => [x.id, x.y]))
    for (const p of paths) {
      for (let i = 1; i < p.nodes.length; i++) {
        expect(
          year.get(p.nodes[i])!,
          `${p.id}: ${p.nodes[i]} is older than ${p.nodes[i - 1]}`,
        ).toBeGreaterThanOrEqual(year.get(p.nodes[i - 1])!)
      }
    }
  })

  it('is long enough to be a journey', () => {
    // three models is two arrows, which is the least that reads as a story
    // rather than as a pair being compared
    for (const p of paths) expect(p.nodes.length, p.id).toBeGreaterThanOrEqual(3)
  })
})
