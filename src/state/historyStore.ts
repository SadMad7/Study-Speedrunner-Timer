import { useEffect, useState } from 'react'
import type { SessionRecord } from '../types'
import { loadHistory, saveHistory } from '../lib/storage'

export interface HistoryStore {
  sessions: SessionRecord[]
  addSession: (record: SessionRecord) => void
  removeSession: (id: string) => void
}

/**
 * Owns the list of completed sessions and mirrors it to localStorage.
 * Newest sessions are kept at the front of the list.
 *
 * This is a sibling of useRun: same shape (state + localStorage mirror),
 * different data. Keeping them separate means the timer and the history
 * never have to know about each other.
 */
export function useHistory(): HistoryStore {
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadHistory())

  useEffect(() => {
    saveHistory(sessions)
  }, [sessions])

  const addSession = (record: SessionRecord): void => {
    setSessions((current) => [record, ...current])
  }

  const removeSession = (id: string): void => {
    setSessions((current) => current.filter((s) => s.id !== id))
  }

  return { sessions, addSession, removeSession }
}
