// Pure functions that aggregate saved sessions into study stats.
// No React here — just data in, numbers out (easy to reason about and test).

import type { Difficulty, SessionRecord } from '../types'

export interface CategoryStat {
  category: string
  taskCount: number
  avgActualMs: number
}

export interface DifficultyStat {
  difficulty: Difficulty
  taskCount: number
  /** Average of actual ÷ estimate. 1 = on target, <1 = faster, >1 = slower. */
  avgRatio: number
}

export interface Stats {
  totalSessions: number
  completedSessions: number
  byCategory: CategoryStat[]
  byDifficulty: DifficultyStat[]
}

interface Bucket {
  sum: number
  count: number
}

/** Aggregate every saved session into per-category and per-difficulty stats. */
export function computeStats(sessions: SessionRecord[]): Stats {
  const categoryBuckets = new Map<string, Bucket>()
  const difficultyBuckets = new Map<Difficulty, Bucket>()

  for (const session of sessions) {
    for (const task of session.tasks) {
      // Tasks never reached have no actual time, so there's nothing to learn.
      if (task.actualMs === null) continue

      const category = task.category.trim() || 'Uncategorized'
      const catBucket = categoryBuckets.get(category) ?? { sum: 0, count: 0 }
      catBucket.sum += task.actualMs
      catBucket.count += 1
      categoryBuckets.set(category, catBucket)

      // Accuracy needs a non-zero estimate to divide by.
      if (task.goalMs > 0) {
        const diffBucket = difficultyBuckets.get(task.difficulty) ?? {
          sum: 0,
          count: 0,
        }
        diffBucket.sum += task.actualMs / task.goalMs
        diffBucket.count += 1
        difficultyBuckets.set(task.difficulty, diffBucket)
      }
    }
  }

  const byCategory: CategoryStat[] = [...categoryBuckets.entries()]
    .map(([category, bucket]) => ({
      category,
      taskCount: bucket.count,
      avgActualMs: bucket.sum / bucket.count,
    }))
    .sort((a, b) => b.avgActualMs - a.avgActualMs)

  // Keep difficulty rows in a natural easy -> hard order.
  const order: Difficulty[] = ['easy', 'medium', 'hard']
  const byDifficulty: DifficultyStat[] = order
    .filter((d) => difficultyBuckets.has(d))
    .map((d) => {
      const bucket = difficultyBuckets.get(d) as Bucket
      return {
        difficulty: d,
        taskCount: bucket.count,
        avgRatio: bucket.sum / bucket.count,
      }
    })

  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.completed).length,
    byCategory,
    byDifficulty,
  }
}

/** How many past tasks are needed before we'll suggest a goal time. */
export const MIN_SUGGESTION_SAMPLES = 5

export interface GoalSuggestion {
  /** Suggested goal time in milliseconds (average of matching past tasks). */
  avgMs: number
  /** How many past tasks the suggestion is based on. */
  sampleSize: number
}

/**
 * Suggest a goal time for a task from the user's own past tasks that share the
 * same course and difficulty. Returns null when there isn't enough history
 * yet (fewer than MIN_SUGGESTION_SAMPLES matches) or no course is set.
 *
 * Course matching is case-insensitive and trims whitespace, so "Calculus"
 * and "calculus " count as the same course.
 */
export function suggestGoal(
  sessions: SessionRecord[],
  category: string,
  difficulty: Difficulty,
): GoalSuggestion | null {
  const key = category.trim().toLowerCase()
  if (key === '') return null

  let sum = 0
  let count = 0
  for (const session of sessions) {
    for (const task of session.tasks) {
      // Only finished tasks have a real measured time to learn from.
      if (task.actualMs === null) continue
      if (task.difficulty !== difficulty) continue
      if (task.category.trim().toLowerCase() !== key) continue
      sum += task.actualMs
      count += 1
    }
  }

  if (count < MIN_SUGGESTION_SAMPLES) return null
  return { avgMs: sum / count, sampleSize: count }
}
