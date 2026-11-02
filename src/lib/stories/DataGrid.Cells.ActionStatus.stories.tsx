import { useState } from 'react'
import { Archive } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { CellContext, ColumnDef } from '../types'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { cellOf, untilDone } from './__mocks__/cellGestures'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { createHeldServer } from './__mocks__/heldServer'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { useWriteStoryCell } from './demos/storyRows'
import { definePlugin } from '../core/definePlugin'
import { useCellPending } from '../core/headerActions/cellActions'
import { SelectCheckbox } from '../ui/SelectCheckbox/SelectCheckbox'
import { Switch } from '../ui/Switch'

/**
 * Ожидание и итог действия на ячейке (ADR 0176): свой контрол показывает ожидание сам, событие
 * без контрола — волной на ячейке. Сохранение каждой ячейки ждёт ответа «сервера». Изменения
 * занятого объекта, повтор из отметки отказа и отмена сохранения — ADR 0177.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Action status',
} satisfies Meta<StoryProps>

export default meta

// --- Данные и ячейки ------------------------------------------------------------------

const PRIORITIES = ['Low', 'Medium', 'High'] as const
type Priority = (typeof PRIORITIES)[number]

interface Product {
  id: string
  name: string
  inStock: boolean
  published: boolean
  priority: Priority
}

const PRODUCTS: Product[] = [
  'Desk lamp',
  'Office chair',
  'Notebook',
  'Water bottle',
  'Headphones',
  'Backpack',
].map((name, index) => ({
  id: `item-id-${index + 1}`,
  name,
  inStock: index % 2 === 0,
  published: index % 3 !== 0,
  priority: PRIORITIES[index % 3]!,
}))

type Save = () => Promise<void>

interface CellProps {
  context: CellContext<any, Product, unknown>
  save: Save
  /** Приложение даёт таблице повтор сохранения — «Повторить» у отметки отказа. */
  retry?: boolean
}

/**
 * Сохранить значение ячейки: на время ответа — черновик в ячейке и ожидание по `indicator`;
 * успех пишет значение в данные, отказ возвращает прежнее со вспышкой.
 */
const useCellSave = <T,>(
  { context: { table, row, column }, save, retry }: CellProps,
  indicator: 'cell' | 'control',
) => {
  const write = useWriteStoryCell()
  const [draft, setDraft] = useState<{ value: T }>()
  const pending = useCellPending(table, row.id, column.id) !== undefined
  const commit = (value: T) => {
    setDraft({ value })
    table
      .trackCellAction({ cell: [row.id, column.id] }, save(), {
        indicator,
        label: String(column.columnDef.header),
        flashOnSuccess: indicator === 'cell',
        ...(retry ? { retry: () => commit(value) } : {}),
      })
      .then(
        () => write(row.id, column.id, value),
        () => {},
      )
      .finally(() => setDraft(undefined))
  }
  const value = draft ? draft.value : (row.getValue(column.id) as T)
  return { value, pending, commit }
}

const CheckboxCell = (props: CellProps) => {
  const { value, pending, commit } = useCellSave<boolean>(props, 'control')
  return (
    <SelectCheckbox
      selected={value}
      pending={pending}
      label={`${props.context.row.original.name}: in stock`}
      onClick={(_event, checked) => commit(checked)}
    />
  )
}

const SwitchCell = (props: CellProps) => {
  const { value, pending, commit } = useCellSave<boolean>(props, 'control')
  return (
    <Switch
      checked={value}
      pending={pending}
      aria-label={`${props.context.row.original.name}: published`}
      onCheckedChange={commit}
    />
  )
}

const nextPriority = (priority: Priority) =>
  PRIORITIES[(PRIORITIES.indexOf(priority) + 1) % PRIORITIES.length]!

/** Текст без контрола: двойной щелчок ставит следующий приоритет, ожидание — волной. */
const DoubleClickCell = (props: CellProps) => {
  const { value, pending, commit } = useCellSave<Priority>(props, 'cell')
  return (
    <span
      data-testid="priority-text"
      style={{ flex: 1, alignSelf: 'stretch', alignContent: 'center' }}
      onDoubleClick={() => {
        if (!pending) commit(nextPriority(value))
      }}
    >
      {value}
    </span>
  )
}

const columnsOf = (
  save: Save,
  { retry = false }: { retry?: boolean } = {},
): ColumnDef<any, any>[] => [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  {
    id: 'inStock',
    accessorKey: 'inStock',
    header: 'In stock',
    size: 110,
    cell: context => <CheckboxCell context={context} save={save} />,
  },
  {
    id: 'published',
    accessorKey: 'published',
    header: 'Published',
    size: 120,
    cell: context => <SwitchCell context={context} save={save} />,
  },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Priority',
    size: 140,
    cell: context => (
      <DoubleClickCell context={context} save={save} retry={retry} />
    ),
  },
]

// --- Шаги -----------------------------------------------------------------------------

const ROW = 'item-id-2'

const checkboxOf = (root: ParentNode) =>
  cellOf(root, ROW, 'inStock')?.querySelector<HTMLElement>(
    '[role="checkbox"]',
  ) ?? null
const switchOf = (root: ParentNode) =>
  cellOf(root, ROW, 'published')?.querySelector<HTMLElement>(
    '[role="switch"]',
  ) ?? null
const priorityOf = (root: ParentNode) =>
  cellOf(root, ROW, 'priority')?.querySelector<HTMLElement>(
    '[data-testid="priority-text"]',
  ) ?? null

const busy = (control: HTMLElement | null) =>
  control?.getAttribute('aria-busy') === 'true'
const checked = (control: HTMLElement | null) =>
  control?.getAttribute('aria-checked') === 'true'
const cellBusy = (root: ParentNode, column: string) =>
  cellOf(root, ROW, column)?.getAttribute('aria-busy') === 'true'
const flashOf = (root: ParentNode, column: string) =>
  cellOf(root, ROW, column)?.getAttribute('data-flash')
const doubleClick = (element: HTMLElement | null) =>
  element?.dispatchEvent(
    new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
  )

const START = PRODUCTS.find(product => product.id === ROW)!

// --- Playground -----------------------------------------------------------------------

const answerLater: Save = () =>
  new Promise(resolve => setTimeout(resolve, 1200))
const PLAYGROUND_COLUMNS = columnsOf(answerLater)

export const ActionStatusPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Флажок и переключатель показывают ожидание сами, приоритет меняется двойным щелчком —
  // ожидание волной на ячейке. «Сервер» отвечает через секунду.
  args: {
    columnsOverride: PLAYGROUND_COLUMNS,
    dataOverride: PRODUCTS,
    containerHeight: '420',
    height: '340',
    maxHeight: '340',
  },
  parameters: showControls(['enableKeyboardNavigation'], {
    dataCount: 'Строки — свои данные истории',
    columnCount: 'Колонки — свои колонки истории',
  }),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- ADR 0176 S1 ----------------------------------------------------------------------

const CHECKBOX_SERVER = createHeldServer()
const CHECKBOX_COLUMNS = columnsOf(CHECKBOX_SERVER.save)

const CHECKBOX: readonly GuideStoryStep[] = [
  {
    title: 'Флажки приложения',
    hint: 'В колонке наличия — флажок, который приложение поставило в ячейку само. Нажатие на него сохраняет значение на сервере.',
  },
  {
    title: 'Значение сохраняется',
    hint: 'Пользователь отметил товар. Флажок уже показывает новое значение, по его контуру бежит дуга ожидания, пока сервер не ответит. Ячейка не темнеет: ожидание видно на самом флажке.',
    states: ['body.pending'],
    enter: untilDone(
      root => busy(checkboxOf(root)),
      root => {
        CHECKBOX_SERVER.hold()
        checkboxOf(root)?.click()
      },
    ),
  },
  {
    title: 'Сервер сохранил',
    hint: 'Сервер принял значение: дуга ушла, флажок остался отмеченным.',
    enter: untilDone(
      root => !busy(checkboxOf(root)) && checked(checkboxOf(root)),
      root => {
        CHECKBOX_SERVER.answer(true)
        if (!busy(checkboxOf(root)) && !checked(checkboxOf(root)))
          checkboxOf(root)?.click()
      },
    ),
  },
]

/** ADR 0176, S1: свой флажок в ячейке показывает ожидание сохранения сам. */
export const ActionStatusCheckbox: StoryObj<StoryProps> = {
  name: 'Checkbox in a cell',
  parameters: {
    scenario: '0176/S1',
    // Каталог гоняет axe с color-contrast в обеих темах по каждой истории сценария.
    requirements: ['AC6'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Флажок с ожиданием"
      steps={CHECKBOX}
      args={guideArgs(
        { columnsOverride: CHECKBOX_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CHECKBOX[0]!.title, async () => {
      await waitForRows(canvas)
      expect(checked(checkboxOf(canvas))).toBe(START.inStock)
      await settle()
    })
    await step(CHECKBOX[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(checkboxOf(canvas))).toBe(true))
      expect(checked(checkboxOf(canvas))).toBe(!START.inStock)
      // Контрол ждёт сам: ячейка несёт только `aria-busy`, без подложки волны.
      expect(cellBusy(canvas, 'inStock')).toBe(true)
      expect(
        cellOf(canvas, ROW, 'inStock')!.hasAttribute('data-pending-wave'),
      ).toBe(false)
    })
    await step(CHECKBOX[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(checkboxOf(canvas))).toBe(false))
      expect(checked(checkboxOf(canvas))).toBe(!START.inStock)
      expect(cellBusy(canvas, 'inStock')).toBe(false)
      await settle()
    })
  },
}

// --- ADR 0176 S2 ----------------------------------------------------------------------

const SWITCH_SERVER = createHeldServer()
const SWITCH_COLUMNS = columnsOf(SWITCH_SERVER.save)

const reachSwitchRefusal = (root: HTMLElement) => {
  SWITCH_SERVER.answer(false)
  if (!busy(switchOf(root))) switchOf(root)?.click()
}

const SWITCH: readonly GuideStoryStep[] = [
  {
    title: 'Переключатели приложения',
    hint: 'В колонке публикации — переключатель, который приложение поставило в ячейку само. Нажатие сохраняет значение на сервере.',
  },
  {
    title: 'Значение сохраняется',
    hint: 'Пользователь переключил публикацию. Переключатель уже в новом положении, по его контуру бежит дуга ожидания.',
    states: ['body.pending'],
    enter: untilDone(
      root => busy(switchOf(root)),
      root => {
        SWITCH_SERVER.hold()
        switchOf(root)?.click()
      },
    ),
  },
  {
    title: 'Сервер сохранил',
    hint: 'Сервер принял значение: дуга ушла, переключатель остался в новом положении.',
    enter: untilDone(
      root =>
        !busy(switchOf(root)) && checked(switchOf(root)) !== START.published,
      root => {
        SWITCH_SERVER.answer(true)
        if (
          !busy(switchOf(root)) &&
          checked(switchOf(root)) === START.published
        )
          switchOf(root)?.click()
      },
    ),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь переключил ещё раз, но сервер отклонил значение. Переключатель вернулся в прежнее положение, ячейка коротко вспыхнула тоном ошибки, скринридер услышал причину отказа.',
    immediate: true,
    enter: untilDone(
      root =>
        flashOf(root, 'published') === 'reverted' &&
        !busy(switchOf(root)) &&
        checked(switchOf(root)) !== START.published,
      reachSwitchRefusal,
    ),
  },
]

/** ADR 0176, S2: свой переключатель ждёт сохранения, сервер отказывает — откат со вспышкой. */
export const ActionStatusSwitch: StoryObj<StoryProps> = {
  name: 'Switch refused by the server',
  parameters: {
    scenario: '0176/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Переключатель и отказ сервера"
      steps={SWITCH}
      args={guideArgs(
        { columnsOverride: SWITCH_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SWITCH[0]!.title, async () => {
      await waitForRows(canvas)
      expect(checked(switchOf(canvas))).toBe(START.published)
      await settle()
    })
    await step(SWITCH[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(switchOf(canvas))).toBe(true))
      expect(checked(switchOf(canvas))).toBe(!START.published)
    })
    await step(SWITCH[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(switchOf(canvas))).toBe(false))
      expect(checked(switchOf(canvas))).toBe(!START.published)
      await settle()
    })
    await step(SWITCH[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashOf(canvas, 'published')).toBe('reverted'))
      // Вспышка — в кадре отказа, значение из данных — следующим рендером ячейки.
      await until(() =>
        expect(checked(switchOf(canvas))).toBe(!START.published),
      )
      await until(() => expect(flashOf(canvas, 'published')).toBeFalsy())
      await settle()
    })
  },
}

// --- ADR 0176 S3 ----------------------------------------------------------------------

const DOUBLE_SERVER = createHeldServer()
const DOUBLE_COLUMNS = columnsOf(DOUBLE_SERVER.save)
const NEXT = nextPriority(START.priority)

const DOUBLE: readonly GuideStoryStep[] = [
  {
    title: 'Приоритет без кнопки правки',
    hint: 'Приоритет меняется двойным щелчком по тексту: следующий по кругу. Контрола в ячейке нет — показать ожидание на нём негде.',
  },
  {
    title: 'Значение сохраняется',
    hint: 'Пользователь дважды щёлкнул по приоритету. В ячейке новое значение, она чуть темнеет и по ней проходит блик, пока сервер не ответит.',
    states: ['body.menuPending'],
    enter: untilDone(
      root => cellBusy(root, 'priority'),
      root => {
        DOUBLE_SERVER.hold()
        doubleClick(priorityOf(root))
      },
    ),
  },
  {
    title: 'Сервер сохранил',
    hint: 'Сервер принял значение: волна ушла, ячейка коротко вспыхнула тоном успеха.',
    immediate: true,
    enter: untilDone(
      root =>
        !cellBusy(root, 'priority') && priorityOf(root)?.textContent === NEXT,
      root => {
        DOUBLE_SERVER.answer(true)
        if (
          !cellBusy(root, 'priority') &&
          priorityOf(root)?.textContent === START.priority
        )
          doubleClick(priorityOf(root))
      },
    ),
  },
]

/** ADR 0176, S3: двойной щелчок меняет текст ячейки без контрола — ожидание волной. */
export const ActionStatusDoubleClick: StoryObj<StoryProps> = {
  name: 'Double-click without a control',
  parameters: {
    scenario: '0176/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Двойной щелчок и волна"
      steps={DOUBLE}
      args={guideArgs(
        { columnsOverride: DOUBLE_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DOUBLE[0]!.title, async () => {
      await waitForRows(canvas)
      expect(priorityOf(canvas)!.textContent).toBe(START.priority)
      await settle()
    })
    await step(DOUBLE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(cellBusy(canvas, 'priority')).toBe(true))
      expect(priorityOf(canvas)!.textContent).toBe(NEXT)
      expect(
        cellOf(canvas, ROW, 'priority')!.hasAttribute('data-pending-wave'),
      ).toBe(true)
    })
    await step(DOUBLE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(flashOf(canvas, 'priority')).toBe('accepted'))
      expect(cellBusy(canvas, 'priority')).toBe(false)
      expect(priorityOf(canvas)!.textContent).toBe(NEXT)
      await until(() => expect(flashOf(canvas, 'priority')).toBeFalsy())
      await settle()
    })
  },
}

// --- ADR 0177: занятый объект и отказ на ячейке ---------------------------------------

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const pressKey = (input: HTMLInputElement, key: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

const inputIn = (root: ParentNode, column: string) =>
  cellOf(root, ROW, column)?.querySelector<HTMLInputElement>('input') ?? null
const editButtonIn = (root: ParentNode, column: string) =>
  cellOf(root, ROW, column)?.querySelector<HTMLElement>(
    '.cell__button button',
  ) ?? null
const waved = (root: ParentNode, column: string) =>
  !!cellOf(root, ROW, column)?.hasAttribute('data-pending-wave')
const issueIn = (root: ParentNode, column: string) =>
  cellOf(root, ROW, column)?.querySelector<HTMLElement>(
    'button[data-cell-issue]',
  ) ?? null
const issuePopover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const popoverAction = (action: 'retry' | 'discard') =>
  issuePopover()?.querySelector<HTMLElement>(`[data-action="${action}"]`) ??
  null
/** Текст ячейки без её кнопок и отметки. */
const textIn = (root: ParentNode, column: string) => {
  const copy = cellOf(root, ROW, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue]')
    .forEach(button => button.remove())
  return copy?.textContent?.trim()
}

/** Сохранить в ячейке `column` текст `value` — по такту на действие. */
const saveText = (root: HTMLElement, column: string, value: string) => {
  const input = inputIn(root, column)
  if (!input) editButtonIn(root, column)?.click()
  else if (input.value !== value) typeInto(input, value)
  else pressKey(input, 'Enter')
}

const TEXT_COLUMNS: ColumnDef<any, any>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 220 },
  { id: 'priority', accessorKey: 'priority', header: 'Priority', size: 140 },
]
const RENAMED = 'Ergonomic chair'

// --- ADR 0177 S3 ----------------------------------------------------------------------

const BUSY_SAVE = createHeldServer()
const BUSY_ARCHIVE = createHeldServer()

const busyActions = definePlugin()({
  id: 'busyActions',
  slotActions: [
    {
      id: 'archive',
      slot: 'actionRowSlot',
      icon: () => <Archive width={16} height={16} />,
      label: () => 'Archive',
      onSelect: () => BUSY_ARCHIVE.save(),
    },
  ],
})

const BUSY_PLUGINS = [busyActions()]

const archiveButton = (root: ParentNode) =>
  root
    .querySelector(`.data-grid__body-row[data-row-id="${ROW}"]`)
    ?.querySelector<HTMLElement>('button[aria-label$="Archive"]') ?? null

/** Дойти до ждущего сохранения названия. */
const reachSaving = (root: HTMLElement) => {
  BUSY_SAVE.hold()
  saveText(root, 'name', RENAMED)
}
/** Дойти до ждущего действия строки: сохранение названия отвечено. */
const reachArchiving = (root: HTMLElement) => {
  BUSY_SAVE.answer(true)
  BUSY_ARCHIVE.hold()
  if (!waved(root, 'priority')) archiveButton(root)?.click()
}

const BUSY_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Правка и действие строки',
    hint: 'Ячейки товара можно править, у строки есть действие архивации. Сохранение и действие ждут ответа сервера.',
  },
  {
    title: 'Значение сохраняется',
    hint: 'Пользователь сохранил новое название товара, сервер ещё не ответил. Новое название уже в ячейке, ячейка под волной ожидания.',
    states: ['body.menuPending'],
    enter: untilDone(root => waved(root, 'name'), reachSaving),
  },
  {
    title: 'Изменение не принято',
    hint: 'Пользователь попытался снова открыть правку этой ячейки, пока значение сохраняется. Изменение не принято: ячейка коротко вспыхнула тоном отката, правка не открылась.',
    states: ['body.menuPending'],
    immediate: true,
    enter: untilDone(
      root =>
        cellOf(root, ROW, 'name')?.getAttribute('data-flash') === 'reverted',
      root => {
        if (!waved(root, 'name')) reachSaving(root)
        else editButtonIn(root, 'name')?.click()
      },
    ),
  },
  {
    title: 'Действие строки идёт',
    hint: 'Сервер сохранил название, и пользователь запустил действие строки. Теперь под волной ожидания вся строка.',
    states: ['body.menuPending'],
    enter: untilDone(
      root =>
        waved(root, 'name') &&
        waved(root, 'priority') &&
        !inputIn(root, 'name'),
      reachArchiving,
    ),
  },
  {
    title: 'Правка строки не принята',
    hint: 'Пользователь попытался править другую ячейку строки, пока действие идёт. Ячейка вспыхнула тоном отката, правка не открылась.',
    states: ['body.menuPending'],
    immediate: true,
    enter: untilDone(
      root =>
        cellOf(root, ROW, 'priority')?.getAttribute('data-flash') ===
        'reverted',
      root => {
        if (!waved(root, 'priority')) reachArchiving(root)
        else editButtonIn(root, 'priority')?.click()
      },
    ),
  },
]

/** ADR 0177, S3: изменения занятой ячейки и занятой строки не принимаются. */
export const BusyObjectIgnored: StoryObj<StoryProps> = {
  name: 'Change while saving',
  parameters: { scenario: '0177/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Изменение занятого объекта"
      steps={BUSY_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          editableColumns: ['name', 'priority'],
          enableRowActions: true,
          // Только своё действие строки, без демо-кнопок.
          actionsDemo: 'none',
          enableCellSelection: true,
          enableKeyboardNavigation: true,
          columnsOverride: TEXT_COLUMNS,
          dataOverride: PRODUCTS,
          onCellEdit: BUSY_SAVE.save,
          extraPlugins: BUSY_PLUGINS,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const live = () =>
      document.querySelector('[role="status"][aria-live="polite"]')
        ?.textContent ?? ''
    await step(BUSY_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(archiveButton(canvas)).not.toBeNull()
      await settle()
    })
    await step(BUSY_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(true))
      expect(waved(canvas, 'priority')).toBe(false)
      expect(textIn(canvas, 'name')).toBe(RENAMED)
    })
    await step(BUSY_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, ROW, 'name')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      expect(inputIn(canvas, 'name')).toBeNull()
      await until(() =>
        expect(live()).toContain(
          labels.announceStillSaving(String(TEXT_COLUMNS[0]!.header)),
        ),
      )
    })
    await step(BUSY_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'priority')).toBe(true))
      expect(waved(canvas, 'name')).toBe(true)
      expect(textIn(canvas, 'name')).toBe(RENAMED)
    })
    await step(BUSY_STEPS[4]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, ROW, 'priority')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      expect(inputIn(canvas, 'priority')).toBeNull()
      await settle()
    })
  },
}

// --- ADR 0177 S5 ----------------------------------------------------------------------

const RETRY_SERVER = createHeldServer()
const RETRY_COLUMNS = columnsOf(RETRY_SERVER.save, { retry: true })

/** Дойти до отказа приоритета: «сервер» отказывает, пользователь меняет приоритет. */
const reachPriorityRefusal = (root: HTMLElement) => {
  RETRY_SERVER.answer(false)
  // Отказ уже пришёл — новое сохранение не нужно.
  if (!cellBusy(root, 'priority') && !issueIn(root, 'priority'))
    doubleClick(priorityOf(root))
}

const RETRY_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Ячейки приложения',
    hint: 'В колонке приоритета — текст приложения: двойной щелчок ставит следующий приоритет и сохраняет его на сервере.',
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь сменил приоритет, но сервер отклонил значение. В ячейке прежний приоритет, в её правом верхнем углу — отметка отказа.',
    states: ['body.error'],
    enter: untilDone(
      root => !!issueIn(root, 'priority') && !cellBusy(root, 'priority'),
      reachPriorityRefusal,
    ),
  },
  {
    title: 'Отметка открыта',
    hint: 'Пользователь нажал на отметку. Поповер показывает причину отказа и предлагает повторить сохранение: приложение сообщило таблице, как повторить своё действие.',
    states: ['body.error', 'overlay.cellIssue'],
    enter: untilDone(
      () => !!issuePopover(),
      root => {
        if (!issueIn(root, 'priority')) reachPriorityRefusal(root)
        else issueIn(root, 'priority')!.click()
      },
    ),
  },
  {
    title: 'Повтор принят',
    hint: 'Пользователь повторил сохранение, и сервер принял значение. В ячейке новый приоритет, отметки отказа больше нет.',
    enter: untilDone(
      root =>
        !issueIn(root, 'priority') &&
        !cellBusy(root, 'priority') &&
        priorityOf(root)?.textContent === nextPriority(START.priority),
      root => {
        if (popoverAction('retry')) {
          RETRY_SERVER.answer(true)
          popoverAction('retry')!.click()
        } else if (issueIn(root, 'priority')) issueIn(root, 'priority')!.click()
        else reachPriorityRefusal(root)
      },
    ),
  },
]

/** ADR 0177, S5: свой контрол приложения даёт таблице повтор — «Повторить» у отметки. */
export const ActionStatusRetry: StoryObj<StoryProps> = {
  name: 'Retry from the mark',
  parameters: { scenario: '0177/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title="Повтор из отметки"
      steps={RETRY_STEPS}
      args={guideArgs(
        { columnsOverride: RETRY_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RETRY_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(priorityOf(canvas)?.textContent).toBe(START.priority),
      )
      await settle()
    })
    await step(RETRY_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(issueIn(canvas, 'priority')).not.toBeNull())
      await until(() =>
        expect(priorityOf(canvas)?.textContent).toBe(START.priority),
      )
      await settle()
    })
    await step(RETRY_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(issuePopover()).not.toBeNull())
      expect(popoverAction('retry')).not.toBeNull()
      expect(popoverAction('discard')).not.toBeNull()
      await settle()
    })
    await step(RETRY_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(priorityOf(canvas)?.textContent).toBe(
          nextPriority(START.priority),
        ),
      )
      await until(() => expect(issueIn(canvas, 'priority')).toBeNull())
      await settle()
    })
  },
}

// --- ADR 0177 S8 ----------------------------------------------------------------------

const CANCEL_SAVE = createHeldServer()

const contextMenuOn = (cell: HTMLElement | null) => {
  if (!cell) return
  const box = cell.getBoundingClientRect()
  cell.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: box.left + 10,
      clientY: box.top + box.height / 2,
    }),
  )
}
const cancelSaveItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menuitem"][data-action-id="contextMenu:cancelSave"]',
  )

const CANCEL_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Правка ячеек',
    hint: 'Название товара можно править: сохранённое значение уходит на сервер.',
  },
  {
    title: 'Значение сохраняется',
    hint: 'Пользователь сохранил новое название товара, сервер отвечает долго. Ячейка под волной ожидания.',
    states: ['body.menuPending'],
    enter: untilDone(
      root => waved(root, 'name'),
      root => {
        CANCEL_SAVE.hold()
        saveText(root, 'name', RENAMED)
      },
    ),
  },
  {
    title: 'Меню ячейки',
    hint: 'Пользователь открыл контекстное меню ячейки. Пока значение сохраняется, в меню есть пункт отмены сохранения.',
    states: ['body.menuPending', 'overlay.contextMenu'],
    enter: untilDone(
      () => !!cancelSaveItem(),
      root => {
        if (!waved(root, 'name')) {
          CANCEL_SAVE.hold()
          saveText(root, 'name', RENAMED)
        } else contextMenuOn(cellOf(root, ROW, 'name'))
      },
    ),
  },
  {
    title: 'Сохранение отменено',
    hint: 'Пользователь отменил сохранение. Волны больше нет, в ячейке снова прежнее название; отмена — не ошибка, отметки отказа нет.',
    enter: untilDone(
      root =>
        !cancelSaveItem() &&
        !waved(root, 'name') &&
        textIn(root, 'name') === START.name,
      root => {
        if (cancelSaveItem()) cancelSaveItem()!.click()
        else if (waved(root, 'name')) contextMenuOn(cellOf(root, ROW, 'name'))
        else {
          CANCEL_SAVE.hold()
          saveText(root, 'name', RENAMED)
        }
      },
    ),
  },
]

/** ADR 0177, S8: долгое сохранение ячейки отменяется из контекстного меню. */
export const CellSaveCancelMenu: StoryObj<StoryProps> = {
  name: 'Cancel saving from the menu',
  parameters: { scenario: '0177/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отмена сохранения"
      steps={CANCEL_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          editableColumns: ['name'],
          enableContextMenu: true,
          columnsOverride: TEXT_COLUMNS,
          dataOverride: PRODUCTS,
          onCellEdit: CANCEL_SAVE.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CANCEL_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      expect(waved(canvas, 'name')).toBe(false)
      await settle()
    })
    await step(CANCEL_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(true))
      expect(textIn(canvas, 'name')).toBe(RENAMED)
    })
    await step(CANCEL_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(cancelSaveItem()).not.toBeNull())
    })
    await step(CANCEL_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(false))
      expect(textIn(canvas, 'name')).toBe(START.name)
      expect(issueIn(canvas, 'name')).toBeNull()
      await settle()
    })
  },
}
