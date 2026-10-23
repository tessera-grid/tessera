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
  guideNext,
  headKebab,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import {
  asyncHeaderActionsDemo,
  createDemoServer,
} from './__mocks__/plugins/asyncActionsDemo/asyncActionsDemo'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
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
  tags: ['done'],
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
    { rowHeight: 'На заголовок не влияет' },
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

/** Действие шага — после отрисовки строк: ждёт таймером, а не кадрами. */
const afterRows =
  (action: (root: HTMLElement) => void) => (root: HTMLElement) => {
    const run = () =>
      root.querySelector('.data-grid__body-row')
        ? action(root)
        : setTimeout(run, 50)
    setTimeout(run, 0)
  }

// --- ADR 0024 S1 ---------------------------------------------------------------------

const MENU_COLUMN = 'country'

/** Открыть меню колонки нажатием на его кнопку; `then` — когда меню открыто. */
const inColumnMenu =
  (then: (menu: HTMLElement, root: HTMLElement) => boolean = () => true) =>
  (root: HTMLElement) => {
    let tries = 0
    const run = () => {
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

/** Закрепить колонку пунктом меню и открыть меню снова — с пунктом открепления. */
const pinFromMenu = inColumnMenu((menu, root) => {
  if (pinned(root)) return true
  menuItemsOf(menu, 'columnPinning')[0]?.click()
  return false
})

const IN_MENU: readonly GuideStoryStep[] = [
  {
    title: 'Кнопки в заголовке',
    hint: 'Таблица отображает колонки с двумя действиями: сортировкой и закреплением. Кнопки действий расположены прямо в заголовке.',
  },
  {
    title: 'Действия собраны в меню',
    hint: 'Приложение включило ещё одно действие колонки — группировку строк. Действий стало больше порога, и все они собираются в меню колонки. Кнопка меню появляется при наведении на заголовок.',
    props: () => ({ enableRowGrouping: true }),
  },
  {
    title: 'Пользователь открыл меню колонки',
    hint: 'Меню разделено на группы по действиям. Сортировка в нём представлена отдельными пунктами для каждого направления и сброса.',
    states: ['overlay.menu'],
    enter: afterRows(inColumnMenu()),
  },
  {
    title: 'Пользователь закрепил колонку из меню',
    hint: 'Колонка закреплена у левого края, а пункт меню теперь предлагает её открепить.',
    states: ['overlay.menu'],
    enter: afterRows(pinFromMenu),
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
    <GuideStory
      title="Действия колонки в меню"
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
    await step(IN_MENU[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-sort')).not.toBeNull()
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-pin')).not.toBeNull()
      await expect(headKebab(canvas, MENU_COLUMN)).toBeNull()
    })
    await step(IN_MENU[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(headKebab(canvas, MENU_COLUMN)).not.toBeNull())
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-sort')).toBeNull()
      await expect(buttonOf(canvas, MENU_COLUMN, 'column-pin')).toBeNull()
    })
    await step(IN_MENU[2]!.title, async () => {
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
    await step(IN_MENU[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pinned(canvas)).toBe(true))
      await until(() =>
        expect(
          menuItemsOf(openMenu(), 'columnPinning')[0]?.textContent?.trim(),
        ).toBe(labels.unpin),
      )
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

const ACTIVE: readonly GuideStoryStep[] = [
  {
    title: 'Действия не включены',
    hint: 'Таблица отображает колонки с кнопками сортировки и фильтра. Ни одно действие не включено.',
    enter: withActions([]),
  },
  {
    title: 'Пользователь отсортировал колонку',
    hint: 'На кнопке сортировки появляется отметка: по заголовку видно, что сортировка включена.',
    enter: withActions(SORT_NAME),
    states: ['head.activeIndicator'],
  },
  {
    title: 'Сортировка по второй колонке',
    hint: 'Пользователь добавил сортировку по ещё одной колонке. Вместо отметки на кнопках сортировки показывается номер приоритета.',
    enter: withActions(SORT_TWO),
    states: ['head.sorting'],
  },
  {
    title: 'Пользователь применил фильтр',
    hint: 'Отметка появляется и на кнопке фильтра колонки.',
    enter: withActions(SORT_TWO, FILTER_AGE),
    states: ['head.activeIndicator'],
  },
  {
    title: 'Пользователь скрыл колонку',
    hint: 'На кнопке управления видимостью колонок появляется число скрытых колонок.',
    enter: withActions(SORT_TWO, FILTER_AGE, HIDE_VISITS),
    states: ['head.activeIndicator'],
  },
  {
    title: 'Действия в меню колонки',
    hint: 'Приложение собрало действия колонки в меню. Кнопка меню колонки с включёнными действиями отмечена и видна без наведения.',
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
    <GuideStory
      title="Включённые действия видны"
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
    const columnsButton = () =>
      canvas.querySelector<HTMLElement>(
        '[data-testid="column-visibility-button"]',
      )
    await step(ACTIVE[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(marked(sort('name'))).toBe(false)
      await expect(marked(filter('age'))).toBe(false)
    })
    await step(ACTIVE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(sort('name'))).toBe(true))
      await settle()
    })
    await step(ACTIVE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(sort('age')?.textContent).toContain('2'))
      await expect(sort('name')?.textContent).toContain('1')
      await settle()
    })
    await step(ACTIVE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(filter('age'))).toBe(true))
      await settle()
    })
    await step(ACTIVE[4]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(columnsButton()?.textContent).toContain('1'))
      await settle()
    })
    await step(ACTIVE[5]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(marked(headKebab(canvas, 'name'))).toBe(true))
      await expect(getComputedStyle(headKebab(canvas, 'name')!).opacity).toBe(
        '1',
      )
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

const escape = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )

const busy = (root: ParentNode, column: string) =>
  headKebab(root, column)?.getAttribute('aria-busy') === 'true'

const failed = (root: ParentNode, column: string) =>
  !!headKebab(root, column)?.querySelector(
    '[data-error-indicator][data-shown="true"]',
  )

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
  (root: HTMLElement) => {
    let tries = 0
    const run = () => {
      if (done(root) || ++tries > 80) return
      const menu = document.querySelector<HTMLElement>('[role="menu"]')
      if (menu?.hasAttribute('data-open')) {
        if (expandedMenuOf(root, column)) act(menu)
        else escape()
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

const ASYNC_ACTIONS: readonly GuideStoryStep[] = [
  {
    title: 'Проверка доступности',
    hint: 'Приложение добавило в меню колонки своё действие, доступность которого решает сервер. Пользователь открыл меню: пока сервер не ответил, пункт заблокирован и показывает ожидание.',
    states: ['overlay.menu'],
    enter: afterRows(root => {
      INDEX_SERVER.checks.hold()
      INDEX_SERVER.runs.release()
      inIndexMenu('country')(root)
    }),
  },
  {
    title: 'Действие уже выполнено',
    hint: 'Сервер ответил, что для этой колонки действие уже выполнено. Пункт заблокирован и отмечен как выполненный, причина — в подсказке пункта.',
    states: ['overlay.menu'],
    enter: afterRows(root => {
      INDEX_SERVER.checks.release()
      inIndexMenu('country')(root)
    }),
  },
  {
    title: 'Действие запрещено',
    hint: 'Пользователь открыл меню другой колонки. Сервер запретил для неё действие: пункт заблокирован со значком запрета, причина — в подсказке пункта.',
    states: ['overlay.menu'],
    enter: afterRows(root => {
      INDEX_SERVER.checks.release()
      inIndexMenu('total')(root)
    }),
  },
  {
    title: 'Действие выполняется',
    hint: 'Пользователь выбрал действие в колонке, где оно доступно. Меню закрылось, а кнопка меню колонки показывает ожидание, пока сервер выполняет действие.',
    states: ['head.kebab'],
    enter: afterRows(root => {
      INDEX_SERVER.checks.release()
      INDEX_SERVER.runs.hold()
      inIndexMenu('lastName', root => busy(root, 'lastName'), runIndex)(root)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер не выполнил действие. На кнопке меню колонки появляется отметка ошибки, она видна без наведения; подсказка кнопки называет невыполненное действие.',
    states: ['head.kebab'],
    enter: afterRows(root => {
      INDEX_SERVER.checks.release()
      INDEX_SERVER.runs.release()
      inIndexMenu(
        'lastName',
        root => busy(root, 'lastName') || failed(root, 'lastName'),
        runIndex,
      )(root)
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
    <GuideStory
      title="Асинхронные действия в меню колонки"
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
    await step(ASYNC_ACTIONS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(expandedMenuOf(canvas, 'country')).toBe(true))
      await until(() => expect(description()).toBe(labels.availabilityChecking))
      await until(() => expect(itemEnabled(item())).toBe(false))
    })
    await step(ASYNC_ACTIONS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(description()).toBe('The column is already indexed'),
      )
      await expect(itemEnabled(item())).toBe(false)
      await settle()
    })
    await step(ASYNC_ACTIONS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(expandedMenuOf(canvas, 'total')).toBe(true))
      await until(() =>
        expect(description()).toBe("Computed columns can't be indexed"),
      )
      await expect(itemEnabled(item())).toBe(false)
      await settle()
    })
    await step(ASYNC_ACTIONS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(canvas, 'lastName')).toBe(true))
      await until(() =>
        expect(document.querySelector('[role="menu"][data-open]')).toBeNull(),
      )
    })
    await step(ASYNC_ACTIONS[4]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(failed(canvas, 'lastName')).toBe(true))
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
