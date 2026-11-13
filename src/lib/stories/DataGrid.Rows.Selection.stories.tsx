import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { pressCell, untilDone } from './__mocks__/cellGestures'
import { makeData } from './__mocks__/data'
import { filteringColumns, makeFilteringData } from './__mocks__/filteringData'
import { typeInto } from './__mocks__/typeGuides'
import {
  bodyRow,
  byTestId,
  guideNext,
  headCell,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Выбор строк (ADR 0014): `Playground` — выбранные строки в покое; S1 — выбор всех
 * строк и смена страницы, S2 — родитель вместе с детьми; выбор щелчком без флажков —
 * S5 ADR 0120; каждая строка дерева сама — S2 ADR 0162; охват флажка в заголовке — S1–S2
 * ADR 0179; выбор при группировке — S1–S3 ADR 0185.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Selection',
} satisfies Meta<StoryProps>

export default meta

/** Две строки выбраны — один раз, как только появились строки. */
const selectionSeed: TesseraFeatureEntry = {
  id: 'selectionSeed',
  setup: table => {
    const t = table as unknown as {
      getCoreRowModel: () => { rows: unknown[] }
      getRow: (id: string) => { toggleSelected: (value: boolean) => void }
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.getRow('item-id-1').toggleSelected(true)
      t.getRow('item-id-2').toggleSelected(true)
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/** Выбранные строки в покое (ADR 0093, VR4): две строки отмечены флажками. */
export const RowSelectionPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes(vrStates('body.selection')),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectAll',
      'rowSelectionSelectedCount',
    ]),
  },
  args: {
    enableRowSelection: true,
    extraPlugins: [selectionSeed],
    // Строки целиком в окне: «выбрать все на странице» сверяется со всеми строками.
    dataCount: 10,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
}

const checkboxOf = (row: Element | null | undefined) =>
  row?.querySelector<HTMLElement>('[role="checkbox"]') ?? null
const selected = (row: Element | null | undefined) =>
  row?.getAttribute('data-selected') === 'true'
const headCheckbox = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[role="columnheader"] [role="checkbox"]')

// --- S1 ------------------------------------------------------------------------------

const PAGE = 5
const ROWS = 50

const pageSelected = (root: HTMLElement) => {
  const rows = orderedRows(root)
  return rows.length === PAGE && rows.every(selected)
}
const rangeText = (root: HTMLElement) =>
  root.querySelector('[data-testid="pagination-range"]')?.textContent ?? ''
const countText = () =>
  byTestId('selected-rows-count')?.textContent?.trim() ?? ''
const allSelected = () => countText().includes(String(ROWS))

/** Пользователь отмечает флажок в заголовке, пока строки не выбраны. */
const selectAll = (root: HTMLElement) => {
  if (!pageSelected(root)) headCheckbox(root)?.click()
}

const ALL_ROWS: readonly GuideStoryStep[] = [
  {
    title: 'Строки не выбраны',
    hint: 'Таблица разбита на страницы, ни одна строка не выбрана.',
  },
  {
    title: 'Пользователь выбрал все строки',
    hint: 'Пользователь отметил флажок в заголовке. Выбраны все строки таблицы — и на других страницах; нижняя панель называет их число.',
    states: ['body.selection'],
    enter: untilDone(root => pageSelected(root) && allSelected(), selectAll),
  },
  {
    title: 'Пользователь перешёл на другую страницу',
    hint: 'Строки следующей страницы тоже выбраны.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (pageSelected(root) && allSelected()) return true
        selectAll(root)
        return false
      }, signal)
      await pollUntil(() => {
        if (rangeText(root).startsWith('6–')) return true
        root
          .querySelector<HTMLElement>(
            '[data-testid="pagination"] [data-page-action="next"]',
          )
          ?.click()
        return false
      }, signal)
      await pollUntil(() => pageSelected(root), signal)
    }),
  },
]

/** S1: пользователь выбирает все строки и переходит между страницами. */
export const BatchRowSelection: StoryObj<StoryProps> = {
  name: 'Select all rows',
  parameters: {
    scenario: '0014/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выбор всех строк"
      steps={ALL_ROWS}
      args={guideArgs(
        {
          enableRowSelection: true,
          rowSelectionSelectedCount: true,
          enablePagination: true,
          paginationInitialPageSize: PAGE,
          dataCount: ROWS,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ALL_ROWS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).some(selected)).toBe(false)
    })
    await step(ALL_ROWS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(allSelected()).toBe(true))
      await expect(pageSelected(canvas)).toBe(true)
    })
    await step(ALL_ROWS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(rangeText(canvas)).toMatch(/^6–/)
      await expect(pageSelected(canvas)).toBe(true)
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

const subRowTree = makeData({ shape: 'tree', count: 4, depth: 2, breadth: 3 })
const PARENT = (subRowTree[0] as { id: string }).id
const CHILDREN = [0, 1, 2].map(i => `${PARENT}-${i}`)
const UNSELECTED = CHILDREN[1]!

const familySelected = (root: HTMLElement) =>
  [PARENT, ...CHILDREN].every(id => selected(bodyRow(root, id)))
const partial = (root: HTMLElement) =>
  checkboxOf(bodyRow(root, PARENT))?.getAttribute('aria-checked') === 'mixed'

/** Пользователь отмечает флажок родителя, пока он и дети не выбраны. */
const selectParent = (root: HTMLElement) => {
  if (!selected(bodyRow(root, PARENT)))
    checkboxOf(bodyRow(root, PARENT))?.click()
}

const SUB_ROWS: readonly GuideStoryStep[] = [
  {
    title: 'Дерево раскрыто',
    hint: 'Строки сгруппированы по родителям, ничего не выбрано.',
  },
  {
    title: 'Пользователь выбрал родителя',
    hint: 'Вместе с родителем выбраны все его дети.',
    states: ['body.selection'],
    enter: untilDone(familySelected, selectParent),
  },
  {
    title: 'Пользователь снял выбор одного ребёнка',
    hint: 'Родитель отмечен частично, остальные дети выбраны.',
    states: ['body.selection'],
    enter: untilDone(partial, root => {
      if (!selected(bodyRow(root, UNSELECTED)) && !partial(root))
        selectParent(root)
      else if (selected(bodyRow(root, UNSELECTED)))
        checkboxOf(bodyRow(root, UNSELECTED))?.click()
    }),
  },
]

/** S2: пользователь выбирает родителя вместе с детьми. */
export const SubRowSelection: StoryObj<StoryProps> = {
  name: 'Parent with children',
  parameters: {
    scenario: '0014/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выбор родителя"
      steps={SUB_ROWS}
      args={guideArgs(
        {
          dataOverride: subRowTree,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          initialExpanded: true,
          enableRowSelection: true,
          rowSelectionSubRows: true,
          enableRowExpanding: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SUB_ROWS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(bodyRow(canvas, CHILDREN[0]!)).toBeTruthy())
      await expect(orderedRows(canvas).some(selected)).toBe(false)
    })
    await step(SUB_ROWS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(familySelected(canvas)).toBe(true))
    })
    await step(SUB_ROWS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(partial(canvas)).toBe(true))
      await expect(selected(bodyRow(canvas, UNSELECTED))).toBe(false)
      for (const id of CHILDREN.filter(id => id !== UNSELECTED))
        await expect(selected(bodyRow(canvas, id))).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0162, S2 --------------------------------------------------------------------

/** Второй родитель дерева и его вложенная строка, которую выбирает пользователь. */
const OTHER_PARENT = (subRowTree[1] as { id: string }).id
const OTHER_CHILD = `${OTHER_PARENT}-0`

const checked = (root: HTMLElement, id: string) =>
  checkboxOf(bodyRow(root, id))?.getAttribute('aria-checked')

/** Пользователь отмечает флажок строки `id`, пока она не выбрана. */
const selectOnly = (id: string) => (root: HTMLElement) => {
  if (!selected(bodyRow(root, id))) checkboxOf(bodyRow(root, id))?.click()
}

const SELF_ROWS: readonly GuideStoryStep[] = [
  {
    title: 'Дерево раскрыто',
    hint: 'Строки сгруппированы по родителям, у каждой строки — свой флажок. Ничего не выбрано.',
  },
  {
    title: 'Пользователь выбрал родителя',
    hint: 'Выбран только сам родитель: его вложенные строки остались невыбранными.',
    states: ['body.selection'],
    enter: untilDone(
      root => selected(bodyRow(root, PARENT)),
      selectOnly(PARENT),
    ),
  },
  {
    title: 'Пользователь выбрал вложенную строку другого родителя',
    hint: 'Выбрана только эта строка. Флажок её родителя не изменился и частичного выбора не показывает: каждая строка выбирается сама.',
    states: ['body.selection'],
    enter: untilDone(
      root =>
        selected(bodyRow(root, PARENT)) && selected(bodyRow(root, OTHER_CHILD)),
      root => {
        selectOnly(PARENT)(root)
        selectOnly(OTHER_CHILD)(root)
      },
    ),
  },
]

/** ADR 0162, S2: пользователь отмечает отдельные строки дерева, не трогая их детей. */
export const SelectionSubRowsSelf: StoryObj<StoryProps> = {
  name: 'Each row on its own',
  parameters: {
    scenario: '0162/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выбор отдельных строк дерева"
      steps={SELF_ROWS}
      args={guideArgs(
        {
          dataOverride: subRowTree,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          initialExpanded: true,
          enableRowSelection: true,
          rowSelectionSubRows: 'self',
          enableRowExpanding: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELF_ROWS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(bodyRow(canvas, OTHER_CHILD)).toBeTruthy())
      await expect(orderedRows(canvas).some(selected)).toBe(false)
      await expect(checkboxOf(bodyRow(canvas, CHILDREN[0]!))).not.toBeNull()
    })
    await step(SELF_ROWS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selected(bodyRow(canvas, PARENT))).toBe(true))
      for (const id of CHILDREN)
        await expect(selected(bodyRow(canvas, id))).toBe(false)
    })
    await step(SELF_ROWS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(selected(bodyRow(canvas, OTHER_CHILD))).toBe(true),
      )
      await expect(selected(bodyRow(canvas, OTHER_PARENT))).toBe(false)
      await expect(checked(canvas, OTHER_PARENT)).toBe('false')
      await expect(selected(bodyRow(canvas, PARENT))).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0120, S5 --------------------------------------------------------------------

const rowClickData = makeData({ shape: 'flat', count: 20 })
const rowIdAt = (index: number) => (rowClickData[index] as { id: string }).id
const FIRST_CLICKED = rowIdAt(2)
const SECOND_CLICKED = rowIdAt(5)

const rowSelected = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-selected') === 'true'

/** Действие шага: пользователь щёлкает строку `id`, пока приложение её не выберет. */
const clickRow = (id: string) =>
  stepAction(async (root, { signal }) => {
    await pollUntil(() => !!bodyRow(root, id), signal)
    pressCell(
      bodyRow(root, id).querySelector<HTMLElement>('[role="gridcell"]')!,
    )
    await pollUntil(() => rowSelected(root, id), signal)
  })

const ROW_CLICK: readonly GuideStoryStep[] = [
  {
    title: 'Выбора нет',
    hint: 'Выбором управляет приложение: колонки флажков у таблицы нет, приложение выбирает строку, по которой щёлкнул пользователь. Пока ни одна строка не выбрана.',
    // Приложение: выбор строки по щелчку, срез выбора — у него до нового открытия грида.
    props: ({ app }) => ({
      enableRowSelectionModel: true,
      enableKeyboardNavigation: true,
      onActiveCellChange: ({ rowIndex }) => {
        if (rowIndex >= 0)
          app.update(() => ({
            rowSelectionModelRowSelection: { [rowIdAt(rowIndex)]: true },
          }))
      },
    }),
  },
  {
    title: 'Пользователь выбрал строку',
    hint: 'Пользователь щёлкнул по строке, и приложение отметило её выбранной. Таблица показывает строку выбранной.',
    enter: clickRow(FIRST_CLICKED),
  },
  {
    title: 'Пользователь выбрал другую строку',
    hint: 'Пользователь щёлкнул по другой строке. Выбор перешёл на неё, прежняя строка больше не выбрана.',
    enter: clickRow(SECOND_CLICKED),
  },
]

/** ADR 0120, S5: пользователь выбирает строку щелчком — модель без колонки флажков. */
export const SelectionByRowClick: StoryObj<StoryProps> = {
  name: 'By row click',
  parameters: {
    scenario: '0120/S5',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выбор щелчком по строке"
      steps={ROW_CLICK}
      args={guideArgs(
        {
          dataOverride: rowClickData,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(ROW_CLICK[0].title, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('[role="columnheader"] input')).toBeNull()
      expect(
        canvas.querySelector('.data-grid__body-row[data-selected="true"]'),
      ).toBeNull()
    })
    await step(ROW_CLICK[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(bodyRow(canvas, FIRST_CLICKED).getAttribute('aria-selected')).toBe(
        'true',
      )
    })
    await step(ROW_CLICK[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(rowSelected(canvas, SECOND_CLICKED)).toBe(true)
      expect(rowSelected(canvas, FIRST_CLICKED)).toBe(false)
    })
    await settle()
  },
}

// --- ADR 0179, S1–S2 -----------------------------------------------------------------

const SCOPE_ROWS = makeFilteringData(50)
const SCOPE_PAGE = 5
const SCOPE_QUERY = 'Paris'
const FOUND = SCOPE_ROWS.filter(row => row.city === SCOPE_QUERY).length
const SCOPE_GRID = {
  columnsOverride: filteringColumns,
  dataOverride: SCOPE_ROWS,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enablePagination: true,
  paginationInitialPageSize: SCOPE_PAGE,
}

const searchField = () => byTestId('quick-search') as HTMLInputElement | null
const selectedCount = () =>
  byTestId('selected-rows-count')?.textContent?.trim() ?? ''
const headChecked = (root: HTMLElement) =>
  headCheckbox(root)?.getAttribute('aria-checked') === 'true'
const pageStart = (root: HTMLElement) => rangeText(root).split('–')[0]
const pagesOfFound = (root: HTMLElement) =>
  rangeText(root).endsWith(` ${FOUND}`)

/** Пользователь набирает запрос в поле поиска или очищает его. */
const searchFor = (text: string, done: (root: HTMLElement) => boolean) =>
  untilDone(done, () => {
    const field = searchField()
    if (field && field.value !== text) typeInto(field, text)
  })
/** Пользователь отмечает флажок в заголовке, пока строки охвата не выбраны. */
const checkHead = (root: HTMLElement) => {
  if (!headChecked(root)) headCheckbox(root)?.click()
}
/** Пользователь листает к странице, которая начинается строкой `start`. */
const toPage = (start: string) => (root: HTMLElement) => {
  if (pageStart(root) === start) return
  const action = start === '1' ? 'previous' : 'next'
  root
    .querySelector<HTMLElement>(
      `[data-testid="pagination"] [data-page-action="${action}"]`,
    )
    ?.click()
}

/** Звено действия шага: состояние, до которого оно доводит, и само действие. */
type Link = [
  done: (root: HTMLElement) => boolean,
  act: (root: HTMLElement) => void,
]

/**
 * Шаг, чьё состояние — итог цепочки действий: со свежей таблицы он проходит все звенья,
 * после прошлого шага — только недостающие (ADR 0117, §6а).
 */
const chain =
  (...links: Link[]): GuideStoryStep['enter'] =>
  (root, app) => {
    let at = -1
    return untilDone(links.at(-1)![0], root => {
      if (at < 0) {
        at = links.length - 1
        while (at > 0 && !links[at - 1]![0](root)) at--
      }
      while (at < links.length - 1 && links[at]![0](root)) at++
      links[at]![1](root)
    })(root, app)
  }

const typed = (text: string) => (root: HTMLElement) => {
  void root
  const field = searchField()
  if (field && field.value !== text) typeInto(field, text)
}
const foundOnPages: Link = [
  root => pagesOfFound(root) && searchField()?.value === SCOPE_QUERY,
  typed(SCOPE_QUERY),
]
const foundChecked: Link = [
  root => headChecked(root) && selectedCount().includes(String(FOUND)),
  checkHead,
]
const nextPageSelected: Link = [
  root =>
    pageStart(root) === String(SCOPE_PAGE + 1) &&
    orderedRows(root).every(selected),
  toPage(String(SCOPE_PAGE + 1)),
]

const SELECT_FOUND: readonly GuideStoryStep[] = [
  {
    title: 'Строки на страницах',
    hint: 'Таблица разбита на страницы по пять строк, ни одна строка не выбрана. Над таблицей — поле поиска.',
    props: () => ({ enableQuickSearch: true, quickSearchDebounceMs: 0 }),
  },
  {
    title: 'Пользователь нашёл строки',
    hint: 'Пользователь набрал город в поле поиска. Остались строки этого города — на двух страницах.',
    enter: searchFor(
      SCOPE_QUERY,
      root => pagesOfFound(root) && searchField()?.value === SCOPE_QUERY,
    ),
  },
  {
    title: 'Пользователь выбрал все найденные',
    hint: 'Пользователь отметил флажок в заголовке. Выбраны все найденные строки — и на другой странице; нижняя панель называет их число.',
    states: ['body.selection'],
    enter: chain(foundOnPages, foundChecked),
  },
  {
    title: 'Пользователь перешёл на другую страницу',
    hint: 'Найденные строки следующей страницы тоже выбраны, флажок в заголовке остаётся отмеченным.',
    states: ['body.selection'],
    enter: chain(foundOnPages, foundChecked, nextPageSelected),
  },
  {
    title: 'Пользователь очистил поиск',
    hint: 'Пользователь очистил поле поиска. Видны все строки; выбраны только найденные, нижняя панель называет то же число.',
    states: ['body.selection'],
    enter: chain(foundOnPages, foundChecked, nextPageSelected, [
      root =>
        !pagesOfFound(root) &&
        searchField()?.value === '' &&
        selectedCount().includes(String(FOUND)),
      () => byTestId('quick-search-clear')?.click(),
    ]),
  },
]

/** ADR 0179, S1: пользователь находит строки поиском и выбирает все найденные. */
export const RowsSelectionSelectAllFiltered: StoryObj<StoryProps> = {
  name: 'Select all found rows',
  parameters: { scenario: '0179/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор всех найденных строк"
      steps={SELECT_FOUND}
      args={guideArgs(SCOPE_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_FOUND[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(orderedRows(canvas).some(selected)).toBe(false))
    })
    await step(SELECT_FOUND[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pagesOfFound(canvas)).toBe(true))
    })
    await step(SELECT_FOUND[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(selectedCount()).toContain(String(FOUND)))
      await until(() => expect(orderedRows(canvas).every(selected)).toBe(true))
    })
    await step(SELECT_FOUND[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pageStart(canvas)).toBe(String(SCOPE_PAGE + 1)))
      await until(() => expect(orderedRows(canvas).every(selected)).toBe(true))
      await until(() => expect(headChecked(canvas)).toBe(true))
    })
    await step(SELECT_FOUND[4]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pagesOfFound(canvas)).toBe(false))
      await until(() => expect(orderedRows(canvas).every(selected)).toBe(false))
      await until(() => expect(selectedCount()).toContain(String(FOUND)))
      await settle()
    })
  },
}

const SELECT_PAGE: readonly GuideStoryStep[] = [
  {
    title: 'Строки на страницах',
    hint: 'Флажок в заголовке выбирает строки только текущей страницы. Ни одна строка не выбрана.',
    props: () => ({ rowSelectionSelectAll: 'currentPage' }),
  },
  {
    title: 'Пользователь выбрал строки страницы',
    hint: 'Пользователь отметил флажок в заголовке. Выбраны пять строк этой страницы, нижняя панель называет их число.',
    states: ['body.selection'],
    enter: untilDone(headChecked, checkHead),
  },
  {
    title: 'Пользователь перешёл на другую страницу',
    hint: 'Строки следующей страницы не выбраны, флажок в заголовке не отмечен. Выбор первой страницы сохранился.',
    enter: untilDone(
      root =>
        pageStart(root) === String(SCOPE_PAGE + 1) &&
        orderedRows(root).length > 0 &&
        !orderedRows(root).some(selected),
      toPage(String(SCOPE_PAGE + 1)),
    ),
  },
]

/** ADR 0179, S2: разработчик ограничивает «Выбрать всё» текущей страницей. */
export const RowsSelectionSelectAllCurrentPage: StoryObj<StoryProps> = {
  name: 'Select all on the page',
  parameters: { scenario: '0179/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор строк страницы"
      steps={SELECT_PAGE}
      args={guideArgs(SCOPE_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SELECT_PAGE[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(orderedRows(canvas).some(selected)).toBe(false)
    })
    await step(SELECT_PAGE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(headChecked(canvas)).toBe(true))
      await expect(orderedRows(canvas).every(selected)).toBe(true)
      await expect(selectedCount()).toContain(String(SCOPE_PAGE))
    })
    await step(SELECT_PAGE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pageStart(canvas)).toBe(String(SCOPE_PAGE + 1)))
      await expect(orderedRows(canvas).some(selected)).toBe(false)
      await expect(headChecked(canvas)).toBe(false)
      await settle()
    })
  },
}

// --- ADR 0185, S1–S3 -----------------------------------------------------------------

const GROUP_ROWS = Array.from({ length: 12 }, (_, i) => ({
  id: `task-${i}`,
  team: i < 6 ? 'Alpha' : 'Beta',
  city: i % 2 ? 'Paris' : 'Rome',
  name: `Task ${i + 1}`,
}))
const GROUP_COLUMNS = [
  { id: 'team', accessorKey: 'team', header: 'Team', enableGrouping: true },
  { id: 'city', accessorKey: 'city', header: 'City', enableGrouping: true },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]
const GROUP_GRID = {
  columnsOverride: GROUP_COLUMNS,
  dataOverride: GROUP_ROWS,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableRowGrouping: true,
  initialGrouping: ['team'],
  enableRowExpanding: true,
  initialExpanded: true,
  containerHeight: '620',
  height: '520',
  maxHeight: '520',
} satisfies Partial<StoryProps>
const ALPHA = 'team:Alpha'
const IN_ALPHA = 'task-1'
const HIDDEN_IN_ALPHA = 'task-0'
const GROUP_QUERY = 'Paris'

const flagOf = (root: HTMLElement, id: string) =>
  checkboxOf(bodyRow(root, id))?.getAttribute('aria-checked')
const pressFlag = (root: HTMLElement, id: string) =>
  checkboxOf(bodyRow(root, id))?.click()
const selectAlpha = (root: HTMLElement) => {
  if (flagOf(root, ALPHA) !== 'true') pressFlag(root, ALPHA)
}
const groupedBy = (root: HTMLElement, column: string) =>
  orderedRows(root).some(row => row.dataset.rowId?.startsWith(`${column}:`))
/** Пользователь снимает группировку другой колонки и группирует по этой. */
const groupBy = (column: string, other: string) => (root: HTMLElement) => {
  const button = (id: string) =>
    headCell(root, id)?.querySelector<HTMLElement>('.column-group__button')
  if (groupedBy(root, other)) button(other)?.click()
  else if (!groupedBy(root, column)) button(column)?.click()
}

const GROUP_SELECT: readonly GuideStoryStep[] = [
  {
    title: 'Строки сгруппированы',
    hint: 'Строки разбиты на группы, ничего не выбрано.',
  },
  {
    title: 'Пользователь выбрал группу',
    hint: 'Пользователь отметил флажок группы. Выбраны все её строки, счётчик показывает их число.',
    states: ['body.selection'],
    enter: untilDone(root => flagOf(root, ALPHA) === 'true', selectAlpha),
  },
  {
    title: 'Пользователь снял одну строку',
    hint: 'Строка вышла из выбора. Флажок группы стал частичным, остальные строки группы выбраны.',
    states: ['body.selection'],
    enter: untilDone(
      root => flagOf(root, ALPHA) === 'mixed',
      root => {
        if (flagOf(root, ALPHA) === 'true') pressFlag(root, IN_ALPHA)
        else if (flagOf(root, ALPHA) === 'false') selectAlpha(root)
      },
    ),
  },
]

/** ADR 0185, S1: пользователь выбирает группу целиком и снимает одну её строку. */
export const GroupSelection: StoryObj<StoryProps> = {
  name: 'Select a group',
  parameters: { scenario: '0185/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор группы"
      steps={GROUP_SELECT}
      args={guideArgs(GROUP_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_SELECT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('false'))
    })
    await step(GROUP_SELECT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('true'))
      await expect(selectedCount()).toContain('6')
      await expect(selected(bodyRow(canvas, ALPHA))).toBe(true)
    })
    await step(GROUP_SELECT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('mixed'))
      await expect(selectedCount()).toContain('5')
      await settle()
    })
  },
}

const GROUP_FILTERED: readonly GuideStoryStep[] = [
  {
    title: 'Строки сгруппированы',
    hint: 'Строки разбиты на группы, ничего не выбрано.',
    props: () => ({ enableQuickSearch: true, quickSearchDebounceMs: 0 }),
  },
  {
    title: 'Пользователь нашёл строки',
    hint: 'Пользователь набрал город в поле поиска. В группах остались только найденные строки.',
    enter: searchFor(GROUP_QUERY, root => !bodyRow(root, HIDDEN_IN_ALPHA)),
  },
  {
    title: 'Пользователь выбрал группу',
    hint: 'Пользователь отметил флажок группы. Выбраны только показанные строки группы.',
    states: ['body.selection'],
    enter: untilDone(
      root =>
        searchField()?.value === GROUP_QUERY && flagOf(root, ALPHA) === 'true',
      root => {
        const field = searchField()
        if (field && field.value !== GROUP_QUERY) {
          typeInto(field, GROUP_QUERY)
        } else if (!bodyRow(root, HIDDEN_IN_ALPHA)) {
          selectAlpha(root)
        }
      },
    ),
  },
  {
    title: 'Пользователь очистил поиск',
    hint: 'Скрытые поиском строки вернулись невыбранными, поэтому флажок группы стал частичным.',
    states: ['body.selection'],
    enter: chain(
      [
        root =>
          searchField()?.value === GROUP_QUERY &&
          !bodyRow(root, HIDDEN_IN_ALPHA),
        typed(GROUP_QUERY),
      ],
      [root => flagOf(root, ALPHA) === 'true', selectAlpha],
      [root => flagOf(root, ALPHA) === 'mixed', typed('')],
    ),
  },
]

/** ADR 0185, S2: группа выбирается при поиске — выбраны только показанные строки. */
export const GroupSelectFiltered: StoryObj<StoryProps> = {
  name: 'Select a group while searching',
  parameters: { scenario: '0185/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор группы при поиске"
      steps={GROUP_FILTERED}
      args={guideArgs(GROUP_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_FILTERED[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(bodyRow(canvas, HIDDEN_IN_ALPHA)).toBeTruthy())
    })
    await step(GROUP_FILTERED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(bodyRow(canvas, HIDDEN_IN_ALPHA)).toBeFalsy())
    })
    await step(GROUP_FILTERED[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('true'))
      await until(() => expect(selectedCount()).toContain('3'))
    })
    await step(GROUP_FILTERED[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('mixed'))
      await until(() =>
        expect(selected(bodyRow(canvas, HIDDEN_IN_ALPHA))).toBe(false),
      )
      await until(() => expect(selectedCount()).toContain('3'))
      await settle()
    })
  },
}

const GROUP_REGROUP: readonly GuideStoryStep[] = [
  {
    title: 'Строки сгруппированы',
    hint: 'Строки разбиты на группы по одной колонке, ничего не выбрано.',
  },
  {
    title: 'Пользователь выбрал группу',
    hint: 'Пользователь отметил флажок группы. Выбраны все её строки.',
    states: ['body.selection'],
    enter: untilDone(
      root => groupedBy(root, 'team') && flagOf(root, ALPHA) === 'true',
      root => {
        groupBy('team', 'city')(root)
        if (groupedBy(root, 'team')) selectAlpha(root)
      },
    ),
  },
  {
    title: 'Пользователь сгруппировал по другой колонке',
    hint: 'Группы стали другими, но выбор остался: те же строки выбраны и в новых группах, их флажки частичные.',
    states: ['body.selection'],
    enter: chain(
      [
        root => groupedBy(root, 'team') && flagOf(root, ALPHA) === 'true',
        root => {
          groupBy('team', 'city')(root)
          if (groupedBy(root, 'team')) selectAlpha(root)
        },
      ],
      [
        root =>
          groupedBy(root, 'city') &&
          !groupedBy(root, 'team') &&
          selectedCount().includes('6'),
        groupBy('city', 'team'),
      ],
    ),
  },
]

/** ADR 0185, S3: пользователь меняет группировку — выбор остаётся. */
export const GroupSelectRegroup: StoryObj<StoryProps> = {
  name: 'Change grouping with a selection',
  parameters: { scenario: '0185/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Смена группировки"
      steps={GROUP_REGROUP}
      args={guideArgs(GROUP_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_REGROUP[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('false'))
    })
    await step(GROUP_REGROUP[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flagOf(canvas, ALPHA)).toBe('true'))
    })
    await step(GROUP_REGROUP[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(groupedBy(canvas, 'city')).toBe(true))
      await until(() => expect(selectedCount()).toContain('6'))
      await until(() => expect(flagOf(canvas, 'city:Paris')).toBe('mixed'))
      await settle()
    })
  },
}
