import { ROUTING } from './spec'
import type { NodeMetrics, Point } from './types'

/** What Shape.ortho needs from the obstacle field — kept structural to avoid a cycle. */
export interface SegmentBlocker {
  blocksSegment(A: Point, B: Point, ownA: string, ownB: string): boolean
}

/** What Shape.forNode needs from a node — kept structural to avoid a cycle. */
export interface ShapedNode {
  w: number
  h: number
  metrics: NodeMetrics
}

export class Shape {
  static card(w: number, h: number, r: number): string {
    return 'M' + r + ' 0H' + (w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + w + ' ' + r + 'V' + (h - r) +
      'A' + r + ' ' + r + ' 0 0 1 ' + (w - r) + ' ' + h +
      'H' + r + 'A' + r + ' ' + r + ' 0 0 1 0 ' + (h - r) + 'V' + r + 'A' + r + ' ' + r + ' 0 0 1 ' + r + ' 0Z'
  }

  static hex(w: number, h: number): string {
    return 'M' + (w * 0.2) + ' 0H' + (w * 0.8) + 'L' + w + ' ' + (h / 2) +
      'L' + (w * 0.8) + ' ' + h + 'H' + (w * 0.2) + 'L0 ' + (h / 2) + 'Z'
  }

  static forNode(n: ShapedNode): string {
    return n.metrics.shape === 'hex' ? Shape.hex(n.w, n.h) : Shape.card(n.w, n.h, n.metrics.radius)
  }

  // Manhattan polyline; every turn is a quarter arc whose radius the caller supplies.
  static ortho(
    pts: Point[] | null,
    radii: number[] | null,
    field: SegmentBlocker,
    ownA: string,
    ownB: string,
  ): string {
    if (!pts || pts.length < 2) return ''
    const f = (v: number) => Math.round(v * 10) / 10
    let d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1])
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1]
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1
      const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1
      const u1 = [(p1[0] - p0[0]) / l1, (p1[1] - p0[1]) / l1]
      const u2 = [(p2[0] - p1[0]) / l2, (p2[1] - p1[1]) / l2]
      let rr = Math.min((radii && radii[i - 1]) || ROUTING.cornerMin, l1 * 0.5, l2 * 0.5)
      let A: Point = [p1[0] - u1[0] * rr, p1[1] - u1[1] * rr]
      let B: Point = [p1[0] + u2[0] * rr, p1[1] + u2[1] * rr]
      while (rr > 4 && field.blocksSegment(A, B, ownA, ownB)) {
        rr *= 0.65
        A = [p1[0] - u1[0] * rr, p1[1] - u1[1] * rr]
        B = [p1[0] + u2[0] * rr, p1[1] + u2[1] * rr]
      }
      const sweep = (u1[0] * u2[1] - u1[1] * u2[0]) > 0 ? 1 : 0
      d += 'L' + f(A[0]) + ' ' + f(A[1]) + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 ' + sweep + ' ' + f(B[0]) + ' ' + f(B[1])
    }
    const last = pts[pts.length - 1]
    return d + 'L' + f(last[0]) + ' ' + f(last[1])
  }
}

export function clip(s: string | undefined | null, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
