// ═══════════════════════════════════════════════════════════════════════════
// GRAPH · the built result; owns ancestry queries and lookup
// ═══════════════════════════════════════════════════════════════════════════

import type { EdgeModel, NodeModel } from './models'
import type { ObstacleField } from './obstacles'
import type { RouterStats } from './routes'
import type { AuditReport } from './audit'
import type { LaneId } from './types'

export class Genealogy {
  readonly byId: Record<string, NodeModel> = {}
  private up: Record<string, string[]> = {}
  private down: Record<string, string[]> = {}

  /** attached by LayoutEngine once the build finishes */
  field!: ObstacleField
  routerStats!: RouterStats
  audit!: AuditReport

  constructor(readonly nodes: NodeModel[], readonly edges: EdgeModel[]) {
    nodes.forEach((n) => { this.byId[n.id] = n })
    edges.forEach((e) => {
      e.from.edgesOut.push(e); e.to.edgesIn.push(e)
      if (!e.kind.lineage) return;
      (this.down[e.from.id] = this.down[e.from.id] || []).push(e.to.id);
      (this.up[e.to.id] = this.up[e.to.id] || []).push(e.from.id)
    })
  }

  /**
   * The years the sheet actually covers, as an em-dashed range.
   *
   * The bar used to spell this out as a literal. It said 1957 — 2025 for a
   * while after 2026 arrived, because nothing connects a caption to the data
   * it describes. Derived here so the only way to be wrong about it is to be
   * wrong about the graph.
   */
  get span(): string {
    let lo = Infinity, hi = -Infinity
    this.nodes.forEach((n) => { if (n.year < lo) lo = n.year; if (n.year > hi) hi = n.year })
    return lo === Infinity ? '' : `${lo} — ${hi}`
  }

  /** every ancestor and descendant of `id`, following lineage edges only */
  lineage(id: string): Record<string, 1> {
    const set: Record<string, 1> = {}
    set[id] = 1
    const walk = (cur: string, map: Record<string, string[]>) => {
      (map[cur] || []).forEach((n) => { if (!set[n]) { set[n] = 1; walk(n, map) } })
    }
    walk(id, this.up); walk(id, this.down)
    return set
  }

  search(q: string): NodeModel | null {
    const s = (q || '').toLowerCase().trim()
    if (!s) return null
    return this.nodes.find((n) => n.name.toLowerCase().includes(s)) ||
      this.nodes.find((n) => n.id.includes(s)) || null
  }

  laneCount(laneId: LaneId): number {
    return this.nodes.filter((n) => n.lane.id === laneId).length
  }
}
