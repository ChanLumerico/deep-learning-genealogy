import { useState } from 'react'
import type { PanelVM } from '../view/types'
import { Prose } from './Prose'
import { PanelResizer } from './PanelResizer'
import { BottomSheet } from './BottomSheet'

/** the small uppercase label that heads every section of the panel */
const CAP: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 500, color: '#8a8275',
}

export interface DetailPanelProps {
  panel: PanelVM
  /** the shareable address of what is open, if there is one */
  link?: string
  /** rendered above the entry while a lineage is being walked */
  walkBar?: React.ReactNode
  /** offered on a model: start walking back to where it came from */
  onTrace?: () => void
  /** phone: dock to the bottom instead of taking a full-height column */
  sheet?: boolean
  /** side-panel width, reader-adjustable; ignored in sheet mode */
  width?: number
  onResize?: (next: number) => void
  onClose: () => void
}

export function DetailPanel({
  panel, link, walkBar, onTrace, sheet = false, width = 372, onResize, onClose,
}: DetailPanelProps) {
  const [copied, setCopied] = useState(false)
  // A 372px column is wider than a phone screen, so on a phone the panel
  // becomes a bottom sheet: full width, capped height, and the graph stays
  // visible and usable above it.
  const body = (
    <>
      {!sheet && onResize && <PanelResizer width={width} onResize={onResize} />}
      {walkBar}
      {/* the header is a drag target: pulling it moves the sheet, not the text */}
      <div data-sheet-grab={sheet ? '' : undefined} style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: sheet ? '4px 18px 0' : '20px 22px 0',
        flex: 'none',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: panel.color,
          }}>{panel.kicker}</div>
          <div style={{
            fontSize: sheet ? 22 : 30, lineHeight: 1.05, color: '#f4efe5',
            overflowWrap: 'anywhere',
          }}>{panel.title}</div>
          <div style={{
            fontSize: 12, letterSpacing: '0.08em', color: '#948c7f',
            fontVariantNumeric: 'tabular-nums',
          }}>{panel.meta}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          {link && (
            <button
              className="gx-close"
              title="Copy a link to this entry"
              aria-label="Copy a link to this entry"
              style={{ height: 27, padding: '0 9px', fontSize: 11, whiteSpace: 'nowrap' }}
              onClick={() => {
                navigator.clipboard?.writeText(link).then(
                  () => { setCopied(true); setTimeout(() => setCopied(false), 1600) },
                  () => { /* denied, or no clipboard — the URL bar still has it */ },
                )
              }}
            >{copied ? 'Copied' : 'Link'}</button>
          )}
          <button
            className="gx-close" onClick={onClose} aria-label="Close"
            style={{ width: 27, height: 27, fontSize: 14.5, color: '#a9a294' }}
          >×</button>
        </div>
      </div>

      <div style={{
        height: 1, background: 'rgba(233,229,221,0.14)',
        margin: sheet ? '12px 18px 0' : '16px 22px 0',
      }} />

      <div data-sheet-scroll={sheet ? '' : undefined} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: sheet ? '14px 18px 24px' : '16px 22px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 18.5, lineHeight: 1.4, color: '#e6dfd2' }}>{panel.lead}</div>

        {panel.fields.map((f) => (
          <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={CAP}>{f.k}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: f.c, fontStyle: f.it }}>{f.v}</div>
          </div>
        ))}

        {/* The long-form essay, once its file has arrived. The short fields
            above stay: they are the one-line version, and they are what the
            reader has already seen on the node itself. */}
        {onTrace && (
          <button
            className="gx-close" onClick={onTrace}
            style={{
              alignSelf: 'flex-start', padding: '0 11px', height: 28,
              fontSize: 11.5, letterSpacing: '0.04em',
            }}
            title="Read the line of descent that leads here, in order"
          >Trace this lineage →</button>
        )}

        {panel.essayLoading && !panel.essay && (
          <div style={{ ...CAP, color: '#6f6759' }}>Loading the full entry…</div>
        )}

        {panel.essay && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ height: 1, background: 'rgba(233,229,221,0.14)' }} />
            <Prose body={panel.essay.lead} size={15} color="#ded7c9" />
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
                  <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: '#9d9689' }}>
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
                  <div style={{ fontSize: 14, color: '#ece6da' }}>{it.name}</div>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: it.c, whiteSpace: 'nowrap',
                  }}>{it.kind}</div>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#9d9689' }}>{it.note}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )

  if (sheet) {
    return <BottomSheet accent={panel.color} onClose={onClose}>{body}</BottomSheet>
  }
  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width,
      display: 'flex', flexDirection: 'column', background: 'rgba(9,12,16,0.97)',
      borderLeft: `1px solid ${panel.color}`, boxShadow: '-18px 0 46px rgba(0,0,0,0.5)',
    }}>{body}</div>
  )
}
