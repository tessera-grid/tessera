import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { pressCell, untilDone } from './__mocks__/cellGestures'
import { makeData } from './__mocks__/data'
import {
  bodyRow,
  byTestId,
  guideNext,
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
 * S5 ADR 0120; каждая строка дерева сама — S2 ADR 0162.
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
const batchButton = () =>
  byTestId('batch-toolbar')?.querySelector<HTMLButtonElement>('button') ?? null
const allSelected = () => !!batchButton()?.textContent?.includes(String(ROWS))

/** Пользователь отмечает флажок в заголовке, пока строки страницы не выбраны. */
const selectPage = (root: HTMLElement) => {
  if (!pageSelected(root)) headCheckbox(root)?.click()
}
/** Пользователь выбирает все строки кнопкой приложения. */
const selectAll = (root: HTMLElement) => {
  if (!pageSelected(root)) selectPage(root)
  else if (!allSelected()) batchButton()?.click()
}

const ALL_ROWS: readonly GuideStoryStep[] = [
  {
    title: 'Строки не выбраны',
    hint: 'Таблица разбита на страницы, ни одна строка не выбрана.',
    // Приложение хранит признак «выбраны все» и обновляет его по кнопке.
    props: ({ app }) => ({
      updateArgs: change => app.update(prev => ({ ...prev, ...change })),
    }),
  },
  {
    title: 'Пользователь выбрал строки на странице',
    hint: 'Пользователь отметил флажок в заголовке. Выбраны строки текущей страницы, приложение предлагает выбрать все строки.',
    states: ['body.selection'],
    enter: untilDone(pageSelected, selectPage),
  },
  {
    title: 'Пользователь выбрал все строки',
    hint: 'Выбраны все строки таблицы, приложение показывает их число.',
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
          showBatchToolbar: true,
          isAllRowsSelected: false,
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
      await until(() => expect(pageSelected(canvas)).toBe(true))
      await expect(batchButton()).not.toBeNull()
      await expect(allSelected()).toBe(false)
    })
    await step(ALL_ROWS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(allSelected()).toBe(true))
      await expect(pageSelected(canvas)).toBe(true)
    })
    await step(ALL_ROWS[3]!.title, async () => {
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
