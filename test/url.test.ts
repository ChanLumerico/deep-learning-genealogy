// A link someone sends has to open on what they were looking at, years from
// now, whatever they typed. So the grammar is checked in both directions, and
// against the malformed URLs that arrive when a link is truncated by a chat
// client or edited by hand.

import { describe, expect, it } from 'vitest'
import { EMPTY, isAuthFragment, isNavigation, parseHash, sameUrl, toHash } from '../src/view/url'
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

  it('writes a walk, with its step', () => {
    expect(toHash(state({ walk: { kind: 'path', id: 'transformer', step: 0 } })))
      .toBe('#/path/transformer')
    expect(toHash(state({ walk: { kind: 'path', id: 'transformer', step: 4 } })))
      .toBe('#/path/transformer?step=4')
    expect(toHash(state({ walk: { kind: 'trace', id: 'resnet', step: 2 } })))
      .toBe('#/trace/resnet?step=2')
  })

  it('round-trips a walk', () => {
    for (const w of [
      { kind: 'path' as const, id: 'depth', step: 0 },
      { kind: 'trace' as const, id: 'vit', step: 7 },
    ]) expect(parseHash(toHash(state({ walk: w }))).walk).toEqual(w)
  })

  it('refuses a walk id that could not have come from us', () => {
    expect(parseHash('#/path/../secrets').walk).toBe(null)
    expect(parseHash('#/trace/').walk).toBe(null)
  })

  it('reads a missing or silly step as the beginning', () => {
    expect(parseHash('#/path/depth').walk?.step).toBe(0)
    expect(parseHash('#/path/depth?step=abc').walk?.step).toBe(0)
    expect(parseHash('#/path/depth?step=-4').walk?.step).toBe(0)
  })

  it('counts moving through a walk as navigation', () => {
    // back should retrace the reading, step by step
    const a = state({ walk: { kind: 'path', id: 'depth', step: 1 } })
    const b = state({ walk: { kind: 'path', id: 'depth', step: 2 } })
    expect(isNavigation(a, b)).toBe(true)
  })

  it('carries the view when it is not at its default', () => {
    expect(toHash(state({
      sel: { kind: 'node', id: 'vit' },
      lanesOff: ['nlp', 'cv'],
      kindsOff: ['alt'],
    }))).toBe('#/node/vit?lanes=cv,nlp&kinds=alt')
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
      state({ sel: { kind: 'node', id: 'vit' }, lanesOff: ['cv'], kindsOff: ['alt', 'cross'] }),
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

  it('still opens a link from when there was a timeline', () => {
    // ?year= was dropped with the slider; an old link must not fail closed
    expect(parseHash('#/node/resnet?year=2017').sel).toEqual({ kind: 'node', id: 'resnet' })
    expect(parseHash('#/?year=abc&lanes=cv').lanesOff).toEqual(['cv'])
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
    expect(isNavigation(at('resnet'), { ...at('resnet'), lanesOff: ['cv'] })).toBe(false)
    expect(isNavigation(at('resnet'), { ...at('resnet'), lanesOff: ['cv'] })).toBe(false)
  })

  it('knows when two states are the same link', () => {
    expect(sameUrl(at('resnet'), at('resnet'))).toBe(true)
    expect(sameUrl(at('resnet'), at('vgg'))).toBe(false)
  })
})

// The bug this locks was silent in every direction: the provider redirected
// back with the session in the fragment, this app wrote its own fragment over
// it before the lazily-imported auth client arrived, and the result was a
// session on the server, nothing in the browser, and no error anywhere.
describe('an auth redirect owns the fragment', () => {
  it('recognises what a provider sends back', () => {
    expect(isAuthFragment('#access_token=abc&refresh_token=def&token_type=bearer')).toBe(true)
    expect(isAuthFragment('#error_code=403&error_description=denied')).toBe(true)
    expect(isAuthFragment('#/node/resnet&provider_token=x')).toBe(true)
  })

  it('does not mistake our own links for one', () => {
    for (const h of ['', '#/', '#/node/resnet', '#/path/depth?step=4',
      '#/node/vit?lanes=cv,nlp', '#/edge/vgg/resnet', '#/list'])
      expect(isAuthFragment(h)).toBe(false)
  })

  it('is not fooled by a model whose name contains the word', () => {
    // matched with a leading # or &, so a path segment cannot trip it
    expect(isAuthFragment('#/node/accesstoken')).toBe(false)
  })
})
