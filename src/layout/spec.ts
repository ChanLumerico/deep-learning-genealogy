// ═══════════════════════════════════════════════════════════════════════════
// SPEC TABLES · the only edit surface. A new lane, node size or edge kind is
// one entry here; nothing below hard-codes a colour, a width or a dash.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  EdgeKind,
  EdgeKindKey,
  Lane,
  LaneId,
  NodeMetrics,
  RoutingConfig,
  SizeKey,
} from './types'

export const CANVAS = { w: 5760, h: 5880 }

export const YEAR_X: Array<[number, number]> = [
  [1957, 150], [1958, 196], [1980, 560], [1985, 660], [1986, 720], [1988, 790],
  [1989, 850], [1990, 910], [1992, 976], [1997, 1064], [1998, 1120], [2000, 1200],
  [2002, 1250], [2003, 1300], [2006, 1390], [2010, 1520], [2012, 1700], [2013, 1900],
  [2014, 2140], [2015, 2420], [2016, 2700], [2017, 2990], [2018, 3280], [2019, 3560],
  [2020, 3830], [2021, 4090], [2022, 4340], [2023, 4620], [2024, 5030], [2025, 5420],
]

export const TICK_YEARS = [
  1957, 1980, 1986, 1990, 1997, 1998, 2003, 2006, 2010, 2012, 2013, 2014, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
]

export const LANES: Lane[] = [
  { id: 'found', label: 'Foundations & Techniques', big: 'FOUNDATIONS', short: 'Foundations', c: '#9fa9b5', y0: 190, y1: 640, tracks: { main: 270, tech: 420, energy: 560 } },
  { id: 'cv', label: 'Computer Vision', big: 'COMPUTER VISION', short: 'CV', c: '#5f9bf0', y0: 730, y1: 1960, tracks: { back: 800, back2: 950, eff: 1100, det: 1250, det2: 1400, seg: 1550, vit: 1720, vit2: 1870 } },
  { id: 'nlp', label: 'NLP / Sequence', big: 'NLP / SEQUENCE', short: 'NLP', c: '#4fba86', y0: 2050, y1: 3020, tracks: { rnn: 2120, emb: 2280, tr: 2440, enc: 2600, eff: 2760, open: 2920 } },
  { id: 'gen', label: 'Generative Models', big: 'GENERATIVE', short: 'Generative', c: '#a888e6', y0: 3110, y1: 4180, tracks: { vae: 3190, gan: 3360, cond: 3530, ar: 3700, flow: 3870, diff: 4070 } },
  { id: 'rl', label: 'Reinforcement Learning', big: 'REINFORCEMENT', short: 'RL', c: '#e0913f', y0: 4290, y1: 5250, tracks: { var: 4360, value: 4520, pg: 4680, det: 4840, plan: 5010, il: 5170 } },
  { id: 'mm', label: 'Multimodal', big: 'MULTIMODAL', short: 'Multimodal', c: '#e07aa8', y0: 5350, y1: 5740, tracks: { a: 5430, b: 5640 } },
]

export const SANS = "'IBM Plex Sans', system-ui, sans-serif"

// importance tier → geometry, type sizes and the weight/tint that encode rank
export const NODE_SIZES: Record<SizeKey, NodeMetrics> = {
  L: { w: 206, h: 80, fs: 17, shape: 'card', radius: 4, lines: 3, clip: 34, sw: 2.4, fillA: '26', strokeA: 'ff', nameWeight: 600, nameTrack: -0.3 },
  M: { w: 172, h: 66, fs: 14, shape: 'card', radius: 4, lines: 3, clip: 29, sw: 1.4, fillA: '1c', strokeA: 'ff', nameWeight: 500, nameTrack: -0.1 },
  S: { w: 140, h: 38, fs: 12, shape: 'card', radius: 15, lines: 1, clip: 0, sw: 1.1, fillA: '16', strokeA: 'f2', nameWeight: 400, nameTrack: 0.1 },
  H: { w: 132, h: 54, fs: 12, shape: 'hex', radius: 0, lines: 1, clip: 0, sw: 1.1, fillA: '12', strokeA: 'f2', nameWeight: 500, nameTrack: 0.5 },
}

export const NODE_STATE = {
  selected: { fillA: '3d', strokeA: 'ff' },
  dimmed: { strokeA: '66' },
}

// relation semantics → line pattern, weight, alpha, arrowhead, paint order.
// colourFrom: which end lends the hue. lineage: counts as ancestry for highlighting.
export const EDGE_KINDS: Record<EdgeKindKey, EdgeKind> = {
  direct: { label: 'Direct successor', short: 'Direct', note: 'fixes a limit', w: 2.3, dash: 'none', op: 0.6, colourFrom: 'source', head: 'arrow', layer: 'front', lineage: true },
  cross: { label: 'Cross-domain', short: 'Cross', note: 'idea borrowed', w: 1.7, dash: '7 5', op: 0.34, colourFrom: 'source', head: 'arrow', layer: 'back', lineage: true, hiDash: '9 5' },
  fusion: { label: 'Fusion', short: 'Fusion', note: 'lineages merge', w: 2.4, dash: 'none', op: 0.58, colourFrom: 'target', head: 'merge', layer: 'front', lineage: true },
  alt: { label: 'Alternative', short: 'Alt', note: 'competing path', w: 1.2, dash: '3 6', op: 0.36, colourFrom: 'neutral', head: 'none', layer: 'back', lineage: false },
}

export const ARROW_HEADS: Record<string, { d: string; mw: number }> = {
  arrow: { d: 'M0 0L9 3.5L0 7Z', mw: 6.5 },
  merge: { d: 'M0 0L4.6 3.5L0 7L1.7 3.5ZM4.4 0L9 3.5L4.4 7L6.1 3.5Z', mw: 7 },
}

export const NEUTRAL = '#9fa9b5'
export const SELECTED_EDGE = '#f4efe5'
export const INK = '#f2ede3'

export const ROUTING: RoutingConfig = {
  clearance: 8,   // node box padding every run must respect
  channelGap: 11, // minimum lateral gap between parallel runs
  overlapPad: 11, // axial slack when testing overlap
  facePad: 8,
  portPitch: 13,
  pitch: 14,
  trackGap: 26,
  gapLadder: [11, 9, 7, 5, 3.5, 1.5],
  stubs: [18, 26, 36, 48],
  escapeSpan: 300,
  busSpan: 420,
  minLegX: 14,
  cornerMin: 9,
  cornerMax: 76,
  clusterSpread: 2.6,
}

export const LANE_BY_ID: Record<LaneId, Lane> = LANES.reduce((acc, L) => {
  acc[L.id] = L
  return acc
}, {} as Record<LaneId, Lane>)

/** read by the legend, the filters and the detail panel */
export const EK = EDGE_KINDS
export const EDGE_KIND_KEYS = Object.keys(EDGE_KINDS) as EdgeKindKey[]
