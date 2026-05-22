import { useMemo, useState } from 'react'
import { useRun } from './state/runStore'
import { useHistory } from './state/historyStore'
import { useTimer } from './hooks/useTimer'
import { formatDuration } from './lib/time'
import type { SessionRecord } from './types'
import { TimerDisplay } from './components/TimerDisplay'
import { TaskList } from './components/TaskList'
import { TaskEditor } from './components/TaskEditor'
import { Controls } from './components/Controls'
import { HistoryView } from './components/HistoryView'
import { RunSummary } from './components/RunSummary'
import { StatsView } from './components/StatsView'

/** The screens the app can show. History and Stats are reachable while idle. */
type View = 'timer' | 'history' | 'stats'

/**
 * The root component. Its job is wiring: it owns the "attempt" state
 * (how far we've gotten) and connects the run data, the timer, the
 * history, and the UI components together. The actual rules live in the hooks.
 */
export default function App() {
  const runStore = useRun()
  const { run } = runStore
  const history = useHistory()
  const timer = useTimer()

  // Which screen is showing.
  const [view, setView] = useState<View>('timer')

  // Attempt state — reset every time a new run starts.
  const [currentIndex, setCurrentIndex] = useState(0)
  const [splits, setSplits] = useState<number[]>([])

  // Cumulative goal time at each task. Derived from the tasks, never stored.
  const cumulativeGoals = useMemo(() => {
    const result: number[] = []
    let sum = 0
    for (const task of run.tasks) {
      sum += task.goalMs
      result.push(sum)
    }
    return result
  }, [run.tasks])

  const totalGoalMs = cumulativeGoals[cumulativeGoals.length - 1] ?? 0

  // Every course name seen across the current run and saved history —
  // feeds the editor's autocomplete.
  const knownCategories = useMemo(() => {
    const names = new Set<string>()
    for (const task of run.tasks) {
      if (task.category.trim()) names.add(task.category.trim())
    }
    for (const session of history.sessions) {
      for (const task of session.tasks) {
        if (task.category.trim()) names.add(task.category.trim())
      }
    }
    return [...names].sort()
  }, [run.tasks, history.sessions])

  const handleStart = (): void => {
    setCurrentIndex(0)
    setSplits([])
    timer.start()
  }

  // Freeze the current run + splits into a history record and save it.
  const saveSession = (
    finalSplits: number[],
    totalElapsedMs: number,
    completed: boolean,
  ): void => {
    const record: SessionRecord = {
      id: crypto.randomUUID(),
      runName: run.name || 'Untitled Session',
      completedAt: Date.now(),
      completed,
      totalGoalMs,
      totalElapsedMs,
      tasks: run.tasks.map((task, i) => {
        // A task's own duration is its split minus the previous split.
        const reached = i < finalSplits.length
        const previousSplit = i === 0 ? 0 : finalSplits[i - 1]
        return {
          name: task.name,
          category: task.category,
          difficulty: task.difficulty,
          slideCount: task.slideCount,
          goalMs: task.goalMs,
          actualMs: reached ? finalSplits[i] - previousSplit : null,
        }
      }),
    }
    history.addSession(record)
  }

  const handleSplit = (): void => {
    // Read the exact time now, so the split is not rounded to the last render.
    const nextSplits = [...splits, timer.readElapsed()]
    setSplits(nextSplits)

    if (nextSplits.length >= run.tasks.length) {
      timer.finish()
      saveSession(nextSplits, nextSplits[nextSplits.length - 1], true)
    } else {
      setCurrentIndex(nextSplits.length)
    }
  }

  const handleReset = (): void => {
    // A reset mid-run is saved as an incomplete session (if any task was
    // finished). A finished run was already saved, so we don't save it twice.
    if (
      (timer.status === 'running' || timer.status === 'paused') &&
      splits.length >= 1
    ) {
      saveSession(splits, timer.readElapsed(), false)
    }
    timer.reset()
    setCurrentIndex(0)
    setSplits([])
  }

  const isIdle = timer.status === 'idle'
  const isFinished = timer.status === 'finished'
  const showHistory = isIdle && view === 'history'
  const showStats = isIdle && view === 'stats'
  // History and Stats are full-screen views — they hide the clock/controls.
  const showSidePanel = showHistory || showStats
  const taskCount = run.tasks.length
  const sessionCount = history.sessions.length

  return (
    <div className="app">
      <header className="app__header">
        {isIdle && (
          <div className="tabs">
            <button
              className={`tab ${view === 'timer' ? 'tab--active' : ''}`}
              onClick={() => setView('timer')}
            >
              Timer
            </button>
            <button
              className={`tab ${view === 'history' ? 'tab--active' : ''}`}
              onClick={() => setView('history')}
            >
              History
            </button>
            <button
              className={`tab ${view === 'stats' ? 'tab--active' : ''}`}
              onClick={() => setView('stats')}
            >
              Stats
            </button>
          </div>
        )}

        {showHistory && (
          <>
            <div className="app__title">Session History</div>
            <div className="app__subtitle">
              {sessionCount} saved session{sessionCount === 1 ? '' : 's'}
            </div>
          </>
        )}
        {showStats && (
          <>
            <div className="app__title">Your Stats</div>
            <div className="app__subtitle">Based on every saved session</div>
          </>
        )}
        {!showSidePanel && (
          <>
            <div className="app__title">
              {isFinished ? 'Run Summary' : run.name || 'Untitled Session'}
            </div>
            <div className="app__subtitle">
              {taskCount} task{taskCount === 1 ? '' : 's'} · target{' '}
              {formatDuration(totalGoalMs)}
            </div>
          </>
        )}
      </header>

      <div className="app__body">
        {showHistory ? (
          <HistoryView
            sessions={history.sessions}
            onDelete={history.removeSession}
          />
        ) : showStats ? (
          <StatsView sessions={history.sessions} />
        ) : isIdle ? (
          <TaskEditor
            {...runStore}
            knownCategories={knownCategories}
            sessions={history.sessions}
          />
        ) : isFinished ? (
          <RunSummary tasks={run.tasks} splits={splits} />
        ) : (
          <TaskList
            tasks={run.tasks}
            cumulativeGoals={cumulativeGoals}
            splits={splits}
            currentIndex={currentIndex}
          />
        )}
      </div>

      {/* The clock and controls belong to the Timer view only. */}
      {!showSidePanel && (
        <>
          <TimerDisplay
            elapsedMs={timer.elapsedMs}
            status={timer.status}
            totalGoalMs={totalGoalMs}
          />
          <Controls
            status={timer.status}
            canStart={taskCount > 0}
            onStart={handleStart}
            onSplit={handleSplit}
            onPause={timer.pause}
            onResume={timer.resume}
            onReset={handleReset}
          />
        </>
      )}
    </div>
  )
}
