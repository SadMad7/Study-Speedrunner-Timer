import type { Task } from '../types'
import { TaskRow, type RowState } from './TaskRow'

interface Props {
  tasks: Task[]
  cumulativeGoals: number[]
  splits: number[]
  currentIndex: number
}

/** The task list shown while a run is running, paused, or finished. */
export function TaskList({ tasks, cumulativeGoals, splits, currentIndex }: Props) {
  return (
    <div className="task-list">
      {tasks.map((task, i) => {
        let state: RowState = 'upcoming'
        if (i < splits.length) state = 'done'
        else if (i === currentIndex) state = 'current'

        return (
          <TaskRow
            key={task.id}
            task={task}
            state={state}
            cumulativeGoalMs={cumulativeGoals[i]}
            splitMs={i < splits.length ? splits[i] : undefined}
          />
        )
      })}
    </div>
  )
}
