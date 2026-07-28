// ═══════════════════════════════════════════════════════════════════════════
// STYLE RESOLVERS · (model + view state) → paint. One table entry is all a new
// node tier or edge kind needs; nothing else in the app paints.
// ═══════════════════════════════════════════════════════════════════════════

import type { EdgeModel, NodeModel } from './models'
import { Shape } from './shape'
import { ARROW_HEADS, EDGE_KINDS, EDGE_KIND_KEYS, LANES, NODE_STATE, SELECTED_EDGE } from './spec'
import type { EdgeKindKey, LaneId } from './types'

export interface NodeViewState {
  visible: boolean
  read: boolean
  future: boolean
  inLineage: boolean
  lineageActive: boolean
  selected: boolean
  dim: number
}

export interface NodePaint {
  opacity: number
  pointerEvents: 'none' | 'auto'
  shape: string
  fill: string
  stroke: string
  strokeWidth: number
}

export class NodeStyle {
  static resolve(n: NodeModel, st: NodeViewState): NodePaint {
    const m = n.metrics, lane = n.lane.c
    let opacity: number
    if (!st.visible) opacity = 0
    else if (st.future) opacity = 0.05
    else if (st.lineageActive && !st.inLineage) opacity = st.dim
    else opacity = 1
    const active = st.inLineage || !st.lineageActive
    return {
      opacity,
      pointerEvents: opacity < 0.1 ? 'none' : 'auto',
      shape: Shape.forNode(n),
      fill: lane + (st.selected ? NODE_STATE.selected.fillA : m.fillA),
      stroke: lane + (st.selected ? NODE_STATE.selected.strokeA
        : (active ? m.strokeA : NODE_STATE.dimmed.strokeA)),
      strokeWidth: m.sw,
    }
  }
}

export interface EdgeViewState {
  future: boolean
  inLineage: boolean
  lineageActive: boolean
  selected: boolean
  dim: number
}

export interface EdgePaint {
  layer: 'front' | 'back'
  d: string
  stroke: string
  dash: string
  width: number
  opacity: number
  marker: string
}

export interface MarkerSpec {
  id: string
  d: string
  fill: string
  mw: number
  op: number
}

export class EdgeStyle {
  static markerId(kindKey: EdgeKindKey | string, laneId: LaneId | string): string {
    return 'head-' + kindKey + '-' + laneId
  }

  static resolve(e: EdgeModel, st: EdgeViewState): EdgePaint {
    const k = e.kind
    let opacity = k.op * (e.highlight ? 1.15 : 1)
    if (st.future) opacity = 0.04
    else if (st.lineageActive && !st.inLineage) opacity = st.dim * 0.6
    return {
      layer: k.layer,
      d: e.path,
      stroke: st.selected ? SELECTED_EDGE : e.colour,
      dash: (e.highlight && k.hiDash) ? k.hiDash : k.dash,
      width: (e.highlight ? k.w + 0.9 : k.w) * (st.selected ? 2 : ((st.inLineage && st.lineageActive) ? 1.25 : 1)),
      opacity: st.selected ? 1 : Math.min(1, opacity),
      marker: k.head === 'none' ? 'none' : 'url(#' + EdgeStyle.markerId(e.kindKey, e.markerLane) + ')',
    }
  }

  static markers(): MarkerSpec[] {
    const out: MarkerSpec[] = []
    LANES.forEach((L) => {
      EDGE_KIND_KEYS.forEach((k) => {
        const kind = EDGE_KINDS[k], head = ARROW_HEADS[kind.head]
        if (!head) return
        out.push({
          id: EdgeStyle.markerId(k, L.id), d: head.d, fill: L.c, mw: head.mw,
          op: kind.layer === 'back' ? 0.85 : 1,
        })
      })
    })
    return out
  }
}
