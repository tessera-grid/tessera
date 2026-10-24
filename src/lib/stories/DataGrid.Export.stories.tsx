import { Meta, StoryObj } from '@storybook/react'
import { expect, spyOn, userEvent } from 'storybook/test'

import { exportFormats } from '../plugins/dataExport'
import type { ToolbarComponentProps } from '../core/createSlots/types'
import { Button } from '../ui/Button/Button'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { ExportServerDemo } from './demos/exportDemos'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  consoleText,
  expectPopupInCanvas,
  guideNext,
  openPopup,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, stepAction } from './demos/GuideStory'

/** Экспорт данных (ADR 0044, ADR 0073): панель настроек, быстрые наборы, Excel, серверный режим; своя кнопка приложения (ADR 0120). */

interface ExportArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: 'never' | 'always'
}

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Export',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
  enableDataExport: true,
}

export const ExportPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  args: {
    ...GRID,
    dataCount: 50,
    // Кнопка «Экспорт» открывает панель: «Колонки» — видимые или все; «Строки» — все
    // данные. CSV с UTF-8 BOM и защитой от формул. Включите enableColumnVisibility и
    // скройте колонку — «Видимые колонки» её не выгрузят, «Все колонки» выгрузят.
  },
}

export const ExportDirect: StoryObj<StoryProps> = {
  name: 'Direct click',
  parameters: showControls([
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  args: {
    ...GRID,
    dataCount: 50,
    // Разработчик оставил одну допустимую комбинацию (`allow.columns: ['visible']`,
    // строки — только «все данные»): панели нет, клик сразу скачивает CSV.
    dataExportAllow: { columns: ['visible'] },
  },
}

export const ExportPresets: StoryObj<StoryProps> = {
  name: 'Settings and quick sets',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enablePagination',
    'paginationInitialPageSize',
    'paginationPageSizes',
    'paginationRevertOnReject',
    'enableDataExport',
    'dataExportAllow',
    'dataExportFilename',
  ]),
  args: {
    ...GRID,
    dataCount: 200,
    // Оси «Строки» появляются по активным плагинам: «С учётом сортировки», «Текущая
    // страница», «Выбранные строки» (недоступны, пока ничего не выбрано). Быстрые наборы
    // сверху панели заполняют оси, но не выгружают; выбор запоминается до перезагрузки.
    enableColumnSorting: true,
    enablePagination: true,
    paginationInitialPageSize: 25,
    enableRowSelection: true,
    dataExportPresets: [
      { id: 'everything', label: 'Everything', rows: 'all', columns: 'all' },
      {
        id: 'selection',
        label: 'Selection',
        rows: 'selected',
        columns: 'visible',
      },
    ],
  },
}

export const ExportExcel: StoryObj<StoryProps> = {
  name: 'Excel',
  args: {
    ...GRID,
    dataCount: 200,
    // Формат Excel подключён рядом с CSV (`exportFormats.xlsx()`): числа и даты в
    // файле — типизированные ячейки, шапка закреплена, ширины — как в гриде. Закрепите
    // колонку слева — в Excel она тоже закреплена. Генератор грузится при первой
    // выгрузке в Excel.
    enableColumnPinning: true,
    enableColumnSizing: true,
    dataExportFormats: [exportFormats.csv(), exportFormats.xlsx()],
  },
  // Сценарий истории (ADR 0073, XL13): выгрузка в Excel скачивает export.xlsx с данными.
  parameters: {
    requirements: ['XL13'],
    ...showControls([
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableColumnSizing',
      'enableDataExport',
      'dataExportAllow',
      'dataExportFilename',
    ]),
  },
  play: async ({ canvasElement }) => {
    const download = interceptDownload()
    try {
      await waitForRows(canvasElement)
      await openExport(canvasElement)
      const xlsx = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="export-axis-format"] [role="radio"][data-value="xlsx"]',
        )!
      await userEvent.click(xlsx())
      await until(() => expect(xlsx()).toHaveAttribute('aria-checked', 'true'))
      await userEvent.click(byTestId('export-run')!)

      await until(() => expect(download.names).toEqual(['export.xlsx']))
      const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
      const firstCell = orderedRows(canvasElement)[0]!
        .querySelector('.data-grid__body-cell')!
        .textContent!.trim()
      expect(await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')).toContain(
        `<t xml:space="preserve">${firstCell}</t>`,
      )
      await settle()
    } finally {
      download.restore()
    }
  },
}

export const ExportServer: StoryObj<ExportArgs> = {
  name: 'Server',
  args: {
    ...GRID,
    // Страница из 1000 строк: «Текущая страница» скачивает клиент (onExported),
    // остальные значения строк уходят в onExport с ожиданием — кнопка занята,
    // «Выгрузить» с серверным значением заблокирована; «Выбранные строки» отдают
    // rowIds. Режим отказа — ошибка в консоли, кнопка освобождается.
    enableColumnSorting: true,
    enablePagination: true,
    paginationInitialPageSize: 25,
    enableRowSelection: true,
    serverDelayMs: 2000,
    serverFailMode: 'never',
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    serverFailMode: { control: 'inline-radio', options: ['never', 'always'] },
  },
  render: args => <ExportServerDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0044, EX34): «Все строки» уходят в onExport, кнопка занята до
  // ответа; «Текущая страница» скачивается и пишет onExported.
  parameters: {
    requirements: ['EX34'],
    ...showControls(
      [
        'enableColumnSorting',
        'columnSortingRemoval',
        'columnSortingMultiSort',
        'columnSortingServer',
        'columnSortingRevertOnReject',
        'enableRowSelection',
        'rowSelectionSubRows',
        'rowSelectionSelectedCount',
        'enablePagination',
        'paginationInitialPageSize',
        'paginationPageSizes',
        'paginationRevertOnReject',
        'enableDataExport',
        'dataExportAllow',
        'dataExportFilename',
        'serverDelayMs',
        'serverFailMode',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement }) => {
    const download = interceptDownload()
    try {
      await waitForRows(canvasElement)
      await openExport(canvasElement)
      await userEvent.click(byTestId('export-run')!)
      await until(() =>
        expect(exportButton()).toHaveAttribute('aria-busy', 'true'),
      )
      expect(consoleText()).toContain('onExport')
      expect(consoleText()).toContain('rows="all"')
      expect(download.names).toEqual([])

      await until(() => expect(exportButton()).not.toHaveAttribute('aria-busy'))
      expect(consoleText()).toContain('export "all" ready')

      await openExport(canvasElement)
      const page = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="export-axis-rows"] [role="radio"][data-value="page"]',
        )!
      await userEvent.click(page())
      await until(() => expect(page()).toHaveAttribute('aria-checked', 'true'))
      await userEvent.click(byTestId('export-run')!)
      await until(() => expect(download.names).toHaveLength(1))
      expect(consoleText()).toContain('onExported')
      expect(consoleText()).toContain('rows="page"')
      expect(consoleText()).toContain('rowCount=25')
      await settle()
    } finally {
      download.restore()
    }
  },
}

/** Открытая панель экспорта (ADR 0093, VR6). */
export const ExportStatePanel: StoryObj<StoryProps> = {
  name: 'State: export panel',
  parameters: {
    ...vrStates('overlay.export'),
    ...showControls([
      'enableDataExport',
      'dataExportAllow',
      'dataExportFilename',
    ]),
  },
  args: { ...GRID, dataCount: 20 },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const panel = await openPopup(() =>
      canvasElement.querySelector<HTMLElement>('[data-testid="export-button"]'),
    )
    expectPopupInCanvas(canvasElement, panel)
    // Клик `play` браузер не считает указателем и показал бы кольцо фокуса первого пункта;
    // фокус — на панели, как после открытия мышью.
    panel.focus()
    await until(() => expect(document.activeElement).toBe(panel))
    expect(panel.querySelector(':focus-visible')).toBeNull()
  },
}

function exportButton() {
  return byTestId('export-button')
}

async function openExport(canvas: HTMLElement) {
  await openPopup(() =>
    canvas.querySelector<HTMLElement>('[data-testid="export-button"]'),
  )
}

/**
 * Перехват скачивания: файл не уходит в загрузки ни в живом Storybook, ни в тестах — его
 * имя и содержимое остаются `play`.
 */
// --- ADR 0120, S6 --------------------------------------------------------------------

/** Своя кнопка приложения: выгрузка методом модели `table.exportData`. */
const OwnExportButton = ({ table }: ToolbarComponentProps) => (
  <Button
    variant="outline"
    data-testid="own-export"
    onClick={() => void table.exportData({ rows: 'all' })}
  >
    Выгрузить всё
  </Button>
)

/** Кнопка приложения в тулбаре — свой слот, без плагина интерфейса выгрузки. */
const OWN_EXPORT_BUTTON = [
  {
    id: 'ownExportButton',
    slots: [
      { id: 'ownExport', slot: 'toolbarSlot', component: OwnExportButton },
    ],
  },
] as StoryProps['extraPlugins']

const ownExportButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="own-export"]')

const OWN_BUTTON: readonly GuideStoryStep[] = [
  {
    title: 'Кнопки «Экспорт» нет',
    hint: 'Плагин dataExportModel без dataExport: в тулбаре только своя кнопка приложения «Выгрузить всё».',
  },
  {
    title: 'Приложение выгружает',
    hint: "Своя кнопка зовёт table.exportData({ rows: 'all' }) — грид собирает CSV и скачивает файл export.csv.",
    // Пользователь нажимает кнопку приложения: одно нажатие — один файл.
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!ownExportButton(root), signal)
      ownExportButton(root)!.click()
    }),
  },
]

/** ADR 0120, S6: приложение выгружает данные своей кнопкой через `table.exportData`. */
export const ExportOwnButton: StoryObj<StoryProps> = {
  name: 'Own button',
  parameters: {
    scenario: '0120/S6',
    ...showControls(['enableDataExportModel']),
  },
  args: {
    columnCount: 6,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    enableDataExportModel: true,
    extraPlugins: OWN_EXPORT_BUTTON,
  },
  render: args => (
    <GuideStory
      title="Выгрузка своей кнопкой"
      steps={OWN_BUTTON}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(OWN_BUTTON[0].title, async () => {
        await waitForRows(canvas)
        // Своя кнопка приходит слотом тулбара позже строк.
        await until(() => expect(ownExportButton(canvas)).not.toBeNull())
        expect(canvas.querySelector('[data-testid="export-button"]')).toBeNull()
      })
      await step(OWN_BUTTON[1].title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await until(() => expect(download.names).toEqual(['export.csv']))
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

/** Выгрузки, ушедшие «серверу» через `onExport`. */
const serverExports: string[] = []

const SERVER_BEFORE_DATA: readonly GuideStoryStep[] = [
  {
    title: 'Таблица открыта, данные загружаются',
    hint: 'Выгрузка серверная: данные у сервера, поэтому «Экспорт» доступен и до их прихода.',
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: 'Пользователь выгружает до прихода данных',
    hint: 'Клик по «Экспорту» уходит в onExport — файл собирает сервер.',
    enter: root =>
      root.querySelector<HTMLElement>('[data-testid="export-button"]')?.click(),
  },
]

/** S4 ADR 0122: серверная выгрузка до прихода данных. */
export const ExportServerInitialLoading: StoryObj<StoryProps> = {
  name: 'Server, initial loading',
  parameters: {
    scenario: '0122/S4',
    ...showControls(['enableDataExport', 'dataExportAllow']),
  },
  args: {
    ...GRID,
    dataExportServer: true,
    // Одна комбинация: клик выгружает сразу, без панели.
    dataExportAllow: { rows: ['all'], columns: ['visible'] },
    onExport: request => {
      serverExports.push(request.settings.rows)
    },
  },
  render: args => (
    <GuideStory
      title="Серверная выгрузка до прихода данных"
      steps={SERVER_BEFORE_DATA}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    serverExports.length = 0
    await step(SERVER_BEFORE_DATA[0]!.title, async () => {
      await until(() => expect(exportButton()).not.toBeNull())
      expect(byTestId('export-skeleton')).toBeNull()
    })
    await step(SERVER_BEFORE_DATA[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(serverExports).toEqual(['all']))
    })
    await settle()
  },
}

function interceptDownload() {
  const names: string[] = []
  const blobs: Blob[] = []
  const url = spyOn(URL, 'createObjectURL').mockImplementation(value => {
    blobs.push(value as Blob)
    return 'blob:export-story'
  })
  const click = spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      names.push(this.download)
    },
  )
  return {
    names,
    blobs,
    restore: () => {
      url.mockRestore()
      click.mockRestore()
    },
  }
}

/** Текст записи zip по локальным заголовкам; deflate — встроенным `DecompressionStream`. */
async function zipEntryText(bytes: Uint8Array, name: string) {
  const view = new DataView(bytes.buffer)
  for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
    const method = view.getUint16(at + 8, true)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    const start = at + 30 + nameLength
    const entry = new TextDecoder().decode(bytes.slice(at + 30, start))
    if (entry === name) {
      const stream = new Blob([bytes.slice(start, start + size)]).stream()
      return new Response(
        method === 8
          ? stream.pipeThrough(new DecompressionStream('deflate-raw'))
          : stream,
      ).text()
    }
    at = start + size
  }
  return ''
}
