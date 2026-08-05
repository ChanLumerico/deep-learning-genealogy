export const READ_STORE_KEY = 'dlg.reading.v4'

/** the store this replaced, when the browser was the source of truth */
const LEGACY_KEY = 'dlg.reading.v3'

export const READ_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'unread', label: 'Unread' },
] as const

export type ReadFilterId = (typeof READ_FILTERS)[number]['id']
export type ReadMap = Record<string, 1>

/**
 * Reading state belongs to an account, not to a browser.
 *
 * It used to live in localStorage as the source of truth, which meant it
 * survived signing out: one person's reading history left in the browser for
 * whoever opened the page next. On a shared machine that is not a convenience,
 * it is a leak.
 *
 * What is stored here now is a *cache* of one account's list, stamped with
 * that account's id and only ever handed back for the same id. It exists so a
 * signed-in reader sees their ticks the moment the page paints rather than
 * after a round trip, and so a tick made while the network is down is not
 * lost. The server is what the list is; this is a copy.
 *
 * A first visit starts empty and stays empty until someone signs in. The app
 * has never shipped a list of its own and must not start.
 */
export class ReadingLog {
  /** The cached list for this account, and {} for anyone else — nobody included. */
  static load(userId: string | null): ReadMap {
    if (!userId) return {}
    let stored: unknown = null
    try {
      stored = JSON.parse(window.localStorage.getItem(READ_STORE_KEY) || 'null')
    } catch { /* corrupt or unavailable — start clean */ }
    if (!stored || typeof stored !== 'object') return {}
    const { uid, map } = stored as { uid?: unknown; map?: unknown }
    // another account's cache is not ours to read
    if (uid !== userId || !map || typeof map !== 'object') return {}
    return map as ReadMap
  }

  static save(userId: string | null, map: ReadMap) {
    if (!userId) return
    try {
      window.localStorage.setItem(READ_STORE_KEY, JSON.stringify({ uid: userId, map }))
    } catch { /* private mode or quota — the session works, it just won't persist */ }
  }

  /** Signing out takes the copy with it. That is what the stamp is for. */
  static clear() {
    try {
      window.localStorage.removeItem(READ_STORE_KEY)
      window.localStorage.removeItem(LEGACY_KEY)
    } catch { /* nothing to be done */ }
  }
}
