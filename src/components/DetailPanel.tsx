import type { PanelVM } from '../view/types'
import { Prose } from './Prose'

/** the small uppercase label that heads every section of the panel */
const CAP: React.CSSProperties = {
  fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 500, color: '#8a8275',
}

export interface DetailPanelProps {
  panel: PanelVM
  /** phone: dock to the bottom instead of taking a full-height column */
  sheet?: boolean
  onClose: () => void
}

export function DetailPanel({ panel, sheet = false, onClose }: DetailPanelProps) {
  // A 372px column is wider than a phone screen, so on a phone the panel
  // becomes a bottom sheet: full width, capped height, and the graph stays
  // visible and usable above it.
  const frame: React.CSSProperties = sheet
    ? {
      position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '62dvh',
      borderTop: `2px solid ${panel.color}`,
      borderRadius: '12px 12px 0 0', boxShadow: '0 -18px 46px rgba(0,0,0,0.55)',
    }
    : {
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 372,
      borderLeft: `1px solid ${panel.color}`, boxShadow: '-18px 0 46px rgba(0,0,0,0.5)',
    }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', background: 'rgba(9,12,16,0.97)',
      ...frame,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: sheet ? '14px 18px 0' : '20px 22px 0',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: panel.color,
          }}>{panel.kicker}</div>
          <div style={{
            fontSize: sheet ? 22 : 30, lineHeight: 1.05, color: '#f4efe5',
            overflowWrap: 'anywhere',
          }}>{panel.title}</div>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em', color: '#948c7f',
            fontVariantNumeric: 'tabular-nums',
          }}>{panel.meta}</div>
        </div>
        <button
          className="gx-close" onClick={onClose} aria-label="Close"
          style={{ width: 27, height: 27, fontSize: 13, color: '#a9a294' }}
        >×</button>
      </div>

      <div style={{
        height: 1, background: 'rgba(233,229,221,0.14)',
        margin: sheet ? '12px 18px 0' : '16px 22px 0',
      }} />

      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: sheet ? '14px 18px 20px' : '16px 22px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 17, lineHeight: 1.4, color: '#e6dfd2' }}>{panel.lead}</div>

        {panel.fields.map((f) => (
          <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={CAP}>{f.k}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: f.c, fontStyle: f.it }}>{f.v}</div>
          </div>
        ))}

        {/* The long-form essay, once its file has arrived. The short fields
            above stay: they are the one-line version, and they are what the
            reader has already seen on the node itself. */}
        {panel.essayLoading && !panel.essay && (
          <div style={{ ...CAP, color: '#6f6759' }}>Loading the full entry…</div>
        )}

        {panel.essay && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ height: 1, background: 'rgba(233,229,221,0.14)' }} />
            <Prose body={panel.essay.lead} size={13.5} color="#ded7c9" />
            {panel.essay.blocks.map((b, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.h && <div style={CAP}>{b.h}</div>}
                <Prose body={b.b} />
              </div>
            ))}
            {!!panel.essay.refs?.length && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={CAP}>Read next</div>
                {panel.essay.refs.map((r, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, color: '#9d9689' }}>
                    {r.url
                      ? <a href={r.url} target="_blank" rel="noreferrer noopener"
                        style={{ color: '#bfb8aa', textDecoration: 'underline' }}>{r.t}</a>
                      : r.t}
                    {r.y ? <span style={{ color: '#6f6759' }}> · {r.y}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {panel.groups.map((grp) => (
          <div key={grp.k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={CAP}>{grp.k}</div>
              <div style={{ height: 1, flex: 1, background: 'rgba(233,229,221,0.14)' }} />
            </div>
            {grp.items.map((it, i) => (
              <div
                key={`${it.name}-${i}`} className="gx-hover" onClick={it.onClick}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px',
                  border: '1px solid rgba(233,229,221,0.14)', borderLeft: `2px solid ${it.c}`,
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12.5, color: '#ece6da' }}>{it.name}</div>
                  <div style={{
                    fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: it.c, whiteSpace: 'nowrap',
                  }}>{it.kind}</div>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: '#9d9689' }}>{it.note}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
