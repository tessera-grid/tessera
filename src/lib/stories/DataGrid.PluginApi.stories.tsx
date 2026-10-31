import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Archive, Star } from 'lucide-react'
import { expect } from 'storybook/test'
import type {
  CellComponentProps,
  ToolbarComponentProps,
} from '../../lib/core/createSlots'
import { sourceOf } from '../../lib/core/debugActions'
import {
  definePlugin,
  type PluginCellStateProps,
} from '../../lib/core/definePlugin'
import { CellButton } from '../ui/CellButton/CellButton'
import { Button } from '../../lib/ui/Button'
import type { RowAction } from '../../lib/core/headerActions'
import { exportFormats } from '../../lib/plugins/dataExport'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { canEditDemoCell, type ServerFailMode } from './demos/sessionDemos'
import { argsUpdater } from './__mocks__/catalog'
import { clickByMouse, untilDone } from './__mocks__/cellGestures'
import {
  bodyRow,
  cancelDrag,
  consoleText,
  guideNext,
  pollUntil,
  rowAt,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import {
  HANDLE,
  OVERLAY,
  beginDrag,
  dragRowOnto,
  rowIdOrder,
} from './rowDragging.dnd'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'

/**
 * API плагинов: `Playground` — аргументы фабрик на лету; S1 ADR 0039 — аргумент меняется
 * на той же таблице, S4 ADR 0040 — колбэки перетаскивания, S1–S2 ADR 0125 — канал действий.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Plugin API',
} satisfies Meta<StoryProps>

export default meta

/** Аргументы демо-историй: задержка и отказ «сервера», предустановки на лету. */
interface SessionsArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: ServerFailMode
  conflictMode?: 'commit' | 'block'
  loadDelayMs?: number
  loadFailMode?: ServerFailMode
  /** ADR 0039: предел мультисортировки на лету. */
  multiSortMax?: number
  /** ADR 0039: разрешить правку на лету. */
  allowEditing?: boolean
  /** ADR 0039: набор размеров страницы на лету. */
  pageSizesPreset?: 'default' | 'small' | 'hidden'
}

const GRID = {
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

// --- Аргументы плагинов на лету (ADR 0039) -------------------------------------

const denyEditing = (_ctx: CellComponentProps) => false

const PAGE_SIZE_PRESETS: Record<
  NonNullable<SessionsArgs['pageSizesPreset']>,
  number[] | false | undefined
> = {
  default: undefined,
  small: [5, 10, 20],
  hidden: false,
}

// Данные — при рендере истории, а не при импорте модуля: makeData пересевает общий
// faker, и данные остальных историй (и снимки тестов) зависели бы от импорта.
const makeReactiveTree = () =>
  makeData({ shape: 'tree', count: 40, depth: 3, breadth: 2 })

export const PluginApiPlayground: StoryObj<SessionsArgs> = {
  name: 'Playground',
  args: {
    ...GRID,
    // Аргументы фабрик меняются на той же таблице (ADR 0039): раскройте глубокие
    // строки и уменьшите maxDepth — они скрыты, но состояние не стёрто; верните
    // значение — раскрытие на месте. То же с multiSortMax (Shift+клик по заголовкам),
    // allowEditing (кнопка правки) и набором размеров страницы.
    enableRowExpanding: true,
    enableColumnSorting: true,
    enableCellEditing: true,
    enablePagination: true,
    rowExpandingMaxDepth: 3,
    multiSortMax: 3,
    allowEditing: true,
    pageSizesPreset: 'default',
  },
  argTypes: {
    rowExpandingMaxDepth: { control: { type: 'range', min: 1, max: 3 } },
    multiSortMax: { control: { type: 'range', min: 1, max: 4 } },
    allowEditing: { control: 'boolean' },
    pageSizesPreset: {
      control: 'inline-radio',
      options: ['default', 'small', 'hidden'],
    },
  },
  parameters: {
    ...showControls(
      [
        'enableColumnSorting',
        'columnSortingRemoval',
        'columnSortingMultiSort',
        'columnSortingServer',
        'columnSortingRevertOnReject',
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'enableTreeLines',
        'enableCellEditing',
        'enablePagination',
        'paginationInitialPageSize',
        'paginationPageSizes',
        'paginationRevertOnReject',
        'multiSortMax',
        'allowEditing',
        'pageSizesPreset',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  render: function Render(
    { multiSortMax, allowEditing, pageSizesPreset = 'default', ...args },
    { id },
  ) {
    const [data] = useState(makeReactiveTree)
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        updateArgs={argsUpdater(id)}
        dataOverride={data}
        columnSortingMultiSort={{ max: multiSortMax }}
        cellEditingCanEditCell={allowEditing ? canEditDemoCell : denyEditing}
        paginationPageSizes={PAGE_SIZE_PRESETS[pageSizesPreset]}
      />
    )
  },
}

// --- ADR 0039 S1 ---------------------------------------------------------------------

const ROOT = 'node-0'
const CHILD = 'node-0-0'

const isExpanded = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-expanded') === 'true'
/** Пользователь нажимает переключатель раскрытия строки. */
const expandRow = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.querySelector<HTMLElement>('.row-expand-button')?.click()

const REACTIVE: readonly GuideStoryStep[] = [
  {
    title: 'Дерево свёрнуто',
    hint: 'Строки показаны верхним уровнем, глубина раскрытия — три уровня.',
    props: () => ({ rowExpandingMaxDepth: 3 }),
  },
  {
    title: 'Пользователь раскрыл строку и её дочернюю',
    hint: 'Под строкой видны дочерние строки, а под первой дочерней — её собственные.',
    // Новое открытие таблицы на шаге — с тем же раскрытием.
    props: () => ({ initialExpanded: { [ROOT]: true, [CHILD]: true } }),
    enter: untilDone(
      root => isExpanded(root, ROOT) && isExpanded(root, CHILD),
      root => expandRow(root, isExpanded(root, ROOT) ? CHILD : ROOT),
    ),
  },
  {
    title: 'Приложение уменьшило глубину',
    hint: 'Приложение разрешило раскрывать только один уровень. Раскрытие дочерней строки скрыто, но таблица его помнит.',
    props: () => ({ rowExpandingMaxDepth: 1 }),
  },
  {
    title: 'Приложение вернуло глубину',
    hint: 'Глубина снова три уровня: дочерняя строка раскрыта, как была, раскрывать её заново не нужно.',
    props: () => ({ rowExpandingMaxDepth: 3 }),
  },
]

/** ADR 0039, S1: аргумент плагина меняется на той же таблице — состояние не стирается. */
export const PluginApiReactiveArgs: StoryObj<SessionsArgs> = {
  name: 'Reactive arguments',
  parameters: {
    scenario: '0039/S1',
    requirements: ['DS5'],
    ...guideControls(),
  },
  render: function Render(args) {
    const [data] = useState(makeReactiveTree)
    return (
      <GuideStory
        title="Аргументы плагина на лету"
        steps={REACTIVE}
        args={guideArgs(
          { ...GRID, dataOverride: data, enableRowExpanding: true },
          args,
        )}
      />
    )
  },
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REACTIVE[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(isExpanded(canvas, ROOT)).toBe(false)
    })
    await step(REACTIVE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(isExpanded(canvas, ROOT) && isExpanded(canvas, CHILD)).toBe(
          true,
        ),
      )
    })
    await step(REACTIVE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isExpanded(canvas, CHILD)).toBe(false))
      await expect(isExpanded(canvas, ROOT)).toBe(true)
    })
    await step(REACTIVE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isExpanded(canvas, CHILD)).toBe(true))
      await settle()
    })
  },
}

// --- ADR 0040 S4 ---------------------------------------------------------------------

const DRAGGED = 'item-id-0'
const movedAway = (root: HTMLElement) =>
  rowIdOrder(root)[0] !== DRAGGED && !root.querySelector(OVERLAY)

/** После конца перетаскивания dnd-kit ещё 50 мс глотает клики: шаг ждёт, чтобы кнопки гайда нажимались. */
const clicksBack = async (signal: AbortSignal) => {
  await sleep(120)
  signal.throwIfAborted()
}

/** Пользователь перетаскивает первую строку на место четвёртой. */
const moveFirstRow = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!rowAt(root, 3), signal)
  if (rowIdOrder(root)[0] === DRAGGED)
    await dragRowOnto(rowAt(root, 0), rowAt(root, 3))
  await pollUntil(() => movedAway(root), signal)
  await clicksBack(signal)
}

/** Колбэки приложения: журнал консоли записывает каждый вызов. */
const accept = () => {}
const SESSION_CALLBACKS = {
  onRowDragEnd: accept,
  onRowDragCancel: accept,
  onColumnDragEnd: accept,
  onColumnDragCancel: accept,
  onColumnResizeEnd: accept,
  onColumnResizeCancel: accept,
}

const CALLBACKS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с перетаскиванием',
    hint: 'Строки и колонки переставляются перетаскиванием, ширина колонок меняется протяжкой. Итог каждого действия приложение получает в колбэке, журнал — в консоли под таблицей.',
    props: () => SESSION_CALLBACKS,
  },
  {
    title: 'Пользователь перетащил строку',
    hint: 'Строка встала на новое место, приложение получило её и новое место.',
    enter: stepAction((root, { signal }) => moveFirstRow(root, signal)),
  },
  {
    title: 'Пользователь отменил перетаскивание',
    hint: 'Пользователь взял строку и нажал Escape. Строка осталась на месте, приложение получило отмену с причиной.',
    enter: stepAction(async (root, { signal }) => {
      await moveFirstRow(root, signal)
      const order = rowIdOrder(root).join()
      await beginDrag(rowAt(root, 0).querySelector<HTMLElement>(HANDLE)!)
      await pollUntil(() => !!root.querySelector(OVERLAY), signal)
      cancelDrag()
      await pollUntil(
        () => !root.querySelector(OVERLAY) && rowIdOrder(root).join() === order,
        signal,
      )
      await clicksBack(signal)
    }),
  },
]

/** ADR 0040, S4: итоги перетаскивания приходят приложению колбэками успеха и отмены. */
export const SessionCallbacks: StoryObj<SessionsArgs> = {
  name: 'Drag & resize callbacks',
  parameters: {
    scenario: '0040/S4',
    requirements: ['DS3'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Колбэки перетаскивания"
      steps={CALLBACKS}
      args={guideArgs(
        {
          ...GRID,
          dataCount: 30,
          enableRowDragging: true,
          enableColumnDragging: true,
          enableColumnSizing: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CALLBACKS[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(rowAt(canvas, 0).querySelector(HANDLE)).not.toBeNull()
    })
    await step(CALLBACKS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(consoleText()).toContain('onRowDragEnd')
      await expect(consoleText()).toContain(`rowId:"${DRAGGED}"`)
    })
    await step(CALLBACKS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(consoleText()).toContain('onRowDragCancel'))
      await expect(consoleText()).toMatch(/onRowDragCancel[^\n]*cancel/)
      await settle()
    })
  },
}

// --- Канал действий (ADR 0125) ---------------------------------------------------

/** Набор функций задаёт гайд: базовые контролы скрыты. */
const GUIDED = guideControls()

const guided = (title: string, steps: readonly GuideStoryStep[]) =>
  function Render(args: StoryProps) {
    return (
      <GuideStory
        title={title}
        steps={steps}
        // Аргументы Storybook, оставшиеся в URL, функции не включают.
        args={normalizeArgs({
          ...GRID,
          ...meta.args,
          colorMode: args.colorMode,
        })}
      />
    )
  }

const sortButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="firstName"] .column-sort__button',
  )

const sortedByFirstName = (root: ParentNode) =>
  /^(ascending|descending)$/.test(
    root
      .querySelector('.data-grid__head-cell[data-column-id="firstName"]')
      ?.getAttribute('aria-sort') ?? '',
  )

/** Пользователь нажимает кнопку сортировки First name мышью. */
const sortByMouse = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!sortButton(root), signal)
  clickByMouse(sortButton(root)!)
  await pollUntil(() => sortedByFirstName(root), signal)
}

const activeCell = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-kn-cell][data-kn-active="true"]')

/** Нажатие клавиши на активной ячейке — как ввод пользователя. */
const press = (root: ParentNode, key: string) =>
  activeCell(root)?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )

/**
 * Пользователь входит в таблицу клавишей Tab, стрелкой доходит до заголовка First name
 * и нажимает на нём Enter.
 */
const sortByKeyboard = async (root: HTMLElement, signal: AbortSignal) => {
  const head = () =>
    root.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="firstName"][data-kn-cell]',
    )
  await pollUntil(() => !!head(), signal)
  const direction = head()!.getAttribute('aria-sort')
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
  )
  root.querySelector<HTMLElement>('[data-kn-cell][tabindex="0"]')?.focus()
  const column = (cell: HTMLElement | null) =>
    Number(cell?.getAttribute('aria-colindex'))
  for (let tries = 0; activeCell(root) !== head(); tries++) {
    if (tries > 30) throw new Error('Шаг гайда не дошёл до заголовка')
    const active = activeCell(root)
    if (!active?.classList.contains('data-grid__head-cell'))
      press(root, 'ArrowUp')
    else
      press(root, column(active) < column(head()) ? 'ArrowRight' : 'ArrowLeft')
    await pollUntil(() => true, signal)
  }
  press(root, 'Enter')
  await pollUntil(() => head()!.getAttribute('aria-sort') !== direction, signal)
}

const DEBUG_ACTIONS: readonly GuideStoryStep[] = [
  {
    title: 'Журнал пуст',
    hint: 'Приложение подписано на onDebugAction: каждое действие попадает в консоль под таблицей. Раскройте её.',
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: 'Сортировка мышью',
    hint: 'Нажмите кнопку сортировки в шапке First name: действие №1 columnSorting, источник «мышь».',
    enter: stepAction((root, { signal }) => sortByMouse(root, signal)),
  },
  {
    title: 'Сортировка клавишей',
    hint: 'Включена клавиатура: Tab в шапку, Enter на заголовке — то же действие с источником «клавиатура».',
    props: () => ({ enableKeyboardNavigation: true }),
    // Сортировка мышью — до клавиши, если шаг открыли, минуя прошлый.
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!sortButton(root), signal)
      if (!sortedByFirstName(root)) await sortByMouse(root, signal)
      await sortByKeyboard(root, signal)
    }),
  },
]

/** S1: приложение пишет действия пользователя в свой журнал через `onDebugAction`. */
export const PluginApiDebugActions: StoryObj<StoryProps> = {
  name: 'Debug actions',
  parameters: {
    scenario: '0125/S1',
    requirements: ['AL1'],
    ...GUIDED,
  },
  render: guided('Журнал действий', DEBUG_ACTIONS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DEBUG_ACTIONS[0].title, async () => {
      await waitForRows(canvas)
      // Действий ещё нет: номера «#N» стоят только у действий.
      expect(consoleText()).not.toMatch(/#d/)
    })
    await step(DEBUG_ACTIONS[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(consoleText()).toMatch(/#1\b[^\n]*columnSorting[^\n]*мышь/),
      )
    })
    await step(DEBUG_ACTIONS[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(consoleText()).toMatch(/columnSorting\.toggle[^\n]*клавиатура/),
      )
    })
    await settle()
  },
}

// --- Вспышка итога (ADR 0134) ----------------------------------------------------

interface FavoriteArgs {
  enabled?: boolean
  /** Сервер отказывает в записи. */
  refuse?: boolean
}
interface FavoriteHooks {
  refuse: boolean
}
interface FavoriteState {
  favorites: Record<string, boolean>
}

const FAVORITE_COLUMN = 'firstName'
const SERVER_MS = 600

/** Кнопка избранного: отмечает строку сразу, сервер подтверждает или отказывает. */
const FavoriteButton = ({
  row,
  column,
  table,
  hooks,
  state: [{ favorites }, setState],
}: PluginCellStateProps<FavoriteHooks, FavoriteState>) => {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ flash: number; text: string }>()
  if (column.id !== FAVORITE_COLUMN) {
    return null
  }
  const on = favorites[row.id] ?? false
  const toggle = async () => {
    setPending(true)
    setFailure(undefined)
    setState({ favorites: { ...favorites, [row.id]: !on } })
    const refuse = hooks.refuse
    await new Promise(resolve => setTimeout(resolve, SERVER_MS))
    setPending(false)
    if (refuse) {
      setState({ favorites })
      setFailure(prev => ({
        flash: (prev?.flash ?? 0) + 1,
        text: 'Failed: the server refused. Press to retry',
      }))
      table.flashOutcome({ cell: [row.id, column.id] }, 'reverted')
      return
    }
    table.flashOutcome({ cell: [row.id, column.id] }, 'accepted')
  }
  return (
    <CellButton
      data-testid="favorite"
      label={on ? 'Remove from favorites' : 'Add to favorites'}
      icon={<Star size={16} fill={on ? 'currentColor' : 'none'} />}
      active={on || undefined}
      indicator={false}
      revealOnHover={false}
      pending={pending}
      failure={failure?.text}
      onClick={() => void toggle()}
    />
  )
}

const favorite = definePlugin<FavoriteArgs>()({
  id: 'favorite',
  hooks: (args): FavoriteHooks => ({ refuse: args.refuse ?? false }),
  state: (): FavoriteState => ({ favorites: {} }),
  slots: [
    {
      id: 'favorite',
      slot: 'rightCellSlot',
      state: true,
      component: FavoriteButton,
    },
  ],
})
const FAVORITE_ACCEPTS = [favorite()]
const FAVORITE_REFUSES = [favorite({ refuse: true })]

const favoriteOf = (canvas: HTMLElement, index: number) =>
  rowAt(canvas, index)?.querySelector<HTMLElement>(
    '[data-testid="favorite"]',
  ) ?? null

/** Последний вход в шаг: повтор прежнего шага не жмёт кнопку в новом гриде. */
let pressRun = 0

/**
 * Нажать кнопку избранного строки, когда она отрисована: шаг «Назад» открывает грид
 * заново, и вход в шаг приходит раньше строк.
 */
const pressFavorite = (index: number) => (root: HTMLElement) => {
  const run = ++pressRun
  let tries = 0
  const press = () => {
    if (run !== pressRun) return
    const button = favoriteOf(root, index)
    if (button) button.click()
    else if (++tries < 40) setTimeout(press, 50)
  }
  press()
}

const OUTCOME_FLASH: readonly GuideStoryStep[] = [
  {
    title: 'Кнопка избранного',
    hint: 'Приложение ставит в ячейки первой колонки кнопку избранного. Нажатие сразу отмечает строку и отправляет запрос на сервер.',
    props: () => ({ extraPlugins: FAVORITE_ACCEPTS }),
  },
  {
    title: 'Сервер принял',
    hint: 'Нажата кнопка первой строки: пока сервер отвечает, кнопка ждёт. Запись принята — ячейка с кнопкой коротко вспыхивает тоном успеха, отметка остаётся.',
    enter: pressFavorite(0),
    immediate: true,
  },
  {
    title: 'Сервер отказал',
    hint: 'Теперь сервер отказывает. Нажата кнопка второй строки: отметка возвращается, ячейка с кнопкой вспыхивает тоном отказа, а на кнопке остаётся отметка с причиной — нажатие повторит запрос.',
    props: () => ({ extraPlugins: FAVORITE_REFUSES }),
    enter: pressFavorite(1),
    immediate: true,
  },
]

/** S2: приложение показывает в ячейке итог своего асинхронного действия. */
export const OutcomeFlashFromApp: StoryObj<StoryProps> = {
  name: 'Outcome flash',
  parameters: {
    scenario: '0134/S2',
    requirements: ['OF21'],
    ...GUIDED,
  },
  render: guided('Итог действия в ячейке', OUTCOME_FLASH),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const flashOf = (index: number) =>
      rowAt(canvas, index)
        .querySelector(`[data-column-id="${FAVORITE_COLUMN}"]`)
        ?.getAttribute('data-flash')
    // Ожидание кончилось: значок возвращается к цвету покоя коротким переходом (IR31).
    const button = (index: number) => favoriteOf(canvas, index)!
    const iconAtRest = async (index: number) => {
      // Снятие ожидания React 18 коммитит отдельно: переход цвета ещё не начался.
      await until(() => {
        expect(button(index)).not.toHaveAttribute('aria-busy', 'true')
        expect(button(index)).not.toHaveAttribute('data-pending-leaving')
      })
      await Promise.all(
        button(index)
          .getAnimations({ subtree: true })
          .filter(
            animation =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === 'color',
          )
          .map(animation => animation.finished.catch(() => {})),
      )
    }
    await step(OUTCOME_FLASH[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(favoriteOf(canvas, 0)).not.toBeNull())
    })
    await step(OUTCOME_FLASH[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashOf(0)).toBe('accepted'))
      // Вспыхивает ячейка с кнопкой, а не строка целиком.
      expect(rowAt(canvas, 0).hasAttribute('data-flash')).toBe(false)
      await iconAtRest(0)
      expect(button(0).closest('[data-button-active]')).not.toBeNull()
    })
    await step(OUTCOME_FLASH[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashOf(1)).toBe('reverted'))
      await iconAtRest(1)
      // Отметка отказа и её описание — разные срезы: React 18 коммитит их по одному.
      await until(() =>
        expect(button(1).closest('[data-button-active]')).toBeNull(),
      )
      await until(() =>
        expect(button(1).getAttribute('aria-describedby')).toBeTruthy(),
      )
    })
    await settle()
  },
}

/** Кнопка плагина в тулбаре: сообщает своё действие и показывает его номер. */
const StarButton = ({ table }: ToolbarComponentProps) => {
  const [last, setLast] = useState<number>()
  return (
    <Button
      data-testid="star-rows"
      onClick={event =>
        setLast(
          table.reportAction({
            plugin: 'starRows',
            action: 'starAll',
            source: sourceOf(event),
          }),
        )
      }
    >
      {last === undefined ? 'Star rows' : `Star rows · #${last}`}
    </Button>
  )
}

const starRows = definePlugin()({
  id: 'starRows',
  slots: [{ id: 'starRows', slot: 'toolbarSlot', component: StarButton }],
})
/** Одна запись на историю: смена набора плагинов — только когда её добавляет шаг. */
const STAR_ROWS = [starRows()]

const starButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="star-rows"]')

const REPORT_ACTION: readonly GuideStoryStep[] = [
  {
    title: 'Кнопка плагина',
    hint: 'Плагин definePlugin ставит в тулбар кнопку «Star rows». Других плагинов нет — table.reportAction ставит ядро.',
    props: () => ({ extraPlugins: STAR_ROWS }),
  },
  {
    title: 'Нажатие кнопки',
    hint: 'Кнопка зовёт table.reportAction: в консоли — действие starRows · starAll, а кнопка показывает его номер.',
    // Пользователь нажимает кнопку мышью: одно нажатие — одно действие.
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!starButton(root), signal)
      clickByMouse(starButton(root)!)
    }),
  },
]

/** S2: автор плагина сообщает действие своей кнопки через `table.reportAction`. */
export const PluginApiReportAction: StoryObj<StoryProps> = {
  name: 'Report action',
  parameters: {
    scenario: '0125/S2',
    requirements: ['AL2'],
    ...GUIDED,
  },
  render: guided('Действие плагина', REPORT_ACTION),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REPORT_ACTION[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(starButton(canvas)).not.toBeNull())
    })
    await step(REPORT_ACTION[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(consoleText()).toMatch(/#1\b[^\n]*starRows · starAll[^\n]*мышь/),
      )
      expect(starButton(canvas)!.textContent).toBe('Star rows · #1')
    })
    await settle()
  },
}

// --- ADR 0153 S5 ---------------------------------------------------------------------

/** Запрос, который ждёт, пока его не отменят; учитывает `signal` (ADR 0153, §1). */
const heldRequest = (signal?: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    })
  })

const CANCEL_ROW = 'item-id-1'

const appArchive: RowAction = {
  id: 'appArchive',
  slot: 'actionRowSlot',
  icon: () => <Archive width={16} height={16} />,
  label: () => 'Archive',
  onSelect: (_ctx, _event, context) => heldRequest(context?.signal),
}

/** Кнопка приложения в тулбаре: отменяет всё, чего ждёт таблица. */
const CancelAllButton = ({ table }: ToolbarComponentProps) => (
  <Button
    variant="outline"
    data-testid="cancel-all"
    onClick={() => table.cancelPending()}
  >
    Cancel all
  </Button>
)

const cancelAllDemo = {
  id: 'cancelAllGuide',
  slotActions: [appArchive],
  slots: [{ id: 'cancelAll', slot: 'toolbarSlot', component: CancelAllButton }],
} as NonNullable<StoryProps['extraPlugins']>[number]

const archiveButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${CANCEL_ROW}"] .row__button button`,
  )
const exportButtonOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="export-button"]')
const busyButton = (button: Element | null) =>
  button?.getAttribute('aria-busy') === 'true'
const failedButton = (button: Element | null) =>
  button
    ?.querySelector('[data-failure-indicator]')
    ?.getAttribute('data-shown') === 'true'

/** Действие строки и выгрузка ждут: пользователь нажал обе кнопки. */
const bothHeld = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (!busyButton(archiveButton(root))) archiveButton(root)?.click()
    else if (!busyButton(exportButtonOf(root))) exportButtonOf(root)?.click()
    else return true
    return false
  }, signal)

const CANCEL_ALL: readonly GuideStoryStep[] = [
  {
    title: 'Кнопка приложения',
    hint: 'Над таблицей есть своя кнопка приложения: она отменяет всё, чего таблица ждёт.',
  },
  {
    title: 'Ждут два действия',
    hint: 'Пользователь запустил действие строки и выгрузку, обе кнопки показывают ожидание.',
    states: ['body.pending'],
    enter: stepAction((root, { signal }) => bothHeld(root, signal)),
  },
  {
    title: 'Всё отменено',
    hint: 'Пользователь нажал кнопку приложения. Таблица тихо прервала оба запроса: ожидание снято, отметок ошибки нет.',
    enter: stepAction(async (root, { signal }) => {
      await bothHeld(root, signal)
      root.querySelector<HTMLElement>('[data-testid="cancel-all"]')!.click()
      await pollUntil(
        () =>
          !busyButton(archiveButton(root)) && !busyButton(exportButtonOf(root)),
        signal,
      )
    }),
  },
]

/** ADR 0153, S5: приложение отменяет всё ожидающее своей кнопкой. */
export const PluginApiCancelPending: StoryObj<StoryProps> = {
  name: 'Cancel everything pending',
  parameters: { scenario: '0153/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отмена всего ожидающего"
      steps={CANCEL_ALL}
      args={guideArgs(
        {
          enableRowActions: true,
          actionsDemo: 'none',
          enableDataExport: true,
          dataExportFormats: [
            {
              ...exportFormats.xlsx(),
              serialize: (_data, context) => heldRequest(context?.signal),
            },
          ],
          dataExportAllow: { columns: ['visible'] },
          extraPlugins: [cancelAllDemo],
          dataCount: 20,
          containerHeight: '460',
          height: '360',
          maxHeight: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CANCEL_ALL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="cancel-all"]'),
        ).not.toBeNull(),
      )
    })
    await step(CANCEL_ALL[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(busyButton(archiveButton(canvas))).toBe(true)
      await expect(busyButton(exportButtonOf(canvas))).toBe(true)
    })
    await step(CANCEL_ALL[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(busyButton(archiveButton(canvas))).toBe(false)
      await expect(busyButton(exportButtonOf(canvas))).toBe(false)
      await settle()
      await expect(failedButton(archiveButton(canvas))).toBe(false)
      await expect(failedButton(exportButtonOf(canvas))).toBe(false)
      await expect(consoleText()).toContain('cancelPending')
    })
  },
}
