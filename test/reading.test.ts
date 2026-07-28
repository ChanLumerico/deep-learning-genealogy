import { describe, expect, it } from 'vitest'
import { buildLayout } from './snapshot'
import { PaperCsv } from '../src/data/csv'
import * as papers from '../src/data/papers'
import { ReadingLog } from '../src/data/readingLog'
import type { ReadMap } from '../src/data/readingLog'

const graph = buildLayout()
const index = PaperCsv.index(graph.nodes)

describe('reading state belongs to the visitor', () => {
  // The regression this guards: the log used to seed every paper in PAPERS as
  // read, so every first-time visitor inherited one person's reading history.
  it('falls back to an empty list, never to a seed', () => {
    // there is no window under vitest's node environment, so this exercises the
    // same branch an unavailable or empty localStorage takes in the browser
    expect(ReadingLog.load()).toEqual({})
  })

  it('ships no built-in list of models to mark read', () => {
    // PAPERS and CSV_ALIASES are lookup tables keyed by node id — fine. An
    // exported *array* of ids is what a seed list looks like, and the only
    // array this module is allowed to export is the CSV column order.
    const arrayExports = Object.entries(papers)
      .filter(([, v]) => Array.isArray(v))
      .map(([k]) => k)
    expect(arrayExports).toEqual(['CSV_HEADER'])
  })
})

describe('reading list export/import round-trip', () => {
  it('round-trips an arbitrary selection', () => {
    const read: ReadMap = {}
    graph.nodes.filter((_, i) => i % 7 === 0).forEach((n) => { read[n.id] = 1 })
    const back = PaperCsv.parse(PaperCsv.serialize(graph.nodes, read), index)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.ignored).toEqual([])
    expect(Object.keys(back.matched).sort()).toEqual(Object.keys(read).sort())
  })

  it('round-trips every node in the tree', () => {
    const read: ReadMap = {}
    graph.nodes.forEach((n) => { read[n.id] = 1 })
    const back = PaperCsv.parse(PaperCsv.serialize(graph.nodes, read), index)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.ignored).toEqual([])
    expect(back.count).toBe(graph.nodes.length)
  })

  it('quotes cells that contain a comma or a quote', () => {
    expect(PaperCsv.cell('a,b')).toBe('"a,b"')
    expect(PaperCsv.cell('say "hi"')).toBe('"say ""hi"""')
    expect(PaperCsv.cell('plain')).toBe('plain')
    expect(PaperCsv.splitRow(PaperCsv.cell('a,b') + ',x')).toEqual(['a,b', 'x'])
  })

  it('exports an empty list as a header-only file', () => {
    const csv = PaperCsv.serialize(graph.nodes, {})
    expect(csv).toBe('Model,Field,Paper,Task,Year\n')
    const back = PaperCsv.parse(csv, index)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.count).toBe(0)
  })
})
