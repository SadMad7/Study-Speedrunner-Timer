import type { TimerStatus } from '../types'

interface Props {
  status: TimerStatus
  canStart: boolean
  onStart: () => void
  onSplit: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

/**
 * The button bar. Which buttons appear depends entirely on the timer
 * status — the component itself holds no state.
 */
export function Controls({
  status,
  canStart,
  onStart,
  onSplit,
  onPause,
  onResume,
  onReset,
}: Props) {
  return (
    <div className="controls">
      {status === 'idle' && (
        <button
          className="btn btn--primary"
          onClick={onStart}
          disabled={!canStart}
        >
          Start
        </button>
      )}

      {status === 'running' && (
        <>
          <button className="btn btn--primary" onClick={onSplit}>
            Split
          </button>
          <button className="btn" onClick={onPause}>
            Pause
          </button>
          <button className="btn" onClick={onReset}>
            Reset
          </button>
        </>
      )}

      {status === 'paused' && (
        <>
          <button className="btn btn--primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn" onClick={onReset}>
            Reset
          </button>
        </>
      )}

      {status === 'finished' && (
        <button className="btn btn--primary" onClick={onReset}>
          New Run
        </button>
      )}
    </div>
  )
}
