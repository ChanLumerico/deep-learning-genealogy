import type { ReadGroupVM } from '../view/types'

export interface ReadingListProps {
  readCount: string
  readPct: string
  groups: ReadGroupVM[]
  importNote: string
  importBad: boolean
  onImport: (file: File) => void
  onToggleRead: (id: string) => void
  onToggleGroup: (ids: string[], value: boolean) => void
  onClose: () => void
}

export function ReadingList(p: ReadingListProps) {
  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 372,
      display: 'flex', flexDirection: 'column', background: 'rgba(9,12,16,0.97)',
      borderLeft: '1px solid rgba(233,229,221,0.3)', boxShadow: '-18px 0 44px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        padding: '16px 18px 13px', borderBottom: '1px solid rgba(233,229,221,0.14)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
            fontWeight: 500, color: '#8a8275',
          }}>Papers read</div>
          <div style={{
            fontSize: 22, fontWeight: 600, color: '#f2ece1', lineHeight: 1.1,
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          }}>{p.readCount}</div>
          <div style={{ fontSize: 10.5, color: '#9c9488', fontVariantNumeric: 'tabular-nums' }}>
            {p.readPct} of the genealogy
          </div>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8,
            padding: '5px 10px', borderRadius: 4, border: '1px solid rgba(233,229,221,0.38)',
            color: '#dcd6ca', fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer',
          }}>
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
          <div style={{
            fontSize: 10, lineHeight: 1.45, color: p.importBad ? '#d68b7a' : '#8f9c86', maxWidth: 252,
          }}>{p.importNote}</div>
        </div>
        <button
          className="gx-close" onClick={p.onClose}
          style={{ width: 26, height: 26, fontSize: 14 }}
        >×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 20px' }}>
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
    </div>
  )
}
