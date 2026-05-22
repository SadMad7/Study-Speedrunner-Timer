import type { CompletedTask, SessionRecord } from '../types'
import { formatDateTime, formatDelta, formatDuration } from '../lib/time'

interface Props {
  session: SessionRecord
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}

/** One saved session. Click the header to expand the per-task breakdown. */
export function SessionCard({ session, expanded, onToggle, onDelete }: Props) {
  const totalDelta = session.totalElapsedMs - session.totalGoalMs

  const handleDelete = (): void => {
    if (window.confirm(`Delete "${session.runName}" from history?`)) {
      onDelete()
    }
  }

  return (
    <div className="session">
      <div className="session__head">
        <button
          className="session__toggle"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <div className="session__info">
            <div className="session__name">
              <span className="session__name-text">{session.runName}</span>
              {!session.completed && (
                <span className="session__badge">Incomplete</span>
              )}
            </div>
            <div className="session__date">
              {formatDateTime(session.completedAt)}
            </div>
          </div>
          <div className="session__result">
            <span className="session__time">
              {formatDuration(session.totalElapsedMs)}
            </span>
            <span
              className={`delta ${
                totalDelta <= 0 ? 'delta--ahead' : 'delta--behind'
              }`}
            >
              {formatDelta(totalDelta)}
            </span>
          </div>
        </button>
        <button
          className="session__del"
          type="button"
          onClick={handleDelete}
          aria-label="Delete session"
        >
          &times;
        </button>
      </div>

      {expanded && (
        <div className="session__detail">
          {session.tasks.map((task, i) => (
            <SessionTaskRow key={i} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

/** One task line inside an expanded session card. */
function SessionTaskRow({ task }: { task: CompletedTask }) {
  const delta = task.actualMs !== null ? task.actualMs - task.goalMs : null

  return (
    <div className="session__task">
      <span className="session__task-name">
        <span className={`diff-chip diff-chip--${task.difficulty}`}>
          {task.difficulty}
        </span>
        {task.name}
      </span>
      <span className="session__task-time">
        {task.actualMs === null ? (
          <span className="session__skipped">not reached</span>
        ) : (
          <>
            {delta !== null && (
              <span
                className={`delta ${
                  delta <= 0 ? 'delta--ahead' : 'delta--behind'
                }`}
              >
                {formatDelta(delta)}
              </span>
            )}
            {formatDuration(task.actualMs)}
          </>
        )}
      </span>
    </div>
  )
}
