import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import {
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'
import { expect, waitFor, userEvent } from 'storybook/test'
import {
  expectPopupInCanvas,
  firstRowText,
  guideNext,
  headCell,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Сортировка колонок (ADR 0012, ADR 0063): одна и несколько колонок, без снятия, по подписи
 * вариантов; модель без кнопок — порядок задаёт приложение (ADR 0120).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Sorting',
} satisfies Meta<StoryProps>

export default meta

export const ColumnSorting: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
  ]),
  args: {
    enableColumnSorting: true,
    // Sized to overflow vertically so the row-ordering requirements (CS12–CS13)
    // have enough rendered rows to prove the sort order against.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

export const ColumnSortingNotRemovable: StoryObj<StoryProps> = {
  name: 'Not removable',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
  ]),
  args: {
    enableColumnSorting: true,
    columnSortingRemoval: false,
  },
}

export const ColumnMultiSorting: StoryObj<StoryProps> = {
  name: 'Multi-sort',
  parameters: showControls([
    'enableColumnSorting',
    'columnSortingRemoval',
    'columnSortingMultiSort',
    'columnSortingServer',
    'columnSortingRevertOnReject',
  ]),
  args: {
    enableColumnSorting: true,
    columnSortingMultiSort: true,
    // Shift+клик по нескольким заголовкам добавляет столбцы к сортировке; у
    // каждого отсортированного столбца в шапке виден порядковый бейдж приоритета.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

export const ColumnSortingOptionLabels: StoryObj<StoryProps> = {
  name: 'Option labels',
  args: {
    enableColumnSorting: true,
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
    // «Status» сортируется в порядке вариантов, «Tags» — поэлементно, «Manager» — по
    // имени из справочника, а не по id. С группировкой в том же порядке идут группы.
  },
  // Сценарий истории (ADR 0063, OS12): Manager — имена, Status — в порядке вариантов.
  parameters: {
    requirements: ['OS12'],
    ...showControls([
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
    ]),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    expect(firstRowText(canvasElement, 'managerId')).not.toMatch(/^m[0-9]+$/)
    const sort = () =>
      headCell(canvasElement, 'status').querySelector<HTMLElement>(
        '.column-sort__button',
      )!
    // Первое нажатие — по убыванию (sortDescFirst таблицы): последний вариант — первым.
    await userEvent.click(sort())
    await until(() =>
      expect(firstRowText(canvasElement, 'status')).toBe('Lost'),
    )
    await userEvent.click(sort())
    await until(() =>
      expect(firstRowText(canvasElement, 'status')).toBe('Lead'),
    )
    await settle()
  },
}

/** Отсортировано по двум колонкам (ADR 0093, VR5): номер приоритета у второй. */
export const SortingStateSorted: StoryObj<StoryProps> = {
  name: 'State: sorted',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes(vrStates('head.sorting')),
    ...showControls([
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
    ]),
  },
  args: {
    enableColumnSorting: true,
    columnSortingMultiSort: true,
    dataCount: 20,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const sort = (column: string) =>
      headCell(canvasElement, column).querySelector<HTMLElement>(
        '.column-sort__button',
      )!
    // Один экземпляр: Shift держится между нажатием клавиши и кликом.
    const user = userEvent.setup()
    await user.click(sort('country'))
    await user.keyboard('{Shift>}')
    await user.click(sort('firstName'))
    await user.keyboard('{/Shift}')
    await waitFor(() =>
      expect(
        headCell(canvasElement, 'firstName').querySelector(
          '.column-sort__priority',
        ),
      ).not.toBeNull(),
    )
    await settle()
  },
}

/** Тултип кнопки шапки (ADR 0093, VR6). */
export const SortingStateTooltip: StoryObj<StoryProps> = {
  name: 'State: tooltip',
  parameters: {
    ...vrStates('overlay.tooltip'),
    ...showControls([
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
    ]),
  },
  args: {
    enableColumnSorting: true,
    dataCount: 20,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const head = headCell(canvasElement, 'country')
    await userEvent.hover(head)
    await userEvent.hover(
      head.querySelector<HTMLElement>('.column-sort__button')!,
    )
    const tooltip = await waitFor(
      () => {
        const found = [
          ...document.querySelectorAll<HTMLElement>('[data-side]'),
        ].find(el => el.textContent?.trim())
        expect(found).toBeDefined()
        return found!
      },
      { timeout: 5000 },
    )
    await settle()
    expectPopupInCanvas(canvasElement, tooltip)
  },
}

// --- ADR 0120, S1 --------------------------------------------------------------------

/** Возрасты строк тела сверху вниз — порядок, который видит пользователь. */
const agesOf = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      '.data-grid__body-row [data-column-id="age"]',
    ),
  ].map(cell => Number(cell.textContent))

const isSorted = (values: number[], desc: boolean) =>
  values.every((value, index) =>
    index === 0
      ? true
      : desc
        ? values[index - 1]! >= value
        : values[index - 1]! <= value,
  )

const EXTERNAL_SORTING: readonly GuideStoryStep[] = [
  {
    title: 'Порядок данных',
    hint: 'Плагин columnSortingModel без columnSorting: в заголовках нет кнопок сортировки, строки — в порядке данных.',
    props: () => ({ enableColumnSortingModel: true }),
  },
  {
    title: 'Приложение сортирует по возрасту',
    hint: 'Своя кнопка приложения задаёт срез sorting аргументом модели — строки по возрастанию возраста, кнопок в гриде по-прежнему нет.',
    props: () => ({ columnSortingModelSorting: [{ id: 'age', desc: false }] }),
  },
  {
    title: 'По убыванию',
    hint: 'Приложение меняет направление — грид упорядочивает строки заново.',
    props: () => ({ columnSortingModelSorting: [{ id: 'age', desc: true }] }),
  },
]

/** ADR 0120, S1: приложение сортирует своими кнопками вне грида — модель без интерфейса. */
export const SortingExternalControls: StoryObj<StoryProps> = {
  name: 'External controls',
  parameters: {
    scenario: '0120/S1',
    ...showControls(['enableColumnSortingModel', 'columnSortingModelServer']),
  },
  args: {
    dataCount: 20,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  render: args => (
    <GuideStory
      title="Сортировка кнопками приложения"
      steps={EXTERNAL_SORTING}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(EXTERNAL_SORTING[0].title, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-sort__button')).toBeNull()
    })
    await step(EXTERNAL_SORTING[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(isSorted(agesOf(canvas), false)).toBe(true))
      expect(canvas.querySelector('.column-sort__button')).toBeNull()
    })
    await step(EXTERNAL_SORTING[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(isSorted(agesOf(canvas), true)).toBe(true))
    })
    await settle()
  },
}
