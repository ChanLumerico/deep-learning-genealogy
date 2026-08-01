// Sign in, sign out, and what that means — inside the reading list, because
// the reading list is the only thing an account changes.
//
// Signed out it is one line and two buttons; signed in it is who you are and
// a way to leave. Nothing about the graph, the essays or the walks depends on
// it, and the copy says so, because a sign-in prompt on a reference site
// invites the question "what are you going to do with this".

import type { Account, Provider } from '../data/account'

const CAP: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 500, color: '#8a8275',
}

const BTN: React.CSSProperties = {
  flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '0 11px', height: 28, borderRadius: 4,
  border: '1px solid rgba(233,229,221,0.38)', background: 'transparent',
  color: '#dcd6ca', fontSize: 12, letterSpacing: '0.04em', cursor: 'pointer',
}

function GoogleMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flex: 'none' }}>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49C3.8 14.15 3.34 12.9 3.34 12.9c-.36-.92-.88-1.16-.88-1.16-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.21 1.86.86 2.31.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z" />
    </svg>
  )
}

export interface AccountBarProps {
  account: Account | null
  busy: boolean
  note: string | null
  onSignIn: (p: Provider) => void
  onSignOut: () => void
}

export function AccountBar({ account, busy, note, onSignIn, onSignOut }: AccountBarProps) {
  return (
    <div style={{
      marginTop: 12, paddingTop: 11,
      borderTop: '1px solid rgba(233,229,221,0.14)',
    }}>
      {account ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {account.avatar
            ? <img
              src={account.avatar} alt="" width={26} height={26}
              style={{ borderRadius: '50%', flex: 'none' }}
            />
            : <span style={{
              width: 26, height: 26, flex: 'none', borderRadius: '50%',
              border: '1px solid rgba(233,229,221,0.3)',
            }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={CAP}>Synced</div>
            <div style={{
              fontSize: 12, color: '#dcd6ca', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{account.name ?? account.email ?? 'Signed in'}</div>
          </div>
          <button
            style={{ ...BTN, opacity: busy ? 0.5 : 1 }}
            onClick={onSignOut}
            disabled={busy}
          >Sign out</button>
        </div>
      ) : (
        <>
          <div style={CAP}>Keep this list</div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: '#9d9689', margin: '4px 0 8px' }}>
            Sign in and the list follows you to any browser. Nothing else needs
            an account — the graph and the essays are open to everyone.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              style={{ ...BTN, opacity: busy ? 0.5 : 1 }}
              onClick={() => onSignIn('google')} disabled={busy}
            ><GoogleMark />Google</button>
            <button
              style={{ ...BTN, opacity: busy ? 0.5 : 1 }}
              onClick={() => onSignIn('github')} disabled={busy}
            ><GitHubMark />GitHub</button>
          </div>
        </>
      )}

      {note && (
        <div style={{
          fontSize: 10.5, lineHeight: 1.45, marginTop: 8, color: '#8f9c86',
        }}>{note}</div>
      )}
    </div>
  )
}
