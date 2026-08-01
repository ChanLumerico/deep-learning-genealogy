// Search over the essays.
//
// A palette rather than a dropdown under the top bar, for two reasons: the bar
// is a scrolling drawer on a phone and would clip one, and the results want
// more room than the field they came from. It is reachable with `/` or ⌘K, and
// the arrow keys move through the results, so the whole feature works without
// a mouse.

import { useEffect, useMemo, useRef, useState } from 'react'
import { search } from '../view/search'
import type { SearchIndex } from '../view/search'

const CAP: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8275',
}

export interface SearchPaletteProps {
  /** null while the index is still being fetched */
  index: SearchIndex | null
  initialQuery: string
  /** lane colour per lane id, so a result is tinted like its part of the sheet */
  colours: Record<string, string>
  onOpen: (kind: 'n' | 'e', id: string) => void
  onClose: () => void
}

export function SearchPalette({
  index, initialQuery, colours, onOpen, onClose,
}: SearchPaletteProps) {
  const [q, setQ] = useState(initialQuery)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => (index ? search(index, q, 60) : []), [index, q])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setCursor(0) }, [q])

  // keep the highlighted row on screen while the arrows walk past the fold
  useEffect(() => {
    listRef.current?.querySelector('[data-cursor]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const commit = (i: number) => {
    const h = hits[i]
    if (h) onOpen(h.entry.k, h.entry.i)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { setCursor((c) => Math.min(hits.length - 1, c + 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setCursor((c) => Math.max(0, c - 1)); e.preventDefault() }
    else if (e.key === 'Enter') { commit(cursor); e.preventDefault() }
    else if (e.key === 'Escape') { onClose(); e.preventDefault() }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'clamp(12px, 6vh, 72px) clamp(12px, 4vw, 44px)',
        background: 'rgba(8,10,14,0.66)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        style={{
          width: '100%', maxWidth: 760, maxHeight: '80dvh',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11,14,18,0.98)',
          border: '1px solid rgba(233,229,221,0.22)', borderRadius: 8,
          boxShadow: '0 30px 80px rgba(0,0,0,0.62)',
        }}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(233,229,221,0.14)' }}>
          <input
            ref={inputRef}
            className="gx-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 213,000 words — a model, or an idea"
            aria-label="Search the entries"
            style={{ height: 38, fontSize: 15 }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9,
          }}>
            <span style={CAP}>
              {!index ? 'Loading the index…'
                : !q.trim() ? 'Every model, every lineage, and the essays behind them'
                : `${hits.length} ${hits.length === 1 ? 'result' : 'results'}`}
            </span>
            <span style={{ ...CAP, letterSpacing: '0.1em' }}>↑↓ move · ↵ open · esc close</span>
          </div>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px 0 10px',
          }}
        >
          {q.trim() && !hits.length && index && (
            <div style={{ padding: '20px 18px', fontSize: 12.5, color: '#9d9689' }}>
              Nothing matches every word of that. Try one word, or a phrase from
              the passage you are thinking of.
            </div>
          )}

          {hits.map((h, i) => {
            const accent = colours[h.entry.l] ?? '#9fa9b5'
            const on = i === cursor
            return (
              <div
                key={`${h.entry.k}:${h.entry.i}`}
                data-cursor={on ? '' : undefined}
                onClick={() => commit(i)}
                onMouseMove={() => setCursor(i)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  padding: '9px 18px', cursor: 'pointer',
                  borderLeft: `2px solid ${on ? accent : 'transparent'}`,
                  background: on ? 'rgba(233,229,221,0.06)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{ fontSize: 14, color: '#ece6da' }}>{h.entry.t}</span>
                  <span style={{
                    ...CAP, color: accent, flex: 'none',
                  }}>{h.entry.k === 'n' ? 'model' : 'lineage'}</span>
                  <span style={{
                    fontSize: 10.5, color: '#6f6759', marginLeft: 'auto',
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  }}>{h.entry.s}</span>
                </div>
                <div style={{
                  fontSize: 11.5, lineHeight: 1.5, color: '#9d9689',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>{h.entry.p}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
