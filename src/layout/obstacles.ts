// ═══════════════════════════════════════════════════════════════════════════
// ROUTING PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

import type { NodeModel } from './models'
import type { Point, RoutingConfig } from './types'

interface Box {
  id: string
  x0: number; x1: number; y0: number; y1: number
  ix0: number; ix1: number; iy0: number; iy1: number
}

export class ObstacleField {
  readonly boxes: Box[]

  constructor(nodes: NodeModel[], pad: number) {
    this.boxes = nodes.map((n) => ({
      id: n.id,
      x0: n.left - pad, x1: n.right + pad, y0: n.top - pad, y1: n.bottom + pad,
      ix0: n.left + 1, ix1: n.right - 1, iy0: n.top + 1, iy1: n.bottom - 1,
    }))
  }

  // The edge's own two cards are NOT exempt: they are tested against their true
  // bounds (insets), so a run may leave from a face but never cross the card it
  // starts or ends on. Every other card is tested with its clearance padding.
  blocksV(x: number, y1: number, y2: number, a: string, b: string): boolean {
    for (let i = 0; i < this.boxes.length; i++) {
      const o = this.boxes[i]
      if (o.id === a || o.id === b) {
        if (x > o.ix0 && x < o.ix1 && y2 > o.iy0 && y1 < o.iy1) return true
        continue
      }
      if (x > o.x0 && x < o.x1 && y2 > o.y0 && y1 < o.y1) return true
    }
    return false
  }

  blocksH(y: number, x1: number, x2: number, a: string, b: string): boolean {
    for (let i = 0; i < this.boxes.length; i++) {
      const o = this.boxes[i]
      if (o.id === a || o.id === b) {
        if (y > o.iy0 && y < o.iy1 && x2 > o.ix0 && x1 < o.ix1) return true
        continue
      }
      if (y > o.y0 && y < o.y1 && x2 > o.x0 && x1 < o.x1) return true
    }
    return false
  }

  // used by corner arcs: the edge's own two boxes are tested against true bounds
  blocksSegment(A: Point, B: Point, ownA: string, ownB: string): boolean {
    for (let k = 1; k < 8; k++) {
      const t = k / 8, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t
      for (let i = 0; i < this.boxes.length; i++) {
        const o = this.boxes[i]
        if (o.id === ownA || o.id === ownB) {
          if (x > o.ix0 && x < o.ix1 && y > o.iy0 && y < o.iy1) return true
          continue
        }
        if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return true
      }
    }
    return false
  }
}

interface Run { c: number; p1: number; p2: number }

// Row/column occupancy with an enforced lateral gap. Bucketed so a lookup only
// scans neighbouring channels.
export class ChannelMap {
  private rows: Record<number, Run[]> = {}
  private cols: Record<number, Run[]> = {}
  private readonly base: number
  private readonly pad: number
  private gap: number

  constructor(cfg: RoutingConfig) {
    this.base = cfg.channelGap
    this.pad = cfg.overlapPad
    this.gap = cfg.channelGap
  }

  setGap(g: number) { this.gap = g }
  resetGap() { this.gap = this.base }

  private _bucket(v: number) { return Math.round(v / this.base) }

  // Long runs are the ones the eye reads as doubled lines, so they always keep the
  // full gap even when the router has relaxed for a short stub.
  private _busy(store: Record<number, Run[]>, v: number, p1: number, p2: number): boolean {
    const a1 = Math.min(p1, p2), a2 = Math.max(p1, p2), k = this._bucket(v)
    const longRun = (a2 - a1) > 260
    for (let d = -2; d <= 2; d++) {
      const arr = store[k + d]
      if (!arr) continue
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i]
        const need = (longRun || (it.p2 - it.p1) > 260) ? this.base : this.gap
        if (Math.abs(it.c - v) < need && a2 > it.p1 - this.pad && a1 < it.p2 + this.pad) return true
      }
    }
    return false
  }

  private _claim(store: Record<number, Run[]>, v: number, p1: number, p2: number) {
    const k = this._bucket(v);
    (store[k] = store[k] || []).push({ c: v, p1: Math.min(p1, p2), p2: Math.max(p1, p2) })
  }

  rowBusy(y: number, x1: number, x2: number) { return this._busy(this.rows, y, x1, x2) }
  colBusy(x: number, y1: number, y2: number) { return this._busy(this.cols, x, y1, y2) }
  takeRow(y: number, x1: number, x2: number) { this._claim(this.rows, y, x1, x2) }
  takeCol(x: number, y1: number, y2: number) { this._claim(this.cols, x, y1, y2) }
}
