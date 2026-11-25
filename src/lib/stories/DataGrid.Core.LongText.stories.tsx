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
  pointAt,
  pollUntil,
  pressEscape,
  rowKebab,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { dragGripTo, gripOf, separatorOf } from './__mocks__/columnGrip'
import {
  openViewSettingsSection,
  viewSettingsLevel,
  viewSettingsSectionOpen,
} from './__mocks__/viewSettings'
import { overflowColumns, overflowData } from './__mocks__/overflowColumns'
import {
  textOverflowColumns,
  textOverflowData,
  textOverflowLocalization,
  textOverflowPlugins,
} from './__mocks__/textOverflowData'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Длинный текст: в ячейках шапки, тела и футера — многоточие и подсказка с полным
 * текстом (ADR 0075), в меню и панелях — перенос, две строки с многоточием и короткие
 * формы счётчиков (ADR 0083). `Playground` — песочница, дальше — сценарии. Высота строк по
 * содержимому — раздел «Columns/Text wrap» (ADR 0218).
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

const LONG_HEADER = 'Company registered name'
const LONG_FOOTER = 'Companies registered in total'

/** Подпись ячейки шапки, тела или итога по её тексту. */
const titleWith = (root: ParentNode, text: string) =>
  [
    ...root.querySelectorAll<HTMLElement>('.data-grid__cell-wrapper-title'),
  ].find(title => title.textContent?.trim() === text) ?? null

/** Указатель над подписью, как при наведении мышью. */
const hoverTitle = (find: (root: ParentNode) => HTMLElement | null) =>
  afterRows(root =>
    find(root)?.dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
    ),
  )

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')

const CELLS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Длинный текст в ячейках', en: 'Long text in cells' },
    hint: {
      ru: 'Текст, который не помещается в ячейку, обрезается многоточием. Высота строк при этом не меняется.',
      en: "Text that doesn't fit in a cell is cut off with an ellipsis. Row height stays the same.",
    },
  },
  {
    title: {
      ru: 'Пользователь навёл указатель на ячейку',
      en: 'The user hovered over a cell',
    },
    hint: {
      ru: 'Над обрезанной ячейкой появляется подсказка с полным текстом.',
      en: 'A tooltip with the full text appears over the truncated cell.',
    },
    states: ['overlay.tooltip'],
    enter: hoverTitle(longNameTitle),
  },
  {
    title: {
      ru: 'Подсказка у заголовка',
      en: 'A tooltip on a header',
    },
    hint: {
      ru: 'Пользователь навёл указатель на обрезанный заголовок — подсказка с его полным текстом.',
      en: 'The user hovered over a truncated header; a tooltip shows its full text.',
    },
    states: ['overlay.tooltip'],
    enter: hoverTitle(root => titleWith(root, LONG_HEADER)),
  },
  {
    title: { ru: 'Подсказка у итога', en: 'A tooltip on the total' },
    hint: {
      ru: 'Пользователь навёл указатель на обрезанную подпись внизу колонки — подсказка с её полным текстом.',
      en: 'The user hovered over the truncated label at the bottom of the column; a tooltip shows its full text.',
    },
    states: ['overlay.tooltip'],
    enter: hoverTitle(root => titleWith(root, LONG_FOOTER)),
  },
  {
    title: { ru: 'Прокрутка', en: 'Scrolling' },
    hint: {
      ru: 'Пользователь прокрутил таблицу — подсказка спряталась.',
      en: 'The user scrolled the table; the tooltip hid.',
    },
    enter: afterRows(root => {
      const scroller = scrollerOf(root)
      if (scroller && scroller.scrollTop === 0) scroller.scrollTop = 200
    }),
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
    <DemoStory
      title={{ ru: 'Длинный текст в ячейках', en: 'Long text in cells' }}
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
    await step(CELLS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(truncated(longNameTitle(canvas))).toBe(true))
      await expect(openTips()).toEqual([])
    })
    await step(CELLS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openTips()).toContain(LONG_NAME))
      await settle()
    })
    await step(CELLS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openTips()).toContain(LONG_HEADER))
      await settle()
    })
    await step(CELLS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openTips()).toContain(LONG_FOOTER))
      await settle()
    })
    await step(CELLS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(scrollerOf(canvas)!.scrollTop).toBeGreaterThan(0),
      )
      await until(() => expect(openTips()).toEqual([]))
      await settle()
    })
  },
}

// --- ADR 0075 S2 ---------------------------------------------------------------------

const NARROWED = 'company'
const WIDE = 360
const NARROW = 160

const narrowDemoColumns = overflowColumns.map(column =>
  column.id === NARROWED ? { ...column, size: WIDE } : column,
)

/** Пользователь протянул ручку ширины колонки до `width`; `then` — когда ширина встала. */
const resizeTo = (width: number, then?: (root: HTMLElement) => void) =>
  stepAction(async (root, step) => {
    await pollUntil(() => !!separatorOf(root, NARROWED), step.signal)
    const head = gripOf(root, NARROWED)!.closest('[data-column-id]')!
    if (Math.abs(head.getBoundingClientRect().width - width) > 1)
      await dragGripTo(root, step, NARROWED, width)
    await pollUntil(
      () => Math.abs(head.getBoundingClientRect().width - width) <= 1,
      step.signal,
    )
    then?.(root)
  })

const hoverName = (root: HTMLElement) =>
  longNameTitle(root)?.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
  )

const NARROW_STEPS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Текст помещается', en: 'The text fits' },
    hint: {
      ru: 'Колонка широкая — текст виден целиком.',
      en: 'The column is wide; the text is fully visible.',
    },
  },
  {
    title: { ru: 'Колонка сужена', en: 'The column is narrowed' },
    hint: {
      ru: 'Пользователь сузил колонку — текст обрезался многоточием.',
      en: 'The user narrowed the column; the text is cut off with an ellipsis.',
    },
    enter: resizeTo(NARROW),
  },
  {
    title: {
      ru: 'Подсказка у суженной колонки',
      en: 'A tooltip on the narrowed column',
    },
    hint: {
      ru: 'Пользователь навёл указатель на ячейку — над ней подсказка с полным текстом.',
      en: 'The user hovered over a cell; a tooltip with the full text appears above it.',
    },
    states: ['overlay.tooltip'],
    enter: resizeTo(NARROW, hoverName),
  },
  {
    title: { ru: 'Колонка расширена', en: 'The column is widened' },
    hint: {
      ru: 'Пользователь расширил колонку и навёл указатель — текст виден целиком, подсказки нет.',
      en: 'The user widened the column and hovered over the cell; the text is fully visible, and there is no tooltip.',
    },
    enter: resizeTo(WIDE, hoverName),
  },
]

/** ADR 0075, S2: пользователь сужает колонку — текст обрезается, появляется подсказка. */
export const LongTextNarrowColumn: StoryObj<StoryProps> = {
  name: 'Narrow a column',
  parameters: { scenario: '0075/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Сужение колонки', en: 'Narrowing a column' }}
      steps={NARROW_STEPS}
      args={guideArgs(
        {
          columnsOverride: narrowDemoColumns,
          dataOverride: overflowData,
          height: '400',
          enableColumnSizing: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NARROW_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(longNameTitle(canvas)).not.toBeNull())
      await until(() => expect(truncated(longNameTitle(canvas))).toBe(false))
    })
    await step(NARROW_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(truncated(longNameTitle(canvas))).toBe(true))
      await expect(openTips()).toEqual([])
    })
    await step(NARROW_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openTips()).toContain(LONG_NAME))
      await settle()
    })
    await step(NARROW_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(truncated(longNameTitle(canvas))).toBe(false))
      await until(() => expect(openTips()).toEqual([]))
      await settle()
    })
  },
}

// --- ADR 0075 S3 ---------------------------------------------------------------------

const LONG_PERSON = 'Bartholomew Montgomery-Fitzgerald'

const activeCell = (root: ParentNode) => {
  const active = root.querySelector<HTMLElement>(
    '[data-kn-cell][data-kn-active="true"]',
  )
  return active && document.activeElement === active ? active : null
}

const pressOn = (target: HTMLElement, key: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )

/** Вход в таблицу клавишей Tab и стрелкой вниз — к первой ячейке с длинным текстом. */
const focusLongCell = (root: HTMLElement) => {
  const active = activeCell(root)
  if (!active) {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    root.querySelector<HTMLElement>('[data-kn-cell][tabindex="0"]')?.focus()
    return
  }
  if (active.classList.contains('data-grid__head-cell')) {
    pressOn(active, 'ArrowDown')
  }
}

const onLongCell = (root: ParentNode) =>
  activeCell(root)?.textContent?.includes(LONG_PERSON) ?? false

const KEYBOARD: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Фокус вне таблицы', en: 'Focus outside the table' },
    hint: {
      ru: 'Пользователь работает с таблицей с клавиатуры. Фокус пока вне таблицы.',
      en: 'The user works with the table from the keyboard. Focus is still outside the table.',
    },
  },
  {
    title: {
      ru: 'Фокус на обрезанной ячейке',
      en: 'Focus on a truncated cell',
    },
    hint: {
      ru: 'Пользователь перешёл клавишами к ячейке с длинным текстом — над ней подсказка с полным текстом.',
      en: 'The user moved with the keys to a cell with long text; a tooltip with the full text appears above it.',
    },
    keyboard: true,
    states: ['overlay.tooltip'],
    enter: untilDone(
      root => onLongCell(root) && openTips().includes(LONG_PERSON),
      root => focusLongCell(root),
    ),
  },
  {
    title: { ru: 'Подсказка скрыта', en: 'The tooltip is hidden' },
    hint: {
      ru: 'Пользователь нажал Escape — подсказка спряталась, фокус остался на ячейке.',
      en: 'The user pressed Escape; the tooltip hid, and focus stayed on the cell.',
    },
    keyboard: true,
    enter: root => {
      let escaped = false
      return untilDone(
        current => escaped && onLongCell(current) && openTips().length === 0,
        current => {
          if (!onLongCell(current)) {
            focusLongCell(current)
            return
          }
          if (!openTips().includes(LONG_PERSON) && !escaped) return
          pressOn(activeCell(current)!, 'Escape')
          escaped = true
        },
      )(root, undefined as never)
    },
  },
]

/** ADR 0075, S3: пользователь читает полный текст ячейки с клавиатуры. */
export const LongTextKeyboard: StoryObj<StoryProps> = {
  name: 'Keyboard',
  parameters: { scenario: '0075/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Длинный текст с клавиатуры',
        en: 'Long text from the keyboard',
      }}
      steps={KEYBOARD}
      args={guideArgs(
        {
          columnsOverride: overflowColumns,
          dataOverride: overflowData,
          height: '400',
          enableKeyboardNavigation: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(KEYBOARD[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(openTips()).toEqual([])
    })
    await step(KEYBOARD[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(onLongCell(canvas)).toBe(true))
      await until(() => expect(openTips()).toContain(LONG_PERSON))
      await settle()
    })
    await step(KEYBOARD[2]!.title.ru, async () => {
      await guideNext(canvas)
      // Фокус на ячейке, подсказки нет и дольше задержки её показа.
      await until(() => {
        expect(onLongCell(canvas)).toBe(true)
        expect(openTips()).toEqual([])
      })
      await new Promise(resolve => setTimeout(resolve, 500))
      await expect(onLongCell(canvas)).toBe(true)
      await expect(openTips()).toEqual([])
      await settle()
    })
  },
}

// --- ADR 0083 S1 ---------------------------------------------------------------------

const statusBarLayout = (root: ParentNode) =>
  root
    .querySelector('[data-status-bar-layout]')
    ?.getAttribute('data-status-bar-layout')

const MENUS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Меню закрыто', en: 'The menu is closed' },
    hint: {
      ru: 'У пунктов меню строки длинные подписи. Пользователь ещё не открывал меню.',
      en: "The row menu items have long labels. The user hasn't opened the menu yet.",
    },
  },
  {
    title: { ru: 'Меню строки', en: 'The row menu' },
    hint: {
      ru: 'Длинный пункт меню переносится на несколько строк, а само меню не становится шире заданного предела.',
      en: 'A long menu item wraps onto several lines, and the menu itself never grows wider than its set limit.',
    },
    states: ['overlay.menu'],
    enter: afterRows((root, signal) =>
      openMenuBy(() => rowMenuOf(root), signal),
    ),
  },
  {
    title: { ru: 'Узкая таблица', en: 'A narrow table' },
    hint: {
      ru: 'Пользователь выбрал строки в узкой таблице. Нижняя панель переходит на компактную раскладку, и счётчики показываются в короткой форме.',
      en: 'The user selected rows in a narrow table. The status bar switches to a compact layout, and the counters show in their short form.',
    },
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
    <DemoStory
      title={{
        ru: 'Длинный текст в меню и панелях',
        en: 'Long text in menus and panels',
      }}
      steps={MENUS}
      args={guideArgs(
        { ...LONG_LABELS, height: '400', containerWidth: 560 },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MENUS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(MENUS[1]!.title.ru, async () => {
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
    await step(MENUS[2]!.title.ru, async () => {
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

// --- ADR 0083 S2 ---------------------------------------------------------------------

const LONG_COLUMN = 'Customer account responsible for the regional contract'

const columnLabel = (id: string) =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    `[data-column-id="${id}"] [data-option-label]`,
  ) ?? null

const filterCondition = () =>
  viewSettingsLevel()?.querySelector<HTMLElement>(
    '[data-view-settings-level="status"] [data-view-settings-description]',
  ) ?? null

const clipped = (element: HTMLElement | null) =>
  !!element &&
  (element.scrollWidth > element.clientWidth + 1 ||
    element.scrollHeight > element.clientHeight + 1)

/** Подсказки кита (`data-side` позиционера) с их текстом. */
const kitTips = () =>
  [...document.querySelectorAll('[data-side]')].map(
    element => element.textContent?.trim() ?? '',
  )

/**
 * Раздел «Настроек вида» открыт: нажатие — одно, следующее — только если уровень так и не
 * въехал. Частые нажатия посреди сдвига уровня сбивают переход.
 */
const ensureSection = async (
  root: HTMLElement,
  id: string,
  signal: AbortSignal,
) => {
  while (!viewSettingsSectionOpen(id)) {
    openViewSettingsSection(root, id)
    await sleep(400)
    signal.throwIfAborted()
  }
}

const openSection = (id: string) =>
  untilDone(
    () => !!viewSettingsSectionOpen(id),
    root => openViewSettingsSection(root, id),
  )

const LISTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Длинные имена', en: 'Long names' },
    hint: {
      ru: 'У колонок и вариантов длинные имена, по одной колонке стоит отбор.',
      en: 'Columns and options have long names, and one column is filtered.',
    },
  },
  {
    title: { ru: 'Список колонок', en: 'The column list' },
    hint: {
      ru: 'Пользователь открыл список колонок — длинное имя в одну строку с многоточием.',
      en: 'The user opened the column list; a long name stays on one line with an ellipsis.',
    },
    enter: openSection('columns'),
  },
  {
    title: { ru: 'Подсказка у имени', en: 'A tooltip on a name' },
    hint: {
      ru: 'Пользователь навёл указатель на обрезанное имя — подсказка с полным текстом.',
      en: 'The user hovered over a truncated name; a tooltip shows the full text.',
    },
    states: ['overlay.tooltip'],
    enter: stepAction(async (root, { signal, onLeave }) => {
      await ensureSection(root, 'columns', signal)
      await pollUntil(() => !!columnLabel('account'), signal)
      onLeave(pointAt(columnLabel('account')!))
    }),
  },
  {
    title: { ru: 'Условие отбора', en: 'The filter condition' },
    hint: {
      ru: 'Пользователь открыл раздел отбора — длинное условие занимает две строки, дальше многоточие.',
      en: 'The user opened the filter section; a long condition takes two lines, then an ellipsis.',
    },
    enter: openSection('filter'),
  },
  {
    title: { ru: 'Подсказка у условия', en: 'A tooltip on the condition' },
    hint: {
      ru: 'Пользователь навёл указатель на обрезанное условие — подсказка с полным текстом.',
      en: 'The user hovered over the truncated condition; a tooltip shows the full text.',
    },
    states: ['overlay.tooltip'],
    enter: stepAction(async (root, { signal, onLeave }) => {
      await ensureSection(root, 'filter', signal)
      await pollUntil(() => !!filterCondition(), signal)
      onLeave(pointAt(filterCondition()!))
    }),
  },
]

/** ADR 0083, S2: длинные имена в списках — одна строка с многоточием и подсказка. */
export const LongTextLists: StoryObj<StoryProps> = {
  name: 'Lists',
  parameters: { scenario: '0083/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Длинные имена в списках', en: 'Long names in lists' }}
      steps={LISTS}
      args={guideArgs(
        {
          ...LONG_LABELS,
          height: '400',
          containerWidth: 560,
          columnFilteringInitialColumnFilters: [
            {
              id: 'status',
              value: { operator: 'anyOf', value: ['review', 'approved'] },
            },
          ],
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LISTS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(LISTS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(columnLabel('account')).not.toBeNull())
      const label = columnLabel('account')!
      await expect(getComputedStyle(label).textOverflow).toBe('ellipsis')
      await until(() => expect(clipped(columnLabel('account'))).toBe(true))
      await settle()
    })
    await step(LISTS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(kitTips()).toContain(LONG_COLUMN))
      await settle()
    })
    await step(LISTS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(filterCondition()).not.toBeNull())
      const condition = filterCondition()!
      await expect(
        condition.getBoundingClientRect().height,
      ).toBeLessThanOrEqual(lineHeight(condition) * 2 + 1)
      await until(() => expect(clipped(filterCondition())).toBe(true))
      await settle()
    })
    await step(LISTS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const text = filterCondition()!.textContent!.trim()
      await until(() => expect(kitTips()).toContain(text))
      await settle()
    })
  },
}
