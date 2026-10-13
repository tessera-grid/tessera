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
import { expect, waitFor, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  callbackLog,
  rowAt,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'

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
  // Дымовой сценарий (ADR 0042, DS1): ячейка ждёт сервера, затем показывает новое значение.
  parameters: { ...hideDataControls, requirements: ['DS1'] },
  play: async ({ canvasElement }) => {
    const cell = await editCell(canvasElement, { row: 0, value: '77' })
    await until(() =>
      expect(cell().querySelector('[aria-busy="true"]')).not.toBeNull(),
    )
    await until(() =>
      expect(cell().querySelector('[aria-busy="true"]')).toBeNull(),
    )
    expect(cell()).toHaveTextContent('77')
    expect(callbackLog()).toContain('onCellEdit')
    expect(callbackLog()).toContain('saved age of row-0')
    await settle()
  },
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
  // Дымовой сценарий (ADR 0042, DS2): изменение извне не закрывает редактор.
  parameters: { ...hideDataControls, requirements: ['DS2'] },
  play: async ({ canvasElement }) => {
    const cell = await editCell(canvasElement, {
      row: 0,
      value: '55',
      submit: false,
    })
    const input = cell().querySelector('input')
    await userEvent.click(
      [...canvasElement.ownerDocument.querySelectorAll('button')].find(
        button => button.textContent === 'Change first row age externally',
      )!,
    )
    await until(() => expect(callbackLog()).toContain('external'))
    expect(document.activeElement).toBe(input)

    await userEvent.keyboard('{Enter}')
    await until(() => expect(callbackLog()).toContain('onCellEdit'))
    expect(callbackLog()).toMatch(/value="55" original=\d+ current=\d+/)
    await settle()
  },
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

const EDITING_ARGS = {
  enableCellEditing: true,
  enableKeyboardNavigation: true,
  columnCount: 6,
  dataCount: 10,
  containerHeight: 460,
  height: 360,
  maxHeight: 360,
}

/** Ячейка `age` строки: вход в правку и сохранение перемонтируют её содержимое. */
const ageCell = (canvas: HTMLElement, row: number) => () =>
  rowAt(canvas, row).querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="age"]',
  )!

/**
 * Открывает правку ячейки клавишей F2 и, если задано, набирает значение; `submit` —
 * сохраняет его Enter.
 */
const editCell = async (
  canvas: HTMLElement,
  {
    row = 1,
    value,
    submit = true,
  }: { row?: number; value?: string; submit?: boolean } = {},
) => {
  await waitForRows(canvas)
  const cell = ageCell(canvas, row)
  cell().focus()
  await until(() => expect(cell()).toHaveAttribute('data-kn-active', 'true'))
  await userEvent.keyboard('{F2}')
  await until(() => expect(cell().querySelector('input')).not.toBeNull())
  if (value !== undefined) {
    await userEvent.keyboard(
      `{Control>}a{/Control}${value}${submit ? '{Enter}' : ''}`,
    )
  }
  return cell
}

/** Ячейка в правке (ADR 0093, VR4). */
export const EditingStateEditing: StoryObj<StoryProps> = {
  name: 'State: editing',
  parameters: vrStates('body.editing'),
  args: EDITING_ARGS,
  play: async ({ canvasElement }) => {
    await editCell(canvasElement)
    await settle()
  },
}

/** Ячейка ждёт сервера (ADR 0093, VR4): `onCellEdit` не отвечает. */
export const EditingStateSaving: StoryObj<StoryProps> = {
  name: 'State: saving',
  parameters: vrStates('body.pending'),
  args: {
    ...EDITING_ARGS,
    // Свой предикат отключает демо-хуки правки: колбэк истории доходит до плагина.
    cellEditingCanEditCell: () => true,
    onCellEdit: () => new Promise<void>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const cell = await editCell(canvasElement, { value: '41' })
    await waitFor(() =>
      expect(cell().querySelector('[aria-busy="true"]')).not.toBeNull(),
    )
    await settle()
  },
}

/** Сервер отказал в сохранении (ADR 0093, VR4): ячейка с отметкой ошибки. */
export const EditingStateError: StoryObj<StoryProps> = {
  name: 'State: save error',
  parameters: vrStates('body.error'),
  args: {
    ...EDITING_ARGS,
    cellEditingCanEditCell: () => true,
    onCellEdit: () => Promise.reject(new Error('The server refused the value')),
  },
  play: async ({ canvasElement }) => {
    const cell = await editCell(canvasElement, { value: '42' })
    await waitFor(() => expect(cell().querySelector('input')).toBeNull())
    await waitFor(() =>
      expect(cell().querySelector('[aria-invalid="true"]')).not.toBeNull(),
    )
    await settle()
  },
}
