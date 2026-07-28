// ═══════════════════════════════════════════════════════════════════════════
// AUDIT · the layout invariants, checked on every build and logged once
// ═══════════════════════════════════════════════════════════════════════════

import type { Genealogy } from './graph'
import type { ObstacleField } from './obstacles'
import type { RoutingConfig } from './types'

export interface AuditReport {
  nodeOverlap: string[]
  edgeThroughNode: string[]
  tightChannels: number
  worstTightExtent: number
  fallbacks: number
}

interface Run { c: number; p1: number; p2: number; e: number }

export class LayoutAudit {
  static run(graph: Genealogy, field: ObstacleField, cfg: RoutingConfig, log = true): AuditReport {
    const report: AuditReport = {
      nodeOverlap: [], edgeThroughNode: [], tightChannels: 0,
      worstTightExtent: 0, fallbacks: graph.routerStats.fallback,
    }
    const N = graph.nodes
    for (let i = 0; i < N.length; i++) {
      for (let j = i + 1; j < N.length; j++) {
        const a = N[i], b = N[j]
        if (a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top)
          report.nodeOverlap.push(a.id + '×' + b.id)
      }
    }
    graph.edges.forEach((e) => {
      const pts = e.route!
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1]
        const vertical = Math.abs(p[0] - q[0]) < 0.6
        const hit = vertical
          ? field.blocksV(p[0], Math.min(p[1], q[1]), Math.max(p[1], q[1]), e.from.id, e.to.id)
          : field.blocksH(p[1], Math.min(p[0], q[0]), Math.max(p[0], q[0]), e.from.id, e.to.id)
        // (endpoint cards included — the field tests them against their true bounds)
        if (hit) { report.edgeThroughNode.push(e.from.id + '→' + e.to.id); break }
      }
    })
    const rows: Run[] = [], cols: Run[] = []
    graph.edges.forEach((e) => {
      const pts = e.route!
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1]
        if (Math.abs(p[0] - q[0]) < 0.6 && Math.abs(p[1] - q[1]) > 15)
          cols.push({ c: p[0], p1: Math.min(p[1], q[1]), p2: Math.max(p[1], q[1]), e: e.index })
        else if (Math.abs(p[1] - q[1]) < 0.6 && Math.abs(p[0] - q[0]) > 15)
          rows.push({ c: p[1], p1: Math.min(p[0], q[0]), p2: Math.max(p[0], q[0]), e: e.index })
      }
    })
    const tight = (arr: Run[]) => {
      let n = 0, worst = 0
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[i].e === arr[j].e) continue
          const g = Math.abs(arr[i].c - arr[j].c)
          if (g >= cfg.channelGap) continue
          const ov = Math.min(arr[i].p2, arr[j].p2) - Math.max(arr[i].p1, arr[j].p1)
          if (ov > 20) { n++; if (ov > worst && g < 9) worst = ov }
        }
      }
      return { n, worst }
    }
    const tr = tight(rows), tc = tight(cols)
    report.tightChannels = tr.n + tc.n
    report.worstTightExtent = Math.max(tr.worst, tc.worst)

    if (log) {
      const bad = report.nodeOverlap.length + report.edgeThroughNode.length + report.tightChannels
      if (bad) console.warn('[genealogy audit]', report)
      else console.info('[genealogy audit] clean ·', graph.nodes.length + ' nodes,', graph.edges.length + ' edges,',
        'routes:', JSON.stringify(graph.routerStats.byStrategy), 'fallbacks:', report.fallbacks)
    }
    return report
  }
}
