// The way in.
//
// 189 boxes and no suggestion of where to begin is a hard first minute, and
// the essays are the reason to be here — so the entry point offers courses
// rather than a search box. Two levels: a field, then a journey through it,
// then the walk itself. Wide rather than tall, floating over a blurred sheet,
// so it reads as a syllabus laid on the table and not as another panel.

import { useState } from 'react'
import { courseProgress, progressOf } from '../view/walk'
import type { Progress, WalkCourse, WalkPath } from '../view/walk'

const CAP: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8275',
}

export interface StartHereProps {
  courses: WalkCourse[]
  /** lane colour per field id, so a card is recognisably its part of the sheet */
  colours: Record<string, string>
  /** the visitor's reading list — what has actually been read */
  read: Record<string, unknown>
  onPick: (pathId: string) => void
  onClose: () => void
}

export function StartHere({ courses, colours, read, onPick, onClose }: StartHereProps) {
  const [open, setOpen] = useState<string | null>(null)
  const field = courses.find((c) => c.id === open) ?? null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 4vw, 44px)',
        background: 'rgba(8,10,14,0.66)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // wide, and smaller than the sheet it sits on
          width: '100%', maxWidth: 1040, maxHeight: '84dvh',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11,14,18,0.98)',
          border: '1px solid rgba(233,229,221,0.22)', borderRadius: 8,
          boxShadow: '0 30px 80px rgba(0,0,0,0.62)',
        }}
      >
        {/* ── header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 14, padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(233,229,221,0.14)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={CAP}>{field ? field.kicker : 'Start here'}</div>
            <div style={{ fontSize: 22, color: '#f2ece1', lineHeight: 1.2, marginTop: 5 }}>
              {field ? field.title : 'Choose a field, then a journey through it'}
            </div>
            <div style={{
              fontSize: 12.5, lineHeight: 1.6, color: '#9d9689', marginTop: 7, maxWidth: 720,
            }}>
              {field ? field.blurb : (
                'Every journey walks a chain of models in order, stopping at each '
                + 'arrow to say what the next one fixed about the last. That is the '
                + 'argument this whole graph is making.'
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            {field && (
              <button
                className="gx-close" onClick={() => setOpen(null)}
                style={{ height: 28, padding: '0 11px', fontSize: 11.5 }}
              >← All fields</button>
            )}
            <button
              className="gx-close" onClick={onClose} aria-label="Close"
              style={{ width: 28, height: 28, fontSize: 15 }}
            >×</button>
          </div>
        </div>

        {/* ── cards ──────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
          padding: '18px 24px 24px',
          display: 'grid', gap: 12,
          // as many columns as fit; one on a phone, three on a laptop
          gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
          alignContent: 'start',
        }}>
          {!field && courses.map((c) => {
            const pr = courseProgress(c, read)
            return (
              <Card
                key={c.id}
                accent={colours[c.id]}
                kicker={c.kicker}
                title={c.title}
                blurb={c.blurb}
                foot={`${pr.done} of ${pr.total} journeys finished`}
                progress={pr}
                onClick={() => setOpen(c.id)}
              />
            )
          })}

          {field && field.courses.map((p: WalkPath) => {
            const pr = progressOf(p.nodes, read)
            return (
              <Card
                key={p.id}
                accent={colours[field.id]}
                kicker={`${p.nodes.length} models · ${p.nodes.length * 2 - 1} steps`}
                title={p.title}
                blurb={p.blurb}
                foot={`${pr.done} / ${pr.total} read`}
                progress={pr}
                onClick={() => onPick(p.id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Card(p: {
  accent?: string
  kicker: string
  title: string
  blurb: string
  foot: string
  /** measured against the reading list; complete earns the tick */
  progress: Progress
  onClick: () => void
}) {
  const accent = p.accent ?? 'rgba(233,229,221,0.4)'
  const { done, total, complete } = p.progress
  return (
    <button
      className="gx-hover"
      onClick={p.onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 7,
        textAlign: 'left', padding: '14px 15px 12px',
        background: 'transparent', cursor: 'pointer',
        border: '1px solid rgba(233,229,221,0.16)',
        borderTop: `2px solid ${accent}`,
        borderRadius: 5, font: 'inherit', color: 'inherit',
        minHeight: 148, position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ ...CAP, color: accent, flex: 1, minWidth: 0 }}>{p.kicker}</div>
        {complete && (
          <span
            title="Every model in this one is marked read"
            style={{
              flex: 'none', width: 17, height: 17, borderRadius: 3,
              border: `1px solid ${accent}`, background: accent + '2e', color: accent,
              fontSize: 11, lineHeight: '15px', textAlign: 'center',
            }}
          >✓</span>
        )}
      </div>
      <div style={{ fontSize: 15.5, color: '#ece6da', lineHeight: 1.25 }}>{p.title}</div>
      <div style={{
        fontSize: 11.5, lineHeight: 1.6, color: '#9d9689', flex: 1,
      }}>{p.blurb}</div>

      {/* a bar rather than only a count: the shape of it is legible at a glance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          flex: 1, height: 3, borderRadius: 2, overflow: 'hidden',
          background: 'rgba(233,229,221,0.14)',
        }}>
          <span style={{
            display: 'block', height: '100%',
            width: `${total ? (done / total) * 100 : 0}%`,
            background: accent, opacity: complete ? 1 : 0.66,
          }} />
        </span>
        <span style={{
          flex: 'none', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: complete ? accent : '#7d7568', fontVariantNumeric: 'tabular-nums',
        }}>{p.foot}</span>
      </div>
    </button>
  )
}
