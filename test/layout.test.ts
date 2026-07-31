// Two different questions, deliberately kept apart.
//
// The GOLDEN MASTER asks whether the ported engine still reproduces the original
// one. It is compared against test/golden/layout.json, which was produced by the
// ORIGINAL engine — the source text lifted straight out of legacy/Deep Learning
// Genealogy.dc.html and run under Node (see tools/gen-golden.mjs) — from the frozen
// records in test/golden/graph.json. Both sides of that comparison are pinned, so
// it can fail for exactly one reason: the port drifted. Regenerating either file to
// make it pass would defeat the entire point.
//
// The LAYOUT INVARIANTS ask whether the graph as it stands today still lays out
// cleanly. They read the live public/data, assert what must never happen, and cap
// what the legacy layout already shipped. Adding a model or a lineage is supposed
// to be checked here — and is supposed to leave the golden master untouched.

import { describe, expect, it } from 'vitest'
import { buildGoldenLayout, buildLayout, loadGolden, loadGraphData, snapshot } from './snapshot'

const golden = loadGolden()
const built = snapshot(buildGoldenLayout())

describe('ported layout engine vs legacy golden master', () => {
  it('builds the same number of nodes and edges', () => {
    expect(built.meta).toEqual(golden.meta)
  })

  it('places every node at the same coordinate', () => {
    expect(built.nodes).toEqual(golden.nodes)
  })

  it('assigns the same faces and ports to every edge', () => {
    const faces = (s: typeof built) => s.edges.map((e) => ({
      index: e.index, f: e.f, t: e.t,
      forward: e.forward, faceA: e.faceA, faceB: e.faceB,
      portA: e.portA, portB: e.portB,
    }))
    expect(faces(built)).toEqual(faces(golden))
  })

  it('routes every edge through the same points', () => {
    const routes = (s: typeof built) => s.edges.map((e) => ({ index: e.index, route: e.route }))
    expect(routes(built)).toEqual(routes(golden))
  })

  it('assigns the same corner radii', () => {
    const radii = (s: typeof built) => s.edges.map((e) => ({ index: e.index, radii: e.radii }))
    expect(radii(built)).toEqual(radii(golden))
  })

  it('emits byte-identical SVG path strings', () => {
    const paths = (s: typeof built) => s.edges.map((e) => ({ index: e.index, path: e.path }))
    expect(paths(built)).toEqual(paths(golden))
  })

  it('reaches the same routing-strategy mix', () => {
    expect(built.routerStats).toEqual(golden.routerStats)
  })

  it('reproduces the audit report exactly', () => {
    expect(built.audit).toEqual(golden.audit)
  })

  it('matches the golden master in full', () => {
    expect(built).toEqual(golden)
  })
})

describe('the live graph lays out cleanly', () => {
  const live = buildLayout()
  const { nodes, edges } = loadGraphData()

  // An edge whose endpoint id does not exist is skipped rather than crashing the
  // build, which is right at runtime and hides a typo in the data.
  it('resolves every edge endpoint', () => {
    const ids = new Set(nodes.map((n) => n.id))
    const dangling = edges
      .filter((e) => !ids.has(e.f) || !ids.has(e.t))
      .map((e) => `${e.f}→${e.t}`)
    expect(dangling, 'edges naming a node that does not exist').toEqual([])
    expect(live.edges.length).toBe(edges.length)
  })

  it('gives every node a lane and a track that exist', () => {
    const misplaced = live.nodes
      .filter((n) => n.lane === undefined || n.lane.tracks[n.track] === undefined)
      .map((n) => n.id)
    expect(misplaced, 'nodes whose lane or track is not in spec.ts').toEqual([])
  })

  it('never overlaps two node bodies', () => {
    expect(live.audit.nodeOverlap).toEqual([])
  })

  it('never routes an edge through a node body', () => {
    expect(live.audit.edgeThroughNode).toEqual([])
  })

  // The legacy layout was not perfectly clean and these are the numbers it shipped
  // with. They are caps rather than equalities, so the sheet may get tidier and may
  // not get messier.
  it('holds the baseline for tight channels and fallbacks', () => {
    expect(live.audit.tightChannels).toBeLessThanOrEqual(1)
    expect(live.audit.worstTightExtent).toBeLessThanOrEqual(42)
    expect(live.audit.fallbacks).toBeLessThanOrEqual(3)
  })
})
