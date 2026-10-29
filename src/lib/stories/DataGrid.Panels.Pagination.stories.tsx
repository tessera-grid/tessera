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
  pointAt,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
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

// --- ADR 0153 S8 ---------------------------------------------------------------------

const NEXT_PAGE = '[data-testid="pagination"] [data-page-action="next"]'
const nextButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(NEXT_PAGE)
const pageWaits = (root: HTMLElement) =>
  nextButton(root)?.getAttribute('aria-busy') === 'true'
const pageArmed = (root: HTMLElement) =>
  !!nextButton(root)?.hasAttribute('data-cancel-armed')

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

/** Занятая кнопка перехода готова к отмене. */
const pageCancelArmed = async (root: HTMLElement, signal: AbortSignal) => {
  await pageHeld(root, signal)
  await pollUntil(() => pageArmed(root), signal)
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
    hint: 'Пользователь нажал переход на следующую страницу. Кнопка показывает ожидание.',
    states: ['body.refreshing'],
    enter: stepAction((root, { signal }) => pageHeld(root, signal)),
  },
  {
    title: 'Кнопка предлагает отмену',
    hint: 'Пользователь навёл указатель на кнопку. Появился знак остановки, подсказка предлагает отменить переход.',
    states: ['body.refreshing'],
    pseudo: { hover: NEXT_PAGE },
    enter: stepAction(async (root, { signal, onLeave }) => {
      await pageCancelArmed(root, signal)
      onLeave(pointAt(nextButton(root)!))
    }),
  },
  {
    title: 'Переход отменён',
    hint: 'Пользователь нажал на кнопку. Вернулась прежняя страница с её строками.',
    enter: stepAction(async (root, { signal }) => {
      await pageCancelArmed(root, signal)
      nextButton(root)!.click()
      await pollUntil(
        () => !pageWaits(root) && rangeText().startsWith('1–'),
        signal,
      )
    }),
  },
]

/** ADR 0153, S8: серверная страница грузится — человек отменяет переход. */
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
          paginationServer: true,
          paginationRowCount: PAGE_SERVER_TOTAL,
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
      await expect(pageArmed(canvas)).toBe(true)
      await expect(nextButton(canvas)).toHaveAttribute(
        'aria-label',
        labels.cancelAction(labels.nextPage),
      )
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
