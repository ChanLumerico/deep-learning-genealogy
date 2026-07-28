import type { EdgePaint, EdgeModel, NodeModel, NodePaint } from '../layout'

export interface NodeVM {
  node: NodeModel
  paint: NodePaint
  read: boolean
}

export interface EdgeVM {
  key: number
  paint: EdgePaint
}

export interface EdgeHitVM {
  key: number
  d: string
  edge: EdgeModel
}

export interface LaneVM {
  id: string
  label: string
  big: string
  c: string
  y0: number
  y1: number
  h: number
  tint: number
}

export interface LaneLabelVM {
  id: string
  label: string
  c: string
  op: number
  count: string
  top: number
}

export interface TickVM {
  year: number
  x: number
  gridOp: number
  op: number
}

export interface ToggleVM {
  key: string
  label: string
  bg: string
  bd: string
  fg: string
  onClick: () => void
}

export interface PanelField {
  k: string
  v: string
  c: string
  it: 'normal' | 'italic'
}

export interface PanelItem {
  name: string
  kind: string
  note: string
  c: string
  onClick: () => void
}

export interface PanelGroup {
  k: string
  items: PanelItem[]
}

export interface PanelVM {
  color: string
  kicker: string
  title: string
  meta: string
  lead: string
  fields: PanelField[]
  groups: PanelGroup[]
}

export interface ReadItemVM {
  id: string
  name: string
  year: number
  paper: string
  read: boolean
  box: string
  boxBd: string
  boxBg: string
  boxFg: string
  nameCol: string
}

export interface ReadGroupVM {
  id: string
  label: string
  c: string
  items: ReadItemVM[]
  tally: string
  done: number
}
