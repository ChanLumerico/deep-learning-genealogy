// The queue rules, rather than the pixels. What matters is that a notice
// cannot pile up on itself, that the stack has a ceiling, and that a failure
// stays long enough to be read.

import { describe, expect, it } from 'vitest'
import { countPhrase, drop, MAX, push, TOAST_MS } from '../src/view/toasts'
import type { Toast } from '../src/view/toasts'

const t = (id: number, text: string, tone: Toast['tone'] = 'info'): Toast =>
  ({ id, text, tone })

describe('the notice queue', () => {
  it('keeps the newest and drops the oldest past the ceiling', () => {
    let l: Toast[] = []
    for (let i = 1; i <= MAX + 2; i++) l = push(l, t(i, `note ${i}`))
    expect(l).toHaveLength(MAX)
    expect(l.map((x) => x.id)).toEqual([3, 4, 5])
  })

  it('replaces an identical repeat instead of stacking it', () => {
    // ticking one row on and off should not fill the screen with one sentence
    let l = push([], t(1, 'ResNet — read'))
    l = push(l, t(2, 'ResNet — read'))
    expect(l).toEqual([t(2, 'ResNet — read')])
  })

  it('only collapses against the newest, not anything earlier', () => {
    let l = push([], t(1, 'a'))
    l = push(l, t(2, 'b'))
    l = push(l, t(3, 'a'))
    expect(l.map((x) => x.text)).toEqual(['a', 'b', 'a'])
  })

  it('drops by id, and does not mind an id that has gone', () => {
    const l = [t(1, 'a'), t(2, 'b')]
    expect(drop(l, 1)).toEqual([t(2, 'b')])
    // a replaced duplicate leaves a timer pointing at nothing; it must be safe
    expect(drop(l, 99)).toEqual(l)
    expect(l).toHaveLength(2)   // never mutated
  })

  it('leaves a failure up for longer than a confirmation', () => {
    expect(TOAST_MS.bad).toBeGreaterThan(TOAST_MS.good)
    expect(TOAST_MS.good).toBe(TOAST_MS.info)
  })

  it('counts in whole papers', () => {
    expect(countPhrase(1, 'marked read')).toBe('1 paper marked read')
    expect(countPhrase(14, 'marked read')).toBe('14 papers marked read')
    expect(countPhrase(0, 'imported')).toBe('0 papers imported')
  })
})
