import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { expect, userEvent } from 'storybook/test'
import type {
  CellComponentProps,
  ToolbarComponentProps,
} from '../../lib/core/createSlots'
import { sourceOf } from '../../lib/core/debugActions'
import { definePlugin } from '../../lib/core/definePlugin'
import { Button } from '../../lib/ui/Button'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  SessionCallbacksDemo,
  canEditDemoCell,
  type ServerFailMode,
} from './demos/sessionDemos'
import { argsUpdater } from './__mocks__/catalog'
import {
  consoleText,
  guideNext,
  rowAt,
  settle,
  until,
  updateArgs,
  waitForRows,
} from './__mocks__/catalogPlay'
import { OVERLAY, dragRowOnto, rowIdOrder } from './rowDragging.dnd'
import { BASE_CONTROLS, showControls } from './__mocks__/utils/dataGridControls'

/** API плагинов: аргументы на лету (ADR 0039), колбэки сессий перетаскивания и ширины (ADR 0040). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Plugin API',
} satisfies Meta<StoryProps>

export default meta

/** Аргументы демо-историй: задержка и отказ «сервера», предустановки на лету. */
interface SessionsArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: ServerFailMode
  conflictMode?: 'commit' | 'block'
  loadDelayMs?: number
  loadFailMode?: ServerFailMode
  /** ADR 0039: предел мультисортировки на лету. */
  multiSortMax?: number
  /** ADR 0039: разрешить правку на лету. */
  allowEditing?: boolean
  /** ADR 0039: набор размеров страницы на лету. */
  pageSizesPreset?: 'default' | 'small' | 'hidden'
}

const GRID = {
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

// --- Аргументы плагинов на лету (ADR 0039) -------------------------------------

const denyEditing = (_ctx: CellComponentProps) => false

const PAGE_SIZE_PRESETS: Record<
  NonNullable<SessionsArgs['pageSizesPreset']>,
  number[] | false | undefined
> = {
  default: undefined,
  small: [5, 10, 20],
  hidden: false,
}

// Данные — при рендере истории, а не при импорте модуля: makeData пересевает общий
// faker, и данные остальных историй (и снимки тестов) зависели бы от импорта.
const makeReactiveTree = () =>
  makeData({ shape: 'tree', count: 40, depth: 3, breadth: 2 })

export const ReactiveArgs: StoryObj<SessionsArgs> = {
  name: 'Arguments on the fly',
  args: {
    ...GRID,
    // Аргументы фабрик меняются на той же таблице (ADR 0039): раскройте глубокие
    // строки и уменьшите maxDepth — они скрыты, но состояние не стёрто; верните
    // значение — раскрытие на месте. То же с multiSortMax (Shift+клик по заголовкам),
    // allowEditing (кнопка правки) и набором размеров страницы.
    enableRowExpanding: true,
    enableColumnSorting: true,
    enableCellEditing: true,
    enablePagination: true,
    rowExpandingMaxDepth: 3,
    multiSortMax: 3,
    allowEditing: true,
    pageSizesPreset: 'default',
  },
  argTypes: {
    rowExpandingMaxDepth: { control: { type: 'range', min: 1, max: 3 } },
    multiSortMax: { control: { type: 'range', min: 1, max: 4 } },
    allowEditing: { control: 'boolean' },
    pageSizesPreset: {
      control: 'inline-radio',
      options: ['default', 'small', 'hidden'],
    },
  },
  // Дымовой сценарий (ADR 0042, DS5): глубже maxDepth раскрытие скрыто, а не стёрто.
  parameters: {
    requirements: ['DS5'],
    ...showControls(
      [
        'enableColumnSorting',
        'columnSortingRemoval',
        'columnSortingMultiSort',
        'columnSortingServer',
        'columnSortingRevertOnReject',
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'enableTreeLines',
        'enableCellEditing',
        'enablePagination',
        'paginationInitialPageSize',
        'paginationPageSizes',
        'paginationRevertOnReject',
        'multiSortMax',
        'allowEditing',
        'pageSizesPreset',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement, id }) => {
    await waitForRows(canvasElement)
    const expanded = (index: number) =>
      rowAt(canvasElement, index).getAttribute('data-expanded')
    for (const index of [0, 1]) {
      await userEvent.click(
        rowAt(canvasElement, index).querySelector('.row-expand-button')!,
      )
      await until(() => expect(expanded(index)).toBe('true'))
    }

    await updateArgs(id, { rowExpandingMaxDepth: 1 })
    await until(() => expect(expanded(1)).toBeNull())
    expect(expanded(0)).toBe('true')

    await updateArgs(id, { rowExpandingMaxDepth: 3 })
    await until(() => expect(expanded(1)).toBe('true'))
  },
  // Без хуков Storybook: `play` меняет аргументы, и в каталоге историю перерисовывает React.
  render: function Render(
    { multiSortMax, allowEditing, pageSizesPreset = 'default', ...args },
    { id },
  ) {
    const [data] = useState(makeReactiveTree)
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        updateArgs={argsUpdater(id)}
        dataOverride={data}
        columnSortingMultiSort={{ max: multiSortMax }}
        cellEditingCanEditCell={allowEditing ? canEditDemoCell : denyEditing}
        paginationPageSizes={PAGE_SIZE_PRESETS[pageSizesPreset]}
      />
    )
  },
}

export const SessionCallbacks: StoryObj<SessionsArgs> = {
  name: 'Drag & resize callbacks',
  args: {
    ...GRID,
    dataCount: 30,
    // Колбэки успеха и отмены (ADR 0040): бросок — onRowDragEnd/onColumnDragEnd,
    // Escape или бросок мимо — *Cancel с cancel; Escape во время ресайза
    // возвращает ширину и зовёт onColumnResizeCancel. Выключите плагин посреди
    // действия — отмена с revoke.
    enableRowDragging: true,
    enableColumnDragging: true,
    enableColumnSizing: true,
  },
  // Дымовой сценарий (ADR 0042, DS3): бросок строки мышью пишет onRowDragEnd в журнал.
  parameters: {
    requirements: ['DS3'],
    ...showControls([
      'enableColumnSizing',
      'enableColumnDragging',
      'columnDraggingRevertOnReject',
      'enableRowDragging',
      'rowDraggingExpandDelay',
      'rowDraggingRevertOnReject',
    ]),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const [dropped] = rowIdOrder(canvasElement)
    await dragRowOnto(rowAt(canvasElement, 0), rowAt(canvasElement, 3))
    await until(() => expect(consoleText()).toContain('onRowDragEnd'))
    expect(consoleText()).toContain(`rowId="${dropped}"`)
    // Облако долетело — история в покое.
    await until(() => expect(canvasElement.querySelector(OVERLAY)).toBeNull())
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <SessionCallbacksDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}

// --- Канал действий (ADR 0125) ---------------------------------------------------

/** Набор функций задаёт гайд: базовые контролы скрыты. */
const GUIDED = showControls(
  [],
  Object.fromEntries(
    BASE_CONTROLS.map(name => [name, 'Таблицу по шагам задаёт гайд сценария']),
  ),
)

const guided = (title: string, steps: readonly GuideStoryStep[]) =>
  function Render(args: StoryProps) {
    return (
      <GuideStory
        title={title}
        steps={steps}
        // Аргументы Storybook, оставшиеся в URL, функции не включают.
        args={normalizeArgs({
          ...GRID,
          ...meta.args,
          colorMode: args.colorMode,
        })}
      />
    )
  }

const DEBUG_ACTIONS: readonly GuideStoryStep[] = [
  {
    title: 'Журнал пуст',
    hint: 'Приложение подписано на onDebugAction: каждое действие попадает в консоль под таблицей. Раскройте её.',
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: 'Сортировка мышью',
    hint: 'Нажмите кнопку сортировки в шапке First name: действие №1 columnSorting, источник «мышь».',
  },
  {
    title: 'Сортировка клавишей',
    hint: 'Включена клавиатура: Tab в шапку, Enter на заголовке — то же действие с источником «клавиатура».',
    props: () => ({ enableKeyboardNavigation: true }),
  },
]

const sortButton = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="firstName"] .column-sort__button',
  )!

/** S1: приложение пишет действия пользователя в свой журнал через `onDebugAction`. */
export const PluginApiDebugActions: StoryObj<StoryProps> = {
  name: 'Debug actions',
  parameters: {
    scenario: '0125/S1',
    requirements: ['AL1'],
    ...GUIDED,
  },
  render: guided('Журнал действий', DEBUG_ACTIONS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DEBUG_ACTIONS[0].title, async () => {
      await waitForRows(canvas)
      // Действий ещё нет: номера «#N» стоят только у действий.
      expect(consoleText()).not.toMatch(/#d/)
    })
    await step(DEBUG_ACTIONS[1].title, async () => {
      await guideNext(canvas)
      await userEvent.click(sortButton(canvas))
      await until(() =>
        expect(consoleText()).toMatch(/#1\b[^\n]*columnSorting[^\n]*мышь/),
      )
    })
    await step(DEBUG_ACTIONS[2].title, async () => {
      await guideNext(canvas)
      const head = sortButton(canvas).closest<HTMLElement>(
        '.data-grid__head-cell',
      )!
      head.focus()
      await userEvent.keyboard('{Enter}')
      await until(() =>
        expect(consoleText()).toMatch(/columnSorting\.toggle[^\n]*клавиатура/),
      )
    })
    await settle()
  },
}

/** Кнопка плагина в тулбаре: сообщает своё действие и показывает его номер. */
const StarButton = ({ table }: ToolbarComponentProps) => {
  const [last, setLast] = useState<number>()
  return (
    <Button
      data-testid="star-rows"
      onClick={event =>
        setLast(
          table.reportAction({
            plugin: 'starRows',
            action: 'starAll',
            source: sourceOf(event),
          }),
        )
      }
    >
      {last === undefined ? 'Star rows' : `Star rows · #${last}`}
    </Button>
  )
}

const starRows = definePlugin()({
  id: 'starRows',
  slots: [{ id: 'starRows', slot: 'toolbarSlot', component: StarButton }],
})
/** Одна запись на историю: смена набора плагинов — только когда её добавляет шаг. */
const STAR_ROWS = [starRows()]

const REPORT_ACTION: readonly GuideStoryStep[] = [
  {
    title: 'Кнопка плагина',
    hint: 'Плагин definePlugin ставит в тулбар кнопку «Star rows». Других плагинов нет — table.reportAction ставит ядро.',
    props: () => ({ extraPlugins: STAR_ROWS }),
  },
  {
    title: 'Нажатие кнопки',
    hint: 'Кнопка зовёт table.reportAction: в консоли — действие starRows · starAll, а кнопка показывает его номер.',
  },
]

/** S2: автор плагина сообщает действие своей кнопки через `table.reportAction`. */
export const PluginApiReportAction: StoryObj<StoryProps> = {
  name: 'Report action',
  parameters: {
    scenario: '0125/S2',
    requirements: ['AL2'],
    ...GUIDED,
  },
  render: guided('Действие плагина', REPORT_ACTION),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const button = () =>
      canvas.querySelector<HTMLElement>('[data-testid="star-rows"]')
    await step(REPORT_ACTION[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(button()).not.toBeNull())
    })
    await step(REPORT_ACTION[1].title, async () => {
      await guideNext(canvas)
      await userEvent.click(button()!)
      await until(() =>
        expect(consoleText()).toMatch(/#1\b[^\n]*starRows · starAll[^\n]*мышь/),
      )
      expect(button()!.textContent).toBe('Star rows · #1')
    })
    await settle()
  },
}
