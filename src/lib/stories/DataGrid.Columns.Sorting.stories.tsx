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
  consoleText,
  firstRowText,
  guideNext,
  headCell,
  headKebab,
  orderedRows,
  openMenuBy,
  pollUntil,
  pressEscape,
  releaseFocus,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { columnSortingLabels } from '../plugins/columnSorting/labels'

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
    'dataMode',
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

const MULTI_SORT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица без сортировки', en: 'The table is unsorted' },
    hint: {
      ru: 'Строки идут в порядке данных, в заголовках — кнопки сортировки.',
      en: 'Rows follow the data order, and the headers have sort buttons.',
    },
  },
  {
    title: {
      ru: 'Пользователь навёл указатель на кнопку сортировки',
      en: 'The user hovered over a sort button',
    },
    hint: {
      ru: 'Подсказка у кнопки называет, что сделает нажатие.',
      en: "The button's tooltip says what a click will do.",
    },
    states: ['overlay.tooltip'],
    enter: (root, app) =>
      untilDone(() => !!openTooltip(), hoverOnce('country'))(root, app),
  },
  {
    title: {
      ru: 'Пользователь отсортировал по стране',
      en: 'The user sorted by country',
    },
    hint: {
      ru: 'Строки упорядочены по стране, кнопка в заголовке показывает направление.',
      en: 'Rows are ordered by country, and the header button shows the direction.',
    },
    enter: untilDone(root => sorted(root, 'country'), sortByCountry),
  },
  {
    title: {
      ru: 'Пользователь добавил вторую колонку',
      en: 'The user added a second column',
    },
    hint: {
      ru: 'С зажатой клавишей Shift пользователь нажал кнопку сортировки имени. Строки упорядочены по стране, а внутри одной страны — по имени. На кнопке второй колонки — её номер в порядке сортировки.',
      en: "Holding Shift, the user clicked the sort button of the name column. Rows are ordered by country, and within each country by name. The second column's button shows its position in the sort order.",
    },
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
    <DemoStory
      title={{
        ru: 'Сортировка по нескольким колонкам',
        en: 'Sorting by several columns',
      }}
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
    await step(MULTI_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(sortButtonOf(canvas, 'country')).not.toBeNull()
      await expect(sorted(canvas, 'country')).toBe(false)
    })
    await step(MULTI_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect([
          columnSortingLabels(labels).sortAscending,
          columnSortingLabels(labels).sortDescending,
        ]).toContain(openTooltip()),
      )
      await settle()
    })
    await step(MULTI_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sorted(canvas, 'country')).toBe(true))
      await expect(sorted(canvas, 'firstName')).toBe(false)
    })
    await step(MULTI_SORT[3]!.title.ru, async () => {
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

const OPTION_LABELS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Колонки с вариантами', en: 'Columns with options' },
    hint: {
      ru: 'Статус берёт значения из списка вариантов, менеджер — из справочника. В ячейках — подписи, а хранятся коды.',
      en: 'The status column takes its values from a list of options, and the manager column from a lookup. Cells show labels, while codes are stored.',
    },
  },
  {
    title: {
      ru: 'Пользователь отсортировал статус',
      en: 'The user sorted the status column',
    },
    hint: {
      ru: 'Строки идут в порядке вариантов списка, а не по алфавиту подписей. Первое нажатие сортирует по убыванию: первым — последний вариант.',
      en: 'Rows follow the order of the options in the list, not the alphabetical order of labels. The first click sorts in descending order, so the last option comes first.',
    },
    enter: untilDone(
      root => sorted(root, 'status'),
      root => press(sortButtonOf(root, 'status')),
    ),
  },
  {
    title: {
      ru: 'Пользователь отсортировал менеджера',
      en: 'The user sorted the manager column',
    },
    hint: {
      ru: 'Строки упорядочены по имени менеджера из справочника, а не по коду.',
      en: "Rows are ordered by the manager's name from the lookup, not by code.",
    },
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
    <DemoStory
      title={{
        ru: 'Сортировка по подписи вариантов',
        en: 'Sorting by option labels',
      }}
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
    await step(OPTION_LABELS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(firstRowText(canvas, 'managerId')).not.toMatch(/^m[0-9]+$/)
    })
    await step(OPTION_LABELS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'status')).toBe(statusLabels.at(-1)),
      )
      await expect(
        inOptionOrder(cellsOf(canvas, 'status').filter(Boolean), statusLabels),
      ).toBe(true)
    })
    await step(OPTION_LABELS[2]!.title.ru, async () => {
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

const EXTERNAL_SORTING: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Порядок данных', en: 'Data order' },
    hint: {
      ru: 'Сортировкой управляет приложение, у таблицы нет своих кнопок сортировки. Строки идут в порядке данных.',
      en: 'The app controls sorting; the table has no sort buttons of its own. Rows follow the data order.',
    },
    props: () => ({ enableColumnSortingModel: true }),
  },
  {
    title: {
      ru: 'Приложение сортирует по возрасту',
      en: 'The app sorts by age',
    },
    hint: {
      ru: 'Пользователь нажал кнопку сортировки в интерфейсе приложения. Таблица показывает строки по возрастанию возраста, кнопок сортировки в заголовках по-прежнему нет.',
      en: "The user clicked a sort button in the app's interface. The table shows rows in ascending order of age; the headers still have no sort buttons.",
    },
    props: () => ({ columnSortingModelSorting: [{ id: 'age', desc: false }] }),
  },
  {
    title: {
      ru: 'Приложение сортирует по убыванию',
      en: 'The app sorts in descending order',
    },
    hint: {
      ru: 'Приложение сменило направление сортировки. Таблица заново упорядочивает строки по убыванию возраста.',
      en: 'The app switched the sort direction. The table reorders the rows in descending order of age.',
    },
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
    <DemoStory
      title={{
        ru: 'Сортировка кнопками приложения',
        en: "Sorting with the app's buttons",
      }}
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
    await step(EXTERNAL_SORTING[0].title.ru, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-sort__button')).toBeNull()
    })
    await step(EXTERNAL_SORTING[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(isSorted(agesOf(canvas), false)).toBe(true))
      expect(canvas.querySelector('.column-sort__button')).toBeNull()
    })
    await step(EXTERNAL_SORTING[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(isSorted(agesOf(canvas), true)).toBe(true))
    })
    await settle()
  },
}

// --- Добавить к сортировке (ADR 0231, S9) ---------------------------------------------

const ADD_SORT_ARGS = {
  enableColumnSorting: true,
  enableHeaderActionMenu: true,
  headerActionMenuMode: 'always',
  columnCount: 6,
  dataCount: 40,
  height: '420',
} satisfies Partial<StoryProps>

const sortItem = (item: string) =>
  document.querySelector<HTMLElement>(
    `[role="menu"] [data-action-id="columnSorting"][data-item-id="${item}"]`,
  )

/** Открыть меню колонки `column` и выбрать в нём пункт сортировки `item`. */
const pickSortItem = async (
  root: HTMLElement,
  column: string,
  item: string,
  signal: AbortSignal,
) => {
  if (!sortItem(item)) {
    pressEscape()
    await pollUntil(() => !document.querySelector('[role="menu"]'), signal)
    headKebab(root, column)?.click()
    await pollUntil(() => !!sortItem(item), signal)
  }
  sortItem(item)!.click()
}

/** Фамилия отсортирована — исходное состояние шагов после первого. */
const sortByLastName = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!headKebab(root, 'lastName'), signal)
  if (sortOf(root, 'lastName') === 'none')
    await pickSortItem(root, 'lastName', 'asc', signal)
  await pollUntil(() => sortOf(root, 'lastName') !== 'none', signal)
}

const ADD_SORT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Сортировки нет', en: 'No sorting' },
    hint: {
      ru: 'Сортировку задают пункты меню колонки.',
      en: 'Sorting is set from the column menu.',
    },
  },
  {
    title: { ru: 'Сортировка по фамилии', en: 'Sorted by last name' },
    hint: {
      ru: 'Пользователь выбрал сортировку в меню колонки — строки упорядочены по ней.',
      en: 'The user picked sorting in the column menu; the rows follow it.',
    },
    enter: stepAction(async (root, { signal }) => sortByLastName(root, signal)),
  },
  {
    title: { ru: 'Меню другой колонки', en: 'Another column menu' },
    hint: {
      ru: 'В меню другой колонки есть пункт добавить её к сортировке.',
      en: 'Another column menu offers to add the column to the sorting.',
    },
    states: ['overlay.menu'],
    enter: stepAction(async (root, { signal }) => {
      pressEscape()
      await pollUntil(() => !document.querySelector('[role="menu"]'), signal)
      openMenuBy(() => headKebab(root, 'firstName'), signal)
      await pollUntil(() => !!sortItem('add'), signal)
    }),
  },
  {
    title: { ru: 'Второй уровень', en: 'The second level' },
    hint: {
      ru: 'Пользователь выбрал пункт — колонка стала вторым уровнем сортировки.',
      en: 'The user picked the item; the column became the second sorting level.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (sortOf(root, 'firstName') === 'none')
        await pickSortItem(root, 'firstName', 'add', signal)
      await pollUntil(() => sortOf(root, 'firstName') !== 'none', signal)
    }),
  },
]

/** ADR 0231, S9: пользователь добавляет колонку к сортировке пунктом меню. */
export const SortingAddFromMenu: StoryObj<StoryProps> = {
  name: 'Add to sorting from the menu',
  parameters: { scenario: '0231/S9', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Второй уровень из меню',
        en: 'A second level from the menu',
      }}
      steps={ADD_SORT}
      args={guideArgs(ADD_SORT_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ADD_SORT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(headKebab(canvas, 'firstName')).not.toBeNull())
      await expect(sortOf(canvas, 'lastName')).toBe('none')
    })
    await step(ADD_SORT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortOf(canvas, 'lastName')).not.toBe('none')
      await expect(sortOf(canvas, 'firstName')).toBe('none')
    })
    await step(ADD_SORT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortItem('add')).not.toBeNull()
      await settle()
    })
    await step(ADD_SORT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(sortOf(canvas, 'firstName')).not.toBe('none')
      await expect(sortOf(canvas, 'lastName')).not.toBe('none')
      await settle()
    })
  },
}
