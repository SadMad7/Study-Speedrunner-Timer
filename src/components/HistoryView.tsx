import { useState } from 'react'
import type { SessionRecord } from '../types'
import { SessionCard } from './SessionCard'

interface Props {
  sessions: SessionRecord[]
  onDelete: (id: string) => void
}

/** The list of saved sessions, newest first. */
export function HistoryView({ sessions, onDelete }: Props) {
  // Track which card is expanded — only one open at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (sessions.length === 0) {
    return (
      <div className="history-empty">
        No saved sessions yet.
        <br />
        Finish a run and it will appear here.
      </div>
    )
  }

  return (
    <div className="history">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          expanded={expandedId === session.id}
          onToggle={() =>
            setExpandedId((current) =>
              current === session.id ? null : session.id,
            )
          }
          onDelete={() => onDelete(session.id)}
        />
      ))}
    </div>
  )
}
