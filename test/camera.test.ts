// The sheet is only navigable on a phone if pinch-zoom feels attached to the
// fingers. That comes down to one invariant, asserted here rather than
// eyeballed on a device: scaling about an anchor leaves the sheet point under
// that anchor exactly where it was.

import { describe, expect, it } from 'vitest'
import { CANVAS } from '../src/layout'
import {
  ZOOM, centerOn, clampZoom, fitBox, fitScale, panBy, toSheet, toViewport,
  zoomAbout, zoomFloor,
} from '../src/view/camera'
import type { CameraState } from '../src/view/camera'

const START: CameraState = { k: 0.58, tx: -120, ty: 340 }
const PHONE = { width: 390, height: 664 }   // iPhone 14 portrait, minus the bar
const TABLET = { width: 834, height: 1112 }
const DESKTOP = { width: 1680, height: 960 }

describe('zoom about an anchor', () => {
  it('holds the sheet point under the anchor still', () => {
    for (const [px, py] of [[0, 0], [195, 332], [390, 664], [17, 601]]) {
      const before = toSheet(START, px, py)
      for (const factor of [0.5, 0.9, 1.111, 2, 3.4]) {
        const after = toSheet(zoomAbout(START, START.k * factor, px, py), px, py)
        expect(after.x).toBeCloseTo(before.x, 9)
        expect(after.y).toBeCloseTo(before.y, 9)
      }
    }
  })

  it('holds it still across a whole pinch, step by step', () => {
    // a real gesture arrives as many small deltas; drift would accumulate here
    let cam = START
    const px = 210, py = 415
    const target = toSheet(cam, px, py)
    for (let i = 0; i < 60; i++) {
      cam = zoomAbout(cam, cam.k * 1.03, px, py)
      const now = toSheet(cam, px, py)
      expect(now.x).toBeCloseTo(target.x, 6)
      expect(now.y).toBeCloseTo(target.y, 6)
    }
    expect(cam.k).toBe(ZOOM.max)   // and it rides the clamp rather than running away
  })

  it('never leaves the zoom range, however hard it is pushed', () => {
    expect(zoomAbout(START, 99, 10, 10).k).toBe(ZOOM.max)
    expect(zoomAbout(START, 0.00001, 10, 10).k).toBe(ZOOM.min)
    expect(clampZoom(ZOOM.initial)).toBe(ZOOM.initial)
  })

  it('is reversible: pinch out then back returns the camera', () => {
    const out = zoomAbout(START, START.k * 1.6, 88, 190)
    const back = zoomAbout(out, START.k, 88, 190)
    expect(back.k).toBeCloseTo(START.k, 9)
    expect(back.tx).toBeCloseTo(START.tx, 9)
    expect(back.ty).toBeCloseTo(START.ty, 9)
  })
})

describe('pan', () => {
  it('moves the sheet exactly as far as the finger, at any zoom', () => {
    for (const k of [ZOOM.min, 0.58, ZOOM.max]) {
      const cam = { ...START, k }
      const moved = panBy(cam, 40, -25)
      const a = toViewport(cam, 1000, 1000)
      const b = toViewport(moved, 1000, 1000)
      expect(b.px - a.px).toBeCloseTo(40, 9)
      expect(b.py - a.py).toBeCloseTo(-25, 9)
    }
  })

  it('does not change the zoom', () => {
    expect(panBy(START, 300, -900).k).toBe(START.k)
  })
})

describe('fit', () => {
  // What a phone does on first load: the whole sheet, or it opens on two nodes.
  it('frames the entire sheet on every form factor', () => {
    for (const view of [PHONE, TABLET, DESKTOP]) {
      const pad = 24
      const cam = fitBox(view, CANVAS.w, CANVAS.h, pad)
      const tl = toViewport(cam, 0, 0)
      const br = toViewport(cam, CANVAS.w, CANVAS.h)
      expect(tl.px).toBeGreaterThanOrEqual(-0.001)
      expect(tl.py).toBeGreaterThanOrEqual(-0.001)
      expect(br.px).toBeLessThanOrEqual(view.width + 0.001)
      expect(br.py).toBeLessThanOrEqual(view.height + 0.001)
    }
  })

  it('centres what it frames', () => {
    const cam = fitBox(PHONE, CANVAS.w, CANVAS.h, 24)
    const mid = toViewport(cam, CANVAS.w / 2, CANVAS.h / 2)
    expect(mid.px).toBeCloseTo(PHONE.width / 2, 6)
    expect(mid.py).toBeCloseTo(PHONE.height / 2, 6)
  })

  it('stays inside the ceiling on a viewport bigger than the sheet', () => {
    expect(fitBox({ width: 40000, height: 40000 }, CANVAS.w, CANVAS.h).k).toBe(ZOOM.max)
  })
})

describe('the zoom floor adapts to the viewport', () => {
  // The bug this locks: ZOOM.min was tuned for a desktop window, where it
  // already frames the whole sheet. Holding that floor on a phone left the
  // sheet 180px wider than the screen with no way to zoom out to it.
  it('drops below ZOOM.min exactly when the sheet does not fit at ZOOM.min', () => {
    const phone = zoomFloor(PHONE, CANVAS.w, CANVAS.h)
    expect(phone).toBeLessThan(ZOOM.min)
    expect(phone).toBeCloseTo(fitScale(PHONE, CANVAS.w, CANVAS.h), 12)

    // a desktop window already sees everything at ZOOM.min, so nothing changes
    expect(zoomFloor(DESKTOP, CANVAS.w, CANVAS.h)).toBe(ZOOM.min)
    expect(zoomFloor(TABLET, CANVAS.w, CANVAS.h)).toBe(ZOOM.min)
  })

  it('lets a phone pinch all the way out to the whole sheet', () => {
    const low = zoomFloor(PHONE, CANVAS.w, CANVAS.h)
    let cam: CameraState = { k: ZOOM.initial, tx: 0, ty: 0 }
    for (let i = 0; i < 200; i++) {
      cam = zoomAbout(cam, cam.k * 0.9, PHONE.width / 2, PHONE.height / 2, low)
    }
    expect(cam.k).toBeCloseTo(low, 12)
    // and at that floor the sheet genuinely fits across
    expect(CANVAS.w * cam.k).toBeLessThanOrEqual(PHONE.width + 0.001)
  })

  it('still refuses to zoom out past the floor it was given', () => {
    const low = zoomFloor(PHONE, CANVAS.w, CANVAS.h)
    expect(zoomAbout(START, 0.000001, 0, 0, low).k).toBe(low)
    expect(clampZoom(0.0001, low)).toBe(low)
  })
})

describe('centre on a node', () => {
  it('puts the node in the middle of whatever viewport it is given', () => {
    for (const view of [PHONE, TABLET, DESKTOP]) {
      const cam = centerOn(view, 2950, 2300, 0.72)
      const p = toViewport(cam, 2950, 2300)
      expect(p.px).toBeCloseTo(view.width / 2, 6)
      expect(p.py).toBeCloseTo(view.height / 2, 6)
    }
  })
})
