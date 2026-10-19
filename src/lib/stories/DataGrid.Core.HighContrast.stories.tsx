import { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { expect, userEvent } from 'storybook/test'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { bodyRow, settle, until } from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

/** Строка без детей в данных, чьих детей грузит «сервер», который не отвечает. */
const LAZY_ROW = 'item-id-4'
/** Строки, где `play` правит `visits`: сохранение первой ждёт сервера, второй — отказ. */
const SAVING_ROW = 'item-id-5'
const FAILED_ROW = 'item-id-6'
const EDITED_COLUMN = 'visits'

/**
 * Демо-состояния: две выбранные строки, подсветка строки и колонки, скрытая колонка —
 * один раз на таблицу, как только появились строки (история подаёт данные эффектом).
 */
const highContrastDemo: TesseraFeatureEntry = {
  id: 'highContrastDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      setRowSelection?: (value: Record<string, boolean>) => void
      setColumnVisibility?: (value: Record<string, boolean>) => void
      highlight: (target: object, options?: object) => unknown
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.setRowSelection?.({ 'item-id-1': true, 'item-id-2': true })
      t.setColumnVisibility?.({ gender: false })
      t.highlight({ row: 'item-id-3' }, { tone: 'danger' })
      t.highlight({ column: 'age' }, { tone: 'success' })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/** Открывает правку `visits` строки клавишей F2 и сохраняет значение Enter. */
const commitEdit = async (
  canvas: HTMLElement,
  row: string,
  value: string,
  column = EDITED_COLUMN,
) => {
  const cell = () =>
    bodyRow(canvas, row).querySelector<HTMLElement>(
      `.data-grid__body-cell[data-column-id="${column}"]`,
    )!
  await until(() => expect(bodyRow(canvas, row)).not.toBeNull())
  cell().focus()
  await until(() => expect(cell()).toHaveAttribute('data-kn-active', 'true'))
  await userEvent.keyboard('{F2}')
  await until(() => expect(cell().querySelector('input')).not.toBeNull())
  await userEvent.keyboard(`{Control>}a{/Control}${value}{Enter}`)
  return cell
}

/**
 * Высокая контрастность (ADR 0087): выбор, подсветка, линии дерева, свет ожидания
 * шеврона и ячеек, отказ сохранения, тулбар и скелет первой загрузки на одном экране.
 * Включите в DevTools Rendering → «Emulate CSS media feature forced-colors: active»
 * или контрастную тему Windows; выделите ячейки мышью, наведите на строку, откройте
 * кебаб заголовка, «Columns» (флажки колонок) и выгрузку (Segments).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/High contrast',
  tags: ['done'],
} satisfies Meta<StoryProps>

export default meta

export const HighContrastDefault: StoryObj<StoryProps> = {
  name: 'Default',
  // Снимок Chromatic — с эмуляцией высокой контрастности (ADR 0093, VR9).
  parameters: {
    chromatic: { forcedColors: 'active' },
    ...showControls([
      'dataNesting',
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
      'enableColumnPinning',
      'pinFirstColumn',
      'columnPinningLeafPinning',
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
      'enableCellSelection',
      'cellSelectionRangeSelection',
      'cellSelectionDragSelection',
      'cellSelectionMultiRange',
      'enableKeyboardNavigation',
      'enableCellEditing',
      'enableColumnVisibility',
      'enableDataExport',
    ]),
  },
  args: {
    dataNesting: 'nested',
    enableRowExpanding: true,
    rowExpandingHasChildren: row => row.id === LAZY_ROW,
    rowExpandingLoadChildren: () => new Promise<never>(() => {}),
    enableTreeLines: true,
    initialExpanded: true,
    enableRowSelection: true,
    enableColumnPinning: true,
    // Закреплённые ячейки выбранной строки; служебные колонки не уходят при прокрутке.
    pinFirstColumn: true,
    enableColumnSorting: true,
    enableCellSelection: true,
    enableKeyboardNavigation: true,
    enableHeaderActionMenu: true,
    enableCellEditing: true,
    // Свой предикат отключает демо-хуки правки: колбэк истории доходит до плагина.
    cellEditingCanEditCell: ({ column }) => column.id === EDITED_COLUMN,
    onCellEdit: ({ rowId }) =>
      rowId === SAVING_ROW
        ? new Promise<void>(() => {})
        : Promise.reject(new Error('The server refused the value')),
    enableColumnVisibility: true,
    enableDataExport: true,
    extraPlugins: [highContrastDemo],
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  play: async ({ canvasElement }) => {
    const toggle = () =>
      bodyRow(canvasElement, LAZY_ROW)?.querySelector<HTMLElement>(
        '.row-expand-button',
      ) ?? null
    await until(() => expect(toggle()).not.toBeNull())
    await userEvent.click(toggle()!)
    await until(() => expect(toggle()).toHaveAttribute('aria-busy', 'true'))

    await commitEdit(canvasElement, SAVING_ROW, '41')
    await commitEdit(canvasElement, FAILED_ROW, '42')
    await until(() =>
      expect(
        bodyRow(canvasElement, FAILED_ROW).querySelector(
          '[aria-invalid="true"]',
        ),
      ).not.toBeNull(),
    )
    await settle()
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <>
        <StoryComponent {...normalizeArgs(args)} updateArgs={updateArgs} />
        {/* Скелет первой загрузки рядом с данными: в одном гриде их не бывает. */}
        <StoryComponent
          {...normalizeArgs({
            ...args,
            loading: 'initial',
            extraPlugins: [],
            enableColumnVisibility: false,
            enableDataExport: false,
            containerHeight: '232',
            height: '200',
            maxHeight: '200',
          })}
          updateArgs={updateArgs}
        />
      </>
    )
  },
}
