import { useEffect, useState } from 'react'
import type { Run, Task } from '../types'
import { loadRun, saveRun } from '../lib/storage'

function createId(): string {
  return crypto.randomUUID()
}

/** A starter run so the app is not empty on first launch. */
const DEFAULT_RUN: Run = {
  name: 'My Study Session',
  tasks: [
    {
      id: createId(),
      name: 'Review notes',
      category: '',
      difficulty: 'easy',
      taskType: 'review',
      familiarity: 'review',
      density: 'normal',
      deliverable: 'notes',
      focusLevel: 'normal',
      goalMs: 10 * 60_000,
      slideCount: 0,
      documentContext: '',
    },
    {
      id: createId(),
      name: 'Practice problems',
      category: '',
      difficulty: 'hard',
      taskType: 'practice',
      familiarity: 'some',
      density: 'dense',
      deliverable: 'solve',
      focusLevel: 'normal',
      goalMs: 25 * 60_000,
      slideCount: 0,
      documentContext: '',
    },
    {
      id: createId(),
      name: 'Flashcards & summary',
      category: '',
      difficulty: 'medium',
      taskType: 'memorization',
      familiarity: 'some',
      density: 'normal',
      deliverable: 'understand',
      focusLevel: 'normal',
      goalMs: 15 * 60_000,
      slideCount: 0,
      documentContext: '',
    },
  ],
}

export interface RunStore {
  run: Run
  setName: (name: string) => void
  addTask: () => void
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void
  removeTask: (id: string) => void
}

/**
 * Owns the task list (the "what to study" data) and mirrors every change
 * to localStorage, so the user's tasks survive a page refresh.
 */
export function useRun(): RunStore {
  // The initializer function runs only once — load saved data, or fall back.
  const [run, setRun] = useState<Run>(() => loadRun() ?? DEFAULT_RUN)

  // Persist whenever the run changes.
  useEffect(() => {
    saveRun(run)
  }, [run])

  const setName = (name: string): void => {
    setRun((r) => ({ ...r, name }))
  }

  const addTask = (): void => {
    setRun((r) => ({
      ...r,
      tasks: [
        ...r.tasks,
        {
          id: createId(),
          name: 'New task',
          category: '',
          difficulty: 'medium',
          taskType: 'reading',
          familiarity: 'new',
          density: 'normal',
          deliverable: 'understand',
          focusLevel: 'normal',
          goalMs: 5 * 60_000,
          slideCount: 0,
          documentContext: '',
        },
      ],
    }))
  }

  // A patch can update any task field (name, category, difficulty, goal,
  // slide count, pdf name) — the editor decides which.
  const updateTask = (id: string, patch: Partial<Omit<Task, 'id'>>): void => {
    setRun((r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  const removeTask = (id: string): void => {
    setRun((r) => ({ ...r, tasks: r.tasks.filter((t) => t.id !== id) }))
  }

  return { run, setName, addTask, updateTask, removeTask }
}
