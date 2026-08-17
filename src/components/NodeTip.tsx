import type { NodeModel } from '../layout'

export interface NodeTipProps {
  node: NodeModel
  x: number
  y: number
}

export function NodeTip({ node, x, y }: NodeTipProps) {
  const c = node.lane.c
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: 302, pointerEvents: 'none',
      background: 'rgba(9,12,16,0.97)', border: `1px solid ${c}`, borderRadius: 4,
      padding: '12px 14px 11px', boxShadow: '0 10px 34px rgba(0,0,0,0.55)',
      // the belt to the braces below: with the header fixed nothing should
      // reach this, but a card that clips is still better than one that spills
      overflow: 'hidden',
    }}>
      {/* The name and the meta share a row, and for 27 of the 211 models they
          do not both fit in it. A flex child defaults to `min-width: auto`, so
          the name could not shrink and the nowrap meta could not either: the
          pair simply ran past the border — "Decision Transformer · 2021 · UC
          Berkeley · FAIR" wants ~380px of a 274px row.

          `minWidth: 0` lets the name shrink, `flexWrap` lets the meta fall to a
          line of its own when it still will not fit, and `marginLeft: auto`
          keeps it right-aligned when it lands there. The 55% floor decides
          which of the two gives way first — the name keeps the row and the
          meta moves, rather than the name being squeezed to a column. */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: 21, color: '#f2ece1', lineHeight: 1.15,
          minWidth: 0, flexBasis: '55%', overflowWrap: 'anywhere',
        }}>{node.name}</div>
        <div style={{
          fontSize: 11, letterSpacing: '0.12em', color: c,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          flex: '0 0 auto', marginLeft: 'auto',
        }}>{node.meta}</div>
      </div>
      <div style={{ height: 1, background: 'rgba(233,229,221,0.16)', margin: '8px 0' }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#cfc8bb', fontStyle: 'italic' }}>
        {node.contribution || node.idea}
      </div>
      <div style={{
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6f6759', marginTop: 8,
      }}>Click for detail</div>
    </div>
  )
}
