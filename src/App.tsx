import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CANVAS, EDGE_KINDS, EDGE_KIND_KEYS, EdgeStyle, LANES, NodeStyle, TICK_YEARS, TIME, TimeScale,
  LayoutEngine,
} from './layout'
import type { EdgeKindKey, EdgeModel, Genealogy, LaneId, NodeModel } from './layout'
import { loadGraphData } from './data/load'
import { PaperCsv } from './data/csv'
import { edgeKey, loadEdgeDetail, loadNodeDetail, loadPaperIds, loadPaths, loadSearchIndex } from './data/detail'
import type { Detail } from './data/detail'
import type { ImportMode, PaperIds } from './data/csv'
import { READ_FILTERS, ReadingLog } from './data/readingLog'
import {
  accountNeededNow, accountsAvailable, addReading, clearReading, fetchReading,
  PROVIDERS, removeReading, signIn, signOut, watchAccount,
} from './data/account'
import type { Account, Provider } from './data/account'
import { describe as describeSync, plan } from './data/sync'
import type { ReadFilterId, ReadMap } from './data/readingLog'
import { exportPng } from './export/png'
import { exportReadingCsv } from './export/csv'
import { useViewport } from './view/useViewport'
import { useCamera, ZOOM } from './view/useCamera'
import { useUrlState } from './view/useUrlState'
import { parseHash, toHash } from './view/url'
import { ancestry, clampStep, steps } from './view/walk'
import { allPaths } from './view/walk'
import type { Step, WalkCourse } from './view/walk'
import { WalkBar } from './components/WalkBar'
import { StartHere } from './components/StartHere'
import { AccountButton } from './components/AccountButton'
import { SignInDialog } from './components/SignInDialog'
import { SearchPalette } from './components/SearchPalette'
import type { SearchIndex } from './view/search'
import { move } from './view/keys'
import type { Direction } from './view/keys'
import type { UrlState } from './view/url'
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

/** field id in paths.json → the lane whose colour it borrows on the cards */
const FIELD_LANE: Record<string, string> = {
  foundations: 'found', vision: 'cv', language: 'nlp',
  generative: 'gen', control: 'rl', multimodal: 'mm',
}
const LANE_COLOURS: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_LANE).map(([field, lane]) => {
    const L = LANES.find((x) => x.id === lane)
    return [field, L ? L.c : '#9fa9b5']
  }),
)

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
  // The DOI / arXiv / title table the importer matches against. Only the
  // reading list needs it, so it is not fetched until that panel is opened.
  const [paperIds, setPaperIds] = useState<PaperIds>({})
  useEffect(() => {
    if (!listOpen || Object.keys(paperIds).length) return
    loadPaperIds().then((t) => setPaperIds(t as PaperIds))
  }, [listOpen, paperIds])
  // ── account ─────────────────────────────────────────────────────────────
  // Signing in only carries the reading list between browsers; the graph, the
  // essays and the walks never need one. `read` stays the single source of
  // truth in the app and every write mirrors to whichever stores exist.
  const [account, setAccount] = useState<Account | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authNote, setAuthNote] = useState<string | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const accountRef = useRef<Account | null>(null)
  accountRef.current = account

  // Watch only once the client is genuinely wanted: on return from OAuth, when
  // a session is already stored, or when the reader opens the list where the
  // sign-in button lives. Otherwise supabase-js is never fetched at all.
  const [authWanted, setAuthWanted] = useState(() => accountNeededNow())
  useEffect(() => { if (listOpen) setAuthWanted(true) }, [listOpen])
  useEffect(() => { if (account) { setSignInOpen(false); setAuthError(null) } }, [account])

  const doSignIn = useCallback((p: Provider) => {
    setAuthBusy(true); setAuthError(null)
    signIn(p).catch(() => {
      setAuthBusy(false)
      setAuthError('Could not start sign-in. Try again in a moment.')
    })
  }, [])

  const doSignOut = useCallback(() => {
    setAuthBusy(true)
    // the list stays in this browser; signing out is not a delete
    signOut().finally(() => {
      mergedFor.current = null
      setAuthBusy(false)
      setAuthNote('Signed out. This browser keeps its own copy.')
    })
  }, [])
  useEffect(() => {
    if (!authWanted || !accountsAvailable) return
    return watchAccount(setAccount)
  }, [authWanted])

  // On sign-in, reconcile: union of both lists, never a subtraction. See
  // data/sync.ts — the absence of a tick is not evidence a paper was unread.
  const mergedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!account || mergedFor.current === account.id) return
    mergedFor.current = account.id
    let live = true
    setAuthBusy(true)
    fetchReading()
      .then((remote) => {
        if (!live) return
        const local = ReadingLog.load()
        const p = plan(local, remote)
        ReadingLog.save(p.merged)
        setRead(p.merged)
        setAuthNote(describeSync(local, remote))
        return addReading(account.id, p.toUpload)
      })
      .catch((e) => {
        console.warn('[account] could not load the stored list', e)
        if (live) setAuthNote('Could not reach your account — this browser\'s list is unchanged.')
      })
      .finally(() => { if (live) setAuthBusy(false) })
    return () => { live = false }
  }, [account])

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

  // ── walking a lineage ───────────────────────────────────────────────────
  // Which journey is open and how far in. Curated journeys arrive with the
  // graph; a trace is computed from whichever model the reader asked about.
  const [walk, setWalk] = useState<
    { kind: 'path' | 'trace'; id: string; step: number } | null>(null)
  const [courses, setCourses] = useState<WalkCourse[]>([])
  const [startOpen, setStartOpen] = useState(false)

  // ── search over the essays ──────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null)
  useEffect(() => {
    if (!searchOpen || searchIndex) return
    loadSearchIndex().then((ix) => setSearchIndex(ix as SearchIndex | null))
  }, [searchOpen, searchIndex])

  useEffect(() => {
    loadPaths().then((p) => setCourses(p as WalkCourse[]))
  }, [])
  const [exporting, setExporting] = useState(false)

  // ── load + build ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    loadGraphData()
      .then(({ nodes, edges }) => {
        if (cancelled) return
        setGraph(new LayoutEngine(nodes, edges).build())
        // A link that names something frames that instead — useUrlState will
        // centre on it as soon as the graph exists, and overruling it here
        // would throw the reader back to the middle of the sheet.
        if (parseHash(window.location.hash).sel) return
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

  /** the chain being walked, its title, and the alternating steps over it */
  const walking = useMemo(() => {
    if (!graph || !walk) return null
    const nodes = graph.nodes.map((n) => ({ id: n.id, year: n.year }))
    const edges = graph.edges.map((e) => ({
      from: e.from.id, to: e.to.id, kind: e.kindKey, hi: e.highlight,
    }))
    let chain: string[] = []
    let title = ''
    if (walk.kind === 'path') {
      const p = allPaths(courses).find((x) => x.id === walk.id)
      if (!p) return null
      chain = p.nodes.filter((id) => graph.byId[id])
      title = p.title
    } else {
      chain = ancestry(nodes, edges, walk.id)
      const end = graph.byId[walk.id]
      title = end ? `How we got to ${end.name}` : ''
    }
    if (chain.length < 2) return null
    const list = steps(chain, edges)
    return { title, steps: list, step: clampStep(walk.step, list.length) }
  }, [graph, walk, courses])

  // The step being read IS the selection: the panel already knows how to
  // render a model or an arrow, so a walk only has to choose which one.
  useEffect(() => {
    if (!walking || !graph) return
    const cur: Step | undefined = walking.steps[walking.step]
    if (!cur) return
    if (cur.kind === 'node') {
      const n = graph.byId[cur.id]
      setSel(cur.id); setSelEIndex(null)
      if (n) centerOn(n.cx, n.cy, Math.max(ZOOM.initial, 0.72))
    } else {
      const i = graph.edges.findIndex(
        (x) => x.from.id === cur.from && x.to.id === cur.to)
      setSel(null); setSelEIndex(i >= 0 ? i : null)
      if (i >= 0) {
        const x = graph.edges[i]
        centerOn((x.from.cx + x.to.cx) / 2, (x.from.cy + x.to.cy) / 2,
          Math.max(ZOOM.initial, 0.6))
      }
    }
    setListOpen(false)
  }, [walking, graph, centerOn])

  const stepBy = useCallback((d: number) => {
    setWalk((w) => (w ? { ...w, step: Math.max(0, w.step + d) } : w))
  }, [])

  // ── the address bar ─────────────────────────────────────────────────────
  // Everything worth putting in a link, in one object. Values sitting at
  // their default are left out by toHash(), so an ordinary link is short.
  const urlState: UrlState = useMemo(() => ({
    sel: sel ? { kind: 'node' as const, id: sel }
      : selE ? { kind: 'edge' as const, from: selE.from.id, to: selE.to.id }
      : null,
    listOpen,
    walk: walking && walk ? { kind: walk.kind, id: walk.id, step: walking.step } : null,
    year: timeX >= TIME.max ? null : Math.round(TIME.yearAt(timeX)),
    lanesOff: Object.keys(lanesOff).filter((x) => lanesOff[x]).sort(),
    kindsOff: Object.keys(kindsOff).filter((x) => kindsOff[x]).sort(),
  }), [sel, selE, listOpen, walk, walking, timeX, lanesOff, kindsOff])

  const applyUrl = useCallback((u: UrlState) => {
    if (!graph) return
    setTimeX(u.year == null ? TIME.max : TIME.x(u.year))
    setLanesOff(Object.fromEntries(u.lanesOff.map((x) => [x, true])))
    setKindsOff(Object.fromEntries(u.kindsOff.map((x) => [x, true])))
    setListOpen(u.listOpen)
    setWalk(u.walk)
    // a walk sets its own selection from the step it lands on
    if (u.walk) return
    if (u.sel?.kind === 'node') {
      const n = graph.byId[u.sel.id]
      setSel(n ? u.sel.id : null); setSelEIndex(null)
      // a link has to show you the thing it names, not just select it
      if (n) centerOn(n.cx, n.cy, Math.max(ZOOM.initial, 0.72))
    } else if (u.sel?.kind === 'edge') {
      // pulled out so the narrowing survives into the callback
      const { from, to } = u.sel
      const i = graph.edges.findIndex((e) => e.from.id === from && e.to.id === to)
      setSel(null); setSelEIndex(i >= 0 ? i : null)
      if (i >= 0) {
        const e = graph.edges[i]
        centerOn((e.from.cx + e.to.cx) / 2, (e.from.cy + e.to.cy) / 2,
          Math.max(ZOOM.initial, 0.6))
      }
    } else {
      setSel(null); setSelEIndex(null)
    }
  }, [graph, centerOn])

  // only once the graph exists — an id cannot be resolved before then
  useUrlState({ state: urlState, apply: applyUrl }, !!graph)

  const goNode = useCallback((id: string) => {
    if (!graph) return
    const n = graph.byId[id]
    if (!n) return
    setSel(id); setSelEIndex(null); setTip(null)
    centerOn(n.cx, n.cy, Math.max(k, 0.72))
  }, [graph, centerOn, k])

  // ── keyboard ────────────────────────────────────────────────────────────
  // One tab stop on the canvas and a cursor moved by the arrows, rather than
  // 189 tab stops. `/` and ⌘K reach the search from anywhere, and Escape
  // backs out of whatever is open, innermost first.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      const typing = !!t?.closest('input,textarea,select,[contenteditable]')

      if (ev.key === 'Escape') {
        if (signInOpen) setSignInOpen(false)
        else if (searchOpen) setSearchOpen(false)
        else if (startOpen) setStartOpen(false)
        else if (walk) setWalk(null)
        else if (listOpen) setListOpen(false)
        else { setSel(null); setSelEIndex(null) }
        return
      }
      if (typing) return

      if (ev.key === '/' || ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k')) {
        setSearchOpen(true)
        ev.preventDefault()
        return
      }
      if (searchOpen || startOpen || signInOpen) return

      // stepping a walk from the keyboard, since that is a linear reading
      if (walk && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        stepBy(ev.key === 'ArrowRight' ? 1 : -1)
        ev.preventDefault()
        return
      }

      const DIRS: Record<string, Direction> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = DIRS[ev.key]
      if (!dir || !graph) return
      const next = move(
        graph.nodes.map((n) => ({ id: n.id, lane: n.lane.id, year: n.year, x: n.x })),
        graph.edges.map((e) => ({ from: e.from.id, to: e.to.id, kind: e.kindKey })),
        sel, dir,
      )
      if (next) goNode(next)
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [graph, sel, walk, searchOpen, startOpen, signInOpen, listOpen, goNode, stepBy])

  /** open whatever a search result points at, leaving any walk behind */
  const openResult = useCallback((kind: 'n' | 'e', id: string) => {
    setSearchOpen(false)
    setWalk(null)
    setListOpen(false)
    if (kind === 'n') { goNode(id); return }
    const [from, to] = id.split('>')
    const i = graph?.edges.findIndex((e) => e.from.id === from && e.to.id === to) ?? -1
    setSel(null)
    setSelEIndex(i >= 0 ? i : null)
  }, [graph, goNode])

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
  }, [graph, read, paperIds])

  // ── actions ─────────────────────────────────────────────────────────────
  /**
   * Mirror a change to the account, if there is one. Every writer goes through
   * here so none can forget, and a failed write is reported rather than
   * swallowed — localStorage already has the change, so the reader has not
   * lost anything, but they should know the account is behind.
   */
  const push = useCallback((added: string[], removed: string[]) => {
    const acc = accountRef.current
    if (!acc) return
    Promise.all([
      added.length ? addReading(acc.id, added) : null,
      removed.length ? removeReading(removed) : null,
    ]).catch((e) => {
      console.warn('[account] could not save', e)
      setAuthNote('Saved in this browser — your account could not be reached.')
    })
  }, [])

  const toggleRead = useCallback((id: string) => {
    setRead((prev) => {
      const next = { ...prev }
      const wasRead = !!next[id]
      if (wasRead) delete next[id]; else next[id] = 1
      ReadingLog.save(next)
      push(wasRead ? [] : [id], wasRead ? [id] : [])
      return next
    })
  }, [push])

  const setAllRead = useCallback((ids: string[], value: boolean) => {
    setRead((prev) => {
      const next = { ...prev }
      const changed = ids.filter((id) => !!next[id] !== value)
      ids.forEach((id) => { if (value) next[id] = 1; else delete next[id] })
      ReadingLog.save(next)
      push(value ? changed : [], value ? [] : changed)
      return next
    })
  }, [push])

  /** Whole-list writes — the ones that do not need the previous state. */
  /** Whole-list writes — the ones that do not need the previous state. */
  const commitRead = useCallback((next: ReadMap) => {
    setRead((prev) => {
      ReadingLog.save(next)
      if (accountRef.current) {
        const added = Object.keys(next).filter((id) => !prev[id])
        const removed = Object.keys(prev).filter((id) => !next[id])
        push(added, removed)
      }
      return next
    })
  }, [push])

  const importCsv = useCallback((file: File) => {
    if (!graph) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = PaperCsv.parse(String(reader.result), PaperCsv.index(graph.nodes, paperIds))
      if (!res.ok) { setImportNote(res.error); setImportBad(true); return }
      setImportBad(false)
      setImportNote(res.count + ' of ' + res.rows + ' rows matched' +
        (importMode === 'replace' ? ' · list replaced' : '') +
        (res.ignored.length
          ? ' · not in the tree: ' + res.ignored.slice(0, 4).join(', ') +
            (res.ignored.length > 4 ? ' +' + (res.ignored.length - 4) : '')
          : ''))
      // through commitRead, so an import reaches the account like any other
      // change rather than being a second, forgetful path
      setRead((prev) => {
        commitRead(importMode === 'replace'
          ? { ...res.matched }
          : { ...prev, ...res.matched })
        return prev
      })
    }
    reader.onerror = () => { setImportNote('Could not read that file.'); setImportBad(true) }
    reader.readAsText(file)
  }, [graph, importMode, paperIds, commitRead])

  const exportCsv = useCallback(() => {
    if (!graph) return
    if (!graph.nodes.some((n) => read[n.id])) {
      setImportNote('Nothing is marked read yet.'); setImportBad(true); return
    }
    setImportBad(false)
    setImportNote('')
    exportReadingCsv(graph.nodes, read, paperIds)
  }, [graph, read])

  const clearRead = useCallback(() => {
    commitRead({})
    // one statement rather than 194 deletes, and it is the reader destroying
    // their own data, which they must always be able to do
    if (accountRef.current) clearReading().catch(() => {})
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
      key: kk, label: EDGE_KINDS[kk].short,
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
        onQuerySubmit={() => {
          // the field is a way into the palette, which searches the essays
          // rather than only the names the graph knows
          setSearchOpen(true)
          if (vp.drawer) setControlsOpen(false)
        }}
        readCount={graph ? `${readCount} / ${graph.nodes.length}` : '—'}
        onToggleList={() => setListOpen((v) => !v)}
        onStart={() => setStartOpen(true)}
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
        accountWide={!!account}
        account={accountsAvailable ? (
          <AccountButton
            account={account}
            busy={authBusy}
            compact={vp.drawer}
            onSignIn={() => { setAuthError(null); setSignInOpen(true) }}
            onSignOut={doSignOut}
          />
        ) : undefined}
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
            justifyContent: 'center', color: loadError ? '#d68b7a' : '#7d7568', fontSize: 14.5,
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
                  <div style={{ fontSize: 16.5, lineHeight: 1.15, color: L.c, letterSpacing: '0.02em' }}>{L.label}</div>
                  <div style={{
                    fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
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
            synced={accountsAvailable ? !!account : undefined}
            authNote={authNote}
            width={panelWidth}
            onResize={resizePanel}
            onToggleRead={toggleRead}
            onToggleGroup={setAllRead}
            onClose={() => setListOpen(false)}
          />
        )}

        {searchOpen && (
          <SearchPalette
            index={searchIndex}
            initialQuery={query}
            colours={Object.fromEntries(LANES.map((L) => [L.id, L.c]))}
            onOpen={openResult}
            onClose={() => setSearchOpen(false)}
          />
        )}

        {signInOpen && (
          <SignInDialog
            providers={PROVIDERS}
            busy={authBusy}
            error={authError}
            onPick={doSignIn}
            onClose={() => setSignInOpen(false)}
          />
        )}

        {startOpen && !!courses.length && (
          <StartHere
            courses={courses}
            colours={LANE_COLOURS}
            read={read}
            onPick={(id) => { setWalk({ kind: 'path', id, step: 0 }); setStartOpen(false) }}
            onClose={() => setStartOpen(false)}
          />
        )}

        {panel && !listOpen && (
          <DetailPanel
            panel={panel} sheet={vp.phone}
            walkBar={walking ? (
              <WalkBar
                title={walking.title}
                step={walking.step + 1}
                total={walking.steps.length}
                kind={walking.steps[walking.step]?.kind ?? 'node'}
                onPrev={() => stepBy(-1)}
                onNext={() => stepBy(1)}
                onExit={() => setWalk(null)}
              />
            ) : undefined}
            onTrace={selN && !walking
              ? () => setWalk({ kind: 'trace', id: selN.id, step: 0 })
              : undefined}
            link={window.location.origin + window.location.pathname + toHash(urlState)}
            width={panelWidth} onResize={resizePanel}
            onClose={clearSel}
          />
        )}
      </div>
    </div>
  )
}
