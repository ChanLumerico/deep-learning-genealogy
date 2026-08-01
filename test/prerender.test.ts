// The static pages exist so a search engine can see the essays at all. They
// are generated, so what matters is that the generator still covers every
// entry and that a page carries what makes it indexable — a crawler that
// finds an empty shell is no better off than before.

import { describe, expect, it } from 'vitest'
import { loadGraphData } from './snapshot'

// The generator writes into dist/, so running it here would need a build.
// Instead the shape is checked against the data it reads: if these two agree,
// `npm run build` emits one page per entry.
const { nodes, edges } = loadGraphData()

describe('what the prerender has to cover', () => {
  it('has a page to emit for every model and every lineage', () => {
    // Derived, not frozen: the graph is meant to grow, and an equality here
    // would fail every time a model is added — which is the mistake rule 1
    // in CLAUDE.md exists to prevent elsewhere.
    const real = edges.filter((e) => nodes.some((n) => n.id === e.f)
      && nodes.some((n) => n.id === e.t))
    expect(nodes.length).toBeGreaterThanOrEqual(189)
    // an edge with a missing endpoint would silently emit no page
    expect(real.length).toBe(edges.length)
  })

  it('gives every page a url that needs no escaping', () => {
    // the paths go straight into sitemap.xml and into href attributes
    for (const n of nodes) expect(n.id, n.id).toMatch(/^[a-z0-9]+$/)
    for (const e of edges) {
      expect(e.f).toMatch(/^[a-z0-9]+$/)
      expect(e.t).toMatch(/^[a-z0-9]+$/)
    }
  })
})
