// The account control, pinned to the top-right corner and never moving.
//
// It sits *outside* the top bar's flex flow, because that flow is sized by its
// contents and wraps as a whole — dropping another item into it is how the bar
// used to lose a button to a second line. The bar reserves the corner instead
// (see WIDTH below), so the two cannot collide.
//
// Signed out it is one button. Signed in it is who you are, and a menu holding
// the one thing you might want next.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Account } from '../data/account'

/**
 * What the top bar keeps clear for this. Exported so there is one number
 * rather than a literal here and a guess there — the reserve is wider when
 * signed in because the chip then carries a name.
 */
export const ACCOUNT_WIDTH = { out: 92, in: 176 }

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

  if (!p.account) {
    return (
      <button
        data-account
        className="gx-btn gx-tap"
        onClick={p.onSignIn}
        disabled={p.busy}
        style={{
          flex: '0 0 auto', height: 30, padding: '0 13px',
          background: 'rgba(233,229,221,0.1)',
          border: '1px solid rgba(233,229,221,0.42)', color: '#dcd6ca',
          letterSpacing: '0.06em', opacity: p.busy ? 0.5 : 1,
        }}
      >Sign in</button>
    )
  }

  const who = p.account.name ?? p.account.email ?? 'Signed in'

  return (
    <>
      <button
        data-account
        ref={btn}
        onClick={() => setMenu((v) => !v)}
        aria-expanded={menu}
        aria-label={`Signed in as ${who}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto',
          maxWidth: p.compact ? undefined : ACCOUNT_WIDTH.in,
          height: 30, padding: p.compact ? 2 : '0 9px 0 5px',
          borderRadius: p.compact ? '50%' : 15,
          border: '1px solid rgba(233,229,221,0.34)',
          background: menu ? 'rgba(233,229,221,0.14)' : 'rgba(233,229,221,0.06)',
          color: '#dcd6ca', font: 'inherit', cursor: 'pointer',
        }}
      >
        <Avatar src={p.account.avatar} size={22} />
        {!p.compact && (
          <span style={{
            fontSize: 12, letterSpacing: '0.02em', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{who}</span>
        )}
      </button>

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
              }}>{who}</div>
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
