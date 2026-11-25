import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import { isAllSelection } from '../core/rowSelectionAll'
import type { ExportRequest } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  bodyRow,
  consoleText,
  firstRowText,
  guideNext,
  headCell,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { chooseAxis, openExportPanel } from './__mocks__/exportGuide'
import { filteringColumns } from './__mocks__/filteringData'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { getData } from './__mocks__/data'
import {
  DemoStory,
  type GuideApp,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import type { ConsoleLog } from './demos/consoleLog'
import {
  PAGE_SERVER_TOTAL,
  queryPage,
  type ServerSort,
} from './demos/panelsDemos'

/**
 * Пагинация (ADR 0038): `Playground` — пейджер в покое; S1 — страницы и сортировка с
 * сервера; свой пейджер приложения — S2 ADR 0120.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Pagination',
} satisfies Meta<StoryProps>

export default meta

export const PaginationPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('panel.pagination'),
    ...showControls([
      'enablePagination',
      'paginationInitialPageSize',
      'paginationPageSizes',
      'paginationPageNumbers',
      'paginationRevertOnReject',
    ]),
  },
  args: {
    // Пагинация в нижней панели: размер страницы, диапазон и кнопки. Включите
    // enableColumnSorting — смена сортировки вернёт на первую страницу.
    enablePagination: true,
    dataCount: 1000,
    // Грид в окне матрицы контраста (ADR 0089, CX16): тело прокручивается, пейджер виден.
    height: '460',
    maxHeight: '460',
  },
}

// --- ADR 0038, S1 --------------------------------------------------------------------

const SERVER_DELAY_MS = 600
const SERVER_PAGE = 25

/** Запрос, который приложение отправило «серверу» последним. */
const request = {
  pageIndex: 0,
  pageSize: SERVER_PAGE,
  sort: undefined as ServerSort,
  seq: 0,
  table: undefined as unknown,
}

/** «Сервер» отвечает с задержкой; пока отвечает — таблица обновляет данные. */
const refetch = (app: GuideApp, log: ConsoleLog) => {
  const seq = ++request.seq
  app.update(props => ({ ...props, loading: 'refresh' }))
  setTimeout(() => {
    if (seq !== request.seq) return
    const { pageIndex, pageSize, sort } = request
    log.log(
      'server',
      `page ${pageIndex + 1} of ${Math.ceil(PAGE_SERVER_TOTAL / pageSize)}` +
        (sort ? ` by ${sort.id} ${sort.desc ? 'desc' : 'asc'}` : ''),
    )
    app.update(props => ({
      ...props,
      loading: false,
      dataOverride: queryPage(pageIndex, pageSize, sort),
    }))
  }, SERVER_DELAY_MS)
}

/** Новое открытие таблицы — новый запрос: прежний ответ ему не принадлежит. */
const serverReset: TesseraFeatureEntry = {
  id: 'paginationServerReset',
  setup: table => {
    // `setup` повторяется при смене аргументов плагинов, а обёртка таблицы новая на каждом
    // рендере: новое открытие узнаётся по хранилищу состояния.
    const store = (table as { store: unknown }).store
    if (request.table === store) return
    request.table = store
    request.pageIndex = 0
    request.pageSize = SERVER_PAGE
    request.sort = undefined
    request.seq += 1
  },
}

const rangeText = () => byTestId('pagination-range')?.textContent ?? ''
const busy = (root: HTMLElement) =>
  root.querySelector('.data-grid__container')?.getAttribute('aria-busy') ===
  'true'
const onSecondPage = (root: HTMLElement) =>
  rangeText().startsWith(`${SERVER_PAGE + 1}–`) &&
  firstRowText(root, 'name') === queryPage(1, SERVER_PAGE, undefined)[0]!.name
const namesOf = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row.querySelector('[data-column-id="name"]')?.textContent?.trim() ?? '',
  )
/** Вторая страница в порядке по имени — в том направлении, что ушло серверу. */
const sortedByName = (root: HTMLElement) => {
  if (request.sort?.id !== 'name') return false
  // Окно виртуализации рисует начало страницы.
  const names = namesOf(root)
  const expected = queryPage(1, SERVER_PAGE, request.sort).map(row => row.name)
  return (
    names.length > 0 && names.join() === expected.slice(0, names.length).join()
  )
}

/** Пользователь листает на вторую страницу кнопкой пейджера. */
const nextPage = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => {
    if (onSecondPage(root) || sortedByName(root)) return true
    if (!busy(root) && rangeText().startsWith('1–'))
      root
        .querySelector<HTMLElement>(
          '[data-testid="pagination"] [data-page-action="next"]',
        )
        ?.click()
    return false
  }, signal)
}

const SERVER: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Страницы на сервере', en: 'Pages on the server' },
    hint: {
      ru: 'Таблица не режет строки сама: она показывает страницу из ответа сервера, число страниц считается по общему числу строк на сервере.',
      en: "The table does not slice rows itself: it shows the page from the server's response, and the page count comes from the total number of rows on the server.",
    },
    props: ({ app, log }) => ({
      columnsOverride: filteringColumns,
      dataOverride: queryPage(0, SERVER_PAGE, undefined),
      onPageChange: (pageIndex: number, pageSize: number) => {
        Object.assign(request, { pageIndex, pageSize })
        refetch(app, log)
      },
      onToggleColumnSort: (id: string, direction: 'asc' | 'desc' | false) => {
        request.sort = direction
          ? { id, desc: direction === 'desc' }
          : undefined
        refetch(app, log)
      },
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл следующую страницу',
      en: 'The user opened the next page',
    },
    hint: {
      ru: 'Номер страницы ушёл приложению, оно запросило страницу у сервера. Пока сервер отвечает, таблица в состоянии обновления данных. Пришла вторая страница, нижняя панель показывает её диапазон строк.',
      en: 'The page number went to the app, and the app requested the page from the server. While the server responds, the table is refreshing its data. The second page arrived, and the status bar shows its row range.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await nextPage(root, signal)
      await pollUntil(() => !busy(root), signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по имени',
      en: 'The user sorted by name',
    },
    hint: {
      ru: 'Сортировка ушла серверу вместе с номером страницы. Пришла та же страница, строки упорядочены по имени.',
      en: 'The sorting went to the server along with the page number. The same page arrived, with rows ordered by name.',
    },
    enter: stepAction(async (root, { signal }) => {
      await nextPage(root, signal)
      await pollUntil(() => {
        if (sortedByName(root) && !busy(root)) return true
        if (!busy(root) && request.sort === undefined)
          headCell(root, 'name')
            ?.querySelector<HTMLElement>('.column-sort__button')
            ?.click()
        return false
      }, signal)
    }),
  },
]

/** ADR 0038, S1: страницы и сортировка приходят с сервера, итог — из `rowCount`. */
export const PaginationServer: StoryObj<StoryProps> = {
  name: 'Server',
  parameters: {
    scenario: '0038/S1',
    requirements: ['DS6'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Страницы на сервере', en: 'Pages on the server' }}
      steps={SERVER}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataMode: { sorting: 'server', pagination: 'server' },
          rowCount: PAGE_SERVER_TOTAL,
          paginationInitialPageSize: SERVER_PAGE,
          enableColumnSorting: true,
          columnSortingMultiSort: false,
          extraPlugins: [serverReset],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const pages = Math.ceil(PAGE_SERVER_TOTAL / SERVER_PAGE)
    await step(SERVER[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rangeText()).toBe(`1–${SERVER_PAGE} of ${PAGE_SERVER_TOTAL}`),
      )
      await expect(firstRowText(canvas, 'name')).toBe(
        queryPage(0, SERVER_PAGE, undefined)[0]!.name,
      )
    })
    await step(SERVER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(onSecondPage(canvas)).toBe(true)
      await expect(rangeText()).toBe(
        `${SERVER_PAGE + 1}–${SERVER_PAGE * 2} of ${PAGE_SERVER_TOTAL}`,
      )
      await expect(consoleText()).toContain('onPageChange')
      await expect(consoleText()).toContain(`page 2 of ${pages}`)
    })
    await step(SERVER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortedByName(canvas)).toBe(true)
      await expect(consoleText()).toContain('onToggleColumnSort')
      await expect(consoleText()).toContain(`page 2 of ${pages} by name`)
      await expect(rangeText()).toBe(
        `${SERVER_PAGE + 1}–${SERVER_PAGE * 2} of ${PAGE_SERVER_TOTAL}`,
      )
      await settle()
    })
  },
}

// --- ADR 0120, S2 --------------------------------------------------------------------

const OWN_PAGER_ROWS = 50
const ownPagerData = getData(OWN_PAGER_ROWS)
const statusBarOf = (root: ParentNode) =>
  root.querySelector('[data-testid="data-grid-status-bar"]')

const OWN_PAGER: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Первая страница', en: 'The first page' },
    hint: {
      ru: 'Страницами управляет пейджер приложения, нижней панели с пейджером у таблицы нет. Таблица показывает первую страницу по 10 строк.',
      en: "The app's own pager controls the pages; the table has no status bar with a pager. The table shows the first page of 10 rows.",
    },
    props: () => ({
      enablePaginationModel: true,
      paginationModelPagination: { pageIndex: 0, pageSize: 10 },
    }),
  },
  {
    title: { ru: 'Приложение листает дальше', en: 'The app pages forward' },
    hint: {
      ru: 'Пользователь перешёл на следующую страницу в пейджере приложения. Таблица показывает вторую страницу.',
      en: "The user went to the next page in the app's pager. The table shows the second page.",
    },
    props: () => ({
      paginationModelPagination: { pageIndex: 1, pageSize: 10 },
    }),
  },
  {
    title: {
      ru: 'Приложение меняет размер страницы',
      en: 'The app changes the page size',
    },
    hint: {
      ru: 'Пользователь выбрал в пейджере приложения 5 строк на странице. Таблица показывает первую страницу по 5 строк.',
      en: "The user chose 5 rows per page in the app's pager. The table shows the first page of 5 rows.",
    },
    props: () => ({
      paginationModelPagination: { pageIndex: 0, pageSize: 5 },
    }),
  },
]

/** ADR 0120, S2: приложение листает страницы своим пейджером — модель без нижней панели. */
export const PaginationOwnPager: StoryObj<StoryProps> = {
  name: 'Own pager',
  parameters: {
    scenario: '0120/S2',
    requirements: ['PB12'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Свой пейджер приложения', en: "The app's own pager" }}
      steps={OWN_PAGER}
      args={guideArgs(
        {
          dataCount: OWN_PAGER_ROWS,
          containerHeight: '600',
          height: '560',
          maxHeight: '560',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(OWN_PAGER[0].title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(orderedRows(canvas)).toHaveLength(10))
      expect(firstRowText(canvas, 'firstName')).toBe(ownPagerData[0]!.firstName)
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'firstName')).toBe(
          ownPagerData[10]!.firstName,
        ),
      )
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(orderedRows(canvas)).toHaveLength(5))
      expect(firstRowText(canvas, 'firstName')).toBe(ownPagerData[0]!.firstName)
      expect(statusBarOf(canvas)).toBeNull()
    })
    await settle()
  },
}

// --- ADR 0153 S8 ---------------------------------------------------------------------

const NEXT_PAGE = '[data-testid="pagination"] [data-page-action="next"]'
const nextButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(NEXT_PAGE)
/** Переход ждёт сервера: ожидание — свечение под шапкой (ADR 0177, §1). */
const pageWaits = (root: HTMLElement) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
const pendingBannerOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const pendingCancelOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')

/**
 * «Сервер» гайда отмены перехода: страницу не присылает, пока его не отменят; запрос
 * учитывает `signal` (ADR 0153, §1).
 */
const heldPage =
  (log: ConsoleLog) =>
  (pageIndex: number, _pageSize: number, { signal }: { signal: AbortSignal }) =>
    new Promise<void>((_resolve, reject) => {
      log.log('server', `page ${pageIndex + 1} requested`)
      signal.addEventListener(
        'abort',
        () => {
          log.log('server', 'cancelled')
          reject(signal.reason)
        },
        { once: true },
      )
    })

/** Переход на вторую страницу ждёт ответа сервера. */
const pageHeld = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (pageWaits(root)) return true
    nextButton(root)?.click()
    return false
  }, signal)

/** Переход ждёт дольше порога: под шапкой плашка с кнопкой отмены. */
const pageLong = async (root: HTMLElement, signal: AbortSignal) => {
  await pageHeld(root, signal)
  await pollUntil(() => !!pendingCancelOf(root), signal)
}

const CANCEL_PAGE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Страницы на сервере', en: 'Pages on the server' },
    hint: {
      ru: 'Каждая страница приходит с сервера.',
      en: 'Each page comes from the server.',
    },
    props: ({ log }) => ({
      columnsOverride: filteringColumns,
      dataOverride: queryPage(0, SERVER_PAGE, undefined),
      onPageChange: heldPage(log),
    }),
  },
  {
    title: { ru: 'Страница грузится', en: 'The page is loading' },
    hint: {
      ru: 'Пользователь нажал переход на следующую страницу. Пока сервер готовит её строки, под шапкой светится полоса обновления.',
      en: 'The user pressed the next page button. While the server prepares its rows, a refresh bar glows below the header.',
    },
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => pageHeld(root, signal)),
  },
  {
    title: {
      ru: 'Страница грузится долго',
      en: 'The page is taking a while to load',
    },
    hint: {
      ru: 'Сервер не ответил за секунду. Под шапкой появилась плашка о загрузке страницы с кнопкой отмены.',
      en: 'The server did not respond within a second. A banner about the page loading, with a cancel button, appeared below the header.',
    },
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => pageLong(root, signal)),
  },
  {
    title: { ru: 'Переход отменён', en: 'Navigation canceled' },
    hint: {
      ru: 'Пользователь нажал отмену в плашке. Вернулась прежняя страница с её строками, плашка и свечение ушли.',
      en: 'The user pressed cancel in the banner. The previous page came back with its rows, and the banner and the glow went away.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pageLong(root, signal)
      pendingCancelOf(root)!.click()
      await pollUntil(
        () =>
          !pageWaits(root) &&
          !pendingBannerOf(root) &&
          rangeText().startsWith('1–'),
        signal,
      )
    }),
  },
]

/** ADR 0153, S8: серверная страница грузится — человек отменяет переход в плашке под шапкой. */
export const PaginationServerCancel: StoryObj<StoryProps> = {
  name: 'Cancel a page change',
  parameters: { scenario: '0153/S8', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Отмена перехода на страницу',
        en: 'Canceling page navigation',
      }}
      steps={CANCEL_PAGE}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataMode: { pagination: 'server' },
          rowCount: PAGE_SERVER_TOTAL,
          paginationInitialPageSize: SERVER_PAGE,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const firstName = queryPage(0, SERVER_PAGE, undefined)[0]!.name
    await step(CANCEL_PAGE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeText().startsWith('1–')).toBe(true))
    })
    await step(CANCEL_PAGE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pageWaits(canvas)).toBe(true)
      await expect(firstRowText(canvas, 'name')).toBe(firstName)
    })
    await step(CANCEL_PAGE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBannerOf(canvas)).toHaveTextContent(
        labels.pendingPage,
      )
      await expect(pendingCancelOf(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_PAGE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(rangeText().startsWith('1–')).toBe(true)
      await expect(firstRowText(canvas, 'name')).toBe(firstName)
      await expect(byTestId('load-error-banner')).toBeNull()
      await expect(consoleText()).toContain('cancelled')
      await settle()
    })
  },
}

// --- ADR 0179, S3 --------------------------------------------------------------------

const EXCEPT_PAGE = queryPage(0, SERVER_PAGE, undefined)
const UNCHECKED = [EXCEPT_PAGE[1]!.id, EXCEPT_PAGE[3]!.id]
/** Выгрузки выбранного, ушедшие «серверу». */
const exportedSelections: unknown[] = []

/** Число выбранных строк в нижней панели — цифрами, без разделителей языка. */
const selectedCount = () =>
  (byTestId('selected-rows-count')?.textContent ?? '').replace(/\D/g, '')
const rowChecked = (root: HTMLElement, id: string) =>
  bodyRow(root, id)
    ?.querySelector('[role="checkbox"]')
    ?.getAttribute('aria-checked') === 'true'
const allChecked = (root: HTMLElement) =>
  orderedRows(root).length > 0 &&
  orderedRows(root).every(row =>
    rowChecked(root, row.getAttribute('data-row-id')!),
  )
const headChecked = (root: HTMLElement) =>
  root
    .querySelector('[role="columnheader"] [role="checkbox"]')
    ?.getAttribute('aria-checked') === 'true'

/** Пользователь отмечает флажок в заголовке, пока выбраны не все строки. */
const checkAll = (root: HTMLElement) => {
  if (!allChecked(root) && !headChecked(root))
    root
      .querySelector<HTMLElement>('[role="columnheader"] [role="checkbox"]')
      ?.click()
}
const uncheckedDone = (root: HTMLElement) =>
  UNCHECKED.every(id => !rowChecked(root, id)) &&
  orderedRows(root).filter(row =>
    rowChecked(root, row.getAttribute('data-row-id')!),
  ).length ===
    orderedRows(root).length - UNCHECKED.length
/** Пользователь снимает флажки двух строк после «Выбрать всё». */
const uncheckTwo = (root: HTMLElement) => {
  const someChecked = orderedRows(root).some(row =>
    rowChecked(root, row.getAttribute('data-row-id')!),
  )
  if (!someChecked) return checkAll(root)
  const id = UNCHECKED.find(row => rowChecked(root, row))
  if (id)
    bodyRow(root, id)?.querySelector<HTMLElement>('[role="checkbox"]')?.click()
}

const SELECT_ALL_EXCEPT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Страница с сервера', en: 'A page from the server' },
    hint: {
      ru: 'Таблица показывает одну страницу из ответа сервера, остальные строки лежат на сервере. Ни одна строка не выбрана.',
      en: "The table shows one page from the server's response; the other rows stay on the server. No row is selected.",
    },
    props: ({ log }) => ({
      onExport: (request: ExportRequest) => {
        exportedSelections.push(request.selection)
        const except = isAllSelection(request.selection)
          ? request.selection.except.length
          : 0
        log.log('server', `export all except ${except}`)
        return Promise.resolve()
      },
    }),
  },
  {
    title: {
      ru: 'Пользователь выбрал все строки',
      en: 'The user selected all rows',
    },
    hint: {
      ru: 'Пользователь отметил флажок в заголовке. Выбраны все строки на сервере, а не только этой страницы; нижняя панель называет их число.',
      en: 'The user checked the checkbox in the header. All rows on the server are selected, not just this page; the status bar shows their number.',
    },
    states: ['body.selection'],
    enter: untilDone(
      root => allChecked(root) && selectedCount() === String(PAGE_SERVER_TOTAL),
      checkAll,
    ),
  },
  {
    title: {
      ru: 'Пользователь снял две строки',
      en: 'The user deselected two rows',
    },
    hint: {
      ru: 'Пользователь снял флажки двух строк. Остальные строки на сервере выбраны, нижняя панель называет их число без снятых.',
      en: 'The user cleared the checkboxes of two rows. The other rows on the server stay selected, and the status bar shows their number minus the deselected ones.',
    },
    states: ['body.selection'],
    enter: untilDone(uncheckedDone, uncheckTwo),
  },
  {
    title: {
      ru: 'Пользователь выгрузил выбранные',
      en: 'The user exported the selected rows',
    },
    hint: {
      ru: 'Пользователь выгрузил выбранные строки. Серверу ушёл выбор целиком — все строки, кроме двух снятых, — и сервер собрал файл.',
      en: 'The user exported the selected rows. The whole selection went to the server (all rows except the two deselected ones), and the server built the file.',
    },
    enter: stepAction(async (root, { signal }) => {
      const before = exportedSelections.length
      await pollUntil(() => {
        if (uncheckedDone(root)) return true
        uncheckTwo(root)
        return false
      }, signal)
      await openExportPanel(root, signal)
      await chooseAxis('rows', 'selected', signal)
      await pollUntil(() => {
        if (exportedSelections.length > before) return true
        byTestId('export-run')?.click()
        return false
      }, signal)
    }),
  },
]

/** ADR 0179, S3: при серверной пагинации пользователь выбирает всё, кроме нескольких, и выгружает. */
export const PaginationServerSelectAllExcept: StoryObj<StoryProps> = {
  name: 'Server, select all except',
  parameters: { scenario: '0179/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Выбор всего, кроме нескольких',
        en: 'Selecting all but a few',
      }}
      steps={SELECT_ALL_EXCEPT}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          columnsOverride: filteringColumns,
          dataOverride: EXCEPT_PAGE,
          enablePagination: true,
          dataMode: { pagination: 'server', export: 'server' },
          rowCount: PAGE_SERVER_TOTAL,
          paginationInitialPageSize: SERVER_PAGE,
          enableRowSelection: true,
          rowSelectionSelectedCount: true,
          enableDataExport: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_ALL_EXCEPT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(allChecked(canvas)).toBe(false)
    })
    await step(SELECT_ALL_EXCEPT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCount()).toBe(String(PAGE_SERVER_TOTAL)))
      await expect(allChecked(canvas)).toBe(true)
    })
    await step(SELECT_ALL_EXCEPT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(uncheckedDone(canvas)).toBe(true))
      await expect(selectedCount()).toBe(String(PAGE_SERVER_TOTAL - 2))
    })
    await step(SELECT_ALL_EXCEPT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(exportedSelections.at(-1)).toEqual({
        all: true,
        except: UNCHECKED,
      })
      await expect(consoleText()).toContain('export all except 2')
      await settle()
    })
  },
}

// --- ADR 0192 ------------------------------------------------------------------------

const pageNumber = (root: ParentNode, page: number) =>
  root.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
const currentPage = (root: ParentNode) =>
  root.querySelector('[data-testid="pagination"] [aria-current="page"]')
    ?.textContent
const numbersShown = (root: ParentNode) => !!pageNumber(root, 1)?.offsetParent

/** Открыть страницу кнопкой номера; номера нет в ряду — сначала первая страница. */
const openPage = (root: HTMLElement, page: number, signal: AbortSignal) =>
  pollUntil(() => {
    if (currentPage(root) === String(page)) return true
    ;(pageNumber(root, page) ?? pageNumber(root, 1))?.click()
    return false
  }, signal)

const PAGE_NUMBERS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Ряд номеров', en: 'A row of page numbers' },
    hint: {
      ru: 'Под таблицей — первая и последняя страница, текущая и соседние. Текущая выделена.',
      en: 'Below the table are the first and last pages, the current one, and its neighbors. The current page is highlighted.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл страницу 5',
      en: 'The user opened page 5',
    },
    hint: {
      ru: 'Таблица показывает пятую страницу. Ряд сдвинулся: текущая страница в середине, между ней и краями многоточия.',
      en: 'The table shows the fifth page. The row of numbers shifted: the current page is in the middle, with ellipses between it and the ends.',
    },
    enter: stepAction((root, { signal }) => openPage(root, 5, signal)),
  },
  {
    title: {
      ru: 'Пользователь открыл последнюю страницу',
      en: 'The user opened the last page',
    },
    hint: {
      ru: 'Одним нажатием таблица ушла в конец. Кнопка перехода вперёд погашена.',
      en: 'One click took the table to the end. The next page button is disabled.',
    },
    enter: stepAction((root, { signal }) => openPage(root, 40, signal)),
  },
]

/** ADR 0192, S1: переход на дальнюю страницу нажатием на её номер. */
export const PaginationPageNumbers: StoryObj<StoryProps> = {
  name: 'Page numbers',
  parameters: { scenario: '0192/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Переход по номеру страницы',
        en: 'Going to a page by its number',
      }}
      steps={PAGE_NUMBERS}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataCount: 1000,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PAGE_NUMBERS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(currentPage(canvas)).toBe('1'))
    })
    await step(PAGE_NUMBERS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(currentPage(canvas)).toBe('5')
      await expect(pageNumber(canvas, 4)).not.toBeNull()
      await expect(pageNumber(canvas, 2)).toBeNull()
    })
    await step(PAGE_NUMBERS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(currentPage(canvas)).toBe('40')
      await settle()
    })
  },
}

const pageField = (root: ParentNode) =>
  root.querySelector<HTMLInputElement>('[data-testid="pagination-input"] input')

/** Ввод в поле номера: значение доходит до React событием `input`, Enter применяет. */
const enterPage = (root: ParentNode, text: string) => {
  const input = pageField(root)
  if (!input) return
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  setValue.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
}

const typePage = (
  root: HTMLElement,
  text: string,
  from: string,
  signal: AbortSignal,
) =>
  pollUntil(() => {
    if (rangeText().startsWith(from)) return true
    enterPage(root, text)
    return false
  }, signal)

const PAGE_INPUT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Поле номера', en: 'The page number field' },
    hint: {
      ru: 'Вместо ряда номеров — поле с текущей страницей и числом страниц рядом.',
      en: 'Instead of a row of numbers, there is a field with the current page and the page count next to it.',
    },
  },
  {
    title: { ru: 'Пользователь ввёл номер', en: 'The user entered a number' },
    hint: {
      ru: 'Пользователь ввёл 17 и нажал Enter. Таблица показывает эту страницу.',
      en: 'The user typed 17 and pressed Enter. The table shows that page.',
    },
    enter: stepAction((root, { signal }) =>
      typePage(root, '17', '401–', signal),
    ),
  },
  {
    title: {
      ru: 'Номер больше числа страниц',
      en: 'The number exceeds the page count',
    },
    hint: {
      ru: 'Пользователь ввёл 500, таких страниц нет. Таблица открыла последнюю, в поле её номер.',
      en: 'The user typed 500, and there is no such page. The table opened the last page, and the field shows its number.',
    },
    enter: stepAction((root, { signal }) =>
      typePage(root, '500', '976–', signal),
    ),
  },
]

/** ADR 0192, S2: пользователь вводит номер страницы в поле. */
export const PaginationPageInput: StoryObj<StoryProps> = {
  name: 'Page input',
  parameters: { scenario: '0192/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Переход вводом номера',
        en: 'Going to a page by typing its number',
      }}
      steps={PAGE_INPUT}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataCount: 1000,
          paginationPageNumbers: 'input',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PAGE_INPUT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(pageField(canvas)?.value).toBe('1'))
    })
    await step(PAGE_INPUT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(pageField(canvas)?.value).toBe('17'))
    })
    await step(PAGE_INPUT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(pageField(canvas)?.value).toBe('40'))
      await settle()
    })
  },
}

const NARROW_NUMBERS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Широкая таблица', en: 'A wide table' },
    hint: {
      ru: 'Места хватает: под таблицей ряд номеров.',
      en: 'There is enough room: below the table is a row of page numbers.',
    },
    props: () => ({ containerWidth: 760 }),
  },
  {
    title: { ru: 'Таблица сузилась', en: 'The table got narrower' },
    hint: {
      ru: 'Ряд номеров не поместился, на его месте кнопки перехода на первую, предыдущую, следующую и последнюю страницы.',
      en: 'The row of numbers did not fit; in its place are buttons for the first, previous, next, and last pages.',
    },
    props: () => ({ containerWidth: 420 }),
  },
  {
    title: { ru: 'Таблица снова широкая', en: 'The table is wide again' },
    hint: {
      ru: 'Места снова хватает, и ряд номеров вернулся.',
      en: 'There is enough room again, and the row of numbers came back.',
    },
    props: () => ({ containerWidth: 760 }),
  },
]

/** ADR 0192, S3: таблица сужается — номера уступают место кнопкам и возвращаются. */
export const PaginationNarrowPageNumbers: StoryObj<StoryProps> = {
  name: 'Narrow panel',
  parameters: { scenario: '0192/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Номера в узкой таблице',
        en: 'Page numbers in a narrow table',
      }}
      steps={NARROW_NUMBERS}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataCount: 1000,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NARROW_NUMBERS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(numbersShown(canvas)).toBe(true))
    })
    await step(NARROW_NUMBERS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(numbersShown(canvas)).toBe(false))
    })
    await step(NARROW_NUMBERS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(numbersShown(canvas)).toBe(true))
      await settle()
    })
  },
}

const PAGE_REFUSAL = 'The server is busy, try again later'
const refusedPage = {
  reject: undefined as ((error: Error) => void) | undefined,
}

const failureBanner = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

const PAGE_REFUSED: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Страницы на сервере', en: 'Pages on the server' },
    hint: {
      ru: 'Каждая страница приходит с сервера.',
      en: 'Each page comes from the server.',
    },
    props: () => ({
      columnsOverride: filteringColumns,
      dataOverride: queryPage(0, SERVER_PAGE, undefined),
      onPageChange: () =>
        new Promise<void>((_resolve, reject) => {
          refusedPage.reject = reject
        }),
    }),
  },
  {
    title: { ru: 'Страница грузится', en: 'The page is loading' },
    hint: {
      ru: 'Пользователь нажал номер 5. В ряду уже пятая страница, таблица ждёт ответа сервера.',
      en: "The user pressed page number 5. The row of numbers already shows the fifth page, and the table is waiting for the server's response.",
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (pageWaits(root)) return true
        pageNumber(root, 5)?.click()
        return false
      }, signal)
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не отдал страницу. В ряду снова первая страница, под шапкой сообщение с причиной и повтором.',
      en: 'The server did not return the page. The row of numbers shows the first page again, and below the header there is a message with the reason and a retry button.',
    },
    states: ['body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (failureBanner(root)) return true
        if (pageWaits(root)) refusedPage.reject?.(new Error(PAGE_REFUSAL))
        else pageNumber(root, 5)?.click()
        return false
      }, signal)
    }),
  },
]

/** ADR 0192, S4: сервер отказал при переходе по номеру — прежняя страница и сообщение. */
export const PaginationServerPageRefused: StoryObj<StoryProps> = {
  name: 'Refused page',
  parameters: { scenario: '0192/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Сервер отказал в странице',
        en: 'The server refused a page',
      }}
      steps={PAGE_REFUSED}
      args={guideArgs(
        {
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          enablePagination: true,
          dataMode: { pagination: 'server' },
          rowCount: PAGE_SERVER_TOTAL,
          paginationInitialPageSize: SERVER_PAGE,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PAGE_REFUSED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(currentPage(canvas)).toBe('1'))
    })
    await step(PAGE_REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(currentPage(canvas)).toBe('5')
    })
    await step(PAGE_REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(currentPage(canvas)).toBe('1'))
      await expect(failureBanner(canvas)).toHaveTextContent(PAGE_REFUSAL)
      await settle()
    })
  },
}
