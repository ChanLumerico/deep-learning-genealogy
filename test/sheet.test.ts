// A bottom sheet is judged entirely by where it lands when you let go, and
// that is the one thing you cannot check without a thumb — so the rule lives
// in pure functions and is checked here instead.

import { describe, expect, it } from 'vitest'
import {
  DISMISS, FLICK, FULL, PEEK, clampFraction, dragOwnsGesture, fractionOf, settle,
} from '../src/view/sheet'

describe('where a release settles', () => {
  it('opens fully when flicked up, even from the resting height', () => {
    // the gesture, not the position: someone throwing it up means "open"
    expect(settle(PEEK, -1.2)).toBe('full')
    expect(settle(PEEK + 0.01, -(FLICK + 0.01))).toBe('full')
  })

  it('collapses when flicked down from anywhere above the resting height', () => {
    expect(settle(FULL, 1.2)).toBe('peek')
    expect(settle(0.8, FLICK + 0.01)).toBe('peek')
  })

  it('closes when flicked down from the resting height itself', () => {
    // already as low as a detent goes — down means away
    expect(settle(PEEK, 1.2)).toBe('closed')
    expect(settle(PEEK - 0.1, 1.2)).toBe('closed')
  })

  it('snaps to the nearer detent when let go without a flick', () => {
    const mid = (PEEK + FULL) / 2
    expect(settle(mid + 0.01, 0)).toBe('full')
    expect(settle(mid - 0.01, 0)).toBe('peek')
    expect(settle(PEEK, 0)).toBe('peek')
    expect(settle(FULL, 0)).toBe('full')
  })

  it('only dismisses on a slow release well below the resting height', () => {
    // a small downward nudge collapses; it must not close
    expect(settle(PEEK - 0.02, 0)).toBe('peek')
    expect(settle(DISMISS + 0.01, 0)).toBe('peek')
    expect(settle(DISMISS - 0.01, 0)).toBe('closed')
  })

  it('never returns a height outside the sheet', () => {
    expect(clampFraction(2)).toBe(FULL)
    expect(clampFraction(-1)).toBe(0)
    expect(fractionOf('peek')).toBe(PEEK)
    expect(fractionOf('full')).toBe(FULL)
  })
})

describe('who owns the gesture — the sheet or the scroller', () => {
  const g = (o: Partial<Parameters<typeof dragOwnsGesture>[0]>) => dragOwnsGesture({
    onHandle: false, detent: 'peek', scrollTop: 0, dy: 0, ...o,
  })

  it('gives the handle every drag', () => {
    expect(g({ onHandle: true, dy: -50 })).toBe(true)
    expect(g({ onHandle: true, dy: 50, detent: 'full', scrollTop: 900 })).toBe(true)
  })

  it('expands rather than scrolling when pulled up while collapsed', () => {
    expect(g({ detent: 'peek', dy: -40, scrollTop: 0 })).toBe(true)
    // even if the content has been scrolled, up means "make me bigger" first
    expect(g({ detent: 'peek', dy: -40, scrollTop: 300 })).toBe(true)
  })

  it('collapses rather than rubber-banding when pulled down from the top', () => {
    expect(g({ detent: 'full', dy: 40, scrollTop: 0 })).toBe(true)
    expect(g({ detent: 'peek', dy: 40, scrollTop: 0 })).toBe(true)
  })

  it('leaves the scroller alone once it has something to scroll', () => {
    // mid-content, dragging down: that is a scroll, not a collapse
    expect(g({ detent: 'full', dy: 40, scrollTop: 250 })).toBe(false)
    // expanded and dragging up: the content scrolls, the sheet is already full
    expect(g({ detent: 'full', dy: -40, scrollTop: 0 })).toBe(false)
    expect(g({ detent: 'full', dy: -40, scrollTop: 250 })).toBe(false)
  })
})
