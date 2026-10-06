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
  CellEditingServerDemo,
  CellEditingSessionsDemo,
  RowExpandingLazyChildrenDemo,
  RowExpandingLazyDemo,
  SessionCallbacksDemo,
  canEditDemoCell,
  type ServerFailMode,
} from './demos/sessionDemos'

/**
 * Истории поведения: аргументы плагинов на лету (ADR 0039), сессии действий с
 * журналом колбэков (ADR 0040), сохранение и раскрытие с ожиданием (ADR 0041).
 */

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

const meta = {
  ...dataGridMeta,
  title: 'Tessera/DataGrid/Sessions & Async',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 6,
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
}

const failModeControl = {
  control: 'inline-radio',
  options: ['never', 'always'],
} as const

const hideDataControls = {
  controls: { exclude: ['columnCount', 'dataCount', 'dataMode', 'colorMode'] },
}

export const CellEditingServer: StoryObj<SessionsArgs> = {
  name: 'Cell Editing — server (async)',
  args: {
    ...GRID,
    // Сохранение с промисом (ADR 0041, 0057): ячейка ждёт сервера с бликом по контуру
    // и не блокирует правку соседних; отказ — вспышка и «ошибка» с меткой, повторная
    // правка открывает черновик с текстом отказа; успех — подсветка ячейки.
    // Задержка сервера — serverDelayMs, отказ каждого сохранения — serverFailMode.
    enableCellEditing: true,
    enableKeyboardNavigation: true,
    serverDelayMs: 1500,
    serverFailMode: 'never',
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    serverFailMode: failModeControl,
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <CellEditingServerDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}

export const CellEditingSessions: StoryObj<SessionsArgs> = {
  name: 'Cell Editing — sessions',
  args: {
    ...GRID,
    // Сессия правки (ADR 0040): черновик переживает прокрутку (300 строк), потеря
    // фокуса сохраняет, Escape отменяет — onEditCancel с причиной и черновиком.
    // «Change … externally» во время правки — конфликт: по умолчанию сохранение
    // проходит с original/current, в режиме block — onEditCancel с conflict.
    enableCellEditing: true,
    enableKeyboardNavigation: true,
    conflictMode: 'commit',
  },
  argTypes: {
    conflictMode: { control: 'inline-radio', options: ['commit', 'block'] },
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <CellEditingSessionsDemo
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
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

export const RowExpandingLazy: StoryObj<SessionsArgs> = {
  name: 'Row Expanding — lazy load (async)',
  args: {
    ...GRID,
    // Раскрытие с промисом (ADR 0041): строка раскрывается сразу, кнопка и строка
    // ждут «подгрузки» (aria-busy), повторное нажатие игнорируется; отказ
    // сворачивает строку обратно. Потомки уже в данных — задержка имитирует сеть.
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 1200,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}

/**
 * Ленивые дети (ADR 0054): у корней нет `subRows`, `hasChildren` читает `childCount`,
 * `loadChildren` на каждое раскрытие получает детей с «сервера». Повторное раскрытие
 * сразу показывает прошлый ответ и обновляет его; `node-3` сервер вернёт пустым — строка
 * станет листом; «Fail next load» и `loadFailMode` — вспышка тоггла и объявление.
 * Новые дети ответа подсвечены и объявлены (ADR 0056).
 */
export const RowExpandingLazyChildren: StoryObj<SessionsArgs> = {
  name: 'Row Expanding — lazy children (server)',
  args: {
    ...GRID,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 900,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  parameters: hideDataControls,
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyChildrenDemo
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
      />
    )
  },
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
  name: 'Plugin arguments on the fly',
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
