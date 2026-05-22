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
 * wall-clock timestamp when the current segment started, and elapsed time is
 * always `Date.now() - thatTimestamp`. The interval below exists ONLY to
 * trigger re-renders so the clock looks alive — it does not measure time.
 * That is why the clock stays accurate even if the interval fires unevenly.
 */
export function useTimer(): TimerApi {
  const [status, setStatus] = useState<TimerStatus>('idle')

  // Time banked from earlier running segments (added to on every pause/finish).
  const bankedMsRef = useRef(0)
  // Wall-clock timestamp when the current running segment began.
  const segmentStartRef = useRef(0)
  // Bumped only to force a re-render while the timer is running.
  const [, setRenderTick] = useState(0)

  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      setRenderTick((t) => t + 1)
    }, 33)
    return () => window.clearInterval(id)
  }, [status])

  const readElapsed = (): number => {
    if (status === 'running') {
      return bankedMsRef.current + (Date.now() - segmentStartRef.current)
    }
    return bankedMsRef.current
  }

  const start = (): void => {
    bankedMsRef.current = 0
    segmentStartRef.current = Date.now()
    setStatus('running')
  }

  const pause = (): void => {
    bankedMsRef.current += Date.now() - segmentStartRef.current
    setStatus('paused')
  }

  const resume = (): void => {
    segmentStartRef.current = Date.now()
    setStatus('running')
  }

  const finish = (): void => {
    bankedMsRef.current += Date.now() - segmentStartRef.current
    setStatus('finished')
  }

  const reset = (): void => {
    bankedMsRef.current = 0
    segmentStartRef.current = 0
    setStatus('idle')
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
