import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { useArgs } from 'storybook/preview-api'
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
  parameters: hideDataControls,
  render: function Render({
    multiSortMax,
    allowEditing,
    pageSizesPreset = 'default',
    ...args
  }) {
    const [, updateArgs] = useArgs()
    const [data] = useState(makeReactiveTree)
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
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
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <SessionCallbacksDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}
