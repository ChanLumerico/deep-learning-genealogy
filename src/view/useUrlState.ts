// Keeps the address bar and the app in step, in both directions.
//
// Two directions means two ways to loop: writing a URL must not look like the
// user navigating, and reading one must not look like the app changing. The
// guard is a single ref holding the hash we last wrote — anything matching it
// is our own echo and is ignored.

import { useEffect, useRef } from 'react'
import { isNavigation, parseHash, sameUrl, toHash } from './url'
import type { UrlState } from './url'

export interface UrlSync {
  /** the app's current shareable state */
  state: UrlState
  /** apply a link — called on first load and on back/forward */
  apply: (s: UrlState) => void
}

export function useUrlState({ state, apply }: UrlSync, ready: boolean) {
  const mine = useRef<string | null>(null)
  const last = useRef<UrlState | null>(null)
  const applyRef = useRef(apply)
  applyRef.current = apply

  // ── read: the link the page was opened with, then every back/forward ─────
  useEffect(() => {
    if (!ready) return
    const read = () => {
      const hash = window.location.hash
      if (hash === mine.current) return   // our own write coming back round
      const next = parseHash(hash)
      last.current = next
      applyRef.current(next)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [ready])

  // ── write: mirror the app back into the address bar ──────────────────────
  useEffect(() => {
    if (!ready) return
    const prev = last.current
    if (prev && sameUrl(prev, state)) return
    const hash = toHash(state)
    if (hash === window.location.hash) { last.current = state; return }
    mine.current = hash
    // Selecting something is a place you can go back from. Nudging the
    // timeline is not — replacing keeps one exploration from burying the
    // page the reader arrived from under fifty entries.
    const url = window.location.pathname + window.location.search + hash
    if (prev && !isNavigation(prev, state)) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    last.current = state
  }, [state, ready])
}
