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
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 19, color: '#f2ece1', lineHeight: 1.1 }}>{node.name}</div>
        <div style={{
          fontSize: 10, letterSpacing: '0.12em', color: c,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>{node.meta}</div>
      </div>
      <div style={{ height: 1, background: 'rgba(233,229,221,0.16)', margin: '8px 0' }} />
      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#cfc8bb', fontStyle: 'italic' }}>
        {node.contribution || node.idea}
      </div>
      <div style={{
        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#6f6759', marginTop: 8,
      }}>Click for detail</div>
    </div>
  )
}
