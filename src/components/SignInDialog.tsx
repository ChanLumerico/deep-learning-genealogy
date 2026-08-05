// The sign-in dialog — centred over a blurred sheet, the way anyone expects a
// sign-in to look. It exists because the account control has to live somewhere
// permanent, and a corner button is the wrong size for explaining what an
// account is for.
//
// What it says matters as much as what it does. This is a reference site: a
// sign-in prompt raises the question of what is being collected, so the answer
// is on the card rather than behind a link.

import { useEffect, useRef } from 'react'
import type { Provider } from '../data/account'

const CAP: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 500, color: '#8a8275',
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flex: 'none' }} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ flex: 'none' }} aria-hidden>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49C3.8 14.15 3.34 12.9 3.34 12.9c-.36-.92-.88-1.16-.88-1.16-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.21 1.86.86 2.31.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z" />
    </svg>
  )
}

const LABEL: Record<Provider, string> = { google: 'Google', github: 'GitHub' }
const MARK: Record<Provider, () => React.ReactElement> = { google: GoogleMark, github: GitHubMark }

export interface SignInDialogProps {
  providers: Provider[]
  busy: boolean
  error: string | null
  onPick: (p: Provider) => void
  onClose: () => void
}

export function SignInDialog({ providers, busy, error, onPick, onClose }: SignInDialogProps) {
  // Focus the first provider so the dialog is operable from the keyboard the
  // moment it opens, like the search palette.
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 5vw, 44px)',
        background: 'rgba(8,10,14,0.66)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 384,
          background: 'rgba(11,14,18,0.98)',
          border: '1px solid rgba(233,229,221,0.22)', borderRadius: 8,
          boxShadow: '0 30px 80px rgba(0,0,0,0.62)',
          padding: '22px 24px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={CAP}>Reading list</div>
            <div style={{ fontSize: 21, color: '#f2ece1', lineHeight: 1.2, marginTop: 5 }}>
              Sign in
            </div>
          </div>
          <button
            className="gx-close" onClick={onClose} aria-label="Close"
            style={{ width: 28, height: 28, fontSize: 15, flex: 'none' }}
          >×</button>
        </div>

        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#9d9689', margin: '9px 0 16px' }}>
          Your reading list is kept in this browser. Sign in and it follows you
          to any other one. Nothing else here needs an account — the graph, the
          essays and the walks are open to everyone.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map((id, i) => {
            const Mark = MARK[id]
            return (
              <button
                key={id}
                ref={i === 0 ? first : undefined}
                onClick={() => onPick(id)}
                disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', height: 42, borderRadius: 5,
                  border: '1px solid rgba(233,229,221,0.38)', background: 'transparent',
                  color: '#e6e0d4', font: 'inherit', fontSize: 13.5, letterSpacing: '0.03em',
                  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
                }}
              >
                <Mark />
                Continue with {LABEL[id]}
              </button>
            )
          })}
        </div>

        {error && (
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#d68b7a', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{
          fontSize: 10.5, lineHeight: 1.55, color: '#7d7568',
          marginTop: 16, paddingTop: 13, borderTop: '1px solid rgba(233,229,221,0.12)',
        }}>
          Stored: which models you have marked read, and nothing else. Signing
          out leaves this browser's copy untouched.
        </div>
      </div>
    </div>
  )
}
