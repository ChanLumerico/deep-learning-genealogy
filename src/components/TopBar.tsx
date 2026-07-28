import type { ToggleVM } from '../view/types'

const CAP_SPLIT: React.CSSProperties = { justifyContent: 'space-between', gap: 10 }
const VALUE: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em',
  color: '#cfc9bd', whiteSpace: 'nowrap',
}

function Toggles({ items }: { items: ToggleVM[] }) {
  return (
    <div className="gx-row">
      {items.map((t) => (
        <button
          key={t.key} className="gx-btn" onClick={t.onClick}
          style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg }}
        >{t.label}</button>
      ))}
    </div>
  )
}

export interface TopBarProps {
  yearLabel: string
  timeMin: number
  timeMax: number
  timeX: number
  onYear: (v: number) => void
  laneToggles: ToggleVM[]
  edgeToggles: ToggleVM[]
  readFilters: ToggleVM[]
  query: string
  onQuery: (v: string) => void
  onQuerySubmit: (v: string) => void
  readCount: string
  onToggleList: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onReset: () => void
  onExport: () => void
  exporting: boolean
}

export function TopBar(p: TopBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 30, padding: '12px 20px',
      borderBottom: '1px solid rgba(233,229,221,0.22)', background: '#0B0E12',
      flex: 'none', overflowX: 'auto',
    }}>

      {/* ① title + timeline */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 12, width: 'fit-content' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, height: 47 }}>
          <div style={{
            fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', color: '#f1ece2',
            lineHeight: 1.05, whiteSpace: 'nowrap',
          }}>Deep Learning Model Genealogy</div>
          <div style={{
            fontSize: 9.5, letterSpacing: '0.19em', textTransform: 'uppercase', fontWeight: 400,
            color: '#8d8578', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>A Phylogeny of Architectures · 1957 — 2025</div>
        </div>

        <div className="gx-field">
          <div className="gx-cap" style={CAP_SPLIT}>
            <span>Timeline</span><span style={VALUE}>{p.yearLabel}</span>
          </div>
          <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={p.timeMin} max={p.timeMax} step={2} value={p.timeX}
              onChange={(e) => p.onYear(parseFloat(e.target.value))}
              style={{ width: '100%', height: 16, margin: 0 }}
            />
          </div>
        </div>
      </div>

      {/* ② domain / edge filters + search */}
      <div style={{ flex: '1 1 auto', minWidth: 'max-content', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div className="gx-field" style={{ flex: '1 1 auto', maxWidth: 620, minWidth: 'max-content' }}>
            <div className="gx-cap">Domains</div>
            <Toggles items={p.laneToggles} />
          </div>
          <div className="gx-field" style={{ flex: '1 1 auto', maxWidth: 460, minWidth: 'max-content' }}>
            <div className="gx-cap">Edges</div>
            <Toggles items={p.edgeToggles} />
          </div>
        </div>

        <div className="gx-field">
          <div className="gx-cap">Search</div>
          <input
            className="gx-input" type="text" value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') p.onQuerySubmit(e.currentTarget.value) }}
            placeholder="Model name → Enter"
          />
        </div>
      </div>

      {/* ③ reading counter + view controls */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="gx-field">
          <div className="gx-cap" style={{ ...CAP_SPLIT, gap: 12 }}>
            <span>Reading</span><span style={VALUE}>{p.readCount}</span>
          </div>
          <div className="gx-row">
            {p.readFilters.map((t) => (
              <button
                key={t.key} className="gx-btn" onClick={t.onClick}
                style={{ background: t.bg, border: `1px solid ${t.bd}`, color: t.fg }}
              >{t.label}</button>
            ))}
            <button
              className="gx-btn" onClick={p.onToggleList}
              style={{
                padding: '0 11px', background: 'rgba(233,229,221,0.1)',
                border: '1px solid rgba(233,229,221,0.42)', color: '#dcd6ca', letterSpacing: '0.06em',
              }}
            >Reading list</button>
          </div>
        </div>

        <div className="gx-field">
          <div className="gx-cap">View</div>
          <div className="gx-row">
            <button
              className="gx-btn" onClick={p.onZoomOut}
              style={{
                flex: '0 0 28px', padding: 0, fontSize: 14, background: 'transparent',
                border: '1px solid rgba(233,229,221,0.34)', color: '#cfc9bd',
              }}
            >−</button>
            <button
              className="gx-btn" onClick={p.onZoomIn}
              style={{
                flex: '0 0 28px', padding: 0, fontSize: 14, background: 'transparent',
                border: '1px solid rgba(233,229,221,0.34)', color: '#cfc9bd',
              }}
            >+</button>
            <button
              className="gx-btn" onClick={p.onFit}
              style={{
                letterSpacing: '0.06em', background: 'transparent',
                border: '1px solid rgba(233,229,221,0.34)', color: '#cfc9bd',
              }}
            >Fit</button>
            <button
              className="gx-btn" onClick={p.onReset}
              style={{
                letterSpacing: '0.06em', background: 'transparent',
                border: '1px solid rgba(233,229,221,0.22)', color: '#b8b1a4',
              }}
            >Reset</button>
            <button
              className="gx-btn" onClick={p.onExport}
              title="Export the whole sheet as PNG, exactly as filtered"
              style={{
                gap: 7, padding: '0 11px', fontWeight: 500, letterSpacing: '0.06em',
                background: 'rgba(233,229,221,0.07)', border: '1px solid rgba(233,229,221,0.34)',
                color: '#dcd6ca', opacity: p.exporting ? 0.55 : 1,
              }}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}
              >
                <path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" />
              </svg>
              {p.exporting ? 'Rendering' : 'PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
