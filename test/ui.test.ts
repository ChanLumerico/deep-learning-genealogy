// Chrome-level guards. These cannot check what a browser paints — there is no
// DOM here and jsdom does no layout — so they check the two things that made
// the bugs possible in the first place: a caption that repeats a fact instead
// of deriving it, and a flex row that cannot shrink.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Genealogy, NodeModel } from '../src/layout'
import { loadGraphData } from './snapshot'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'src', 'components')
const files = readdirSync(COMPONENTS).filter((f) => f.endsWith('.tsx'))
const source = (f: string) => readFileSync(join(COMPONENTS, f), 'utf8')

describe('the year range is derived, not written down', () => {
  // `span` reads years and nothing else, so this builds a Genealogy directly
  // rather than laying one out. Routing 301 edges took ~7s on CI and blew
  // vitest's 5s default — a real failure, and the wrong work besides.
  it('spans exactly the years the graph holds', () => {
    const { nodes } = loadGraphData()
    const lo = Math.min(...nodes.map((n) => n.y))
    const hi = Math.max(...nodes.map((n) => n.y))
    const g = new Genealogy(nodes.map((n) => new NodeModel(n)), [])
    expect(g.span).toBe(`${lo} — ${hi}`)
  })

  // The bar read "1957 — 2025" for as long as it took someone to notice, which
  // is what a hand-kept caption does. Nothing may spell a range out again.
  it('is not hard-coded in any component', () => {
    const offenders = files
      .filter((f) => /\b(19|20)\d{2}\s*[—–-]\s*(19|20)\d{2}\b/.test(source(f)))
      .map((f) => `src/components/${f}`)
    expect(offenders).toEqual([])
  })
})

// A flex child defaults to `min-width: auto`, so it refuses to shrink below its
// content. Put one next to a `white-space: nowrap` sibling and the row silently
// grows past its container — which is exactly how the hover card came to print
// "Decision Transformer · 2021 · UC Berkeley · FAIR" through its own border.
//
// File granularity, deliberately: this is a smoke test for the shape of the
// mistake, not a proof that every row is safe. Checked against the source as it
// shipped, it catches NodeTip and nothing else — SearchPalette and DetailPanel
// had the same unshrinkable row but also had a `minWidth: 0` elsewhere in the
// file, so they passed. Those two were found by reading. Treat a green run here
// as "the obvious version of this bug is absent", not as "the rows are fine".
describe('flex rows can shrink', () => {
  it('never pairs nowrap with a row that has no minWidth escape', () => {
    const offenders = files.filter((f) => {
      const s = source(f)
      const flex = /display:\s*'flex'/.test(s)
      const nowrap = /whiteSpace:\s*'nowrap'/.test(s)
      const canShrink = /minWidth:\s*0/.test(s) || /overflow:\s*'hidden'/.test(s)
      return flex && nowrap && !canShrink
    }).map((f) => `src/components/${f}`)
    expect(offenders).toEqual([])
  })
})
