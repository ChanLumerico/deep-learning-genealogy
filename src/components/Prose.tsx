// Renders the token tree from view/prose.ts. KaTeX is pulled in on first sight
// of a formula and never before: most of what a reader opens has no maths in
// it, and the library plus its fonts is larger than the rest of this app.

import { useEffect, useState } from 'react'
import { blocks, mathInRuns } from '../view/prose'
import type { Inline } from '../view/prose'

type Katex = typeof import('katex').default

let katex: Katex | null = null
let loading: Promise<Katex | null> | null = null

/** Resolves once KaTeX and its stylesheet are in. Null if either fails. */
function ensureKatex(): Promise<Katex | null> {
  if (katex) return Promise.resolve(katex)
  if (!loading) {
    // Both are code-split by Vite, so nothing here is in the initial bundle —
    // the library and its fonts together outweigh the rest of the app.
    loading = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ])
      .then(([mod]) => {
        katex = mod.default
        return katex
      })
      .catch((e) => {
        // maths then shows as its own TeX source, which still reads
        console.warn('[prose] KaTeX unavailable, falling back to source', e)
        return null
      })
  }
  return loading
}

/** true once KaTeX is usable; triggers the load when a formula is on screen. */
function useKatex(needed: boolean): Katex | null {
  const [ready, setReady] = useState<Katex | null>(katex)
  useEffect(() => {
    if (!needed || ready) return
    let live = true
    ensureKatex().then((k) => { if (live && k) setReady(k) })
    return () => { live = false }
  }, [needed, ready])
  return ready
}

function Tex({ tex, display, k }: { tex: string; display: boolean; k: Katex | null }) {
  if (!k) {
    // pre-load, or KaTeX failed: show the source rather than an empty gap
    return (
      <code style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.92em', color: '#cfc8bb', opacity: 0.75,
        display: display ? 'block' : 'inline', textAlign: display ? 'center' : undefined,
      }}>{tex}</code>
    )
  }
  let html: string
  try {
    html = k.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      // a malformed formula shows in red rather than taking the panel down
      errorColor: '#d68b7a',
      trust: false,
      strict: false,
    })
  } catch {
    return <code>{tex}</code>
  }
  return display
    ? <span className="gx-tex-display" dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />
}

function Run({ x, k }: { x: Inline; k: Katex | null }) {
  switch (x.t) {
    case 'bold':
      return (
        <strong style={{ fontWeight: 600, color: '#f0eadf' }}>
          {x.kids.map((c, i) => <Run key={i} x={c} k={k} />)}
        </strong>
      )
    case 'code':
      return (
        <code style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.9em', padding: '1px 4px', borderRadius: 3,
          background: 'rgba(233,229,221,0.08)', color: '#ded7c9',
        }}>{x.v}</code>
      )
    case 'math':
      return <Tex tex={x.v} display={false} k={k} />
    default:
      return <>{x.v}</>
  }
}

export interface ProseProps {
  body: string
  /** panel body copy is 12.5px; the lead paragraph runs larger */
  size?: number
  color?: string
}

export function Prose({ body, size = 12.5, color = '#cdc6b8' }: ProseProps) {
  const parsed = blocks(body)
  // nested: a formula inside bold still needs KaTeX
  const hasMath = parsed.some(
    (b) => b.t === 'display' || mathInRuns(b.kids).length > 0,
  )
  const k = useKatex(hasMath)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {parsed.map((b, i) => b.t === 'display' ? (
        <div
          key={i}
          // a long derivation must scroll inside itself, never widen the panel
          style={{ overflowX: 'auto', overflowY: 'hidden', padding: '3px 0', maxWidth: '100%' }}
        >
          <Tex tex={b.v} display k={k} />
        </div>
      ) : (
        <p key={i} style={{
          margin: 0, fontSize: size, lineHeight: 1.62, color,
          overflowWrap: 'break-word',
        }}>
          {b.kids.map((x, j) => <Run key={j} x={x} k={k} />)}
        </p>
      ))}
    </div>
  )
}
