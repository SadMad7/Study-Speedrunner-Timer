import type { Task } from '../types'
import { computeRunMetrics } from '../lib/metrics'
import { formatDelta, formatDuration } from '../lib/time'

interface Props {
  tasks: Task[]
  splits: number[]
}

/**
 * The post-run summary, shown when a run finishes. It turns the raw splits
 * into pace metrics: time per slide, slowest/fastest section, and how the
 * pace compared to the goal times that were set.
 */
export function RunSummary({ tasks, splits }: Props) {
  const metrics = computeRunMetrics(tasks, splits)

  const slowest =
    metrics.slowestIndex !== null ? metrics.tasks[metrics.slowestIndex] : null
  const fastest =
    metrics.fastestIndex !== null ? metrics.tasks[metrics.fastestIndex] : null

  return (
    <div className="summary">
      {metrics.hasSlideData ? (
        <>
          {slowest && fastest && metrics.slowestIndex !== metrics.fastestIndex && (
            <div className="summary__highlights">
              <div className="summary__highlight">
                <span className="summary__tag summary__tag--slow">Slowest</span>
                <span className="summary__hl-name">{slowest.name}</span>
                <span className="summary__hl-value">
                  {formatDuration(slowest.actualMsPerSlide ?? 0)} / slide
                </span>
              </div>
              <div className="summary__highlight">
                <span className="summary__tag summary__tag--fast">Fastest</span>
                <span className="summary__hl-name">{fastest.name}</span>
                <span className="summary__hl-value">
                  {formatDuration(fastest.actualMsPerSlide ?? 0)} / slide
                </span>
              </div>
            </div>
          )}
          <div className="summary__overall">
            {metrics.totalSlides} slides ·{' '}
            {formatDuration(metrics.overallMsPerSlide ?? 0)} per slide on average
          </div>
        </>
      ) : (
        <div className="summary__note">
          No study material attached. Upload a PDF in the editor and give each
          task a slide count to see pace metrics here.
        </div>
      )}

      <div className="summary__table">
        <div className="summary__row summary__row--head">
          <span className="summary__c-name">Task</span>
          <span className="summary__c-num">Slides</span>
          <span className="summary__c-num">Time/slide</span>
          <span className="summary__c-num">vs goal</span>
        </div>
        {metrics.tasks.map((task, i) => {
          const paceDelta =
            task.actualMsPerSlide !== null && task.goalMsPerSlide !== null
              ? task.actualMsPerSlide - task.goalMsPerSlide
              : null
          return (
            <div className="summary__row" key={i}>
              <span className="summary__c-name">{task.name}</span>
              <span className="summary__c-num">
                {task.slideCount > 0 ? task.slideCount : '—'}
              </span>
              <span className="summary__c-num">
                {task.actualMsPerSlide !== null
                  ? formatDuration(task.actualMsPerSlide)
                  : '—'}
              </span>
              <span className="summary__c-num">
                {paceDelta !== null ? (
                  <span
                    className={
                      paceDelta <= 0 ? 'delta--ahead' : 'delta--behind'
                    }
                  >
                    {formatDelta(paceDelta)}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
