// ═══════════════════════════════════════════════════════════════════════════
// ROUTE STRATEGIES · each returns a point list or null; the Router tries them
// in order and relaxes the channel gap only when every strategy has failed.
// ═══════════════════════════════════════════════════════════════════════════

import type { EdgeModel } from './models'
import type { ChannelMap, ObstacleField } from './obstacles'
import { CANVAS, LANES } from './spec'
import type { Point, RoutingConfig, Span } from './types'

export abstract class RouteStrategy {
  /** stable across minification — the router reports it in its stats */
  abstract readonly name: string
  constructor(protected r: Router) {}
  abstract route(e: EdgeModel, strict?: boolean): Point[] | null
}

// exit right → shared column → enter left, with a 6-point stub detour fallback
export class ForwardRoute extends RouteStrategy {
  readonly name = 'ForwardRoute'

  route(e: EdgeModel, strict?: boolean): Point[] | null {
    if (!e.forward || e.faceA !== 'right' || e.faceB !== 'left') return null
    const r = this.r, cfg = r.cfg, a = e.from.id, b = e.to.id
    const sx = e.portA![0], ex = e.portB![0]
    const lo = sx + cfg.minLegX, hi = ex - cfg.minLegX
    if (hi > lo) {
      const base = r.snap((sx + ex) / 2)
      for (let i = 0; i < 520; i++) {
        const cands = i === 0 ? [base] : [base + i * cfg.pitch, base - i * cfg.pitch]
        for (let j = 0; j < cands.length; j++) {
          const cx = cands[j]
          if (cx < lo || cx > hi) continue
          const sy = r.pickRow(e.portA![1], e.spanA!, sx, cx, a, b, strict)
          if (sy === null) continue
          const ey = r.pickRow(e.portB![1], e.spanB!, cx, ex, a, b, strict)
          if (ey === null) continue
          if (Math.abs(sy - ey) < 1.2) {
            if (r.field.blocksH(sy, sx, ex, a, b)) continue
            if (strict && r.channels.rowBusy(sy, sx, ex)) continue
            r.channels.takeRow(sy, sx, ex)
            return [[sx, sy], [ex, sy]]
          }
          if (r.field.blocksV(cx, Math.min(sy, ey), Math.max(sy, ey), a, b)) continue
          if (strict && r.channels.colBusy(cx, Math.min(sy, ey), Math.max(sy, ey))) continue
          r.channels.takeRow(sy, sx, cx); r.channels.takeRow(ey, cx, ex); r.channels.takeCol(cx, sy, ey)
          return [[sx, sy], [cx, sy], [cx, ey], [ex, ey]]
        }
      }
    }
    // overshoot column: when no free column exists between the two ports, take one
    // outside the span and double back (rare, long cross-lane links)
    const wide = r.snap((sx + ex) / 2)
    for (let i = 1; i < 520; i++) {
      const cands = [wide + i * cfg.pitch, wide - i * cfg.pitch]
      for (let j = 0; j < cands.length; j++) {
        const cx = cands[j]
        if (cx < 70 || cx > CANVAS.w - 70) continue
        if (cx > lo && cx < hi) continue              // already tried above
        const sy = r.pickRow(e.portA![1], e.spanA!, Math.min(sx, cx), Math.max(sx, cx), a, b, strict)
        if (sy === null) continue
        const ey = r.pickRow(e.portB![1], e.spanB!, Math.min(cx, ex), Math.max(cx, ex), a, b, strict)
        if (ey === null) continue
        if (r.field.blocksV(cx, Math.min(sy, ey), Math.max(sy, ey), a, b)) continue
        if (strict && r.channels.colBusy(cx, Math.min(sy, ey), Math.max(sy, ey))) continue
        r.channels.takeRow(sy, sx, cx); r.channels.takeRow(ey, cx, ex); r.channels.takeCol(cx, sy, ey)
        return [[sx, sy], [cx, sy], [cx, ey], [ex, ey]]
      }
    }
    for (let s = 0; s < cfg.stubs.length; s++) {
      const x1 = sx + cfg.stubs[s], x2 = ex - cfg.stubs[s]
      if (x2 <= x1 + 10) continue
      const base = r.snap((e.portA![1] + e.portB![1]) / 2)
      for (let i = 0; i < 420; i++) {
        const cands = i === 0 ? [base] : [base + i * cfg.pitch, base - i * cfg.pitch]
        for (let j = 0; j < cands.length; j++) {
          const y = Math.round(cands[j] * 2) / 2
          if (r.field.blocksH(y, x1, x2, a, b)) continue
          if (strict && r.channels.rowBusy(y, x1, x2)) continue
          const sy = r.pickRow(e.portA![1], e.spanA!, sx, x1, a, b, strict)
          if (sy === null) continue
          const ey = r.pickRow(e.portB![1], e.spanB!, x2, ex, a, b, strict)
          if (ey === null) continue
          if (r.field.blocksV(x1, Math.min(sy, y), Math.max(sy, y), a, b)) continue
          if (r.field.blocksV(x2, Math.min(y, ey), Math.max(y, ey), a, b)) continue
          if (strict && (r.channels.colBusy(x1, Math.min(sy, y), Math.max(sy, y)) ||
            r.channels.colBusy(x2, Math.min(y, ey), Math.max(y, ey)))) continue
          r.channels.takeRow(sy, sx, x1); r.channels.takeRow(y, x1, x2); r.channels.takeRow(ey, x2, ex)
          r.channels.takeCol(x1, sy, y); r.channels.takeCol(x2, y, ey)
          return [[sx, sy], [x1, sy], [x1, y], [x2, y], [x2, ey], [ex, ey]]
        }
      }
    }
    return null
  }
}

// exit bottom/top → horizontal bus outside both boxes → enter the other face.
// Long hauls fall back to escape row → free full column → escape row.
export class BusRoute extends RouteStrategy {
  readonly name = 'BusRoute'

  route(e: EdgeModel, strict?: boolean): Point[] | null {
    const a = e.from, b = e.to
    const aVert = (e.faceA === 'bottom' || e.faceA === 'top')
    const bVert = (e.faceB === 'bottom' || e.faceB === 'top')
    const sxB = aVert ? e.portA![0] : e.vPortA!.c
    const exB = bVert ? e.portB![0] : e.vPortB!.c
    const sSpan: Span = aVert ? e.spanA! : { lo: e.vPortA!.lo, hi: e.vPortA!.hi }
    const eSpan: Span = bVert ? e.spanB! : { lo: e.vPortB!.lo, hi: e.vPortB!.hi }
    const cfgs: Array<[number, number, number, number]> = []
    if (b.top > a.bottom + 26) cfgs.push([a.bottom, b.top, a.bottom + 12, b.top - 12])
    if (b.bottom + 26 < a.top) cfgs.push([a.top, b.bottom, b.bottom + 12, a.top - 12])
    const lowest = Math.max(a.bottom, b.bottom), highest = Math.min(a.top, b.top)
    cfgs.push([a.bottom, b.bottom, lowest + 14, lowest + this.r.cfg.busSpan])
    cfgs.push([a.top, b.top, highest - this.r.cfg.busSpan, highest - 14])
    // last resort window: any node-free gutter on the sheet, below then above
    cfgs.push([a.bottom, b.bottom, lowest + 14, CANVAS.h - 90])
    cfgs.push([a.top, b.top, 90, highest - 14])
    for (let i = 0; i < cfgs.length; i++) {
      const c = cfgs[i]
      const pts = this._bus(e, c[0], c[1], sxB, sSpan, exB, eSpan, c[2], c[3], strict)
      if (pts) return pts
    }
    return null
  }

  private _bus(
    e: EdgeModel, sy: number, ey: number,
    sxB: number, sSpan: Span, exB: number, eSpan: Span,
    busLo: number, busHi: number, strict?: boolean,
  ): Point[] | null {
    if (busHi < busLo) return null
    const r = this.r, cfg = r.cfg, a = e.from.id, b = e.to.id
    const base = Math.max(busLo, Math.min(busHi, r.snap((sy + ey) / 2)))
    for (let i = 0; i < 600; i++) {
      const cands = i === 0 ? [base] : [base + i * cfg.pitch, base - i * cfg.pitch]
      for (let j = 0; j < cands.length; j++) {
        const y = Math.round(cands[j] * 2) / 2
        if (y < busLo || y > busHi) continue
        if (r.field.blocksH(y, Math.min(sxB, exB), Math.max(sxB, exB), a, b)) continue
        if (strict && r.channels.rowBusy(y, Math.min(sxB, exB), Math.max(sxB, exB))) continue
        const sx = r.pickCol(sxB, sSpan, sy, y, a, b, strict)
        if (sx === null) continue
        const ex = r.pickCol(exB, eSpan, y, ey, a, b, strict)
        if (ex === null) continue
        if (r.field.blocksH(y, Math.min(sx, ex), Math.max(sx, ex), a, b)) continue
        r.channels.takeRow(y, sx, ex); r.channels.takeCol(sx, sy, y); r.channels.takeCol(ex, y, ey)
        return [[sx, sy], [sx, y], [ex, y], [ex, ey]]
      }
    }
    return this._escape(e, sy, ey, sxB, exB, busLo, busHi, strict)
  }

  // escape rows sit on the same side as the bus, per endpoint
  private _escape(
    e: EdgeModel, sy: number, ey: number, sxB: number, exB: number,
    busLo: number, busHi: number, strict?: boolean,
  ): Point[] | null {
    const r = this.r, cfg = r.cfg, a = e.from.id, b = e.to.id, mid = (busLo + busHi) / 2
    const s1 = mid >= sy ? 1 : -1, s2 = mid >= ey ? 1 : -1
    const span1: Span = s1 > 0 ? { lo: sy + 12, hi: sy + cfg.escapeSpan } : { lo: sy - cfg.escapeSpan, hi: sy - 12 }
    const span2: Span = s2 > 0 ? { lo: ey + 12, hi: ey + cfg.escapeSpan } : { lo: ey - cfg.escapeSpan, hi: ey - 12 }
    const base = r.snap((sxB + exB) / 2)
    for (let i = 0; i < 640; i++) {
      const cands = i === 0 ? [base] : [base + i * cfg.pitch, base - i * cfg.pitch]
      for (let j = 0; j < cands.length; j++) {
        const cx = Math.round(cands[j] * 2) / 2
        if (cx < 40 || cx > CANVAS.w - 40) continue
        const y1 = r.pickRow(s1 > 0 ? sy + 18 : sy - 18, span1, sxB, cx, a, b, strict, true)
        if (y1 === null) continue
        const y2 = r.pickRow(s2 > 0 ? ey + 18 : ey - 18, span2, cx, exB, a, b, strict, true)
        if (y2 === null) continue
        if (r.field.blocksV(cx, Math.min(y1, y2), Math.max(y1, y2), a, b)) continue
        if (r.field.blocksV(sxB, Math.min(sy, y1), Math.max(sy, y1), a, b)) continue
        if (r.field.blocksV(exB, Math.min(y2, ey), Math.max(y2, ey), a, b)) continue
        if (strict && r.channels.colBusy(cx, Math.min(y1, y2), Math.max(y1, y2))) continue
        r.channels.takeRow(y1, sxB, cx); r.channels.takeRow(y2, cx, exB)
        r.channels.takeCol(sxB, sy, y1); r.channels.takeCol(cx, y1, y2); r.channels.takeCol(exB, y2, ey)
        return [[sxB, sy], [sxB, y1], [cx, y1], [cx, y2], [exB, y2], [exB, ey]]
      }
    }
    return null
  }
}

// Last resort: leave through the node's own face, cross in a lane gutter (rows that
// are node-free by construction), and come back up. Node-safe by search, so a link
// that defeats every channel strategy still never crosses a card.
export class FallbackRoute extends RouteStrategy {
  readonly name = 'FallbackRoute'
  private _g: number[] | null = null

  gutters(): number[] {
    if (this._g) return this._g
    const g: number[] = []
    for (let i = 0; i < LANES.length; i++) {
      const prev = i === 0 ? 90 : LANES[i - 1].y1
      g.push((prev + LANES[i].y0) / 2)
    }
    g.push((LANES[LANES.length - 1].y1 + CANVAS.h - 90) / 2)
    this._g = g
    return g
  }

  route(e: EdgeModel): Point[] {
    const r = this.r, a = e.from, b = e.to, aid = a.id, bid = b.id
    const sideA = e.faceA === 'left' || e.faceA === 'right'
    const sideB = e.faceB === 'left' || e.faceB === 'right'
    const baseSx = sideA ? (e.vPortA ? e.vPortA.c : a.cx) : e.portA![0]
    const baseEx = sideB ? (e.vPortB ? e.vPortB.c : b.cx) : e.portB![0]
    const mid = (a.cy + b.cy) / 2
    const rows = this.gutters().slice().sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))
    for (let gi = 0; gi < rows.length; gi++) {
      const y = rows[gi]
      const sy = y > a.cy ? a.bottom : a.top
      const ey = y > b.cy ? b.bottom : b.top
      const sx = this._freeCol(baseSx, sy, y, aid, bid)
      if (sx === null) continue
      const ex = this._freeCol(baseEx, ey, y, aid, bid)
      if (ex === null) continue
      if (r.field.blocksH(y, Math.min(sx, ex), Math.max(sx, ex), aid, bid)) continue
      r.channels.takeRow(y, sx, ex); r.channels.takeCol(sx, sy, y); r.channels.takeCol(ex, y, ey)
      return [[sx, sy], [sx, y], [ex, y], [ex, ey]]
    }
    const down = b.cy >= a.cy
    const sy = down ? a.bottom : a.top, ey = down ? b.top : b.bottom
    const y = down ? Math.max(sy + 14, (a.cy + b.cy) / 2) : Math.min(sy - 14, (a.cy + b.cy) / 2)
    return [[a.cx, sy], [a.cx, y], [b.cx, y], [b.cx, ey]]
  }

  // nearest column whose vertical run to the gutter clears every card
  private _freeCol(base: number, y1: number, y2: number, aid: string, bid: string): number | null {
    const r = this.r, lo = Math.min(y1, y2), hi = Math.max(y1, y2)
    for (let i = 0; i < 900; i++) {
      const cands = i === 0 ? [base] : [base + i * 4, base - i * 4]
      for (let j = 0; j < cands.length; j++) {
        const x = Math.round(cands[j] * 2) / 2
        if (x < 70 || x > CANVAS.w - 70) continue
        if (r.field.blocksV(x, lo, hi, aid, bid)) continue
        if (r.channels.colBusy(x, lo, hi)) continue
        return x
      }
    }
    return null
  }
}

export interface RouterStats {
  byStrategy: Record<string, number>
  fallback: number
}

export class Router {
  readonly strategies: RouteStrategy[]
  readonly fallback: FallbackRoute
  readonly stats: RouterStats = { byStrategy: {}, fallback: 0 }

  constructor(
    readonly field: ObstacleField,
    readonly channels: ChannelMap,
    readonly cfg: RoutingConfig,
  ) {
    this.strategies = [new ForwardRoute(this), new BusRoute(this)]
    this.fallback = new FallbackRoute(this)
  }

  snap(v: number) { return Math.round(v / this.cfg.pitch) * this.cfg.pitch }

  pickCol(base: number, span: Span, y1: number, y2: number, a: string, b: string, strict?: boolean, grid?: boolean): number | null {
    const lo = span.lo, hi = span.hi, p1 = Math.min(y1, y2), p2 = Math.max(y1, y2)
    const step = grid ? this.cfg.pitch : 2, b0 = grid ? this.snap(base) : base
    for (let i = 0; i < 340; i++) {
      const cands = i === 0 ? [b0] : [b0 + i * step, b0 - i * step]
      for (let j = 0; j < cands.length; j++) {
        const x = Math.round(cands[j] * 2) / 2
        if (x < lo || x > hi) continue
        if (this.field.blocksV(x, p1, p2, a, b)) continue
        if (strict && this.channels.colBusy(x, p1, p2)) continue
        return x
      }
    }
    return null
  }

  pickRow(base: number, span: Span, x1: number, x2: number, a: string, b: string, strict?: boolean, grid?: boolean): number | null {
    const lo = span.lo, hi = span.hi, p1 = Math.min(x1, x2), p2 = Math.max(x1, x2)
    const step = grid ? this.cfg.pitch : 2, b0 = grid ? this.snap(base) : base
    for (let i = 0; i < 340; i++) {
      const cands = i === 0 ? [b0] : [b0 + i * step, b0 - i * step]
      for (let j = 0; j < cands.length; j++) {
        const y = Math.round(cands[j] * 2) / 2
        if (y < lo || y > hi) continue
        if (this.field.blocksH(y, p1, p2, a, b)) continue
        if (strict && this.channels.rowBusy(y, p1, p2)) continue
        return y
      }
    }
    return null
  }

  // short, tightly constrained links route first so long hauls detour instead
  routeAll(edges: EdgeModel[]) {
    edges.slice().sort((p, q) => p.span - q.span).forEach((e) => {
      let pts: Point[] | null = null
      for (let gi = 0; gi < this.cfg.gapLadder.length && !pts; gi++) {
        this.channels.setGap(this.cfg.gapLadder[gi])
        for (let si = 0; si < this.strategies.length && !pts; si++) {
          pts = this.strategies[si].route(e, true)
          if (pts) {
            const k = this.strategies[si].name
            this.stats.byStrategy[k] = (this.stats.byStrategy[k] || 0) + 1
          }
        }
      }
      if (!pts) { pts = this.fallback.route(e); this.stats.fallback++ }
      this.channels.resetGap()
      e.route = pts
      e.mid = { x: (pts[0][0] + pts[pts.length - 1][0]) / 2, y: (pts[0][1] + pts[pts.length - 1][1]) / 2 }
    })
  }
}
