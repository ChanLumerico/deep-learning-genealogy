import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CANVAS, EDGE_KINDS, EDGE_KIND_KEYS, EdgeStyle, LANES, NodeStyle, TICK_YEARS, TIME, TimeScale,
  LayoutEngine,
} from './layout'
import type { EdgeKindKey, EdgeModel, Genealogy, LaneId, NodeModel } from './layout'
import { loadGraphData } from './data/load'
import { PaperCsv } from './data/csv'
import { edgeKey, loadEdgeDetail, loadNodeDetail } from './data/detail'
import type { Detail } from './data/detail'
import type { ImportMode } from './data/csv'
import { READ_FILTERS, ReadingLog } from './data/readingLog'
import type { ReadFilterId, ReadMap } from './data/readingLog'
import { exportPng } from './export/png'
import { exportReadingCsv } from './export/csv'
import { useViewport } from './view/useViewport'
import { useCamera, ZOOM } from './view/useCamera'
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
const PANEL_STORE_KEY = 'dlg.panelWidth.v1'
/** narrower than this and the essays stop being readable */
const PANEL_MIN = 300
/**
 * The ceiling adapts: whatever the reader drags to, the sheet keeps a usable
 * strip. On a 1280px laptop that caps the panel around 940px; on a tablet it
 * is what stops the panel swallowing the graph entirely.
 */
const panelMax = (viewportW: number) =>
  Math.max(PANEL_MIN, Math.min(920, viewportW - 340))

/** what the camera is looking at — sets how far out zoom is allowed to go */
const SHEET = { w: CANVAS.w, h: CANVAS.h }

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

  const vp = useViewport()
  const { k, tx, ty, centerOn, fit, zoomBy } = useCamera(vpRef, SHEET)

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
  const [importMode, setImportMode] = useState<ImportMode>('add')
  const [importNote, setImportNote] = useState('')
  const [importBad, setImportBad] = useState(false)

  // Chrome that has to fold away on a phone. The legend is a lookup aid, not a
  // control, so it stays shut until asked for when the sheet is the scarce thing.
  // Panel width is the reader's, and it survives a reload like the reading log.
  const [panelW, setPanelW] = useState(() => {
    const stored = Number(window.localStorage.getItem(PANEL_STORE_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : PANEL_W
  })
  const resizePanel = useCallback((next: number) => {
    setPanelW(() => {
      const clamped = Math.round(
        Math.min(panelMax(window.innerWidth), Math.max(PANEL_MIN, next)),
      )
      try { window.localStorage.setItem(PANEL_STORE_KEY, String(clamped)) } catch { /* private mode */ }
      return clamped
    })
  }, [])
  // a stored width from a wider window, or a rotation, must not strand the graph
  const panelWidth = Math.min(Math.max(panelW, PANEL_MIN), panelMax(vp.w))

  const [legendOpen, setLegendOpen] = useState(!vp.compact)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ── load + build ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    loadGraphData()
      .then(({ nodes, edges }) => {
        if (cancelled) return
        setGraph(new LayoutEngine(nodes, edges).build())
        // Desktop opens on the dense middle of the sheet at a readable zoom.
        // A phone at that zoom shows about two nodes, so it opens framed on
        // the whole thing instead — orientation first, detail on demand.
        if (vp.compact) fit(CANVAS.w, CANVAS.h, 24)
        else centerOn(2950, 2300, ZOOM.initial)
      })
      .catch((err) => {
        console.error('[genealogy] data load failed', err)
        if (!cancelled) setLoadError(String(err && err.message ? err.message : err))
      })
    return () => { cancelled = true }
    // the initial frame is chosen once, from the viewport the page opened at
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const n = graph.byId[id]
    if (!n) return
    setSel(id); setSelEIndex(null); setTip(null)
    centerOn(n.cx, n.cy, Math.max(k, 0.72))
  }, [graph, centerOn, k])

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

  // ── long-form detail, fetched only for what is actually opened ───────────
  // Keyed by whatever is selected so a stale response cannot land in a panel
  // the reader has already moved on from.
  const essayKey = selN ? `n:${selN.id}` : selE ? `e:${edgeKey(selE.from.id, selE.to.id)}` : null
  const [essay, setEssay] = useState<{ key: string; value: Detail | null } | null>(null)

  useEffect(() => {
    if (!essayKey) { setEssay(null); return }
    let live = true
    const want = selN
      ? loadNodeDetail(selN.lane.id).then((f) => f[selN.id])
      : loadEdgeDetail(selE!.from.lane.id).then((f) => f[edgeKey(selE!.from.id, selE!.to.id)])
    want.then((value) => { if (live) setEssay({ key: essayKey, value: value ?? null }) })
    return () => { live = false }
  }, [essayKey, selN, selE])

  const shownEssay = essay && essay.key === essayKey ? essay.value : null
  const essayLoading = !!essayKey && (!essay || essay.key !== essayKey)

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
        essay: shownEssay, essayLoading,
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
        essay: shownEssay, essayLoading,
      }
    }
    return null
  }, [selN, selE, goNode, shownEssay, essayLoading])

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

  /** Whole-list writes — the ones that do not need the previous state. */
  const commitRead = useCallback((next: ReadMap) => {
    ReadingLog.save(next)
    setRead(next)
  }, [])

  const importCsv = useCallback((file: File) => {
    if (!graph) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = PaperCsv.parse(String(reader.result), PaperCsv.index(graph.nodes))
      if (!res.ok) { setImportNote(res.error); setImportBad(true); return }
      setImportBad(false)
      setImportNote(res.count + ' of ' + res.rows + ' rows matched' +
        (importMode === 'replace' ? ' · list replaced' : '') +
        (res.ignored.length
          ? ' · not in the tree: ' + res.ignored.slice(0, 4).join(', ') +
            (res.ignored.length > 4 ? ' +' + (res.ignored.length - 4) : '')
          : ''))
      setRead((prev) => {
        const next: ReadMap = importMode === 'replace'
          ? { ...res.matched }
          : { ...prev, ...res.matched }
        ReadingLog.save(next)
        return next
      })
    }
    reader.onerror = () => { setImportNote('Could not read that file.'); setImportBad(true) }
    reader.readAsText(file)
  }, [graph, importMode])

  const exportCsv = useCallback(() => {
    if (!graph) return
    if (!graph.nodes.some((n) => read[n.id])) {
      setImportNote('Nothing is marked read yet.'); setImportBad(true); return
    }
    setImportBad(false)
    setImportNote('')
    exportReadingCsv(graph.nodes, read)
  }, [graph, read])

  const clearRead = useCallback(() => {
    commitRead({})
    setImportBad(false)
    setImportNote('Reading list cleared.')
  }, [commitRead])

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

  const importModes: ToggleVM[] = ([
    { id: 'add', label: 'Add to list' },
    { id: 'replace', label: 'Replace list' },
  ] as Array<{ id: ImportMode; label: string }>).map((m) => {
    const on = importMode === m.id
    return {
      key: m.id, label: m.label,
      bg: on ? 'rgba(233,229,221,0.13)' : 'transparent',
      bd: on ? 'rgba(233,229,221,0.42)' : 'rgba(233,229,221,0.18)',
      fg: on ? '#f0ebe1' : '#7c7568',
      onClick: () => setImportMode(m.id),
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

  // A panel and the reading list occupy the same slot, so at most one is up.
  const sheetOpen = listOpen || !!panel
  // Side panels push the legend left; a phone's bottom sheet does not.
  const legendRight = sheetOpen && !vp.phone ? panelWidth + 18 : 18

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
          if (!hit) return
          setSel(hit.id); setSelEIndex(null)
          centerOn(hit.cx, hit.cy, Math.max(k, 0.95))
          if (vp.drawer) setControlsOpen(false)   // get out of the way of the result
        }}
        readCount={graph ? `${readCount} / ${graph.nodes.length}` : '—'}
        onToggleList={() => setListOpen((v) => !v)}
        onZoomIn={() => zoomBy(ZOOM.step)}
        onZoomOut={() => zoomBy(1 / ZOOM.step)}
        onFit={() => fit(CANVAS.w, CANVAS.h, vp.compact ? 24 : 140)}
        onReset={clearSel}
        onExport={doExport}
        exporting={exporting}
        compact={vp.compact}
        phone={vp.drawer}
        open={controlsOpen}
        onToggleOpen={() => setControlsOpen((v) => !v)}
      />

      {/* The gesture handlers live here, but `touch-action: none` does NOT:
          it is not overridable by a descendant, so putting it on this wrapper
          would also kill scrolling inside the panels nested under it. It goes
          on the canvas itself, which the panels are siblings of. */}
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

        {/* Left scrim + lane labels, pinned to the viewport. A 152px gutter is
            40% of a phone screen, so on a phone the lane names are dropped —
            the coloured bands still carry the grouping, and the detail panel
            names the domain of whatever gets tapped. */}
        {!vp.phone && (
          <>
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
          </>
        )}

        {/* a bottom sheet covers the legend's corner, so stand it down while one is up */}
        {!(vp.phone && sheetOpen) && !(vp.drawer && controlsOpen) && (
          <Legend
            open={legendOpen} right={legendRight} compact={vp.phone}
            onToggle={() => setLegendOpen((v) => !v)}
          />
        )}

        {/* A hover card cannot work without hover: on a touch device the tap
            that would open it also selects the node, so the panel says it all. */}
        {hoverPreview && !vp.coarse && tipN && <NodeTip node={tipN} x={tipPos.x} y={tipPos.y} />}

        {listOpen && graph && (
          <ReadingList
            readCount={`${readCount} / ${graph.nodes.length}`}
            readPct={Math.round(readCount / graph.nodes.length * 100) + '%'}
            groups={readGroups}
            importModes={importModes}
            importNote={importNote}
            importBad={importBad}
            onImport={importCsv}
            onExport={exportCsv}
            onClearAll={clearRead}
            hasRead={readCount > 0}
            sheet={vp.phone}
            width={panelWidth}
            onResize={resizePanel}
            onToggleRead={toggleRead}
            onToggleGroup={setAllRead}
            onClose={() => setListOpen(false)}
          />
        )}

        {panel && !listOpen && (
          <DetailPanel
            panel={panel} sheet={vp.phone}
            width={panelWidth} onResize={resizePanel}
            onClose={clearSel}
          />
        )}
      </div>
    </div>
  )
}
