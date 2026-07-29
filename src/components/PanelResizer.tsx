// The grab strip down the inner edge of a side panel.
//
// Long-form essays with display maths in them want more room than the 372px
// the panel shipped with, and how much more depends on the reader's screen and
// on what they are reading. So the width is theirs to set.

export interface PanelResizerProps {
  /** current width, so a drag starts from where the panel actually is */
  width: number
  onResize: (next: number) => void
}

export function PanelResizer({ width, onResize }: PanelResizerProps) {
  return (
    <div
      className="gx-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the panel"
      onPointerDown={(ev) => {
        // the pointer belongs to this strip for the whole drag, even once it
        // travels out over the canvas
        ev.currentTarget.setPointerCapture(ev.pointerId)
        ev.preventDefault()
        ev.stopPropagation()
        const x0 = ev.clientX
        const w0 = width
        const move = (m: PointerEvent) => onResize(w0 - (m.clientX - x0))
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      // keyboard parity: a pointer-only affordance is unreachable otherwise
      tabIndex={0}
      onKeyDown={(ev) => {
        const step = ev.shiftKey ? 48 : 16
        if (ev.key === 'ArrowLeft') { onResize(width + step); ev.preventDefault() }
        if (ev.key === 'ArrowRight') { onResize(width - step); ev.preventDefault() }
      }}
    >
      <span className="gx-resizer-grip" />
    </div>
  )
}
