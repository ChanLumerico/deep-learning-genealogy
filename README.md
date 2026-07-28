# Deep Learning Model Genealogy

An interactive phylogeny of deep-learning architectures: **189 models** and **248 typed
relationships** from the 1957 perceptron to 2025, laid out across six research-domain
lanes with every edge orthogonally routed at load time.

The point is not *when* something appeared but **what limitation of its predecessor it
solved**. So every model carries `problem / idea / limitation`, and every relationship is
labelled in `limit → fix` form.

**→ [chanlumerico.github.io/deep-learning-genealogy](https://chanlumerico.github.io/deep-learning-genealogy/)**

```bash
npm install
npm run dev      # http://localhost:5173
```

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + production bundle into `dist/` |
| `npm test` | golden-master + invariant tests |
| `npm run typecheck` | types only |
| `npm run golden` | regenerate the golden master — needs a local `legacy/`, see below |

## Layout

```
src/
  layout/        the engine — pure geometry, no DOM, no React
    spec.ts        LANES, NODE_SIZES, EDGE_KINDS, ARROW_HEADS, ROUTING, TIME  ← tuning surface
    models.ts      NodeModel / EdgeModel: immutable record + derived geometry
    obstacles.ts   ObstacleField (node clearance) + ChannelMap (parallel-run spacing)
    ports.ts       PortAllocator — fans sibling edges so none share a coordinate
    routes.ts      ForwardRoute → BusRoute → FallbackRoute, each retried down a gap ladder
    corners.ts     CornerRadii — concentric arcs, auto-shrunk at tight corners
    shape.ts       Shape.ortho → SVG path with 45° chamfers
    engine.ts      LayoutEngine.build(): place → link → ports → route → radii → paths → audit
    audit.ts       the invariants, checked on every build
    styles.ts      NodeStyle / EdgeStyle: (model + view state) → paint
  components/    the SVG sheet and the UI chrome
  data/          loader, reading log, CSV import
  export/        PNG export
public/data/     the graph — the only place to edit models and lineages
test/            golden-master comparison
tools/           golden-master generator, legacy engine loader, parity checker
```

`legacy/` — the original single-file app — is **not in the repository**. It is
gitignored and kept only on the machine that did the port. `npm test` does not need
it; `npm run golden` and `tools/parity-check.mjs` do.

## Editing the graph

Data only, no code. Adding a model is one line in `public/data/nodes/<domain>.json`;
adding a lineage is one line in `public/data/edges/relations.json`. Unknown edge
endpoints are skipped, never fatal. See `public/data/README.md` and `schema.json`.

After a data change, run `npm test` — the audit numbers are asserted, so a change that
makes the sheet messier fails the build.

## How the port is verified

This is a rewrite of a single-file app (`legacy/Deep Learning Genealogy.dc.html`, 1788
lines on a bespoke component runtime). The layout engine was *ported*, not reimplemented,
and the port is held to the original by two mechanical checks.

**1. Golden master (`npm test`).** The original engine has no DOM dependencies, so
`tools/legacy-engine.mjs` lifts its source text straight out of the legacy HTML and
executes it under Node — nothing is transcribed by hand. `test/golden/layout.json` is
that engine's output; the port must reproduce it exactly: every node coordinate, every
port and face assignment, every route point, every corner radius, every SVG path string,
the routing-strategy mix, and the audit report.

The generated file is committed, so the test runs anywhere. Regenerating it needs a
local `legacy/`, and **regenerating it to make a failing test pass defeats the entire
point** — a failure means the port drifted. Regenerate only if the legacy app itself
changed.

**2. Rendered-DOM parity (`tools/parity-check.mjs`).** Loads both apps in a browser and
compares the drawn SVG element by element. Last run: **1855 / 1855 drawables identical**.

### The one deliberate deviation

The legacy app never applies its own initial camera centering — `vpRef.current` is null
when its `componentDidMount` runs, so both centering paths are skipped and the sheet
opens at `translate(0,0)`, in the top-left corner. The port implements what that code
intends and opens centered. This is the only difference the parity check reports; to
restore the legacy behaviour, drop the `setTx`/`setTy` calls in the load effect in
`src/App.tsx`.

### Baseline audit numbers

The legacy layout is not perfectly clean, and the port reproduces it exactly:

```
nodes 189 · edges 248
routes    ForwardRoute 120, BusRoute 125
fallbacks 3
overlaps 0 · edges through a node 0 · tight channels 1 (worst extent 42)
```

`npm test` asserts overlaps and through-node crossings stay at zero and that tight
channels and fallbacks do not exceed these numbers.

## Known data gaps

The schema lists `p` (problem) and `l` (limitation) as required, but they are missing on
**93 of 189 nodes**, and 100 of 248 edges carry no `l` label. Half the graph therefore
falls back to a plain timeline in the detail panel. Backfilling this is the natural next
change, and it is deliberately kept separate from the port so that any visual difference
is attributable to code, not data.

## Phones and tablets

The sheet is driven with Pointer Events, so a drag pans and two fingers pinch —
the app was mouse-only before, which left the graph unnavigable on a touch
device. Below 1024px the top-bar groups stack and the view opens framed on the
whole sheet rather than centred on its dense middle; below 640px the controls
fold behind a toggle, the detail panel and reading list become bottom sheets,
and the lane gutter gives its 152px back to the graph. A phone in landscape is
treated as short rather than narrow: it keeps the side panel but folds the
controls away.

The zoom floor is computed from the viewport instead of fixed, because the
constant that framed the whole sheet in a desktop window still left it wider
than a phone screen.

## Deployment

`.github/workflows/deploy.yml` runs `npm test` and `npm run build` on every push and
pull request; pushes to `main` publish `dist/` to GitHub Pages. Pages is served from
the workflow, so there is no `gh-pages` branch. `base: './'` keeps every asset and
data URL relative, which is what lets the site live on a subpath.

## Design system

The legacy app linked the "Classical" design system, but that sheet is a light
Cormorant/Lora theme this app never uses — everything here is dark IBM Plex, styled
locally. Only three of its rules reached the page through inheritance (global
`box-sizing`, body `font-size` and `line-height`); those are reproduced verbatim at the
top of `src/styles.css` and the rest is left behind.

**The webfont is self-hosted.** `src/assets/fonts/` carries the Latin subset of IBM
Plex Sans as two woff2 files — a variable roman (`wght` 100–700, covering the four
weights the sheet uses) and a static italic 400 — so the page makes no third-party
requests and first paint does not wait on a cross-origin fetch. The PNG export
base64-inlines the same two files; it used to re-fetch them from Google. A CI step
fails the build if a Google Fonts URL reappears in `dist/`. The fonts are licensed
under the SIL Open Font License 1.1 (`src/assets/fonts/OFL.txt`).

Two glyphs the UI uses — `→` (U+2192) and `✓` (U+2713) — are outside that subset and
render in the system font. That was already true when the fonts came from Google: no
subset it serves carries them either.
