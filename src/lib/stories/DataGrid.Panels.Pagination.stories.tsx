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
  GuideStory,
  type GuideApp,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
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

const SERVER: readonly GuideStoryStep[] = [
  {
    title: 'Страницы на сервере',
    hint: 'Таблица не режет строки сама: она показывает страницу из ответа сервера, число страниц считается по общему числу строк на сервере.',
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
    title: 'Пользователь открыл следующую страницу',
    hint: 'Номер страницы ушёл приложению, оно запросило страницу у сервера. Пока сервер отвечает, таблица в состоянии обновления данных. Пришла вторая страница, нижняя панель показывает её диапазон строк.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await nextPage(root, signal)
      await pollUntil(() => !busy(root), signal)
    }),
  },
  {
    title: 'Пользователь отсортировал по имени',
    hint: 'Сортировка ушла серверу вместе с номером страницы. Пришла та же страница, строки упорядочены по имени.',
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
    <GuideStory
      title="Страницы на сервере"
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
    await step(SERVER[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(rangeText()).toBe(`1–${SERVER_PAGE} of ${PAGE_SERVER_TOTAL}`),
      )
      await expect(firstRowText(canvas, 'name')).toBe(
        queryPage(0, SERVER_PAGE, undefined)[0]!.name,
      )
    })
    await step(SERVER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(onSecondPage(canvas)).toBe(true)
      await expect(rangeText()).toBe(
        `${SERVER_PAGE + 1}–${SERVER_PAGE * 2} of ${PAGE_SERVER_TOTAL}`,
      )
      await expect(consoleText()).toContain('onPageChange')
      await expect(consoleText()).toContain(`page 2 of ${pages}`)
    })
    await step(SERVER[2]!.title, async () => {
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

const OWN_PAGER: readonly GuideStoryStep[] = [
  {
    title: 'Первая страница',
    hint: 'Страницами управляет пейджер приложения, нижней панели с пейджером у таблицы нет. Таблица показывает первую страницу по 10 строк.',
    props: () => ({
      enablePaginationModel: true,
      paginationModelPagination: { pageIndex: 0, pageSize: 10 },
    }),
  },
  {
    title: 'Приложение листает дальше',
    hint: 'Пользователь перешёл на следующую страницу в пейджере приложения. Таблица показывает вторую страницу.',
    props: () => ({
      paginationModelPagination: { pageIndex: 1, pageSize: 10 },
    }),
  },
  {
    title: 'Приложение меняет размер страницы',
    hint: 'Пользователь выбрал в пейджере приложения 5 строк на странице. Таблица показывает первую страницу по 5 строк.',
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
    <GuideStory
      title="Свой пейджер приложения"
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
    await step(OWN_PAGER[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(orderedRows(canvas)).toHaveLength(10))
      expect(firstRowText(canvas, 'firstName')).toBe(ownPagerData[0]!.firstName)
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'firstName')).toBe(
          ownPagerData[10]!.firstName,
        ),
      )
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[2].title, async () => {
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

const CANCEL_PAGE: readonly GuideStoryStep[] = [
  {
    title: 'Страницы на сервере',
    hint: 'Каждая страница приходит с сервера.',
    props: ({ log }) => ({
      columnsOverride: filteringColumns,
      dataOverride: queryPage(0, SERVER_PAGE, undefined),
      onPageChange: heldPage(log),
    }),
  },
  {
    title: 'Страница грузится',
    hint: 'Пользователь нажал переход на следующую страницу. Пока сервер готовит её строки, под шапкой светится полоса обновления.',
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => pageHeld(root, signal)),
  },
  {
    title: 'Страница грузится долго',
    hint: 'Сервер не ответил за секунду. Под шапкой появилась плашка о загрузке страницы с кнопкой отмены.',
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => pageLong(root, signal)),
  },
  {
    title: 'Переход отменён',
    hint: 'Пользователь нажал отмену в плашке. Вернулась прежняя страница с её строками, плашка и свечение ушли.',
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
    <GuideStory
      title="Отмена перехода на страницу"
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
    await step(CANCEL_PAGE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rangeText().startsWith('1–')).toBe(true))
    })
    await step(CANCEL_PAGE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pageWaits(canvas)).toBe(true)
      await expect(firstRowText(canvas, 'name')).toBe(firstName)
    })
    await step(CANCEL_PAGE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBannerOf(canvas)).toHaveTextContent(
        labels.pendingPage,
      )
      await expect(pendingCancelOf(canvas)).toHaveTextContent(labels.cancel)
      await settle()
    })
    await step(CANCEL_PAGE[3]!.title, async () => {
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

const SELECT_ALL_EXCEPT: readonly GuideStoryStep[] = [
  {
    title: 'Страница с сервера',
    hint: 'Таблица показывает одну страницу из ответа сервера, остальные строки лежат на сервере. Ни одна строка не выбрана.',
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
    title: 'Пользователь выбрал все строки',
    hint: 'Пользователь отметил флажок в заголовке. Выбраны все строки на сервере, а не только этой страницы; нижняя панель называет их число.',
    states: ['body.selection'],
    enter: untilDone(
      root => allChecked(root) && selectedCount() === String(PAGE_SERVER_TOTAL),
      checkAll,
    ),
  },
  {
    title: 'Пользователь снял две строки',
    hint: 'Пользователь снял флажки двух строк. Остальные строки на сервере выбраны, нижняя панель называет их число без снятых.',
    states: ['body.selection'],
    enter: untilDone(uncheckedDone, uncheckTwo),
  },
  {
    title: 'Пользователь выгрузил выбранные',
    hint: 'Пользователь выгрузил выбранные строки. Серверу ушёл выбор целиком — все строки, кроме двух снятых, — и сервер собрал файл.',
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
    <GuideStory
      title="Выбор всего, кроме нескольких"
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
    await step(SELECT_ALL_EXCEPT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(allChecked(canvas)).toBe(false)
    })
    await step(SELECT_ALL_EXCEPT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCount()).toBe(String(PAGE_SERVER_TOTAL)))
      await expect(allChecked(canvas)).toBe(true)
    })
    await step(SELECT_ALL_EXCEPT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(uncheckedDone(canvas)).toBe(true))
      await expect(selectedCount()).toBe(String(PAGE_SERVER_TOTAL - 2))
    })
    await step(SELECT_ALL_EXCEPT[3]!.title, async () => {
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
