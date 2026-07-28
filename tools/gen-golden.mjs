// Regenerates test/golden/layout.json from the legacy engine.
//
// Run this ONLY when the legacy app is the thing that changed. The whole point of the
// golden master is that the port has to match it, so regenerating to make a failing
// test pass would defeat the exercise.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildLegacyLayout } from './legacy-engine.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test', 'golden', 'layout.json')

const snap = buildLegacyLayout()
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(snap, null, 2) + '\n')

console.log(`golden master written: ${snap.meta.nodes} nodes, ${snap.meta.edges} edges`)
console.log(`  routes     ${JSON.stringify(snap.routerStats.byStrategy)}`)
console.log(`  fallbacks  ${snap.audit.fallbacks}`)
console.log(`  audit      overlaps=${snap.audit.nodeOverlap.length}` +
  ` through-node=${snap.audit.edgeThroughNode.length}` +
  ` tight=${snap.audit.tightChannels}` +
  ` worstTightExtent=${snap.audit.worstTightExtent}`)
console.log(`  -> ${OUT}`)
