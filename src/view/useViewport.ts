// ── Viewport ──────────────────────────────────────────────────────────────
// One source of truth for "how much room is there, and what is pointing at it".
// Components read the flags rather than re-deriving widths, so a breakpoint
// moves in one place.

import { useEffect, useState } from 'react'

/**
 * phone < 640 ≤ tablet < 1024 ≤ desktop, plus a height floor.
 *
 * `short` exists because a phone in landscape is wide but only ~390px tall:
 * wide enough that the panels still want to be a side column, short enough
 * that the controls must fold away or there is no sheet left to look at.
 * Width and height therefore drive two different decisions.
 */
export const BREAKPOINTS = { tablet: 640, desktop: 1024, short: 520 } as const

export interface Viewport {
  w: number
  h: number
  /** narrower than a 372px panel: bottom sheets, no lane gutter */
  phone: boolean
  /** not enough room for the controls to stay open — put them behind a toggle */
  drawer: boolean
  /** below desktop: stack the control groups rather than sitting them in a row */
  compact: boolean
  portrait: boolean
  /** a finger, not a mouse: no hover, and hit targets need to be bigger */
  coarse: boolean
}

function read(): Viewport {
  const w = window.innerWidth
  const h = window.innerHeight
  // `pointer: coarse` is the touch signal; `hover: none` catches the devices
  // that report a fine stylus but still cannot hover.
  const coarse = window.matchMedia('(pointer: coarse), (hover: none)').matches
  const phone = w < BREAKPOINTS.tablet
  return {
    w,
    h,
    phone,
    drawer: phone || h < BREAKPOINTS.short,
    compact: w < BREAKPOINTS.desktop,
    portrait: h >= w,
    coarse,
  }
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)
  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setVp(read()))
    }
    window.addEventListener('resize', sync)
    // iOS fires this on rotation before innerWidth settles; resize follows
    window.addEventListener('orientationchange', sync)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])
  return vp
}
