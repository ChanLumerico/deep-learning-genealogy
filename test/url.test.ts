// A link someone sends has to open on what they were looking at, years from
// now, whatever they typed. So the grammar is checked in both directions, and
// against the malformed URLs that arrive when a link is truncated by a chat
// client or edited by hand.

import { describe, expect, it } from 'vitest'
import { EMPTY, isNavigation, parseHash, sameUrl, toHash } from '../src/view/url'
import type { UrlState } from '../src/view/url'

const state = (over: Partial<UrlState> = {}): UrlState => ({ ...EMPTY, ...over })

describe('writing a link', () => {
  it('writes nothing but a root for an untouched view', () => {
    expect(toHash(EMPTY)).toBe('#/')
  })

  it('writes the selection', () => {
    expect(toHash(state({ sel: { kind: 'node', id: 'resnet' } }))).toBe('#/node/resnet')
    expect(toHash(state({ sel: { kind: 'edge', from: 'vgg', to: 'resnet' } })))
      .toBe('#/edge/vgg/resnet')
    expect(toHash(state({ listOpen: true }))).toBe('#/list')
  })

  it('leaves defaults out, so an ordinary link stays short', () => {
    expect(toHash(state({ sel: { kind: 'node', id: 'vit' } }))).toBe('#/node/vit')
  })

  it('carries the view when it is not at its default', () => {
    expect(toHash(state({
      sel: { kind: 'node', id: 'vit' },
      year: 2020,
      lanesOff: ['nlp', 'cv'],
      kindsOff: ['alt'],
    }))).toBe('#/node/vit?year=2020&lanes=cv,nlp&kinds=alt')
  })

  it('orders the lists, so the same view is always the same link', () => {
    const a = toHash(state({ lanesOff: ['rl', 'cv', 'mm'] }))
    const b = toHash(state({ lanesOff: ['mm', 'cv', 'rl'] }))
    expect(a).toBe(b)
  })
})

describe('reading a link', () => {
  it('round-trips everything it writes', () => {
    for (const s of [
      EMPTY,
      state({ sel: { kind: 'node', id: 'resnet' } }),
      state({ sel: { kind: 'edge', from: 'vgg', to: 'resnet' } }),
      state({ listOpen: true }),
      state({ sel: { kind: 'node', id: 'vit' }, year: 2020, lanesOff: ['cv'], kindsOff: ['alt', 'cross'] }),
    ]) expect(parseHash(toHash(s)), toHash(s)).toEqual(s)
  })

  it('accepts a link with or without its leading hash', () => {
    expect(parseHash('#/node/resnet').sel).toEqual({ kind: 'node', id: 'resnet' })
    expect(parseHash('/node/resnet').sel).toEqual({ kind: 'node', id: 'resnet' })
  })

  it('falls back to the plain view rather than breaking', () => {
    for (const bad of ['', '#', '#/', '#/nonsense', '#/node', '#/node/', '#/edge/vgg']) {
      expect(parseHash(bad), bad).toEqual(EMPTY)
    }
  })

  it('refuses an id that could not have come from us', () => {
    // a truncated or hand-edited link must not reach the lookup at all
    expect(parseHash('#/node/../../etc').sel).toBe(null)
    expect(parseHash('#/node/<script>').sel).toBe(null)
    expect(parseHash('#/edge/vgg/<img>').sel).toBe(null)
  })

  it('ignores a year that is not one', () => {
    expect(parseHash('#/?year=abc').year).toBe(null)
    expect(parseHash('#/?year=99999').year).toBe(null)
    expect(parseHash('#/?year=2017').year).toBe(2017)
  })

  it('drops junk out of the filter lists but keeps the rest', () => {
    expect(parseHash('#/?lanes=cv,,NOT VALID,nlp').lanesOff).toEqual(['cv', 'nlp'])
  })
})

describe('what earns a history entry', () => {
  const at = (id: string) => state({ sel: { kind: 'node', id } })

  it('counts moving between entries', () => {
    expect(isNavigation(at('resnet'), at('vgg'))).toBe(true)
    expect(isNavigation(EMPTY, at('resnet'))).toBe(true)
    expect(isNavigation(at('resnet'), state({ listOpen: true }))).toBe(true)
  })

  it('does not count nudging the view', () => {
    // otherwise dragging the timeline buries the page you arrived from
    expect(isNavigation(at('resnet'), { ...at('resnet'), year: 2015 })).toBe(false)
    expect(isNavigation(at('resnet'), { ...at('resnet'), lanesOff: ['cv'] })).toBe(false)
  })

  it('knows when two states are the same link', () => {
    expect(sameUrl(at('resnet'), at('resnet'))).toBe(true)
    expect(sameUrl(at('resnet'), at('vgg'))).toBe(false)
  })
})
