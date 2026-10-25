import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes } from './__mocks__/catalog'
import {
  optionFilteringColumns,
  optionFilteringData,
} from './__mocks__/filteringData'
import { expect } from 'storybook/test'
import {
  firstRowText,
  guideNext,
  headCell,
  orderedRows,
  releaseFocus,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/**
 * Сортировка колонок (ADR 0012, ADR 0063): `Playground` — кнопки в заголовках; несколько колонок,
 * по подписи вариантов; модель без кнопок — порядок задаёт приложение (ADR 0120).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Sorting',
} satisfies Meta<StoryProps>

export default meta

export const ColumnSortingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
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

// --- ADR 0012, S1 --------------------------------------------------------------------

const sortButtonOf = (root: ParentNode, column: string) =>
  headCell(root as HTMLElement, column)?.querySelector<HTMLElement>(
    '.column-sort__button',
  ) ?? null
const sortOf = (root: ParentNode, column: string) =>
  headCell(root as HTMLElement, column)?.getAttribute('aria-sort') ?? 'none'
const sorted = (root: ParentNode, column: string) =>
  /^(ascending|descending)$/.test(sortOf(root, column))
/** Номер колонки в порядке сортировки — число на её кнопке. */
const priorityOf = (root: ParentNode, column: string) =>
  headCell(root as HTMLElement, column)
    ?.querySelector('[data-active-indicator][data-count]')
    ?.getAttribute('data-count') ?? null
const openTooltip = () =>
  [...document.querySelectorAll<HTMLElement>('[role="tooltip"], [data-side]')]
    .map(el => el.textContent?.trim() ?? '')
    .find(Boolean) ?? ''

/** Указатель над кнопкой сортировки, как при наведении мышью. */
const hover = (button: HTMLElement) => {
  const box = button.getBoundingClientRect()
  const at = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
  }
  const enter = { ...at, relatedTarget: document.body }
  button.dispatchEvent(new PointerEvent('pointerover', enter))
  button.dispatchEvent(new MouseEvent('mouseover', enter))
  button.dispatchEvent(new PointerEvent('pointermove', at))
  button.dispatchEvent(new MouseEvent('mousemove', at))
}
/** Указатель ушёл с кнопок сортировки: подсказка закрывается. */
const leave = (root: HTMLElement) => {
  for (const button of root.querySelectorAll<HTMLElement>(
    '.column-sort__button',
  )) {
    const out = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerType: 'mouse',
      relatedTarget: document.body,
    }
    button.dispatchEvent(new PointerEvent('pointerout', out))
    button.dispatchEvent(new MouseEvent('mouseout', out))
  }
}
/** Наведение один раз: повтор сбивал бы задержку появления подсказки. */
const hoverOnce = (column: string) => {
  let hovered = false
  return (root: HTMLElement) => {
    const button = sortButtonOf(root, column)
    if (hovered || !button) return
    hover(button)
    hovered = true
  }
}
/** Нажатие кнопки сортировки; с Shift — добавить колонку к сортировке. */
const press = (button: HTMLElement | null, shiftKey = false) =>
  button?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey }),
  )

/** Пользователь сортирует по стране, если ещё не отсортировано. */
const sortByCountry = (root: HTMLElement) => {
  leave(root)
  if (!sorted(root, 'country')) press(sortButtonOf(root, 'country'))
}

const MULTI_SORT: readonly GuideStoryStep[] = [
  {
    title: 'Таблица без сортировки',
    hint: 'Строки идут в порядке данных, в заголовках — кнопки сортировки.',
  },
  {
    title: 'Пользователь навёл указатель на кнопку сортировки',
    hint: 'Подсказка у кнопки называет, что сделает нажатие.',
    states: ['overlay.tooltip'],
    enter: (root, app) =>
      untilDone(() => !!openTooltip(), hoverOnce('country'))(root, app),
  },
  {
    title: 'Пользователь отсортировал по стране',
    hint: 'Строки упорядочены по стране, кнопка в заголовке показывает направление.',
    enter: untilDone(root => sorted(root, 'country'), sortByCountry),
  },
  {
    title: 'Пользователь добавил вторую колонку',
    hint: 'С зажатой клавишей Shift пользователь нажал кнопку сортировки имени. Строки упорядочены по стране, а внутри одной страны — по имени. На кнопке второй колонки — её номер в порядке сортировки.',
    states: ['head.sorting'],
    enter: untilDone(
      root => sorted(root, 'country') && sorted(root, 'firstName'),
      root => {
        leave(root)
        if (!sorted(root, 'country')) sortByCountry(root)
        else press(sortButtonOf(root, 'firstName'), true)
      },
    ),
  },
]

/** ADR 0012, S1: пользователь сортирует по двум колонкам — вторая с номером приоритета. */
export const ColumnMultiSorting: StoryObj<StoryProps> = {
  name: 'Multi-sort',
  // Конец сценария — отсортировано по двум колонкам: снимок во всех режимах (ADR 0093).
  tags: ['vr-modes'],
  parameters: vrModes({ scenario: '0012/S1', ...guideControls() }),
  render: args => (
    <GuideStory
      title="Сортировка по нескольким колонкам"
      steps={MULTI_SORT}
      args={guideArgs(
        {
          enableColumnSorting: true,
          columnSortingMultiSort: true,
          dataCount: 20,
          containerHeight: '400',
          height: '300',
          maxHeight: '300',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(MULTI_SORT[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(sortButtonOf(canvas, 'country')).not.toBeNull()
      await expect(sorted(canvas, 'country')).toBe(false)
    })
    await step(MULTI_SORT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect([labels.sortAscending, labels.sortDescending]).toContain(
          openTooltip(),
        ),
      )
      await settle()
    })
    await step(MULTI_SORT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(sorted(canvas, 'country')).toBe(true))
      await expect(sorted(canvas, 'firstName')).toBe(false)
    })
    await step(MULTI_SORT[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priorityOf(canvas, 'firstName')).toBe('2'))
      await expect(sorted(canvas, 'country')).toBe(true)
      await releaseFocus()
      await settle()
    })
  },
}

// --- ADR 0063, S1 --------------------------------------------------------------------

const cellsOf = (root: HTMLElement, column: string) =>
  orderedRows(root).map(
    row =>
      row.querySelector(`[data-column-id="${column}"]`)?.textContent?.trim() ??
      '',
  )
const statusLabels = (
  optionFilteringColumns.find(column => column.id === 'status') as {
    options?: { label: string }[]
  }
).options!.map(option => option.label)
/** Подписи идут в порядке вариантов списка — в одну или в другую сторону. */
const inOptionOrder = (labels: string[], order: string[]) => {
  const ranks = labels.map(label => order.indexOf(label))
  const up = ranks.every((rank, i) => i === 0 || ranks[i - 1]! <= rank)
  const down = ranks.every((rank, i) => i === 0 || ranks[i - 1]! >= rank)
  return ranks.every(rank => rank >= 0) && (up || down)
}
const byName = (names: string[]) => {
  const up = names.every(
    (name, i) => i === 0 || names[i - 1]!.localeCompare(name) <= 0,
  )
  const down = names.every(
    (name, i) => i === 0 || names[i - 1]!.localeCompare(name) >= 0,
  )
  return names.length > 1 && (up || down)
}

const OPTION_LABELS: readonly GuideStoryStep[] = [
  {
    title: 'Колонки с вариантами',
    hint: 'Статус берёт значения из списка вариантов, менеджер — из справочника. В ячейках — подписи, а хранятся коды.',
  },
  {
    title: 'Пользователь отсортировал статус',
    hint: 'Строки идут в порядке вариантов списка, а не по алфавиту подписей. Первое нажатие сортирует по убыванию: первым — последний вариант.',
    enter: untilDone(
      root => sorted(root, 'status'),
      root => press(sortButtonOf(root, 'status')),
    ),
  },
  {
    title: 'Пользователь отсортировал менеджера',
    hint: 'Строки упорядочены по имени менеджера из справочника, а не по коду.',
    enter: untilDone(
      root => sorted(root, 'managerId'),
      root => press(sortButtonOf(root, 'managerId')),
    ),
  },
]

/** ADR 0063, S1: колонки с вариантами сортируются по подписи, а не по коду. */
export const ColumnSortingOptionLabels: StoryObj<StoryProps> = {
  name: 'Option labels',
  parameters: {
    scenario: '0063/S1',
    requirements: ['OS12'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Сортировка по подписи вариантов"
      steps={OPTION_LABELS}
      args={guideArgs(
        {
          enableColumnSorting: true,
          columnsOverride: optionFilteringColumns,
          dataOverride: optionFilteringData,
          containerHeight: '400',
          height: '300',
          maxHeight: '300',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OPTION_LABELS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(firstRowText(canvas, 'managerId')).not.toMatch(/^m[0-9]+$/)
    })
    await step(OPTION_LABELS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'status')).toBe(statusLabels.at(-1)),
      )
      await expect(
        inOptionOrder(cellsOf(canvas, 'status').filter(Boolean), statusLabels),
      ).toBe(true)
    })
    await step(OPTION_LABELS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(byName(cellsOf(canvas, 'managerId').filter(Boolean))).toBe(true),
      )
      await settle()
    })
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
    hint: 'Сортировкой управляет приложение, у таблицы нет своих кнопок сортировки. Строки идут в порядке данных.',
    props: () => ({ enableColumnSortingModel: true }),
  },
  {
    title: 'Приложение сортирует по возрасту',
    hint: 'Пользователь нажал кнопку сортировки в интерфейсе приложения. Таблица показывает строки по возрастанию возраста, кнопок сортировки в заголовках по-прежнему нет.',
    props: () => ({ columnSortingModelSorting: [{ id: 'age', desc: false }] }),
  },
  {
    title: 'Приложение сортирует по убыванию',
    hint: 'Приложение сменило направление сортировки. Таблица заново упорядочивает строки по убыванию возраста.',
    props: () => ({ columnSortingModelSorting: [{ id: 'age', desc: true }] }),
  },
]

/** ADR 0120, S1: приложение сортирует своими кнопками вне грида — модель без интерфейса. */
export const SortingExternalControls: StoryObj<StoryProps> = {
  name: 'External controls',
  parameters: {
    scenario: '0120/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Сортировка кнопками приложения"
      steps={EXTERNAL_SORTING}
      args={guideArgs(
        {
          dataCount: 20,
          containerHeight: '400',
          height: '300',
          maxHeight: '300',
        },
        args,
      )}
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
