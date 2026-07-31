// Regenerates the golden master — BOTH halves of it.
//
//   test/golden/graph.json   the frozen input, taken from public/data
//   test/golden/layout.json  the legacy engine's output for exactly that input
//
// The two are written together so they cannot drift apart. Pinning the input is what
// lets the comparison in test/layout.test.ts mean one thing — the port still
// reproduces the legacy engine — rather than also asserting that nobody has added a
// model since.
//
// Run this ONLY when the legacy app is the thing that changed. The whole point of the
// golden master is that the port has to match it, so regenerating to make a failing
// test pass would defeat the exercise. A new model or lineage is checked by the live
// invariants in the same test file and must not come through here.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildLegacyLayout, layoutFields, loadGraphData } from './legacy-engine.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GRAPH_OUT = join(ROOT, 'test', 'golden', 'graph.json')
const LAYOUT_OUT = join(ROOT, 'test', 'golden', 'layout.json')

const ABOUT = [
  'Frozen input for the golden master. NOT a copy of public/data, and not to be',
  'kept in sync with it.',
  '',
  "test/golden/layout.json is the ORIGINAL engine's output for exactly these",
  'records. Pinning the input is what lets that comparison mean one thing: the',
  'port still reproduces the legacy engine. Reading live data instead would make',
  'the same test fail whenever a model or a lineage is added, which is a fact',
  'about the graph and not about the port.',
  '',
  "Only the fields the layout engine consumes are kept - placement needs a node's",
  "year, lane, track and size tier; routing needs an edge's endpoints, kind and",
  'spine flag. Everything else in NodeSpec and EdgeSpec is display data. That this',
  'subset is sufficient is not asserted but demonstrated: building from this file',
  'reproduces layout.json byte for byte, so a field that started to matter would',
  'break the test immediately.',
  '',
  'Regenerate with `npm run golden`, which needs a local legacy/ and is legitimate',
  'only when the legacy app itself changed.',
]

/** One record per line, matching the style of the files under public/data. */
function formatGraph({ nodes, edges }) {
  const body = [
    '{',
    '"_about": [',
    ABOUT.map((l) => JSON.stringify(l)).join(',\n'),
    '],',
    '"nodes": [',
    nodes.map((n) => JSON.stringify(n)).join(',\n'),
    '],',
    '"edges": [',
    edges.map((e) => JSON.stringify(e)).join(',\n'),
    ']',
    '}',
  ].join('\n') + '\n'
  JSON.parse(body) // fail loudly rather than writing something unparseable
  return body
}

const input = layoutFields(loadGraphData())
const snap = buildLegacyLayout(input)

mkdirSync(dirname(LAYOUT_OUT), { recursive: true })
writeFileSync(GRAPH_OUT, formatGraph(input))
writeFileSync(LAYOUT_OUT, JSON.stringify(snap, null, 2) + '\n')

console.log(`golden master written: ${snap.meta.nodes} nodes, ${snap.meta.edges} edges`)
console.log(`  routes     ${JSON.stringify(snap.routerStats.byStrategy)}`)
console.log(`  fallbacks  ${snap.audit.fallbacks}`)
console.log(`  audit      overlaps=${snap.audit.nodeOverlap.length}` +
  ` through-node=${snap.audit.edgeThroughNode.length}` +
  ` tight=${snap.audit.tightChannels}` +
  ` worstTightExtent=${snap.audit.worstTightExtent}`)
console.log(`  -> ${GRAPH_OUT}`)
console.log(`  -> ${LAYOUT_OUT}`)
