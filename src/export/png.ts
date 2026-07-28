// ── PNG export ────────────────────────────────────────────────────────────
// Clones the live SVG (so every filter, dim and highlight is captured as seen),
// resets the camera to frame the whole sheet, inlines the webfont, and rasterises
// at the highest scale the browser will encode.

import { CANVAS } from '../layout'

const NS = 'http://www.w3.org/2000/svg'

let fontCss: string | null | undefined

/** The Latin faces of the webfont, base64-inlined once so exported text is faithful. */
async function embeddedFontCss(): Promise<string | null> {
  if (fontCss !== undefined) return fontCss
  fontCss = null
  try {
    const href = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map((l) => l.href)
      .filter((h) => h.indexOf('fonts.googleapis.com') >= 0)[0]
    if (!href) return null
    const sheet = await (await fetch(href)).text()
    const blocks = sheet.split('@font-face').slice(1)
      .map((b) => '@font-face' + b.slice(0, b.indexOf('}') + 1))
      .filter((b) => {
        const r = /unicode-range:([^;]+);/.exec(b)
        return !r || r[1].toLowerCase().indexOf('u+0000-00ff') >= 0
      })
    let css = blocks.join('\n')
    const urls: string[] = css.match(/https:\/\/fonts\.gstatic\.com[^)'"]+/g) || []
    const uniq = urls.filter((u, i) => urls.indexOf(u) === i)
    const data = await Promise.all(uniq.map(async (u) => {
      const buf = await (await fetch(u)).arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return [u, 'data:font/woff2;base64,' + btoa(bin)] as const
    }))
    data.forEach((p) => { css = css.split(p[0]).join(p[1]) })
    fontCss = css
  } catch (e) {
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
