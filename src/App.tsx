import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CANVAS, EDGE_KINDS, EDGE_KIND_KEYS, EdgeStyle, LANES, NodeStyle, TICK_YEARS, TIME, TimeScale,
  LayoutEngine,
} from './layout'
import type { EdgeKindKey, EdgeModel, Genealogy, LaneId, NodeModel } from './layout'
import { loadGraphData } from './data/load'
import { PaperCsv } from './data/csv'
import { READ_FILTERS, ReadingLog } from './data/readingLog'
import type { ReadFilterId, ReadMap } from './data/readingLog'
import { exportPng } from './export/png'
import { GraphCanvas } from './components/GraphCanvas'
import { TopBar } from './components/TopBar'
import { Legend } from './components/Legend'
import { NodeTip } from './components/NodeTip'
import { DetailPanel } from './components/DetailPanel'
import { ReadingList } from './components/ReadingList'
import type {
  EdgeHitVM, EdgeVM, LaneVM, NodeVM, PanelField, PanelGroup, PanelVM,
  ReadGroupVM, TickVM, ToggleVM,
} from './view/types'

const PANEL_W = 372

export interface AppProps {
  /** hover preview card over a node */
  hoverPreview?: boolean
  /** opacity of everything outside the selected lineage */
  dimOpacity?: number
  /** lane band tint */
  laneTint?: number
}

export default function App({ hoverPreview = true, dimOpacity = 0.12, laneTint = 0.07 }: AppProps) {
  const vpRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [graph, setGraph] = useState<Genealogy | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // camera
  const [k, setK] = useState(0.58)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)

  // filters
  const [lanesOff, setLanesOff] = useState<Record<string, boolean>>({})
  const [kindsOff, setKindsOff] = useState<Record<string, boolean>>({})
  const [timeX, setTimeX] = useState(5420)
  const [query, setQuery] = useState('')

  // selection
  const [sel, setSel] = useState<string | null>(null)
  const [selEIndex, setSelEIndex] = useState<number | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })

  // reading log
  const [read, setRead] = useState<ReadMap>(() => ReadingLog.load())
  const [readFilter, setReadFilter] = useState<ReadFilterId>('all')
  const [listOpen, setListOpen] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [importBad, setImportBad] = useState(false)

  const [legendOpen, setLegendOpen] = useState(true)
  const [exporting, setExporting] = useState(false)

  // ── load + build ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    loadGraphData()
      .then(({ nodes, edges }) => {
        if (cancelled) return
        setGraph(new LayoutEngine(nodes, edges).build())
        const el = vpRef.current
        if (el) {
          const r = el.getBoundingClientRect()
          setTx(r.width / 2 - 2950 * 0.58)
          setTy(r.height / 2 - 2300 * 0.58)
        }
      })
      .catch((err) => {
        console.error('[genealogy] data load failed', err)
        if (!cancelled) setLoadError(String(err && err.message ? err.message : err))
      })
    return () => { cancelled = true }
  }, [])

  // ── camera: wheel zoom about the cursor, drag to pan ────────────────────
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      const px = ev.clientX - r.left, py = ev.clientY - r.top
      setK((prevK) => {
        const next = Math.min(2.2, Math.max(0.13, prevK * (ev.deltaY > 0 ? 0.9 : 1.111)))
        setTx((prevTx) => px - (px - prevTx) * next / prevK)
        setTy((prevTy) => py - (py - prevTy) * next / prevK)
        return next
      })
    }
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement
      if (target.closest('input,button')) return
      const sx = ev.clientX, sy = ev.clientY
      let tx0 = 0, ty0 = 0
      setTx((v) => { tx0 = v; return v })
      setTy((v) => { ty0 = v; return v })
      const move = (m: MouseEvent) => {
        setTx(tx0 + (m.clientX - sx))
        setTy(ty0 + (m.clientY - sy))
        setTip(null)
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        el.style.cursor = 'grab'
      }
      el.style.cursor = 'grabbing'
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onDown)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onDown)
    }
  }, [])

  const centerOn = useCallback((n: NodeModel, zoom: number) => {
    const el = vpRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setK(zoom)
    setTx(r.width / 2 - n.cx * zoom)
    setTy(r.height / 2 - n.cy * zoom)
  }, [])

  // ── derived view state ──────────────────────────────────────────────────
  const selE: EdgeModel | null = useMemo(
    () => (graph && selEIndex != null && graph.edges[selEIndex]) || null,
    [graph, selEIndex],
  )

  const lineSet = useMemo(() => {
    if (!graph) return null
    if (sel) return graph.lineage(sel)
    if (selE) return { [selE.from.id]: 1, [selE.to.id]: 1 } as Record<string, 1>
    return null
  }, [graph, sel, selE])

  const yearMax = useMemo(() => TIME.yearAt(timeX), [timeX])

  const goNode = useCallback((id: string) => {
    if (!graph) return
    setSel(id); setSelEIndex(null); setTip(null)
    setK((prev) => {
      const zoom = Math.max(prev, 0.72)
      centerOn(graph.byId[id], zoom)
      return zoom
    })
  }, [graph, centerOn])

  // The heavy pass: one view-state record per node, then paint for every node and
  // edge. Deliberately independent of the camera, so panning and zooming never
  // recompute it — the legacy component rebuilt all of this on every mouse move.
  const painted = useMemo(() => {
    if (!graph) return null
    const laneOn = (id: LaneId) => !lanesOff[id]
    const isRead = (id: string) => !!read[id]
    const readOk = (id: string) => readFilter === 'all' || (readFilter === 'read') === isRead(id)

    const view: Record<string, {
      visible: boolean; read: boolean; future: boolean
      inLineage: boolean; lineageActive: boolean; selected: boolean; dim: number
    }> = {}
    graph.nodes.forEach((n) => {
      view[n.id] = {
        visible: laneOn(n.lane.id) && readOk(n.id),
        read: isRead(n.id),
        future: n.year > yearMax,
        inLineage: !!(lineSet && lineSet[n.id]),
        lineageActive: !!lineSet,
        selected: sel === n.id,
        dim: dimOpacity,
      }
    })

    const nodes: NodeVM[] = graph.nodes.map((n) => ({
      node: n,
      paint: NodeStyle.resolve(n, view[n.id]),
      read: view[n.id].read,
    }))

    const back: EdgeVM[] = [], front: EdgeVM[] = [], hits: EdgeHitVM[] = []
    graph.edges.forEach((e) => {
      if (kindsOff[e.kindKey]) return
      const va = view[e.from.id], vb = view[e.to.id]
      if (!va.visible || !vb.visible) return
      const paint = EdgeStyle.resolve(e, {
        future: va.future || vb.future,
        inLineage: !!(lineSet && lineSet[e.from.id] && lineSet[e.to.id]),
        lineageActive: !!lineSet,
        selected: !!(selE && selE.index === e.index),
        dim: dimOpacity,
      })
      ;(paint.layer === 'back' ? back : front).push({ key: e.index, paint })
      if (paint.opacity > 0.12) hits.push({ key: e.index, d: paint.d, edge: e })
    })

    return { nodes, back, front, hits, isRead }
  }, [graph, lanesOff, kindsOff, read, readFilter, lineSet, sel, selE, yearMax, dimOpacity])

  const lanes: LaneVM[] = useMemo(() => LANES.map((L) => ({
    id: L.id, label: L.label, big: L.big, c: L.c, y0: L.y0, y1: L.y1, h: L.y1 - L.y0,
    tint: lanesOff[L.id] ? laneTint * 0.25 : laneTint,
  })), [lanesOff, laneTint])

  const laneLabels = useMemo(() => {
    if (!graph) return []
    return LANES.map((L) => ({
      id: L.id, label: L.label, c: L.c,
      op: lanesOff[L.id] ? 0.35 : 1,
      count: graph.laneCount(L.id) + ' models',
      top: (L.y0 + L.y1) / 2 * k + ty - 26,
    })).filter((x) => x.top > -60 && x.top < 4000)
  }, [graph, lanesOff, k, ty])

  const ticks: TickVM[] = useMemo(() => TICK_YEARS.map((y) => ({
    year: y, x: TIME.x(y),
    gridOp: y <= yearMax ? 0.075 : 0.03,
    op: y <= yearMax ? 0.85 : 0.28,
  })), [yearMax])

  const markers = useMemo(() => EdgeStyle.markers(), [])

  const selN = graph && sel ? graph.byId[sel] : null
  const tipN = graph && tip ? graph.byId[tip] : null

  // ── detail panel: a node's own record, or one relation read end to end ──
  const panel: PanelVM | null = useMemo(() => {
    const relItem = (e: EdgeModel, other: NodeModel) => ({
      name: other.name, kind: e.kind.label, note: e.describe(other), c: other.lane.c,
      onClick: () => goNode(other.id),
    })
    if (selN) {
      const fields = ([
        { k: 'Problem solved', v: selN.problem ?? '', c: '#ddd7cb', it: 'normal' },
        { k: 'Key idea', v: selN.idea ?? '', c: '#ddd7cb', it: 'normal' },
        { k: 'Limitation left', v: selN.limitation ?? '', c: '#c0b9ab', it: 'italic' },
      ] as PanelField[]).filter((f) => f.v)
      const groups: PanelGroup[] = [
        { k: 'Descends from', items: selN.edgesIn.map((e) => relItem(e, e.from)) },
        { k: 'Leads to', items: selN.edgesOut.map((e) => relItem(e, e.to)) },
      ].filter((g) => g.items.length)
      return {
        color: selN.lane.c, kicker: selN.lane.label, title: selN.name,
        meta: selN.meta, lead: selN.contribution, fields, groups,
      }
    }
    if (selE) {
      const a = selE.from, b = selE.to
      const fields = ([
        { k: 'Limitation in ' + a.name, v: a.limitation ?? '', c: '#c0b9ab', it: 'italic' },
        { k: 'What ' + b.name + ' changed', v: b.idea ?? '', c: '#ddd7cb', it: 'normal' },
        { k: 'Remaining after ' + b.name, v: b.limitation ?? '', c: '#c0b9ab', it: 'italic' },
      ] as PanelField[]).filter((f) => f.v)
      return {
        color: selE.colour,
        kicker: selE.kind.label + ' · ' + selE.kind.note,
        title: a.name + ' → ' + b.name,
        meta: a.year + ' → ' + b.year + (a.lane.id === b.lane.id
          ? ' · within ' + a.lane.label
          : ' · ' + a.lane.short + ' to ' + b.lane.short),
        lead: selE.label || (a.name + ' → ' + b.name + ': ' + b.contribution),
        fields,
        groups: [{
          k: 'Endpoints', items: [
            { name: a.name, kind: a.year + ' · source', note: a.contribution, c: a.lane.c, onClick: () => goNode(a.id) },
            { name: b.name, kind: b.year + ' · result', note: b.contribution, c: b.lane.c, onClick: () => goNode(b.id) },
          ],
        }],
      }
    }
    return null
  }, [selN, selE, goNode])

  // ── reading list: one section per domain, ticked from the same state ────
  const readCount = graph ? graph.nodes.filter((n) => !!read[n.id]).length : 0
  const readGroups: ReadGroupVM[] = useMemo(() => {
    if (!graph) return []
    return LANES.map((L) => {
      const items = graph.nodes.filter((n) => n.lane.id === L.id)
        .sort((a, b) => (a.year - b.year) || a.name.localeCompare(b.name))
        .map((n) => {
          const r = !!read[n.id]
          return {
            id: n.id, name: n.name, year: n.year,
            paper: n.paper || n.contribution,
            read: r,
            box: r ? '✓' : '',
            boxBd: r ? n.lane.c : 'rgba(233,229,221,0.3)',
            boxBg: r ? n.lane.c + '2e' : 'transparent',
            boxFg: n.lane.c,
            nameCol: r ? '#f2ece1' : '#a9a293',
          }
        })
      const done = items.filter((i) => i.read).length
      return { id: L.id, label: L.label, c: L.c, items, tally: done + ' / ' + items.length, done }
    })
  }, [graph, read])

  // ── actions ─────────────────────────────────────────────────────────────
  const toggleRead = useCallback((id: string) => {
    setRead((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]; else next[id] = 1
      ReadingLog.save(next)
      return next
    })
  }, [])

  const setAllRead = useCallback((ids: string[], value: boolean) => {
    setRead((prev) => {
      const next = { ...prev }
      ids.forEach((id) => { if (value) next[id] = 1; else delete next[id] })
      ReadingLog.save(next)
      return next
    })
  }, [])

  const importCsv = useCallback((file: File) => {
    if (!graph) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = PaperCsv.parse(String(reader.result), PaperCsv.index(graph.nodes))
      if (!res.ok) { setImportNote(res.error); setImportBad(true); return }
      setImportBad(false)
      setImportNote(res.count + ' of ' + res.rows + ' rows matched' +
        (res.ignored.length
          ? ' · not in the tree: ' + res.ignored.slice(0, 4).join(', ') +
            (res.ignored.length > 4 ? ' +' + (res.ignored.length - 4) : '')
          : ''))
      setRead((prev) => {
        const next = { ...prev, ...res.matched }
        ReadingLog.save(next)
        return next
      })
    }
    reader.onerror = () => { setImportNote('Could not read that file.'); setImportBad(true) }
    reader.readAsText(file)
  }, [graph])

  const doExport = useCallback(async () => {
    if (exporting || !svgRef.current) return
    setExporting(true)
    try {
      await exportPng(svgRef.current)
    } catch (e) {
      console.warn('[export] failed', e)
    }
    setExporting(false)
  }, [exporting])

  const laneToggles: ToggleVM[] = LANES.map((L) => {
    const on = !lanesOff[L.id]
    return {
      key: L.id, label: L.short,
      bg: on ? L.c + '26' : 'transparent',
      bd: on ? L.c + '99' : 'rgba(233,229,221,0.18)',
      fg: on ? '#f0ebe1' : '#7c7568',
      onClick: () => setLanesOff((s) => ({ ...s, [L.id]: !s[L.id] })),
    }
  })

  const edgeToggles: ToggleVM[] = EDGE_KIND_KEYS.map((kk: EdgeKindKey) => {
    const on = !kindsOff[kk]
    return {
      key: kk, label: EDGE_KINDS[kk].label,
      bg: on ? 'rgba(233,229,221,0.13)' : 'transparent',
      bd: on ? 'rgba(233,229,221,0.42)' : 'rgba(233,229,221,0.18)',
      fg: on ? '#f0ebe1' : '#7c7568',
      onClick: () => setKindsOff((s) => ({ ...s, [kk]: !s[kk] })),
    }
  })

  const readFilterToggles: ToggleVM[] = READ_FILTERS.map((f) => {
    const on = readFilter === f.id
    return {
      key: f.id, label: f.label,
      bg: on ? 'rgba(233,229,221,0.13)' : 'transparent',
      bd: on ? 'rgba(233,229,221,0.42)' : 'rgba(233,229,221,0.18)',
      fg: on ? '#f0ebe1' : '#7c7568',
      onClick: () => setReadFilter(f.id),
    }
  })

  const clearSel = () => { setSel(null); setSelEIndex(null); setTip(null) }

  const onNodeEnter = useCallback((id: string, ev: React.MouseEvent) => {
    const el = vpRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let x = ev.clientX - r.left + 16, y = ev.clientY - r.top + 14
    if (x + 318 > r.width) x = r.width - 318
    if (y + 230 > r.height) y = Math.max(8, r.height - 236)
    setTip(id); setTipPos({ x, y })
  }, [])

  const panelOpen = !!panel
  const legendRight = (listOpen || panelOpen) ? PANEL_W + 18 : 18

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0E1116', overflow: 'hidden',
    }}>
      <TopBar
        yearLabel={TimeScale.label(yearMax)}
        timeMin={TIME.min} timeMax={TIME.max} timeX={timeX} onYear={setTimeX}
        laneToggles={laneToggles} edgeToggles={edgeToggles} readFilters={readFilterToggles}
        query={query} onQuery={setQuery}
        onQuerySubmit={(v) => {
          if (!graph) return
          const hit = graph.search(v)
          if (hit) { setSel(hit.id); setSelEIndex(null); centerOn(hit, Math.max(k, 0.95)) }
        }}
        readCount={graph ? `${readCount} / ${graph.nodes.length}` : '—'}
        onToggleList={() => setListOpen((v) => !v)}
        onZoomIn={() => setK((v) => Math.min(2.2, v * 1.25))}
        onZoomOut={() => setK((v) => Math.max(0.13, v / 1.25))}
        onFit={() => {
          const el = vpRef.current
          const r = el ? el.getBoundingClientRect() : { width: 1400, height: 900 }
          const kk = r.width / (CANVAS.w + 140)
          setK(kk); setTx((r.width - CANVAS.w * kk) / 2); setTy(r.height / 2 - (CANVAS.h / 2) * kk)
        }}
        onReset={clearSel}
        onExport={doExport}
        exporting={exporting}
      />

      <div
        ref={vpRef}
        style={{
          position: 'relative', flex: 1, overflow: 'hidden', cursor: 'grab',
          background: 'radial-gradient(120% 90% at 50% 0%, #131820 0%, #0E1116 62%)',
        }}
      >
        {painted && (
          <GraphCanvas
            svgRef={svgRef}
            camera={`translate(${tx},${ty}) scale(${k})`}
            markers={markers}
            lanes={lanes}
            ticks={ticks}
            edgesBack={painted.back}
            edgesFront={painted.front}
            edgeHits={painted.hits}
            nodes={painted.nodes}
            onNodeClick={(id) => { setSel((s) => (s === id ? null : id)); setSelEIndex(null); setTip(null) }}
            onNodeEnter={onNodeEnter}
            onNodeLeave={() => setTip(null)}
            onEdgeClick={(i) => { setSelEIndex((s) => (s === i ? null : i)); setSel(null); setTip(null) }}
            onEdgeEnter={() => { /* hover state is reserved for a future affordance */ }}
            onEdgeLeave={() => { /* idem */ }}
          />
        )}

        {!graph && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: loadError ? '#d68b7a' : '#7d7568', fontSize: 13,
            letterSpacing: '0.06em', padding: 24, textAlign: 'center',
          }}>
            {loadError
              ? `Could not load the graph — ${loadError}`
              : 'Building the genealogy…'}
          </div>
        )}

        {/* left scrim + lane labels, pinned to the viewport */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 152, pointerEvents: 'none',
          background: 'linear-gradient(90deg, #0E1116 62%, rgba(14,17,22,0) 100%)',
        }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 152, pointerEvents: 'none' }}>
          {laneLabels.map((L) => (
            <div
              key={L.id}
              style={{
                position: 'absolute', left: 14, top: L.top,
                display: 'flex', flexDirection: 'column', gap: 3, opacity: L.op,
              }}
            >
              <div style={{ width: 26, height: 1, background: L.c }} />
              <div style={{ fontSize: 15, lineHeight: 1.15, color: L.c, letterSpacing: '0.02em' }}>{L.label}</div>
              <div style={{
                fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                fontWeight: 500, color: '#7d7568', fontVariantNumeric: 'tabular-nums',
              }}>{L.count}</div>
            </div>
          ))}
        </div>

        <Legend open={legendOpen} right={legendRight} onToggle={() => setLegendOpen((v) => !v)} />

        {hoverPreview && tipN && <NodeTip node={tipN} x={tipPos.x} y={tipPos.y} />}

        {listOpen && graph && (
          <ReadingList
            readCount={`${readCount} / ${graph.nodes.length}`}
            readPct={Math.round(readCount / graph.nodes.length * 100) + '%'}
            groups={readGroups}
            importNote={importNote}
            importBad={importBad}
            onImport={importCsv}
            onToggleRead={toggleRead}
            onToggleGroup={setAllRead}
            onClose={() => setListOpen(false)}
          />
        )}

        {panel && !listOpen && <DetailPanel panel={panel} onClose={clearSel} />}
      </div>
    </div>
  )
}
