import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LayoutEngine } from '../src/layout'
import type { Genealogy } from '../src/layout/graph'
import type { EdgeSpec, NodeSpec } from '../src/layout'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Read the graph the same way the browser does: manifest order, then concatenate. */
export function loadGraphData(dataRoot = join(ROOT, 'public', 'data')) {
  const manifest = JSON.parse(readFileSync(join(dataRoot, 'manifest.json'), 'utf8'))
  const read = (rel: string) => JSON.parse(readFileSync(join(ROOT, 'public', rel), 'utf8'))
  const nodes: NodeSpec[] = manifest.nodes.flatMap((f: { path: string }) => read(f.path))
  const edges: EdgeSpec[] = manifest.edges.flatMap((f: { path: string }) => read(f.path))
  return { nodes, edges }
}

export function buildLayout(): Genealogy {
  const { nodes, edges } = loadGraphData()
  return new LayoutEngine(nodes, edges).build({ log: false })
}

/**
 * Reduce a build to the geometry that must not drift. Shape and key order match
 * tools/legacy-engine.mjs exactly, so the two snapshots can be compared verbatim.
 */
export function snapshot(graph: Genealogy) {
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

export function loadGolden() {
  return JSON.parse(readFileSync(join(ROOT, 'test', 'golden', 'layout.json'), 'utf8'))
}
