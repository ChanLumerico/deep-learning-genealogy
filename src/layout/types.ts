// Record shapes as they appear on disk under public/data. Field names are the terse
// ones the data files use; see public/data/schema.json.

export type LaneId = 'found' | 'cv' | 'nlp' | 'gen' | 'rl' | 'mm'
export type SizeKey = 'L' | 'M' | 'S' | 'H'
export type EdgeKindKey = 'direct' | 'cross' | 'fusion' | 'alt'

export interface NodeSpec {
  id: string
  /** display name */
  n: string
  /** publication year */
  y: number
  org: string
  /** core contribution, one short phrase */
  c: string
  lane: LaneId
  /** track within the lane (vertical row) */
  tr: string
  /** L paradigm | M major | S variant | H technique */
  s: SizeKey
  /** problem it solved */
  p?: string
  /** key idea */
  i?: string
  /** limitation it left behind */
  l?: string
}

export interface EdgeSpec {
  /** source node id */
  f: string
  /** target node id */
  t: string
  k: EdgeKindKey
  /** what changed, "limit → fix" form */
  l?: string
  /** draw thicker as a spine of the tree */
  hi?: boolean
}

export interface Lane {
  id: LaneId
  label: string
  big: string
  short: string
  c: string
  y0: number
  y1: number
  tracks: Record<string, number>
}

export interface NodeMetrics {
  w: number
  h: number
  fs: number
  shape: 'card' | 'hex'
  radius: number
  lines: number
  clip: number
  sw: number
  fillA: string
  strokeA: string
  nameWeight: number
  nameTrack: number
}

export interface EdgeKind {
  label: string
  /** the filter button's version — the legend carries the full label */
  short: string
  note: string
  w: number
  dash: string
  op: number
  colourFrom: 'source' | 'target' | 'neutral'
  head: 'arrow' | 'merge' | 'none'
  layer: 'front' | 'back'
  lineage: boolean
  hiDash?: string
}

export interface RoutingConfig {
  clearance: number
  channelGap: number
  overlapPad: number
  facePad: number
  portPitch: number
  pitch: number
  trackGap: number
  gapLadder: number[]
  stubs: number[]
  escapeSpan: number
  busSpan: number
  minLegX: number
  cornerMin: number
  cornerMax: number
  clusterSpread: number
}

/** [x, y] */
export type Point = [number, number]
/** the window a port may slide within, along its face */
export interface Span {
  lo: number
  hi: number
}
/** a reserved slot on a vertical face: centre plus the face's own extent */
export interface VPort {
  c: number
  lo: number
  hi: number
}

export type Face = 'left' | 'right' | 'top' | 'bottom'
