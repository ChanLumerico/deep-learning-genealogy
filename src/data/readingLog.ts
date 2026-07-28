import { READ_SEED } from './papers'

export const READ_STORE_KEY = 'dlg.reading.v3'

export const READ_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'unread', label: 'Unread' },
] as const

export type ReadFilterId = (typeof READ_FILTERS)[number]['id']
export type ReadMap = Record<string, 1>

/** Reading state lives in localStorage under one key of our own. */
export class ReadingLog {
  static load(): ReadMap {
    let stored: unknown = null
    try {
      stored = JSON.parse(window.localStorage.getItem(READ_STORE_KEY) || 'null')
    } catch { /* corrupt or unavailable — fall through to the seed */ }
    if (stored && typeof stored === 'object') return stored as ReadMap
    const seed: ReadMap = {}
    READ_SEED.forEach((id) => { seed[id] = 1 })
    return seed
  }

  static save(map: ReadMap) {
    try {
      window.localStorage.setItem(READ_STORE_KEY, JSON.stringify(map))
    } catch { /* private mode or quota — the session still works, it just won't persist */ }
  }
}
