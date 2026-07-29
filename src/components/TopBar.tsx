import type { ToggleVM } from '../view/types'

const CAP_SPLIT: React.CSSProperties = { justifyContent: 'space-between', gap: 10 }
const VALUE: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em',
  color: '#cfc9bd', whiteSpace: 'nowrap',
}

function Toggles({ items, wrap }: { items: ToggleVM[]; wrap?: boolean }) {
  return (
    <div className={wrap ? 'gx-row gx-row-wrap' : 'gx-row'}>
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
  /** below the desktop breakpoint: stack the groups instead of sitting them in a row */
  compact: boolean
  /** phone: the controls collapse behind a toggle so the sheet keeps the screen */
  phone: boolean
  open: boolean
  onToggleOpen: () => void
}

/** points the way the bar will move: up to fold it away, down to bring it back */
function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none', transform: up ? 'none' : 'rotate(180deg)' }}
    >
      <path d="m5 15 7-7 7 7" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}
    >
      <path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" />
    </svg>
  )
}

export function TopBar(p: TopBarProps) {
  // On a phone EVERYTHING below the header strip folds away — timeline
  // included. The bar was still taking a quarter of the screen with only the
  // controls collapsed, and on a sheet this tall that quarter matters more
  // than any control does.
  const showControls = !p.phone || p.open

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        borderBottom: '1px solid rgba(233,229,221,0.22)', background: '#0B0E12',
        flex: 'none',
        // the drawer can outgrow a short phone screen, so it scrolls itself
        maxHeight: p.phone ? '72dvh' : undefined,
        overflowY: p.phone ? 'auto' : undefined,
      }}
    >
      {/* Header strip: on a phone this is the whole bar when collapsed, and
          it is the one thing that never folds — it carries the way back. */}
      {p.phone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '7px 12px',
        }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{
              fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.01em', color: '#f1ece2',
              lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>Deep Learning Model Genealogy</div>
            {/* collapsed, the year still has to be legible — it is what the
                timeline is currently filtering to */}
            <div style={{
              fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: '#8d8578', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>{p.yearLabel}</div>
          </div>
          <button
            className="gx-btn gx-tap"
            onClick={p.onToggleOpen}
            aria-expanded={p.open}
            aria-label={p.open ? 'Collapse the toolbar' : 'Expand the toolbar'}
            style={{
              flex: '0 0 auto', gap: 7, padding: '0 12px',
              background: p.open ? 'rgba(233,229,221,0.13)' : 'transparent',
              border: '1px solid rgba(233,229,221,0.34)', color: '#dcd6ca',
              letterSpacing: '0.06em',
            }}
          >
            <Chevron up={p.open} />
            {p.open ? 'Hide' : 'Menu'}
          </button>
        </div>
      )}

      {showControls && (
      <div style={{
        display: 'flex', alignItems: p.compact ? 'center' : 'flex-start',
        flexDirection: p.compact ? 'column' : 'row',
        gap: p.compact ? 10 : 30,
        padding: p.phone ? '2px 13px 11px' : '12px 20px',
      }}>

        {/* ① title (desktop / tablet only — the phone has its own strip above) */}
        <div style={{
          flex: '0 0 auto', display: 'flex', flexDirection: 'column',
          gap: p.compact ? 9 : 12, width: p.compact ? '100%' : 'fit-content',
        }}>
          {!p.phone && (
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
              height: 47, minWidth: 0,
            }}>
              <div style={{
                fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em',
                color: '#f1ece2', lineHeight: 1.05, whiteSpace: 'nowrap',
              }}>Deep Learning Model Genealogy</div>
              <div style={{
                fontSize: 9.5, letterSpacing: '0.19em', textTransform: 'uppercase',
                fontWeight: 400, color: '#8d8578', fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>A Phylogeny of Architectures · 1957 — 2025</div>
            </div>
          )}

          <div className="gx-field">
            <div className="gx-cap" style={CAP_SPLIT}>
              <span>Timeline</span><span style={VALUE}>{p.yearLabel}</span>
            </div>
            <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
              <input
                type="range" min={p.timeMin} max={p.timeMax} step={2} value={p.timeX}
                onChange={(e) => p.onYear(parseFloat(e.target.value))}
                aria-label="Show models up to this year"
                style={{ width: '100%', height: 16, margin: 0 }}
              />
            </div>
          </div>
        </div>

        {(
          <>
            {/* ② domain / edge filters + search */}
            <div style={{
              flex: p.compact ? '0 0 auto' : '1 1 auto',
              width: p.compact ? '100%' : undefined,
              minWidth: p.compact ? 0 : 'max-content',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                display: 'flex', gap: p.compact ? 12 : 30,
                flexDirection: p.compact ? 'column' : 'row',
                alignItems: 'flex-start', justifyContent: 'space-between',
              }}>
                <div className="gx-field" style={{
                  flex: '1 1 auto', width: p.compact ? '100%' : undefined,
                  maxWidth: p.compact ? undefined : 620,
                  minWidth: p.compact ? 0 : 'max-content',
                }}>
                  <div className="gx-cap">Domains</div>
                  <Toggles items={p.laneToggles} wrap={p.compact} />
                </div>
                <div className="gx-field" style={{
                  flex: '1 1 auto', width: p.compact ? '100%' : undefined,
                  maxWidth: p.compact ? undefined : 460,
                  minWidth: p.compact ? 0 : 'max-content',
                }}>
                  <div className="gx-cap">Edges</div>
                  <Toggles items={p.edgeToggles} wrap={p.compact} />
                </div>
              </div>

              <div className="gx-field">
                <div className="gx-cap">Search</div>
                <input
                  className="gx-input" type="text" value={p.query}
                  onChange={(e) => p.onQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') p.onQuerySubmit(e.currentTarget.value) }}
                  placeholder="Model name → Enter"
                  aria-label="Search for a model"
                />
              </div>
            </div>

            {/* ③ reading counter + view controls */}
            <div style={{
              flex: '0 0 auto', width: p.compact ? '100%' : undefined,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div className="gx-field">
                <div className="gx-cap" style={{ ...CAP_SPLIT, gap: 12 }}>
                  <span>Reading</span><span style={VALUE}>{p.readCount}</span>
                </div>
                <div className={p.compact ? 'gx-row gx-row-wrap' : 'gx-row'}>
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
                      border: '1px solid rgba(233,229,221,0.42)', color: '#dcd6ca',
                      letterSpacing: '0.06em',
                    }}
                  >Reading list</button>
                </div>
              </div>

              <div className="gx-field">
                <div className="gx-cap">View</div>
                <div className={p.compact ? 'gx-row gx-row-wrap' : 'gx-row'}>
                  <button
                    className="gx-btn" onClick={p.onZoomOut} aria-label="Zoom out"
                    style={{
                      flex: '0 0 34px', padding: 0, fontSize: 14, background: 'transparent',
                      border: '1px solid rgba(233,229,221,0.34)', color: '#cfc9bd',
                    }}
                  >−</button>
                  <button
                    className="gx-btn" onClick={p.onZoomIn} aria-label="Zoom in"
                    style={{
                      flex: '0 0 34px', padding: 0, fontSize: 14, background: 'transparent',
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
                      background: 'rgba(233,229,221,0.07)',
                      border: '1px solid rgba(233,229,221,0.34)',
                      color: '#dcd6ca', opacity: p.exporting ? 0.55 : 1,
                    }}
                  >
                    <DownloadIcon />
                    {p.exporting ? 'Rendering' : 'PNG'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  )
}
