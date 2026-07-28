export const READ_STORE_KEY = 'dlg.reading.v3'

export const READ_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'unread', label: 'Unread' },
] as const

export type ReadFilterId = (typeof READ_FILTERS)[number]['id']
export type ReadMap = Record<string, 1>

/**
 * Reading state lives in localStorage under one key of our own — per browser,
 * per visitor. A first visit starts empty: nothing counts as read until the
 * reader ticks a row or uploads a CSV. The app ships no list of its own.
 *
 * This used to seed every paper in PAPERS as already read, which handed one
 * person's reading history to everyone who opened the page.
 */
export class ReadingLog {
  static load(): ReadMap {
    let stored: unknown = null
    try {
      stored = JSON.parse(window.localStorage.getItem(READ_STORE_KEY) || 'null')
    } catch { /* corrupt or unavailable — start clean */ }
    if (stored && typeof stored === 'object') return stored as ReadMap
    return {}
  }

  static save(map: ReadMap) {
    try {
      window.localStorage.setItem(READ_STORE_KEY, JSON.stringify(map))
    } catch { /* private mode or quota — the session still works, it just won't persist */ }
  }
}
