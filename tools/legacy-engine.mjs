// Loads the ORIGINAL layout engine straight out of the legacy .dc.html and runs it
// under Node. Nothing is transcribed by hand: the source text between the spec-table
// banner and the Component class is evaluated as-is, so whatever this produces is by
// definition what the legacy app drew.
//
// The slice is DOM-free (verified: the only `window` references are in ReadingLog,
// which the build path never calls), so a couple of inert stubs are enough.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY_HTML = join(ROOT, 'legacy', 'Deep Learning Genealogy.dc.html')

const START = 'const CANVAS = {w:5760, h:5880};'
const END = 'class Component extends DCLogic {'

/** Cut the engine out of the legacy single-file app. */
export function extractEngineSource() {
  const html = readFileSync(LEGACY_HTML, 'utf8')
  const from = html.indexOf(START)
  const to = html.indexOf(END)
  if (from < 0) throw new Error(`legacy engine start marker not found: ${START}`)
  if (to < 0) throw new Error(`legacy engine end marker not found: ${END}`)
  if (to < from) throw new Error('legacy engine markers are out of order')
  return html.slice(from, to)
}

/** Evaluate the legacy engine and hand back the pieces the harness needs. */
export function loadLegacyEngine() {
  const preamble = `
    // svgText() closes over React but is only reached from render, never from build().
    const React = { createElement: () => null };
    // ReadingLog is inside the slice but is never called on the build path.
    const window = { localStorage: { getItem: () => null, setItem: () => {} } };
  `
  const epilogue = `
    return { LayoutEngine, ROUTING, CANVAS, LANES, NODE_SIZES, EDGE_KINDS, TIME, Shape };
  `
  const factory = new Function(`${preamble}\n${extractEngineSource()}\n${epilogue}`)
  return factory()
}

/** Read the graph exactly the way the browser does: manifest order, then concatenate. */
export function loadGraphData(dataRoot = join(ROOT, 'legacy', 'data')) {
  const manifest = JSON.parse(readFileSync(join(dataRoot, 'manifest.json'), 'utf8'))
  const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'legacy', rel), 'utf8'))
  const nodes = manifest.nodes.flatMap((f) => read(f.path))
  const edges = manifest.edges.flatMap((f) => read(f.path))
  return { nodes, edges }
}

/**
 * Build with the legacy engine and reduce the result to the geometry that must not
 * drift. Ports and faces are included so a mismatch points at the phase that broke,
 * not just at the final path string.
 */
export function buildLegacyLayout() {
  const { LayoutEngine, ROUTING } = loadLegacyEngine()
  const { nodes, edges } = loadGraphData()
  const graph = new LayoutEngine(nodes, edges, ROUTING).build()
  return snapshot(graph)
}

export function snapshot(graph) {
  return {
    meta: { nodes: graph.nodes.length, edges: graph.edges.length },
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
    })),
    edges: graph.edges.map((e) => ({
      index: e.index,
      f: e.from.id,
      t: e.to.id,
      forward: e.forward,
      faceA: e.faceA,
      faceB: e.faceB,
      portA: e.portA,
      portB: e.portB,
      route: e.route,
      radii: e.radii,
      path: e.path,
    })),
    routerStats: graph.routerStats,
    audit: {
      nodeOverlap: graph.audit.nodeOverlap,
      edgeThroughNode: graph.audit.edgeThroughNode,
      tightChannels: graph.audit.tightChannels,
      worstTightExtent: graph.audit.worstTightExtent,
      fallbacks: graph.audit.fallbacks,
    },
  }
}
