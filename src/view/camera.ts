// ── Camera geometry ───────────────────────────────────────────────────────
// The arithmetic behind pan, zoom and fit, with no React and no DOM, so the
// invariant that matters — the point under your fingers does not move while
// you pinch — can be asserted in a test rather than eyeballed on a phone.

export const ZOOM = { min: 0.13, max: 2.2, initial: 0.58, step: 1.25 } as const

/** translate + scale: sheet point p maps to viewport point p * k + t */
export interface CameraState {
  k: number
  tx: number
  ty: number
}

export interface Box {
  width: number
  height: number
}

/**
 * `ZOOM.min` was picked for a desktop window, where it already shows the whole
 * sheet. A phone is narrower than the sheet at that scale, so holding the same
 * floor would leave a reader unable to zoom out far enough to see what they are
 * looking at. The floor therefore drops to whatever frames the sheet — never
 * above it, never further out than needed.
 */
export function zoomFloor(view: Box, w: number, h: number, pad = 0): number {
  return Math.min(ZOOM.min, fitScale(view, w, h, pad))
}

export const clampZoom = (k: number, floor: number = ZOOM.min) =>
  Math.min(ZOOM.max, Math.max(floor, k))

/** The scale at which a w×h region exactly fits the viewport, `pad` px inset. */
export function fitScale(view: Box, w: number, h: number, pad = 0): number {
  const kx = (view.width - pad) / w
  const ky = (view.height - pad) / h
  // a viewport smaller than the padding would otherwise yield a negative scale
  return Math.max(Number.MIN_VALUE, Math.min(kx, ky))
}

/** viewport point → sheet point */
export function toSheet(c: CameraState, px: number, py: number) {
  return { x: (px - c.tx) / c.k, y: (py - c.ty) / c.k }
}

/** sheet point → viewport point */
export function toViewport(c: CameraState, x: number, y: number) {
  return { px: x * c.k + c.tx, py: y * c.k + c.ty }
}

/**
 * Scale to `nextK` about the viewport-space anchor (px, py). The sheet point
 * currently under the anchor stays under it — this is what makes a pinch feel
 * attached to the fingers rather than to the middle of the screen.
 */
export function zoomAbout(
  c: CameraState, nextK: number, px: number, py: number, floor?: number,
): CameraState {
  const k = clampZoom(nextK, floor)
  return {
    k,
    tx: px - (px - c.tx) * k / c.k,
    ty: py - (py - c.ty) * k / c.k,
  }
}

/** Move the camera by a viewport-space delta. */
export function panBy(c: CameraState, dx: number, dy: number): CameraState {
  return { k: c.k, tx: c.tx + dx, ty: c.ty + dy }
}

/** Put a sheet point in the middle of the viewport at the given zoom. */
export function centerOn(
  view: Box, x: number, y: number, zoom: number, floor?: number,
): CameraState {
  const k = clampZoom(zoom, floor)
  return { k, tx: view.width / 2 - x * k, ty: view.height / 2 - y * k }
}

/**
 * Frame a w×h sheet region inside the viewport, leaving `pad` px of margin,
 * and centre it on both axes. Contain, not cover: the whole region fits, which
 * is why this clamps only against the ceiling — the floor exists to stop a
 * reader zooming out into nothing, not to stop Fit from doing its job.
 */
export function fitBox(view: Box, w: number, h: number, pad = 0): CameraState {
  const k = Math.min(ZOOM.max, fitScale(view, w, h, pad))
  return { k, tx: (view.width - w * k) / 2, ty: (view.height - h * k) / 2 }
}
