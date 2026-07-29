// ── Camera ────────────────────────────────────────────────────────────────
// Pan and zoom over the sheet, from a mouse or from fingers.
//
// This used to be mouse-only — `mousedown`/`mousemove` plus `wheel` — which
// left the sheet completely unnavigable on a touch device: no drag, no pinch.
// Pointer events cover mouse, touch and pen in one path, so there is a single
// gesture implementation rather than two that drift.
//
// The arithmetic lives in camera.ts, where it is tested. This file is the
// gesture state machine and nothing else.
//
// The camera deliberately stays apart from the paint pass in App.tsx: panning
// must not recompute 189 nodes and 248 edges.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Box, CameraState } from './camera'
import {
  ZOOM, centerOn as centerOnBox, fitBox, panBy, zoomAbout, zoomFloor,
} from './camera'

export { ZOOM } from './camera'

export interface Camera extends CameraState {
  /** put a sheet-space point in the middle of the viewport */
  centerOn: (x: number, y: number, zoom: number) => void
  /** frame a w×h sheet region, with `pad` px of viewport margin */
  fit: (w: number, h: number, pad?: number) => void
  zoomBy: (factor: number) => void
}

const FALLBACK: Box = { width: 1400, height: 900 }

/**
 * @param sheet  the size of the thing being looked at. Used for the zoom floor:
 *               a viewport narrower than the sheet at ZOOM.min has to be allowed
 *               further out, or the reader can never see the whole picture.
 */
export function useCamera(
  ref: React.RefObject<HTMLElement | null>,
  sheet: { w: number; h: number },
): Camera {
  const [cam, setCam] = useState<CameraState>({ k: ZOOM.initial, tx: 0, ty: 0 })

  // Live mirror. Gesture handlers bind once and must read the current camera
  // without re-binding — and without a stale closure — on every frame.
  const live = useRef(cam)
  live.current = cam

  // likewise: the handlers must see the current sheet without re-binding
  const sheetRef = useRef(sheet)
  sheetRef.current = sheet

  const apply = useCallback((next: CameraState) => {
    live.current = next
    setCam(next)
  }, [])

  const box = useCallback((): Box => {
    const el = ref.current
    if (!el) return FALLBACK
    const r = el.getBoundingClientRect()
    return { width: r.width, height: r.height }
  }, [ref])

  const floor = useCallback(
    () => zoomFloor(box(), sheetRef.current.w, sheetRef.current.h),
    [box],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const local = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect()
      return { x: ev.clientX - r.left, y: ev.clientY - r.top }
    }
    const low = () => zoomFloor(
      { width: el.clientWidth, height: el.clientHeight },
      sheetRef.current.w, sheetRef.current.h,
    )

    // ── wheel / trackpad ──────────────────────────────────────────────────
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const p = local(ev)
      // ctrlKey means a trackpad pinch, which the platform sends as a wheel
      const factor = ev.ctrlKey
        ? Math.exp(-ev.deltaY / 100)
        : (ev.deltaY > 0 ? 0.9 : 1.111)
      apply(zoomAbout(live.current, live.current.k * factor, p.x, p.y, low()))
    }

    // ── pointers: one drags, two pinch ────────────────────────────────────
    //
    // Capture is taken only once a drag has actually started, never on
    // pointerdown. A captured pointer retargets its pointerup to the capturing
    // element, so the browser then raises `click` on this wrapper instead of on
    // the node or edge that was under the finger — which silently killed every
    // tap and click on the sheet. Below the threshold the pointer stays
    // uncaptured and the click lands where it should.
    const active = new Map<number, { x: number; y: number }>()
    const origin = new Map<number, { x: number; y: number; type: string }>()
    let anchor: { dist: number; mx: number; my: number } | null = null
    let dragging = false

    /** how far a pointer may wander before it counts as a drag, not a tap */
    const slop = (type: string) => (type === 'touch' ? 9 : 4)

    const capture = (id: number) => {
      if (!el.hasPointerCapture(id)) el.setPointerCapture(id)
    }

    const centroid = () => {
      const pts = [...active.values()]
      return {
        mx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        my: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      }
    }
    const spread = () => {
      const [a, b] = [...active.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const reseat = () => {
      anchor = active.size === 2 ? { dist: spread(), ...centroid() } : null
    }

    const onDown = (ev: PointerEvent) => {
      // the chrome keeps its own taps
      if ((ev.target as HTMLElement).closest('input,button,label,select,textarea')) return
      const p = local(ev)
      active.set(ev.pointerId, p)
      origin.set(ev.pointerId, { ...p, type: ev.pointerType })
      // a second finger is a pinch, never a tap — safe to own it at once
      if (active.size === 2) {
        dragging = true
        active.forEach((_, id) => capture(id))
      }
      reseat()
      if (active.size === 1) el.style.cursor = 'grabbing'
    }

    const onMove = (ev: PointerEvent) => {
      if (!active.has(ev.pointerId)) return
      const prev = active.get(ev.pointerId)!
      const now = local(ev)

      if (!dragging) {
        const from = origin.get(ev.pointerId)!
        if (Math.hypot(now.x - from.x, now.y - from.y) < slop(from.type)) return
        dragging = true
        capture(ev.pointerId)
      }
      // only now: suppressing the default before this point also suppresses
      // the click the browser would have raised for a stationary press
      ev.preventDefault()
      active.set(ev.pointerId, now)

      if (active.size === 1) {
        apply(panBy(live.current, now.x - prev.x, now.y - prev.y))
        return
      }
      if (anchor) {
        const dist = spread()
        const { mx, my } = centroid()
        // follow the centroid, then scale about where it now sits
        let next = panBy(live.current, mx - anchor.mx, my - anchor.my)
        if (anchor.dist > 0) {
          next = zoomAbout(next, next.k * (dist / anchor.dist), mx, my, low())
        }
        apply(next)
        anchor = { dist, mx, my }
      }
    }

    const onUp = (ev: PointerEvent) => {
      if (!active.delete(ev.pointerId)) return
      origin.delete(ev.pointerId)
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId)
      // two fingers down to one: re-seat so the survivor does not jump
      reseat()
      if (active.size === 0) {
        dragging = false
        el.style.cursor = 'grab'
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove, { passive: false })
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [ref, apply])

  const centerOn = useCallback((x: number, y: number, zoom: number) => {
    apply(centerOnBox(box(), x, y, zoom, floor()))
  }, [apply, box, floor])

  const fit = useCallback((w: number, h: number, pad = 0) => {
    apply(fitBox(box(), w, h, pad))
  }, [apply, box])

  const zoomBy = useCallback((factor: number) => {
    const v = box()
    apply(zoomAbout(
      live.current, live.current.k * factor, v.width / 2, v.height / 2, floor(),
    ))
  }, [apply, box, floor])

  return { ...cam, centerOn, fit, zoomBy }
}
