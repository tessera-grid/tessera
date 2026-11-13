import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import type { TesseraFeatureEntry } from '../core/features'
import {
  groupProps,
  groupServer,
  hasRow,
  layout,
  release,
  server,
  serverProps,
  skeletonRows,
} from './__mocks__/serverRowModelGuide'

/**
 * Пагинация в серверной модели строк (ADR 0158): `Playground` — страницы строк с
 * «сервера», размер страницы и известность итога — контролами; S1–S4 — листание с
 * загрузкой страниц, неизвестный итог, группы на страницах, черновик правки.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Pagination',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

const TOTAL = 100_000
const BLOCK = 100
const PAGE_SIZE = 25

const pagedProps =
  (
    props: GuideStoryStep['props'],
    pageSize = PAGE_SIZE,
  ): GuideStoryStep['props'] =>
  context => ({
    ...props!(context),
    enablePagination: true,
    paginationInitialPageSize: pageSize,
  })

const pageButton = (
  root: ParentNode,
  action: 'first' | 'previous' | 'next' | 'last',
) => root.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)
/** Кнопка погашена: подсказка у неё остаётся, поэтому `aria-disabled`, а не `disabled`. */
const offButton = (button: HTMLElement | null) =>
  button?.getAttribute('aria-disabled') === 'true'
const pageRange = (root: ParentNode) =>
  root.querySelector('[data-testid="pagination-range"]')?.textContent ?? ''

interface PaginationPlaygroundArgs extends StoryProps {
  knownTotal: boolean
}

export const ServerPaginationPlayground: StoryObj<PaginationPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(
    ['knownTotal', 'enablePagination', 'paginationInitialPageSize'],
    {
      dataCount: 'строки подаёт «сервер» демо',
      columnCount: 'колонки задаёт демо',
    },
  ),
  args: {
    ...layout,
    knownTotal: true,
    enablePagination: true,
    paginationInitialPageSize: PAGE_SIZE,
  },
  argTypes: {
    knownTotal: {
      description: 'Сервер сообщает итог строк сразу',
      control: 'boolean',
    },
  },
  render: ({ knownTotal, ...args }) => (
    <StoryComponent
      {...normalizeArgs(args)}
      {...serverProps({ total: TOTAL, knownTotal, blockSize: BLOCK })!(AT_REST)}
    />
  ),
  // Снимок — в покое: первая страница пришла.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(hasRow(canvas, 0)).toBe(true))
    await settle()
  },
}

// --- S1: листание с загрузкой страниц ----------------------------------------------

/** Первая строка последней страницы. */
const LAST_ROW = TOTAL - PAGE_SIZE

/** Пользователь открыл последнюю страницу, «сервер» держит её строки. */
const openLast = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0), signal)
  server.hold = true
  pageButton(root, 'last')!.click()
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const PAGES: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Сервер отдаёт строки блоками по сто, таблица показывает их страницами по двадцать пять. Один блок закрывает первые четыре страницы.',
    props: pagedProps(
      serverProps({ total: TOTAL, knownTotal: true, blockSize: BLOCK }),
    ),
  },
  {
    title: 'Пользователь открыл последнюю страницу',
    hint: 'Строк этой страницы в таблице ещё нет. Страница показана сразу: пока сервер отвечает, на месте строк — скелеты.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (hasRow(root, LAST_ROW) || server.held.length > 0) return
      await openLast(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Строки последней страницы пришли и встали на место скелетов.',
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !hasRow(root, LAST_ROW)) {
        await openLast(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(() => hasRow(root, LAST_ROW), signal)
    }),
  },
  {
    title: 'Пользователь вернулся на первую страницу',
    hint: 'Первую страницу таблица уже загружала: она открылась сразу, без запроса к серверу.',
    enter: stepAction(async (root, { signal }) => {
      if (!hasRow(root, LAST_ROW) && !hasRow(root, 0)) {
        await openLast(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(() => hasRow(root, 0) || hasRow(root, LAST_ROW), signal)
      if (!hasRow(root, 0)) pageButton(root, 'first')!.click()
      await pollUntil(() => hasRow(root, 0), signal)
    }),
  },
]

/** ADR 0158, S1: незагруженная страница — скелетами, возврат на прежнюю — мгновенно. */
export const ServerPaginationPages: StoryObj<StoryProps> = {
  name: 'Load pages',
  parameters: { scenario: '0158/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Страницы с сервера"
      steps={PAGES}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PAGES[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(pageRange(canvas)).toMatch(/^1–25\D+100\D?000$/))
    })
    await step(PAGES[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(skeletonRows(canvas)).toBeGreaterThan(0))
    })
    await step(PAGES[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(skeletonRows(canvas)).toBe(0))
      await settle()
    })
    await step(PAGES[3]!.title, async () => {
      const requests = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      // Первая страница — из кэша: новых запросов нет.
      await until(() => expect(server.starts.length).toBe(requests))
      await until(() => expect(skeletonRows(canvas)).toBe(0))
      await settle()
    })
  },
}

// --- S2: неизвестный итог ------------------------------------------------------------

const SHORT_TOTAL = 230
const SHORT_BLOCK = 100
const SHORT_PAGE = 50
/** Страница, где кончается список: строки 201–230. */
const LAST_PAGE_ROW = 200

/** Пользователь листает вперёд, пока не дошёл до конца списка. */
const reachEnd = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0), signal)
  await pollUntil(() => {
    if (hasRow(root, LAST_PAGE_ROW)) return true
    const next = pageButton(root, 'next')
    // Следующую страницу — когда строки текущей пришли.
    if (next && !offButton(next) && skeletonRows(root) === 0) next.click()
    return false
  }, signal)
}

const UNKNOWN_TOTAL: readonly GuideStoryStep[] = [
  {
    title: 'Итог неизвестен',
    hint: 'Сервер не сообщает, сколько всего строк. Пейджер показывает диапазон страницы без итога, а последнюю страницу открыть нельзя: где кончается список, ещё неизвестно.',
    props: pagedProps(
      serverProps({
        total: SHORT_TOTAL,
        knownTotal: false,
        blockSize: SHORT_BLOCK,
      }),
      SHORT_PAGE,
    ),
  },
  {
    title: 'Пользователь дошёл до конца списка',
    hint: 'Сервер отдал блок короче обычного: список кончился. Теперь итог известен — пейджер показывает его, а кнопка следующей страницы погашена.',
    enter: stepAction(async (root, { signal }) => {
      await reachEnd(root, signal)
    }),
  },
]

/** ADR 0158, S2: «из многих», последняя страница доступна после конца списка. */
export const ServerPaginationUnknownTotal: StoryObj<StoryProps> = {
  name: 'Unknown total',
  parameters: { scenario: '0158/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Итог неизвестен"
      steps={UNKNOWN_TOTAL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UNKNOWN_TOTAL[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() =>
        expect(offButton(pageButton(canvas, 'last'))).toBe(true),
      )
      await until(() =>
        expect(offButton(pageButton(canvas, 'next'))).toBe(false),
      )
    })
    await step(UNKNOWN_TOTAL[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(pageRange(canvas)).toMatch(/^201–230\D+230$/))
      await expect(offButton(pageButton(canvas, 'next'))).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0192, S5: номера появляются с итогом ----------------------------------------

const pageNumberOf = (root: ParentNode, page: number) =>
  root.querySelector<HTMLElement>(`[data-page-number="${page}"]`)

const NUMBERS_WITH_TOTAL: readonly GuideStoryStep[] = [
  {
    title: 'Итог неизвестен',
    hint: 'Сервер не сообщает, сколько всего строк, поэтому номеров нет: переход на произвольную страницу мог бы уйти за конец списка. Видны кнопки первой, предыдущей, следующей и последней страниц.',
    props: pagedProps(
      serverProps({
        total: SHORT_TOTAL,
        knownTotal: false,
        blockSize: SHORT_BLOCK,
      }),
      SHORT_PAGE,
    ),
  },
  {
    title: 'Итог стал известен',
    hint: 'Пользователь дошёл до конца списка, и таблица узнала число строк. Под таблицей появился ряд номеров.',
    enter: stepAction(async (root, { signal }) => {
      await reachEnd(root, signal)
      await pollUntil(() => !!pageNumberOf(root, 1), signal)
    }),
  },
]

/** ADR 0192, S5: итог неизвестен — только стрелки, итог пришёл — номера. */
export const PaginationUnknownTotal: StoryObj<StoryProps> = {
  name: 'Page numbers after the total',
  parameters: { scenario: '0192/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title="Номера при неизвестном итоге"
      steps={NUMBERS_WITH_TOTAL}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NUMBERS_WITH_TOTAL[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(pageNumberOf(canvas, 1)).toBeNull())
      await until(() =>
        expect(offButton(pageButton(canvas, 'last'))).toBe(true),
      )
    })
    await step(NUMBERS_WITH_TOTAL[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pageNumberOf(canvas, 5)).not.toBeNull()
      await settle()
    })
  },
}

// --- S3: группы на страницах ---------------------------------------------------------

/** Групп на странице: пять городов — три страницы. */
const GROUP_PAGE = 2
const groupRow = (root: ParentNode, city: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id='group:${JSON.stringify([city])}']`,
  )
const groupToggle = (root: ParentNode, city: string) =>
  groupRow(root, city)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const groupOpen = (root: ParentNode, city: string) =>
  groupToggle(root, city)?.getAttribute('aria-expanded') === 'true'
/** Строки раскрытой группы пришли: на странице — строки данных. */
const membersShown = (root: ParentNode) =>
  !!root.querySelector('.data-grid__body-row[data-row-id^="item-id-"]')

/** Пользователь раскрыл первую группу страницы. */
const expandFirst = async (root: HTMLElement, signal: AbortSignal) => {
  groupServer.refuse = false
  await pollUntil(() => !!groupRow(root, 'Berlin'), signal)
  if (!groupOpen(root, 'Berlin')) groupToggle(root, 'Berlin')!.click()
  await pollUntil(() => membersShown(root), signal)
}

const GROUPS: readonly GuideStoryStep[] = [
  {
    title: 'Группы по страницам',
    hint: 'Сервер группирует строки по городам. Страница считает строки верхнего уровня — на каждой по две группы.',
    props: pagedProps(groupProps({ grouping: ['city'] }), GROUP_PAGE),
    states: ['body.groups'],
  },
  {
    title: 'Пользователь раскрыл группу',
    hint: 'Строки раскрытой группы — на её странице: страница стала длиннее, но на ней по-прежнему две группы.',
    enter: stepAction(async (root, { signal }) => {
      await expandFirst(root, signal)
    }),
  },
  {
    title: 'Пользователь открыл следующую страницу',
    hint: 'Следующая страница начинается со следующей группы, как и до раскрытия: раскрытие границ страниц не сдвигает.',
    enter: stepAction(async (root, { signal }) => {
      if (!groupRow(root, 'Oslo')) {
        await expandFirst(root, signal)
        pageButton(root, 'next')!.click()
      }
      await pollUntil(() => !!groupRow(root, 'Oslo'), signal)
    }),
  },
]

/** ADR 0158, S3: раскрытая группа удлиняет свою страницу, границы страниц на месте. */
export const ServerPaginationGroups: StoryObj<StoryProps> = {
  name: 'Groups on pages',
  parameters: { scenario: '0158/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Группы на страницах"
      steps={GROUPS}
      reset={() => {
        groupServer.refuse = false
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPS[0]!.title, async () => {
      await until(() => expect(!!groupRow(canvas, 'Berlin')).toBe(true))
      await until(() => expect(pageRange(canvas)).toMatch(/^1–2\D+5$/))
      await expect(groupRow(canvas, 'Lima')).not.toBeNull()
      await until(() => expect(groupRow(canvas, 'Oslo')).toBeNull())
    })
    await step(GROUPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pageRange(canvas)).toMatch(/^1–2\D+5$/)
      await expect(groupRow(canvas, 'Oslo')).toBeNull()
      await settle()
    })
    await step(GROUPS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pageRange(canvas)).toMatch(/^3–4\D+5$/)
      await expect(groupRow(canvas, 'Paris')).not.toBeNull()
      await expect(groupRow(canvas, 'Berlin')).toBeNull()
      await settle()
    })
  },
}

// --- S4: черновик правки -------------------------------------------------------------

const EDIT_ROW = 'item-id-1'
const DRAFT = '42'

const ageCell = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${EDIT_ROW}"] .data-grid__body-cell[data-column-id="age"]`,
  )
const ageInput = (root: ParentNode) =>
  ageCell(root)?.querySelector<HTMLInputElement>('input') ?? null
const ageEditButton = (root: ParentNode) =>
  ageCell(root)?.querySelector<HTMLElement>('.cell__button button') ?? null

/** Набрать текст в поле — как ввод с клавиатуры. */
const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Пользователь открыл правку возраста и набрал черновик. */
const startDraft = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!ageCell(root), signal)
  await pollUntil(() => {
    const input = ageInput(root)
    if (!input) ageEditButton(root)?.click()
    else if (input.value !== DRAFT) typeInto(input, DRAFT)
    return input?.value === DRAFT
  }, signal)
}

/** Строка, которую показывает приложение: она на четвёртой странице. */
const SHOWN_ROW = 'item-id-80'

/** Таблица гайда — приложению, которое показывает строки. */
let editingTable: {
  scrollToRow: (rowId: string) => Promise<boolean>
} | null = null
const editingHost: TesseraFeatureEntry = {
  id: 'paginationEditingHost',
  setup: table => {
    editingTable = table as typeof editingTable
    return () => {
      editingTable = null
    }
  },
}

/**
 * Приложение показывает строку другой страницы: фокус остаётся в поле правки. Нажатие на
 * пейджер мышью увело бы его — правка сохранилась бы (ADR 0040).
 */
const showRow = (rowId: string) => void editingTable?.scrollToRow(rowId)

const EDITING: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Сервер отдаёт строки блоками, таблица показывает их страницами. Возраст можно править: у ячеек колонки при наведении появляется кнопка правки.',
    props: context => {
      const props = pagedProps(
        serverProps({ total: TOTAL, knownTotal: true, blockSize: BLOCK }),
      )!(context)
      return {
        ...props,
        enableCellEditing: true,
        extraPlugins: [...(props.extraPlugins ?? []), editingHost],
      }
    },
  },
  {
    title: 'Пользователь начал правку',
    hint: 'Пользователь открыл правку возраста и набрал новое значение, но ещё не сохранил его.',
    states: ['body.editing'],
    enter: stepAction(async (root, { signal }) => {
      await startDraft(root, signal)
    }),
  },
  {
    title: 'Приложение показало другую строку',
    hint: 'Пока правка открыта, приложение показало строку другой страницы — например, по ссылке из уведомления. Строки с правкой на экране нет, но правка не закончилась.',
    enter: stepAction(async (root, { signal }) => {
      if (ageCell(root)) {
        await startDraft(root, signal)
        showRow(SHOWN_ROW)
      }
      await pollUntil(() => !ageCell(root), signal)
    }),
  },
  {
    title: 'Приложение вернулось к правке',
    hint: 'Приложение снова показало строку с правкой. Поле правки открыто, в нём набранное значение: ничего не сохранено и не потеряно.',
    enter: stepAction(async (root, { signal }) => {
      if (ageCell(root) && !ageInput(root)) {
        await startDraft(root, signal)
        showRow(SHOWN_ROW)
        await pollUntil(() => !ageCell(root), signal)
      }
      if (!ageCell(root)) showRow(EDIT_ROW)
      await pollUntil(() => ageInput(root)?.value === DRAFT, signal)
    }),
  },
]

/** ADR 0158, S4: черновик правки переживает уход со страницы и возврат. */
export const ServerPaginationEditing: StoryObj<StoryProps> = {
  name: 'Draft across pages',
  parameters: { scenario: '0158/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Черновик на другой странице"
      steps={EDITING}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDITING[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(EDITING[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ageInput(canvas)?.value).toBe(DRAFT)
    })
    await step(EDITING[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ageInput(canvas)).toBeNull()
      await settle()
    })
    await step(EDITING[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ageInput(canvas)?.value).toBe(DRAFT)
      await settle()
    })
  },
}
