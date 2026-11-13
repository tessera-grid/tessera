import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  guideNext,
  openMenuBy,
  orderedRows,
  pressEscape,
  rowKebab,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { overflowColumns, overflowData } from './__mocks__/overflowColumns'
import {
  textOverflowColumns,
  textOverflowData,
  textOverflowLocalization,
  textOverflowPlugins,
} from './__mocks__/textOverflowData'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Длинный текст: в ячейках шапки, тела и футера — многоточие и подсказка с полным
 * текстом (ADR 0075), в меню и панелях — перенос, две строки с многоточием и короткие
 * формы счётчиков (ADR 0083). `Playground` — песочница, S1–S2 — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Long text',
} satisfies Meta<StoryProps>

export default meta

const lineHeight = (el: Element) => parseFloat(getComputedStyle(el).lineHeight)

/** Таблица с длинными подписями во всех местах: колонки, варианты, действия строки, поиск. */
const LONG_LABELS = {
  columnsOverride: textOverflowColumns,
  dataOverride: textOverflowData,
  extraPlugins: textOverflowPlugins,
  localization: textOverflowLocalization,
  actionsDemo: 'none',
  enableToolbar: true,
  enableQuickSearch: true,
  enableColumnFiltering: true,
  columnFilteringFilteredCount: true,
  enableColumnVisibility: true,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableRowActions: true,
  enableRowActionMenu: true,
  enablePagination: true,
} satisfies Partial<StoryProps>

const rowMenuOf = (root: ParentNode) =>
  rowKebab(orderedRows(root as HTMLElement)[0])

const LONG_ITEM =
  'Reassign the account to another manager in the same regional office'

export const LongTextPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    ...LONG_LABELS,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    containerWidth: 560,
  },
  parameters: {
    ...showControls([
      'enableOverflowTooltip',
      'enableToolbar',
      'enableColumnVisibility',
      'enableRowSelection',
      'rowSelectionSelectedCount',
      'enableRowActions',
      'actionsDemo',
      'enableRowActionMenu',
      'enableQuickSearch',
      'enableColumnFiltering',
      'columnFilteringFilteredCount',
      'enablePagination',
      'enableFooter',
      'containerWidth',
    ]),
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

// --- ADR 0075 S1 ---------------------------------------------------------------------

// Колонка в середине: подсказка над ячейкой целиком над таблицей, не за её краем.
const LONG_NAME = 'Northern Lights Logistics Holding 0'

const longNameTitle = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      '.data-grid__body-row .data-grid__cell-wrapper-title',
    ),
  ].find(title => title.textContent?.trim() === LONG_NAME) ?? null

const truncated = (element: HTMLElement | null) =>
  !!element && element.scrollWidth > element.clientWidth

const openTips = () =>
  [...document.querySelectorAll('[role="presentation"][data-open]')].map(
    element => element.textContent ?? '',
  )

const CELLS: readonly GuideStoryStep[] = [
  {
    title: 'Длинный текст в ячейках',
    hint: 'Текст, который не помещается в ячейку, обрезается многоточием. Высота строк при этом не меняется.',
  },
  {
    title: 'Пользователь навёл указатель на ячейку',
    hint: 'Над обрезанной ячейкой появляется подсказка с полным текстом.',
    states: ['overlay.tooltip'],
    // Указатель над обрезанным текстом, как при наведении мышью.
    enter: afterRows(root =>
      longNameTitle(root)?.dispatchEvent(
        new PointerEvent('pointerover', {
          bubbles: true,
          pointerType: 'mouse',
        }),
      ),
    ),
  },
]

/** ADR 0075, S1: длинный текст ячейки — многоточие и подсказка с полным текстом. */
export const LongTextCells: StoryObj<StoryProps> = {
  name: 'Cells',
  parameters: {
    scenario: '0075/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Длинный текст в ячейках"
      steps={CELLS}
      args={guideArgs(
        {
          columnsOverride: overflowColumns,
          dataOverride: overflowData,
          enableFooter: true,
          height: '400',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(CELLS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(truncated(longNameTitle(canvas))).toBe(true))
      await expect(openTips()).toEqual([])
    })
    await step(CELLS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(openTips()).toContain(LONG_NAME))
      await settle()
    })
  },
}

// --- ADR 0083 S1 ---------------------------------------------------------------------

const statusBarLayout = (root: ParentNode) =>
  root
    .querySelector('[data-status-bar-layout]')
    ?.getAttribute('data-status-bar-layout')

const MENUS: readonly GuideStoryStep[] = [
  {
    title: 'Меню закрыто',
    hint: 'У пунктов меню строки длинные подписи. Пользователь ещё не открывал меню.',
  },
  {
    title: 'Меню строки',
    hint: 'Длинный пункт меню переносится на несколько строк, а само меню не становится шире заданного предела.',
    states: ['overlay.menu'],
    enter: afterRows((root, signal) =>
      openMenuBy(() => rowMenuOf(root), signal),
    ),
  },
  {
    title: 'Узкая таблица',
    hint: 'Пользователь выбрал строки в узкой таблице. Нижняя панель переходит на компактную раскладку, и счётчики показываются в короткой форме.',
    props: () => ({ containerWidth: 360 }),
    enter: afterRows(root => {
      pressEscape()
      orderedRows(root)
        .slice(0, 2)
        .forEach(row => {
          const box = row.querySelector<HTMLElement>('[role="checkbox"]')
          if (box?.getAttribute('aria-checked') !== 'true') box?.click()
        })
    }),
  },
]

/** ADR 0083, S1: длинные подписи в меню и панелях — перенос и короткие формы. */
export const LongTextMenus: StoryObj<StoryProps> = {
  name: 'Menus and panels',
  parameters: {
    scenario: '0083/S1',
    requirements: ['TX13'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Длинный текст в меню и панелях"
      steps={MENUS}
      args={guideArgs(
        { ...LONG_LABELS, height: '400', containerWidth: 560 },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MENUS[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(MENUS[1]!.title, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() =>
        expect(document.querySelector('[role="menu"]')).not.toBeNull(),
      )
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!
      await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(
        320.5,
      )
      const label = [
        ...menu.querySelectorAll<HTMLElement>('[data-popup-item-label]'),
      ].find(el => el.textContent === LONG_ITEM)!
      await expect(label.getBoundingClientRect().height).toBeGreaterThan(
        lineHeight(label) * 1.5,
      )
      await settle()
    })
    await step(MENUS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(['compact', 'stacked']).toContain(statusBarLayout(canvas)),
      )
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="selected-rows-count"]')
            ?.textContent,
        ).toBeTruthy(),
      )
      await settle()
    })
  },
}
