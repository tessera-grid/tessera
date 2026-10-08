import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { useArgs } from 'storybook/preview-api'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  CellEditingServerDemo,
  CellEditingSessionsDemo,
  type ServerFailMode,
} from './demos/sessionDemos'

/** Правка ячеек (ADR 0028, ADR 0040, ADR 0041): базовая, с сервером, сессии с журналом колбэков. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Editing',
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

const failModeControl = {
  control: 'inline-radio',
  options: ['never', 'always'],
} as const

const hideDataControls = {
  controls: { exclude: ['columnCount', 'dataCount', 'colorMode'] },
}

export const CellEditing: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableCellEditing: true,
    // Немного колонок/строк без виртуализации: кнопка редактирования появляется в
    // правом слоте по hover, а редактируемость гейтит канредактируемые колонки
    // (age/visits/gender — CELL_EDITABLE_COLUMNS). Коммит по Enter пишет значение
    // в мок-данные и сразу виден в ячейке.
    columnCount: 6,
    dataCount: 10,
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount'],
    },
  },
}

export const CellEditingServer: StoryObj<SessionsArgs> = {
  name: 'Server (async)',
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
  name: 'Sessions',
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
