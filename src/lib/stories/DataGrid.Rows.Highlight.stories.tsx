import { Meta, StoryObj } from '@storybook/react'
import { useSyncExternalStore } from 'react'
import { expect } from 'storybook/test'

import { Trash2 } from 'lucide-react'

import type { TesseraFeatureEntry } from '../core/features'
import type { RowAction } from '../core/headerActions'
import type {
  HighlightHandle,
  HighlightOptions,
  HighlightTarget,
} from '../core/highlights/highlightFeature'
import { ToolbarButton } from '../ui/ToolbarButton'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  bodyRow,
  byTestId,
  guideNext,
  headCell,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { getData } from './__mocks__/data'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/**
 * Публичная подсветка (ADR 0080): `Playground` — подсвеченные строка, ячейка и колонка;
 * S1 — строки ждут подтверждения удаления, S2 — приложение отмечает найденное, ячейку
 * и колонку.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Highlight',
} satisfies Meta<StoryProps>

export default meta

interface HighlightApi {
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => HighlightHandle
  clearHighlights: (key?: string) => void
  getCoreRowModel: () => { rows: unknown[] }
}

/** Свой тон приложения: имя тона и токен его заливки в CSS приложения (ADR 0080, §4). */
const APP_TONE_CSS =
  '.data-grid-theme { --tsr-comp-highlight-info-bg: color-mix(in srgb, var(--tsr-comp-loader-bar) 20%, transparent); }'

/** Подсветки строки, ячейки и колонки — один раз, как только появились строки. */
const highlightsSeed: TesseraFeatureEntry = {
  id: 'highlightsSeed',
  setup: table => {
    const t = table as unknown as HighlightApi
    const appCss = document.createElement('style')
    appCss.textContent = APP_TONE_CSS
    document.head.append(appCss)
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.highlight({ row: 'item-id-1' }, { tone: 'info' })
      t.highlight({ row: 'item-id-3' }, { tone: 'danger' })
      t.highlight({ cell: ['item-id-5', 'firstName'] }, { tone: 'success' })
      t.highlight({ column: 'age' }, { tone: 'warning' })
    }
    apply()
    return () => {
      cancelAnimationFrame(frame)
      appCss.remove()
    }
  },
}

/**
 * Подсвеченные строка, ячейка и колонка в покое (ADR 0093, VR4); вторая строка — свой тон
 * приложения `info` с токеном заливки. Включите выбор строк, закрепление или выделение
 * ячеек — подсветка поверх этих состояний.
 */
export const RowHighlightPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('body.highlight'),
    ...showControls([
      'enableFooter',
      'enableRowSelection',
      'enableColumnPinning',
      'enableCellSelection',
    ]),
  },
  args: {
    extraPlugins: [highlightsSeed],
    dataCount: 12,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
}

const GRID = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
} satisfies Partial<StoryProps>

// --- S1 ------------------------------------------------------------------------------

/** Строки приложения, ожидающие подтверждения удаления: решение одно на всех. */
const deletion = (() => {
  const pending = new Map<string, (ok: boolean) => void>()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  return {
    count: () => pending.size,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ask: (id: string) =>
      new Promise<boolean>(resolve => {
        pending.set(id, resolve)
        notify()
      }),
    has: (id: string) => pending.has(id),
    decide: (ok: boolean) => {
      pending.forEach(resolve => resolve(ok))
      pending.clear()
      notify()
    },
  }
})()

const deleteRow: RowAction = {
  id: 'deleteRow',
  slot: 'actionRowSlot',
  order: 0,
  icon: () => <Trash2 width={16} height={16} />,
  label: () => 'Delete',
  onSelect: ctx => {
    if (deletion.has(ctx.row.id)) return
    const table = ctx.table as unknown as HighlightApi
    // Строка подсвечена, пока решение не принято.
    table.highlight(
      { row: ctx.row.id },
      { tone: 'danger', until: deletion.ask(ctx.row.id) },
    )
  },
}

/**
 * Кнопка приложения в тулбаре: вопрос об удалении отмеченных строк. Видна всегда —
 * её появление не сдвигает таблицу; без отмеченных строк выключена.
 */
const ConfirmDelete = () => {
  const count = useSyncExternalStore(deletion.subscribe, deletion.count)
  return (
    <ToolbarButton
      label={
        count === 0
          ? 'Delete marked rows'
          : `Delete ${count} ${count === 1 ? 'row' : 'rows'}`
      }
      icon={<Trash2 size={18} />}
      disabled={count === 0}
      data-testid="confirm-delete"
      onClick={() => deletion.decide(true)}
    />
  )
}

const deletionPlugin: TesseraFeatureEntry = {
  id: 'deletionGuide',
  slotActions: [deleteRow],
  slots: [
    {
      id: 'confirmDelete',
      slot: 'toolbarSlot',
      group: 'data',
      order: 0,
      component: ConfirmDelete,
    },
  ],
}

const deleteRows = getData(20)
const FIRST = deleteRows[1]!.id
const SECOND = deleteRows[3]!.id

const danger = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-highlight') === 'danger'
const deleteButton = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.querySelector<HTMLElement>(
    '[data-column-id="actionColumn__rowActions"] button',
  )
/** Пользователь нажимает удаление у строк, ещё не подсвеченных. */
const markForDeletion = (root: HTMLElement, ids: string[]) =>
  ids
    .filter(id => !danger(root, id))
    .forEach(id => deleteButton(root, id)?.click())

const DELETE: readonly GuideStoryStep[] = [
  {
    title: 'Действие удаления',
    hint: 'У строк есть действие удаления. Удаление приложение подтверждает отдельно.',
  },
  {
    title: 'Пользователь удаляет строку',
    hint: 'Пользователь нажал удаление. Строка подсвечена тоном опасности, приложение спрашивает подтверждение.',
    states: ['body.highlight'],
    enter: untilDone(
      root => danger(root, FIRST),
      root => markForDeletion(root, [FIRST]),
    ),
  },
  {
    title: 'Пользователь удаляет ещё одну строку',
    hint: 'Обе строки подсвечены, приложение спрашивает об удалении двух строк.',
    states: ['body.highlight'],
    enter: untilDone(
      root => danger(root, FIRST) && danger(root, SECOND),
      root => markForDeletion(root, [FIRST, SECOND]),
    ),
  },
  {
    title: 'Пользователь подтвердил удаление',
    hint: 'Строки ушли из таблицы, подсветки больше нет.',
    enter: untilDone<{
      update: (change: () => Partial<StoryProps>) => void
    }>(
      root => !bodyRow(root, FIRST) && !bodyRow(root, SECOND),
      (root, app) => {
        if (!danger(root, FIRST) || !danger(root, SECOND)) {
          markForDeletion(root, [FIRST, SECOND])
          return
        }
        byTestId('confirm-delete')?.click()
        app.update(() => ({
          dataOverride: deleteRows.filter(
            row => row.id !== FIRST && row.id !== SECOND,
          ),
        }))
      },
    ),
  },
]

/** S1: приложение подсвечивает строки, ожидающие подтверждения удаления. */
export const HighlightDeleteConfirmation: StoryObj<StoryProps> = {
  name: 'Delete confirmation',
  parameters: {
    scenario: '0080/S1',
    requirements: ['HL21'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Подсветка до подтверждения"
      steps={DELETE}
      args={guideArgs(
        {
          ...GRID,
          enableRowActions: true,
          actionsDemo: 'none',
          extraPlugins: [deletionPlugin],
          dataOverride: deleteRows,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    // Тело относительно тулбара: панель гайда над таблицей меняет высоту от шага к шагу.
    const top = () =>
      canvas.querySelector('.data-grid__container')!.getBoundingClientRect()
        .top - byTestId('data-grid-toolbar')!.getBoundingClientRect().top
    let gridTop = 0
    await step(DELETE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(deleteButton(canvas, FIRST)).toBeTruthy())
      await until(() => {
        const button = byTestId('confirm-delete') as HTMLButtonElement | null
        expect(
          !!button?.disabled ||
            button?.getAttribute('aria-disabled') === 'true',
        ).toBe(true)
      })
      gridTop = top()
    })
    await step(DELETE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(danger(canvas, FIRST)).toBe(true))
      await until(() =>
        expect(byTestId('confirm-delete')).toHaveAccessibleName('Delete 1 row'),
      )
      await expect(top()).toBe(gridTop)
    })
    await step(DELETE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(danger(canvas, SECOND)).toBe(true))
      await expect(danger(canvas, FIRST)).toBe(true)
      await expect(byTestId('confirm-delete')).toHaveAccessibleName(
        'Delete 2 rows',
      )
    })
    await step(DELETE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(bodyRow(canvas, FIRST)).toBeFalsy())
      await expect(bodyRow(canvas, SECOND)).toBeFalsy()
      await until(() =>
        expect(canvas.querySelector('[data-highlight="danger"]')).toBeNull(),
      )
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

let marksTable: HighlightApi | null = null

/** Отдаёт таблицу шагам: подсветку ставит приложение. */
const marksHost: TesseraFeatureEntry = {
  id: 'highlightMarksHost',
  setup: table => {
    marksTable = table as unknown as HighlightApi
    return () => {
      marksTable = null
    }
  },
}

const markRows = getData(30)
const QUERY = 'ar'
const SEARCH_COLUMNS = ['firstName', 'lastName', 'country'] as const
const MARKED_ROW = markRows[2]!.id

const searchMarks = () => {
  marksTable?.clearHighlights('search')
  for (const row of markRows)
    for (const column of SEARCH_COLUMNS)
      if (String(row[column]).toLowerCase().includes(QUERY))
        marksTable?.highlight(
          { cell: [row.id, column] },
          { key: 'search', tone: 'warning' },
        )
}
const cellMark = () =>
  marksTable?.highlight(
    { cell: [MARKED_ROW, 'age'] },
    { key: 'cell', tone: 'success' },
  )
const columnMark = () =>
  marksTable?.highlight({ column: 'total' }, { key: 'column', tone: 'success' })
/** Прямоугольник 2 × 2 одной отметкой в начале таблицы (ADR 0152, §4). */
const RANGE_ROWS = [markRows[0]!.id, markRows[1]!.id]
const RANGE_COLUMNS = ['firstName', 'lastName'] as const
const rangeMark = () =>
  marksTable?.highlight(
    {
      range: {
        rows: [RANGE_ROWS[0]!, RANGE_ROWS[1]!],
        columns: [RANGE_COLUMNS[0], RANGE_COLUMNS[1]],
      },
    },
    { key: 'range', tone: 'danger' },
  )

/** Приложение ставит подсветки шага, как только таблица готова; уход с шага — отмена. */
const applyMarks =
  (...marks: (() => unknown)[]) =>
  (root: HTMLElement) => {
    let tries = 0
    let left = false
    const run = () => {
      if (left) return
      if (marksTable && root.querySelector('.data-grid__body-row')) {
        marks.forEach(mark => mark())
        return
      }
      if (++tries < 80) setTimeout(run, 50)
    }
    setTimeout(run, 0)
    return () => {
      left = true
    }
  }

const searchCells = (root: HTMLElement) =>
  root.querySelectorAll('.data-grid__body-cell[data-highlight="warning"]')
const markedCell = (root: HTMLElement) =>
  bodyRow(root, MARKED_ROW)?.querySelector(
    '.data-grid__body-cell[data-column-id="age"][data-highlight="success"]',
  )

const MARKS: readonly GuideStoryStep[] = [
  {
    title: 'Пользователь ищет',
    hint: 'Пользователь ввёл запрос в поиске приложения. Ячейки с совпадениями подсвечены.',
    states: ['body.highlight'],
    enter: applyMarks(searchMarks),
  },
  {
    title: 'Приложение отметило ячейку',
    hint: 'Приложение подсветило ячейку с результатом действия.',
    states: ['body.highlight'],
    enter: applyMarks(searchMarks, cellMark),
  },
  {
    title: 'Приложение отметило колонку',
    hint: 'Приложение подсветило всю колонку итогов.',
    states: ['body.highlight'],
    enter: applyMarks(searchMarks, cellMark, columnMark),
  },
  {
    title: 'Приложение отметило диапазон',
    hint: 'Приложение подсветило прямоугольник ячеек — две строки в двух колонках — одной отметкой.',
    states: ['body.highlight'],
    enter: applyMarks(searchMarks, cellMark, columnMark, rangeMark),
  },
]

/** S2: приложение отмечает найденное, ячейку и колонку. */
export const HighlightMarks: StoryObj<StoryProps> = {
  name: 'Search, cell and column',
  parameters: {
    scenario: '0080/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Отметки приложения"
      steps={MARKS}
      args={guideArgs(
        {
          ...GRID,
          enableFooter: true,
          extraPlugins: [marksHost],
          dataOverride: markRows,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MARKS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(searchCells(canvas).length).toBeGreaterThan(0))
      await expect(markedCell(canvas)).toBeFalsy()
    })
    await step(MARKS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(markedCell(canvas)).toBeTruthy())
      await expect(searchCells(canvas).length).toBeGreaterThan(0)
    })
    await step(MARKS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(headCell(canvas, 'total')).toHaveAttribute(
          'data-column-highlight',
          'success',
        ),
      )
      await expect(markedCell(canvas)).toBeTruthy()
      await settle()
    })
    await step(MARKS[3]!.title, async () => {
      await guideNext(canvas)
      const rangeCells = () =>
        RANGE_ROWS.flatMap(row =>
          RANGE_COLUMNS.map(column =>
            bodyRow(canvas, row)?.querySelector(
              `.data-grid__body-cell[data-column-id="${column}"]`,
            ),
          ),
        )
      await until(() =>
        expect(
          rangeCells().every(
            cell => cell?.getAttribute('data-highlight') === 'danger',
          ),
        ).toBe(true),
      )
      await expect(
        bodyRow(canvas, markRows[2]!.id)
          ?.querySelector('.data-grid__body-cell[data-column-id="firstName"]')
          ?.getAttribute('data-highlight'),
      ).not.toBe('danger')
      await settle()
    })
  },
}
