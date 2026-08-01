import { EDGE_KINDS, EDGE_KIND_KEYS, EdgeStyle, LANES, NEUTRAL } from '../layout'

const RULE = { height: 1, background: 'rgba(233,229,221,0.16)' }

const TIERS = [
  { w: 52, h: 22, bw: 2.4, ba: 0.8, fa: 0.15, label: 'Paradigm', r: 4 },
  { w: 42, h: 17, bw: 1.3, ba: 0.6, fa: 0.11, label: 'Major', r: 4 },
  { w: 34, h: 12, bw: 1, ba: 0.45, fa: 0.09, label: 'Variant', r: 6 },
]

export interface LegendProps {
  open: boolean
  right: number
  /** phone: sit against the left edge and take the width that is available */
  compact?: boolean
  onToggle: () => void
}

export function Legend({ open, right, compact = false, onToggle }: LegendProps) {
  return (
    <div style={{
      position: 'absolute', bottom: compact ? 12 : 18,
      right: compact ? 12 : right,
      left: compact ? 12 : undefined,
      width: compact ? undefined : 276,
      maxWidth: 276,
      background: 'rgba(11,14,18,0.93)', border: '1px solid rgba(233,229,221,0.24)',
      borderRadius: 4, padding: '12px 15px 12px', backdropFilter: 'blur(3px)',
      transition: 'right 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
    }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 15.5, fontWeight: 600, color: '#efe9df', letterSpacing: '-0.005em' }}>Legend</div>
        <div className="gx-legend-toggle" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
          border: '1px solid rgba(233,229,221,0.34)', borderRadius: 4, color: '#cfc9bd',
          fontSize: 13, lineHeight: 1,
        }}>{open ? '−' : '+'}</div>
      </div>

      <div style={{
        maxHeight: open ? (compact ? '46dvh' : 540) : 0,
        opacity: open ? 1 : 0,
        overflowY: open && compact ? 'auto' : 'hidden',
        overscrollBehavior: 'contain',
        transition: 'max-height 300ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease',
      }}>
        <div style={{ ...RULE, margin: '10px 0 10px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {EDGE_KIND_KEYS.map((k) => {
            const kind = EDGE_KINDS[k]
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <svg width="52" height="12" style={{ flex: 'none', overflow: 'visible' }}>
                  <path
                    d="M1 6H50" fill="none" stroke={NEUTRAL} strokeWidth={kind.w + 0.3}
                    strokeDasharray={kind.dash}
                    markerEnd={kind.head === 'none' ? 'none' : `url(#${EdgeStyle.markerId(k, 'found')})`}
                  />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 11.5, lineHeight: 1.3, color: '#d7d1c5' }}>
                  <span>{kind.label}</span>
                  <span style={{ color: '#857d70' }}>{kind.note}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ ...RULE, margin: '11px 0 10px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          {TIERS.map((t) => (
            <div key={t.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <div style={{
                width: t.w, height: t.h, border: `${t.bw}px solid rgba(159,169,181,${t.ba})`,
                borderRadius: t.r, background: `rgba(159,169,181,${t.fa})`,
              }} />
              <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 500, color: '#857d70' }}>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, lineHeight: 1.5, color: '#857d70', marginTop: 9 }}>
          Line colour marks the domain the idea comes from; fusion takes the colour of the result.
        </div>

        <div style={{ ...RULE, margin: '11px 0 10px' }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px' }}>
          {LANES.map((L) => (
            <div key={L.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#cfc9bd' }}>
              <span style={{
                width: 9, height: 9, border: `1px solid ${L.c}`, background: L.c + '2e', borderRadius: 2,
              }} />
              {L.short}
            </div>
          ))}
        </div>

        <div style={{ ...RULE, margin: '11px 0 9px' }} />

        <div style={{ fontSize: 11, lineHeight: 1.55, color: '#7d7568' }}>
          {compact
            ? 'Drag to pan · pinch to zoom · tap a node or an edge for its detail and lineage'
            : 'Drag to pan · scroll to zoom · click a node or an edge to open its detail panel and isolate that lineage'}
        </div>
      </div>
    </div>
  )
}
