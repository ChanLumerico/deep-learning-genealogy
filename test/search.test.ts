// The index is generated, so the first thing to check is that the committed
// file still matches the essays — otherwise it goes quietly stale and the
// search starts lying. After that, the ranking, against the real content:
// asking a real question and asserting the right entry comes back.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { queryTokens, search } from '../src/view/search'
import type { SearchIndex } from '../src/view/search'
// the generator is plain JS with no types; the shape it returns is asserted
// against the committed index below, which is the check that matters
// @ts-expect-error — no declaration file for a tools script
import { build } from '../tools/gen-search-index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const index: SearchIndex = JSON.parse(
  readFileSync(join(ROOT, 'public', 'data', 'search-index.json'), 'utf8'))

const ids = (q: string, n = 5) => search(index, q).slice(0, n).map((h) => h.entry.i)

describe('the committed index is current', () => {
  it('matches what the essays would produce now', () => {
    // if this fails someone edited an essay without running
    // `node tools/gen-search-index.mjs`
    const fresh = build() as SearchIndex
    expect(fresh.e.map((e) => e.i)).toEqual(index.e.map((e) => e.i))
    expect(Object.keys(fresh.t).length).toBe(Object.keys(index.t).length)
  })

  it('covers every essay', () => {
    expect(index.e.length).toBe(440)
    expect(index.e.filter((e) => e.k === 'n').length).toBe(189)
    expect(index.e.filter((e) => e.k === 'e').length).toBe(251)
  })
})

describe('what a query is broken into', () => {
  it('drops noise words and punctuation', () => {
    expect(queryTokens('the cost of attention')).toEqual(['cost', 'attention'])
    expect(queryTokens('scaled  dot-product!')).toEqual(['scaled', 'dot', 'product'])
    expect(queryTokens('√ ?? —')).toEqual([])
  })

  it('keeps a short query rather than searching for nothing', () => {
    // "v2" and "AI" are things people type
    expect(queryTokens('v2')).toEqual(['v2'])
    expect(queryTokens('')).toEqual([])
  })
})

describe('finding a model by name', () => {
  it('puts the model itself first', () => {
    expect(ids('resnet')[0]).toBe('resnet')
    expect(ids('transformer')[0]).toBe('transformer')
    expect(ids('stable diffusion')[0]).toBe('ldm')
  })

  it('finds it before the word is finished', () => {
    expect(ids('transfor')[0]).toBe('transformer')
    expect(ids('diffus').length).toBeGreaterThan(0)
  })

  it('prefers the model named over one that merely mentions it', () => {
    // Inception-ResNet and Decision Transformer both carry the query in
    // their titles; neither is what was asked for
    expect(ids('resnet')[0]).toBe('resnet')
    expect(ids('transformer')[0]).toBe('transformer')
    expect(ids('vit')[0]).toBe('vit')
  })
})

describe('finding an idea rather than a name', () => {
  // this is the whole point: 213,000 words that used to be invisible
  it('finds where mode collapse is discussed', () => {
    const hits = ids('mode collapse', 12)
    expect(hits.length).toBeGreaterThan(3)
    // the GAN line is where this lives
    expect(hits.some((h) => /gan|stylegan|wgan|pggan/.test(h))).toBe(true)
  })

  it('finds contrastive learning', () => {
    expect(ids('contrastive', 12).length).toBeGreaterThan(3)
  })

  it('finds vanishing gradients', () => {
    const hits = ids('vanishing gradient', 12)
    expect(hits.length).toBeGreaterThan(2)
  })

  it('searches the arrows too, not only the models', () => {
    const hits = search(index, 'quadratic attention cost', 40)
    expect(hits.some((h) => h.entry.k === 'e')).toBe(true)
  })
})

describe('ranking', () => {
  it('requires every word, so a second word narrows rather than widens', () => {
    const broad = search(index, 'attention').length
    const narrow = search(index, 'attention rotary').length
    expect(narrow).toBeLessThan(broad)
    expect(narrow).toBeGreaterThan(0)
  })

  it('reports which words it actually found', () => {
    const [top] = search(index, 'residual connection')
    expect(top.matched.sort()).toEqual(['connection', 'residual'])
  })

  it('returns nothing for a word that is not in the corpus', () => {
    expect(search(index, 'zzzznotaword')).toEqual([])
  })

  it('returns nothing for an empty query', () => {
    expect(search(index, '   ')).toEqual([])
  })

  it('honours the limit', () => {
    expect(search(index, 'model', 7).length).toBeLessThanOrEqual(7)
  })
})
