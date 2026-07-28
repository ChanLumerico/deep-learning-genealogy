// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE · explicit phases: instantiate → place → link → ports → route
//                 → corner radii → paths → audit
// ═══════════════════════════════════════════════════════════════════════════

import { LayoutAudit } from './audit'
import { CornerRadii } from './corners'
import { Genealogy } from './graph'
import { EdgeModel, NodeModel } from './models'
import { ChannelMap, ObstacleField } from './obstacles'
import { PortAllocator } from './ports'
import { Router } from './routes'
import { Shape } from './shape'
import { ROUTING } from './spec'
import { TIME } from './time'
import type { EdgeSpec, NodeSpec, RoutingConfig } from './types'

export interface BuildOptions {
  /** the audit prints one console line per build; silence it in tests */
  log?: boolean
}

export class LayoutEngine {
  private cfg: RoutingConfig

  constructor(
    private nodeSpecs: NodeSpec[],
    private edgeSpecs: EdgeSpec[],
    cfg?: RoutingConfig,
  ) {
    this.cfg = cfg || ROUTING
  }

  build(opts: BuildOptions = {}): Genealogy {
    const nodes = this.nodeSpecs.map((spec) => new NodeModel(spec))
    const byId: Record<string, NodeModel> = {}
    nodes.forEach((n) => { byId[n.id] = n })
    this._place(nodes)
    const edges = this._link(byId)
    const field = new ObstacleField(nodes, this.cfg.clearance)
    const channels = new ChannelMap(this.cfg)
    new PortAllocator(nodes, edges, this.cfg, byId).allocate()
    const router = new Router(field, channels, this.cfg)
    router.routeAll(edges)
    new CornerRadii(this.cfg).apply(edges)
    edges.forEach((e) => { e.path = Shape.ortho(e.route, e.radii, field, e.from.id, e.to.id) })
    const graph = new Genealogy(nodes, edges)
    graph.field = field
    graph.routerStats = router.stats
    graph.audit = LayoutAudit.run(graph, field, this.cfg, opts.log !== false)
    return graph
  }

  // year → x from the time scale, then push right so a track never overlaps itself
  private _place(nodes: NodeModel[]) {
    nodes.forEach((n) => {
      n.x = TIME.x(n.year) - n.w / 2
      n.y = n.lane.tracks[n.track] - n.h / 2
    })
    const tracks: Record<string, NodeModel[]> = {}
    nodes.forEach((n) => {
      const k = n.lane.id + '/' + n.track;
      (tracks[k] = tracks[k] || []).push(n)
    })
    const gap = this.cfg.trackGap
    Object.keys(tracks).forEach((k) => {
      const arr = tracks[k].sort((a, b) => (a.year - b.year) || (a.x - b.x))
      let cursor = -Infinity
      arr.forEach((n) => {
        if (n.x < cursor) n.x = cursor
        cursor = n.x + n.w + gap
      })
    })
  }

  private _link(byId: Record<string, NodeModel>): EdgeModel[] {
    const out: EdgeModel[] = []
    this.edgeSpecs.forEach((spec) => {
      const a = byId[spec.f], b = byId[spec.t]
      if (!a || !b) return   // an unknown endpoint is skipped, never crashes the build
      out.push(new EdgeModel(spec, a, b, out.length))
    })
    return out
  }
}
