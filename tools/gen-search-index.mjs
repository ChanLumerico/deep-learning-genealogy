// Builds public/data/search-index.json.
//
// The essays run to 213,000 words and the search box could only match a model
// name, so none of it was findable. This inverts the text: token → the entries
// that contain it, plus enough per entry to render a result without fetching
// anything else.
//
// An inverted index rather than the text itself, because the text is 434 kB
// gzipped against 170 kB for this, and a search index has no business being
// the largest asset on the site. The cost is that results show each entry's
// opening line rather than the sentence the match is in.
//
// Run after adding or editing an essay:
//   node tools/gen-search-index.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')

/** words too common to narrow anything down; keeping them triples the index */
const STOP = new Set((
  'the a an and or of to in is it its that this for with as by on at from are '
  + 'was were be been being has have had not but which what when where how why '
  + 'can could would should will may might do does did so than then there their '
  + 'they them we you if all any some more most other into over under out up '
  + 'down only just also such no nor own same too very one two both each such '
  + 'about after before because between during through while these those'
).split(' '))

/** strip the prose markup so maths and emphasis do not become tokens */
export const plain = (s) => String(s)
  .replace(/\$\$[\s\S]*?\$\$/g, ' ')
  .replace(/\$[^$]*\$/g, ' ')
  .replace(/[*`]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const tokens = (s) => plain(s)
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((t) => t.length > 2 && !STOP.has(t))

export function build() {
  const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'))
  const nodes = manifest.nodes.flatMap((f) =>
    JSON.parse(readFileSync(join(ROOT, 'public', f.path), 'utf8')))
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  const entries = []
  const push = (kind, lane, key, title, subtitle, text) =>
    entries.push({ kind, lane, key, title, subtitle, text })

  for (const kind of ['nodes', 'edges']) {
    for (const file of readdirSync(join(DATA, 'detail', kind)).sort()) {
      if (!file.endsWith('.json')) continue
      const lane = file.replace('.json', '')
      const parsed = JSON.parse(readFileSync(join(DATA, 'detail', kind, file), 'utf8'))
      for (const [key, d] of Object.entries(parsed)) {
        const body = [d.lead, ...d.blocks.map((b) => `${b.h ?? ''} ${b.b}`)].join(' ')
        if (kind === 'nodes') {
          const n = byId[key]
          if (!n) continue
          // the short fields belong in the index too: someone searching a
          // phrase from a node's one-line summary should find it
          const short = [n.n, n.org, n.c, n.p, n.i, n.l].filter(Boolean).join(' ')
          push('node', lane, key, n.n, `${n.org} · ${n.y}`, `${short} ${body}`)
        } else {
          const [from, to] = key.split('>')
          const a = byId[from]
          const b = byId[to]
          if (!a || !b) continue
          push('edge', lane, key, `${a.n} → ${b.n}`, `${a.y} → ${b.y}`, body)
        }
      }
    }
  }

  // token → the entries that contain it, as indices into `e`
  const postings = {}
  entries.forEach((e, i) => {
    const seen = new Set()
    for (const t of tokens(e.text)) {
      if (seen.has(t)) continue
      seen.add(t)
      ;(postings[t] ??= []).push(i)
    }
  })

  return {
    // `p` for preview: the opening of the entry, shown under a result
    e: entries.map((e) => ({
      k: e.kind === 'node' ? 'n' : 'e',
      l: e.lane,
      i: e.key,
      t: e.title,
      s: e.subtitle,
      p: plain(e.text).slice(0, 190),
    })),
    t: postings,
  }
}

const index = build()
const out = join(DATA, 'search-index.json')
writeFileSync(out, JSON.stringify(index) + '\n')

const bytes = readFileSync(out).length
console.log(`search-index.json: ${index.e.length} entries, ` +
  `${Object.keys(index.t).length} tokens, ${(bytes / 1024).toFixed(0)} kB`)
