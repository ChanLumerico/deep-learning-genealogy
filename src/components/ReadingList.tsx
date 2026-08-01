import type { ReadGroupVM, ToggleVM } from '../view/types'
import { PanelResizer } from './PanelResizer'
import { BottomSheet } from './BottomSheet'

/** Shared by every button in the header strip. */
const ACTION: React.CSSProperties = {
  flex: '0 0 auto', padding: '0 10px', height: 26, borderRadius: 4,
  border: '1px solid rgba(233,229,221,0.38)', background: 'transparent',
  color: '#dcd6ca', fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer',
}

const CAP: React.CSSProperties = {
  fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 500, color: '#8a8275',
}

export interface ReadingListProps {
  readCount: string
  readPct: string
  groups: ReadGroupVM[]
  /** add / replace — how the next CSV import is applied */
  importModes: ToggleVM[]
  importNote: string
  importBad: boolean
  hasRead: boolean
  /** phone: dock to the bottom instead of taking a full-height column */
  sheet?: boolean
  /** side-panel width, reader-adjustable; ignored in sheet mode */
  width?: number
  onResize?: (next: number) => void
  onImport: (file: File) => void
  onExport: () => void
  onClearAll: () => void
  onToggleRead: (id: string) => void
  onToggleGroup: (ids: string[], value: boolean) => void
  onClose: () => void
}

export function ReadingList(p: ReadingListProps) {
  // See DetailPanel: 372px does not fit a phone, so the list becomes a bottom
  // sheet. It is taller than the detail panel because it is a list to scroll.
  const body = (
    <>
      {!p.sheet && p.onResize && (
        <PanelResizer width={p.width ?? 372} onResize={p.onResize} />
      )}
      <div data-sheet-grab={p.sheet ? '' : undefined} style={{
        flex: 'none',
        padding: p.sheet ? '4px 18px 13px' : '16px 18px 13px',
        borderBottom: '1px solid rgba(233,229,221,0.14)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={CAP}>Papers read</div>
            <div style={{
              fontSize: 22, fontWeight: 600, color: '#f2ece1', lineHeight: 1.1,
              letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
            }}>{p.readCount}</div>
            <div style={{ fontSize: 10.5, color: '#9c9488', fontVariantNumeric: 'tabular-nums' }}>
              {p.readPct} of the genealogy · kept in this browser
            </div>
          </div>
          <button
            className="gx-close" onClick={p.onClose} aria-label="Close"
            style={{ width: 26, height: 26, fontSize: 14 }}
          >×</button>
        </div>

        {/* carry the list between browsers */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
          <label style={{ ...ACTION, display: 'inline-flex', alignItems: 'center' }}>
            Import CSV
            <input
              type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={(ev) => {
                const f = ev.target.files && ev.target.files[0]
                if (f) p.onImport(f)
                ev.target.value = ''
              }}
            />
          </label>
          <button
            style={{ ...ACTION, opacity: p.hasRead ? 1 : 0.45 }}
            onClick={p.onExport}
            title="Download the models marked read, in the schema Import accepts"
          >Export CSV</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          <span style={{ ...CAP, marginRight: 2 }}>On import</span>
          {p.importModes.map((t) => (
            <button
              key={t.key} className="gx-btn" onClick={t.onClick}
              style={{ flex: '0 0 auto', height: 24, background: t.bg, border: `1px solid ${t.bd}`, color: t.fg }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          <button
            style={{
              ...ACTION,
              border: '1px solid rgba(233,229,221,0.22)',
              color: '#b8b1a4',
              opacity: p.hasRead ? 1 : 0.45,
            }}
            onClick={p.onClearAll}
          >Clear all</button>
        </div>

        {p.importNote && (
          <div style={{
            fontSize: 10, lineHeight: 1.45, marginTop: 9,
            color: p.importBad ? '#d68b7a' : '#8f9c86',
          }}>{p.importNote}</div>
        )}
      </div>

      <div data-sheet-scroll={p.sheet ? '' : undefined} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain', padding: '4px 18px 24px',
      }}>
        {p.groups.map((g) => (
          <div key={g.id} style={{ paddingTop: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
              paddingBottom: 6, borderBottom: `1px solid ${g.c}`,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: g.c,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>{g.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ fontSize: 10, color: '#857d70', fontVariantNumeric: 'tabular-nums' }}>{g.tally}</span>
                <span
                  onClick={() => p.onToggleGroup(g.items.map((i) => i.id), g.done < g.items.length)}
                  style={{
                    fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: '#9c9488', cursor: 'pointer',
                  }}
                >Toggle all</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {g.items.map((it) => (
                <div
                  key={it.id} onClick={() => p.onToggleRead(it.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 2px',
                    borderBottom: '1px solid rgba(233,229,221,0.07)', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 15, height: 15, flex: 'none', marginTop: 1, borderRadius: 3,
                    border: `1px solid ${it.boxBd}`, background: it.boxBg, color: it.boxFg,
                    fontSize: 10, lineHeight: '14px', textAlign: 'center',
                  }}>{it.box}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: it.nameCol }}>{it.name}</span>
                      <span style={{ fontSize: 10, color: '#6f6759', fontVariantNumeric: 'tabular-nums' }}>{it.year}</span>
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 300, lineHeight: 1.5, color: '#837b6d' }}>{it.paper}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  if (p.sheet) return <BottomSheet onClose={p.onClose}>{body}</BottomSheet>
  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: p.width ?? 372,
      display: 'flex', flexDirection: 'column', background: 'rgba(9,12,16,0.97)',
      borderLeft: '1px solid rgba(233,229,221,0.3)', boxShadow: '-18px 0 44px rgba(0,0,0,0.5)',
    }}>{body}</div>
  )
}
