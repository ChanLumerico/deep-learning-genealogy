// The draggable frame a panel gets on a phone.
//
// It owns height and gestures and nothing else: the panel inside renders its
// own header and body, marking them with `data-sheet-grab` (drag me) and
// `data-sheet-scroll` (this is the scroller). That keeps DetailPanel and
// ReadingList unaware of any of this beyond two attributes.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FULL, clampFraction, dragOwnsGesture, fractionOf, settle,
} from '../view/sheet'
import type { Detent } from '../view/sheet'

export interface BottomSheetProps {
  /** painted on the grab handle and the top border */
  accent?: string
  onClose: () => void
  children: React.ReactNode
}

export function BottomSheet({ accent, onClose, children }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [detent, setDetent] = useState<Detent>('peek')
  /** live height during a drag, as a fraction; null when settled */
  const [dragging, setDragging] = useState<number | null>(null)

  // the handlers bind once and read these, so they must not go through props
  const live = useRef({ detent, onClose })
  live.current = { detent, onClose }

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let active: number | null = null
    let startY = 0
    let startFraction = 0
    let owns = false
    let decided = false
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let scroller: HTMLElement | null = null

    const containerH = () => el.parentElement?.clientHeight || window.innerHeight

    const onDown = (ev: PointerEvent) => {
      if (active !== null) return
      const target = ev.target as HTMLElement
      // a press on a control is that control's, never the sheet's
      if (target.closest('button,a,input,label,select,textarea')) return
      active = ev.pointerId
      startY = lastY = ev.clientY
      lastT = ev.timeStamp
      velocity = 0
      owns = false
      decided = false
      startFraction = fractionOf(live.current.detent)
      scroller = el.querySelector('[data-sheet-scroll]')
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== active) return
      const dy = ev.clientY - startY

      if (!decided) {
        // wait for a real gesture before claiming it, or a tap becomes a drag
        if (Math.abs(dy) < 6) return
        decided = true
        owns = dragOwnsGesture({
          onHandle: !!(ev.target as HTMLElement).closest('[data-sheet-grab]'),
          detent: live.current.detent,
          scrollTop: scroller?.scrollTop ?? 0,
          dy,
        })
        if (owns) el.setPointerCapture(ev.pointerId)
      }
      if (!owns) return

      // the content must not scroll underneath a sheet that is moving
      ev.preventDefault()
      const dt = ev.timeStamp - lastT
      if (dt > 0) velocity = (ev.clientY - lastY) / dt
      lastY = ev.clientY
      lastT = ev.timeStamp
      setDragging(clampFraction(startFraction - dy / containerH()))
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== active) return
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId)
      active = null
      if (!owns) return
      const held = clampFraction(startFraction - (lastY - startY) / containerH())
      const next = settle(held, velocity)
      setDragging(null)
      if (next === 'closed') live.current.onClose()
      else setDetent(next)
    }

    el.addEventListener('pointerdown', onDown)
    // non-passive: preventDefault during a sheet drag is what stops the
    // content scrolling at the same time
    el.addEventListener('pointermove', onMove, { passive: false })
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [])

  // The scroller is only a scroller once the sheet is fully up.
  //
  // This is what makes "drag up to expand" work at all on a touch screen. If
  // the content scrolls natively while the sheet is collapsed, the browser
  // claims the upward drag before any handler sees it and pointermove stops
  // being cancelable — the sheet would sit there while the text moved. With
  // nothing to scroll at peek, the gesture is unambiguously the sheet's.
  useEffect(() => {
    const scroller = ref.current?.querySelector<HTMLElement>('[data-sheet-scroll]')
    if (!scroller) return
    scroller.style.overflowY = detent === 'full' ? 'auto' : 'hidden'
    if (detent !== 'full') scroller.scrollTop = 0
  }, [detent])

  const toggle = useCallback(
    () => setDetent((d) => (d === 'full' ? 'peek' : 'full')),
    [],
  )

  const fraction = dragging ?? fractionOf(detent)
  const atFull = fraction >= FULL - 0.001

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: `${fraction * 100}%`,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(9,12,16,0.97)',
        borderTop: `2px solid ${accent ?? 'rgba(233,229,221,0.3)'}`,
        // the corners square off as it takes the whole screen
        borderRadius: atFull ? 0 : '14px 14px 0 0',
        boxShadow: '0 -18px 46px rgba(0,0,0,0.55)',
        // animate only when settling; following a finger must be immediate
        transition: dragging === null
          ? 'height 260ms cubic-bezier(0.22, 0.61, 0.36, 1), border-radius 200ms ease'
          : 'none',
        willChange: 'height',
        // collapsed there is nothing to scroll, so every vertical drag is the
        // sheet's; expanded, the browser gets the vertical axis back
        touchAction: detent === 'full' ? 'pan-y' : 'none',
      }}
    >
      {/* the grab handle: also a button, so the gesture is not the only way up */}
      <div
        data-sheet-grab
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-label={atFull ? 'Collapse the panel' : 'Expand the panel'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { toggle(); e.preventDefault() }
        }}
        style={{
          flex: 'none', display: 'flex', justifyContent: 'center',
          padding: '7px 0 3px', cursor: 'grab', touchAction: 'none',
        }}
      >
        <span style={{
          width: 34, height: 4, borderRadius: 2,
          background: 'rgba(233,229,221,0.34)',
        }} />
      </div>
      {children}
    </div>
  )
}
