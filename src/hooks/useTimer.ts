import { useEffect, useRef, useState } from 'react'
import type { TimerStatus } from '../types'

export interface TimerApi {
  status: TimerStatus
  /** Live elapsed time in milliseconds (recomputed every render). */
  elapsedMs: number
  /** Read the exact elapsed time at this instant (used to record splits). */
  readElapsed: () => number
  start: () => void
  pause: () => void
  resume: () => void
  finish: () => void
  reset: () => void
}

/**
 * The timer "brain".
 *
 * Key idea: we never COUNT time (no `elapsed = elapsed + 1`). We record the
 * monotonic timestamp when the current segment started, and elapsed time is
 * always `performance.now() - thatTimestamp`. The interval below exists ONLY to
 * trigger re-renders so the clock looks alive — it does not measure time.
 * That is why the clock stays accurate even if the interval fires unevenly.
 */
export function useTimer(): TimerApi {
  const [status, setStatus] = useState<TimerStatus>('idle')
  const statusRef = useRef<TimerStatus>('idle')

  // Time banked from earlier running segments (added to on every pause/finish).
  const bankedMsRef = useRef(0)
  // Monotonic timestamp when the current running segment began.
  const segmentStartRef = useRef(0)
  // Bumped only to force a re-render while the timer is running.
  const [, setRenderTick] = useState(0)

  const setTimerStatus = (next: TimerStatus): void => {
    statusRef.current = next
    setStatus(next)
  }

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      setRenderTick((t) => t + 1)
    }, 33)
    return () => window.clearInterval(id)
  }, [status])

  const readElapsed = (): number => {
    if (statusRef.current === 'running') {
      return bankedMsRef.current + (performance.now() - segmentStartRef.current)
    }
    return bankedMsRef.current
  }

  const start = (): void => {
    if (statusRef.current !== 'idle') return
    bankedMsRef.current = 0
    segmentStartRef.current = performance.now()
    setTimerStatus('running')
  }

  const pause = (): void => {
    if (statusRef.current !== 'running') return
    bankedMsRef.current += performance.now() - segmentStartRef.current
    setTimerStatus('paused')
  }

  const resume = (): void => {
    if (statusRef.current !== 'paused') return
    segmentStartRef.current = performance.now()
    setTimerStatus('running')
  }

  const finish = (): void => {
    if (statusRef.current === 'running') {
      bankedMsRef.current += performance.now() - segmentStartRef.current
    } else if (statusRef.current !== 'paused') {
      return
    }
    setTimerStatus('finished')
  }

  const reset = (): void => {
    bankedMsRef.current = 0
    segmentStartRef.current = 0
    setTimerStatus('idle')
  }

  return {
    status,
    elapsedMs: readElapsed(),
    readElapsed,
    start,
    pause,
    resume,
    finish,
    reset,
  }
}
