// Pure functions that turn a finished run into review metrics.
// No React in here — this is plain logic, easy to reason about and to test.

interface TaskInput {
  name: string
  goalMs: number
  slideCount: number
}

export interface TaskMetric {
  name: string
  slideCount: number
  /** Time spent on this task alone, in milliseconds. */
  segmentMs: number
  goalMs: number
  /** Actual milliseconds spent per slide, or null if the task has no slides. */
  actualMsPerSlide: number | null
  /** Goal milliseconds per slide, or null if the task has no slides. */
  goalMsPerSlide: number | null
}

export interface RunMetrics {
  tasks: TaskMetric[]
  /** Index of the slowest / fastest slide-bearing task (by pace), or null. */
  slowestIndex: number | null
  fastestIndex: number | null
  totalSlides: number
  /** Average ms per slide across all slide-bearing tasks, or null. */
  overallMsPerSlide: number | null
  /** True when at least one task has slides assigned. */
  hasSlideData: boolean
}

/**
 * Build per-task and overall metrics from a finished run.
 * `cumulativeSplits[i]` is the total elapsed time when task i was completed.
 */
export function computeRunMetrics(
  tasks: TaskInput[],
  cumulativeSplits: number[],
): RunMetrics {
  const taskMetrics: TaskMetric[] = tasks.map((task, i) => {
    // A task's own duration is its split minus the previous task's split.
    const previousSplit = i === 0 ? 0 : cumulativeSplits[i - 1]
    const segmentMs = (cumulativeSplits[i] ?? previousSplit) - previousSplit
    const hasSlides = task.slideCount > 0
    return {
      name: task.name,
      slideCount: task.slideCount,
      segmentMs,
      goalMs: task.goalMs,
      actualMsPerSlide: hasSlides ? segmentMs / task.slideCount : null,
      goalMsPerSlide: hasSlides ? task.goalMs / task.slideCount : null,
    }
  })

  let slowestIndex: number | null = null
  let fastestIndex: number | null = null
  let slowestPace = -Infinity
  let fastestPace = Infinity
  let totalSlides = 0
  let totalSlideMs = 0

  taskMetrics.forEach((metric, i) => {
    const pace = metric.actualMsPerSlide
    if (pace === null) return // tasks without slides don't count toward pace
    totalSlides += metric.slideCount
    totalSlideMs += metric.segmentMs
    if (pace > slowestPace) {
      slowestPace = pace
      slowestIndex = i
    }
    if (pace < fastestPace) {
      fastestPace = pace
      fastestIndex = i
    }
  })

  return {
    tasks: taskMetrics,
    slowestIndex,
    fastestIndex,
    totalSlides,
    overallMsPerSlide: totalSlides > 0 ? totalSlideMs / totalSlides : null,
    hasSlideData: totalSlides > 0,
  }
}
