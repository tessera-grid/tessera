/**
 * Реестр заглушек пустой таблицы (ADR 0123): заглушка — запись с причиной, приоритетом,
 * условием и текстами из `localization`. Грид показывает первую по приоритету запись с
 * выполненным условием; новые причины добавляют плагины записями, а не ветками в гриде.
 */
import type { ReactNode } from 'react'

import type { TableLabels } from './localization'

/** A load failure as the grid sees it (ADR 0096). */
export interface StubLoadError {
  shown: boolean
  error: unknown
  reason?: string
  retry?: () => void
  pending: boolean
}

/** What the condition and the entry's texts know. */
export interface StubContext {
  table: unknown
  rowCount: number
  loadError: StubLoadError
}

export interface StubAction {
  label: string
  run: () => void
  pending?: boolean
  /** `icons` dictionary key (`retry`…): the grid finds the icon by it (ADR 0166). */
  icon?: string
  testId?: string
  /** The button takes focus when the stub appears if this returns `true` (called in an effect). */
  focusOnMount?: () => boolean
}

export interface StubEntry {
  /** Reason name: the key in the grid's `stubs` prop. */
  id: string
  /** Lower takes precedence. */
  priority: number
  /** Instead of the table (`grid`) or under the header (`body`). */
  placement: 'grid' | 'body'
  when: (context: StubContext) => boolean
  title: (labels: TableLabels) => string
  description?: (context: StubContext) => string | undefined
  /** Key of an icon or illustration in the `icons` dictionary, its size in px and its color (a CSS value). */
  media?: string
  mediaSize?: number
  mediaColor?: string
  action?: (context: StubContext, labels: TableLabels) => StubAction | undefined
  /** `false` — the appearance is announced by its own mechanism, not by the registry. */
  announce?: boolean
  testId?: string
}

/** What the application's own stub from the `stubs` prop receives. */
export interface StubRenderProps {
  action?: () => void
  error?: unknown
}

export type StubRender = ReactNode | ((props: StubRenderProps) => ReactNode)

/** Ids of built-in reasons; plugins add their own. */
export type StubId =
  'loadError' | 'columnsHidden' | 'noColumns' | 'filtered' | 'noData'

export type StubsOverride = Partial<Record<StubId | (string & {}), StubRender>>

interface ColumnsTable {
  getAllLeafColumns: () => {
    getIsVisible: () => boolean
    getIsActionsColumn: () => boolean
  }[]
}

/** Листовые колонки данных — без служебных (выбор, раскрытие, ручка, действия). */
export const dataColumnsOf = (table: unknown) =>
  (table as ColumnsTable)
    .getAllLeafColumns()
    .filter(column => !column.getIsActionsColumn())

export const hasVisibleDataColumns = (table: unknown) =>
  dataColumnsOf(table).some(column => column.getIsVisible())

/** Сторона общей иллюстрации заглушек, px. */
export const ILLUSTRATION_SIZE = 160

const CORE_STUBS: StubEntry[] = [
  {
    id: 'loadError',
    priority: 10,
    placement: 'body',
    when: ({ loadError }) => loadError.shown,
    title: labels => labels.loadFailedTitle,
    description: ({ loadError }) => loadError.reason,
    media: 'emptyState',
    mediaSize: ILLUSTRATION_SIZE,
    action: ({ loadError }, labels) =>
      loadError.retry && {
        label: labels.loadRetry,
        run: loadError.retry,
        pending: loadError.pending,
        icon: 'retry',
        testId: 'load-error-retry',
      },
    // Отказ объявляет сам механизм ошибки загрузки (ADR 0096).
    announce: false,
    testId: 'load-error-stub',
  },
  {
    id: 'noColumns',
    priority: 30,
    placement: 'grid',
    when: ({ table }) => !hasVisibleDataColumns(table),
    title: labels => labels.noColumnsTitle,
    media: 'emptyState',
    mediaSize: ILLUSTRATION_SIZE,
    testId: 'no-columns-stub',
  },
  {
    id: 'noData',
    priority: 50,
    placement: 'grid',
    when: ({ rowCount }) => rowCount === 0,
    title: labels => labels.noData,
    media: 'emptyState',
    mediaSize: ILLUSTRATION_SIZE,
    testId: 'no-data-stub',
  },
]

interface StubsTable {
  options: { stubEntries?: StubEntry[] }
}

/** Записи ядра и активных плагинов по приоритету; запись плагина с тем же `id` заменяет. */
export const stubEntriesOf = (table: unknown): StubEntry[] => {
  const byId = new Map<string, StubEntry>()
  for (const entry of [
    ...CORE_STUBS,
    ...((table as StubsTable).options.stubEntries ?? []),
  ]) {
    byId.set(entry.id, entry)
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority)
}

/**
 * Первая по приоритету запись с выполненным условием. Падение условия записи плагина
 * не роняет грид: запись пропускается (ADR 0037).
 */
export const resolveStub = (
  entries: readonly StubEntry[],
  context: StubContext,
): StubEntry | undefined =>
  entries.find(entry => {
    try {
      return entry.when(context)
    } catch {
      return false
    }
  })
