// Loads the legacy app and the React port side by side, waits for both to finish
// building the sheet, then compares the rendered SVG element by element.
//
// This is a one-off verification tool, not part of `npm test` — it needs two live
// servers and a browser, neither of which belongs in the unit-test loop. Playwright
// is deliberately NOT a project dependency; install it ad hoc when you want to run
// this:
//
//   npm i --no-save playwright && npx playwright install chromium
//   (cd legacy && python3 -m http.server 8000) &
//   npm run dev &
//   node tools/parity-check.mjs
//
// Last run: 1855 / 1855 drawables identical, camera transform excepted (see README).
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const LEGACY = 'http://localhost:8000/Deep%20Learning%20Genealogy.dc.html'
const PORT = 'http://localhost:5173/'
const OUT = process.env.PARITY_OUT || '/tmp/genealogy-parity'

// Pull a structural description of the sheet: every drawable, in document order,
// with the attributes that decide what it looks like.
const EXTRACT = `(() => {
  // the top bar and the legend also contain <svg>; the sheet is the biggest one
  const all = [...document.querySelectorAll('svg')];
  const svg = all.sort((p, q) => q.querySelectorAll('*').length - p.querySelectorAll('*').length)[0];
  if (!svg) return null;
  const camG = svg.querySelector('g[transform]');
  const want = {
    path: ['d','fill','stroke','stroke-width','stroke-dasharray','opacity','marker-end','stroke-linecap'],
    rect: ['x','y','width','height','fill','opacity'],
    line: ['x1','y1','x2','y2','stroke','stroke-opacity','stroke-width'],
    text: ['x','y','text-anchor','font-family','font-weight','font-size','fill','opacity','letter-spacing','font-style'],
    marker: ['id','viewBox','refX','refY','markerWidth','markerHeight','orient'],
    g: ['transform','opacity','pointer-events'],
  };
  const out = [];
  const walk = (el) => {
    const tag = el.tagName.toLowerCase();
    const keys = want[tag];
    if (keys) {
      const rec = { tag };
      for (const k of keys) { const v = el.getAttribute(k); if (v !== null) rec[k] = v; }
      if (tag === 'text') rec.txt = el.textContent;
      out.push(rec);
    }
    for (const c of el.children) walk(c);
  };
  walk(svg);
  return { camera: camG ? camG.getAttribute('transform') : null, nodes: out };
})()`

async function grab(browser, url, label, waitFor) {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(waitFor, null, { timeout: 30000 })
  await page.waitForTimeout(1200)
  const data = await page.evaluate(EXTRACT)
  await page.screenshot({ path: `${OUT}/${label}.png` })
  return { data, errors, page }
}

mkdirSync(OUT, { recursive: true })
// PARITY_CHROMIUM lets you point at a chromium already on the machine instead of
// letting playwright download its own.
const browser = await chromium.launch(
  process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {},
)
// both are done when the sheet has all 189 node groups drawn
const ready = `document.querySelectorAll('svg path').length > 400 &&
  !document.body.innerHTML.includes('{{')`

const a = await grab(browser, LEGACY, 'legacy', ready)
const b = await grab(browser, PORT, 'port', ready)

writeFileSync(`${OUT}/legacy.json`, JSON.stringify(a.data, null, 1))
writeFileSync(`${OUT}/port.json`, JSON.stringify(b.data, null, 1))

console.log('legacy drawables:', a.data.nodes.length)
console.log('port   drawables:', b.data.nodes.length)
console.log('legacy camera:', a.data.camera)
console.log('port   camera:', b.data.camera)
if (a.errors.length) console.log('legacy console errors:', a.errors.slice(0, 5))
if (b.errors.length) console.log('port console errors:', b.errors.slice(0, 5))

// The camera transform is the one known deviation (legacy never applies its own
// initial centering). Normalise it away so the diff shows everything else.
const stripCam = (s) => s.nodes.map((r) => (
  r.tag === 'g' && r.transform && r.transform.includes('scale(')
    ? { ...r, transform: 'CAMERA' }
    : r
))

// element-by-element diff
const A = stripCam(a.data), B = stripCam(b.data)
let diffs = 0
const report = []
for (let i = 0; i < Math.max(A.length, B.length); i++) {
  const x = A[i], y = B[i]
  if (JSON.stringify(x) !== JSON.stringify(y)) {
    diffs++
    if (report.length < 12) report.push({ i, legacy: x, port: y })
  }
}
console.log('\nidentical (camera normalised):', JSON.stringify(A) === JSON.stringify(B))
console.log('differing drawables:', diffs, '/', Math.max(A.length, B.length))
if (report.length) {
  console.log('\nfirst differences:')
  for (const r of report) console.log(JSON.stringify(r, null, 1).slice(0, 900))
}
await browser.close()
