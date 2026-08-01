// ── Searching the essays ──────────────────────────────────────────────────
// Ranking over the index built by tools/gen-search-index.mjs. Pure, so the
// thing that decides what comes first can be argued with in a test rather
// than by typing words into the box and squinting.

/** one searchable entry, in the compact shape the index file stores */
export interface IndexEntry {
  /** 'n' node · 'e' edge */
  k: 'n' | 'e'
  /** lane, so the result can be tinted and the detail file located */
  l: string
  /** node id, or `${from}>${to}` */
  i: string
  t: string
  s: string
  p: string
}

export interface SearchIndex {
  e: IndexEntry[]
  t: Record<string, number[]>
}

export interface Hit {
  entry: IndexEntry
  score: number
  /** which query words were found at all — the rest are shown as missed */
  matched: string[]
}

const STOPPABLE = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it'])

/** Split what someone typed the same way the index was built. */
export function queryTokens(q: string): string[] {
  const raw = String(q ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const useful = raw.filter((t) => t.length > 2 && !STOPPABLE.has(t))
  // "in", "AI", "v2" are all someone can reasonably type; keep them rather
  // than searching for nothing at all
  return useful.length ? useful : raw
}

/**
 * Entries matching `token`, by exact hit and then by prefix.
 *
 * The prefix pass is what makes the box usable while it is still being typed:
 * "diffus" finds "diffusion" before the word is finished. It is capped because
 * a one-letter prefix would otherwise sweep the whole vocabulary.
 */
function lookup(index: SearchIndex, token: string): Map<number, number> {
  const out = new Map<number, number>()
  const exact = index.t[token]
  if (exact) for (const i of exact) out.set(i, 3)
  if (token.length >= 3) {
    for (const word in index.t) {
      if (word === token || !word.startsWith(token)) continue
      // a prefix is weaker evidence than the whole word
      for (const i of index.t[word]) if (!out.has(i)) out.set(i, 1)
    }
  }
  return out
}

/** letters and digits only, for comparing a title against what was typed */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Rank the entries against a query.
 *
 * Every query word must appear somewhere — an AND, because with 440 entries an
 * OR returns most of them and sorts noise to the top. Within that, a hit in
 * the title beats a hit in the body, and matching a whole word beats matching
 * a prefix of one.
 */
export function search(index: SearchIndex, q: string, limit = 40): Hit[] {
  const words = queryTokens(q)
  if (!words.length) return []
  const asked = slug(q)

  const per = words.map((w) => lookup(index, w))
  // AND: start from the rarest word, which is the cheapest set to walk
  const seed = per.reduce((a, b) => (a.size <= b.size ? a : b))
  const hits: Hit[] = []

  for (const [i] of seed) {
    let score = 0
    const matched: string[] = []
    let all = true
    per.forEach((m, w) => {
      const s = m.get(i)
      if (s === undefined) { all = false; return }
      score += s
      matched.push(words[w])
    })
    if (!all) continue

    const e = index.e[i]
    const title = e.t.toLowerCase()
    for (const w of words) {
      if (title.includes(w)) score += 12          // the entry is about this
      else if (e.p.toLowerCase().includes(w)) score += 2   // it is in the opening
    }
    // Naming the thing outright beats mentioning it. Without this, "resnet"
    // led with Inception-ResNet and "transfor" with Decision Transformer:
    // both contain the query in their titles, and nothing then separated
    // them from the model actually being asked for.
    const flat = slug(e.t)
    if (flat === asked || e.i === asked) score += 100
    else if (flat.startsWith(asked)) score += 30
    // a model is what someone usually wants; an arrow is the relationship
    if (e.k === 'n') score += 1
    hits.push({ entry: e, score, matched })
  }

  hits.sort((a, b) =>
    b.score - a.score
    // a shorter title carrying the same words is the more specific answer
    || a.entry.t.length - b.entry.t.length
    || a.entry.t.localeCompare(b.entry.t))
  return hits.slice(0, limit)
}
