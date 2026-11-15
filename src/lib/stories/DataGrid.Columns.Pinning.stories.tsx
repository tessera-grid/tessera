import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  guideNext,
  pressEscape,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Закрепление колонок (ADR 0011): у левого и правого края, под вложенной шапкой — группа
 * целиком или отдельная колонка. `Playground` — песочница, S1–S2 — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Pinning',
} satisfies Meta<StoryProps>

export default meta

const NOT_PINNING = 'Does not affect pinning'

export const ColumnPinningPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'headerNesting',
      'enableRowActions',
      'enableRowSelection',
      'enableFooter',
    ],
    { rowHeight: NOT_PINNING, headerHeight: NOT_PINNING },
  ),
  args: {
    enableColumnPinning: true,
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Чтение шапки в `play` и шагах -------------------------------------------------

type Side = 'start' | 'end'
const PINNED: Record<Side, string> = { start: 'left', end: 'right' }

const headCellsOf = (root: ParentNode, id: string) => [
  ...root.querySelectorAll<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  ),
]
const pinButtonOf = (root: ParentNode, id: string) =>
  headCellsOf(root, id)[0]?.querySelector<HTMLElement>('.column-pin__button') ??
  null
const pinnedSide = (root: ParentNode, id: string) =>
  headCellsOf(root, id)[0]?.getAttribute('data-cell-pinned')
const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
const box = (element: Element) => element.getBoundingClientRect()
const openMenu = () =>
  document.querySelector<HTMLElement>('[role="menu"][data-open]')

/**
 * Довести таблицу до закреплений шага, как пользователь: кнопка закрепления колонки,
 * в её меню — сторона. Колонки уже на нужной стороне не трогаются, так что шаг приходит к
 * своему состоянию из любого. `then` — когда все закреплены.
 */
const pinAll =
  (pins: [string, Side][], then: (root: HTMLElement) => void = () => {}) =>
  (root: HTMLElement, signal: AbortSignal) => {
    let tries = 0
    const run = () => {
      if (signal.aborted) return
      const left = pins.find(
        ([id, side]) => pinnedSide(root, id) !== PINNED[side],
      )
      if (!left) return then(root)
      if (++tries > 80) return
      const [id, side] = left
      const menu = openMenu()
      const button = pinButtonOf(root, id)
      if (menu) {
        if (button?.getAttribute('aria-expanded') === 'true')
          menu.querySelector<HTMLElement>(`[data-item-id="${side}"]`)?.click()
        else pressEscape()
      } else if (!document.querySelector('[role="menu"]')) button?.click()
      setTimeout(run, 100)
    }
    setTimeout(run, 0)
  }

// --- S1 ------------------------------------------------------------------------------

/** Колонки, которые можно закрепить с обеих сторон: у них меню выбора стороны. */
const LEFT = 'lastName'
const RIGHT = 'age'

const scrollToMiddle = (root: HTMLElement) => {
  const scroller = scrollerOf(root)
  scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
}

const PIN_COLUMNS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Колонки в таблице', en: 'Columns in the table' },
    hint: {
      ru: 'Таблица шире области просмотра, у колонок в заголовке — кнопка закрепления. Ни одна колонка не закреплена.',
      en: 'The table is wider than the viewport, and column headers have a pin button. No column is pinned.',
    },
  },
  {
    title: { ru: 'Выбор стороны', en: 'Choosing a side' },
    hint: {
      ru: 'Пользователь нажал кнопку закрепления колонки, которую можно закрепить с обеих сторон. Открылось меню: закрепить слева или справа.',
      en: 'The user clicked the pin button of a column that can be pinned to either side. A menu opened: pin to the left or to the right.',
    },
    states: ['overlay.menu'],
    enter: afterRows((root, signal) => {
      let tries = 0
      const run = () => {
        const button = pinButtonOf(root, LEFT)
        if (
          signal.aborted ||
          button?.getAttribute('aria-expanded') === 'true' ||
          ++tries > 40
        )
          return
        if (!document.querySelector('[role="menu"]')) button?.click()
        setTimeout(run, 100)
      }
      setTimeout(run, 0)
    }),
  },
  {
    title: {
      ru: 'Колонка закреплена слева',
      en: 'The column is pinned to the left',
    },
    hint: {
      ru: 'Пользователь выбрал закрепление слева. Колонка встаёт к левому краю и отделяется от остальных разделителем.',
      en: 'The user chose to pin it to the left. The column moves to the left edge, and a divider separates it from the rest.',
    },
    states: ['body.pinnedStart'],
    enter: afterRows(pinAll([[LEFT, 'start']])),
  },
  {
    title: {
      ru: 'Колонка закреплена справа',
      en: 'The column is pinned to the right',
    },
    hint: {
      ru: 'Пользователь закрепил другую колонку у правого края. Она встаёт к правому краю, разделитель — с её левой стороны.',
      en: 'The user pinned another column to the right edge. It moves to the right edge, with the divider on its left side.',
    },
    states: ['body.pinnedStart', 'body.pinnedEnd'],
    enter: afterRows(
      pinAll([
        [LEFT, 'start'],
        [RIGHT, 'end'],
      ]),
    ),
  },
  {
    title: { ru: 'Прокрутка по горизонтали', en: 'Horizontal scrolling' },
    hint: {
      ru: 'Пользователь прокрутил таблицу. Закреплённые колонки и их итоги внизу остаются на месте, остальные проходят между ними.',
      en: 'The user scrolled the table. Pinned columns and their totals at the bottom stay in place, and the rest scroll between them.',
    },
    states: ['body.pinnedStart', 'body.pinnedEnd'],
    enter: afterRows(
      pinAll(
        [
          [LEFT, 'start'],
          [RIGHT, 'end'],
        ],
        scrollToMiddle,
      ),
    ),
  },
]

/** Ячейка строки итогов колонки. */
const footerCellOf = (root: ParentNode, columnId: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__footer-cell[data-column-id="${columnId}"]`,
  )

/** ADR 0011, S1: пользователь закрепляет колонки слева и справа и прокручивает таблицу. */
export const PinningColumns: StoryObj<StoryProps> = {
  name: 'Pin columns',
  parameters: {
    scenario: '0011/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Закрепление колонок', en: 'Column pinning' }}
      steps={PIN_COLUMNS}
      args={guideArgs(
        {
          enableColumnPinning: true,
          enableFooter: true,
          dataCount: 40,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const scroller = () => scrollerOf(canvas)
    await step(PIN_COLUMNS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(pinButtonOf(canvas, LEFT)).not.toBeNull()
      await expect(canvas.querySelector('[data-cell-pinned="left"]')).toBeNull()
      await expect(scroller().scrollWidth).toBeGreaterThan(
        scroller().clientWidth,
      )
    })
    await step(PIN_COLUMNS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          openMenu()?.querySelectorAll(
            '[data-item-id="start"], [data-item-id="end"]',
          ),
        ).toHaveLength(2),
      )
      await settle()
    })
    await step(PIN_COLUMNS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pinnedSide(canvas, LEFT)).toBe('left'))
      const scrollerLeft = box(scroller()).left
      await until(() =>
        expect(
          Math.abs(box(headCellsOf(canvas, LEFT)[0]!).left - scrollerLeft),
        ).toBeLessThanOrEqual(1),
      )
      await settle()
    })
    await step(PIN_COLUMNS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pinnedSide(canvas, RIGHT)).toBe('right'))
      const right = box(scroller()).left + scroller().clientWidth
      await until(() =>
        expect(
          Math.abs(box(headCellsOf(canvas, RIGHT)[0]!).right - right),
        ).toBeLessThanOrEqual(1),
      )
      await settle()
    })
    await step(PIN_COLUMNS[4]!.title.ru, async () => {
      const left = box(headCellsOf(canvas, LEFT)[0]!).left
      const right = box(headCellsOf(canvas, RIGHT)[0]!).left
      const totalLeft = box(footerCellOf(canvas, LEFT)!).left
      const totalRight = box(footerCellOf(canvas, RIGHT)!).left
      await guideNext(canvas)
      await until(() => expect(scroller().scrollLeft).toBeGreaterThan(0))
      await expect(box(headCellsOf(canvas, LEFT)[0]!).left).toBeCloseTo(left, 0)
      await expect(box(headCellsOf(canvas, RIGHT)[0]!).left).toBeCloseTo(
        right,
        0,
      )
      // Итоги закреплённых колонок — над своими колонками (ADR 0118, FT5).
      await expect(box(footerCellOf(canvas, LEFT)!).left).toBeCloseTo(
        totalLeft,
        0,
      )
      await expect(box(footerCellOf(canvas, RIGHT)!).left).toBeCloseTo(
        totalRight,
        0,
      )
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

/** Группа верхнего уровня (First Name, Last Name) и колонка из другой группы. */
const GROUP = 'name'
const LEAF = 'visits'
const LEAF_GROUP = 'info'

const PIN_NESTED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Группы колонок', en: 'Column groups' },
    hint: {
      ru: 'Колонки сгруппированы. Закрепить можно только группу верхнего уровня: кнопка закрепления есть у её заголовка, у колонок внутри группы её нет.',
      en: 'The columns are grouped. Only a top-level group can be pinned: its header has a pin button, and the columns inside the group do not.',
    },
  },
  {
    title: { ru: 'Группа закреплена', en: 'The group is pinned' },
    hint: {
      ru: 'Пользователь закрепил группу. Все её колонки встают к левому краю одним блоком.',
      en: 'The user pinned the group. All its columns move to the left edge as one block.',
    },
    states: ['body.pinnedStart'],
    enter: afterRows(pinAll([[GROUP, 'start']])),
  },
  {
    title: {
      ru: 'Закрепление колонки из группы',
      en: 'Pinning a column from a group',
    },
    hint: {
      ru: 'Приложение разрешило закреплять отдельные колонки внутри групп. Пользователь закрепил одну колонку из группы: она уходит к левому краю, а заголовок группы делится на части.',
      en: 'The app allowed pinning individual columns inside groups. The user pinned one column from a group: it moves to the left edge, and the group header splits into parts.',
    },
    props: () => ({ columnPinningLeafPinning: true }),
    states: ['body.pinnedStart'],
    enter: afterRows(
      pinAll([
        [GROUP, 'start'],
        [LEAF, 'start'],
      ]),
    ),
  },
]

/** ADR 0011, S2: закрепление под вложенной шапкой — группа целиком, затем колонка. */
export const PinningNested: StoryObj<StoryProps> = {
  name: 'Header groups',
  parameters: {
    scenario: '0011/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Закрепление под вложенной шапкой',
        en: 'Pinning under a nested header',
      }}
      steps={PIN_NESTED}
      args={guideArgs(
        {
          enableColumnPinning: true,
          headerNesting: 'nested',
          dataCount: 40,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PIN_NESTED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(pinButtonOf(canvas, GROUP)).not.toBeNull()
      await expect(pinButtonOf(canvas, 'firstName')).toBeNull()
      await expect(pinButtonOf(canvas, LEAF)).toBeNull()
    })
    await step(PIN_NESTED[1]!.title.ru, async () => {
      await guideNext(canvas)
      for (const id of ['firstName', 'lastName'])
        await until(() => expect(pinnedSide(canvas, id)).toBe('left'))
      await settle()
    })
    await step(PIN_NESTED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pinnedSide(canvas, LEAF)).toBe('left'))
      await until(() =>
        expect(headCellsOf(canvas, LEAF_GROUP).length).toBeGreaterThan(1),
      )
      await settle()
    })
  },
}
