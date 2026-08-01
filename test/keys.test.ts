// Keyboard movement over the sheet. Pure, so the awkward cases — the end of a
// lane, a model with two parents, a root with none — are settled here rather
// than by pressing arrows and watching.

import { describe, expect, it } from 'vitest'
import { move } from '../src/view/keys'
import type { KeyEdge, KeyNode } from '../src/view/keys'

const n = (id: string, lane: string, year: number, x: number): KeyNode =>
  ({ id, lane, year, x })
const e = (from: string, to: string, kind = 'direct'): KeyEdge => ({ from, to, kind })

//  cv:   a(1990) ── b(2000) ── c(2010)
//  nlp:  d(1995)
const nodes = [
  n('a', 'cv', 1990, 100), n('b', 'cv', 2000, 200), n('c', 'cv', 2010, 300),
  n('d', 'nlp', 1995, 150),
]
const edges = [e('a', 'b'), e('b', 'c')]

describe('starting out', () => {
  it('lands on the oldest model when nothing is selected', () => {
    expect(move(nodes, edges, null, 'right')).toBe('a')
    expect(move(nodes, edges, null, 'down')).toBe('a')
  })

  it('has nowhere to go on an empty sheet', () => {
    expect(move([], [], null, 'right')).toBe(null)
  })

  it('ignores a selection the graph does not have', () => {
    expect(move(nodes, edges, 'ghost', 'right')).toBe(null)
  })
})

describe('left and right run along time, within a lane', () => {
  it('steps forward and back', () => {
    expect(move(nodes, edges, 'a', 'right')).toBe('b')
    expect(move(nodes, edges, 'b', 'right')).toBe('c')
    expect(move(nodes, edges, 'c', 'left')).toBe('b')
  })

  it('stops at the ends rather than wrapping', () => {
    // wrapping to the far end would feel like a jump, not a step
    expect(move(nodes, edges, 'c', 'right')).toBe(null)
    expect(move(nodes, edges, 'a', 'left')).toBe(null)
  })

  it('never crosses into another lane', () => {
    // d sits between a and b in time but belongs to nlp
    expect(move(nodes, edges, 'a', 'right')).toBe('b')
    expect(move(nodes, edges, 'd', 'right')).toBe(null)
  })

  it('is reversible', () => {
    const there = move(nodes, edges, 'a', 'right')!
    expect(move(nodes, edges, there, 'left')).toBe('a')
  })
})

describe('up and down run along descent', () => {
  it('climbs to a parent and descends to a child', () => {
    expect(move(nodes, edges, 'b', 'up')).toBe('a')
    expect(move(nodes, edges, 'b', 'down')).toBe('c')
  })

  it('stops at a root and at a leaf', () => {
    expect(move(nodes, edges, 'a', 'up')).toBe(null)
    expect(move(nodes, edges, 'c', 'down')).toBe(null)
  })

  it('follows a borrowed idea as well as a direct line', () => {
    expect(move(nodes, [e('d', 'b', 'cross')], 'b', 'up')).toBe('d')
    expect(move(nodes, [e('d', 'b', 'fusion')], 'b', 'up')).toBe('d')
  })

  it('never follows an alternative — that is a rival, not a parent', () => {
    expect(move(nodes, [e('d', 'b', 'alt')], 'b', 'up')).toBe(null)
  })

  it('takes the earliest when there are several, so presses are stable', () => {
    const many = [e('a', 'c'), e('d', 'c')]
    expect(move(nodes, many, 'c', 'up')).toBe('a')   // a is at x=100, d at 150
    expect(move(nodes, many, 'c', 'up')).toBe('a')
  })
})
