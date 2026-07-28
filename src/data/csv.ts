import type { NodeModel } from '../layout'
import { CSV_ALIASES, CSV_HEADER } from './papers'

export type CsvIndex = Record<string, string>

export type CsvResult =
  | { ok: false; error: string }
  | { ok: true; matched: Record<string, 1>; ignored: string[]; rows: number; count: number }

/** Reads only the schema the reading log uses: Model,Field,Paper,Task,Year */
export class PaperCsv {
  static norm(v: unknown): string {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  static index(nodes: NodeModel[]): CsvIndex {
    const map: CsvIndex = {}
    nodes.forEach((n) => {
      map[PaperCsv.norm(n.name)] = n.id
      map[PaperCsv.norm(n.id)] = n.id
      String(n.name).split(/[/·]/).forEach((part) => {
        const k = PaperCsv.norm(part)
        if (k && !map[k]) map[k] = n.id
      })
    })
    const known: Record<string, 1> = {}
    nodes.forEach((n) => { known[n.id] = 1 })
    Object.keys(CSV_ALIASES).forEach((k) => {
      // never resolve to a missing node
      if (known[CSV_ALIASES[k]]) map[k] = CSV_ALIASES[k]
    })
    return map
  }

  static splitRow(line: string): string[] {
    const out: string[] = []
    let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
        continue
      }
      if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }

  static parse(text: string, index: CsvIndex): CsvResult {
    const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length)
    if (!lines.length) return { ok: false, error: 'The file is empty.' }
    const head = PaperCsv.splitRow(lines[0]).map((h) => h.toLowerCase())
    const shapeOk = CSV_HEADER.every((h, i) => head[i] === h)
    if (!shapeOk) return { ok: false, error: 'Header must be Model,Field,Paper,Task,Year.' }
    const matched: Record<string, 1> = {}
    const ignored: string[] = []
    lines.slice(1).forEach((line) => {
      const cells = PaperCsv.splitRow(line)
      const model = cells[0]
      if (!model) return
      const id = index[PaperCsv.norm(model)]
      if (id) matched[id] = 1
      else ignored.push(model)
    })
    return {
      ok: true, matched, ignored,
      rows: lines.length - 1, count: Object.keys(matched).length,
    }
  }
}
