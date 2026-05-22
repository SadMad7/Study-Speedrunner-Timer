import type { TimerStatus } from '../types'
import { formatDelta, formatDuration } from '../lib/time'

interface Props {
  elapsedMs: number
  status: TimerStatus
  totalGoalMs: number
}

/** The big clock at the bottom. Colour changes with the timer's state. */
export function TimerDisplay({ elapsedMs, status, totalGoalMs }: Props) {
  const [main, centis] = formatDuration(elapsedMs, { centis: true }).split('.')

  const showDelta = status === 'finished' && totalGoalMs > 0
  const delta = elapsedMs - totalGoalMs

  return (
    <div className={`timer timer--${status}`}>
      {showDelta && (
        <div
          className={`timer__delta ${
            delta <= 0 ? 'delta--ahead' : 'delta--behind'
          }`}
        >
          {formatDelta(delta)} vs target
        </div>
      )}
      <div className="timer__time">
        {main}
        <span className="timer__centis">.{centis}</span>
      </div>
    </div>
  )
}
