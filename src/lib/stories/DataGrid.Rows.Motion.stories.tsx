import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  bodyRow,
  guideNext,
  headCell,
  orderedRows,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'

/**
 * Движение строк (ADR 0107): раскрытие, сортировка, поиск и перестановка двигают строки
 * к новым местам, уходящие гаснут. `Playground` — функции и флаг движения; S1 —
 * раскрытие и сворачивание, S2 — сортировка и поиск, S3 — удаление строки.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Motion',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: '520',
  height: '440',
  maxHeight: '440',
  dataCount: 60,
} satisfies Partial<StoryProps>

/** Раскройте строку, отсортируйте, найдите или перетащите — строки едут к новым местам. */
export const RowMotionPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableRowAnimation',
    'dataNesting',
    'enableRowExpanding',
    'enableTreeLines',
    'enableColumnSorting',
    'enableQuickSearch',
    'enableColumnFiltering',
    'enableRowDragging',
  ]),
  args: {
    ...GRID,
    dataNesting: 'nested',
    enableRowExpanding: true,
    enableColumnSorting: true,
  },
}

const ghost = (root: ParentNode) => root.querySelector('[data-row-ghost]')

// --- S1 ------------------------------------------------------------------------------

const PARENT = 'item-id-0'
const CHILD = 'item-id-0-0'

const toggle = (root: HTMLElement) =>
  bodyRow(root, PARENT)?.querySelector<HTMLElement>('.row-expand-button')
const expanded = (root: HTMLElement) =>
  bodyRow(root, PARENT)?.getAttribute('data-expanded') === 'true'
const childShown = (root: HTMLElement) => !!bodyRow(root, CHILD)

const TREE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Дерево свёрнуто', en: 'The tree is collapsed' },
    hint: {
      ru: 'Строки с детьми свёрнуты.',
      en: 'Rows with child rows are collapsed.',
    },
  },
  {
    title: { ru: 'Пользователь раскрыл строку', en: 'The user expanded a row' },
    hint: {
      ru: 'Дети въехали под строку, строки ниже плавно сдвинулись вниз.',
      en: 'The child rows slid in under the row, and the rows below moved down smoothly.',
    },
    enter: untilDone(
      root => expanded(root) && childShown(root),
      root => {
        if (!expanded(root)) toggle(root)?.click()
      },
    ),
  },
  {
    title: {
      ru: 'Пользователь свернул строку',
      en: 'The user collapsed a row',
    },
    hint: {
      ru: 'Дети ушли, строки ниже плавно поднялись на их место.',
      en: 'The child rows left, and the rows below moved up smoothly into their place.',
    },
    enter: untilDone(
      root => !expanded(root) && !childShown(root),
      root => {
        if (expanded(root)) toggle(root)?.click()
      },
    ),
  },
]

/** S1: пользователь раскрывает и сворачивает строку — дети въезжают и уходят. */
export const RowMotionTree: StoryObj<StoryProps> = {
  name: 'Tree',
  parameters: {
    scenario: '0107/S1',
    requirements: ['RM21'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Раскрытие и сворачивание', en: 'Expand and collapse' }}
      steps={TREE}
      args={guideArgs(
        { ...GRID, dataNesting: 'nested', enableRowExpanding: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggle(canvas)).toBeTruthy())
      await expect(childShown(canvas)).toBe(false)
    })
    await step(TREE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(childShown(canvas)).toBe(true))
      await settle()
    })
    await step(TREE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(childShown(canvas)).toBe(false))
      await until(() => expect(ghost(canvas)).toBeNull())
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

const SORTED = 'firstName'
const QUERY = 'an'

const sortButton = (root: HTMLElement) =>
  headCell(root, SORTED)?.querySelector<HTMLElement>('.column-sort__button')
const sorted = (root: HTMLElement) =>
  headCell(root, SORTED)?.getAttribute('aria-sort') === 'ascending'
const searchField = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const namesOf = (root: HTMLElement) =>
  orderedRows(root).map(
    row =>
      row.querySelector(`[data-column-id="${SORTED}"]`)?.textContent?.trim() ??
      '',
  )

/** Пользователь сортирует по имени: нажимает кнопку, пока порядок не станет прямым. */
const sortByName = (root: HTMLElement) => {
  if (!sorted(root)) sortButton(root)?.click()
}

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (root: HTMLElement) => {
  const input = searchField(root)
  if (!input || input.value === QUERY) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, QUERY)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const SORT_SEARCH: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Строки в порядке данных', en: 'Rows in data order' },
    hint: {
      ru: 'Таблица без сортировки и поиска.',
      en: 'The table has no sorting or search.',
    },
  },
  {
    title: {
      ru: 'Пользователь отсортировал по имени',
      en: 'The user sorted by name',
    },
    hint: {
      ru: 'Строки плавно переехали на новые места.',
      en: 'The rows moved smoothly to their new places.',
    },
    enter: untilDone(sorted, sortByName),
  },
  {
    title: { ru: 'Пользователь ищет', en: 'The user searches' },
    hint: {
      ru: 'Строки без совпадений погасли, оставшиеся сдвинулись вверх.',
      en: 'Rows without matches faded out, and the remaining ones moved up.',
    },
    enter: untilDone(
      root => sorted(root) && searchField(root)?.value === QUERY,
      root => {
        sortByName(root)
        typeSearch(root)
      },
    ),
  },
]

/** S2: пользователь сортирует и ищет — строки переезжают, ушедшие гаснут. */
export const RowMotionSearch: StoryObj<StoryProps> = {
  name: 'Sort and search',
  parameters: {
    scenario: '0107/S2',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Сортировка и поиск', en: 'Sort and search' }}
      steps={SORT_SEARCH}
      args={guideArgs(
        { ...GRID, enableColumnSorting: true, enableQuickSearch: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const isAscending = (names: string[]) =>
      names.every(
        (name, i) => i === 0 || names[i - 1]!.localeCompare(name) <= 0,
      )
    // Строки модели, а не окна: окно после смены списка в покое, затем дорастает (ADR 0202, §1а).
    const modelRows = () =>
      Number(
        canvas.querySelector('[aria-rowcount]')?.getAttribute('aria-rowcount'),
      )
    let rows = 0
    await step(SORT_SEARCH[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(sorted(canvas)).toBe(false))
      await until(() => expect(isAscending(namesOf(canvas))).toBe(false))
    })
    await step(SORT_SEARCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(isAscending(namesOf(canvas))).toBe(true))
      await settle()
      rows = modelRows()
    })
    await step(SORT_SEARCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          orderedRows(canvas).every(row =>
            row.textContent?.toLowerCase().includes(QUERY),
          ),
        ).toBe(true),
      )
      await until(() => expect(ghost(canvas)).toBeNull())
      await until(() => expect(modelRows()).toBeLessThan(rows))
      await until(() => expect(isAscending(namesOf(canvas))).toBe(true))
      await settle()
    })
  },
}

// --- S3 ------------------------------------------------------------------------------

const REMOVED = 'item-id-3'
const NEXT = 'item-id-4'

const DELETE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Строки на своих местах', en: 'Rows in their places' },
    hint: {
      ru: 'Таблица показывает данные приложения.',
      en: "The table shows the app's data.",
    },
  },
  {
    title: { ru: 'Приложение удалило строку', en: 'The app deleted a row' },
    hint: {
      ru: 'Строки больше нет в данных. Она погасла на своём месте, затем строки ниже плавно поднялись и закрыли щель.',
      en: 'The row is no longer in the data. It faded out in place, then the rows below moved up smoothly and closed the gap.',
    },
    props: ({ rows }) => ({
      dataOverride: rows.filter(row => row.id !== REMOVED),
    }),
  },
]

/** S3: приложение удаляет строку из данных — она гаснет на месте, затем строки закрывают щель. */
export const RowMotionDelete: StoryObj<StoryProps> = {
  name: 'Delete a row',
  parameters: {
    scenario: '0107/S3',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Удаление строки', en: 'Deleting a row' }}
      steps={DELETE}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DELETE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(bodyRow(canvas, REMOVED)).toBeTruthy())
    })
    await step(DELETE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(bodyRow(canvas, REMOVED)).toBeFalsy())
      await until(() => expect(ghost(canvas)).toBeNull())
      await until(() => expect(bodyRow(canvas, NEXT)).toBeTruthy())
      await settle()
    })
  },
}
