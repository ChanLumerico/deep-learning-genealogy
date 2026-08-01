// Builds public/data/paper-ids.json — the table the CSV importer matches against.
//
// Each node's canonical paper is the FIRST reference of its detail essay. That
// is a convention rather than a schema, so this tool checks it: two nodes
// resolving to the same paper is reported, and there are exactly two legitimate
// cases (a technique node and a model node that share one paper).
//
// Run after adding a model, or after editing an essay's refs:
//   node tools/gen-paper-ids.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')

/** `1706.03762`, `1706.03762v5`, `cs/0701001` — version stripped, lowercased */
const ARXIV = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}|[a-z-]+\/[0-9]{7})/i
/** a DOI is `10.` + registrant + `/` + suffix; trailing punctuation is not part of it */
const DOI = /\b(10\.\d{4,9}\/[^\s"'<>)\]]+)/

const clean = (s) => s.replace(/[.,;:)\]]+$/, '')

const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'))
const nodes = manifest.nodes.flatMap((f) =>
  JSON.parse(readFileSync(join(ROOT, 'public', f.path), 'utf8')))

const detail = {}
for (const file of readdirSync(join(DATA, 'detail', 'nodes'))) {
  if (!file.endsWith('.json')) continue
  Object.assign(detail, JSON.parse(readFileSync(join(DATA, 'detail', 'nodes', file), 'utf8')))
}

const out = {}
let arxiv = 0, doi = 0, bare = 0, missing = 0
for (const n of nodes) {
  const ref = (detail[n.id]?.refs ?? [])[0]
  if (!ref?.t) { missing++; continue }
  const rec = { t: ref.t }
  const url = ref.url ?? ''
  const a = ARXIV.exec(url)
  const d = DOI.exec(url)
  if (a) { rec.arxiv = a[1].toLowerCase(); arxiv++ }
  else if (d) { rec.doi = clean(d[1]).toLowerCase(); doi++ }
  else bare++
  out[n.id] = rec
}

// A shared paper is legitimate — a technique and the model that introduced it —
// but a NEW one means an essay's refs are wrong, so surface every case.
const byTitle = {}
const norm = (s) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
for (const [id, r] of Object.entries(out)) (byTitle[norm(r.t)] ??= []).push(id)
const shared = Object.values(byTitle).filter((v) => v.length > 1)

writeFileSync(join(DATA, 'paper-ids.json'), JSON.stringify(out, null, 1) + '\n')

console.log(`paper-ids.json: ${Object.keys(out).length} of ${nodes.length} nodes`)
console.log(`  arXiv ${arxiv} · DOI ${doi} · title only ${bare}` +
  (missing ? ` · NO REFERENCE ${missing}` : ''))
console.log(`  papers shared by two nodes: ${shared.length}`)
shared.forEach((ids) => console.log(`    ${ids.join(' + ')} — ${out[ids[0]].t}`))
