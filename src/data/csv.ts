// ── Reading-list import ───────────────────────────────────────────────────
// A visitor's reading list comes out of Zotero, Mendeley, a Notion table or a
// hand-typed file, and no two of those agree on columns. So nothing here
// requires a shape: the parser works out its delimiter, works out which
// columns it recognises, and matches each row on the most specific identifier
// that row happens to carry.
//
//   DOI  →  arXiv ID  →  canonical title  →  model name
//
// A DOI is exact. A title is not — punctuation and capitalisation drift
// between sources, which is why titles are compared with everything but the
// letters and digits stripped out.

import type { NodeModel } from '../layout'
import type { ReadMap } from './readingLog'
import { CSV_ALIASES, CSV_HEADER } from './papers'

/**
 * Node ids keyed by every string that may legitimately name them. The values
 * are lists because one paper can be two nodes: the graph carries a technique
 * node beside the model that introduced it, and they cite the same work.
 */
export interface CsvIndex {
  doi: Record<string, string[]>
  arxiv: Record<string, string[]>
  title: Record<string, string[]>
  name: Record<string, string[]>
}

/** Replace overwrites the whole log; add only ever ticks more boxes. */
export type ImportMode = 'add' | 'replace'

export type CsvResult =
  | { ok: false; error: string }
  | { ok: true; matched: Record<string, 1>; ignored: string[]; rows: number; count: number }

/** what the identifier table (public/data/paper-ids.json) holds per node */
export interface PaperId {
  t: string
  doi?: string
  arxiv?: string
}
export type PaperIds = Record<string, PaperId>

// ── identifier grammars ────────────────────────────────────────────────────

/** `10.` registrant `/` suffix. Trailing sentence punctuation is not part of it. */
const DOI_RE = /\b10\.\d{4,9}\/[^\s"'<>)\],;]+/
/** modern `1706.03762`, optional version, and the pre-2007 `cs/0701001` form */
const ARXIV_RE = /(?:arxiv[\s:/]*(?:abs|pdf)?[\s:/]*)?\b((?:\d{4}\.\d{4,5})|(?:[a-z-]{2,}\/\d{7}))(?:v\d+)?\b/i
/** a bare arXiv id, for a cell that is nothing else */
const BARE_ARXIV = /^(?:arxiv:)?\s*((?:\d{4}\.\d{4,5})|(?:[a-z-]{2,}\/\d{7}))(?:v\d+)?\s*$/i

export const normDoi = (v: string) =>
  (DOI_RE.exec(String(v)) || [''])[0].replace(/[.,;:)\]]+$/, '').toLowerCase()

export function normArxiv(v: string): string {
  const s = String(v)
  const bare = BARE_ARXIV.exec(s)
  if (bare) return bare[1].toLowerCase()
  // only trust a loose match when the string actually says arXiv somewhere,
  // or a year column like "2017.1234" would be read as a paper
  if (!/arxiv/i.test(s)) return ''
  const m = ARXIV_RE.exec(s)
  return m ? m[1].toLowerCase() : ''
}

/**
 * Compare titles on letters and digits alone. Accents are decomposed first, so
 * "Schrödinger" and "Schrodinger" agree; everything else — case, colons,
 * hyphens, curly quotes, trailing full stops — falls away.
 */
export const normText = (v: unknown) =>
  String(v ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

// ── column recognition ─────────────────────────────────────────────────────

const HEADERS: Record<'doi' | 'arxiv' | 'title' | 'name' | 'link', string[]> = {
  doi: ['doi'],
  arxiv: ['arxiv', 'arxivid', 'arxivno', 'eprint', 'eprintid'],
  // NB: Zotero's "Publication Title" is the JOURNAL, not the paper — including
  // it here would match every Nature paper against a node called Nature.
  title: ['title', 'paper', 'papertitle', 'articletitle', 'documenttitle'],
  name: ['model', 'modelname', 'architecture', 'method'],
  link: ['url', 'link', 'extra', 'note', 'notes'],
}

const headerKey = (h: string) => normText(h)

export class PaperCsv {
  /** kept for callers that only need the loose comparison */
  static norm(v: unknown): string {
    return normText(v)
  }

  // ── tokenising ───────────────────────────────────────────────────────────

  /**
   * Split a whole file into rows of cells. Written as one scan rather than
   * split-by-line because a quoted field may contain the delimiter, a newline,
   * or both — Zotero puts abstracts in one, so line-splitting first corrupts
   * every export it produces.
   */
  static rows(text: string, delim = ','): string[][] {
    const src = String(text).replace(/^\uFEFF/, '')   // Excel writes a BOM
    const out: string[][] = []
    let row: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < src.length; i++) {
      const ch = src[i]
      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i++ } else quoted = false
        } else cur += ch
        continue
      }
      if (ch === '"') { quoted = true; continue }
      if (ch === delim) { row.push(cur.trim()); cur = ''; continue }
      if (ch === '\r') continue
      if (ch === '\n') { row.push(cur.trim()); out.push(row); row = []; cur = ''; continue }
      cur += ch
    }
    row.push(cur.trim())
    out.push(row)
    return out.filter((r) => r.some((c) => c !== ''))
  }

  /** Whichever of , ; or tab appears most on the first line, outside quotes. */
  static delimiter(text: string): string {
    const first = String(text).replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? ''
    let quoted = false
    const n = { ',': 0, ';': 0, '\t': 0 }
    for (const ch of first) {
      if (ch === '"') { quoted = !quoted; continue }
      if (!quoted && (ch === ',' || ch === ';' || ch === '\t')) n[ch]++
    }
    if (n[';'] > n[','] && n[';'] >= n['\t']) return ';'
    if (n['\t'] > n[','] && n['\t'] > n[';']) return '\t'
    return ','
  }

  /** Retained for the round-trip test and for callers splitting one line. */
  static splitRow(line: string): string[] {
    return PaperCsv.rows(line)[0] ?? ['']
  }

  // ── the lookup ───────────────────────────────────────────────────────────

  static index(nodes: NodeModel[], papers: PaperIds = {}): CsvIndex {
    const ix: CsvIndex = { doi: {}, arxiv: {}, title: {}, name: {} }
    const known: Record<string, 1> = {}
    nodes.forEach((n) => { known[n.id] = 1 })

    const add = (bag: Record<string, string[]>, key: string, id: string) => {
      if (!key) return
      const at = (bag[key] ??= [])
      if (!at.includes(id)) at.push(id)
    }

    nodes.forEach((n) => {
      add(ix.name, normText(n.name), n.id)
      add(ix.name, normText(n.id), n.id)
      // "MLP + Backprop" should also answer to "MLP"
      String(n.name).split(/[/·+]/).forEach((part) => add(ix.name, normText(part), n.id))
      // the title carried on the node itself, where there is one
      if (n.paper) add(ix.title, normText(n.paper), n.id)
    })

    Object.keys(CSV_ALIASES).forEach((k) => {
      if (known[CSV_ALIASES[k]]) add(ix.name, normText(k), CSV_ALIASES[k])
    })

    Object.entries(papers).forEach(([id, rec]) => {
      if (!known[id]) return
      if (rec.doi) add(ix.doi, rec.doi.toLowerCase(), id)
      if (rec.arxiv) add(ix.arxiv, rec.arxiv.toLowerCase(), id)
      if (rec.t) add(ix.title, normText(rec.t), id)
    })
    return ix
  }

  // ── matching ─────────────────────────────────────────────────────────────

  /**
   * Resolve one row. Columns are consulted first; failing that every cell is
   * swept for a DOI or an arXiv id, which is what rescues an export whose
   * column names mean nothing to us.
   */
  private static resolve(
    cells: string[], cols: Partial<Record<keyof typeof HEADERS, number>>, ix: CsvIndex,
  ): string[] | null {
    const at = (k: keyof typeof HEADERS) => {
      const i = cols[k]
      return i === undefined ? '' : (cells[i] ?? '')
    }

    const doi = normDoi(at('doi')) || normDoi(at('link'))
    if (doi && ix.doi[doi]) return ix.doi[doi]

    const arx = normArxiv(at('arxiv')) || normArxiv(at('link'))
    if (arx && ix.arxiv[arx]) return ix.arxiv[arx]

    const title = normText(at('title'))
    if (title && ix.title[title]) return ix.title[title]

    const name = normText(at('name'))
    if (name && ix.name[name]) return ix.name[name]

    // nothing recognised by column — sweep the row
    for (const cell of cells) {
      const d = normDoi(cell)
      if (d && ix.doi[d]) return ix.doi[d]
      const a = normArxiv(cell)
      if (a && ix.arxiv[a]) return ix.arxiv[a]
    }
    for (const cell of cells) {
      const k = normText(cell)
      if (!k) continue
      if (ix.title[k]) return ix.title[k]
      if (ix.name[k]) return ix.name[k]
    }
    return null
  }

  static parse(text: string, ix: CsvIndex): CsvResult {
    const rows = PaperCsv.rows(text, PaperCsv.delimiter(text))
    if (!rows.length) return { ok: false, error: 'The file is empty.' }

    const head = rows[0].map(headerKey)
    const cols: Partial<Record<keyof typeof HEADERS, number>> = {}
    ;(Object.keys(HEADERS) as Array<keyof typeof HEADERS>).forEach((k) => {
      const i = head.findIndex((h) => HEADERS[k].includes(h))
      if (i >= 0) cols[k] = i
    })

    // A file whose first row names no column we know is a file with no header:
    // read it from the top rather than throwing its first entry away.
    const hasHeader = Object.keys(cols).length > 0
    const body = hasHeader ? rows.slice(1) : rows

    const matched: Record<string, 1> = {}
    const ignored: string[] = []
    body.forEach((cells) => {
      const ids = PaperCsv.resolve(cells, cols, ix)
      if (ids) { ids.forEach((id) => { matched[id] = 1 }); return }
      // Name it by something the reader recognises. The first non-empty cell
      // is often an internal key — Zotero leads with one — so prefer the
      // columns that hold a human-readable name.
      const label = [cols.title, cols.name]
        .map((i) => (i === undefined ? '' : cells[i] ?? ''))
        .find((v) => v) ?? cells.find((c) => c) ?? ''
      if (label) ignored.push(label.length > 48 ? label.slice(0, 46) + '…' : label)
    })

    // A header with nothing under it is a list of nothing, which is a real
    // thing to import — in Replace mode it is how a reader empties the log.
    return {
      ok: true, matched, ignored,
      rows: body.length, count: Object.keys(matched).length,
    }
  }

  // ── export ───────────────────────────────────────────────────────────────

  static cell(v: unknown): string {
    const s = String(v ?? '')
    return /[",;\t\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  /**
   * Every model currently marked read. The columns carry a DOI and an arXiv id
   * where one is known, so a list exported here re-imports exactly rather than
   * by name — and is legible to a reference manager on the way.
   */
  static serialize(nodes: NodeModel[], read: ReadMap, papers: PaperIds = {}): string {
    const rows = nodes
      .filter((n) => read[n.id])
      .sort((a, b) => (a.year - b.year) || a.name.localeCompare(b.name))
      .map((n) => {
        const p = papers[n.id]
        return [n.name, n.lane.label, p?.t || n.paper || '', p?.doi || '', p?.arxiv || '',
          n.contribution, n.year].map(PaperCsv.cell).join(',')
      })
    return [CSV_HEADER.join(','), ...rows].join('\n') + '\n'
  }
}
