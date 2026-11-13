import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { dataExportModelLabels } from '../plugins/dataExportModel/labels'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  waitForRows,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  exportButton,
  exported,
  interceptDownload,
  onExported,
} from './__mocks__/exportGuide'
import {
  hasRow,
  layout,
  release,
  server,
  serverProps,
} from './__mocks__/serverRowModelGuide'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'

/**
 * Выгрузка в серверной модели без сервиса выгрузки (ADR 0190): `Playground` — кнопка выгрузки и
 * предел строк; S1 — выгрузка выборки, S2 — выборка больше предела, S3 — отказ блока.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Export',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

const TOTAL = 300
const BLOCK = 50
const LIMIT = 100
/** Блок, который «сервер» отказывается отдать: окно таблицы его не просит. */
const FAILED_BLOCK = BLOCK * 2

export const ServerExportPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(['enableDataExport', 'dataExportMaxLoadedRows'], {
    dataCount: 'строки подаёт «сервер» демо',
    columnCount: 'колонки задаёт демо',
  }),
  args: { ...layout, enableDataExport: true, dataExportMaxLoadedRows: 10_000 },
  render: args => (
    <StoryComponent
      {...normalizeArgs(args)}
      {...serverProps({ total: TOTAL, knownTotal: true, blockSize: BLOCK })!(
        AT_REST,
      )}
    />
  ),
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(hasRow(canvas, 0)).toBe(true))
    await settle()
  },
}

const exportProps =
  (failBlock?: number, limit?: number): GuideStoryStep['props'] =>
  context => ({
    ...serverProps({
      total: TOTAL,
      knownTotal: true,
      blockSize: BLOCK,
      failBlock,
    })!(context),
    enableDataExport: true,
    // Одна комбинация: кнопка выгружает сразу, без панели.
    dataExportAllow: { rows: ['view'], columns: ['visible'] },
    dataExportMaxLoadedRows: limit,
    onExported,
  })

const busy = () => exportButton()?.getAttribute('aria-busy') === 'true'
/** Объявление таблицы: текст зависит от языка, шаг ждёт только его смены. */
const announced = (root: HTMLElement) =>
  [...root.querySelectorAll('[aria-live]')]
    .map(region => region.textContent)
    .join(' ')

/** Пользователь нажал выгрузку, «сервер» держит строки. */
const startExport = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0) && !!exportButton(), signal)
  if (busy()) return
  server.hold = true
  exportButton()!.click()
  await pollUntil(busy, signal)
}

// --- S1: выгрузка выборки ------------------------------------------------------------

const VIEW: readonly GuideStoryStep[] = [
  {
    title: 'Список без сервиса выгрузки',
    hint: 'У приложения нет своего сервиса выгрузки, а строки приходят блоками. Кнопка выгрузки всё равно доступна.',
    props: exportProps(),
  },
  {
    title: 'Строки идут',
    hint: 'Таблица запрашивает незагруженные строки выборки. Кнопка занята, выгрузку можно отменить.',
    enter: stepAction(async (root, { signal }) => {
      await startExport(root, signal)
    }),
  },
  {
    title: 'Файл готов',
    hint: 'Все строки пришли, браузер собрал файл в порядке таблицы.',
    enter: stepAction(async (root, { signal }) => {
      const before = exported.length
      await startExport(root, signal)
      server.hold = false
      release()
      await pollUntil(() => exported.length > before && !busy(), signal)
    }),
  },
]

/** ADR 0190, S1: приложение без серверной выгрузки выгружает текущую выборку. */
export const ExportServerRowsView: StoryObj<StoryProps> = {
  name: 'Export the result',
  parameters: { scenario: '0190/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выгрузка выборки"
      steps={VIEW}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(VIEW[0]!.title, async () => {
        await until(() => expect(hasRow(canvas, 0)).toBe(true))
        await until(() => expect(busy()).toBe(false))
      })
      await step(VIEW[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await until(() => expect(busy()).toBe(true))
        await until(() => expect(download.names).toEqual([]))
      })
      await step(VIEW[2]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await until(() => expect(busy()).toBe(false))
        await until(() => expect(download.names).toEqual(['export.csv']))
        await settle()
      })
    } finally {
      download.restore()
    }
  },
}

// --- S2: выборка больше предела ------------------------------------------------------

const OVER_LIMIT: readonly GuideStoryStep[] = [
  {
    title: 'Выборка больше предела',
    hint: 'В выборке больше строк, чем таблица загружает за одну выгрузку. Предел задаёт приложение.',
    props: exportProps(undefined, LIMIT),
  },
  {
    title: 'Отказ с причиной',
    hint: 'Таблица отказала сразу, не обращаясь к серверу, потому что неполный файл выглядел бы как полный. Объявление называет предел.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0) && !!exportButton(), signal)
      const before = announced(root)
      exportButton()!.click()
      await pollUntil(() => announced(root) !== before && !busy(), signal)
    }),
  },
]

/** ADR 0190, S2: выборка больше предела — отказ с причиной. */
export const ExportServerRowsLimit: StoryObj<StoryProps> = {
  name: 'Over the limit',
  parameters: { scenario: '0190/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Предел выгрузки"
      steps={OVER_LIMIT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const download = interceptDownload()
    try {
      await step(OVER_LIMIT[0]!.title, async () => {
        await until(() => expect(hasRow(canvas, 0)).toBe(true))
      })
      await step(OVER_LIMIT[1]!.title, async () => {
        const requests = server.starts.length
        await guideNext(canvas)
        await stepDone(canvas)
        await expect(announced(canvas)).toContain(
          dataExportModelLabels(labels).exportTooManyRows(LIMIT),
        )
        await expect(server.starts.length).toBe(requests)
        await expect(download.names).toEqual([])
        await settle()
      })
    } finally {
      download.restore()
    }
  },
}

// --- S3: блок не загрузился ----------------------------------------------------------

const REFUSED: readonly GuideStoryStep[] = [
  {
    title: 'Список с сервера',
    hint: 'У приложения нет своего сервиса выгрузки, а строки приходят блоками. Кнопка выгрузки доступна.',
    props: exportProps(FAILED_BLOCK),
  },
  {
    title: 'Строки идут',
    hint: 'Пользователь начал выгрузку. Таблица запрашивает строки выборки, кнопка занята.',
    enter: stepAction(async (root, { signal }) => {
      server.failed.delete(FAILED_BLOCK)
      await startExport(root, signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Один из блоков не пришёл. Файла нет, кнопка свободна, объявление называет причину.',
    enter: stepAction(async (root, { signal }) => {
      await startExport(root, signal)
      const before = announced(root)
      server.hold = false
      release()
      await pollUntil(() => !busy() && announced(root) !== before, signal)
    }),
  },
]

/** ADR 0190, S3: блок не загрузился — отказ с причиной, файла нет. */
export const ExportServerRowsRefused: StoryObj<StoryProps> = {
  name: 'Refused by the server',
  parameters: { scenario: '0190/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ блока"
      steps={REFUSED}
      reset={() => server.failed.delete(FAILED_BLOCK)}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const download = interceptDownload()
    try {
      await step(REFUSED[0]!.title, async () => {
        await waitForRows(canvas)
      })
      await step(REFUSED[1]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await until(() => expect(busy()).toBe(true))
      })
      await step(REFUSED[2]!.title, async () => {
        await guideNext(canvas)
        await stepDone(canvas)
        await until(() => expect(busy()).toBe(false))
        await until(() => expect(download.names).toEqual([]))
        await settle()
      })
    } finally {
      download.restore()
    }
  },
}
