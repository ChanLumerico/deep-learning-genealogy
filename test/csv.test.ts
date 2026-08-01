// The importer has to accept whatever a reader's reference manager produced,
// so the cases here are shaped like real exports rather than like the file the
// app writes: a Zotero dump with an abstract containing commas and newlines, a
// European Excel file delimited with semicolons, a one-column list somebody
// typed, a file with no header at all.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PaperCsv, normArxiv, normDoi, normText } from '../src/data/csv'
import type { PaperIds } from '../src/data/csv'
import { buildLayout } from './snapshot'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const papers: PaperIds = JSON.parse(
  readFileSync(join(ROOT, 'public', 'data', 'paper-ids.json'), 'utf8'))

const graph = buildLayout()
const ix = PaperCsv.index(graph.nodes, papers)

const hit = (csv: string) => {
  const r = PaperCsv.parse(csv, ix)
  if (!r.ok) throw new Error(r.error)
  return Object.keys(r.matched).sort()
}

describe('identifier normalisation', () => {
  it('reads a DOI however it is written', () => {
    for (const v of [
      '10.1038/323533a0',
      'https://doi.org/10.1038/323533a0',
      'doi:10.1038/323533a0',
      '10.1038/323533A0',
      'See 10.1038/323533a0.',
    ]) expect(normDoi(v), v).toBe('10.1038/323533a0')
  })

  it('reads an arXiv id however it is written', () => {
    for (const v of [
      '1706.03762',
      'arXiv:1706.03762',
      'arXiv:1706.03762v5',
      'https://arxiv.org/abs/1706.03762',
      'https://arxiv.org/abs/1706.03762v5',
      'https://arxiv.org/pdf/1706.03762',
    ]) expect(normArxiv(v), v).toBe('1706.03762')
    expect(normArxiv('cs/0701001')).toBe('cs/0701001')
  })

  it('does not read a bare number as an arXiv id', () => {
    // a year, a page range, a citation count — none of these are papers
    expect(normArxiv('2017')).toBe('')
    expect(normArxiv('1234.5')).toBe('')
    expect(normArxiv('Vaswani et al., 2017, pp. 5998-6008')).toBe('')
  })

  it('compares titles on letters and digits alone', () => {
    const want = normText('Attention Is All You Need')
    for (const v of [
      'attention is all you need',
      'Attention is all you need.',
      '  Attention Is All You Need  ',
      'Attention—Is All You Need',
    ]) expect(normText(v), v).toBe(want)
  })
})

describe('tokenising real files', () => {
  it('keeps a quoted field that contains commas and newlines intact', () => {
    // this is the case that breaks any parser which splits on newlines first,
    // and every Zotero export has one: the abstract
    const rows = PaperCsv.rows('Title,Abstract\n"A, B","line one\nline two"\n')
    expect(rows).toEqual([['Title', 'Abstract'], ['A, B', 'line one\nline two']])
  })

  it('unescapes doubled quotes', () => {
    expect(PaperCsv.rows('a,"say ""hi"""')[0]).toEqual(['a', 'say "hi"'])
  })

  it('strips the BOM Excel writes', () => {
    expect(PaperCsv.rows('﻿Title\nx')[0]).toEqual(['Title'])
  })

  it('detects a semicolon or tab delimiter', () => {
    expect(PaperCsv.delimiter('Title;DOI;Year')).toBe(';')
    expect(PaperCsv.delimiter('Title\tDOI\tYear')).toBe('\t')
    expect(PaperCsv.delimiter('Title,DOI,Year')).toBe(',')
    // a comma inside a quoted header must not win the vote
    expect(PaperCsv.delimiter('"Author, A";Title')).toBe(';')
  })
})

describe('matching whatever the reader uploads', () => {
  it('takes a Zotero export unchanged', () => {
    const csv = [
      'Key,Item Type,Publication Year,Author,Title,Publication Title,DOI,Url,Abstract Note,Extra',
      'ABC1,preprint,2017,"Vaswani, Ashish",Attention Is All You Need,,,https://arxiv.org/abs/1706.03762,"We propose a new simple network architecture, the Transformer.",arXiv:1706.03762',
      'ABC2,journalArticle,1986,"Rumelhart, David",Learning representations by back-propagating errors,Nature,10.1038/323533a0,,,',
    ].join('\n')
    expect(hit(csv)).toEqual(['mlp', 'transformer'])
  })

  it('does not read Zotero\'s journal name as a paper title', () => {
    // "Publication Title" is the venue — treating it as the title would match
    // every Nature paper against whatever node is called Nature
    const csv = 'Title,Publication Title\nSomething Unrelated,Neural Computation'
    expect(hit(csv)).toEqual([])
  })

  it('takes a one-column list of titles', () => {
    expect(hit('Title\nAttention Is All You Need\nDeep Residual Learning for Image Recognition'))
      .toEqual(['residual', 'resnet', 'transformer'])
  })

  it('matches a title whose punctuation and case have drifted', () => {
    // the same paper as a reference manager, a bibliography and a person type it
    expect(hit('Title\nattention is all you need.')).toEqual(['transformer'])
    expect(hit('Title\nBERT:  Pre-training of Deep Bidirectional Transformers for Language Understanding'))
      .toEqual(['bert'])
  })

  it('takes a one-column list of arXiv ids', () => {
    expect(hit('arXiv\n1706.03762\n1512.03385v1')).toEqual(['residual', 'resnet', 'transformer'])
  })

  it('takes a one-column list of DOIs', () => {
    expect(hit('DOI\n10.1038/323533a0\n10.1162/neco.1997.9.8.1735')).toEqual(['lstm', 'mlp'])
  })

  it('still takes a list of model names', () => {
    expect(hit('Model\nTransformer\nResNet\nLSTM')).toEqual(['lstm', 'resnet', 'transformer'])
  })

  it('reads a file with no header at all', () => {
    // nothing in the first row names a column we know, so it is data
    expect(hit('1706.03762\n10.1038/323533a0')).toEqual(['mlp', 'transformer'])
  })

  it('finds an identifier in a column it does not recognise', () => {
    const csv = 'Ref,Notes\nsomething,https://arxiv.org/abs/1706.03762'
    expect(hit(csv)).toEqual(['transformer'])
  })

  it('handles a semicolon-delimited European export', () => {
    expect(hit('Title;Year\nAttention Is All You Need;2017')).toEqual(['transformer'])
  })

  it('names an unplaced row by its title, not by an internal key', () => {
    // Zotero leads with a "Key" column; reporting that back tells nobody anything
    const csv = [
      'Key,Item Type,Title,DOI',
      'ABCD1234,journalArticle,A Paper This Tree Has Never Heard Of,10.9999/nope',
    ].join('\n')
    const r = PaperCsv.parse(csv, ix)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ignored).toEqual(['A Paper This Tree Has Never Heard Of'])
  })

  it('reports rows it could not place instead of failing', () => {
    const r = PaperCsv.parse('Title\nAttention Is All You Need\nSome Paper Not In The Tree', ix)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.count).toBe(1)
    expect(r.rows).toBe(2)
    expect(r.ignored).toEqual(['Some Paper Not In The Tree'])
  })

  it('rejects only a genuinely empty file', () => {
    expect(PaperCsv.parse('', ix).ok).toBe(false)
    expect(PaperCsv.parse('   \n\n', ix).ok).toBe(false)
  })

  it('accepts a header with no rows as a list of nothing', () => {
    // in Replace mode this is how a reader empties their log — an error would
    // make that impossible
    const r = PaperCsv.parse('Model,Field,Paper,DOI,arXiv,Task,Year\n', ix)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.count).toBe(0)
    expect(r.rows).toBe(0)
    expect(r.ignored).toEqual([])
  })
})

describe('one paper, two nodes', () => {
  // A technique node and the model that introduced it share a paper. Reading
  // it does mean both have been read, so both are ticked — deliberately.
  it('ticks both nodes that share the ResNet paper', () => {
    expect(hit('arXiv\n1512.03385')).toEqual(['residual', 'resnet'])
  })

  it('ticks both nodes that share the Bahdanau paper', () => {
    expect(hit('Title\nNeural Machine Translation by Jointly Learning to Align and Translate'))
      .toEqual(['attnmech', 'bahdanau'])
  })
})

describe('export round-trip', () => {
  it('re-imports its own output exactly', () => {
    const read: Record<string, 1> = {}
    graph.nodes.forEach((n) => { read[n.id] = 1 })
    const csv = PaperCsv.serialize(graph.nodes, read, papers)
    const back = PaperCsv.parse(csv, ix)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.ignored).toEqual([])
    expect(Object.keys(back.matched).sort()).toEqual(Object.keys(read).sort())
  })

  it('writes the identifiers, so a re-import does not rely on names', () => {
    const csv = PaperCsv.serialize(graph.nodes, { transformer: 1 }, papers)
    expect(csv).toContain('1706.03762')
    expect(csv.split('\n')[0].toLowerCase()).toContain('doi')
  })

  it('exports an empty list as a header-only file', () => {
    const csv = PaperCsv.serialize(graph.nodes, {}, papers)
    expect(csv.trim().split('\n')).toHaveLength(1)
  })
})
