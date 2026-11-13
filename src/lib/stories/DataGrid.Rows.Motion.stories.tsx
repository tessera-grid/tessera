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
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

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

const TREE: readonly GuideStoryStep[] = [
  {
    title: 'Дерево свёрнуто',
    hint: 'Строки с детьми свёрнуты.',
  },
  {
    title: 'Пользователь раскрыл строку',
    hint: 'Дети въехали под строку, строки ниже плавно сдвинулись вниз.',
    enter: untilDone(
      root => expanded(root) && childShown(root),
      root => {
        if (!expanded(root)) toggle(root)?.click()
      },
    ),
  },
  {
    title: 'Пользователь свернул строку',
    hint: 'Дети ушли, строки ниже плавно поднялись на их место.',
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
    <GuideStory
      title="Раскрытие и сворачивание"
      steps={TREE}
      args={guideArgs(
        { ...GRID, dataNesting: 'nested', enableRowExpanding: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggle(canvas)).toBeTruthy())
      await expect(childShown(canvas)).toBe(false)
    })
    await step(TREE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(childShown(canvas)).toBe(true))
      await settle()
    })
    await step(TREE[2]!.title, async () => {
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

const SORT_SEARCH: readonly GuideStoryStep[] = [
  {
    title: 'Строки в порядке данных',
    hint: 'Таблица без сортировки и поиска.',
  },
  {
    title: 'Пользователь отсортировал по имени',
    hint: 'Строки плавно переехали на новые места.',
    enter: untilDone(sorted, sortByName),
  },
  {
    title: 'Пользователь ищет',
    hint: 'Строки без совпадений погасли, оставшиеся сдвинулись вверх.',
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
    <GuideStory
      title="Сортировка и поиск"
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
    await step(SORT_SEARCH[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(sorted(canvas)).toBe(false))
      await until(() => expect(isAscending(namesOf(canvas))).toBe(false))
    })
    await step(SORT_SEARCH[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isAscending(namesOf(canvas))).toBe(true))
      await settle()
      rows = modelRows()
    })
    await step(SORT_SEARCH[2]!.title, async () => {
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

const DELETE: readonly GuideStoryStep[] = [
  {
    title: 'Строки на своих местах',
    hint: 'Таблица показывает данные приложения.',
  },
  {
    title: 'Приложение удалило строку',
    hint: 'Строки больше нет в данных. Она погасла на своём месте, затем строки ниже плавно поднялись и закрыли щель.',
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
    <GuideStory
      title="Удаление строки"
      steps={DELETE}
      args={guideArgs(GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DELETE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(bodyRow(canvas, REMOVED)).toBeTruthy())
    })
    await step(DELETE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(bodyRow(canvas, REMOVED)).toBeFalsy())
      await until(() => expect(ghost(canvas)).toBeNull())
      await until(() => expect(bodyRow(canvas, NEXT)).toBeTruthy())
      await settle()
    })
  },
}
