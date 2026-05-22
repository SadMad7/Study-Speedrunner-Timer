import type { SessionRecord } from '../types'
import { computeStats } from '../lib/stats'
import { formatDuration } from '../lib/time'

interface Props {
  sessions: SessionRecord[]
}

/** Reads every saved session and shows aggregate study stats. */
export function StatsView({ sessions }: Props) {
  const stats = computeStats(sessions)

  if (sessions.length === 0) {
    return (
      <div className="history-empty">
        No data yet.
        <br />
        Finish or reset a session and your stats will build up here.
      </div>
    )
  }

  return (
    <div className="stats">
      <div className="stats__tiles">
        <div className="stats__tile">
          <span className="stats__tile-num">{stats.completedSessions}</span>
          <span className="stats__tile-label">Sessions completed</span>
        </div>
        <div className="stats__tile">
          <span className="stats__tile-num">{stats.totalSessions}</span>
          <span className="stats__tile-label">Sessions total</span>
        </div>
      </div>

      <div className="stats__section">
        <div className="stats__heading">Average time per course</div>
        {stats.byCategory.length === 0 ? (
          <div className="stats__empty">No completed tasks yet.</div>
        ) : (
          stats.byCategory.map((c) => (
            <div className="stats__row" key={c.category}>
              <span className="stats__row-label">{c.category}</span>
              <span className="stats__row-sub">
                {c.taskCount} task{c.taskCount === 1 ? '' : 's'}
              </span>
              <span className="stats__row-value">
                {formatDuration(c.avgActualMs)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="stats__section">
        <div className="stats__heading">Estimate accuracy by difficulty</div>
        {stats.byDifficulty.length === 0 ? (
          <div className="stats__empty">No completed tasks yet.</div>
        ) : (
          stats.byDifficulty.map((d) => {
            const percent = Math.round(d.avgRatio * 100)
            const ranOver = d.avgRatio > 1
            return (
              <div className="stats__row" key={d.difficulty}>
                <span className="stats__row-label stats__row-label--cap">
                  {d.difficulty}
                </span>
                <span className="stats__row-sub">
                  {d.taskCount} task{d.taskCount === 1 ? '' : 's'}
                </span>
                <span
                  className={`stats__row-value ${
                    ranOver ? 'delta--behind' : 'delta--ahead'
                  }`}
                >
                  {percent}%
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className="stats__note">
        Accuracy is actual time ÷ estimated time. 100% means spot on; above
        means you ran over your estimate, below means you beat it.
      </div>
    </div>
  )
}
