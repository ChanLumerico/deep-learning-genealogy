// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN MODEL · specs stay pure data; models carry the resolved geometry
// ═══════════════════════════════════════════════════════════════════════════

import { PAPERS } from '../data/papers'
import { EDGE_KINDS, LANE_BY_ID, NEUTRAL, NODE_SIZES } from './spec'
import type {
  EdgeKind,
  EdgeKindKey,
  EdgeSpec,
  Face,
  Lane,
  NodeMetrics,
  NodeSpec,
  Point,
  Span,
  VPort,
} from './types'

export class NodeModel {
  readonly spec: NodeSpec
  readonly id: string
  readonly name: string
  readonly year: number
  readonly org: string
  readonly contribution: string
  readonly problem?: string
  readonly idea?: string
  readonly limitation?: string
  readonly lane: Lane
  readonly track: string
  readonly sizeKey: NodeSpec['s']
  readonly metrics: NodeMetrics
  readonly paper: string | null
  readonly w: number
  readonly h: number
  x = 0
  y = 0
  edgesIn: EdgeModel[] = []
  edgesOut: EdgeModel[] = []

  constructor(spec: NodeSpec) {
    this.spec = spec
    this.id = spec.id; this.name = spec.n; this.year = spec.y; this.org = spec.org
    this.contribution = spec.c; this.problem = spec.p; this.idea = spec.i; this.limitation = spec.l
    this.lane = LANE_BY_ID[spec.lane]; this.track = spec.tr
    this.sizeKey = spec.s; this.metrics = NODE_SIZES[spec.s]
    this.paper = PAPERS[spec.id] || null
    this.w = this.metrics.w; this.h = this.metrics.h
  }

  get left() { return this.x }
  get right() { return this.x + this.w }
  get top() { return this.y }
  get bottom() { return this.y + this.h }
  get cx() { return this.x + this.w / 2 }
  get cy() { return this.y + this.h / 2 }
  get tier() { return this.metrics.lines }
  get meta() { return this.year + ' · ' + this.org }
}

export class EdgeModel {
  readonly spec: EdgeSpec
  readonly index: number
  readonly from: NodeModel
  readonly to: NodeModel
  readonly kindKey: EdgeKindKey
  readonly kind: EdgeKind
  readonly label: string | null
  readonly highlight: boolean
  forward = false
  faceA: Face | null = null
  faceB: Face | null = null
  /** [x,y] on the node face */
  portA: Point | null = null
  portB: Point | null = null
  /** the window the port may slide within */
  spanA: Span | null = null
  spanB: Span | null = null
  /** slot on the vertical face */
  vPortA: VPort | null = null
  vPortB: VPort | null = null
  route: Point[] | null = null
  radii: number[] | null = null
  path = ''
  mid: { x: number; y: number } | null = null

  constructor(spec: EdgeSpec, from: NodeModel, to: NodeModel, index: number) {
    this.spec = spec; this.index = index
    this.from = from; this.to = to
    this.kindKey = spec.k; this.kind = EDGE_KINDS[spec.k]
    this.label = spec.l || null; this.highlight = !!spec.hi
  }

  get sourceId() { return this.from.id }
  get targetId() { return this.to.id }

  get colour(): string {
    const w = this.kind.colourFrom
    return w === 'neutral' ? NEUTRAL : (w === 'target' ? this.to.lane.c : this.from.lane.c)
  }

  get markerLane() { return this.kind.colourFrom === 'target' ? this.to.lane.id : this.from.lane.id }

  get span() { return Math.abs(this.to.cx - this.from.cx) + Math.abs(this.to.cy - this.from.cy) }

  /** an unlabeled relation still reads: fall back to the counterpart's contribution */
  describe(other?: NodeModel | null): string {
    return this.label || (other ? other.contribution : this.kind.note)
  }
}
