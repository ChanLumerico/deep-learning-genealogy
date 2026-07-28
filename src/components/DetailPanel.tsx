import type { PanelVM } from '../view/types'

export interface DetailPanelProps {
  panel: PanelVM
  onClose: () => void
}

export function DetailPanel({ panel, onClose }: DetailPanelProps) {
  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 372,
      display: 'flex', flexDirection: 'column', background: 'rgba(9,12,16,0.97)',
      borderLeft: `1px solid ${panel.color}`, boxShadow: '-18px 0 46px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: '20px 22px 0',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: panel.color,
          }}>{panel.kicker}</div>
          <div style={{ fontSize: 30, lineHeight: 1.05, color: '#f4efe5' }}>{panel.title}</div>
          <div style={{
            fontSize: 11, letterSpacing: '0.08em', color: '#948c7f',
            fontVariantNumeric: 'tabular-nums',
          }}>{panel.meta}</div>
        </div>
        <button
          className="gx-close" onClick={onClose}
          style={{ width: 27, height: 27, fontSize: 13, color: '#a9a294' }}
        >×</button>
      </div>

      <div style={{ height: 1, background: 'rgba(233,229,221,0.14)', margin: '16px 22px 0' }} />

      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 22px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 17, lineHeight: 1.4, color: '#e6dfd2' }}>{panel.lead}</div>

        {panel.fields.map((f) => (
          <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
              fontWeight: 500, color: '#8a8275',
            }}>{f.k}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: f.c, fontStyle: f.it }}>{f.v}</div>
          </div>
        ))}

        {panel.groups.map((grp) => (
          <div key={grp.k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{
                fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
                fontWeight: 500, color: '#8a8275',
              }}>{grp.k}</div>
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
