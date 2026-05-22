// The core data shapes the whole app revolves around.
// Designing these first makes every component "just a view of this data".

/** How demanding a task is — used to group estimate-accuracy stats. */
export type Difficulty = 'easy' | 'medium' | 'hard'

/** A single study task — one row in the list, one split on the clock. */
export interface Task {
  id: string
  name: string
  /** The course this task belongs to (free text; used to group stats). */
  category: string
  difficulty: Difficulty
  /** What kind of study work this is (reading, practice, ...). */
  taskType: TaskType
  /** How familiar the material already feels. */
  familiarity: Familiarity
  /** How information-dense or demanding the material is. */
  density: MaterialDensity
  /** What the user needs to produce or get out of the task. */
  deliverable: Deliverable
  /** Expected focus/energy level for this attempt. */
  focusLevel: FocusLevel
  /** Intended duration for THIS task alone, in milliseconds (the estimate). */
  goalMs: number
  /** How many pages/slides this task covers (0 = none assigned). */
  slideCount: number
  /** File name of the PDF attached to this task, if any. */
  pdfName?: string
  /** User notes about the assignment or uploaded document. */
  documentContext: string
}

/** What kind of study work a task is — a feature for the estimator. */
export type TaskType =
  | 'reading'
  | 'practice'
  | 'writing'
  | 'memorization'
  | 'review'

export type Familiarity = 'new' | 'some' | 'review'

export type MaterialDensity = 'light' | 'normal' | 'dense'

export type Deliverable = 'understand' | 'notes' | 'solve' | 'submit'

export type FocusLevel = 'low' | 'normal' | 'high'

/** A named set of tasks — the thing that gets saved and loaded. */
export interface Run {
  name: string
  tasks: Task[]
}

/** The states the timer can be in. */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

/** One finished task, frozen inside a saved session. */
export interface CompletedTask {
  name: string
  category: string
  difficulty: Difficulty
  /** What kind of study work this was. */
  taskType: TaskType
  familiarity: Familiarity
  density: MaterialDensity
  deliverable: Deliverable
  focusLevel: FocusLevel
  /** Page count this task covered. */
  slideCount: number
  /** The estimated (goal) time, in milliseconds. */
  goalMs: number
  /** Actual time spent on this task, or null if it was never reached. */
  actualMs: number | null
  /** Context notes captured when the session was saved. */
  documentContext?: string
}

/** A finished or abandoned run, saved to history for later review. */
export interface SessionRecord {
  id: string
  runName: string
  /** When the session was saved (epoch milliseconds). */
  completedAt: number
  /** True if every task was finished; false if the run was reset early. */
  completed: boolean
  totalGoalMs: number
  totalElapsedMs: number
  tasks: CompletedTask[]
}
