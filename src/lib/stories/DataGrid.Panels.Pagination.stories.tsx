import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
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
import { filteringColumns } from './__mocks__/filteringData'
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

/** ADR 0038, S1: страницы и сортировка приходят с сервера, итог — из `paginationRowCount`. */
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
          paginationServer: true,
          paginationRowCount: PAGE_SERVER_TOTAL,
          paginationInitialPageSize: SERVER_PAGE,
          enableColumnSorting: true,
          columnSortingServer: true,
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
