import { memo } from 'react'
import { CANVAS, INK, SANS, clip } from '../layout'
import type { MarkerSpec, NodeModel } from '../layout'
import type { EdgeHitVM, EdgeVM, LaneVM, NodeVM, TickVM } from '../view/types'

const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const

function NodeLabel({ n }: { n: NodeModel }) {
  const m = n.metrics
  const detailed = m.lines === 3
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* name: the heaviest cut, tier-dependent */}
      <text
        x={n.w / 2} y={detailed ? n.h * 0.32 : n.h / 2 + m.fs * 0.36} textAnchor="middle"
        fontFamily={SANS} fontWeight={m.nameWeight} fontSize={m.fs} fill={INK}
        letterSpacing={m.nameTrack} style={TABULAR}
      >{n.name}</text>
      {/* meta: light tabular */}
      {detailed && (
        <text
          x={n.w / 2} y={n.h * 0.575} textAnchor="middle" fontFamily={SANS}
          fontWeight={300} fontSize={11} fill={n.lane.c} opacity={0.8} letterSpacing={0.2}
          style={TABULAR}
        >{n.meta}</text>
      )}
      {/* contribution: italic */}
      {detailed && (
        <text
          x={n.w / 2} y={n.h * 0.83} textAnchor="middle" fontFamily={SANS}
          fontStyle="italic" fontWeight={400} fontSize={10.5} fill={n.lane.c} opacity={0.95}
        >{clip(n.contribution, m.clip)}</text>
      )}
    </g>
  )
}

export interface GraphCanvasProps {
  svgRef: React.Ref<SVGSVGElement>
  camera: string
  markers: MarkerSpec[]
  lanes: LaneVM[]
  ticks: TickVM[]
  edgesBack: EdgeVM[]
  edgesFront: EdgeVM[]
  edgeHits: EdgeHitVM[]
  nodes: NodeVM[]
  onNodeClick: (id: string) => void
  onNodeEnter: (id: string, ev: React.MouseEvent) => void
  onNodeLeave: () => void
  onEdgeClick: (index: number) => void
  onEdgeEnter: (index: number) => void
  onEdgeLeave: () => void
}

function GraphCanvasImpl({
  svgRef, camera, markers, lanes, ticks, edgesBack, edgesFront, edgeHits, nodes,
  onNodeClick, onNodeEnter, onNodeLeave, onEdgeClick, onEdgeEnter, onEdgeLeave,
}: GraphCanvasProps) {
  return (
    <svg
      ref={svgRef} className="gx-sheet" width="100%" height="100%"
      style={{ display: 'block' }}
    >
      <defs>
        {markers.map((m) => (
          <marker
            key={m.id} id={m.id} viewBox="0 0 9 7" refX="8" refY="3.5"
            markerWidth={m.mw} markerHeight={m.mw} orient="auto-start-reverse"
          >
            <path d={m.d} fill={m.fill} opacity={m.op} />
          </marker>
        ))}
      </defs>

      {/* The camera must stay the first element carrying a transform — the PNG
          export finds it with querySelector('g[transform]') and zeroes it. */}
      <g transform={camera}>
        {lanes.map((L) => (
          <g key={L.id}>
            <rect x="0" y={L.y0} width={CANVAS.w} height={L.h} fill={L.c} opacity={L.tint} />
            <line x1="0" y1={L.y0} x2={CANVAS.w} y2={L.y0} stroke={L.c} strokeOpacity="0.22" strokeWidth="1" />
            <line x1="0" y1={L.y1} x2={CANVAS.w} y2={L.y1} stroke={L.c} strokeOpacity="0.22" strokeWidth="1" />
            <text
              x={26} y={L.y1 - 14} fontFamily={SANS} fontSize={44} fontWeight={600}
              fill={L.c} opacity={0.14} letterSpacing={6}
            >{L.big}</text>
          </g>
        ))}

        {ticks.map((t) => (
          <g key={t.year}>
            <line x1={t.x} y1="86" x2={t.x} y2="5810" stroke="#e9e5dd" strokeOpacity={t.gridOp} strokeWidth="1" />
            {/* the year is repeated top and bottom, grouped as in the original */}
            <g>
              <text
                x={t.x} y={72} textAnchor="middle" fontFamily={SANS} fontSize={20} fontWeight={500}
                fill="#b9b1a3" opacity={t.op} letterSpacing={0.4} style={TABULAR}
              >{t.year}</text>
              <text
                x={t.x} y={CANVAS.h - 36} textAnchor="middle" fontFamily={SANS} fontSize={20} fontWeight={500}
                fill="#b9b1a3" opacity={t.op} letterSpacing={0.4} style={TABULAR}
              >{t.year}</text>
            </g>
          </g>
        ))}
        <line x1="0" y1="86" x2={CANVAS.w} y2="86" stroke="#9fa9b5" strokeOpacity="0.5" strokeWidth="1.5" />
        <line x1="0" y1="5810" x2={CANVAS.w} y2="5810" stroke="#9fa9b5" strokeOpacity="0.5" strokeWidth="1.5" />

        <g>
          {edgesBack.map((e) => (
            <path
              key={e.key} d={e.paint.d} fill="none" stroke={e.paint.stroke} strokeWidth={e.paint.width}
              strokeDasharray={e.paint.dash} opacity={e.paint.opacity} markerEnd={e.paint.marker}
              strokeLinecap="round"
            />
          ))}
        </g>
        <g>
          {edgesFront.map((e) => (
            <path
              key={e.key} d={e.paint.d} fill="none" stroke={e.paint.stroke} strokeWidth={e.paint.width}
              strokeDasharray={e.paint.dash} opacity={e.paint.opacity} markerEnd={e.paint.marker}
              strokeLinecap="round"
            />
          ))}
        </g>
        <g>
          {edgeHits.map((h) => (
            <path
              key={h.key} d={h.d} fill="none" stroke="transparent" strokeWidth="16"
              pointerEvents="stroke" style={{ cursor: 'pointer' }}
              onClick={() => onEdgeClick(h.key)}
              onMouseEnter={() => onEdgeEnter(h.key)}
              onMouseLeave={onEdgeLeave}
            />
          ))}
        </g>

        <g>
          {nodes.map(({ node: n, paint, read }) => (
            <g
              key={n.id} transform={`translate(${n.x},${n.y})`} opacity={paint.opacity}
              pointerEvents={paint.pointerEvents} style={{ cursor: 'pointer' }}
              onClick={() => onNodeClick(n.id)}
              onMouseEnter={(ev) => onNodeEnter(n.id, ev)}
              onMouseMove={(ev) => onNodeEnter(n.id, ev)}
              onMouseLeave={onNodeLeave}
            >
              <path d={paint.shape} fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth} />
              <path
                d={`M${n.w - 16} 10L${n.w - 13} 13L${n.w - 7.5} 6.5`} fill="none" stroke={n.lane.c}
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity={read ? 1 : 0}
              />
              <NodeLabel n={n} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

export const GraphCanvas = memo(GraphCanvasImpl)
