// The detail essays are authored as text with maths in them, so the grammar
// that separates the two is the thing most likely to mangle content silently.
// A `_` inside $…$ is a TeX subscript; outside it is nothing. Get that wrong
// and formulas break in ways that only show up on the screen.

import { describe, expect, it } from 'vitest'
import { blocks, inlines, mathIn } from '../src/view/prose'

describe('inline runs', () => {
  it('reads plain text as one run', () => {
    expect(inlines('just words')).toEqual([{ t: 'text', v: 'just words' }])
  })

  it('pulls maths, bold and code out of a sentence', () => {
    expect(inlines('scale by $\\sqrt{d_k}$ then **softmax** the `logits`')).toEqual([
      { t: 'text', v: 'scale by ' },
      { t: 'math', v: '\\sqrt{d_k}' },
      { t: 'text', v: ' then ' },
      { t: 'bold', kids: [{ t: 'text', v: 'softmax' }] },
      { t: 'text', v: ' the ' },
      { t: 'code', v: 'logits' },
    ])
  })

  // The regression: bold used to be matched flat, so it swallowed any formula
  // inside it and the panel rendered a literal `$j$` on the page.
  it('keeps maths as maths when it sits inside bold', () => {
    expect(inlines('**one step, for any $j$**')).toEqual([{
      t: 'bold',
      kids: [
        { t: 'text', v: 'one step, for any ' },
        { t: 'math', v: 'j' },
      ],
    }])
  })

  it('keeps code as code inside bold', () => {
    expect(inlines('**call `fit()` first**')).toEqual([{
      t: 'bold',
      kids: [
        { t: 'text', v: 'call ' },
        { t: 'code', v: 'fit()' },
        { t: 'text', v: ' first' },
      ],
    }])
  })

  it('does not let bold reach inside maths', () => {
    // `**` here is TeX (a double superscript), not an emphasis marker
    expect(inlines('$a^{**}$ and **b**')).toEqual([
      { t: 'math', v: 'a^{**}' },
      { t: 'text', v: ' and ' },
      { t: 'bold', kids: [{ t: 'text', v: 'b' }] },
    ])
  })

  it('leaves TeX alone inside maths', () => {
    // `_` and `*` are TeX here, not markup — this is the case that breaks
    // formulas if the parser gets greedy
    const got = inlines('$a_1 * b^{**} + x_i$')
    expect(got).toEqual([{ t: 'math', v: 'a_1 * b^{**} + x_i' }])
  })

  it('honours an escaped dollar', () => {
    expect(inlines('costs \\$5 to run')).toEqual([{ t: 'text', v: 'costs $5 to run' }])
  })

  it('does not treat an unpaired dollar as maths', () => {
    expect(inlines('a $ b')).toEqual([{ t: 'text', v: 'a $ b' }])
  })
})

describe('blocks', () => {
  it('splits paragraphs on a blank line', () => {
    const got = blocks('first para\n\nsecond para')
    expect(got.map((b) => b.t)).toEqual(['p', 'p'])
  })

  it('lifts display maths out as its own block', () => {
    const got = blocks('before\n\n$$ E = mc^2 $$\n\nafter')
    expect(got).toEqual([
      { t: 'p', kids: [{ t: 'text', v: 'before' }] },
      { t: 'display', v: 'E = mc^2' },
      { t: 'p', kids: [{ t: 'text', v: 'after' }] },
    ])
  })

  it('keeps a multi-line display formula in one piece', () => {
    // a blank line inside $$…$$ must not split the formula
    const got = blocks('$$\n\\begin{aligned}\na &= b \\\\\n\nc &= d\n\\end{aligned}\n$$')
    expect(got).toHaveLength(1)
    expect(got[0].t).toBe('display')
    if (got[0].t === 'display') expect(got[0].v).toContain('\\begin{aligned}')
  })

  it('does not mistake two inline formulas for one display block', () => {
    const got = blocks('$a$ and $b$')
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual({
      t: 'p',
      kids: [
        { t: 'math', v: 'a' },
        { t: 'text', v: ' and ' },
        { t: 'math', v: 'b' },
      ],
    })
  })

  it('drops empty paragraphs rather than rendering blank gaps', () => {
    expect(blocks('\n\n\n  \n\n')).toEqual([])
  })
})

describe('mathIn', () => {
  it('finds every formula in a body, inline and display', () => {
    expect(mathIn('text $a$ more\n\n$$b$$\n\ntail $c$')).toEqual(['a', 'b', 'c'])
  })

  it('returns nothing for prose without maths', () => {
    expect(mathIn('no formulas here at all')).toEqual([])
  })
})
