/**
 * Плагины авторов на канале вклада в тело (ADR 0173): отметка изменённых ячеек (S1),
 * карточка ячейки по двойному щелчку (S2), своя клавиша отметки (S3). Вид отметок и
 * карточки — CSS автора в `bodyPlugins.module.css`.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import type { PluginRootHookProps } from '../../core/bodyContributions'
import {
  definePlugin,
  pluginStateKey,
  setPluginState,
} from '../../core/definePlugin'
import { useTableState } from '../../core/reactivity'
import { Button } from '../../ui/Button'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import styles from './bodyPlugins.module.css'

/** Ключ ячейки в состоянии плагинов: строка и колонка. */
export const cellKey = (rowId: string, columnId: string) =>
  `${rowId}:${columnId}`

const keysOf = (state: Record<string, unknown>, id: string) =>
  (state[pluginStateKey(id)] as string[] | undefined) ?? []

// --- S1: изменённые ячейки -------------------------------------------------------------

export interface ChangesOptions {
  enabled?: boolean
  /** Изменённые ячейки — ключи `строка:колонка`; задаёт приложение. */
  changed?: string[]
  onChangedChange?: (next: string[]) => void
  initialChanged?: string[]
}

/** Отмечает изменённые ячейки атрибутом и цветом метки — переменной стиля. */
export const changes = definePlugin<ChangesOptions>()({
  id: 'changes',
  state: () => [] as string[],
  stateName: 'changed',
  body: () => ({
    cell: {
      select: (state, { cell }) =>
        keysOf(state, 'changes').includes(cellKey(cell.row.id, cell.column.id)),
      render: (changed: boolean) =>
        changed
          ? {
              attrs: { 'data-changes-cell': '' },
              style: { '--changes-tone': 'var(--tsr-comp-accent)' },
            }
          : null,
    },
  }),
})

// --- S2: карточка ячейки по двойному щелчку --------------------------------------------

interface CardTarget {
  rowId: string
  columnId: string
}

const cellElementOf = (
  scroller: HTMLElement | null,
  { rowId, columnId }: CardTarget,
) =>
  scroller?.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  ) ?? null

/** Карточка у ячейки: колонка и значение; закрывается кнопкой и клавишей Escape. */
const CellCard = ({ table, getScrollElement }: PluginRootHookProps) => {
  const target = useTableState(
    table,
    state =>
      (state as unknown as Record<string, unknown>)[
        pluginStateKey('cellCard')
      ] as CardTarget | null | undefined,
  )
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  // Место карточки — под ячейкой: ставится при монтировании, до кадра.
  const place = (card: HTMLDivElement | null) => {
    const box =
      card && target
        ? cellElementOf(getScrollElement(), target)?.getBoundingClientRect()
        : undefined
    if (card && box) {
      card.style.top = `${box.bottom + 4}px`
      card.style.left = `${box.left}px`
    }
  }
  useEffect(() => {
    if (!target) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPluginState(table, 'cellCard', null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [table, target])
  if (!target) return null
  const column = table.getColumn(target.columnId)
  const row = table.getRowSource().byId(target.rowId)
  const header = column?.columnDef.header
  return createPortal(
    <div
      role="dialog"
      aria-label={typeof header === 'string' ? header : target.columnId}
      data-testid="cell-card"
      className={`${themeClass} ${styles.card}`}
      {...themeData}
      ref={place}
    >
      <div className={styles.cardTitle}>
        {typeof header === 'string' ? header : target.columnId}
      </div>
      <div className={styles.cardValue}>
        {String(row?.getValue(target.columnId) ?? '')}
      </div>
      <Button
        variant="ghost"
        onClick={() => setPluginState(table, 'cellCard', null)}
      >
        Close
      </Button>
    </div>,
    document.body,
  )
}

/** Двойной щелчок по ячейке тела открывает карточку с её значением. */
export const cellCard = definePlugin<{ enabled?: boolean }>()({
  id: 'cellCard',
  state: () => null as CardTarget | null,
  body: () => ({
    root: {
      events: {
        dblclick: (_event, { table, cell }) => {
          if (cell) {
            setPluginState(table, 'cellCard', {
              rowId: cell.row.id,
              columnId: cell.column.id,
            })
          }
        },
      },
      useRoot: props => <CellCard {...props} />,
    },
    cell: {
      select: (state, { cell }) => {
        const target = state[pluginStateKey('cellCard')] as CardTarget | null
        return (
          target?.rowId === cell.row.id && target.columnId === cell.column.id
        )
      },
      render: (open: boolean) =>
        open ? { attrs: { 'data-cellcard-open': '' } } : null,
    },
  }),
})

// --- S3: своя клавиша ------------------------------------------------------------------

/** Клавиша плагина: отмечает активную ячейку и снимает отметку. */
export const MARK_KEY = 'm'

/**
 * Клавиша `m` отмечает активную ячейку и снимает отметку; ячейка остаётся на месте.
 * Смена активной ячейки с клавиатуры приходит в `onActiveCell`.
 */
export const keyMarks = definePlugin<{
  enabled?: boolean
  onActiveCell?: (next: { rowIndex: number; columnIndex: number }) => void
}>()({
  id: 'keyMarks',
  state: () => [] as string[],
  hooks: o => ({ onActiveCell: o.onActiveCell }),
  body: o => ({
    keys: {
      onKey: (event, { table, active }) => {
        if (
          event.key.toLowerCase() !== MARK_KEY ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        ) {
          return false
        }
        const row = table.getRowSource().at(active.rowIndex)
        const cell = row?.getVisibleCells()[active.columnIndex]
        if (!cell) return false
        const key = cellKey(cell.row.id, cell.column.id)
        const marks = keysOf(
          table.store.get() as unknown as Record<string, unknown>,
          'keyMarks',
        )
        setPluginState(
          table,
          'keyMarks',
          marks.includes(key)
            ? marks.filter(item => item !== key)
            : [...marks, key],
        )
        return true
      },
      onActiveCellChange: (_table, next) => o.onActiveCell?.(next),
    },
    cell: {
      select: (state, { cell }) =>
        keysOf(state, 'keyMarks').includes(
          cellKey(cell.row.id, cell.column.id),
        ),
      render: (marked: boolean) =>
        marked ? { attrs: { 'data-keymarks-cell': '' } } : null,
    },
  }),
})
