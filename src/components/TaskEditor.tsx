import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { RunStore } from '../state/runStore'
import type { Difficulty, SessionRecord, Task } from '../types'
import {
  formatDuration,
  parseDuration,
  sanitizeDurationInput,
} from '../lib/time'
import { getPdfPageCount } from '../lib/pdf'
import { buildSmartEstimate } from '../lib/smartEstimate'

interface Props extends RunStore {
  /** Course names seen before, offered as autocomplete suggestions. */
  knownCategories: string[]
  /** Past sessions — used to suggest goal times from the user's own history. */
  sessions: SessionRecord[]
}

/**
 * Shown while the timer is idle: name the session and add / edit / remove
 * tasks. Each task is a card with its own course, difficulty, goal time,
 * page count, and optional PDF.
 */
export function TaskEditor({
  run,
  setName,
  addTask,
  updateTask,
  removeTask,
  knownCategories,
  sessions,
}: Props) {
  return (
    <div className="editor">
      <div className="editor__field">
        <label className="editor__label" htmlFor="session-name">
          Session name
        </label>
        <input
          id="session-name"
          className="input"
          value={run.name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="editor__field">
        <span className="editor__label">Tasks</span>
      </div>

      {run.tasks.map((task) => (
        <EditableTaskCard
          key={task.id}
          task={task}
          sessions={sessions}
          onChange={(patch) => updateTask(task.id, patch)}
          onRemove={() => removeTask(task.id)}
        />
      ))}

      <button className="btn editor__add" onClick={addTask}>
        + Add task
      </button>

      {/* One shared autocomplete list of courses, referenced by every card. */}
      <datalist id="known-categories">
        {knownCategories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </div>
  )
}

interface CardProps {
  task: Task
  sessions: SessionRecord[]
  onChange: (patch: Partial<Omit<Task, 'id'>>) => void
  onRemove: () => void
}

/**
 * One editable task card. The goal field keeps its own draft string so the
 * user can type freely ("1:3" mid-edit); it is parsed only on blur.
 */
function EditableTaskCard({ task, sessions, onChange, onRemove }: CardProps) {
  const [goalDraft, setGoalDraft] = useState(() => formatDuration(task.goalMs))
  const [goalError, setGoalError] = useState<string | null>(null)
  const [pageDraft, setPageDraft] = useState(() => String(task.slideCount))
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    setPageDraft(String(task.slideCount))
  }, [task.slideCount])

  const smartEstimate = useMemo(
    () => buildSmartEstimate(task, sessions),
    [task, sessions],
  )

  const handleGoalDraft = (value: string): void => {
    setGoalDraft(sanitizeDurationInput(value))
    setGoalError(null)
  }

  const commitGoal = (): void => {
    const parsed = parseDuration(goalDraft)
    if (parsed === null) {
      setGoalError('Use 00:00 or 0:00:00.')
      setGoalDraft(formatDuration(task.goalMs))
    } else {
      onChange({ goalMs: parsed })
      setGoalDraft(formatDuration(parsed))
      setGoalError(null)
    }
  }

  const handlePageDraft = (value: string): void => {
    setPageDraft(value.replace(/\D/g, ''))
  }

  const commitPages = (): void => {
    const parsed = Number(pageDraft)
    const next = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
    onChange({ slideCount: next })
    setPageDraft(String(next))
  }

  const applySmartEstimate = (): void => {
    onChange({ goalMs: smartEstimate.recommendedMs })
    setGoalDraft(formatDuration(smartEstimate.recommendedMs))
    setGoalError(null)
  }

  const handlePdf = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfError(null)
    setPdfBusy(true)
    try {
      const pageCount = await getPdfPageCount(file)
      // Uploading a PDF fills in this task's page count automatically.
      onChange({ slideCount: pageCount, pdfName: file.name })
    } catch {
      setPdfError('Could not read that PDF. Please try a different file.')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="task-card">
      <div className="task-card__top">
        <input
          className="input"
          value={task.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Task name"
        />
        <button
          className="task-card__del"
          onClick={onRemove}
          aria-label="Remove task"
        >
          &times;
        </button>
      </div>

      <div className="task-card__grid">
        <label className="field">
          <span className="field__label">Course</span>
          <input
            className="input"
            list="known-categories"
            value={task.category}
            placeholder="e.g. Calculus"
            onChange={(e) => onChange({ category: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">Difficulty</span>
          <select
            className="input"
            value={task.difficulty}
            onChange={(e) =>
              onChange({ difficulty: e.target.value as Difficulty })
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Goal time</span>
          <input
            className={`input ${goalError ? 'input--error' : ''}`}
            value={goalDraft}
            inputMode="numeric"
            pattern="[0-9:]*"
            placeholder="00:00"
            onChange={(e) => handleGoalDraft(e.target.value)}
            onBlur={commitGoal}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            aria-invalid={goalError ? true : undefined}
            aria-describedby={goalError ? `${task.id}-goal-error` : undefined}
            aria-label={`Goal time for ${task.name}`}
          />
          {goalError && (
            <span className="field__error" id={`${task.id}-goal-error`}>
              {goalError}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Pages</span>
          <input
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageDraft}
            onChange={(e) => handlePageDraft(e.target.value)}
            onBlur={commitPages}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            aria-label={`Page count for ${task.name}`}
          />
        </label>
      </div>

      <div className="task-card__pdf">
        <input
          className="input task-card__file"
          type="file"
          accept="application/pdf"
          onChange={handlePdf}
          aria-label={`Attach a PDF for ${task.name}`}
        />
        {pdfBusy && <span className="task-card__pdf-note">Reading PDF…</span>}
        {!pdfBusy && task.pdfName && (
          <span className="task-card__pdf-note">
            {task.pdfName} · {task.slideCount} pages
          </span>
        )}
        {pdfError && <span className="task-card__pdf-error">{pdfError}</span>}
      </div>

      <label className="field task-card__context">
        <span className="field__label">Document context</span>
        <textarea
          className="input task-card__context-input"
          value={task.documentContext}
          rows={3}
          placeholder="Dense proofs, first pass, practice problems..."
          onChange={(e) => onChange({ documentContext: e.target.value })}
          aria-label={`Document context for ${task.name}`}
        />
      </label>

      <div className="task-card__smart">
        <div className="task-card__smart-top">
          <div className="task-card__smart-main">
            <span className="task-card__smart-label">Smart estimate</span>
            <strong>{formatDuration(smartEstimate.recommendedMs)}</strong>
            <span className="task-card__smart-sub">
              {smartEstimate.confidence} confidence · {smartEstimate.basis}
            </span>
          </div>
          <button className="task-card__smart-btn" onClick={applySmartEstimate}>
            Use
          </button>
        </div>
        <ul className="task-card__smart-reasons">
          {smartEstimate.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
