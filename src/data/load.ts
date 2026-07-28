// The graph lives under public/data — the only place to add, edit or delete a model
// or a relationship. One record per line, one file per research domain.
// See public/data/README.md for the layout and public/data/schema.json for the spec.

import type { EdgeSpec, LaneId, NodeSpec } from '../layout'

export interface Manifest {
  version: number
  description?: string
  schema?: string
  nodes: Array<{ lane: LaneId; label: string; path: string }>
  edges: Array<{ path: string }>
}

export interface GraphData {
  nodes: NodeSpec[]
  edges: EdgeSpec[]
}

const base = import.meta.env.BASE_URL || '/'
const url = (path: string) => base.replace(/\/$/, '') + '/' + path.replace(/^\//, '')

/** manifest.json lists every source file and their load order. */
export async function loadGraphData(): Promise<GraphData> {
  const manifest: Manifest = await fetch(url('data/manifest.json')).then((r) => {
    if (!r.ok) throw new Error(`manifest: ${r.status} ${r.statusText}`)
    return r.json()
  })
  const load = async <T>(list: Array<{ path: string }>): Promise<T[]> => {
    const parts = await Promise.all(list.map((f) => fetch(url(f.path)).then((r) => {
      if (!r.ok) throw new Error(`${f.path}: ${r.status} ${r.statusText}`)
      return r.json() as Promise<T[]>
    })))
    return ([] as T[]).concat(...parts)
  }
  const [nodes, edges] = await Promise.all([
    load<NodeSpec>(manifest.nodes),
    load<EdgeSpec>(manifest.edges),
  ])
  return { nodes, edges }
}
