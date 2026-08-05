import { useCallback, useRef, useState } from 'react'
import { drop, push, TOAST_MS } from './toasts'
import type { Toast, Tone } from './toasts'

/**
 * The queue, plus the timers that empty it. The rules live in toasts.ts; this
 * is only the part that needs React.
 *
 * A replaced duplicate leaves its timer running against an id that is no
 * longer there — `drop` of a missing id is a no-op, which is why it can be.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const notify = useCallback((text: string, tone: Tone = 'info') => {
    const id = ++seq.current
    setToasts((l) => push(l, { id, text, tone }))
    window.setTimeout(() => setToasts((l) => drop(l, id)), TOAST_MS[tone])
  }, [])

  const dismiss = useCallback((id: number) => setToasts((l) => drop(l, id)), [])

  return { toasts, notify, dismiss }
}
