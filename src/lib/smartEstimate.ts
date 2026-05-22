import type { CompletedTask, Difficulty, SessionRecord, Task } from '../types'

export type EstimateConfidence = 'high' | 'medium' | 'low'

export interface SmartEstimate {
  recommendedMs: number
  confidence: EstimateConfidence
  sampleSize: number
  basis: string
  reasons: string[]
}

interface ScoredContext {
  multiplier: number
  labels: string[]
}

interface EstimateSource {
  ms: number
  sampleSize: number
  confidence: EstimateConfidence
  basis: string
  reasons: string[]
}

const DEFAULT_MINUTES_PER_PAGE: Record<Difficulty, number> = {
  easy: 2,
  medium: 3.5,
  hard: 5,
}

const DEFAULT_TASK_MS: Record<Difficulty, number> = {
  easy: 10 * 60_000,
  medium: 20 * 60_000,
  hard: 35 * 60_000,
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundToNearestMinute(ms: number): number {
  return Math.max(60_000, Math.round(ms / 60_000) * 60_000)
}

function sameCategory(a: string, b: string): boolean {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  return left !== '' && left === right
}

function completedTasks(sessions: SessionRecord[]): CompletedTask[] {
  return sessions.flatMap((session) =>
    session.tasks.filter((task) => task.actualMs !== null),
  )
}

function actualMs(task: CompletedTask): number {
  return task.actualMs ?? 0
}

function scoreContext(task: Task): ScoredContext {
  const text = [
    task.name,
    task.category,
    task.pdfName ?? '',
    task.documentContext,
  ]
    .join(' ')
    .toLowerCase()

  const signals: Array<{
    label: string
    multiplier: number
    words: string[]
  }> = [
    {
      label: 'dense material',
      multiplier: 1.18,
      words: ['dense', 'technical', 'complex', 'difficult', 'heavy'],
    },
    {
      label: 'math or proofs',
      multiplier: 1.16,
      words: ['proof', 'theorem', 'formula', 'equation', 'derivation'],
    },
    {
      label: 'first pass',
      multiplier: 1.15,
      words: ['first pass', 'new material', 'unfamiliar', 'learn'],
    },
    {
      label: 'practice work',
      multiplier: 1.12,
      words: ['practice', 'problem set', 'problems', 'exercises', 'homework'],
    },
    {
      label: 'writing work',
      multiplier: 1.12,
      words: ['essay', 'write', 'writing', 'report', 'draft'],
    },
    {
      label: 'memorization',
      multiplier: 1.08,
      words: ['memorize', 'flashcards', 'quiz', 'test', 'exam'],
    },
    {
      label: 'review pass',
      multiplier: 0.88,
      words: ['review', 'recap', 'summary', 'skim', 'familiar', 'light'],
    },
  ]

  let multiplier = 1
  const labels: string[] = []

  for (const signal of signals) {
    if (signal.words.some((word) => text.includes(word))) {
      multiplier *= signal.multiplier
      labels.push(signal.label)
    }
  }

  return {
    multiplier: clamp(multiplier, 0.75, 1.45),
    labels,
  }
}

function chooseEstimateSource(
  task: Task,
  history: CompletedTask[],
): EstimateSource {
  const matchingCourse = history.filter(
    (past) =>
      sameCategory(past.category, task.category) &&
      past.difficulty === task.difficulty,
  )
  const matchingCourseWithPages = matchingCourse.filter(
    (past) => past.slideCount > 0,
  )
  const sameDifficulty = history.filter(
    (past) => past.difficulty === task.difficulty,
  )
  const sameDifficultyWithPages = sameDifficulty.filter(
    (past) => past.slideCount > 0,
  )
  const sameCourseAnyDifficulty = history.filter((past) =>
    sameCategory(past.category, task.category),
  )

  if (task.slideCount > 0 && matchingCourseWithPages.length >= 3) {
    const msPerPage = average(
      matchingCourseWithPages.map((past) => actualMs(past) / past.slideCount),
    )
    return {
      ms: msPerPage * task.slideCount,
      sampleSize: matchingCourseWithPages.length,
      confidence: matchingCourseWithPages.length >= 5 ? 'high' : 'medium',
      basis: 'course page pace',
      reasons: [
        `Matched ${matchingCourseWithPages.length} past ${task.difficulty} ${task.category.trim()} tasks with pages.`,
        `Scaled your average page pace to ${task.slideCount} pages.`,
      ],
    }
  }

  if (matchingCourse.length >= 3) {
    return {
      ms: average(matchingCourse.map(actualMs)),
      sampleSize: matchingCourse.length,
      confidence: matchingCourse.length >= 5 ? 'high' : 'medium',
      basis: 'course task average',
      reasons: [
        `Matched ${matchingCourse.length} past ${task.difficulty} ${task.category.trim()} tasks.`,
      ],
    }
  }

  if (task.slideCount > 0 && sameDifficultyWithPages.length >= 3) {
    const msPerPage = average(
      sameDifficultyWithPages.map((past) => actualMs(past) / past.slideCount),
    )
    return {
      ms: msPerPage * task.slideCount,
      sampleSize: sameDifficultyWithPages.length,
      confidence: 'medium',
      basis: 'difficulty page pace',
      reasons: [
        `Used ${sameDifficultyWithPages.length} past ${task.difficulty} tasks with pages.`,
        `Scaled that page pace to ${task.slideCount} pages.`,
      ],
    }
  }

  if (sameCourseAnyDifficulty.length >= 3) {
    return {
      ms: average(sameCourseAnyDifficulty.map(actualMs)),
      sampleSize: sameCourseAnyDifficulty.length,
      confidence: 'medium',
      basis: 'course average',
      reasons: [
        `Used ${sameCourseAnyDifficulty.length} past ${task.category.trim()} tasks across difficulties.`,
      ],
    }
  }

  if (sameDifficulty.length >= 3) {
    return {
      ms: average(sameDifficulty.map(actualMs)),
      sampleSize: sameDifficulty.length,
      confidence: 'low',
      basis: 'difficulty average',
      reasons: [`Used ${sameDifficulty.length} past ${task.difficulty} tasks.`],
    }
  }

  if (task.slideCount > 0) {
    return {
      ms: DEFAULT_MINUTES_PER_PAGE[task.difficulty] * task.slideCount * 60_000,
      sampleSize: 0,
      confidence: 'low',
      basis: 'page fallback',
      reasons: [
        `Started from ${DEFAULT_MINUTES_PER_PAGE[task.difficulty]} min/page for ${task.difficulty} material.`,
      ],
    }
  }

  return {
    ms: DEFAULT_TASK_MS[task.difficulty],
    sampleSize: 0,
    confidence: 'low',
    basis: 'difficulty fallback',
    reasons: [
      `Started from a ${Math.round(
        DEFAULT_TASK_MS[task.difficulty] / 60_000,
      )}-minute ${task.difficulty} fallback because there is not enough matching history yet.`,
    ],
  }
}

function difficultyAccuracyMultiplier(
  task: Task,
  history: CompletedTask[],
): { multiplier: number; reason: string | null } {
  const ratios = history
    .filter(
      (past) =>
        past.difficulty === task.difficulty &&
        past.goalMs > 0 &&
        past.actualMs !== null,
    )
    .map((past) => actualMs(past) / past.goalMs)

  if (ratios.length < 3) return { multiplier: 1, reason: null }

  const avgRatio = average(ratios)
  const moderated = 1 + (clamp(avgRatio, 0.7, 1.5) - 1) * 0.45

  if (Math.abs(moderated - 1) < 0.04) {
    return { multiplier: 1, reason: null }
  }

  const percent = Math.round(avgRatio * 100)
  const direction = avgRatio > 1 ? 'run over' : 'beat'
  return {
    multiplier: moderated,
    reason: `Adjusted because your ${task.difficulty} tasks usually ${direction} estimates (${percent}% of target).`,
  }
}

export function buildSmartEstimate(
  task: Task,
  sessions: SessionRecord[],
): SmartEstimate {
  const history = completedTasks(sessions)
  const source = chooseEstimateSource(task, history)
  const context = scoreContext(task)
  const accuracy = difficultyAccuracyMultiplier(task, history)

  const adjustedMs = source.ms * context.multiplier * accuracy.multiplier
  const reasons = [...source.reasons]

  if (context.labels.length > 0) {
    reasons.push(`Factored in task/document context: ${context.labels.join(', ')}.`)
  } else if (task.pdfName || task.slideCount > 0) {
    reasons.push('Used the uploaded document page count; add context notes to sharpen this.')
  }

  if (accuracy.reason) {
    reasons.push(accuracy.reason)
  }

  return {
    recommendedMs: roundToNearestMinute(adjustedMs),
    confidence: source.confidence,
    sampleSize: source.sampleSize,
    basis: source.basis,
    reasons,
  }
}
