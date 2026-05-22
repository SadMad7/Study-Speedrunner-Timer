import type { CompletedTask, Difficulty, Run, SessionRecord } from '../types'

// The persistence layer: the ONLY file that talks to localStorage.
// If we later move to a backend, this is the single file that changes.

const STORAGE_KEY = 'speedrun-study-timer:run'
const HISTORY_KEY = 'speedrun-study-timer:history'

/** Coerce an unknown value into a valid Difficulty, defaulting to medium. */
function toDifficulty(value: unknown): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium'
}

export function loadRun(): Run | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Run
    // localStorage is a system boundary — the data could be old or corrupt,
    // so we sanity-check the shape before trusting it.
    if (typeof parsed?.name !== 'string' || !Array.isArray(parsed?.tasks)) {
      return null
    }
    // Migration: older saved runs are missing newer fields (category,
    // difficulty...). We fill in defaults so old data keeps working.
    return {
      name: parsed.name,
      tasks: parsed.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        category: typeof task.category === 'string' ? task.category : '',
        difficulty: toDifficulty(task.difficulty),
        goalMs: task.goalMs,
        slideCount: typeof task.slideCount === 'number' ? task.slideCount : 0,
        pdfName: typeof task.pdfName === 'string' ? task.pdfName : undefined,
      })),
    }
  } catch {
    return null
  }
}

export function saveRun(run: Run): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run))
  } catch {
    // Storage can be full or disabled (e.g. private browsing) — not fatal.
  }
}

// `raw` below is untrusted data straight from storage — its shape is unknown,
// so each field is checked and defaulted individually.

function normalizeCompletedTask(raw: any): CompletedTask {
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    category: typeof raw?.category === 'string' ? raw.category : '',
    difficulty: toDifficulty(raw?.difficulty),
    slideCount: typeof raw?.slideCount === 'number' ? raw.slideCount : 0,
    goalMs: typeof raw?.goalMs === 'number' ? raw.goalMs : 0,
    actualMs: typeof raw?.actualMs === 'number' ? raw.actualMs : null,
  }
}

function normalizeSession(raw: any): SessionRecord {
  return {
    id: typeof raw?.id === 'string' ? raw.id : crypto.randomUUID(),
    runName: typeof raw?.runName === 'string' ? raw.runName : 'Untitled Session',
    completedAt:
      typeof raw?.completedAt === 'number' ? raw.completedAt : Date.now(),
    // Records saved before this field existed were always completed runs.
    completed: raw?.completed !== false,
    totalGoalMs: typeof raw?.totalGoalMs === 'number' ? raw.totalGoalMs : 0,
    totalElapsedMs:
      typeof raw?.totalElapsedMs === 'number' ? raw.totalElapsedMs : 0,
    tasks: Array.isArray(raw?.tasks) ? raw.tasks.map(normalizeCompletedTask) : [],
  }
}

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Run every record through normalize so older saved data stays valid.
    return parsed.map(normalizeSession)
  } catch {
    return []
  }
}

export function saveHistory(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions))
  } catch {
    // Storage can be full or disabled (e.g. private browsing) — not fatal.
  }
}
