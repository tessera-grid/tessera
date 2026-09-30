/**
 * Журнал бизнес-колбэков для демо-историй (ADR 0040, ADR 0041): что грид сообщил
 * приложению и с какой причиной. Нейтральная вёрстка на токенах темы, без внешних
 * UI-зависимостей.
 */
import { ReactNode, useCallback, useRef, useState } from 'react'

export interface LogEntry {
  id: number
  time: string
  name: string
  detail: string
}

const format = (value: unknown): string =>
  typeof value === 'string' ? `"${value}"` : JSON.stringify(value)

/** Поля события одной строкой: `rowId="row-3" reason="cancel"`. */
export const describeEvent = (payload: Record<string, unknown>) =>
  Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${format(value)}`)
    .join(' ')

export const useCallbackLog = () => {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const nextId = useRef(0)
  const log = useCallback((name: string, detail = '') => {
    const time = new Date().toLocaleTimeString([], { hour12: false })
    nextId.current += 1
    const entry = { id: nextId.current, time, name, detail }
    setEntries(prev => [entry, ...prev].slice(0, 50))
  }, [])
  const clear = useCallback(() => setEntries([]), [])
  return { entries, log, clear }
}

interface CallbackLogProps {
  entries: LogEntry[]
  onClear: () => void
  /** Дополнительные контролы демо над журналом. */
  children?: ReactNode
}

export const CallbackLog = ({
  entries,
  onClear,
  children,
}: CallbackLogProps) => (
  <aside
    aria-label="Callback log"
    style={{
      // Не шире 340px; при узком окне уходит под грид (WithLog переносит).
      flex: '1 1 280px',
      maxWidth: 340,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      fontSize: 12,
      minHeight: 0,
    }}
  >
    {children}
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <strong>Callbacks</strong>
      <button type="button" onClick={onClear}>
        Clear
      </button>
    </div>
    <ol
      data-testid="callback-log"
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        overflow: 'auto',
        flex: 1,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {entries.length === 0 && (
        <li style={{ color: 'var(--muted-foreground)' }}>Nothing yet</li>
      )}
      {entries.map(entry => (
        <li
          key={entry.id}
          style={{
            padding: '4px 0',
            borderBottom: '1px solid var(--border)',
            wordBreak: 'break-word',
          }}
        >
          <span style={{ color: 'var(--muted-foreground)' }}>{entry.time}</span>{' '}
          <strong>{entry.name}</strong> {entry.detail}
        </li>
      ))}
    </ol>
  </aside>
)

/** Грид и журнал рядом; при нехватке ширины журнал уходит под грид. */
export const WithLog = ({
  children,
  log,
}: {
  children: ReactNode
  log: ReactNode
}) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      alignItems: 'stretch',
    }}
  >
    <div style={{ flex: '999 1 560px', minWidth: 0 }}>{children}</div>
    {log}
  </div>
)
