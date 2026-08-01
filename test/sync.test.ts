// Merging two reading lists is where an account feature can lose somebody's
// record of what they have read. The rule is union — a tick is evidence, the
// absence of one is not — and these hold it in place.

import { describe, expect, it } from 'vitest'
import { describe as report, gained, plan, toMap } from '../src/data/sync'
import type { ReadMap } from '../src/data/readingLog'

const m = (...ids: string[]): ReadMap =>
  Object.fromEntries(ids.map((id) => [id, 1])) as ReadMap

describe('what a sign-in should do', () => {
  it('keeps everything from both sides', () => {
    const p = plan(m('resnet', 'vgg'), m('vgg', 'transformer'))
    expect(Object.keys(p.merged).sort()).toEqual(['resnet', 'transformer', 'vgg'])
  })

  it('uploads only what the account is missing', () => {
    expect(plan(m('a', 'b'), m('b')).toUpload).toEqual(['a'])
  })

  it('does nothing when the two already agree', () => {
    const p = plan(m('a', 'b'), m('b', 'a'))
    expect(p.inSync).toBe(true)
    expect(p.toUpload).toEqual([])
  })

  it('never drops an account tick just because this browser lacks it', () => {
    // signing in on a fresh machine must not wipe the account
    const p = plan({}, m('a', 'b', 'c'))
    expect(Object.keys(p.merged).sort()).toEqual(['a', 'b', 'c'])
    expect(p.toUpload).toEqual([])
  })

  it('never drops a local tick just because the account lacks it', () => {
    // reading offline, then signing in, must not lose the reading
    const p = plan(m('a', 'b'), {})
    expect(Object.keys(p.merged).sort()).toEqual(['a', 'b'])
    expect(p.toUpload).toEqual(['a', 'b'])
  })

  it('handles both sides being empty', () => {
    const p = plan({}, {})
    expect(p.merged).toEqual({})
    expect(p.inSync).toBe(true)
  })

  it('does not mutate what it was given', () => {
    const local = m('a')
    const remote = m('b')
    plan(local, remote)
    expect(local).toEqual(m('a'))
    expect(remote).toEqual(m('b'))
  })

  it('is idempotent — merging the result again changes nothing', () => {
    const once = plan(m('a'), m('b')).merged
    const twice = plan(once, once)
    expect(twice.merged).toEqual(once)
    expect(twice.inSync).toBe(true)
  })
})

describe('telling the reader what happened', () => {
  it('says nothing when nothing changed', () => {
    expect(report(m('a'), m('a'))).toBe(null)
    expect(report({}, {})).toBe(null)
  })

  it('reports each direction', () => {
    expect(report({}, m('a', 'b'))).toBe('Reading list merged — 2 from your account.')
    expect(report(m('a'), {})).toBe('Reading list merged — 1 from this browser.')
    expect(report(m('a'), m('b', 'c')))
      .toBe('Reading list merged — 2 from your account, 1 from this browser.')
  })

  it('names what the account contributed', () => {
    expect(gained(m('a'), m('a', 'b', 'c'))).toEqual(['b', 'c'])
  })
})

describe('reading rows back', () => {
  it('turns rows into the map the app uses', () => {
    expect(toMap([{ node_id: 'a' }, { node_id: 'b' }])).toEqual({ a: 1, b: 1 })
  })

  it('survives an empty or malformed result', () => {
    expect(toMap([])).toEqual({})
    expect(toMap([{ node_id: '' }] as never)).toEqual({})
  })
})
