import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { vrStates } from './__mocks__/catalog'
import { expect } from 'storybook/test'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  guideNext,
  orderedRows,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'

/**
 * Группировка строк (ADR 0016); группировка от приложения без кнопок (ADR 0120); липкие строки
 * групп (ADR 0160, S3).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Grouping',
} satisfies Meta<StoryProps>

export default meta

// Плоский детерминированный набор для истории Row Grouping — генератор
// (faker.seed), а не захардкоженные строки. Группировка по колонке с малым
// числом различных значений (gender) агрегирует их в несколько групп-строк.
const rowGroupingData = makeData({ shape: 'flat', count: 12 })

export const RowGroupingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    // Реальные данные из генератора (см. rowGroupingData) — группировка видна на
    // настоящих строках, а не на захардкоженных.
    dataOverride: rowGroupingData,
    enableRowGrouping: true,
    // Строки сгруппированы по полу и раскрыты: строки-группы со сводкой и записи под ними.
    initialGrouping: ['gender'],
    enableRowExpanding: true,
    initialExpanded: true,
    // Немного колонок, целиком в горизонтальном вьюпорте: тесты адресуют шапку
    // groupable-колонки (gender) — она не должна прятаться за виртуализацией.
    columnCount: 6,

    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: {
    ...vrStates('body.groups'),
    ...showControls([
      'enableRowGrouping',
      'rowGroupingStickyRows',
      'enableRowExpanding',
    ]),
  },
}

// --- ADR 0120, S4 --------------------------------------------------------------------

const rowIdsOf = (root: ParentNode) =>
  orderedRows(root as HTMLElement).map(row => row.dataset.rowId ?? '')
const isGroupRow = (id: string) => id.startsWith('gender:')

const BY_APPLICATION: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Строки без группировки', en: 'Rows without grouping' },
    hint: {
      ru: 'Группировкой управляет приложение, кнопок группировки в заголовках нет. Строки идут списком.',
      en: 'The app controls grouping, and the headers have no grouping buttons. The rows form a flat list.',
    },
    props: () => ({ enableRowGroupingModel: true }),
  },
  {
    title: {
      ru: 'Приложение группирует по полу',
      en: 'The app groups by gender',
    },
    hint: {
      ru: 'Приложение сгруппировало строки по полу. Таблица показывает свёрнутые группы.',
      en: 'The app grouped the rows by gender. The table shows collapsed groups.',
    },
    props: () => ({ rowGroupingModelGrouping: ['gender'] }),
  },
  {
    title: {
      ru: 'Приложение раскрывает группы',
      en: 'The app expands the groups',
    },
    hint: {
      ru: 'Приложение раскрыло все группы. Таблица показывает строки внутри групп, кнопок группировки по-прежнему нет.',
      en: 'The app expanded all groups. The table shows the rows inside the groups, and there are still no grouping buttons.',
    },
    props: () => ({
      enableRowExpandingModel: true,
      rowExpandingModelExpanded: true,
    }),
  },
]

/** ADR 0120, S4: приложение задаёт группировку само — модель без кнопок в заголовках. */
export const GroupingByApplication: StoryObj<StoryProps> = {
  name: 'By application',
  parameters: {
    scenario: '0120/S4',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Группировка от приложения', en: 'Grouping from the app' }}
      steps={BY_APPLICATION}
      args={guideArgs(
        {
          dataOverride: rowGroupingData,
          columnCount: 6,
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
    await step(BY_APPLICATION[0].title.ru, async () => {
      await waitForRows(canvas)
      expect(canvas.querySelector('.column-group__button')).toBeNull()
      expect(rowIdsOf(canvas).some(isGroupRow)).toBe(false)
    })
    await step(BY_APPLICATION[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowIdsOf(canvas).every(isGroupRow)).toBe(true))
      expect(canvas.querySelector('.column-group__button')).toBeNull()
    })
    await step(BY_APPLICATION[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => {
        const ids = rowIdsOf(canvas)
        expect(ids.some(isGroupRow)).toBe(true)
        expect(ids.some(id => !isGroupRow(id))).toBe(true)
      })
      expect(canvas.querySelector('.column-group__button')).toBeNull()
    })
    await settle()
  },
}

// --- ADR 0160, S3: липкие строки групп ------------------------------------------------

const stickyData = makeData({ shape: 'flat', count: 40 })
const STICKY_ARGS = {
  dataOverride: stickyData,
  enableRowGrouping: true,
  rowGroupingStickyRows: true,
  initialGrouping: ['gender'],
  enableRowExpanding: true,
  initialExpanded: true,
  enableTreeLines: true,
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
} satisfies Partial<StoryProps>

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')
/** Липкие копии под шапкой — id строк. */
const stickyIds = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>('[data-sticky-rows] [data-row-id]'),
  ].map(row => row.dataset.rowId)
const stickyTop = (root: ParentNode) =>
  parseFloat(
    root.querySelector<HTMLElement>('[data-sticky-rows] [data-row-id]')?.style
      .top ?? '0',
  )
/** Строка тела (не липкая копия). */
const realRow = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]:not([data-sticky-copy])`,
  )
/** Строки-группы тела по порядку, без липких копий. */
const groupIds = (root: ParentNode) =>
  orderedRows(root as HTMLElement)
    .filter(row => !row.hasAttribute('data-sticky-copy'))
    .map(row => row.dataset.rowId ?? '')
    .filter(isGroupRow)
const rowHeightOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__body-row')?.offsetHeight ?? 0

/** Прокрутить тело так, чтобы верх второй группы стоял на `gap` строк ниже шапки. */
const scrollToSecondGroup = async (root: HTMLElement, gap: number) => {
  const scroller = scrollerOf(root)!
  const h = rowHeightOf(root)
  scroller.scrollTop = 0
  await new Promise(resolve => setTimeout(resolve, 30))
  const first = groupIds(root)[0]
  for (let tries = 0; tries < 40; tries++) {
    const second = groupIds(root).find(id => id !== first)
    const row = second ? realRow(root, second) : null
    if (row) {
      scroller.scrollTop = parseFloat(row.style.top) - gap * h
      await new Promise(resolve => setTimeout(resolve, 30))
      return
    }
    scroller.scrollTop += 4 * h
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

const STICKY: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Группы раскрыты', en: 'Groups are expanded' },
    hint: {
      ru: 'Строки сгруппированы по полу, группы раскрыты. Строка группы — над её строками.',
      en: 'The rows are grouped by gender, and the groups are expanded. A group row sits above its rows.',
    },
  },
  {
    title: {
      ru: 'Пользователь прокрутил группу',
      en: 'The user scrolled through a group',
    },
    hint: {
      ru: 'Строка группы ушла вверх, но держится под шапкой, пока видны её строки: видно, в какой группе пользователь. Линия отделяет её от строк ниже.',
      en: 'The group row scrolled up but sticks under the header while its rows are visible, so the user can see which group they are in. A line separates it from the rows below.',
    },
    enter: untilDone(
      root => stickyIds(root).length === 1 && stickyTop(root) === 0,
      root => {
        const scroller = scrollerOf(root)
        if (scroller) scroller.scrollTop = rowHeightOf(root) * 3
      },
    ),
  },
  {
    title: { ru: 'Следующая группа подошла', en: 'The next group arrived' },
    hint: {
      ru: 'Строка следующей группы подошла к липкой и выталкивает её вверх: под шапкой окажется новая группа.',
      en: 'The next group row reached the sticky one and is pushing it up: the new group will end up under the header.',
    },
    enter: stepAction(async root => {
      await scrollToSecondGroup(root, 0.5)
    }),
  },
  {
    title: {
      ru: 'Пользователь свернул группу из липкой строки',
      en: 'The user collapsed a group from the sticky row',
    },
    hint: {
      ru: 'Нажатие на шеврон липкой строки свернуло её группу, и таблица прокрутила к строке группы: она снова на своём месте в списке, липких строк нет.',
      en: 'Clicking the chevron of the sticky row collapsed its group, and the table scrolled to the group row: it is back in its place in the list, and there are no sticky rows.',
    },
    enter: untilDone(
      root =>
        stickyIds(root).length === 0 &&
        realRow(root, groupIds(root)[0] ?? '')?.dataset.expanded === 'false',
      root => {
        const scroller = scrollerOf(root)
        if (!scroller) return
        // Липкую строку выталкивает следующая группа — шеврон наполовину под шапкой:
        // сперва прокрутка к месту, где она стоит под шапкой целиком.
        if (stickyIds(root).length === 0 || stickyTop(root) < 0) {
          scroller.scrollTop = rowHeightOf(root) * 3
          return
        }
        root
          .querySelector<HTMLElement>(
            '[data-sticky-rows] [data-row-id] .row-expand-button',
          )
          ?.click()
      },
    ),
  },
]

/** ADR 0160, S3: строка длинной группы держится под шапкой, следующая её выталкивает. */
export const GroupingStickyRows: StoryObj<StoryProps> = {
  name: 'Sticky group rows',
  parameters: { scenario: '0160/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Липкие строки групп', en: 'Sticky group rows' }}
      steps={STICKY}
      args={guideArgs(STICKY_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    // Первая группа — до прокрутки: ушедшая вверх строка тела выходит из окна.
    let firstGroup: string | undefined
    await step(STICKY[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(stickyIds(canvas)).toEqual([])
      firstGroup = groupIds(canvas)[0]
    })
    await step(STICKY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(stickyIds(canvas)).toHaveLength(1))
      await expect(stickyIds(canvas)[0]).toBe(firstGroup)
    })
    await step(STICKY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(stickyTop(canvas)).toBeLessThan(0))
    })
    await step(STICKY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(stickyIds(canvas)).toEqual([]))
      // Окно после сворачивания дорисовывается порциями (ADR 0203).
      await until(() =>
        expect(realRow(canvas, groupIds(canvas)[0]!)?.dataset.expanded).toBe(
          'false',
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0184, S5–S6 --------------------------------------------------------------------

const STAFF = [
  ['s1', 'Anna', 'Paris', 'Sales'],
  ['s2', 'Boris', 'Paris', 'Sales'],
  ['s3', 'Clara', 'Paris', 'Support'],
  ['s4', 'Denis', 'Paris', 'Support'],
  ['s5', 'Elena', 'Paris', 'Support'],
  ['s6', 'Fedor', 'Rome', 'Sales'],
  ['s7', 'Galina', 'Rome', 'Support'],
].map(([id, name, city, team]) => ({ id, name, city, team }))

const STAFF_ARGS = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
  columnsOverride: [
    { id: 'city', accessorKey: 'city', header: 'City', size: 220 },
    { id: 'team', accessorKey: 'team', header: 'Team', size: 220 },
    { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  ] as never,
  dataOverride: STAFF,
  enableRowGrouping: true,
  enableRowExpanding: true,
  initialGrouping: ['city', 'team'],
  initialExpanded: true,
} satisfies Partial<StoryProps>

/** Числа первых групп: город и его первая подгруппа. */
const groupCounts = (canvas: HTMLElement) =>
  [...canvas.querySelectorAll('[data-group-count]')]
    .slice(0, 2)
    .map(element => element.textContent?.trim())

/** Ввод в поле поиска — как набор пользователя: React слышит событие `input`. */
const typeSearch = (text: string) => (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="quick-search"]',
  )
  if (!input) return
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const FILTERED_COUNT: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Сколько строк в группах',
      en: 'How many rows are in the groups',
    },
    hint: {
      ru: 'Рядом со значением группы стоит число строк данных внутри неё, а не число подгрупп.',
      en: 'Next to the group value is the number of data rows inside it, not the number of subgroups.',
    },
  },
  {
    title: { ru: 'Найдена часть строк', en: 'Some rows were found' },
    hint: {
      ru: 'Поиск оставил часть строк, поэтому число в группах уменьшилось: оно считает только то, что осталось.',
      en: 'The search left only some of the rows, so the counts in the groups went down: they count only what remains.',
    },
    enter: typeSearch('Support'),
  },
]

/** ADR 0184, S5: число строк группы следует за поиском. */
export const GroupRowCountFiltered: StoryObj<StoryProps> = {
  name: 'Row count — search',
  parameters: { scenario: '0184/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Число строк группы и поиск',
        en: 'Group row count and search',
      }}
      steps={FILTERED_COUNT}
      args={guideArgs(
        { ...STAFF_ARGS, enableQuickSearch: true, quickSearchDebounceMs: 0 },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FILTERED_COUNT[0]!.title.ru, async () => {
      await until(() => expect(groupCounts(canvas)).toEqual(['(5)', '(2)']))
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="quick-search"]'),
        ).not.toBeNull(),
      )
    })
    await step(FILTERED_COUNT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(groupCounts(canvas)).toEqual(['(3)', '(3)']))
    })
    await settle()
  },
}

const COUNT_OFF: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Число строк видно', en: 'The row count is shown' },
    hint: {
      ru: 'По умолчанию строка группы показывает число строк данных.',
      en: 'By default, a group row shows the number of data rows.',
    },
  },
  {
    title: { ru: 'Число строк скрыто', en: 'The row count is hidden' },
    hint: {
      ru: 'Приложение отключило число: в строке группы осталось только её значение.',
      en: 'The app turned the count off: the group row shows only its value.',
    },
    props: () => ({ rowGroupingGroupRowCount: false }),
  },
]

/** ADR 0184, S6: разработчик отключает подпись. */
export const GroupRowCountOff: StoryObj<StoryProps> = {
  name: 'Row count — off',
  parameters: { scenario: '0184/S6', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Без числа строк', en: 'Without the row count' }}
      steps={COUNT_OFF}
      args={guideArgs(STAFF_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(COUNT_OFF[0]!.title.ru, async () => {
      await until(() => expect(groupCounts(canvas)).toEqual(['(5)', '(2)']))
    })
    await step(COUNT_OFF[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(groupCounts(canvas)).toEqual([]))
    })
    await settle()
  },
}
