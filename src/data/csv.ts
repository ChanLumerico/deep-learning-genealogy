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
  | {
    ok: true
    matched: Record<string, 1>
    ignored: string[]
    /** data rows read, header excluded */
    rows: number
    /** rows that resolved to at least one model */
    matchedRows: number
    /** models ticked — more than `matchedRows` when two nodes share a paper */
    count: number
  }

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

// ── loose comparison ───────────────────────────────────────────────────────
// Exact matching on the normalised string is right when a title arrives clean,
// and useless the moment anything is wrapped around it. A reading list keeps
// "[2012] ImageNet Classification…", "Attention Is All You Need (NeurIPS)", or
// the part before the colon — and against exact matching alone those score
// zero, not nearly-zero. So there is a second pass, and it runs only after
// every exact identifier in the row has been tried and missed.

/** Peel off what people put around a title: numbering, venue, trailing ids. */
export function undecorate(raw: string): string {
  let s = String(raw ?? '').trim()
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
  // leading "[12]", "(3)", "12.", "12)" — a list index, not part of the title
  s = s.replace(/^\s*[[(]\s*[^\])]{0,12}\s*[\])]\s*/, '')
  s = s.replace(/^\s*\d{1,3}\s*[.)]\s+/, '')
  // trailing "(arXiv preprint)", "(ICLR 2020)", ", arXiv:1706.03762", "[cs.LG]"
  s = s.replace(/\s*[[(][^()[\]]{0,40}[\])]\s*$/, '')
  s = s.replace(/[,;.]?\s*(?:arxiv|doi)\s*:\s*\S+\s*$/i, '')
  return s.trim()
}

/**
 * A loose title has to be long enough that containing it means something.
 * "GAN" inside "Generative Adversarial Networks" is a coincidence at three
 * characters and a fact at twenty. Twelve is where the corpus stops producing
 * accidents — it is what lets "DeepSeekMath" find its paper — and it is
 * checked by the precision test rather than assumed.
 */
const MIN_LOOSE = 12

/**
 * "resnet50", "vgg16", "vitb16" — a known name with a *size* after it, which
 * the graph does not model separately.
 *
 * Two digits minimum, and that is the whole difference between a size and a
 * version. "ResNet-50" and "ResNet-101" are the same paper at different
 * depths; "DALL-E 3" and "GPT-4" are different papers from the one the graph
 * holds, and a single trailing digit is what tells them apart. Stripping one
 * digit matched DALL-E 3 against DALL·E, which is a reader credited with
 * something they did not read.
 */
const SIZE_TAIL = /^(?:\d{2,4}|xl|xs|xxl|[bslmt]|[bslmt]\d{1,3}|tiny|small|base|large|huge|nano|mini)$/

/** entries sorted longest-first, so the most specific candidate is tested first */
type Loose = Array<[string, string[]]>
const byLength = (bag: Record<string, string[]>): Loose =>
  Object.entries(bag).sort((a, b) => b[0].length - a[0].length)

/**
 * Titles that the cell plainly contains, or that begin with the whole cell —
 * the second covers a subtitle having been dropped. `hint` is whatever the
 * model column resolved to; when several titles survive it decides between
 * them, which is the one place the two columns are read together rather than
 * one after the other.
 */
function looseTitle(titles: Loose, raw: string, hint: string[] | null,
  exact: Record<string, string[]> = {}): string[] | null {
  const cell = normText(undecorate(raw))
  if (!cell) return null
  // Undecorating may have produced an exact title, and short ones — "Fast
  // R-CNN", "Mask R-CNN" — never reach the containment pass at all.
  if (exact[cell]) return exact[cell]
  if (cell.length < MIN_LOOSE) return null
  const hits = titles.filter(([key]) =>
    key.length >= MIN_LOOSE && (cell.includes(key) || key.startsWith(cell)))
  if (!hits.length) return null
  if (hint) {
    const agreed = hits.find(([, ids]) => ids.some((id) => hint.includes(id)))
    if (agreed) return agreed[1]
  }
  return hits[0][1]   // longest, therefore most specific
}

/** A known model name carrying a size after it, which the graph does not model. */
function looseName(names: Loose, raw: string): string[] | null {
  const cell = normText(raw)
  if (cell.length < 4) return null
  for (const [key, ids] of names) {
    if (key.length < 3 || !cell.startsWith(key)) continue
    if (SIZE_TAIL.test(cell.slice(key.length))) return ids
  }
  return null
}

// ── column recognition ─────────────────────────────────────────────────────

const HEADERS: Record<'doi' | 'arxiv' | 'title' | 'name' | 'link' | 'any', string[]> = {
  doi: ['doi', 'doilink', 'doiurl'],
  arxiv: ['arxiv', 'arxivid', 'arxivno', 'arxivnumber', 'arxivlink', 'arxivurl',
    'eprint', 'eprintid', 'preprint'],
  // NB: Zotero's "Publication Title" is the JOURNAL, not the paper — including
  // it, or a bare "publication", would match every Nature paper against a node
  // called Nature.
  title: ['title', 'paper', 'papertitle', 'papername', 'titleofpaper',
    'articletitle', 'article', 'documenttitle', 'work', 'reference', 'citation',
    '논문', '논문명', '논문제목', '제목', '문헌'],
  name: ['model', 'modelname', 'architecture', 'arch', 'method', 'algorithm',
    'approach', 'network', 'technique', 'system',
    '모델', '모델명', '모형', '기법', '알고리즘'],
  link: ['url', 'link', 'extra', 'note', 'notes', 'comment', 'comments',
    'source', '링크', '메모', '비고'],
  /**
   * Columns that could be either. Notion calls its first column "Name" and
   * fills it with paper titles; a hand-made sheet calls it "Name" and fills it
   * with model names. Rather than guess, these are tried at both stages.
   */
  any: ['name', 'entry', 'item', '이름', '항목'],
}

/**
 * Header names are compared on letters and digits with the separators removed,
 * but unlike `normText` the letters are not restricted to ASCII: a column
 * headed `논문` has to survive, and stripping it to the empty string would
 * make the header row look like data and be imported as one.
 */
const headerKey = (h: string) =>
  String(h ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

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
    loose: { titles: Loose; names: Loose },
  ): string[] | null {
    const at = (k: keyof typeof HEADERS) => {
      const i = cols[k]
      return i === undefined ? '' : (cells[i] ?? '')
    }
    // an ambiguous column is offered to both stages rather than guessed at
    const titleCells = [at('title'), at('any')].filter(Boolean)
    const nameCells = [at('name'), at('any')].filter(Boolean)

    // ── exact, most specific first ─────────────────────────────────────────
    const doi = normDoi(at('doi')) || normDoi(at('link'))
    if (doi && ix.doi[doi]) return ix.doi[doi]

    const arx = normArxiv(at('arxiv')) || normArxiv(at('link'))
    if (arx && ix.arxiv[arx]) return ix.arxiv[arx]

    for (const c of titleCells) {
      const k = normText(c)
      if (k && ix.title[k]) return ix.title[k]
    }
    for (const c of nameCells) {
      const k = normText(c)
      if (k && ix.name[k]) return ix.name[k]
    }

    // nothing recognised by column — sweep the row for an exact identifier
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

    // ── loose, and only now ────────────────────────────────────────────────
    // Every exact identifier in the row has already missed, so a decorated
    // title cannot displace a clean one somewhere else on the same line.
    const hint = nameCells
      .map((c) => looseName(loose.names, c))
      .find((v): v is string[] => !!v) ?? null

    for (const c of titleCells) {
      const hit = looseTitle(loose.titles, c, hint, ix.title)
      if (hit) return hit
    }
    if (hint) return hint
    for (const cell of cells) {
      const hit = looseTitle(loose.titles, cell, null, ix.title)
      if (hit) return hit
    }
    for (const cell of cells) {
      const hit = looseName(loose.names, cell)
      if (hit) return hit
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

    // sorted once per file rather than once per row
    const loose = { titles: byLength(ix.title), names: byLength(ix.name) }

    const matched: Record<string, 1> = {}
    const ignored: string[] = []
    let matchedRows = 0
    body.forEach((cells) => {
      const ids = PaperCsv.resolve(cells, cols, ix, loose)
      if (ids) { matchedRows++; ids.forEach((id) => { matched[id] = 1 }); return }
      // Name it by something the reader recognises. The first non-empty cell
      // is often an internal key — Zotero leads with one — so prefer the
      // columns that hold a human-readable name.
      const label = [cols.title, cols.name, cols.any]
        .map((i) => (i === undefined ? '' : cells[i] ?? ''))
        .find((v) => v) ?? cells.find((c) => c) ?? ''
      if (label) ignored.push(label.length > 48 ? label.slice(0, 46) + '…' : label)
    })

    // A header with nothing under it is a list of nothing, which is a real
    // thing to import — in Replace mode it is how a reader empties the log.
    return {
      ok: true, matched, ignored,
      rows: body.length, matchedRows, count: Object.keys(matched).length,
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
