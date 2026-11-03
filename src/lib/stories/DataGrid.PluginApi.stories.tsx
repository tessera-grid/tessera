import { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Archive, Eye, Flag, Star } from 'lucide-react'
import { expect } from 'storybook/test'
import { COLUMN_ACTIONS_SIZE } from '../../lib/core/createColumns/actionColumnParams'
import type {
  CellComponentProps,
  ToolbarComponentProps,
} from '../../lib/core/createSlots'
import { sourceOf } from '../../lib/core/debugActions'
import {
  definePlugin,
  type PluginCellProps,
  type PluginCellStateProps,
  type PluginHeaderProps,
} from '../../lib/core/definePlugin'
import { CellButton } from '../ui/CellButton/CellButton'
import { Button } from '../../lib/ui/Button'
import { IconButton } from '../../lib/ui/IconButton'
import type { RowAction } from '../../lib/core/headerActions'
import { exportFormats } from '../../lib/plugins/dataExport'
import type { ColumnDef } from '../../lib/types'
import {
  type GuideApp,
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { type ConsoleLog, loggedCallback } from './demos/consoleLog'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { getData, makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { canEditDemoCell, type ServerFailMode } from './demos/sessionDemos'
import { argsUpdater } from './__mocks__/catalog'
import { cellOf, clickByMouse, untilDone } from './__mocks__/cellGestures'
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
import {
  cellCard,
  cellKey,
  changes,
  keyMarks,
  MARK_KEY,
} from './__mocks__/bodyPlugins'

/**
 * API плагинов: `Playground` — аргументы фабрик на лету; S1–S2 ADR 0039 — аргумент и запрет
 * на той же таблице, S4–S5 ADR 0040 — колбэки перетаскивания и протяжки, S1–S2 ADR 0125 —
 * канал действий, S1–S3 ADR 0028 — плагин автора, S1 ADR 0037 — его падение, S1–S3 ADR 0173 —
 * вклад плагина автора в тело: атрибуты, свой жест, своя клавиша.
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

/** Колбэк приложения: журнал консоли записывает каждый вызов. */
const accept = () => {}

/** Записи плагинов истории — одни на консоль: набор плагинов не меняется на каждой отрисовке. */
const perLog = <T,>(make: (log: ConsoleLog) => T) => {
  const made = new WeakMap<ConsoleLog, T>()
  return (log: ConsoleLog) => {
    if (!made.has(log)) made.set(log, make(log))
    return made.get(log)!
  }
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
        'dataMode',
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

// --- ADR 0039 S2 ---------------------------------------------------------------------

const EDIT_ROW = 'item-id-1'
const EDIT_COLUMN = 'age'
const DRAFT = '77'

const editCellOf = (root: ParentNode) => cellOf(root, EDIT_ROW, EDIT_COLUMN)
const editInputOf = (root: ParentNode) =>
  editCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
const editButtonOf = (root: ParentNode) =>
  editCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null
const hasDraft = (root: ParentNode) => editInputOf(root)?.value === DRAFT
/** Значение в ячейке — без кнопки правки. */
const editCellText = (root: ParentNode) => {
  const copy = editCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}

/** Пользователь открывает правку возраста кнопкой ячейки и набирает черновик. */
const typeDraft = (root: HTMLElement) => {
  const input = editInputOf(root)
  if (!input) {
    editButtonOf(root)?.click()
    return
  }
  // Ввод с клавиатуры: значение — сеттером поля и событием `input`, как у браузера.
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, DRAFT)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const REVOKE: readonly GuideStoryStep[] = [
  {
    title: 'Правка разрешена',
    hint: 'Приложение разрешает править ячейки: при наведении в ячейке появляется кнопка правки.',
    props: () => ({
      cellEditingCanEditCell: canEditDemoCell,
      onEditCancel: accept,
    }),
  },
  {
    title: 'Пользователь правит ячейку',
    hint: 'Пользователь открыл поле правки и ввёл новое значение, но ещё не сохранил его.',
    states: ['body.editing'],
    enter: untilDone(hasDraft, typeDraft),
  },
  {
    title: 'Приложение запретило правку',
    hint: 'Пока поле открыто, приложение запретило править ячейки. Поле закрылось, в ячейке прежнее значение, а введённый черновик приложение получило в колбэке отмены вместе с причиной.',
    enter: stepAction(async (root, { signal }, app) => {
      // Черновик — до запрета, если шаг открыли, минуя прошлый.
      for (let tries = 0; !hasDraft(root); tries++) {
        if (tries > 80) throw new Error('Шаг гайда не открыл правку')
        typeDraft(root)
        await sleep(100)
        signal.throwIfAborted()
      }
      app.update(props => ({ ...props, cellEditingCanEditCell: denyEditing }))
      await pollUntil(() => !editInputOf(root), signal)
    }),
  },
]

/** ADR 0039, S2: приложение запрещает правку посреди сессии — черновик приходит в колбэке отмены. */
export const PluginApiRevokeEditing: StoryObj<SessionsArgs> = {
  name: 'Revoke editing',
  parameters: { scenario: '0039/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Запрет правки посреди сессии"
      steps={REVOKE}
      args={guideArgs(
        { ...GRID, dataCount: 10, enableCellEditing: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let original: string | undefined
    await step(REVOKE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(editButtonOf(canvas)).not.toBeNull())
      original = editCellText(canvas)
    })
    await step(REVOKE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(editInputOf(canvas)?.value).toBe(DRAFT))
    })
    await step(REVOKE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(editInputOf(canvas)).toBeNull()
      expect(editCellText(canvas)).toBe(original)
      await until(() =>
        expect(consoleText()).toMatch(/onEditCancel[^\n]*revoke/),
      )
      expect(consoleText()).toMatch(new RegExp(`onEditCancel[^\\n]*${DRAFT}`))
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

const DRAG_CALLBACKS = { onRowDragEnd: accept, onRowDragCancel: accept }

const CALLBACKS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с перетаскиванием',
    hint: 'Строки переставляются перетаскиванием за ручку. Итог каждого перетаскивания приложение получает в колбэке, журнал — в консоли под таблицей.',
    props: () => DRAG_CALLBACKS,
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

/** ADR 0040, S4: итоги перетаскивания строки приходят приложению колбэками успеха и отмены. */
export const SessionCallbacks: StoryObj<SessionsArgs> = {
  name: 'Drag callbacks',
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
        { ...GRID, dataCount: 30, enableRowDragging: true },
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

// --- ADR 0040 S5 ---------------------------------------------------------------------

const RESIZED = 'firstName'
/** Сдвиг границы заголовка при протяжке, px. */
const RESIZE_BY = 100

const resizedHead = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${RESIZED}"]`,
  )
const widthOf = (root: ParentNode) =>
  Math.round(resizedHead(root)?.getBoundingClientRect().width ?? 0)

/**
 * Нажатие на границе заголовка и движение мыши — события, которые шлёт браузер: нажатие —
 * на ручке, движение и отпускание — на документе.
 */
const pressGrip = (root: ParentNode) => {
  const grip = resizedHead(root)!.querySelector<HTMLElement>(
    '.resize__handler--column',
  )!
  const box = grip.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const mouse = (type: string, target: EventTarget, clientX: number) =>
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: type === 'mouseup' ? 0 : 1,
        clientX,
        clientY: y,
      }),
    )
  mouse('mousedown', grip, x)
  return {
    move: () => mouse('mousemove', document, x + RESIZE_BY),
    release: () => mouse('mouseup', document, x + RESIZE_BY),
  }
}

/** Пользователь тянет границу заголовка вправо: колонка шире, кнопка мыши ещё зажата. */
const pullGrip = async (root: HTMLElement, step: StepRun) => {
  await pollUntil(() => !!resizedHead(root), step.signal)
  const before = widthOf(root)
  const grip = pressGrip(root)
  step.onLeave(grip.release)
  await sleep(16)
  grip.move()
  await pollUntil(() => widthOf(root) > before + RESIZE_BY / 2, step.signal)
  return { before, release: grip.release }
}

const RESIZE_CALLBACKS = {
  onColumnResizeEnd: accept,
  onColumnResizeCancel: accept,
}

const RESIZE: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с протяжкой ширины',
    hint: 'Ширина колонок меняется протяжкой границы заголовка. Итог каждого изменения приложение получает в колбэке, журнал — в консоли под таблицей.',
    props: () => RESIZE_CALLBACKS,
  },
  {
    title: 'Пользователь расширил колонку',
    hint: 'Пользователь протянул границу заголовка и отпустил. Колонка стала шире, приложение получило новую ширину.',
    enter: stepAction(async (root, step) => {
      const { release } = await pullGrip(root, step)
      release()
    }),
  },
  {
    title: 'Пользователь отменил протяжку',
    hint: 'Пользователь начал тянуть границу и нажал Escape. Ширина вернулась к прежней, приложение получило отмену с причиной.',
    enter: stepAction(async (root, step) => {
      const { before, release } = await pullGrip(root, step)
      cancelDrag()
      await pollUntil(() => widthOf(root) === before, step.signal)
      release()
    }),
  },
]

/** ADR 0040, S5: итоги протяжки ширины приходят приложению колбэками успеха и отмены. */
export const PluginApiResizeCallbacks: StoryObj<SessionsArgs> = {
  name: 'Resize callbacks',
  parameters: { scenario: '0040/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title="Колбэки протяжки ширины"
      steps={RESIZE}
      args={guideArgs({ ...GRID, enableColumnSizing: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let start = 0
    await step(RESIZE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(
          resizedHead(canvas)?.querySelector('.resize__handler--column'),
        ).toBeTruthy(),
      )
      start = widthOf(canvas)
    })
    await step(RESIZE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(widthOf(canvas)).toBeGreaterThan(start + RESIZE_BY / 2)
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(`onColumnResizeEnd[^\\n]*${RESIZED}`),
        ),
      )
      const width = /onColumnResizeEnd[^\n]*width\D*(\d+)/.exec(consoleText())
      expect(Number(width?.[1])).toBeGreaterThan(start + RESIZE_BY / 2)
    })
    await step(RESIZE[2]!.title, async () => {
      const wide = widthOf(canvas)
      await guideNext(canvas)
      await stepDone(canvas)
      expect(widthOf(canvas)).toBe(wide)
      await until(() =>
        expect(consoleText()).toMatch(/onColumnResizeCancel[^\n]*cancel/),
      )
      expect(consoleText().match(/onColumnResizeEnd/g)).toHaveLength(1)
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
    hint: 'Приложение записывает каждое действие пользователя в свой журнал. Журнал — в консоли под таблицей, пока он пуст.',
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: 'Сортировка мышью',
    hint: 'Пользователь нажал кнопку сортировки в заголовке колонки. В журнале появилось первое действие — сортировка, источник — мышь.',
    enter: stepAction((root, { signal }) => sortByMouse(root, signal)),
  },
  {
    title: 'Сортировка клавишей',
    keyboard: true,
    hint: 'Пользователь перешёл в заголовок с клавиатуры и нажал Enter. В журнале — то же действие, источник — клавиатура.',
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
  if (column.id !== FAVORITE_COLUMN) {
    return null
  }
  const on = favorites[row.id] ?? false
  const toggle = async () => {
    setPending(true)
    setState({ favorites: { ...favorites, [row.id]: !on } })
    const refuse = hooks.refuse
    await new Promise(resolve => setTimeout(resolve, SERVER_MS))
    setPending(false)
    if (refuse) {
      setState({ favorites })
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
    hint: 'Приложение ставит в ячейки колонки имени кнопку избранного. Нажатие сразу отмечает строку и отправляет запрос на сервер.',
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
    hint: 'Теперь сервер отказывает. Нажата кнопка второй строки: отметка возвращается, ячейка с кнопкой вспыхивает тоном отказа. Повторное нажатие повторит запрос.',
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
      // Отметки отказа на кнопке нет (ADR 0177, §2): она в покое.
      await until(() =>
        expect(button(1).closest('[data-button-active]')).toBeNull(),
      )
      expect(button(1).querySelector('[data-failure-indicator]')).toBeNull()
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
    hint: 'Плагин автора поставил в тулбар свою кнопку. Других плагинов в таблице нет: сообщать о действиях умеет сама таблица.',
    props: () => ({ extraPlugins: STAR_ROWS }),
  },
  {
    title: 'Нажатие кнопки',
    hint: 'Пользователь нажал кнопку плагина. Плагин сообщил таблице своё действие: оно попало в журнал под таблицей, а кнопка показывает его номер.',
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

// --- Плагин автора (ADR 0028) ------------------------------------------------------

type Marks = Record<string, boolean>

/** Кнопка в ячейке плагина: отмечена ли строка и что делает нажатие. */
const MarkToggle = ({
  marked,
  onToggle,
}: {
  marked: boolean
  onToggle: () => void
}) => (
  <CellButton
    data-testid="mark"
    label={marked ? 'Remove from favorites' : 'Add to favorites'}
    icon={<Star size={16} fill={marked ? 'currentColor' : 'none'} />}
    active={marked || undefined}
    indicator={false}
    revealOnHover={false}
    onClick={onToggle}
  />
)

const markOf = (root: ParentNode, row: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] [data-testid="mark"]`,
  )
const isMarked = (root: ParentNode, row: string) =>
  !!markOf(root, row)?.closest('[data-button-active]')
const markedRows = (root: ParentNode) =>
  root.querySelectorAll(
    '.data-grid__body-row [data-button-active] [data-testid="mark"]',
  ).length

// S1: кнопка в ячейке со своим состоянием.

type ToggleFavorite = (change: { rowId: string; favorite: boolean }) => void

interface FavoriteRowsArgs {
  enabled?: boolean
  onToggleFavorite?: ToggleFavorite
}
interface FavoriteRowsHooks {
  onToggleFavorite: ToggleFavorite
}

const FavoriteRowButton = ({
  row,
  column,
  hooks,
  state: [marks, setMarks],
}: PluginCellStateProps<FavoriteRowsHooks, Marks>) => {
  if (column.id !== FAVORITE_COLUMN) return null
  const marked = marks[row.id] ?? false
  return (
    <MarkToggle
      marked={marked}
      onToggle={() => {
        setMarks({ ...marks, [row.id]: !marked })
        hooks.onToggleFavorite({ rowId: row.id, favorite: !marked })
      }}
    />
  )
}

const favoriteRows = definePlugin<FavoriteRowsArgs>()({
  id: 'favoriteRows',
  hooks: (args): FavoriteRowsHooks => ({
    onToggleFavorite: args.onToggleFavorite ?? accept,
  }),
  state: (): Marks => ({}),
  slots: [
    {
      id: 'favoriteRows',
      slot: 'rightCellSlot',
      state: true,
      component: FavoriteRowButton,
    },
  ],
})
const favoriteRowsOf = perLog(log => [
  favoriteRows({
    onToggleFavorite: loggedCallback(log, 'onToggleFavorite', accept),
  }),
])

const MARKED_ROW = 'item-id-0'
const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')
const isMounted = (root: ParentNode, row: string) =>
  !!root.querySelector(`.data-grid__body-row[data-row-id="${row}"]`)

/** Пользователь отмечает первую строку кнопкой плагина. */
const markFirstRow = (root: HTMLElement) => markOf(root, MARKED_ROW)?.click()

const CELL_BUTTON: readonly GuideStoryStep[] = [
  {
    title: 'Кнопка плагина в ячейках',
    hint: 'Автор плагина поставил в ячейки колонки имени свою кнопку избранного. Пока ни одна строка не отмечена.',
    props: ({ log }) => ({ extraPlugins: favoriteRowsOf(log) }),
  },
  {
    title: 'Пользователь отметил строку',
    hint: 'Пользователь нажал кнопку в первой строке. Плагин запомнил отметку в своём состоянии: кнопка показана включённой, приложение получило колбэк со строкой и отметкой.',
    enter: untilDone(root => isMarked(root, MARKED_ROW), markFirstRow),
  },
  {
    title: 'Отметка пережила прокрутку',
    hint: 'Пользователь прокрутил таблицу вниз и обратно. Строка ушла из виду и вернулась с отметкой: состояние хранит плагин, а не кнопка.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!markOf(root, MARKED_ROW), signal)
      if (!isMarked(root, MARKED_ROW)) markFirstRow(root)
      await pollUntil(() => isMarked(root, MARKED_ROW), signal)
      const scroller = scrollerOf(root)!
      scroller.scrollTop = scroller.scrollHeight
      await pollUntil(() => !isMounted(root, MARKED_ROW), signal)
      scroller.scrollTop = 0
      await pollUntil(() => isMarked(root, MARKED_ROW), signal)
    }),
  },
]

/** ADR 0028, S1: автор плагина ставит в ячейки кнопку со своим состоянием. */
export const PluginApiCellButton: StoryObj<StoryProps> = {
  name: 'Cell button',
  parameters: { scenario: '0028/S1', ...GUIDED },
  render: args => (
    <GuideStory
      title="Кнопка плагина в ячейке"
      steps={CELL_BUTTON}
      args={guideArgs({ ...GRID, dataCount: 100 }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CELL_BUTTON[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(markOf(canvas, MARKED_ROW)).not.toBeNull())
      expect(markedRows(canvas)).toBe(0)
    })
    await step(CELL_BUTTON[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isMarked(canvas, MARKED_ROW)).toBe(true))
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(`onToggleFavorite[^\\n]*${MARKED_ROW}[^\\n]*true`),
        ),
      )
    })
    await step(CELL_BUTTON[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(isMarked(canvas, MARKED_ROW)).toBe(true)
      expect(markedRows(canvas)).toBe(1)
      await settle()
    })
  },
}

// S2: состояние плагина — у приложения.

interface AppFavoritesArgs {
  enabled?: boolean
  favorites?: Marks
  onFavoritesChange?: (next: Marks) => void
}

const AppFavoriteButton = ({
  row,
  column,
  state: [marks, setMarks],
}: PluginCellStateProps<Record<never, never>, Marks>) =>
  column.id === FAVORITE_COLUMN ? (
    <MarkToggle
      marked={marks[row.id] ?? false}
      onToggle={() => setMarks({ ...marks, [row.id]: !marks[row.id] })}
    />
  ) : null

const appFavorites = definePlugin<AppFavoritesArgs>()({
  id: 'appFavorites',
  state: (): Marks => ({}),
  stateName: 'favorites',
  slots: [
    {
      id: 'appFavorites',
      slot: 'rightCellSlot',
      state: true,
      component: AppFavoriteButton,
    },
  ],
})

const UNMARKED_ROW = 'item-id-1'
const KEPT_ROW = 'item-id-3'
const APP_MARKS: Marks = { [UNMARKED_ROW]: true, [KEPT_ROW]: true }
const NO_MARKS: Marks = {}

/** Отметки и журнал за записями плагина: приложение истории строит их заново из своих. */
const favoritesOfEntries = new WeakMap<
  object,
  { marks: Marks; log?: ConsoleLog }
>()

/**
 * Приложение истории хранит отметки у себя: новое значение из колбэка оно сохраняет и
 * передаёт плагину следующей отрисовкой.
 */
const appFavoritesWith = (marks: Marks, app: GuideApp, log?: ConsoleLog) => {
  const save = (next: Marks) =>
    app.update(props => ({
      ...props,
      extraPlugins: appFavoritesWith(next, app, log),
    }))
  const entries = [
    appFavorites({
      favorites: marks,
      onFavoritesChange: log
        ? loggedCallback(log, 'onFavoritesChange', save)
        : save,
    }),
  ]
  favoritesOfEntries.set(entries, { marks, log })
  return entries
}
const appMarked = new WeakMap<ConsoleLog, ReturnType<typeof appFavoritesWith>>()

const CONTROLLED: readonly GuideStoryStep[] = [
  {
    title: 'Отметки задало приложение',
    hint: 'Приложение передало плагину отметки двух строк. Таблица показывает эти строки отмеченными.',
    props: ({ log, app }) => {
      if (!appMarked.has(log))
        appMarked.set(log, appFavoritesWith(APP_MARKS, app, log))
      return { extraPlugins: appMarked.get(log) }
    },
  },
  {
    title: 'Пользователь снял отметку',
    hint: 'Пользователь нажал кнопку отмеченной строки. Плагин передал приложению новый набор отметок, приложение сохранило его, и отметка снята.',
    enter: untilDone(
      root => !!markOf(root, UNMARKED_ROW) && !isMarked(root, UNMARKED_ROW),
      root => {
        if (isMarked(root, UNMARKED_ROW)) markOf(root, UNMARKED_ROW)?.click()
      },
    ),
  },
  {
    title: 'Приложение сбросило отметки',
    hint: 'Приложение передало плагину пустой набор. Отметки сняты во всех строках, хотя пользователь их не трогал.',
    enter: (_root, app) =>
      app.update(props => {
        const current = props.extraPlugins
          ? favoritesOfEntries.get(props.extraPlugins)
          : undefined
        return current?.marks === NO_MARKS
          ? props
          : {
              ...props,
              extraPlugins: appFavoritesWith(NO_MARKS, app, current?.log),
            }
      }),
  },
]

/** ADR 0028, S2: приложение задаёт состояние плагина и получает каждое его изменение. */
export const PluginApiControlledState: StoryObj<StoryProps> = {
  name: 'Controlled state',
  parameters: { scenario: '0028/S2', ...GUIDED },
  render: guided('Состояние плагина у приложения', CONTROLLED),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CONTROLLED[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(isMarked(canvas, UNMARKED_ROW)).toBe(true))
      expect(isMarked(canvas, KEPT_ROW)).toBe(true)
      expect(markedRows(canvas)).toBe(2)
    })
    await step(CONTROLLED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isMarked(canvas, UNMARKED_ROW)).toBe(false))
      expect(isMarked(canvas, KEPT_ROW)).toBe(true)
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(`onFavoritesChange[^\\n]*${UNMARKED_ROW}[^\\n]*false`),
        ),
      )
    })
    await step(CONTROLLED[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(markedRows(canvas)).toBe(0))
      expect(markOf(canvas, KEPT_ROW)).not.toBeNull()
      await settle()
    })
  },
}

// S3: служебная колонка плагина.

type FlagRow = (change: { rowId: string }) => void

interface RowFlagsArgs {
  enabled?: boolean
  onFlagRow?: FlagRow
  onFlagAll?: () => void
}
interface RowFlagsHooks {
  onFlagRow: FlagRow
  onFlagAll: () => void
}

const FLAG_COLUMN = 'rowFlags'

const FlagRowButton = ({ row, hooks }: PluginCellProps<RowFlagsHooks>) => (
  <IconButton
    data-testid="flag-row"
    label="Flag row"
    onClick={() => hooks.onFlagRow({ rowId: row.id })}
  >
    <Flag size={16} />
  </IconButton>
)

const FlagAllButton = ({ hooks }: PluginHeaderProps<RowFlagsHooks>) => (
  <IconButton
    data-testid="flag-all"
    label="Flag all rows"
    onClick={() => hooks.onFlagAll()}
  >
    <Flag size={16} />
  </IconButton>
)

const rowFlags = definePlugin<RowFlagsArgs>()({
  id: 'rowFlags',
  hooks: (args): RowFlagsHooks => ({
    onFlagRow: args.onFlagRow ?? accept,
    onFlagAll: args.onFlagAll ?? accept,
  }),
  column: {
    id: FLAG_COLUMN,
    side: 'leading',
    order: 0,
    controlSized: true,
    cell: FlagRowButton,
    header: FlagAllButton,
    make: ({ cell, header }) =>
      ({
        id: FLAG_COLUMN,
        skeletonCell: 'control',
        minSize: 0,
        size: COLUMN_ACTIONS_SIZE,
        enableSorting: false,
        enableResizing: false,
        header,
        cell,
      }) as unknown as ColumnDef<any, any, any>,
  },
})
const rowFlagsOf = perLog(log => [
  rowFlags({
    onFlagRow: loggedCallback(log, 'onFlagRow', accept),
    onFlagAll: loggedCallback(log, 'onFlagAll', accept),
  }),
])

const FLAGGED_ROW = 'item-id-0'
const flagOf = (root: ParentNode, row: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] [data-testid="flag-row"]`,
  )
const flagAllOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${FLAG_COLUMN}"] [data-testid="flag-all"]`,
  )

const SERVICE_COLUMN: readonly GuideStoryStep[] = [
  {
    title: 'Служебная колонка плагина',
    hint: 'Плагин добавил свою служебную колонку: в заголовке — кнопка для всех строк, в каждой строке — кнопка для этой строки.',
    props: ({ log }) => ({ extraPlugins: rowFlagsOf(log) }),
  },
  {
    title: 'Пользователь нажал кнопку строки',
    hint: 'Пользователь нажал кнопку в первой строке. Кнопка вызвала колбэк плагина: приложение получило строку, журнал — в консоли под таблицей.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!flagOf(root, FLAGGED_ROW), signal)
      clickByMouse(flagOf(root, FLAGGED_ROW)!)
    }),
  },
]

/** ADR 0028, S3: автор плагина добавляет служебную колонку, её кнопки зовут колбэки плагина. */
export const PluginApiServiceColumn: StoryObj<StoryProps> = {
  name: 'Service column',
  parameters: { scenario: '0028/S3', ...GUIDED },
  render: guided('Служебная колонка плагина', SERVICE_COLUMN),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVICE_COLUMN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(flagAllOf(canvas)).not.toBeNull())
      expect(flagOf(canvas, FLAGGED_ROW)).not.toBeNull()
    })
    await step(SERVICE_COLUMN[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(`onFlagRow[^\\n]*${FLAGGED_ROW}`),
        ),
      )
      expect(consoleText()).not.toMatch(/onFlagAll/)
      await settle()
    })
  },
}

// --- Падение плагина автора (ADR 0037) ---------------------------------------------

const CRASH_ROW = 'item-id-2'
const VISITS_FAILURE = /has no visit count/

/** Кнопка плагина с числом визитов строки: компонент ждёт число в каждой строке. */
const VisitsButton = ({ row, column }: CellComponentProps) => {
  if (column.id !== FAVORITE_COLUMN) return null
  const { visits } = row.original as { visits?: unknown }
  if (typeof visits !== 'number') {
    throw new Error(`visitsBadge: row ${row.id} has no visit count`)
  }
  return (
    <CellButton
      data-testid="visits"
      label={`${visits} visits`}
      icon={<Eye size={16} />}
      revealOnHover={false}
    />
  )
}

const visitsBadge = definePlugin()({
  id: 'visitsBadge',
  slots: [
    { id: 'visitsBadge', slot: 'rightCellSlot', component: VisitsButton },
  ],
})
const VISITS_BADGE = [visitsBadge()]

// Данные — при первой отрисовке истории, а не при импорте модуля (getData пересевает
// общий faker); строка без числа визитов — из тех же данных.
let crashData: ReturnType<typeof getData> | undefined
let brokenData: ReturnType<typeof getData> | undefined
const crashRows = () => (crashData ??= getData(30))
const brokenRows = () =>
  (brokenData ??= crashRows().map(row =>
    row.id === CRASH_ROW ? { ...row, visits: null } : row,
  ))

const visitsOf = (root: ParentNode, row: string) =>
  root.querySelector(
    `.data-grid__body-row[data-row-id="${row}"] [data-testid="visits"]`,
  )
const checkboxOf = (root: ParentNode, row: string) =>
  root.querySelector(
    `.data-grid__body-row[data-row-id="${row}"] [role="checkbox"]`,
  )

const CRASH: readonly GuideStoryStep[] = [
  {
    title: 'Плагин работает',
    hint: 'В ячейках колонки имени — кнопка стороннего плагина с числом визитов, рядом работают встроенные плагины: выбор строк и сортировка.',
    props: () => ({ dataOverride: crashRows(), extraPlugins: VISITS_BADGE }),
  },
  {
    title: 'Плагин упал на строке',
    hint: 'Приложение передало строку без числа визитов, и компонент плагина бросил на ней ошибку. На месте его кнопки в этой строке пусто; остальные строки и встроенные плагины работают, ошибка — в консоли браузера.',
    enter: (_root, app) =>
      app.update(props => ({ ...props, dataOverride: brokenRows() })),
  },
]

/** ADR 0037, S1: компонент плагина падает на одной строке — таблица работает. */
export const PluginApiPluginCrash: StoryObj<StoryProps> = {
  name: 'Plugin crash',
  parameters: {
    scenario: '0037/S1',
    consoleErrors: {
      expected: [VISITS_FAILURE],
      reason:
        'Шаг гайда показывает падение компонента плагина: React и таблица пишут его ошибку в консоль (ADR 0037, S1).',
    },
    ...GUIDED,
  },
  render: args => (
    <GuideStory
      title="Падение плагина"
      steps={CRASH}
      args={guideArgs(
        { ...GRID, enableRowSelection: true, enableColumnSorting: true },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CRASH[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(visitsOf(canvas, CRASH_ROW)).not.toBeNull())
      expect(checkboxOf(canvas, CRASH_ROW)).not.toBeNull()
      expect(canvas.querySelector('.column-sort__button')).not.toBeNull()
    })
    await step(CRASH[1]!.title, async () => {
      // Сообщения консоли за шаг — проверка, а не событие: шаг их только вызывает.
      const logged: string[] = []
      const error = console.error
      console.error = (...args: unknown[]) => {
        logged.push(args.map(String).join(' '))
        error(...args)
      }
      try {
        await guideNext(canvas)
        await until(() => expect(visitsOf(canvas, CRASH_ROW)).toBeNull())
        await until(() =>
          expect(logged.some(message => VISITS_FAILURE.test(message))).toBe(
            true,
          ),
        )
      } finally {
        console.error = error
      }
      expect(checkboxOf(canvas, CRASH_ROW)).not.toBeNull()
      expect(visitsOf(canvas, 'item-id-1')).not.toBeNull()
      expect(canvas.querySelector('.column-sort__button')).not.toBeNull()
      await settle()
    })
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
/** Действие строки ждёт: заняты её ячейки, а не кнопка (ADR 0177, §1). */
const rowWaits = (root: ParentNode) =>
  !!root.querySelector(
    `.data-grid__body-row[data-row-id="${CANCEL_ROW}"] [data-column-id][aria-busy="true"]`,
  )
const failedButton = (button: Element | null) =>
  button
    ?.querySelector('[data-failure-indicator]')
    ?.getAttribute('data-shown') === 'true'

/** Действие строки и выгрузка ждут: пользователь нажал обе кнопки. */
const bothHeld = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(() => {
    if (!rowWaits(root)) archiveButton(root)?.click()
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
    hint: 'Пользователь запустил действие строки и выгрузку: ячейки строки чуть темнеют и по ним проходит светлый блик, кнопка выгрузки показывает ожидание.',
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
        () => !rowWaits(root) && !busyButton(exportButtonOf(root)),
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
      await expect(rowWaits(canvas)).toBe(true)
      await expect(canvas.querySelector('[data-pending-wave]')).not.toBeNull()
      await expect(busyButton(exportButtonOf(canvas))).toBe(true)
    })
    await step(CANCEL_ALL[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(rowWaits(canvas)).toBe(false)
      await expect(busyButton(exportButtonOf(canvas))).toBe(false)
      await settle()
      await expect(failedButton(archiveButton(canvas))).toBe(false)
      await expect(failedButton(exportButtonOf(canvas))).toBe(false)
      await expect(consoleText()).toContain('cancelPending')
    })
  },
}

// --- Вклад в тело для автора плагина (ADR 0173) -------------------------------------------

const CHANGED = [
  cellKey('item-id-0', 'firstName'),
  cellKey('item-id-2', 'age'),
  cellKey('item-id-4', 'lastName'),
]
const MORE_CHANGED = [...CHANGED, cellKey('item-id-1', 'visits')]

const bodyCell = (root: ParentNode, rowId: string, columnId: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )
const changedCells = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-changes-cell]')].map(
    cell =>
      `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${cell.dataset.columnId}`,
  )

const BODY_ATTRIBUTES: readonly GuideStoryStep[] = [
  {
    title: 'Плагин подключён',
    hint: 'Плагин автора отмечает изменённые ячейки. Изменений пока нет, отметок нет.',
    props: () => ({ extraPlugins: [changes({ changed: [] })] }),
  },
  {
    title: 'Приложение передало изменённые ячейки',
    hint: 'Приложение передало плагину три изменённые ячейки. Плагин пометил их и задал цвет метки, полоску у левого края ячейки рисует оформление автора.',
    props: () => ({ extraPlugins: [changes({ changed: CHANGED })] }),
  },
  {
    title: 'Изменилась ещё одна ячейка',
    hint: 'Приложение добавило ещё одну ячейку. Метку получила только она, прежние метки остались на месте.',
    props: () => ({ extraPlugins: [changes({ changed: MORE_CHANGED })] }),
  },
]

/** ADR 0173, S1: автор плагина помечает изменённые ячейки атрибутом и стилем. */
export const PluginApiBodyAttributes: StoryObj<StoryProps> = {
  name: 'Body attributes',
  parameters: { scenario: '0173/S1', ...GUIDED },
  render: guided('Отметки ячеек плагином', BODY_ATTRIBUTES),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(BODY_ATTRIBUTES[0]!.title, async () => {
      await waitForRows(canvas)
      expect(changedCells(canvas)).toEqual([])
    })
    await step(BODY_ATTRIBUTES[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(changedCells(canvas).sort()).toEqual([...CHANGED].sort()),
      )
      const cell = bodyCell(canvas, 'item-id-0', 'firstName')!
      expect(cell.style.getPropertyValue('--changes-tone')).not.toBe('')
      expect(getComputedStyle(cell).backgroundImage).not.toBe('none')
    })
    await step(BODY_ATTRIBUTES[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(changedCells(canvas).sort()).toEqual([...MORE_CHANGED].sort()),
      )
      await settle()
    })
  },
}

const CARD_CELL = { rowId: 'item-id-1', columnId: 'firstName' }
const cellCardOf = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-card"]')

const BODY_EVENTS: readonly GuideStoryStep[] = [
  {
    title: 'Плагин подключён',
    hint: 'Плагин автора добавил свой жест: двойной щелчок по ячейке открывает карточку с её значением.',
    props: () => ({ extraPlugins: [cellCard()] }),
  },
  {
    title: 'Пользователь дважды щёлкнул по ячейке',
    hint: 'Под ячейкой открылась карточка автора с названием колонки и значением. Ячейка обведена, пока карточка открыта.',
    enter: untilDone(
      () => !!cellCardOf(),
      root =>
        bodyCell(root, CARD_CELL.rowId, CARD_CELL.columnId)?.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
        ),
    ),
  },
  {
    title: 'Пользователь закрыл карточку',
    hint: 'Карточка закрылась, обводка ячейки снята.',
    enter: untilDone(
      root =>
        !cellCardOf() &&
        !bodyCell(root, CARD_CELL.rowId, CARD_CELL.columnId)?.hasAttribute(
          'data-cellcard-open',
        ),
      root => {
        const card = cellCardOf()
        if (card) card.querySelector<HTMLElement>('button')?.click()
        else
          bodyCell(root, CARD_CELL.rowId, CARD_CELL.columnId)?.dispatchEvent(
            new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
          )
      },
    ),
  },
]

/** ADR 0173, S2: автор плагина добавляет свой жест — двойной щелчок открывает его карточку. */
export const PluginApiBodyEvents: StoryObj<StoryProps> = {
  name: 'Body events',
  parameters: { scenario: '0173/S2', ...GUIDED },
  render: guided('Свой жест над телом', BODY_EVENTS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const cell = () => bodyCell(canvas, CARD_CELL.rowId, CARD_CELL.columnId)!
    await step(BODY_EVENTS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(cellCardOf()).toBeNull()
    })
    await step(BODY_EVENTS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(cellCardOf()).not.toBeNull())
      const value = cell().querySelector(
        '.data-grid__cell-wrapper-title',
      )!.textContent!
      expect(cellCardOf()!.textContent).toContain(value)
      expect(cell().hasAttribute('data-cellcard-open')).toBe(true)
      await settle()
    })
    await step(BODY_EVENTS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(cellCardOf()).toBeNull())
      expect(cell().hasAttribute('data-cellcard-open')).toBe(false)
      await settle()
    })
  },
}

const KEY_CELL = { rowId: 'item-id-1', columnId: 'firstName' }
const NEXT_CELL = { rowId: 'item-id-2', columnId: 'firstName' }
const markedCells = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-keymarks-cell]')].map(
    cell =>
      `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${cell.dataset.columnId}`,
  )
const activeCellKey = (root: ParentNode) => {
  const cell = root.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-kn-active]',
  )
  return cell
    ? `${cell.closest<HTMLElement>('[data-row-id]')!.dataset.rowId}:${cell.dataset.columnId}`
    : undefined
}
const pressKey = (root: ParentNode, key: string) =>
  root
    .querySelector<HTMLElement>('.data-grid__body-cell[data-kn-active]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
/** Пользователь делает ячейку активной и нажимает клавишу плагина. */
const markCell = (
  root: HTMLElement,
  target: { rowId: string; columnId: string },
) => {
  const key = cellKey(target.rowId, target.columnId)
  if (activeCellKey(root) !== key) {
    if (activeCellKey(root) === cellKey(KEY_CELL.rowId, KEY_CELL.columnId)) {
      pressKey(root, 'ArrowDown')
    } else bodyCell(root, target.rowId, target.columnId)?.focus()
    return
  }
  if (!markedCells(root).includes(key)) pressKey(root, MARK_KEY)
}

const BODY_KEYS: readonly GuideStoryStep[] = [
  {
    title: 'Своя клавиша плагина',
    hint: 'В таблице включена клавиатурная навигация. Плагин автора назначил свою клавишу: она отмечает активную ячейку.',
    props: () => ({
      enableKeyboardNavigation: true,
      extraPlugins: [keyMarks()],
    }),
  },
  {
    title: 'Пользователь нажал клавишу плагина',
    keyboard: true,
    hint: 'Пользователь выбрал ячейку и нажал клавишу плагина. Ячейка отмечена полоской у левого края, активная ячейка осталась на месте: клавишу взял плагин.',
    enter: untilDone(
      root =>
        markedCells(root).includes(cellKey(KEY_CELL.rowId, KEY_CELL.columnId)),
      root => markCell(root, KEY_CELL),
    ),
  },
  {
    title: 'Стрелка и снова клавиша плагина',
    keyboard: true,
    hint: 'Стрелку плагин не берёт: она сдвинула активную ячейку вниз, как обычно. Клавиша плагина отметила и новую ячейку.',
    enter: untilDone(
      root =>
        markedCells(root).includes(
          cellKey(NEXT_CELL.rowId, NEXT_CELL.columnId),
        ),
      root =>
        markedCells(root).includes(cellKey(KEY_CELL.rowId, KEY_CELL.columnId))
          ? markCell(root, NEXT_CELL)
          : markCell(root, KEY_CELL),
    ),
  },
]

/** ADR 0173, S3: автор плагина назначает свою клавишу. */
export const PluginApiBodyKeys: StoryObj<StoryProps> = {
  name: 'Body keys',
  parameters: { scenario: '0173/S3', ...GUIDED },
  render: guided('Своя клавиша плагина', BODY_KEYS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const first = cellKey(KEY_CELL.rowId, KEY_CELL.columnId)
    const next = cellKey(NEXT_CELL.rowId, NEXT_CELL.columnId)
    await step(BODY_KEYS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(markedCells(canvas)).toEqual([])
    })
    await step(BODY_KEYS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(markedCells(canvas)).toEqual([first]))
      expect(activeCellKey(canvas)).toBe(first)
      await settle()
    })
    await step(BODY_KEYS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(markedCells(canvas).sort()).toEqual([first, next].sort()),
      )
      expect(activeCellKey(canvas)).toBe(next)
      await settle()
    })
  },
}
