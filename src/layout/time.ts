import { YEAR_X } from './spec'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export class TimeScale {
  constructor(readonly table: Array<[number, number]>) {}

  get min() { return this.table[0][1] }
  get max() { return this.table[this.table.length - 1][1] }

  // px along the canvas → fractional year. Sparse decades are compressed in the
  // table, so a fixed slider step covers many years there and only months in 2023+.
  yearAt(x: number): number {
    const t = this.table
    if (x <= t[0][1]) return t[0][0]
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1]
      if (x <= b[1]) return a[0] + (b[0] - a[0]) * (x - a[1]) / (b[1] - a[1])
    }
    return t[t.length - 1][0]
  }

  static label(frac: number): string {
    const y = Math.floor(frac)
    const m = Math.min(11, Math.max(0, Math.floor((frac - y) * 12)))
    return y + ' · ' + MONTHS[m]
  }

  x(year: number): number {
    const t = this.table
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1]
      if (year <= a[0]) return a[1]
      if (year <= b[0]) return a[1] + (b[1] - a[1]) * (year - a[0]) / (b[0] - a[0])
    }
    return t[t.length - 1][1]
  }
}

export const TIME = new TimeScale(YEAR_X)
export function xOf(year: number): number { return TIME.x(year) }
