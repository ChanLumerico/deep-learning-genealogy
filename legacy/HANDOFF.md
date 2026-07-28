# Deep Learning Model Genealogy — handoff

An interactive phylogenetic tree of 189 deep-learning models across 6 domains,
248 typed relationships, with orthogonal edge routing computed at load time.

## Run it

Any static server from the project root (data files are fetched, so `file://` will not work):

    python3 -m http.server 8000
    # → http://localhost:8000/Deep%20Learning%20Genealogy.dc.html

## Files

    Deep Learning Genealogy.dc.html   the whole app: spec tables, layout engine, render
    support.js                        component runtime (do not edit)
    data/                             graph source of truth — see data/README.md
    _ds/classical-…/                  design system tokens + bundle

## Architecture inside the .dc.html

Read top to bottom; each section has a banner comment.

1. **Spec tables** — `LANES`, `NODE_SIZES`, `EDGE_KINDS`, `ARROW_HEADS`, `ROUTING`, `TIME`.
   The only tuning surface: lane colors/tracks, node tiers, edge weights/dashes,
   routing clearances and the gap-relaxation ladder.
2. **Models** — `NodeModel`, `EdgeModel`: immutable records + derived geometry/metrics.
3. **Layout pipeline** — `LayoutEngine.build()`:
   instantiate → `_place` (year → x, track → y, collision push) → `_link` →
   `ObstacleField` + `ChannelMap` → `PortAllocator` (fan-out ports so siblings
   never share a coordinate) → `Router` with strategy chain
   (`ForwardRoute` → `BusRoute` → `FallbackRoute`, each retried down a gap ladder) →
   `CornerRadii` (concentric arcs, auto-shrunk at tight corners) →
   `Shape.ortho` (path string, 45° chamfers) → `LayoutAudit`.
4. **Audit** — `LayoutAudit.run` logs to console: node overlaps, edges crossing a
   node body, parallel runs tighter than the minimum. Keep these at zero when
   adding data; `worstTightExtent` tells you how long the tightest run is.
5. **Style resolvers** — `NodeStyle.resolve(node, viewState)` /
   `EdgeStyle.resolve(edge, viewState)` return fill/stroke/width/dash/opacity/marker.
   No color literals live in the render code; change appearance here.
6. **Component** — state (camera, filters, selection, reading log), CSV import
   (`PaperCsv`), localStorage reading log (`ReadingLog`), PNG export, and
   `renderVals()` which maps the built graph into the template's holes.

## Editing the graph

Data only, no code: see `data/README.md`. Adding a model is one line in
`data/nodes/<domain>.json`; adding a lineage is one line in
`data/edges/relations.json`. Unknown edge endpoints are skipped, never fatal.

## If you port this to a framework

The layout engine is plain ES5-ish JavaScript with no DOM dependencies except
`Shape`/style resolvers returning strings — lift sections 1–5 into a module
(`layout.js`) untouched, and re-implement only the component and the SVG
template in your framework. The template is inline-styled SVG + a top bar;
tokens come from the Classical design system stylesheet under `_ds/`.
