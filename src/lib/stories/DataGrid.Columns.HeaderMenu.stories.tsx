import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { definePlugin } from '../core/definePlugin'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { filteringColumns, filteringData } from './__mocks__/filteringData'
import {
  afterRows,
  guideNext,
  headKebab,
  pointAt,
  pollUntil,
  pressEscape,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { clickByMouse } from './__mocks__/cellGestures'
import { dragGripTo, separatorOf } from './__mocks__/columnGrip'
import {
  asyncHeaderActionsDemo,
  createDemoServer,
} from './__mocks__/plugins/asyncActionsDemo/asyncActionsDemo'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  type StepRun,
  stepAction,
} from './demos/DemoStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Меню колонки (ADR 0024) и отметки включённых действий (ADR 0062): действия заголовка
 * от порога собираются в меню, включённое действие видно на своей кнопке; асинхронное
 * действие меню ждёт сервер (ADR 0078). `Playground` — песочница, остальное — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Header menu',
} satisfies Meta<StoryProps>

export default meta

export const HeaderMenuPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableColumnSorting',
      'enableColumnPinning',
      'enableRowGrouping',
      'enableColumnFiltering',
      'enableColumnVisibility',
      'enableColumnSizing',
    ],
    { rowHeight: 'Does not affect the header' },
  ),
  args: {
    // Закрепление, сортировка и группировка — три действия, порог по умолчанию: все в
    // меню колонки. Ручка ширины в порог не входит.
    enableHeaderActionMenu: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableRowGrouping: true,
    enableColumnSizing: true,
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

const headCellOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )
const buttonOf = (root: ParentNode, id: string, kind: string) =>
  headCellOf(root, id)?.querySelector<HTMLElement>(`.${kind}__button`) ?? null
const openMenu = () => document.querySelector<HTMLElement>('[role="menu"]')
/** Пункты меню действия — по его `id`, а не по подписи. */
const menuItemsOf = (menu: HTMLElement | null, action: string) => [
  ...(menu?.querySelectorAll<HTMLElement>(
    `[role^="menuitem"][data-action-id="${action}"]`,
  ) ?? []),
]
/** Отметка включённого действия на кнопке видна. */
const marked = (button: HTMLElement | null) => {
  const dot = button?.querySelector<HTMLElement>('[data-active-indicator]')
  return !!dot && getComputedStyle(dot).opacity === '1'
}

// --- ADR 0024 S1 ---------------------------------------------------------------------

const MENU_COLUMN = 'country'

/** Открыть меню колонки нажатием на его кнопку; `then` — когда меню открыто. */
const inColumnMenu =
  (then: (menu: HTMLElement, root: HTMLElement) => boolean = () => true) =>
  (root: HTMLElement, signal: AbortSignal) => {
    let tries = 0
    const run = () => {
      if (signal.aborted) return
      const menu = openMenu()
      if (menu?.hasAttribute('data-open')) {
        if (then(menu, root) || ++tries > 20) return
      } else if (!menu) headKebab(root, MENU_COLUMN)?.click()
      setTimeout(run, 50)
    }
    setTimeout(run, 0)
  }

const pinned = (root: ParentNode) =>
  headCellOf(root, MENU_COLUMN)?.getAttribute('data-cell-pinned') === 'left'

/**
 * Закрепить колонку пунктом меню. Включённое закрепление встаёт в заголовок кнопкой
 * (ADR 0156).
 */
const pinFromMenu = async (root: HTMLElement, signal: AbortSignal) => {
  let chosen = false
  let leftHeader = false
  await pollUntil(() => {
    if (pinned(root) && !openMenu()) {
      // После закрытия меню фокус может вернуться в шапку и удержать раскладку.
      const head = headCellOf(root, MENU_COLUMN)
      if (head && !leftHeader) {
        head.dispatchEvent(
          new PointerEvent('pointerout', {
            bubbles: true,
            pointerType: 'mouse',
            relatedTarget: document.body,
          }),
        )
        leftHeader = true
      }
      const focus = document.activeElement
      if (focus instanceof HTMLElement && head?.contains(focus)) {
        focus.blur()
      }
      return marked(buttonOf(root, MENU_COLUMN, 'column-pin'))
    }
    const menu = openMenu()
    if (!menu) {
      if (!chosen) headKebab(root, MENU_COLUMN)?.click()
      return false
    }
    if (!menu.hasAttribute('data-open') || chosen) return false
    const item = menuItemsOf(menu, 'columnPinning')[0]
    if (!item) return false
    item.click()
    chosen = true
    return false
  }, signal)
}

const IN_MENU: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Кнопки в заголовке', en: 'Buttons in the header' },
    hint: {
      ru: 'Таблица отображает колонки с двумя действиями: сортировкой и закреплением. Кнопки действий расположены прямо в заголовке.',
      en: 'The table shows columns with two actions: sorting and pinning. The action buttons sit right in the header.',
    },
  },
  {
    title: {
      ru: 'Действия собраны в меню',
      en: 'Actions are gathered in a menu',
    },
    hint: {
      ru: 'Приложение включило ещё одно действие колонки — группировку строк. Действий стало больше порога, и все они собираются в меню колонки. Кнопка меню появляется при наведении на заголовок.',
      en: 'The app turned on one more column action: row grouping. There are now more actions than the threshold, so all of them are gathered in the column menu. The menu button appears when the pointer is over the header.',
    },
    props: () => ({ enableRowGrouping: true }),
  },
  {
    title: {
      ru: 'Пользователь открыл меню колонки',
      en: 'The user opened the column menu',
    },
    hint: {
      ru: 'Меню разделено на группы по действиям. Сортировка в нём представлена отдельными пунктами для каждого направления и сброса.',
      en: 'The menu is split into groups by action. Sorting has separate items for each direction and for resetting.',
    },
    states: ['overlay.menu'],
    enter: afterRows(inColumnMenu()),
  },
  {
    title: {
      ru: 'Пользователь закрепил колонку из меню',
      en: 'The user pinned the column from the menu',
    },
    hint: {
      ru: 'Колонка закреплена у левого края. Включённое закрепление встало в заголовок кнопкой с отметкой, остальные действия остались в меню.',
      en: 'The column is pinned to the left edge. The active pinning moved into the header as a marked button, and the other actions stayed in the menu.',
    },
    states: ['head.activeIndicator'],
    enter: stepAction((root, { signal }) => pinFromMenu(root, signal)),
  },
]

/** ADR 0024, S1: действия колонки от порога собираются в меню, пункт меню их выполняет. */
export const HeaderMenuInMenu: StoryObj<StoryProps> = {
  name: 'Actions in menu',
  parameters: {
    scenario: '0024/S1',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{ ru: 'Действия колонки в меню', en: 'Column actions in a menu' }}
      steps={IN_MENU}
      args={guideArgs(
        {
          enableHeaderActionMenu: true,
          enableColumnSorting: true,
          enableColumnPinning: true,
          dataCount: 30,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(IN_MENU[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-sort')).not.toBeNull()
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-pin')).not.toBeNull()
      await expect(headKebab(canvas, MENU_COLUMN)).toBeNull()
    })
    await step(IN_MENU[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headKebab(canvas, MENU_COLUMN)).not.toBeNull())
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-sort')).toBeNull()
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-pin')).toBeNull()
    })
    await step(IN_MENU[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      await expect(
        openMenu()!.querySelectorAll('[role="group"]').length,
      ).toBeGreaterThan(1)
      await expect(
        menuItemsOf(openMenu(), 'columnSorting').length,
      ).toBeGreaterThanOrEqual(3)
      await settle()
    })
    await step(IN_MENU[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(pinned(canvas)).toBe(true))
      await until(() =>
        expect(marked(buttonOf(canvas, MENU_COLUMN, 'column-pin'))).toBe(true),
      )
      await expect(openMenu()).toBeNull()
      await settle()
    })
  },
}

// --- ADR 0062 S1 ---------------------------------------------------------------------

interface ActionsApi {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  setColumnVisibility: (value: Record<string, boolean>) => void
}

let actionsApi: ActionsApi | null = null

/** Отдаёт таблицу шагам истории — действия включают, как пользователь кнопками. */
const actionsHost = definePlugin<{ enabled?: boolean }>()({
  id: 'headerMenuActionsHost',
  setup: () => table => {
    actionsApi = table as unknown as ActionsApi
    return () => {
      actionsApi = null
    }
  },
})

const SORT_NAME = [{ id: 'name', desc: false }]
const SORT_TWO = [...SORT_NAME, { id: 'age', desc: false }]
const FILTER_AGE = [
  { id: 'age', value: { operator: 'greaterThanOrEqual', value: 30 } },
]
const HIDE_VISITS = { visits: false }

/** Включённые действия шага целиком: шаг приходит к ним из любого другого. */
const withActions = (
  sorting: { id: string; desc: boolean }[],
  filters: { id: string; value: unknown }[] = [],
  visibility: Record<string, boolean> = {},
) =>
  afterRows(() => {
    actionsApi?.setSorting(sorting)
    actionsApi?.setColumnFilters(filters)
    actionsApi?.setColumnVisibility(visibility)
  })

const ACTIVE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Действия не включены', en: 'No actions are on' },
    hint: {
      ru: 'Таблица отображает колонки с кнопками сортировки и фильтра. Ни одно действие не включено.',
      en: 'The table shows columns with sort and filter buttons. None of the actions is on.',
    },
  },
  {
    title: {
      ru: 'Пользователь отсортировал колонку',
      en: 'The user sorted a column',
    },
    hint: {
      ru: 'На кнопке сортировки появляется отметка: по заголовку видно, что сортировка включена.',
      en: 'A mark appears on the sort button: the header shows that sorting is on.',
    },
    enter: withActions(SORT_NAME),
    states: ['head.activeIndicator'],
  },
  {
    title: {
      ru: 'Сортировка по второй колонке',
      en: 'Sorting by a second column',
    },
    hint: {
      ru: 'Пользователь добавил сортировку по ещё одной колонке. Вместо отметки на кнопках сортировки показывается номер приоритета.',
      en: 'The user added sorting by one more column. Instead of a mark, the sort buttons show the priority number.',
    },
    enter: withActions(SORT_TWO),
    states: ['head.sorting'],
  },
  {
    title: {
      ru: 'Пользователь применил фильтр',
      en: 'The user applied a filter',
    },
    hint: {
      ru: 'Отметка появляется и на кнопке фильтра колонки.',
      en: 'A mark appears on the column filter button too.',
    },
    enter: withActions(SORT_TWO, FILTER_AGE),
    states: ['head.activeIndicator'],
  },
  {
    title: { ru: 'Пользователь скрыл колонку', en: 'The user hid a column' },
    hint: {
      ru: 'Число на кнопке «Настройки вида» выросло: теперь включены сортировка, фильтр и скрытые колонки.',
      en: 'The number on the “View settings” button went up: sorting, a filter, and hidden columns are now on.',
    },
    enter: withActions(SORT_TWO, FILTER_AGE, HIDE_VISITS),
    states: ['head.activeIndicator'],
  },
  {
    title: { ru: 'Действия в меню колонки', en: 'Actions in the column menu' },
    hint: {
      ru: 'Приложение собрало действия колонки в меню. Кнопка меню колонки с включёнными действиями отмечена и видна без наведения.',
      en: 'The app gathered the column actions in a menu. For a column with active actions, the column menu button is marked and visible without hovering.',
    },
    props: () => ({
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    }),
    enter: withActions(SORT_TWO, FILTER_AGE, HIDE_VISITS),
    states: ['head.activeIndicator'],
  },
]

/** ADR 0062, S1: включённые действия видны отметками на своих кнопках. */
export const HeaderMenuActiveActions: StoryObj<StoryProps> = {
  name: 'Active actions',
  parameters: {
    scenario: '0062/S1',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Включённые действия видны',
        en: 'Active actions are visible',
      }}
      steps={ACTIVE}
      args={guideArgs(
        {
          columnsOverride: filteringColumns,
          dataOverride: filteringData,
          enableColumnSorting: true,
          enableColumnFiltering: true,
          enableColumnVisibility: true,
          extraPlugins: [actionsHost()],
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const sort = (id: string) => buttonOf(canvas, id, 'column-sort')
    const filter = (id: string) => buttonOf(canvas, id, 'column-filter')
    const viewSettingsButton = () =>
      canvas.querySelector<HTMLElement>('[data-testid="view-settings-button"]')
    await step(ACTIVE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(marked(sort('name'))).toBe(false)
      await expect(marked(filter('age'))).toBe(false)
    })
    await step(ACTIVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(sort('name'))).toBe(true))
      await settle()
    })
    await step(ACTIVE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sort('age')?.textContent).toContain('2'))
      await expect(sort('name')?.textContent).toContain('1')
      await settle()
    })
    await step(ACTIVE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(filter('age'))).toBe(true))
      await settle()
    })
    await step(ACTIVE[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(viewSettingsButton()?.textContent).toContain('3'),
      )
      await settle()
    })
    await step(ACTIVE[5]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(headKebab(canvas, 'name'))).toBe(true))
      await expect(getComputedStyle(headKebab(canvas, 'name')!).opacity).toBe(
        '1',
      )
      await settle()
    })
  },
}

// --- ADR 0156 S1 ---------------------------------------------------------------------

interface NarrowApi {
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnSizing: (value: Record<string, number>) => void
}

let narrowApi: NarrowApi | null = null

/** Отдаёт таблицу шагам: сброс сортировки и ширины — как с чистого листа. */
const narrowHost = definePlugin<{ enabled?: boolean }>()({
  id: 'headerMenuNarrowHost',
  setup: () => table => {
    narrowApi = table as unknown as NarrowApi
    // Узкая колонка — с открытия таблицы.
    narrowApi.setColumnSizing({ [NARROW_COLUMN]: NARROW_WIDTH })
    return () => {
      narrowApi = null
    }
  },
})

const NARROW_COLUMN = 'name'
const NARROW_WIDTH = 180
const WIDE_WIDTH = 260
const NARROW_COLUMNS = filteringColumns.map(column =>
  column.id === NARROW_COLUMN ? { ...column, size: NARROW_WIDTH } : column,
)

const pinButton = (root: ParentNode) =>
  buttonOf(root, NARROW_COLUMN, 'column-pin')
const sortButton = (root: ParentNode) =>
  buttonOf(root, NARROW_COLUMN, 'column-sort')
const sorted = (root: ParentNode = document) =>
  headCellOf(root, NARROW_COLUMN)?.getAttribute('aria-sort') === 'ascending'

/** Колонка узкая, сортировки нет, указателя над заголовком нет. */
const narrowRest = (sorting: { id: string; desc: boolean }[] = []) =>
  afterRows(() => {
    narrowApi?.setColumnSizing({ [NARROW_COLUMN]: NARROW_WIDTH })
    narrowApi?.setSorting(sorting)
  })

/** Сортировка по возрастанию — пунктом меню колонки; пункт закрывает меню. */
const sortFromMenu = async (root: HTMLElement, signal: AbortSignal) => {
  narrowApi?.setColumnSizing({ [NARROW_COLUMN]: NARROW_WIDTH })
  if (sorted()) return
  narrowApi?.setSorting([])
  let chosen = false
  await pollUntil(() => {
    if (sorted()) return true
    const menu = openMenu()
    if (!menu) {
      const trigger = headKebab(root, NARROW_COLUMN)
      if (!chosen && trigger) clickByMouse(trigger)
      return false
    }
    if (!menu.hasAttribute('data-open') || chosen) return false
    const ascending = menu.querySelector<HTMLElement>(
      '[data-action-id="columnSorting"][data-item-id="asc"]',
    )
    if (!ascending) return false
    ascending.click()
    chosen = true
    return false
  }, signal)
  await pollUntil(() => !openMenu(), signal)
}

const NARROW_HOVER = {
  hover: `.data-grid__head-cell[data-column-id="${NARROW_COLUMN}"]`,
}

/** Указатель над заголовком, когда ряд уже такой, каким его ждёт шаг. */
const pointWhen =
  (ready: (root: HTMLElement) => boolean) =>
  async (root: HTMLElement, { signal, onLeave }: StepRun) => {
    await pollUntil(() => ready(root), signal)
    onLeave(pointAt(headCellOf(root, NARROW_COLUMN)!))
  }

const NARROW: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Узкая колонка', en: 'A narrow column' },
    hint: {
      ru: 'Первая колонка узкая: в её заголовке помещается одна кнопка и кнопка меню. Указатель вне таблицы.',
      en: 'The first column is narrow: its header fits one button and the menu button. The pointer is outside the table.',
    },
  },
  {
    title: {
      ru: 'Указатель над заголовком',
      en: 'The pointer is over the header',
    },
    hint: {
      ru: 'Указатель над заголовком первой колонки. В нём помещается одна кнопка и кнопка меню: в ряду — закрепление, сортировка и фильтр — в меню колонки.',
      en: 'The pointer is over the header of the first column. It fits one button and the menu button: pinning is in the row, while sorting and the filter are in the column menu.',
    },
    pseudo: NARROW_HOVER,
    enter: stepAction(async (root, run) => {
      narrowRest()(root)
      await pointWhen(el => !!pinButton(el) && !sorted(el))(root, run)
    }),
  },
  {
    title: {
      ru: 'Сортировка включена из меню',
      en: 'Sorting was turned on from the menu',
    },
    hint: {
      ru: 'Пользователь открыл меню колонки и выбрал сортировку по возрастанию. Включённая сортировка встала в ряд и видна с отметкой без наведения.',
      en: 'The user opened the column menu and chose ascending sorting. The active sorting moved into the row and stays visible, with a mark, even without hovering.',
    },
    states: ['head.activeIndicator'],
    enter: stepAction((root, { signal }) => sortFromMenu(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь выключил сортировку кнопкой',
      en: 'The user turned sorting off with the button',
    },
    hint: {
      ru: 'Указатель над заголовком: кнопка сортировки осталась на месте без отметки, повторное нажатие снова включит сортировку. Закрепление — в меню колонки.',
      en: 'The pointer is over the header: the sort button stayed in place without a mark, and pressing it again will turn sorting back on. Pinning is in the column menu.',
    },
    pseudo: NARROW_HOVER,
    enter: stepAction(async (root, { signal, onLeave }) => {
      await sortFromMenu(root, signal)
      // Тронутый заголовок ряд не перестраивает (ADR 0156, §2): фокус, вернувшийся на
      // кнопку меню, уходит, и включённая сортировка встаёт в ряд до наведения.
      const head = headCellOf(root, NARROW_COLUMN)!
      if (head.contains(document.activeElement))
        (document.activeElement as HTMLElement).blur()
      await pollUntil(() => !!sortButton(root), signal)
      onLeave(pointAt(head))
      sortButton(root)!.click()
      await pollUntil(() => !sorted(), signal)
    }),
  },
  {
    title: { ru: 'Указатель вернулся', en: 'The pointer is back' },
    hint: {
      ru: 'Пользователь увёл указатель с заголовка и навёл снова. Невключённая сортировка ушла в меню, кнопка закрепления вернулась в ряд.',
      en: 'The user moved the pointer off the header and back again. Sorting, now inactive, went into the menu, and the pin button returned to the row.',
    },
    pseudo: NARROW_HOVER,
    enter: stepAction(async (root, run) => {
      narrowRest()(root)
      await pointWhen(el => !!pinButton(el) && !sorted(el))(root, run)
    }),
  },
  {
    title: { ru: 'Колонку расширили', en: 'The column was widened' },
    hint: {
      ru: 'Пользователь расширил колонку: все три кнопки помещаются в ряд. В меню колонки остались только пункты её ширины.',
      en: 'The user widened the column: all three buttons fit in the row. Only the column width items remain in the column menu.',
    },
    pseudo: NARROW_HOVER,
    enter: stepAction(async (root, run) => {
      await pollUntil(
        () => !!narrowApi && !!separatorOf(root, NARROW_COLUMN),
        run.signal,
      )
      narrowApi!.setSorting([])
      await dragGripTo(root, run, NARROW_COLUMN, WIDE_WIDTH)
      await pointWhen(el => !!pinButton(el) && !!sortButton(el))(root, run)
    }),
  },
]

/** ADR 0156, S1: в узкой колонке включённое действие уходит в меню последним. */
export const HeaderMenuNarrowActive: StoryObj<StoryProps> = {
  name: 'Narrow column',
  parameters: {
    scenario: '0156/S1',
    ...guideControls(),
  },
  render: (args, { globals }) => (
    <DemoStory
      showActions={globals.catalog === true ? true : undefined}
      title={{
        ru: 'Включённое действие остаётся в ряду',
        en: 'An active action stays in the row',
      }}
      steps={NARROW}
      args={guideArgs(
        {
          columnsOverride: NARROW_COLUMNS,
          dataOverride: filteringData,
          enableHeaderActionMenu: true,
          // Три действия и кнопка меню с пунктами ширины колонки ниже порога: в меню их
          // уводит только ширина колонки.
          headerActionMenuThreshold: 5,
          enableColumnPinning: true,
          enableColumnSorting: true,
          enableColumnFiltering: true,
          enableColumnSizing: true,
          extraPlugins: [narrowHost()],
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const kebab = () => headKebab(canvas, NARROW_COLUMN)
    await step(NARROW[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(NARROW[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(pinButton(canvas)).not.toBeNull())
      await until(() => expect(sortButton(canvas)).toBeNull())
      await until(() => expect(kebab()).not.toBeNull())
    })
    await step(NARROW[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(marked(sortButton(canvas))).toBe(true))
      await until(() => expect(pinButton(canvas)).toBeNull())
      // Отметка уходит с кнопки меню переходом.
      await until(() => expect(marked(kebab())).toBe(false))
      await settle()
    })
    await step(NARROW[3]!.title.ru, async () => {
      await guideNext(canvas)
      // Со свежей таблицы сортировки нет сразу: ждать, пока шаг включит и выключит её.
      await stepDone(canvas)
      await until(() => expect(sorted()).toBe(false))
      await until(() => expect(sortButton(canvas)).not.toBeNull())
      await until(() => expect(marked(sortButton(canvas))).toBe(false))
      await until(() => expect(pinButton(canvas)).toBeNull())
      await settle()
    })
    await step(NARROW[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pinButton(canvas)).not.toBeNull())
      await until(() => expect(sortButton(canvas)).toBeNull())
      await settle()
    })
    await step(NARROW[5]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(sortButton(canvas)).not.toBeNull())
      await until(() => expect(pinButton(canvas)).not.toBeNull())
      await until(() => expect(marked(kebab())).toBe(false))
      await settle()
    })
  },
}

// --- ADR 0078 S1 ---------------------------------------------------------------------

/** «Сервер» гайда: придерживает ответы, пока шаг на виду. */
const INDEX_SERVER = createDemoServer()

const indexDemo: TesseraFeatureEntry = {
  id: 'headerIndexDemo',
  slotActions: asyncHeaderActionsDemo(INDEX_SERVER),
}

const INDEX_ACTION = '[data-action-id="asyncBuildIndex"]'

/** Действие колонки ждёт: заняты ячейки колонки, а не кебаб (ADR 0177, §1). */
const busy = (root: ParentNode, column: string) =>
  !!root.querySelector(
    `.data-grid__body-cell[data-column-id="${column}"][aria-busy="true"]`,
  )

/** Отказ действия колонки — вспышка отката на ней. */
const refusedFlash = (root: ParentNode, column: string) =>
  headCellOf(root, column)?.getAttribute('data-column-flash') === 'reverted'

const itemEnabled = (item: HTMLElement | null) =>
  !!item &&
  !item.hasAttribute('data-disabled') &&
  item.getAttribute('aria-disabled') !== 'true'

const expandedMenuOf = (root: ParentNode, column: string) =>
  headKebab(root, column)?.getAttribute('aria-expanded') === 'true'

/** Прокрутить таблицу так, чтобы заголовок колонки был виден целиком, как сделал бы пользователь. */
const revealColumn = (root: ParentNode, column: string) => {
  const scroller = root.querySelector<HTMLElement>('.data-grid__container')
  const cell = root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"]`,
  )
  if (!scroller || !cell) return
  const left = scroller.getBoundingClientRect().left + scroller.clientLeft
  const right = left + scroller.clientWidth
  const { left: cellLeft, right: cellRight } = cell.getBoundingClientRect()
  if (cellRight > right) scroller.scrollLeft += cellRight - right
  else if (cellLeft < left) scroller.scrollLeft -= left - cellLeft
}

/**
 * Довести таблицу до состояния шага: меню колонки `column` открыто (меню другой
 * колонки закрывается), `act` действует в нём, пока не выполнится `done`.
 * Таймером, а не кадрами: в фоновой вкладке кадры стоят.
 */
const inIndexMenu =
  (
    column: string,
    done: (root: HTMLElement) => boolean = root => expandedMenuOf(root, column),
    act: (menu: HTMLElement) => void = () => {},
  ) =>
  (root: HTMLElement, signal: AbortSignal) => {
    let tries = 0
    const run = () => {
      if (signal.aborted || done(root) || ++tries > 80) return
      const menu = document.querySelector<HTMLElement>('[role="menu"]')
      if (menu?.hasAttribute('data-open')) {
        if (expandedMenuOf(root, column)) act(menu)
        else pressEscape()
      } else if (!menu && !busy(root, column)) {
        revealColumn(root, column)
        headKebab(root, column)?.click()
      }
      setTimeout(run, 100)
    }
    setTimeout(run, 0)
  }

/** Выбрать построение индекса в меню колонки, когда пункт доступен. */
const runIndex = (menu: HTMLElement) => {
  const item = menu.querySelector<HTMLElement>(INDEX_ACTION)
  if (itemEnabled(item)) item!.click()
}

const ASYNC_ACTIONS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Меню ещё не открыто', en: 'The menu is not open yet' },
    hint: {
      ru: 'Приложение добавило в меню колонки своё действие, доступность которого решает сервер. Пользователь ещё не открывал меню.',
      en: 'The app added its own action to the column menu, and the server decides whether it is available. The user has not opened the menu yet.',
    },
  },
  {
    title: { ru: 'Проверка доступности', en: 'Checking availability' },
    hint: {
      ru: 'Приложение добавило в меню колонки своё действие, доступность которого решает сервер. Пользователь открыл меню: пока сервер не ответил, пункт заблокирован и показывает ожидание.',
      en: 'The app added its own action to the column menu, and the server decides whether it is available. The user opened the menu: until the server responds, the item is disabled and shows a pending state.',
    },
    states: ['overlay.menu'],
    enter: afterRows((root, signal) => {
      INDEX_SERVER.checks.hold()
      INDEX_SERVER.runs.release()
      inIndexMenu('country')(root, signal)
    }),
  },
  {
    title: { ru: 'Действие уже выполнено', en: 'The action is already done' },
    hint: {
      ru: 'Сервер ответил, что для этой колонки действие уже выполнено. Пункт заблокирован и отмечен как выполненный, причина — в подсказке пункта.',
      en: 'The server responded that the action is already done for this column. The item is disabled and marked as done; the reason is in the item tooltip.',
    },
    states: ['overlay.menu'],
    enter: afterRows((root, signal) => {
      INDEX_SERVER.checks.release()
      inIndexMenu('country')(root, signal)
    }),
  },
  {
    title: { ru: 'Действие запрещено', en: 'The action is not allowed' },
    hint: {
      ru: 'Пользователь открыл меню другой колонки. Сервер запретил для неё действие: пункт заблокирован со значком запрета, причина — в подсказке пункта.',
      en: 'The user opened the menu of another column. The server did not allow the action for it: the item is disabled with a forbidden icon, and the reason is in the item tooltip.',
    },
    states: ['overlay.menu'],
    enter: afterRows((root, signal) => {
      INDEX_SERVER.checks.release()
      inIndexMenu('total')(root, signal)
    }),
  },
  {
    title: { ru: 'Действие выполняется', en: 'The action is running' },
    hint: {
      ru: 'Пользователь выбрал действие в колонке, где оно доступно. Меню закрылось, а ячейки колонки показывают ожидание, пока сервер выполняет действие.',
      en: 'The user chose the action in a column where it is available. The menu closed, and the column cells show a pending state while the server performs the action.',
    },
    states: ['head.kebab'],
    enter: afterRows((root, signal) => {
      INDEX_SERVER.checks.release()
      INDEX_SERVER.runs.hold()
      inIndexMenu(
        'lastName',
        root => busy(root, 'lastName'),
        runIndex,
      )(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не выполнил действие. Ожидание с ячеек колонки снято, колонка коротко вспыхивает тоном ошибки, подсказка кнопки меню колонки называет невыполненное действие.',
      en: 'The server did not perform the action. The pending state is cleared from the column cells, the column flashes briefly in the error tone, and the column menu button tooltip names the failed action.',
    },
    states: ['head.kebab'],
    enter: afterRows((root, signal) => {
      INDEX_SERVER.checks.release()
      INDEX_SERVER.runs.release()
      inIndexMenu(
        'lastName',
        root => busy(root, 'lastName') || refusedFlash(root, 'lastName'),
        runIndex,
      )(root, signal)
    }),
  },
]

/** ADR 0078, S1: действие меню колонки ждёт сервер — проверка, запрет, ожидание, отказ. */
export const HeaderMenuAsyncActions: StoryObj<StoryProps> = {
  name: 'Async actions',
  parameters: {
    scenario: '0078/S1',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Асинхронные действия в меню колонки',
        en: 'Async actions in the column menu',
      }}
      steps={ASYNC_ACTIONS}
      args={guideArgs(
        {
          enableHeaderActionMenu: true,
          enableColumnSorting: true,
          extraPlugins: [indexDemo],
          dataCount: 30,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const item = () => document.querySelector<HTMLElement>(INDEX_ACTION)
    const description = () =>
      document.getElementById(item()?.getAttribute('aria-describedby') ?? '')
        ?.textContent ?? ''
    await step(ASYNC_ACTIONS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ASYNC_ACTIONS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(expandedMenuOf(canvas, 'country')).toBe(true))
      await until(() => expect(description()).toBe(labels.availabilityChecking))
      await until(() => expect(itemEnabled(item())).toBe(false))
    })
    await step(ASYNC_ACTIONS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(description()).toBe('The column is already indexed'),
      )
      await expect(itemEnabled(item())).toBe(false)
      await settle()
    })
    await step(ASYNC_ACTIONS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(expandedMenuOf(canvas, 'total')).toBe(true))
      await until(() =>
        expect(description()).toBe("Computed columns can't be indexed"),
      )
      await expect(itemEnabled(item())).toBe(false)
      await settle()
    })
    await step(ASYNC_ACTIONS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(canvas, 'lastName')).toBe(true))
      await until(() =>
        expect(document.querySelector('[role="menu"][data-open]')).toBeNull(),
      )
    })
    await step(ASYNC_ACTIONS[5]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refusedFlash(canvas, 'lastName')).toBe(true))
      await until(() => expect(busy(canvas, 'lastName')).toBe(false))
      await until(() =>
        expect(
          headKebab(canvas, 'lastName')?.getAttribute('aria-label'),
        ).toContain(labels.actionsFailed('Build index')),
      )
      await settle()
    })
  },
}
