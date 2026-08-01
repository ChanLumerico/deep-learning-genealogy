// The strip that sits above a panel while a lineage is being walked.
//
// It is deliberately thin. The reading is the panel below it; this only says
// where you are, what you are reading, and how to go on — and it keeps the
// current step's kind visible, because the alternation between a model and
// the arrow into it is the shape of the argument.

export interface WalkBarProps {
  title: string
  /** 1-based, for people */
  step: number
  total: number
  /** what the current step is: a model, or the arrow into it */
  kind: 'node' | 'edge'
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}

const NUDGE: React.CSSProperties = {
  flex: '0 0 auto', width: 30, height: 26, padding: 0,
  fontSize: 14, lineHeight: 1,
}

export function WalkBar(p: WalkBarProps) {
  const first = p.step <= 1
  const last = p.step >= p.total
  return (
    <div style={{
      flex: 'none', display: 'flex', flexDirection: 'column', gap: 7,
      padding: '11px 18px 10px',
      borderBottom: '1px solid rgba(233,229,221,0.14)',
      background: 'rgba(233,229,221,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#8a8275',
          }}>Following a lineage</div>
          <div style={{
            fontSize: 14, color: '#ece6da', lineHeight: 1.25, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{p.title}</div>
        </div>
        <button
          className="gx-close" onClick={p.onExit}
          title="Leave the walk" aria-label="Leave the walk"
          style={{ ...NUDGE, width: 'auto', padding: '0 9px', fontSize: 11 }}
        >Done</button>
      </div>

      {/* one tick per step: where you are in the argument, at a glance */}
      <div style={{ display: 'flex', gap: 3, height: 3 }}>
        {Array.from({ length: p.total }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1, borderRadius: 2,
              background: i < p.step ? 'rgba(233,229,221,0.62)' : 'rgba(233,229,221,0.16)',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="gx-close" onClick={p.onPrev} disabled={first}
          aria-label="Previous step"
          style={{ ...NUDGE, opacity: first ? 0.35 : 1 }}
        >←</button>
        <button
          className="gx-close" onClick={p.onNext} disabled={last}
          aria-label="Next step"
          style={{ ...NUDGE, opacity: last ? 0.35 : 1 }}
        >→</button>
        <div style={{
          fontSize: 10.5, color: '#8a8275', fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
        }}>
          {p.step} / {p.total} · {p.kind === 'edge' ? 'what changed' : 'the model'}
        </div>
      </div>
    </div>
  )
}
