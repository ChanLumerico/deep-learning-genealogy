// ── Bottom-sheet geometry ─────────────────────────────────────────────────
// Where a dragged sheet settles when the finger lifts. Pure arithmetic, no
// DOM, so the rule that decides between "cover the screen" and "go back down"
// can be asserted in a test rather than felt for on a device.
//
// Heights are fractions of the container, not pixels: the sheet lives inside
// the viewport below the top bar, and that box changes with rotation and with
// the browser's own chrome appearing and disappearing.

/** at rest the sheet takes this much, leaving the graph legible above it */
export const PEEK = 0.62
/** dragged up, it covers the whole viewport */
export const FULL = 1
/** below this the release is read as a dismissal rather than a collapse */
export const DISMISS = PEEK * 0.55

export type Detent = 'peek' | 'full'
/** what a release resolves to — a detent, or the sheet going away */
export type Settle = Detent | 'closed'

export const fractionOf = (d: Detent) => (d === 'full' ? FULL : PEEK)

export const clampFraction = (f: number) => Math.min(FULL, Math.max(0, f))

/** px/ms, downwards positive; past this the flick decides, not the position */
export const FLICK = 0.5

/**
 * Resolve a release.
 *
 * A deliberate flick wins over position — someone throwing the sheet upward
 * from just above PEEK means "open it", even though the nearest detent is the
 * one they started from. Without a flick it snaps to whichever detent is
 * closer, with dismissal available only well below the resting height so a
 * small downward nudge collapses rather than closes.
 */
export function settle(fraction: number, velocity: number): Settle {
  if (velocity < -FLICK) return 'full'
  if (velocity > FLICK) return fraction <= PEEK + 0.03 ? 'closed' : 'peek'
  if (fraction >= (PEEK + FULL) / 2) return 'full'
  if (fraction < DISMISS) return 'closed'
  return 'peek'
}

/**
 * Should this drag move the sheet, or scroll its contents?
 *
 * The rule is the one every native sheet uses: the sheet moves first and the
 * content scrolls second. Pulling up while collapsed expands rather than
 * scrolling; pulling down while the content is already at its top collapses
 * rather than rubber-banding. Everything else belongs to the scroller.
 */
export function dragOwnsGesture(opts: {
  /** the press began on the header or the grab handle */
  onHandle: boolean
  detent: Detent
  /** the content's scrollTop */
  scrollTop: number
  /** travel since the press; positive is downwards */
  dy: number
}): boolean {
  const { onHandle, detent, scrollTop, dy } = opts
  if (onHandle) return true
  if (detent === 'peek' && dy < 0) return true
  return scrollTop <= 0 && dy > 0
}
