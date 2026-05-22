import type { Task } from '../types'
import { formatDelta, formatDuration } from '../lib/time'

export type RowState = 'done' | 'current' | 'upcoming'

interface Props {
  task: Task
  state: RowState
  /** Cumulative goal time up to and including this task. */
  cumulativeGoalMs: number
  /** Cumulative actual time when this task was completed (only when done). */
  splitMs?: number
}

/** One read-only row shown while a run is in progress. */
export function TaskRow({ task, state, cumulativeGoalMs, splitMs }: Props) {
  const isDone = state === 'done' && splitMs !== undefined
  const delta = isDone ? splitMs - cumulativeGoalMs : 0

  return (
    <div className={`task-row task-row--${state}`}>
      <span className="task-row__name">{task.name}</span>
      <span className="task-row__time">
        {isDone ? (
          <>
            <span
              className={`delta ${delta <= 0 ? 'delta--ahead' : 'delta--behind'}`}
            >
              {formatDelta(delta)}
            </span>
            {formatDuration(splitMs)}
          </>
        ) : (
          formatDuration(cumulativeGoalMs)
        )}
      </span>
    </div>
  )
}
