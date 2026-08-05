// The account control: under the title, in the slot the timeline used to have.
//
// It was pinned to the top-right corner first, which meant reserving width
// from a row that had none to give. The bar's three groups need 1336px side by
// side, so a 1440-wide window has 64px spare and the reserve pushed the whole
// bar onto a second line. Here the title already sets this group's width and
// the space beneath it was going spare, so the control costs nothing and has
// nothing to collide with.
//
// Signed out it is one button. Signed in it is who you are, and a menu holding
// the one thing you might want next.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Account } from '../data/account'

/**
 * The chip's cap. With the whole width of the title block to sit in, a name
 * has room to be a name rather than being cut to fit a corner. The email is
 * in the menu either way.
 */
const CHIP_MAX = 264

/** the state, said out loud — the caption is how this bar labels everything */
const SIGNED_IN_TINT = '#8f9c86'

export interface AccountButtonProps {
  /** null when signed out */
  account: Account | null
  busy: boolean
  /** phone: the avatar alone, since the strip already carries a title */
  compact?: boolean
  onSignIn: () => void
  onSignOut: () => void
}

function Avatar({ src, size }: { src: string | null; size: number }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src} alt="" width={size} height={size} onError={() => setFailed(true)}
        style={{ borderRadius: '50%', flex: 'none', objectFit: 'cover' }}
      />
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }} aria-hidden>
      <circle cx="12" cy="12" r="11.2" fill="none" stroke="rgba(233,229,221,0.34)" />
      <circle cx="12" cy="9.6" r="3.5" fill="rgba(233,229,221,0.5)" />
      <path d="M5.6 19.6a6.7 6.7 0 0 1 12.8 0" fill="rgba(233,229,221,0.5)" />
    </svg>
  )
}

export function AccountButton(p: AccountButtonProps) {
  const [menu, setMenu] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState({ top: 0, right: 0 })

  // The menu is positioned fixed against the button's own rect rather than
  // nested under it. On a phone the top bar scrolls itself, and a nested
  // absolute menu would be clipped by that scroller.
  useLayoutEffect(() => {
    if (!menu) return
    const r = btn.current?.getBoundingClientRect()
    if (r) setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const away = (ev: PointerEvent) => {
      if (!(ev.target as HTMLElement | null)?.closest('[data-account]')) setMenu(false)
    }
    const esc = (ev: KeyboardEvent) => {
      // stop it before the app's global handler, or Escape would close the
      // menu and back out of the selection in the same press
      if (ev.key === 'Escape') { setMenu(false); ev.stopPropagation() }
    }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', esc, true)
    }
  }, [menu])

  const who = p.account?.name ?? p.account?.email ?? null

  // Captioned and stacked, because that is the shape of every other group in
  // this bar — Domains, Edges, Reading, View. Without the caption this was the
  // one control aligned to nothing, which is exactly what it looked like.
  const framed = (control: React.ReactNode) => (p.compact ? control : (
    <div className="gx-field" style={{ alignItems: 'flex-start' }}>
      <div className="gx-cap" style={{ color: p.account ? SIGNED_IN_TINT : undefined }}>
        {p.account ? 'Signed in' : 'Account'}
      </div>
      {control}
    </div>
  ))

  if (!p.account) {
    return framed(
      <button
        data-account
        className="gx-btn gx-tap"
        onClick={p.onSignIn}
        disabled={p.busy}
        style={{
          height: 30, padding: '0 13px',
          background: 'rgba(233,229,221,0.1)',
          border: '1px solid rgba(233,229,221,0.42)', color: '#dcd6ca',
          letterSpacing: '0.06em', opacity: p.busy ? 0.5 : 1,
        }}
      >Sign in</button>,
    )
  }

  return (
    <>
      {framed(
      <button
        data-account
        ref={btn}
        onClick={() => setMenu((v) => !v)}
        aria-expanded={menu}
        aria-label={`Signed in as ${who ?? 'your account'}`}
        title={p.compact ? `Signed in as ${who ?? 'your account'}` : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          maxWidth: p.compact ? undefined : CHIP_MAX,
          height: 30, padding: p.compact ? 2 : '0 8px 0 4px',
          borderRadius: p.compact ? '50%' : 15,
          // tinted rather than neutral: signed in is a state, and the bar has
          // no other way to show one
          border: `1px solid ${p.account ? 'rgba(143,156,134,0.5)' : 'rgba(233,229,221,0.34)'}`,
          background: menu ? 'rgba(143,156,134,0.2)' : 'rgba(143,156,134,0.1)',
          color: '#e6e0d4', font: 'inherit', cursor: 'pointer',
        }}
      >
        <Avatar src={p.account.avatar} size={22} />
        {!p.compact && (
          <>
            <span style={{
              fontSize: 12.5, letterSpacing: '0.02em', minWidth: 0, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textAlign: 'left',
            }}>{who ?? 'Signed in'}</span>
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ flex: 'none', opacity: 0.7 }} aria-hidden
            ><path d="m5 9 7 7 7-7" /></svg>
          </>
        )}
      </button>,
      )}

      {menu && (
        <div
          data-account
          role="menu"
          style={{
            position: 'fixed', top: at.top, right: at.right, zIndex: 60, width: 232,
            background: 'rgba(11,14,18,0.99)',
            border: '1px solid rgba(233,229,221,0.22)', borderRadius: 6,
            boxShadow: '0 18px 44px rgba(0,0,0,0.6)', padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Avatar src={p.account.avatar} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, color: '#ece6da', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{who ?? 'Signed in'}</div>
              {p.account.email && p.account.email !== who && (
                <div style={{
                  fontSize: 11, color: '#8a8275', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.account.email}</div>
              )}
            </div>
          </div>

          <div style={{
            fontSize: 10.5, lineHeight: 1.5, color: '#7d7568',
            margin: '11px 0', paddingTop: 10,
            borderTop: '1px solid rgba(233,229,221,0.12)',
          }}>
            Your reading list is saved to this account and will be here on any
            browser you sign in from.
          </div>

          <button
            role="menuitem"
            onClick={() => { setMenu(false); p.onSignOut() }}
            disabled={p.busy}
            style={{
              width: '100%', height: 30, borderRadius: 4,
              border: '1px solid rgba(233,229,221,0.3)', background: 'transparent',
              color: '#dcd6ca', font: 'inherit', fontSize: 12,
              letterSpacing: '0.05em', cursor: 'pointer', opacity: p.busy ? 0.5 : 1,
            }}
          >Sign out</button>
        </div>
      )}
    </>
  )
}
