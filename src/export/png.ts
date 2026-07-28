// ── PNG export ────────────────────────────────────────────────────────────
// Clones the live SVG (so every filter, dim and highlight is captured as seen),
// resets the camera to frame the whole sheet, inlines the webfont, and rasterises
// at the highest scale the browser will encode.

import { CANVAS } from '../layout'
import italicUrl from '../assets/fonts/ibm-plex-sans-latin-italic.woff2'
import romanUrl from '../assets/fonts/ibm-plex-sans-latin.woff2'

const NS = 'http://www.w3.org/2000/svg'

// A rasterised <img> cannot reach out for a stylesheet, so the faces have to
// travel inside the SVG as data URIs. Same two files the page renders with —
// self-hosted, so this is a same-origin read with no CORS to negotiate.
const FACES = [
  { url: romanUrl, style: 'normal', weight: '100 700' },
  { url: italicUrl, style: 'italic', weight: '400' },
]

let fontCss: string | null | undefined

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  // chunked: String.fromCharCode(...bytes) would overflow the argument limit
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

/** The webfont, base64-inlined once so exported text is faithful. */
async function embeddedFontCss(): Promise<string | null> {
  if (fontCss !== undefined) return fontCss
  fontCss = null
  try {
    const blocks = await Promise.all(FACES.map(async (f) => {
      const buf = await (await fetch(f.url)).arrayBuffer()
      return `@font-face{font-family:'IBM Plex Sans';font-style:${f.style};` +
        `font-weight:${f.weight};` +
        `src:url(data:font/woff2;base64,${toBase64(buf)}) format('woff2');}`
    }))
    fontCss = blocks.join('\n')
  } catch (e) {
    // the sheet still exports, just in whatever face the renderer substitutes
    console.warn('[export] font inline skipped', e)
  }
  return fontCss
}

export async function exportPng(live: SVGSVGElement): Promise<void> {
  const W = CANVAS.w, H = CANVAS.h
  const clone = live.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', NS)
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))
  clone.setAttribute('viewBox', '0 0 ' + W + ' ' + H)
  const cam = clone.querySelector('g[transform]')
  if (cam) cam.setAttribute('transform', 'translate(0,0) scale(1)')
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('width', String(W))
  bg.setAttribute('height', String(H))
  bg.setAttribute('fill', '#0E1116')
  clone.insertBefore(bg, clone.firstChild)
  const css = await embeddedFontCss()
  if (css) {
    const st = document.createElementNS(NS, 'style')
    st.textContent = css
    clone.insertBefore(st, clone.firstChild)
  }
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  await new Promise<void>((ok, fail) => {
    img.onload = () => ok()
    img.onerror = fail
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  })
  const scales = [2, 1.5, 1]
  for (let i = 0; i < scales.length; i++) {
    const sc = scales[i]
    try {
      const cv = document.createElement('canvas')
      cv.width = Math.round(W * sc)
      cv.height = Math.round(H * sc)
      const ctx = cv.getContext('2d')!
      ctx.drawImage(img, 0, 0, cv.width, cv.height)
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'))
      if (!blob) throw new Error('encoder returned nothing')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'deep-learning-genealogy-' + cv.width + 'x' + cv.height + '.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 6000)
      break
    } catch (err) {
      if (i === scales.length - 1) throw err
    }
  }
}
