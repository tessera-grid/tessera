/**
 * Консоль истории (ADR 0124): под гридом — колбэки, состояние и жизненный цикл таблицы
 * и записи самой истории. Свёрнутая — заголовок со счётчиком и кнопки истории;
 * раскрытая — переключатели видов, «Очистить» и список записей.
 */
import { type ReactNode, useId, useRef, useState } from 'react'

import { DATA_GRID_THEME_CLASS } from '../../ui/theme'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { Button } from '../../ui/Button'
import { useIcons } from '../../ui/icons'
import { ConsoleFilters } from './ConsoleFilters'
import { ConsoleContext } from './consoleContext'
import { useArgsActions } from './useArgsActions'
import {
  CONSOLE_KINDS,
  type ConsoleEntry,
  type ConsoleKind,
  type ConsoleLog,
  type ConsoleSource,
} from './consoleLog'

/** Скругление рамки грида: `--tsr-sys-radius` → `--radius-md`. */
const RADIUS = 'var(--radius-md, 8px)'
/** Раскрытие и сворачивание тела консоли, мс — как у панели гайда. */
const EXPAND_MS = 250
/** Высота списка записей, px. */
const LIST_HEIGHT = 240
/** Список у последней записи, если до низа меньше, px. */
const STICK = 4

const KIND_LABEL: Record<ConsoleKind, string> = {
  action: 'Действие',
  callback: 'Колбэк',
  state: 'Состояние',
  lifecycle: 'Цикл',
}

const FILTER_LABEL: Record<ConsoleKind, string> = {
  action: 'Действия',
  callback: 'Колбэки',
  state: 'Состояние',
  lifecycle: 'Жизненный цикл',
}

/** Метка вида — фигура рядом с подписью вида, цветом не несёт смысла одна. */
const KIND_COLOR: Record<ConsoleKind, string> = {
  action: 'var(--chart-2)',
  callback: 'var(--chart-1)',
  state: 'var(--chart-3)',
  lifecycle: 'var(--chart-4)',
}

/** Источник действия словом. */
const SOURCE_LABEL: Record<ConsoleSource, string> = {
  pointer: 'мышь',
  keyboard: 'клавиатура',
  api: 'API',
  auto: 'грид',
  story: 'история',
}

/** «1 событие», «2 события», «5 событий». */
const events = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'событие'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'события'
        : 'событий'
  return `${count} ${word}`
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

/** Время записи по часам, до секунд: `14:03:27`. */
const clock = (time: number) => {
  const date = new Date(time)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Длительность колбэка: `0.4 мс`, `12 мс`, `1.25 с`. */
const duration = (ms: number) =>
  ms < 10
    ? `${ms.toFixed(1)} мс`
    : ms < 1000
      ? `${Math.round(ms)} мс`
      : `${(ms / 1000).toFixed(2)} с`

const MUTED = 'var(--muted-foreground)'

/** Заголовок колонки журнала: прилипает к верху при прокрутке. */
const HEAD = {
  position: 'sticky',
  top: 0,
  padding: '6px 16px 6px 0',
  background: 'var(--card)',
  borderBottom: '1px solid var(--border)',
  color: MUTED,
  fontWeight: 500,
  textAlign: 'left',
  whiteSpace: 'nowrap',
} as const

const span = (text: string, style: Partial<CSSStyleDeclaration> = {}) => {
  const element = document.createElement('span')
  element.textContent = text
  Object.assign(element.style, style)
  return element
}

const CELL: Partial<CSSStyleDeclaration> = {
  padding: '6px 16px 6px 0',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'baseline',
}

const cell = (style: Partial<CSSStyleDeclaration> = {}) => {
  const element = document.createElement('td')
  Object.assign(element.style, CELL, style)
  return element
}

/** Строка таблицы записей: тип, событие с деталями и «×N», время, длительность. */
const paintEntry = (row: HTMLTableRowElement, entry: ConsoleEntry) => {
  row.dataset.consoleKind = entry.kind
  const dot = span('', {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    marginRight: '6px',
    borderRadius: '999px',
    background: KIND_COLOR[entry.kind],
    verticalAlign: 'middle',
  })
  dot.setAttribute('aria-hidden', 'true')
  const kind = cell({ color: MUTED, whiteSpace: 'nowrap' })
  kind.append(dot, KIND_LABEL[entry.kind])
  const name = document.createElement('strong')
  name.textContent = entry.name
  // Запись группы — под своим действием, с отступом.
  const event = cell({
    wordBreak: 'break-word',
    paddingLeft: entry.child ? '20px' : '0',
  })
  if (entry.child) row.dataset.consoleChild = ''
  else delete row.dataset.consoleChild
  if (entry.actionId !== undefined) {
    event.append(span(`#${entry.actionId} `, { color: MUTED }))
  }
  event.append(name)
  if (entry.detail) event.append(` ${entry.detail}`)
  if (entry.count > 1) event.append(span(` ×${entry.count}`, { color: MUTED }))
  if (entry.source) {
    event.append(span(` · ${SOURCE_LABEL[entry.source]}`, { color: MUTED }))
  }
  if (entry.cause !== undefined) {
    event.append(span(` ← #${entry.cause}`, { color: MUTED }))
  }
  const numbers = { color: MUTED, whiteSpace: 'nowrap' }
  const time = cell({ ...numbers, fontVariantNumeric: 'tabular-nums' })
  time.textContent = clock(entry.time)
  time.dataset.consoleTime = ''
  const took = cell({ ...numbers, paddingRight: '0' })
  took.textContent =
    entry.duration === undefined ? '' : duration(entry.duration)
  took.dataset.consoleDuration = ''
  row.replaceChildren(kind, event, time, took)
}

const newRow = () => document.createElement('tr')

export const StoryConsole = ({
  log,
  actions,
  defaultExpanded = false,
}: {
  log: ConsoleLog
  /** Кнопки истории: в заголовке, видны и в свёрнутой консоли. */
  actions?: ReactNode
  defaultExpanded?: boolean
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [hidden, setHidden] = useState<ReadonlySet<ConsoleKind>>(new Set())
  const id = useId()
  const toggleKind = (kind: ConsoleKind) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (!next.delete(kind)) next.add(kind)
      return next
    })

  // Свёрнутое тело — вне фокуса и дерева доступности; атрибутом: в React 18 у пропа
  // `inert` нет булевой формы.
  const body = useRef<HTMLDivElement>(null)
  useIsomorphicLayoutEffect(() => {
    body.current?.toggleAttribute('inert', !expanded)
  }, [expanded])

  // Записи и счётчик — прямо в DOM по подписке на журнал: запись не перерисовывает
  // React, ни консоль, ни грид. Список держится у последней записи, пока его не
  // прокрутили вверх.
  const list = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  const table = useRef<HTMLTableElement>(null)
  const rows = useRef<HTMLTableSectionElement>(null)
  const empty = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  useIsomorphicLayoutEffect(() => {
    const element = list.current
    const body = rows.current
    if (!element || !body || !table.current || !empty.current) return
    const tableStyle = table.current.style
    const emptyStyle = empty.current.style
    const items = new Map<number, HTMLTableRowElement>()
    const painted = new WeakMap<HTMLTableRowElement, ConsoleEntry>()
    const paint = () => {
      const entries = log.entries()
      const total = entries.reduce((sum, entry) => sum + entry.count, 0)
      if (count.current) count.current.textContent = `· ${events(total)}`
      const shown = entries.filter(entry => !hidden.has(entry.kind))
      const keep = new Set(shown.map(entry => entry.id))
      for (const [entryId, item] of items) {
        if (!keep.has(entryId)) {
          item.remove()
          items.delete(entryId)
        }
      }
      const nodes = shown.map(entry => {
        let item = items.get(entry.id)
        if (!item) {
          item = newRow()
          items.set(entry.id, item)
        }
        if (painted.get(item) !== entry) {
          paintEntry(item, entry)
          painted.set(item, entry)
        }
        return item
      })
      // Записей нет — вместо таблицы с одной шапкой текст по центру окна.
      tableStyle.display = nodes.length > 0 ? '' : 'none'
      emptyStyle.display = nodes.length > 0 ? 'none' : 'flex'
      if (
        body.children.length !== nodes.length ||
        nodes.some((node, index) => body.children[index] !== node)
      ) {
        body.replaceChildren(...nodes)
      }
      if (stuck.current) element.scrollTop = element.scrollHeight
    }
    paint()
    // Частые записи перерисовывают список один раз — после текущей задачи.
    let queued = false
    let alive = true
    const unsubscribe = log.subscribe(() => {
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        if (alive) paint()
      })
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [log, hidden])
  useIsomorphicLayoutEffect(() => {
    const element = list.current
    if (element && expanded && stuck.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [expanded])

  const icons = useIcons()
  const ExpandIcon = icons.expand
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className={DATA_GRID_THEME_CLASS} style={{ padding: '12px 16px' }}>
      <section
        aria-label="Консоль"
        data-testid="story-console"
        style={{
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '8px 12px',
          border: '1px solid var(--border)',
          borderRadius: RADIUS,
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button
            variant="ghost"
            data-testid="story-console-toggle"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(open => !open)}
            icon={
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  flex: 'none',
                  width: 'var(--tsr-comp-button-icon-size)',
                  height: 'var(--tsr-comp-button-icon-size)',
                  transform: expanded ? undefined : 'rotate(-90deg)',
                  transition: reducedMotion
                    ? undefined
                    : `transform ${EXPAND_MS}ms ease`,
                }}
              >
                <ExpandIcon width="100%" height="100%" />
              </span>
            }
          >
            <strong>Консоль</strong>
            <span
              ref={count}
              data-console-count
              style={{ color: MUTED, fontWeight: 400 }}
            />
          </Button>
          {actions && (
            <div
              data-testid="story-console-actions"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
              }}
            >
              {actions}
            </div>
          )}
        </div>
        <div
          ref={body}
          id={id}
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            opacity: expanded ? 1 : 0,
            transition: reducedMotion
              ? undefined
              : `grid-template-rows ${EXPAND_MS}ms ease, opacity ${EXPAND_MS}ms ease`,
          }}
        >
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                padding: '8px 0',
                marginTop: 8,
                borderTop: '1px solid var(--border)',
              }}
            >
              <ConsoleFilters
                kinds={CONSOLE_KINDS}
                labels={FILTER_LABEL}
                colors={KIND_COLOR}
                hidden={hidden}
                onToggle={toggleKind}
                onShowAll={() => setHidden(new Set())}
              />
              <Button
                variant="ghost"
                data-testid="story-console-clear"
                style={{ marginLeft: 'auto' }}
                onClick={log.clear}
              >
                Очистить
              </Button>
            </div>
            <div
              ref={list}
              role="log"
              aria-live="off"
              aria-label="События таблицы"
              data-testid="story-console-log"
              tabIndex={0}
              onScroll={event => {
                const element = event.currentTarget
                stuck.current =
                  element.scrollTop + element.clientHeight >=
                  element.scrollHeight - STICK
              }}
              style={{
                height: LIST_HEIGHT,
                overflow: 'auto',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
              }}
            >
              <div
                ref={empty}
                data-console-empty
                style={{
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: MUTED,
                }}
              >
                Событий пока нет
              </div>
              <table
                ref={table}
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th scope="col" style={{ ...HEAD }}>
                      Тип
                    </th>
                    <th scope="col" style={{ ...HEAD }}>
                      Событие
                    </th>
                    <th scope="col" style={HEAD}>
                      Время
                    </th>
                    <th scope="col" style={HEAD}>
                      Длительность
                    </th>
                  </tr>
                </thead>
                <tbody ref={rows} />
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Грид демо-истории и консоль под ним; гриды внутри пишут в `log`. */
export const WithConsole = ({
  log,
  actions,
  args,
  children,
}: {
  log: ConsoleLog
  actions?: ReactNode
  /** Аргументы Storybook: их смена — действия истории. */
  args?: object
  children: ReactNode
}) => {
  useArgsActions(log, args)
  return (
    <ConsoleContext.Provider value={log}>
      {children}
      <StoryConsole log={log} actions={actions} />
    </ConsoleContext.Provider>
  )
}
