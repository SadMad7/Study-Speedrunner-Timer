import type {
  CompletedTask,
  Deliverable,
  Difficulty,
  Familiarity,
  FocusLevel,
  MaterialDensity,
  SessionRecord,
  Task,
  TaskType,
} from '../types'
import { effectPerUnit, fitLinearRegression, predict } from './regression'

export type EstimateConfidence = 'high' | 'medium' | 'low'

export interface SmartEstimate {
  recommendedMs: number
  confidence: EstimateConfidence
  sampleSize: number
  basis: string
  reasons: string[]
}

interface EstimateSource {
  ms: number
  sampleSize: number
  confidence: EstimateConfidence
  basis: string
  reasons: string[]
}

/** Below this many past tasks, the learned model isn't trusted yet. */
const MIN_TRAINING_SAMPLES = 12

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

const DIFFICULTY_ORDINAL: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
}

const FAMILIARITY_ORDINAL: Record<Familiarity, number> = {
  new: 0,
  some: 1,
  review: 2,
}

const DENSITY_ORDINAL: Record<MaterialDensity, number> = {
  light: 0,
  normal: 1,
  dense: 2,
}

const FOCUS_ORDINAL: Record<FocusLevel, number> = {
  low: 0,
  normal: 1,
  high: 2,
}

// 'review' is the reference category, so it gets no one-hot column.
const ONE_HOT_TASK_TYPES: TaskType[] = [
  'reading',
  'practice',
  'writing',
  'memorization',
]

// 'understand' is the reference category.
const ONE_HOT_DELIVERABLES: Deliverable[] = ['notes', 'solve', 'submit']

const TASK_TYPE_MULTIPLIER: Record<TaskType, number> = {
  reading: 1,
  practice: 1.12,
  writing: 1.18,
  memorization: 1.08,
  review: 0.86,
}

const FAMILIARITY_MULTIPLIER: Record<Familiarity, number> = {
  new: 1.18,
  some: 1,
  review: 0.82,
}

const DENSITY_MULTIPLIER: Record<MaterialDensity, number> = {
  light: 0.86,
  normal: 1,
  dense: 1.22,
}

const DELIVERABLE_MULTIPLIER: Record<Deliverable, number> = {
  understand: 1,
  notes: 1.08,
  solve: 1.15,
  submit: 1.22,
}

const FOCUS_MULTIPLIER: Record<FocusLevel, number> = {
  low: 1.16,
  normal: 1,
  high: 0.92,
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

type FeatureInput = Pick<
  Task,
  | 'slideCount'
  | 'difficulty'
  | 'taskType'
  | 'familiarity'
  | 'density'
  | 'deliverable'
  | 'focusLevel'
>

/**
 * Turn a task into the numeric feature vector the model learns from:
 * [pages, difficulty, familiarity, density, focus, task type one-hots,
 * deliverable one-hots].
 */
function taskFeatures(task: FeatureInput): number[] {
  return [
    task.slideCount,
    DIFFICULTY_ORDINAL[task.difficulty],
    FAMILIARITY_ORDINAL[task.familiarity],
    DENSITY_ORDINAL[task.density],
    FOCUS_ORDINAL[task.focusLevel],
    ...ONE_HOT_TASK_TYPES.map((type) => (task.taskType === type ? 1 : 0)),
    ...ONE_HOT_DELIVERABLES.map((type) =>
      task.deliverable === type ? 1 : 0,
    ),
  ]
}

function label(value: string): string {
  return value.replace(/-/g, ' ')
}

function noteMultiplier(task: Task): { multiplier: number; reason: string | null } {
  const text = [task.name, task.pdfName ?? '', task.documentContext]
    .join(' ')
    .toLowerCase()

  let multiplier = 1
  const signals: string[] = []

  const denseWords = ['proof', 'theorem', 'derivation', 'formula', 'equation']
  if (denseWords.some((word) => text.includes(word))) {
    multiplier *= 1.08
    signals.push('technical wording')
  }

  const easyWords = ['skim', 'quick', 'recap']
  if (easyWords.some((word) => text.includes(word))) {
    multiplier *= 0.92
    signals.push('light-review wording')
  }

  if (signals.length === 0) return { multiplier: 1, reason: null }

  return {
    multiplier: clamp(multiplier, 0.85, 1.15),
    reason: `Notes nudged the estimate for ${signals.join(' and ')}.`,
  }
}

function structuredContextMultiplier(
  task: Task,
): { multiplier: number; reasons: string[] } {
  const reasons = [
    `Context: ${label(task.taskType)}, ${label(task.familiarity)} familiarity, ${label(task.density)} density.`,
    `Output/focus: ${label(task.deliverable)} with ${label(task.focusLevel)} focus.`,
  ]

  return {
    multiplier:
      TASK_TYPE_MULTIPLIER[task.taskType] *
      FAMILIARITY_MULTIPLIER[task.familiarity] *
      DENSITY_MULTIPLIER[task.density] *
      DELIVERABLE_MULTIPLIER[task.deliverable] *
      FOCUS_MULTIPLIER[task.focusLevel],
    reasons,
  }
}

/**
 * The heuristic estimate: a tiered lookup over similar past tasks, falling
 * back to sensible defaults. Used on its own until there is enough history
 * to train the learned model.
 */
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

/**
 * A gentle correction for users who consistently over- or under-run their
 * estimates at a given difficulty. Only applied to the heuristic path.
 */
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

/**
 * The learned estimate: a linear regression fit on every completed task in
 * the user's history. Returns null until there is enough data to train it.
 */
function regressionSource(
  task: Task,
  history: CompletedTask[],
): EstimateSource | null {
  if (history.length < MIN_TRAINING_SAMPLES) return null

  const rows = history.map(taskFeatures)
  const targetMinutes = history.map((past) => actualMs(past) / 60_000)
  const model = fitLinearRegression(rows, targetMinutes)

  const predictedMinutes = predict(model, taskFeatures(task))
  // A linear model can extrapolate to nonsense on thin data — keep it sane.
  const notes = noteMultiplier(task)
  const ms = clamp(predictedMinutes, 1, 600) * 60_000 * notes.multiplier

  const confidence: EstimateConfidence =
    history.length >= 25 ? 'high' : history.length >= 16 ? 'medium' : 'low'

  const reasons = [
    `Learned model trained on ${history.length} of your completed tasks.`,
    ...structuredContextMultiplier(task).reasons,
  ]
  if (notes.reason) reasons.push(notes.reason)
  if (task.slideCount > 0) {
    const perPage = effectPerUnit(model, 0) // feature 0 is the page count
    if (perPage > 0.1) {
      reasons.push(`It puts your pace near ${perPage.toFixed(1)} min per page.`)
    }
  }

  return {
    ms,
    sampleSize: history.length,
    confidence,
    basis: 'learned model',
    reasons,
  }
}

/** The heuristic path: tiered lookup plus the accuracy correction. */
function heuristicSource(task: Task, history: CompletedTask[]): EstimateSource {
  const source = chooseEstimateSource(task, history)
  const accuracy = difficultyAccuracyMultiplier(task, history)
  const structured = structuredContextMultiplier(task)
  const notes = noteMultiplier(task)
  const reasons = [...source.reasons]
  if (accuracy.reason) reasons.push(accuracy.reason)
  reasons.push(...structured.reasons)
  if (notes.reason) reasons.push(notes.reason)
  return {
    ms:
      source.ms *
      accuracy.multiplier *
      structured.multiplier *
      notes.multiplier,
    sampleSize: source.sampleSize,
    confidence: source.confidence,
    basis: source.basis,
    reasons,
  }
}

/**
 * Recommend a goal time for a task. Once there is enough history, a model
 * fit to the user's own data is used; below that, the heuristic takes over.
 */
export function buildSmartEstimate(
  task: Task,
  sessions: SessionRecord[],
): SmartEstimate {
  const history = completedTasks(sessions)
  const source =
    regressionSource(task, history) ?? heuristicSource(task, history)

  return {
    recommendedMs: roundToNearestMinute(source.ms),
    confidence: source.confidence,
    sampleSize: source.sampleSize,
    basis: source.basis,
    reasons: source.reasons,
  }
}
