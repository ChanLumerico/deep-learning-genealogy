// The detail essays are authored by hand in JSON, so the failure modes are
// typos: an id that matches no node, an edge written in the wrong direction, a
// formula with an unbalanced brace. None of those show up until someone opens
// that exact panel, which is precisely the kind of thing a test should catch.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { LANES } from '../src/layout'
import { blocks, mathIn } from '../src/view/prose'
import { loadGraphData } from './snapshot'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DETAIL = join(ROOT, 'public', 'data', 'detail')

const { nodes, edges } = loadGraphData()
const nodeIds = new Set(nodes.map((n) => n.id))
const laneOf = new Map(nodes.map((n) => [n.id, n.lane]))
const edgeKeys = new Set(edges.map((e) => `${e.f}>${e.t}`))

interface Detail {
  lead: string
  blocks: Array<{ h?: string; b: string }>
  refs?: Array<{ t: string; y?: number; url?: string }>
}

function read(kind: 'nodes' | 'edges'): Array<[string, string, Detail]> {
  const dir = join(DETAIL, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((file) => {
    const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, Detail>
    return Object.entries(parsed).map(([key, d]) => [file, key, d] as [string, string, Detail])
  })
}

const nodeDetail = read('nodes')
const edgeDetail = read('edges')
const all = [...nodeDetail, ...edgeDetail]

describe('detail files line up with the graph', () => {
  it('is filed under a lane the app will actually look in', () => {
    const known = new Set(LANES.map((L) => `${L.id}.json`))
    for (const [file] of all) expect(known).toContain(file)
  })

  it('names only nodes that exist, in the file for their own lane', () => {
    for (const [file, id] of nodeDetail) {
      expect(nodeIds, `unknown node id "${id}" in nodes/${file}`).toContain(id)
      // the loader fetches by the selected node's lane, so a right id in the
      // wrong file is simply never found
      expect(`${laneOf.get(id)}.json`, `node "${id}" is filed in the wrong lane`).toBe(file)
    }
  })

  it('names only edges that exist, in the right direction and lane', () => {
    for (const [file, key] of edgeDetail) {
      expect(key, `edge key "${key}" must be "from>to"`).toMatch(/^[^>]+>[^>]+$/)
      const [from, to] = key.split('>')
      expect(
        edgeKeys,
        `no edge ${from} → ${to} (is it written backwards?)`,
      ).toContain(key)
      expect(`${laneOf.get(from)}.json`, `edge "${key}" is filed in the wrong lane`).toBe(file)
    }
  })
})

describe('every essay is well formed', () => {
  it('has a lead and at least one block', () => {
    for (const [file, key, d] of all) {
      expect(d.lead?.trim(), `${file}:${key} has no lead`).toBeTruthy()
      expect(d.blocks?.length, `${file}:${key} has no blocks`).toBeGreaterThan(0)
      for (const b of d.blocks) expect(b.b?.trim(), `${file}:${key} has an empty block`).toBeTruthy()
    }
  })

  it('parses into renderable blocks', () => {
    for (const [file, key, d] of all) {
      for (const body of [d.lead, ...d.blocks.map((b) => b.b)]) {
        expect(blocks(body).length, `${file}:${key} produced no output`).toBeGreaterThan(0)
      }
    }
  })

  it('contains no unbalanced maths delimiter', () => {
    for (const [file, key, d] of all) {
      for (const body of [d.lead, ...d.blocks.map((b) => b.b)]) {
        // strip escaped dollars, then $ must pair up
        const count = (body.split('\\$').join('').match(/\$/g) || []).length
        expect(count % 2, `${file}:${key} has an odd number of $ delimiters`).toBe(0)
      }
    }
  })

  it('renders every formula through KaTeX without error', () => {
    for (const [file, key, d] of all) {
      for (const body of [d.lead, ...d.blocks.map((b) => b.b)]) {
        for (const tex of mathIn(body)) {
          expect(
            () => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }),
            `${file}:${key} — KaTeX cannot render: ${tex}`,
          ).not.toThrow()
        }
      }
    }
  })

  it('gives every reference a title, and a plausible url if it has one', () => {
    for (const [file, key, d] of all) {
      for (const r of d.refs ?? []) {
        expect(r.t?.trim(), `${file}:${key} has a reference with no title`).toBeTruthy()
        if (r.url) expect(r.url, `${file}:${key} bad url`).toMatch(/^https:\/\//)
      }
    }
  })
})
