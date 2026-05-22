import type {
  CompletedTask,
  Deliverable,
  Difficulty,
  Familiarity,
  FocusLevel,
  MaterialDensity,
  Run,
  SessionRecord,
  Task,
  TaskType,
} from '../types'

// The persistence layer: the ONLY file that talks to localStorage.
// If we later move to a backend, this is the single file that changes.

const STORAGE_KEY = 'speedrun-study-timer:run'
const HISTORY_KEY = 'speedrun-study-timer:history'

/** Coerce an unknown value into a valid Difficulty, defaulting to medium. */
function toDifficulty(value: unknown): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'medium'
}

/** Coerce an unknown value into a valid TaskType, defaulting to reading. */
function toTaskType(value: unknown): TaskType {
  return value === 'practice' ||
    value === 'writing' ||
    value === 'memorization' ||
    value === 'review'
    ? value
    : 'reading'
}

function toFamiliarity(value: unknown): Familiarity {
  return value === 'some' || value === 'review' ? value : 'new'
}

function toMaterialDensity(value: unknown): MaterialDensity {
  return value === 'light' || value === 'dense' ? value : 'normal'
}

function toDeliverable(value: unknown): Deliverable {
  return value === 'notes' || value === 'solve' || value === 'submit'
    ? value
    : 'understand'
}

function toFocusLevel(value: unknown): FocusLevel {
  return value === 'low' || value === 'high' ? value : 'normal'
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function toNonNegativeInteger(value: unknown, fallback = 0): number {
  const number = toNonNegativeNumber(value, fallback)
  return Math.floor(number)
}

function normalizeTask(raw: any): Task {
  return {
    id: typeof raw?.id === 'string' ? raw.id : crypto.randomUUID(),
    name: toText(raw?.name, 'Untitled task'),
    category: toText(raw?.category),
    difficulty: toDifficulty(raw?.difficulty),
    taskType: toTaskType(raw?.taskType),
    familiarity: toFamiliarity(raw?.familiarity),
    density: toMaterialDensity(raw?.density),
    deliverable: toDeliverable(raw?.deliverable),
    focusLevel: toFocusLevel(raw?.focusLevel),
    goalMs: toNonNegativeNumber(raw?.goalMs, 5 * 60_000),
    slideCount: toNonNegativeInteger(raw?.slideCount),
    pdfName: typeof raw?.pdfName === 'string' ? raw.pdfName : undefined,
    documentContext: toText(raw?.documentContext),
  }
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
      tasks: parsed.tasks.map(normalizeTask),
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
  const actualMs =
    raw?.actualMs === null || raw?.actualMs === undefined
      ? null
      : toNonNegativeNumber(raw.actualMs, 0)

  return {
    name: toText(raw?.name),
    category: toText(raw?.category),
    difficulty: toDifficulty(raw?.difficulty),
    taskType: toTaskType(raw?.taskType),
    familiarity: toFamiliarity(raw?.familiarity),
    density: toMaterialDensity(raw?.density),
    deliverable: toDeliverable(raw?.deliverable),
    focusLevel: toFocusLevel(raw?.focusLevel),
    slideCount: toNonNegativeInteger(raw?.slideCount),
    goalMs: toNonNegativeNumber(raw?.goalMs),
    actualMs,
    documentContext: toText(raw?.documentContext),
  }
}

function normalizeSession(raw: any): SessionRecord {
  return {
    id: typeof raw?.id === 'string' ? raw.id : crypto.randomUUID(),
    runName: toText(raw?.runName, 'Untitled Session'),
    completedAt:
      typeof raw?.completedAt === 'number' && Number.isFinite(raw.completedAt)
        ? raw.completedAt
        : Date.now(),
    // Records saved before this field existed were always completed runs.
    completed: raw?.completed !== false,
    totalGoalMs: toNonNegativeNumber(raw?.totalGoalMs),
    totalElapsedMs: toNonNegativeNumber(raw?.totalElapsedMs),
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
