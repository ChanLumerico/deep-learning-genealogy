// Golden-master test for the port.
//
// test/golden/layout.json is produced by running the ORIGINAL engine — the source
// text lifted straight out of legacy/Deep Learning Genealogy.dc.html — under Node
// (see tools/gen-golden.mjs). The port has to reproduce it exactly: same node
// positions, same ports, same route points, same corner radii, same path strings.
//
// If this fails, the port drifted. Regenerating the golden master to make it pass
// would defeat the entire point.

import { describe, expect, it } from 'vitest'
import { buildLayout, loadGolden, snapshot } from './snapshot'

const golden = loadGolden()
const built = snapshot(buildLayout())

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

describe('layout invariants', () => {
  it('never overlaps two node bodies', () => {
    expect(built.audit.nodeOverlap).toEqual([])
  })

  it('never routes an edge through a node body', () => {
    expect(built.audit.edgeThroughNode).toEqual([])
  })

  // The legacy layout is not perfectly clean; these are the baseline numbers it
  // ships with. They are asserted so a future data or spec change cannot quietly
  // make the sheet worse.
  it('holds the baseline for tight channels and fallbacks', () => {
    expect(built.audit.tightChannels).toBeLessThanOrEqual(1)
    expect(built.audit.fallbacks).toBeLessThanOrEqual(3)
  })
})
