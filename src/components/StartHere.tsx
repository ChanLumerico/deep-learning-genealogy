// The way in.
//
// 189 boxes and no suggestion of where to begin is a hard first minute, and
// the essays are the reason to be here — so the entry point offers journeys
// rather than a search box. Each one is a chain the graph already contains,
// read in the order the writing was built for.

import type { WalkPath } from '../view/walk'

export interface StartHereProps {
  paths: WalkPath[]
  /** how many models each journey covers, by path id */
  lengths: Record<string, number>
  onPick: (id: string) => void
  onClose: () => void
}

export function StartHere({ paths, lengths, onPick, onClose }: StartHereProps) {
  return (
    <div
      // a scrim, so this reads as a layer over the sheet rather than part of it
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '86dvh',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11,14,18,0.98)',
          border: '1px solid rgba(233,229,221,0.24)', borderRadius: 6,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(233,229,221,0.14)',
        }}>
          <div>
            <div style={{
              fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: '#8a8275',
            }}>Start here</div>
            <div style={{ fontSize: 20, color: '#f2ece1', lineHeight: 1.2, marginTop: 4 }}>
              Follow a lineage end to end
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.55, color: '#9d9689', marginTop: 6 }}>
              Each journey walks a chain of models in order, stopping at every
              arrow to say what the next one fixed about the last.
            </div>
          </div>
          <button
            className="gx-close" onClick={onClose} aria-label="Close"
            style={{ width: 27, height: 27, fontSize: 14.5, flex: 'none' }}
          >×</button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
          padding: '6px 20px 18px',
        }}>
          {paths.map((p) => (
            <button
              key={p.id}
              className="gx-hover"
              onClick={() => onPick(p.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                margin: '12px 0 0', padding: '11px 13px',
                background: 'transparent', cursor: 'pointer',
                border: '1px solid rgba(233,229,221,0.16)',
                borderLeft: '2px solid rgba(233,229,221,0.4)',
                borderRadius: 4, font: 'inherit', color: 'inherit',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'space-between', gap: 10,
              }}>
                <span style={{ fontSize: 14.5, color: '#ece6da' }}>{p.title}</span>
                <span style={{
                  fontSize: 10, color: '#7d7568', whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}>{lengths[p.id] ?? p.nodes.length} models</span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55, color: '#9d9689', marginTop: 4 }}>
                {p.blurb}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
