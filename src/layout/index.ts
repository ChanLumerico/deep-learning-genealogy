// The layout engine: pure geometry, no DOM, no React. Everything the renderer
// needs to draw the sheet is computed here at load time.

export * from './types'
export * from './spec'
export { TIME, TimeScale, xOf } from './time'
export { Shape, clip } from './shape'
export { NodeModel, EdgeModel } from './models'
export { ObstacleField, ChannelMap } from './obstacles'
export { PortAllocator } from './ports'
export { Router, RouteStrategy, ForwardRoute, BusRoute, FallbackRoute } from './routes'
export type { RouterStats } from './routes'
export { CornerRadii } from './corners'
export { Genealogy } from './graph'
export { LayoutAudit } from './audit'
export type { AuditReport } from './audit'
export { LayoutEngine } from './engine'
export type { BuildOptions } from './engine'
export { NodeStyle, EdgeStyle } from './styles'
export type {
  NodeViewState, NodePaint, EdgeViewState, EdgePaint, MarkerSpec,
} from './styles'
