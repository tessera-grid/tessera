import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { expect, userEvent } from 'storybook/test'
import type { CellComponentProps } from '../../lib/core/createSlots'
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
  callbackLog,
  rowAt,
  until,
  updateArgs,
  waitForRows,
} from './__mocks__/catalogPlay'
import { OVERLAY, dragRowOnto, rowIdOrder } from './rowDragging.dnd'

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
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

const hideDataControls = {
  controls: { exclude: ['columnCount', 'dataCount', 'colorMode'] },
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
  parameters: { ...hideDataControls, requirements: ['DS5'] },
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
        multiSortOptions={{ max: multiSortMax }}
        cellEditingCanEdit={allowEditing ? canEditDemoCell : denyEditing}
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
    enableColumnResizing: true,
  },
  // Дымовой сценарий (ADR 0042, DS3): бросок строки мышью пишет onRowDragEnd в журнал.
  parameters: { ...hideDataControls, requirements: ['DS3'] },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const [dropped] = rowIdOrder(canvasElement)
    await dragRowOnto(rowAt(canvasElement, 0), rowAt(canvasElement, 3))
    await until(() => expect(callbackLog()).toContain('onRowDragEnd'))
    expect(callbackLog()).toContain(`rowId="${dropped}"`)
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
