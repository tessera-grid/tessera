import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  FRESH_ATTR,
  guideNext,
  openMenuBy,
  pollUntil,
  pressEscape,
  settle,
  stepDone,
  tooltipText,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  PHONE,
  TOUCH_ARGS,
  hasRealTouchDrivers,
  holdTarget,
  moveMouse,
  openMenu,
  realTapTarget,
  tapButton,
  tapTarget,
} from './__mocks__/touchGuides'
import { overflowColumns, overflowData } from './__mocks__/overflowColumns'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Касания (ADR 0086, ADR 0231): таблица в окне телефона со всеми целями под палец. Таблица
 * узнаёт палец по событиям касания и по экрану без наведения: окно Storybook меняет только
 * размер — проверяйте в режиме устройства DevTools браузера или с телефона.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Touch',
} satisfies Meta<StoryProps>

export default meta

const NOT_TOUCH = 'Does not affect touch'

/** Плагины с целями под палец: кнопки шапки и ячеек, грип, ручки, флажки, меню. */
export const TouchPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableColumnSorting',
      'enableColumnSizing',
      'enableColumnDragging',
      'enableHeaderActionMenu',
      'enableRowSelection',
      'enableRowDragging',
      'enableCellEditing',
      'enableCellSelection',
      'enableContextMenu',
      'containerWidth',
    ],
    {
      containerHeight: NOT_TOUCH,
      maxHeight: NOT_TOUCH,
      defaultColumn: NOT_TOUCH,
    },
  ),
  globals: PHONE,
  args: {
    enableColumnSorting: true,
    enableColumnSizing: true,
    enableColumnDragging: true,
    enableHeaderActionMenu: true,
    enableRowDragging: true,
    enableRowSelection: true,
    enableCellEditing: true,
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 60,
    containerWidth: 360,
    // Строк больше, чем помещается: таблица прокручивается пальцем внутри себя.
    height: '460',
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

// --- Помощники -----------------------------------------------------------------------

/** Колонка с кнопкой правки ячейки. */
const EDIT_COLUMN = 'age'

const rowAt = (root: ParentNode, index: number) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-index="${index}"]`)

const cellAt = (root: ParentNode, index: number, column = EDIT_COLUMN) =>
  rowAt(root, index)?.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  ) ?? null

const headOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )

/** Чип строки виден: скрытый гасит свою заливку (buttonVisibility.css). */
const chipShown = (el: Element | null | undefined) =>
  !!el && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'

/** Скрытая кнопка видна: непрозрачна и раскрыта. */
const shown = (el: Element | null | undefined) =>
  !!el &&
  Number(getComputedStyle(el).opacity) === 1 &&
  el.getBoundingClientRect().width > 1

// --- S1 ------------------------------------------------------------------------------

const CELL_BUTTONS_ARGS = { ...TOUCH_ARGS, enableKeyboardNavigation: true }

const touched = (root: ParentNode, index: number) =>
  !!cellAt(root, index)?.hasAttribute('data-touched')

const BUTTONS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Кнопки скрыты', en: 'Buttons are hidden' },
    hint: {
      ru: 'На сенсорном экране кнопки ячеек скрыты, пока ячейки не коснулись.',
      en: 'On a touch screen, cell buttons stay hidden until the cell is touched.',
    },
  },
  {
    title: { ru: 'Касание ячейки', en: 'A cell is touched' },
    hint: {
      ru: 'Пользователь коснулся ячейки — у неё появились кнопки.',
      en: 'The user touched a cell; its buttons appeared.',
    },
    enter: realTapTarget(
      root => cellAt(root, 1),
      root => touched(root, 1),
    ),
  },
  {
    title: { ru: 'Касание другой ячейки', en: 'Another cell is touched' },
    hint: {
      ru: 'Пользователь коснулся другой ячейки — кнопки переехали к ней.',
      en: 'The user touched another cell; the buttons moved to it.',
    },
    enter: realTapTarget(
      root => cellAt(root, 4),
      root => touched(root, 4),
    ),
  },
]

/** ADR 0231, S1: касание ячейки показывает её кнопки, касание другой — переносит. */
export const TouchCellButtons: StoryObj<StoryProps> = {
  name: 'Touch a cell',
  globals: PHONE,
  parameters: {
    scenario: '0231/S1',
    requirements: ['TV28'],
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Кнопки ячейки по касанию', en: 'Cell buttons on touch' }}
      steps={BUTTONS}
      args={guideArgs(CELL_BUTTONS_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const trusted: boolean[] = []
    canvas.addEventListener(
      'pointerdown',
      event => {
        if (event.pointerType === 'touch') trusted.push(event.isTrusted)
      },
      true,
    )
    const cellButtons = (index: number) => [
      ...(cellAt(canvas, index)?.querySelectorAll('.cell__button--hidden') ??
        []),
    ]
    await step(BUTTONS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(canvas.querySelector('[data-touched]')).toBeNull()
      await expect(cellButtons(1).filter(shown)).toEqual([])
    })
    await step(BUTTONS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await settle()
      await until(() => expect(cellButtons(1).length).toBeGreaterThan(0))
      await until(() => expect(cellButtons(1).every(shown)).toBe(true))
      await until(() =>
        expect(cellAt(canvas, 1)).toHaveAttribute('data-kn-active', 'true'),
      )
    })
    await step(BUTTONS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await settle()
      await until(() => expect(cellButtons(4).length).toBeGreaterThan(0))
      await until(() => expect(cellButtons(4).every(shown)).toBe(true))
      await until(() =>
        expect(cellAt(canvas, 4)).toHaveAttribute('data-kn-active', 'true'),
      )
      await until(() => expect(cellButtons(1).filter(shown)).toEqual([]))
      await settle()
    })
    if (
      hasRealTouchDrivers(canvas) &&
      !document.documentElement.hasAttribute(FRESH_ATTR)
    ) {
      expect(trusted.length).toBeGreaterThanOrEqual(2)
      expect(trusted.every(Boolean)).toBe(true)
    }
  },
}

// --- S2 ------------------------------------------------------------------------------

const ROW_ARGS = {
  ...TOUCH_ARGS,
  enableRowActionMenu: true,
  rowActionMenuMode: 'always',
} satisfies Partial<StoryProps>

const rowKebabOf = (root: ParentNode, index: number) =>
  rowAt(root, index)?.querySelector<HTMLElement>('[data-action-menu]') ?? null

const ROW: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Кнопка меню скрыта', en: 'The menu button is hidden' },
    hint: {
      ru: 'Кнопка меню строки скрыта, пока строки не коснулись.',
      en: 'The row menu button stays hidden until the row is touched.',
    },
  },
  {
    title: { ru: 'Касание строки', en: 'A row is touched' },
    hint: {
      ru: 'Пользователь коснулся строки — появилась кнопка её меню.',
      en: 'The user touched a row; its menu button appeared.',
    },
    enter: realTapTarget(root => cellAt(root, 2, 'firstName')),
  },
  {
    title: { ru: 'Меню строки', en: 'The row menu' },
    hint: {
      ru: 'Пользователь коснулся кнопки — открылось меню строки.',
      en: 'The user tapped the button; the row menu opened.',
    },
    states: ['overlay.menu'],
    enter: realTapTarget(
      root => rowKebabOf(root, 2),
      () => !!openMenu(),
    ),
  },
]

/** ADR 0231, S2: касание строки показывает её кнопки, кебаб строки открывает меню. */
export const TouchRowButtons: StoryObj<StoryProps> = {
  name: 'Touch a row',
  globals: PHONE,
  parameters: { scenario: '0231/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Меню строки по касанию', en: 'The row menu on touch' }}
      steps={ROW}
      args={guideArgs(ROW_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ROW[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(chipShown(rowKebabOf(canvas, 2))).toBe(false)
    })
    await step(ROW[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(chipShown(rowKebabOf(canvas, 2))).toBe(true))
    })
    await step(ROW[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).not.toBeNull()
      await settle()
    })
  },
}

// --- S3 ------------------------------------------------------------------------------

/** Ноутбук с сенсорным экраном: мышь и палец на одном экране. */
const HYBRID_ARGS = {
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableColumnPinning: true,
  enableColumnDragging: true,
  enableHeaderActionMenu: true,
  columnCount: 6,
  dataCount: 40,
  height: '420',
} satisfies Partial<StoryProps>

const headButtons = (root: ParentNode) => [
  ...(headOf(root, 'firstName')?.querySelectorAll('.cell__button--hidden') ??
    []),
]

const headerKebabOf = (root: ParentNode) =>
  headOf(root, 'firstName')?.querySelector<HTMLElement>('[data-action-menu]') ??
  null

const inlineHeaderActions = (root: ParentNode) =>
  headOf(root, 'firstName')?.querySelector(
    '.column-sort__button, .column-filter__button, .column-pin__button',
  ) ?? null

const sortAscendingItem = () =>
  openMenu()?.querySelector<HTMLElement>(
    '[data-action-id="columnSorting"][data-item-id="asc"]',
  ) ?? null

const openHeaderActions = stepAction(async (root, { signal }) => {
  openMenuBy(() => headerKebabOf(root), signal)
  await pollUntil(() => !!sortAscendingItem(), signal)
})

const HYBRID: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Экран с мышью', en: 'A screen with a mouse' },
    hint: {
      ru: 'При работе мышью кнопки шапки появляются по наведению.',
      en: 'With a mouse, header buttons appear on hover.',
    },
  },
  {
    title: { ru: 'Касание пальцем', en: 'A finger touch' },
    hint: {
      ru: 'После касания видны кнопка меню и ручка переноса. Остальные действия собраны в меню.',
      en: 'After a touch, the menu button and drag handle are visible. The other actions are in the menu.',
    },
    enter: realTapTarget(root => cellAt(root, 2, 'firstName')),
  },
  {
    title: { ru: 'Действия в меню', en: 'Actions in the menu' },
    hint: {
      ru: 'Кнопка меню открывается сразу. Внутри доступны сортировка, фильтр и закрепление.',
      en: 'The menu button opens immediately. Sorting, filtering, and pinning are available inside.',
    },
    states: ['overlay.menu'],
    enter: openHeaderActions,
  },
  {
    title: { ru: 'Активное действие', en: 'An active action' },
    hint: {
      ru: 'Пользователь включил сортировку. Кнопка действия осталась в меню, а точка на кнопке меню показывает активное состояние.',
      en: 'The user enabled sorting. The action stays in the menu, and a dot on the menu button shows the active state.',
    },
    enter: stepAction(async () => tapButton(sortAscendingItem())),
  },
  {
    title: { ru: 'Снова мышь', en: 'The mouse again' },
    hint: {
      ru: 'Движение мыши возвращает обычную раскладку заголовков.',
      en: 'Moving the mouse restores the usual header layout.',
    },
    enter: afterRows(moveMouse),
  },
]

/** ADR 0231, S3: касание оставляет кебаб и ручку, активные действия отмечает bubble. */
export const TouchHybridDevice: StoryObj<StoryProps> = {
  name: 'Touch on a laptop',
  parameters: { scenario: '0231/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Действия заголовка на сенсорном ноутбуке',
        en: 'Header actions on a touchscreen laptop',
      }}
      steps={HYBRID}
      // Палец из прошлой истории не переходит в эту: экран начинает с мыши.
      reset={moveMouse}
      args={guideArgs(HYBRID_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HYBRID[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(headButtons(canvas).length).toBeGreaterThan(1))
      await expect(headButtons(canvas).filter(shown)).toEqual([])
    })
    await step(HYBRID[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headButtons(canvas).every(shown)).toBe(true))
      await expect(inlineHeaderActions(canvas)).toBeNull()
      await expect(headerKebabOf(canvas)).not.toBeNull()
    })
    await step(HYBRID[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).not.toBeNull()
      await expect(sortAscendingItem()).not.toBeNull()
      await settle()
    })
    await step(HYBRID[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(headOf(canvas, 'firstName')).toHaveAttribute(
          'aria-sort',
          'ascending',
        ),
      )
      await expect(inlineHeaderActions(canvas)).toBeNull()
      await until(() => {
        const bubble = headerKebabOf(canvas)?.querySelector(
          '[data-active-indicator]',
        )
        expect(!!bubble && getComputedStyle(bubble).opacity === '1').toBe(true)
      })
      await settle()
    })
    await step(HYBRID[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(headButtons(canvas).some(button => !shown(button))).toBe(true),
      )
      await settle()
    })
  },
}

// --- S4 ------------------------------------------------------------------------------

const HINT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Кнопки без подписей', en: 'Buttons without labels' },
    hint: {
      ru: 'Подпись кнопки со значком показывает удержание пальцем.',
      en: 'Holding a finger on an icon button shows its label.',
    },
  },
  {
    title: { ru: 'Удержание кнопки', en: 'A button is held' },
    hint: {
      ru: 'Пользователь задержал палец на кнопке меню — появилась её подпись, меню не открылось.',
      en: 'The user held a finger on the menu button; its label appeared and the menu did not open.',
    },
    states: ['overlay.tooltip'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!headerKebabOf(root), signal)
      await holdTarget(headerKebabOf(root)!, signal)
    }),
  },
  {
    title: { ru: 'Касание кнопки', en: 'The button is tapped' },
    hint: {
      ru: 'Короткое касание кнопки меню открывает его.',
      en: 'A short tap on the menu button opens it.',
    },
    states: ['overlay.menu'],
    enter: openHeaderActions,
  },
]

/** ADR 0231, S4: удержание иконочной кнопки показывает её подпись, касание — нажимает. */
export const TouchIconHint: StoryObj<StoryProps> = {
  name: 'Button label on hold',
  globals: PHONE,
  parameters: { scenario: '0231/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Подпись кнопки удержанием', en: 'A button label on hold' }}
      steps={HINT}
      args={guideArgs(TOUCH_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HINT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(headerKebabOf(canvas)).not.toBeNull())
    })
    await step(HINT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const tips = () =>
        [...document.querySelectorAll('[data-tooltip-popup][data-open]')].map(
          tip => tip.textContent?.trim(),
        )
      await until(() =>
        expect(tips()).toContain(
          headerKebabOf(canvas)!.getAttribute('aria-label'),
        ),
      )
      await expect(openMenu()).toBeNull()
    })
    await step(HINT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      await settle()
    })
  },
}

// --- S5 ------------------------------------------------------------------------------

const LONG_NAME = 'Bartholomew Montgomery-Fitzgerald'

const TRUNCATED_ARGS = {
  enableContextMenu: true,
  enableCellSelection: true,
  columnsOverride: overflowColumns,
  dataOverride: overflowData,
  containerWidth: 360,
  height: '420',
} satisfies Partial<StoryProps>

const longTitle = (root: ParentNode) =>
  [
    ...root.querySelectorAll<HTMLElement>('.data-grid__cell-wrapper-title'),
  ].find(title => title.textContent === LONG_NAME) ?? null

/** Пункт «Показать полностью» — по id действия, а не по подписи языка. */
const showFullItem = () =>
  openMenu()?.querySelector<HTMLElement>('[data-action-id$="showFullText"]') ??
  null

const holdLongCell = async (root: HTMLElement, signal: AbortSignal) => {
  pressEscape()
  await pollUntil(() => !openMenu() && !!longTitle(root), signal)
  await holdTarget(longTitle(root)!, signal)
  await pollUntil(() => !!openMenu(), signal)
}

const TRUNCATED: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Текст обрезан', en: 'The text is cut off' },
    hint: {
      ru: 'Длинное имя не помещается в колонку и обрезано.',
      en: 'A long name does not fit the column and is cut off.',
    },
  },
  {
    title: { ru: 'Меню ячейки', en: 'The cell menu' },
    hint: {
      ru: 'Пользователь задержал палец на ячейке — первым пунктом меню предложено показать текст целиком.',
      en: 'The user held a finger on the cell; the first menu item offers to show the whole text.',
    },
    states: ['overlay.contextMenu'],
    enter: stepAction(async (root, { signal }) => holdLongCell(root, signal)),
  },
  {
    title: { ru: 'Текст целиком', en: 'The whole text' },
    hint: {
      ru: 'Пользователь выбрал пункт — подсказка показывает текст целиком.',
      en: 'The user picked the item; a tooltip shows the whole text.',
    },
    states: ['overlay.tooltip'],
    enter: stepAction(async (root, { signal }) => {
      tapButton(showFullItem())
      await pollUntil(() => tooltipText() === LONG_NAME, signal)
    }),
  },
]

/** ADR 0231, S5: обрезанный текст пальцем — пункт контекстного меню показывает его целиком. */
export const TouchTruncatedText: StoryObj<StoryProps> = {
  name: 'Cut-off text',
  globals: PHONE,
  parameters: { scenario: '0231/S5', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Обрезанный текст пальцем',
        en: 'Cut-off text with a finger',
      }}
      steps={TRUNCATED}
      args={guideArgs(TRUNCATED_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const steps = TRUNCATED
    await step(steps[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(longTitle(canvas)).not.toBeNull())
    })
    await step(steps[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const items = [
        ...openMenu()!.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ]
      await expect(items[0]).toBe(showFullItem())
      await settle()
    })
    await step(steps[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(tooltipText()).toBe(LONG_NAME)
      await settle()
    })
  },
}
