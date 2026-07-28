import type { EdgeModel } from './models'
import type { Point, RoutingConfig } from './types'

interface Corner {
  e: EdgeModel
  i: number
  p: Point
  score: number
}

// Turns that bundle in the same direction are drawn concentric — outermost widest.
export class CornerRadii {
  constructor(private cfg: RoutingConfig) {}

  apply(edges: EdgeModel[]) {
    const cfg = this.cfg
    const groups: Record<string, Corner[]> = {}
    edges.forEach((e) => {
      e.radii = []
      const route = e.route!
      for (let i = 1; i < route.length - 1; i++) {
        const p0 = route[i - 1], p1 = route[i], p2 = route[i + 1]
        const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1
        const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1
        const u1 = [(p1[0] - p0[0]) / l1, (p1[1] - p0[1]) / l1]
        const u2 = [(p2[0] - p1[0]) / l2, (p2[1] - p1[1]) / l2]
        const dv = [u2[0] - u1[0], u2[1] - u1[1]], dl = Math.hypot(dv[0], dv[1]) || 1
        const nv = [dv[0] / dl, dv[1] / dl]
        const sig = Math.sign(u1[0]) + ',' + Math.sign(u1[1]) + '|' + Math.sign(u2[0]) + ',' + Math.sign(u2[1])
        e.radii.push(cfg.cornerMin);
        (groups[sig] = groups[sig] || []).push({ e, i: i - 1, p: p1, score: p1[0] * nv[0] + p1[1] * nv[1] })
      }
    })

    const rank = (arr: Corner[], from: number, to: number) => {
      const n = to - from + 1
      for (let k = 0; k < n; k++) {
        const c = arr[from + k]
        c.e.radii![c.i] = Math.min(cfg.cornerMax, cfg.cornerMin + (n - 1 - k) * cfg.pitch)
      }
    }

    Object.keys(groups).forEach((sig) => {
      const arr = groups[sig].sort((p, q) => p.score - q.score)
      let start = 0
      for (let i = 1; i < arr.length; i++) {
        const d = Math.hypot(arr[i].p[0] - arr[i - 1].p[0], arr[i].p[1] - arr[i - 1].p[1])
        if (d > cfg.pitch * cfg.clusterSpread) { rank(arr, start, i - 1); start = i }
      }
      rank(arr, start, arr.length - 1)
    })
  }
}
