// Small, centred, and out of the way of everything.
//
// The stack does not take pointer events — it floats over the sheet, and a
// notice you cannot drag through would make the graph feel stuck. The pills
// themselves do, so one can be dismissed early.

import type { Toast } from '../view/toasts'

const TONE: Record<Toast['tone'], { bd: string; bg: string; fg: string }> = {
  info: { bd: 'rgba(233,229,221,0.28)', bg: 'rgba(16,20,26,0.96)', fg: '#dcd6ca' },
  good: { bd: 'rgba(143,156,134,0.5)', bg: 'rgba(17,23,20,0.96)', fg: '#c3d0ba' },
  bad: { bd: 'rgba(214,139,122,0.5)', bg: 'rgba(26,18,17,0.96)', fg: '#e2b0a2' },
}

export function Toasts({ toasts, onDismiss }: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  if (!toasts.length) return null
  return (
    <div
      // polite: a reading tick is not worth interrupting a screen reader for
      aria-live="polite"
      style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 80, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, pointerEvents: 'none', maxWidth: 'min(92vw, 460px)',
      }}
    >
      {toasts.map((t) => {
        const c = TONE[t.tone]
        return (
          <button
            key={t.id}
            className="gx-toast"
            onClick={() => onDismiss(t.id)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer', font: 'inherit',
              padding: '7px 14px', borderRadius: 15,
              border: `1px solid ${c.bd}`, background: c.bg, color: c.fg,
              fontSize: 12.5, lineHeight: 1.35, letterSpacing: '0.02em',
              textAlign: 'center', maxWidth: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >{t.text}</button>
        )
      })}
    </div>
  )
}
