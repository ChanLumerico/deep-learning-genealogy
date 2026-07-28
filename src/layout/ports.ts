import type { EdgeModel, NodeModel } from './models'
import type { Face, RoutingConfig } from './types'

interface FaceItem {
  e: EdgeModel
  end: 'a' | 'b'
  other: NodeModel
}

// Fans every incident link across the node's faces: left/right split 1/(n+1) of
// the height, and EVERY end also reserves a unique slot on the bottom or top
// face for detour routes, allocated from one combined list so no two links can
// land on the same coordinate.
export class PortAllocator {
  private faces: Record<string, FaceItem[]> = {}

  constructor(
    private nodes: NodeModel[],
    private edges: EdgeModel[],
    private cfg: RoutingConfig,
    private byId: Record<string, NodeModel>,
  ) {}

  private _add(nodeId: string, face: Face, item: FaceItem) {
    const k = nodeId + '|' + face;
    (this.faces[k] = this.faces[k] || []).push(item)
  }

  allocate() {
    this._assign()
    this._relieveSides()
    this._sideFaces()
    this._verticalFaces()
  }

  private _assign() {
    this.edges.forEach((e) => {
      const a = e.from, b = e.to
      e.forward = b.left > a.right + 30
      if (e.forward) { e.faceA = 'right'; e.faceB = 'left' }
      else if (b.cy >= a.cy) { e.faceA = 'bottom'; e.faceB = 'top' }
      else { e.faceA = 'top'; e.faceB = 'bottom' }
      this._add(a.id, e.faceA, { e, end: 'a', other: b })
      this._add(b.id, e.faceB, { e, end: 'b', other: a })
    })
  }

  // a side face only holds as many ports as portPitch allows; the steepest links
  // overflow onto the vertical face
  private _relieveSides() {
    // snapshot: _add below can create new keys, and the legacy pass does not visit them
    Object.keys(this.faces).slice().forEach((key) => {
      const parts = key.split('|'), n = this.byId[parts[0]], face = parts[1]
      if (face !== 'left' && face !== 'right') return
      const list = this.faces[key]
      const cap = Math.max(2, Math.floor((n.h - 6) / this.cfg.portPitch))
      if (list.length <= cap) return
      list.sort((p, q) => Math.abs(q.other.cy - n.cy) - Math.abs(p.other.cy - n.cy))
      list.splice(0, list.length - cap).forEach((item) => {
        const face2: Face = item.other.cy >= n.cy ? 'bottom' : 'top'
        item.e[item.end === 'a' ? 'faceA' : 'faceB'] = face2
        this._add(n.id, face2, item)
      })
    })
  }

  private _sideFaces() {
    Object.keys(this.faces).forEach((key) => {
      const parts = key.split('|'), n = this.byId[parts[0]], face = parts[1], list = this.faces[key]
      if (face !== 'left' && face !== 'right') return
      list.sort((p, q) => (p.other.cy - q.other.cy) || (p.other.cx - q.other.cx))
      const pad = Math.min(this.cfg.facePad, n.h * 0.18), lo = n.top + pad, hi = n.bottom - pad, N = list.length
      list.forEach((item, idx) => {
        const e = item.e, A = item.end === 'a'
        e[A ? 'portA' : 'portB'] = [face === 'right' ? n.right : n.left, lo + (hi - lo) * ((idx + 1) / (N + 1))]
        e[A ? 'spanA' : 'spanB'] = { lo, hi }
      })
    })
  }

  private _verticalFaces() {
    this.nodes.forEach((n) => {
      const pad = Math.min(this.cfg.facePad, n.w * 0.16), lo = n.left + pad, hi = n.right - pad;
      (['bottom', 'top'] as const).forEach((face) => {
        const primary = (this.faces[n.id + '|' + face] || []).map((it) => ({ it, primary: true }))
        const fallback: Array<{ it: FaceItem; primary: boolean }> = [];
        (['left', 'right'] as const).forEach((sf) => {
          (this.faces[n.id + '|' + sf] || []).forEach((it) => {
            if ((face === 'bottom') === (it.other.cy >= n.cy)) fallback.push({ it, primary: false })
          })
        })
        const all = primary.concat(fallback)
        if (!all.length) return
        all.sort((p, q) => (p.it.other.cx - q.it.other.cx) || (p.it.other.cy - q.it.other.cy))
        all.forEach((rec, idx) => {
          const c = lo + (hi - lo) * ((idx + 1) / (all.length + 1))
          const e = rec.it.e, A = rec.it.end === 'a'
          if (rec.primary) {
            e[A ? 'portA' : 'portB'] = [c, face === 'bottom' ? n.bottom : n.top]
            e[A ? 'spanA' : 'spanB'] = { lo, hi }
          }
          e[A ? 'vPortA' : 'vPortB'] = { c, lo, hi }
        })
      })
    })
  }
}
