// ── Reading-list export ───────────────────────────────────────────────────
// Hands the reader their own list back as a file, in the schema the importer
// accepts, so it can move between browsers and machines.

import { PaperCsv } from '../data/csv'
import type { ReadMap } from '../data/readingLog'
import type { NodeModel } from '../layout'

export function exportReadingCsv(nodes: NodeModel[], read: ReadMap): void {
  const blob = new Blob([PaperCsv.serialize(nodes, read)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'deep-learning-genealogy-reading.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 6000)
}
