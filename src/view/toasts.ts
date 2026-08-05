// ── Transient notices ─────────────────────────────────────────────────────
// Ticking a row, signing in, an import: things that happen somewhere other
// than where you are looking. The reading panel carried the wording, which
// meant a change made from the sheet reported itself into a closed drawer.
//
// The queue is here rather than in the component so the rules that matter —
// how many at once, how long, what happens when the same thing is said twice
// in a row — are asserted rather than watched for.

export type Tone = 'info' | 'good' | 'bad'

export interface Toast {
  id: number
  text: string
  tone: Tone
}

/**
 * How long each stays. A failure gets twice as long as a confirmation: one is
 * telling you what you already know happened, the other is telling you
 * something you did not ask about and may need to act on.
 */
export const TOAST_MS: Record<Tone, number> = { info: 2600, good: 2600, bad: 5200 }

/** More than this on screen and it stops being a notice and becomes a log. */
export const MAX = 3

/**
 * Add one, newest last.
 *
 * An identical message replacing the newest rather than stacking under it is
 * what keeps toggling one row on and off from filling the screen with three
 * copies of the same sentence — and it restarts that notice's timer, which is
 * the behaviour you want anyway.
 */
export function push(list: Toast[], t: Toast): Toast[] {
  const last = list[list.length - 1]
  const kept = last && last.text === t.text ? list.slice(0, -1) : list
  return [...kept, t].slice(-MAX)
}

export const drop = (list: Toast[], id: number): Toast[] =>
  list.filter((t) => t.id !== id)

/** "12 marked read" — plural where it has to be, and never "1 models". */
export const countPhrase = (n: number, verb: string) =>
  `${n} ${n === 1 ? 'paper' : 'papers'} ${verb}`
