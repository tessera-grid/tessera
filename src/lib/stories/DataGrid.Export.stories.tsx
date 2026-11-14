import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { exportFormats } from '../plugins/dataExport'
import type { ToolbarComponentProps } from '../core/createSlots/types'
import { Button } from '../ui/Button/Button'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import {
  byTestId,
  consoleText,
  guideNext,
  orderedRows,
  pointAt,
  pollUntil,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
  repeat,
} from './__mocks__/catalogPlay'
import {
  axisChecked,
  axisValue,
  chooseAxis,
  exportButton,
  exportPanel,
  exported,
  interceptDownload,
  onExported,
  openExportPanel,
  runExport,
  zipEntryText,
} from './__mocks__/exportGuide'
import { storyLabels } from './__mocks__/storyLabels'
import { useStoryText } from './__mocks__/storyLocale'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { dataExportLabels } from '../plugins/dataExport/labels'

/** Экспорт данных (ADR 0044, ADR 0073): панель настроек, быстрые наборы, Excel, серверный режим; своя кнопка приложения (ADR 0120). */

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

// --- Действия шагов ------------------------------------------------------------------

// --- ADR 0044 S1 ---------------------------------------------------------------------

const DIRECT: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Одна комбинация выгрузки',
      en: 'A single export combination',
    },
    hint: {
      ru: 'Приложение разрешило выгружать только видимые колонки всех строк, поэтому настроек нет.',
      en: 'The app allows exporting only the visible columns of all rows, so there are no settings.',
    },
  },
  {
    title: {
      ru: 'Пользователь выгрузил таблицу',
      en: 'The user exported the table',
    },
    hint: {
      ru: 'Пользователь нажал кнопку выгрузки, файл скачался сразу, без панели.',
      en: 'The user clicked the export button, and the file downloaded right away, without a panel.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!exportButton(), signal)
      const before = exported.length
      exportButton()!.click()
      await pollUntil(() => exported.length > before, signal)
    }),
  },
]

/** ADR 0044, S1: выгрузка одним нажатием — одна допустимая комбинация, панели нет. */
export const ExportDirect: StoryObj<StoryProps> = {
  name: 'Direct click',
  parameters: { scenario: '0044/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Выгрузка одним нажатием', en: 'Export with one click' }}
      steps={DIRECT}
      args={guideArgs(
        {
          ...GRID,
          dataCount: 50,
          dataExportAllow: { columns: ['visible'] },
          onExported,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(DIRECT[0]!.title.ru, async () => {
        await waitForRows(canvas)
        await until(() => expect(exportButton()).not.toBeNull())
      })
      await step(DIRECT[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.csv'])
        await expect(exportPanel()).toBeNull()
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

// --- ADR 0044 S2 ---------------------------------------------------------------------

const PRESET = 'everything'

const PRESETS: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Таблица с сортировкой, страницами и выбором',
      en: 'A table with sorting, pages and selection',
    },
    hint: {
      ru: 'Набор строк для выгрузки зависит от включённых функций.',
      en: 'Which rows can be exported depends on the enabled features.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл настройки выгрузки',
      en: 'The user opened the export settings',
    },
    hint: {
      ru: 'Панель предлагает строки и колонки: с учётом сортировки, текущую страницу, выбранные строки. Выбранные строки недоступны, пока ничего не выбрано. Сверху — быстрые наборы.',
      en: 'The panel offers row and column options: rows in sorted order, the current page, the selected rows. The selected rows option is unavailable while nothing is selected. Quick sets are at the top.',
    },
    states: ['overlay.export'],
    enter: stepAction((root, { signal }) => openExportPanel(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь выбрал быстрый набор',
      en: 'The user chose a quick set',
    },
    hint: {
      ru: 'Набор заполнил строки и колонки, выгрузка ещё не началась.',
      en: 'The set filled in the rows and columns; the export has not started yet.',
    },
    states: ['overlay.export'],
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await repeat(
        () => axisChecked('rows', 'all') && axisChecked('columns', 'all'),
        () => byTestId(`export-preset-${PRESET}`)?.click(),
        signal,
      )
    }),
  },
  {
    title: { ru: 'Пользователь выгрузил', en: 'The user exported' },
    hint: {
      ru: 'Скачался файл с выбранными строками и колонками.',
      en: 'A file with the chosen rows and columns downloaded.',
    },
    enter: stepAction(async (root, { signal }) => {
      await openExportPanel(root, signal)
      await repeat(
        () => axisChecked('rows', 'all') && axisChecked('columns', 'all'),
        () => byTestId(`export-preset-${PRESET}`)?.click(),
        signal,
      )
      await runExport(signal)
    }),
  },
]

/** ADR 0044, S2: выгрузка с настройками — оси по включённым функциям и быстрые наборы. */
export const ExportPresets: StoryObj<StoryProps> = {
  name: 'Settings and quick sets',
  parameters: { scenario: '0044/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Настройки выгрузки', en: 'Export settings' }}
      steps={PRESETS}
      args={guideArgs(
        {
          ...GRID,
          // Ниже обычного: панель настроек встаёт под кнопкой, а не над таблицей.
          containerHeight: '420',
          height: '320',
          maxHeight: '320',
          dataCount: 200,
          enableColumnSorting: true,
          enablePagination: true,
          paginationInitialPageSize: 25,
          enableRowSelection: true,
          dataExportPresets: [
            { id: PRESET, label: 'Everything', rows: 'all', columns: 'all' },
            {
              id: 'selection',
              label: 'Selection',
              rows: 'selected',
              columns: 'visible',
            },
          ],
          onExported,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(PRESETS[0]!.title.ru, async () => {
        await waitForRows(canvas)
      })
      await step(PRESETS[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        for (const value of ['view', 'page', 'selected'])
          await expect(axisValue('rows', value)).not.toBeNull()
        await expect(axisValue('rows', 'selected')).toHaveAttribute(
          'aria-disabled',
          'true',
        )
        await expect(byTestId(`export-preset-${PRESET}`)).not.toBeNull()
        await settle()
      })
      await step(PRESETS[2]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual([])
        await settle()
      })
      await step(PRESETS[3]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.csv'])
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

// --- ADR 0044 S3 ---------------------------------------------------------------------

const EXPORT_REFUSAL = 'The export service is unavailable'

/** «Сервер» выгрузки: держит ответ, пока шаг ожидания на виду; отказывает по команде шага. */
const exportServer = (() => {
  let held = true
  let refusing = false
  let refusals = 0
  const waiting = new Set<() => void>()
  return {
    /** Сколько выгрузок «сервер» отклонил. */
    refusals: () => refusals,
    hold: () => {
      held = true
      refusing = false
    },
    release: () => {
      held = false
      refusing = false
      waiting.forEach(resolve => resolve())
      waiting.clear()
    },
    refuse: () => {
      held = false
      refusing = true
    },
    onExport: (): Promise<void> => {
      if (refusing) {
        refusals++
        return Promise.reject(new Error(EXPORT_REFUSAL))
      }
      return new Promise<void>(resolve => {
        if (held) waiting.add(resolve)
        else resolve()
      })
    },
  }
})()

const exportBusy = () => exportButton()?.getAttribute('aria-busy') === 'true'
/** Отметки отказа на кнопке выгрузки нет (ADR 0177, §2). */
const exportMarked = () =>
  !!exportButton()?.querySelector('[data-failure-indicator]')

/** Пользователь выгружает все строки: запрос уходит серверу. */
const exportAll = async (root: HTMLElement, signal: AbortSignal) => {
  if (exportBusy()) return
  await openExportPanel(root, signal)
  await chooseAxis('rows', 'all', signal)
  await repeat(
    () => exportBusy(),
    () => byTestId('export-run')?.click(),
    signal,
  )
}

const SERVER: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Выгрузка на сервере', en: 'Export on the server' },
    hint: {
      ru: 'Всё, кроме текущей страницы, собирает сервер приложения.',
      en: "The app's server builds everything except the current page.",
    },
  },
  {
    title: {
      ru: 'Пользователь выгружает все строки',
      en: 'The user exports all rows',
    },
    hint: {
      ru: 'Запрос ушёл серверу, кнопка выгрузки показывает ожидание.',
      en: 'The request went to the server; the export button shows that it is waiting.',
    },
    enter: stepAction(async (root, { signal }) => {
      exportServer.hold()
      await exportAll(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер собрал файл', en: 'The server built the file' },
    hint: {
      ru: 'Ожидание погасло, приложение отдало файл.',
      en: 'The waiting indicator disappeared, and the app delivered the file.',
    },
    enter: stepAction(async (root, { signal }) => {
      exportServer.hold()
      await exportAll(root, signal)
      exportServer.release()
      await pollUntil(() => !exportBusy(), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь выгрузил текущую страницу',
      en: 'The user exported the current page',
    },
    hint: {
      ru: 'Страницу таблица собрала сама и сразу скачала файл.',
      en: 'The table built the page itself and downloaded the file right away.',
    },
    enter: stepAction(async (root, { signal }) => {
      exportServer.release()
      await pollUntil(() => !exportBusy(), signal)
      await openExportPanel(root, signal)
      await chooseAxis('rows', 'page', signal)
      await runExport(signal)
    }),
  },
  {
    title: {
      ru: 'Сервер не собрал файл',
      en: 'The server failed to build the file',
    },
    hint: {
      ru: 'Пользователь снова выгрузил все строки, но сервер отказал. Файла нет: ожидание на кнопке выгрузки остановилось, отметки на кнопке нет. Таблица не изменилась, поэтому сообщения под шапкой нет.',
      en: 'The user exported all rows again, but the server refused. There is no file: the waiting indicator on the export button stopped, and the button has no mark. The table did not change, so there is no message under the header.',
    },
    enter: stepAction(async (root, { signal }) => {
      const before = exportServer.refusals()
      exportServer.refuse()
      // Отказ приходит сразу: ожидание кнопки шаг не застаёт.
      await openExportPanel(root, signal)
      await chooseAxis('rows', 'all', signal)
      await repeat(
        () => exportServer.refusals() > before && !exportBusy(),
        () => byTestId('export-run')?.click(),
        signal,
      )
    }),
  },
]

const serverPage = makeData({ shape: 'flat', count: 25 })

/** ADR 0044, S3: выгрузку собирает сервер — ожидание на кнопке, страница скачивается сразу. */
export const ExportServer: StoryObj<StoryProps> = {
  name: 'Server',
  parameters: {
    scenario: '0044/S3',
    requirements: ['EX34'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Выгрузка на сервере', en: 'Export on the server' }}
      steps={SERVER}
      args={guideArgs(
        {
          ...GRID,
          enableColumnSorting: true,
          enablePagination: true,
          paginationInitialPageSize: 25,
          enableRowSelection: true,
          dataOverride: serverPage,
          dataMode: { pagination: 'server', export: 'server' },
          rowCount: 1000,
          onExport: exportServer.onExport,
          onExported,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(SERVER[0]!.title.ru, async () => {
        await waitForRows(canvas)
      })
      await step(SERVER[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportBusy()).toBe(true)
        await expect(consoleText()).toContain('onExport')
        await expect(download.names).toEqual([])
      })
      await step(SERVER[2]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportBusy()).toBe(false)
        await expect(download.names).toEqual([])
      })
      await step(SERVER[3]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.csv'])
        await expect(consoleText()).toContain('onExported')
      })
      await step(SERVER[4]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportBusy()).toBe(false)
        await expect(exportMarked()).toBe(false)
        await expect(download.names).toEqual(['export.csv'])
        await expect(
          canvas.querySelector('[data-testid="load-error-banner"]'),
        ).toBeNull()
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

// --- ADR 0073 S1 ---------------------------------------------------------------------

const EXCEL_REFUSAL = 'The workbook could not be built'

/** Формат Excel, который по команде шага не собирает файл. */
const excel = (() => {
  const base = exportFormats.xlsx()
  let refusing = false
  const state = { refusals: 0 }
  return {
    state,
    format: {
      ...base,
      serialize: (data: Parameters<typeof base.serialize>[0]) => {
        if (!refusing) return base.serialize(data)
        state.refusals++
        return Promise.reject(new Error(EXCEL_REFUSAL))
      },
    },
    allow: () => {
      refusing = false
    },
    refuse: () => {
      refusing = true
    },
  }
})()

const EXCEL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Два формата', en: 'Two formats' },
    hint: {
      ru: 'Рядом с CSV подключён формат Excel.',
      en: 'The Excel format is enabled alongside CSV.',
    },
  },
  {
    title: { ru: 'Пользователь выбрал Excel', en: 'The user chose Excel' },
    hint: {
      ru: 'В настройках выгрузки выбран формат Excel.',
      en: 'The Excel format is chosen in the export settings.',
    },
    states: ['overlay.export'],
    enter: stepAction(async (root, { signal }) => {
      excel.allow()
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
    }),
  },
  {
    title: { ru: 'Пользователь выгрузил', en: 'The user exported' },
    hint: {
      ru: 'Скачался файл Excel с данными таблицы.',
      en: 'An Excel file with the table data downloaded.',
    },
    enter: stepAction(async (root, { signal }) => {
      excel.allow()
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
      await runExport(signal)
    }),
  },
  {
    title: { ru: 'Файл не собран', en: 'The file was not built' },
    hint: {
      ru: 'Пользователь снова выгрузил Excel, но собрать файл не удалось. Файла нет: ожидание на кнопке выгрузки остановилось, отметки на кнопке нет.',
      en: 'The user exported to Excel again, but the file could not be built. There is no file: the waiting indicator on the export button stopped, and the button has no mark.',
    },
    enter: stepAction(async (root, { signal }) => {
      const before = excel.state.refusals
      excel.refuse()
      await openExportPanel(root, signal)
      await chooseAxis('format', 'xlsx', signal)
      await repeat(
        () => excel.state.refusals > before && !exportBusy(),
        () => byTestId('export-run')?.click(),
        signal,
      )
    }),
  },
]

/** ADR 0073, S1: выгрузка в Excel — формат рядом с CSV, файл с данными таблицы. */
export const ExportExcel: StoryObj<StoryProps> = {
  name: 'Excel',
  parameters: {
    scenario: '0073/S1',
    requirements: ['XL13'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Выгрузка в Excel', en: 'Export to Excel' }}
      steps={EXCEL}
      args={guideArgs(
        {
          ...GRID,
          dataCount: 200,
          dataExportFormats: [exportFormats.csv(), excel.format],
          onExported,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(EXCEL[0]!.title.ru, async () => {
        await waitForRows(canvas)
      })
      await step(EXCEL[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(axisChecked('format', 'xlsx')).toBe(true)
        await settle()
      })
      await step(EXCEL[2]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(download.names).toEqual(['export.xlsx'])
        const bytes = new Uint8Array(await download.blobs[0]!.arrayBuffer())
        expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
        const firstCell = orderedRows(canvas)[0]!
          .querySelector('.data-grid__body-cell')!
          .textContent!.trim()
        expect(await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')).toContain(
          `<t xml:space="preserve">${firstCell}</t>`,
        )
      })
      await step(EXCEL[3]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportBusy()).toBe(false)
        await expect(exportMarked()).toBe(false)
        await expect(download.names).toEqual(['export.xlsx'])
      })
    } finally {
      download.restore()
    }
    await settle()
  },
}

// --- ADR 0120, S6 --------------------------------------------------------------------

/** Своя кнопка приложения: выгрузка методом модели `table.exportData`. */
const OwnExportButton = ({ table }: ToolbarComponentProps) => {
  const t = useStoryText()
  return (
    <Button
      variant="outline"
      data-testid="own-export"
      onClick={() => void table.exportData({ rows: 'all' })}
    >
      {t({ ru: 'Выгрузить всё', en: 'Export all' })}
    </Button>
  )
}

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
const skeletonRow = (root: ParentNode) =>
  root.querySelector('.data-grid__body-row--skeleton')

const OWN_BUTTON: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Своя кнопка выгрузки', en: 'A custom export button' },
    hint: {
      ru: 'Выгрузкой управляет приложение. В тулбаре нет кнопки выгрузки таблицы, есть только кнопка приложения.',
      en: "The app controls the export. The toolbar has no table export button, only the app's own button.",
    },
  },
  {
    title: {
      ru: 'Приложение выгружает данные',
      en: 'The app exports the data',
    },
    hint: {
      ru: 'Пользователь нажал кнопку приложения, и приложение попросило таблицу выгрузить все строки. Таблица собрала файл и скачала его.',
      en: "The user clicked the app's button, and the app asked the table to export all rows. The table built the file and downloaded it.",
    },
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
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Выгрузка своей кнопкой',
        en: 'Export with a custom button',
      }}
      steps={OWN_BUTTON}
      args={guideArgs(
        {
          columnCount: 6,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enableDataExportModel: true,
          extraPlugins: OWN_EXPORT_BUTTON,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(OWN_BUTTON[0].title.ru, async () => {
        await waitForRows(canvas)
        // Своя кнопка приходит слотом тулбара позже строк.
        await until(() => expect(ownExportButton(canvas)).not.toBeNull())
        expect(canvas.querySelector('[data-testid="export-button"]')).toBeNull()
      })
      await step(OWN_BUTTON[1].title.ru, async () => {
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
    title: { ru: 'Данные загружаются', en: 'Data is loading' },
    hint: {
      ru: 'Данные ещё не пришли, а выгрузку собирает сервер. Тело таблицы в состоянии загрузки, кнопка выгрузки уже доступна.',
      en: 'The data has not arrived yet, and exports are built by the server. The table body is in the loading state, and the export button is already available.',
    },
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: {
      ru: 'Пользователь выгружает до прихода данных',
      en: 'The user exports before the data arrives',
    },
    hint: {
      ru: 'Пользователь нажал кнопку выгрузки. Запрос ушёл приложению, файл соберёт сервер; таблица продолжает ждать данных.',
      en: 'The user clicked the export button. The request went to the app, and the server will build the file; the table keeps waiting for the data.',
    },
    enter: root =>
      root.querySelector<HTMLElement>('[data-testid="export-button"]')?.click(),
  },
]

/** S4 ADR 0122: серверная выгрузка до прихода данных. */
export const ExportServerInitialLoading: StoryObj<StoryProps> = {
  name: 'Server, initial loading',
  parameters: {
    scenario: '0122/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Серверная выгрузка до прихода данных',
        en: 'Server export before the data arrives',
      }}
      steps={SERVER_BEFORE_DATA}
      args={guideArgs(
        {
          ...GRID,
          dataMode: { export: 'server' },
          // Одна комбинация: клик выгружает сразу, без панели.
          dataExportAllow: { rows: ['all'], columns: ['visible'] },
          onExport: request => {
            serverExports.push(request.settings.rows)
          },
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    serverExports.length = 0
    await step(SERVER_BEFORE_DATA[0]!.title.ru, async () => {
      await until(() => expect(exportButton()).not.toBeNull())
      expect(byTestId('export-skeleton')).toBeNull()
      expect(skeletonRow(canvas)).not.toBeNull()
    })
    await step(SERVER_BEFORE_DATA[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(serverExports).toEqual(['all']))
      expect(skeletonRow(canvas)).not.toBeNull()
    })
    await settle()
  },
}

// --- ADR 0153 S4 ---------------------------------------------------------------------

/** Формат Excel гайда отмены: большой файл собирается, пока выгрузку не отменят. */
const slowExcel = {
  ...exportFormats.xlsx(),
  serialize: (_data: unknown, context?: { signal: AbortSignal }) =>
    new Promise<never>((_resolve, reject) => {
      context?.signal.addEventListener(
        'abort',
        () => reject(context.signal.reason),
        { once: true },
      )
    }),
}

const exportWaits = () => exportButton()?.getAttribute('aria-busy') === 'true'
const exportArmed = () => !!exportButton()?.hasAttribute('data-cancel-armed')

/** Выгрузка идёт: пользователь нажал кнопку, если ещё не нажал. */
const exportHeld = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (!root.querySelector('.data-grid__body-row')) return false
    if (exportWaits()) return true
    exportButton()?.click()
    return false
  }, signal)

/** Занятая кнопка выгрузки готова к отмене. */
const exportCancelArmed = async (root: HTMLElement, signal: AbortSignal) => {
  await exportHeld(root, signal)
  await pollUntil(exportArmed, signal)
}

const CANCEL_EXPORT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Выгрузка в Excel', en: 'Export to Excel' },
    hint: {
      ru: 'Таблица выгружается в Excel, большой файл собирается долго.',
      en: 'The table is exported to Excel; a large file takes a long time to build.',
    },
  },
  {
    title: { ru: 'Файл собирается', en: 'The file is being built' },
    hint: {
      ru: 'Пользователь нажал выгрузку. Кнопка показывает ожидание по контуру.',
      en: 'The user clicked the export button. The button shows a waiting indicator along its outline.',
    },
    enter: stepAction((root, { signal }) => exportHeld(root, signal)),
  },
  {
    title: {
      ru: 'Кнопка предлагает отмену',
      en: 'The button offers to cancel',
    },
    hint: {
      ru: 'Пользователь навёл указатель на занятую кнопку. Внутри дуги появился знак остановки, подсказка предлагает отменить выгрузку.',
      en: 'The user hovered over the busy button. A stop icon appeared inside the arc, and the tooltip offers to cancel the export.',
    },
    pseudo: { hover: '[data-testid="export-button"]' },
    enter: stepAction(async (root, { signal, onLeave }) => {
      await exportCancelArmed(root, signal)
      onLeave(pointAt(exportButton()!))
    }),
  },
  {
    title: { ru: 'Выгрузка отменена', en: 'The export was canceled' },
    hint: {
      ru: 'Пользователь нажал на кнопку. Сборка прервана, файл не скачан, отметки ошибки на кнопке нет.',
      en: 'The user clicked the button. Building was interrupted, no file was downloaded, and the button has no error mark.',
    },
    enter: stepAction(async (root, { signal }) => {
      await exportCancelArmed(root, signal)
      exportButton()!.click()
      await pollUntil(() => !exportWaits(), signal)
    }),
  },
]

/** ADR 0153, S4: выгрузка Excel долгая — человек отменяет её кнопкой выгрузки. */
export const ExportCancel: StoryObj<StoryProps> = {
  name: 'Cancel an export',
  parameters: { scenario: '0153/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отмена выгрузки', en: 'Canceling an export' }}
      steps={CANCEL_EXPORT}
      args={guideArgs(
        {
          ...GRID,
          dataCount: 200,
          dataExportFormats: [slowExcel],
          dataExportAllow: { columns: ['visible'] },
          onExported,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const download = interceptDownload()
    try {
      await step(CANCEL_EXPORT[0]!.title.ru, async () => {
        await waitForRows(canvas)
        await until(() => expect(exportButton()).not.toBeNull())
      })
      await step(CANCEL_EXPORT[1]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportWaits()).toBe(true)
        await expect(exportPanel()).toBeNull()
      })
      await step(CANCEL_EXPORT[2]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportArmed()).toBe(true)
        await expect(exportButton()).toHaveAttribute(
          'aria-label',
          labels.cancelAction(dataExportLabels(labels).export),
        )
      })
      await step(CANCEL_EXPORT[3]!.title.ru, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(exportWaits()).toBe(false)
        await expect(exportMarked()).toBe(false)
        await settle()
        await expect(download.names).toEqual([])
      })
    } finally {
      download.restore()
    }
  },
}
