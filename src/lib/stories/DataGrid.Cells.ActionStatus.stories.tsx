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
import { Checkbox } from '../ui/Checkbox/Checkbox'
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
    <Checkbox
      checked={value}
      pending={pending}
      label={`${props.context.row.original.name}: in stock`}
      onCheckedChange={checked => commit(checked)}
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
    dataCount: 'The story supplies its own rows',
    columnCount: 'The story supplies its own columns',
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
    title: { ru: 'Флажки приложения', en: "The app's checkboxes" },
    hint: {
      ru: 'В колонке наличия — флажок, который приложение поставило в ячейку само. Нажатие на него сохраняет значение на сервере.',
      en: 'The availability column has a checkbox that the app placed in the cell itself. Clicking it saves the value on the server.',
    },
  },
  {
    title: { ru: 'Значение сохраняется', en: 'The value is being saved' },
    hint: {
      ru: 'Пользователь отметил товар. Флажок уже показывает новое значение, по его контуру бежит дуга ожидания, пока сервер не ответит. Ячейка не темнеет: ожидание видно на самом флажке.',
      en: 'The user checked a product. The checkbox already shows the new value, and a waiting arc runs along its outline until the server responds. The cell does not darken: the waiting shows on the checkbox itself.',
    },
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
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Сервер принял значение: дуга ушла, флажок остался отмеченным.',
      en: 'The server accepted the value: the arc is gone, and the checkbox stays checked.',
    },
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
      title={{
        ru: 'Флажок с ожиданием',
        en: 'A checkbox with a pending state',
      }}
      steps={CHECKBOX}
      args={guideArgs(
        { columnsOverride: CHECKBOX_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CHECKBOX[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(checked(checkboxOf(canvas))).toBe(START.inStock))
      await settle()
    })
    await step(CHECKBOX[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(checkboxOf(canvas))).toBe(true))
      await until(() =>
        expect(checked(checkboxOf(canvas))).toBe(!START.inStock),
      )
      // Контрол ждёт сам: ячейка несёт только `aria-busy`, без подложки волны.
      await until(() => expect(cellBusy(canvas, 'inStock')).toBe(true))
      await until(() =>
        expect(
          cellOf(canvas, ROW, 'inStock')!.hasAttribute('data-pending-wave'),
        ).toBe(false),
      )
    })
    await step(CHECKBOX[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(checkboxOf(canvas))).toBe(false))
      await until(() =>
        expect(checked(checkboxOf(canvas))).toBe(!START.inStock),
      )
      await until(() => expect(cellBusy(canvas, 'inStock')).toBe(false))
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
    title: { ru: 'Переключатели приложения', en: "The app's switches" },
    hint: {
      ru: 'В колонке публикации — переключатель, который приложение поставило в ячейку само. Нажатие сохраняет значение на сервере.',
      en: 'The publication column has a switch that the app placed in the cell itself. Clicking it saves the value on the server.',
    },
  },
  {
    title: { ru: 'Значение сохраняется', en: 'The value is being saved' },
    hint: {
      ru: 'Пользователь переключил публикацию. Переключатель уже в новом положении, по его контуру бежит дуга ожидания.',
      en: 'The user toggled publishing. The switch is already in its new position, and a waiting arc runs along its outline.',
    },
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
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Сервер принял значение: дуга ушла, переключатель остался в новом положении.',
      en: 'The server accepted the value: the arc is gone, and the switch stays in its new position.',
    },
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
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь переключил ещё раз, но сервер отклонил значение. Переключатель вернулся в прежнее положение, ячейка коротко вспыхнула тоном ошибки, скринридер услышал причину отказа.',
      en: 'The user toggled it again, but the server rejected the value. The switch returned to its previous position, the cell briefly flashed in the error tone, and the screen reader announced the reason for the refusal.',
    },
    immediate: true,
    enter: (root, app) => {
      // Со свежей таблицы переключатель ещё в исходном положении: сперва сохранённое
      // переключение, затем отклонённое.
      let accepted = false
      return untilDone(
        root =>
          flashOf(root, 'published') === 'reverted' &&
          !busy(switchOf(root)) &&
          checked(switchOf(root)) !== START.published,
        root => {
          const toggle = switchOf(root)
          if (!toggle || busy(toggle)) return reachSwitchRefusal(root)
          if (!accepted && checked(toggle) === START.published) {
            accepted = true
            SWITCH_SERVER.answer(true)
            return toggle.click()
          }
          accepted = true
          if (flashOf(root, 'published')) return
          reachSwitchRefusal(root)
        },
      )(root, app)
    },
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
      title={{
        ru: 'Переключатель и отказ сервера',
        en: 'A switch and a server refusal',
      }}
      steps={SWITCH}
      args={guideArgs(
        { columnsOverride: SWITCH_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SWITCH[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(checked(switchOf(canvas))).toBe(START.published))
      await settle()
    })
    await step(SWITCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(switchOf(canvas))).toBe(true))
      await until(() =>
        expect(checked(switchOf(canvas))).toBe(!START.published),
      )
    })
    await step(SWITCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(busy(switchOf(canvas))).toBe(false))
      await until(() =>
        expect(checked(switchOf(canvas))).toBe(!START.published),
      )
      await settle()
    })
    await step(SWITCH[3]!.title.ru, async () => {
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
    title: {
      ru: 'Приоритет без кнопки правки',
      en: 'Priority without an edit button',
    },
    hint: {
      ru: 'Приоритет меняется двойным щелчком по тексту: следующий по кругу. Контрола в ячейке нет — показать ожидание на нём негде.',
      en: 'Double-clicking the text cycles the priority to the next one. The cell has no control to show the waiting on.',
    },
  },
  {
    title: { ru: 'Значение сохраняется', en: 'The value is being saved' },
    hint: {
      ru: 'Пользователь дважды щёлкнул по приоритету. В ячейке новое значение, она чуть темнеет и по ней проходит блик, пока сервер не ответит.',
      en: 'The user double-clicked a priority. The cell shows the new value and darkens slightly, and a shimmer runs across it until the server responds.',
    },
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
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Сервер принял значение: волна ушла, ячейка коротко вспыхнула тоном успеха.',
      en: 'The server accepted the value: the wave is gone, and the cell briefly flashed in the success tone.',
    },
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
      title={{ ru: 'Двойной щелчок и волна', en: 'A double click and a wave' }}
      steps={DOUBLE}
      args={guideArgs(
        { columnsOverride: DOUBLE_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DOUBLE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      expect(priorityOf(canvas)!.textContent).toBe(START.priority)
      await settle()
    })
    await step(DOUBLE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cellBusy(canvas, 'priority')).toBe(true))
      expect(priorityOf(canvas)!.textContent).toBe(NEXT)
      expect(
        cellOf(canvas, ROW, 'priority')!.hasAttribute('data-pending-wave'),
      ).toBe(true)
    })
    await step(DOUBLE[2]!.title.ru, async () => {
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
  // Со свежей таблицы название ещё не сохранялось: сперва сохранение.
  const name = cellOf(root, ROW, 'name')?.textContent ?? ''
  if (!name.includes(RENAMED) && !waved(root, 'name')) return reachSaving(root)
  BUSY_SAVE.answer(true)
  BUSY_ARCHIVE.hold()
  if (!waved(root, 'priority')) archiveButton(root)?.click()
}

const BUSY_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка и действие строки', en: 'Editing and a row action' },
    hint: {
      ru: 'Ячейки товара можно править, у строки есть действие архивации. Сохранение и действие ждут ответа сервера.',
      en: "The product's cells can be edited, and the row has an archive action. Both the save and the action wait for the server's response.",
    },
  },
  {
    title: { ru: 'Значение сохраняется', en: 'The value is being saved' },
    hint: {
      ru: 'Пользователь сохранил новое название товара, сервер ещё не ответил. Новое название уже в ячейке, ячейка под волной ожидания.',
      en: 'The user saved a new product name, and the server has not responded yet. The new name is already in the cell, and the cell is under the waiting wave.',
    },
    states: ['body.menuPending'],
    enter: untilDone(root => waved(root, 'name'), reachSaving),
  },
  {
    title: { ru: 'Изменение не принято', en: 'The change was not accepted' },
    hint: {
      ru: 'Пользователь попытался снова открыть правку этой ячейки, пока значение сохраняется. Изменение не принято: ячейка коротко вспыхнула тоном отката, правка не открылась.',
      en: 'The user tried to edit this cell again while its value was being saved. The change was not accepted: the cell briefly flashed in the revert tone, and editing did not open.',
    },
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
    title: { ru: 'Действие строки идёт', en: 'A row action is running' },
    hint: {
      ru: 'Сервер сохранил название, и пользователь запустил действие строки. Теперь под волной ожидания вся строка.',
      en: 'The server saved the name, and the user started a row action. Now the whole row is under the waiting wave.',
    },
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
    title: {
      ru: 'Правка строки не принята',
      en: 'The row edit was not accepted',
    },
    hint: {
      ru: 'Пользователь попытался править другую ячейку строки, пока действие идёт. Ячейка вспыхнула тоном отката, правка не открылась.',
      en: 'The user tried to edit another cell of the row while the action was running. The cell flashed in the revert tone, and editing did not open.',
    },
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
      title={{ ru: 'Изменение занятого объекта', en: 'Changing a busy object' }}
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
    await step(BUSY_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(archiveButton(canvas)).not.toBeNull())
      await settle()
    })
    await step(BUSY_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(true))
      await until(() => expect(waved(canvas, 'priority')).toBe(false))
      await until(() => expect(textIn(canvas, 'name')).toBe(RENAMED))
    })
    await step(BUSY_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, ROW, 'name')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      await until(() => expect(inputIn(canvas, 'name')).toBeNull())
      await until(() =>
        expect(live()).toContain(
          labels.announceStillSaving(String(TEXT_COLUMNS[0]!.header)),
        ),
      )
    })
    await step(BUSY_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'priority')).toBe(true))
      await until(() => expect(waved(canvas, 'name')).toBe(true))
      await until(() => expect(textIn(canvas, 'name')).toBe(RENAMED))
    })
    await step(BUSY_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(cellOf(canvas, ROW, 'priority')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      await until(() => expect(inputIn(canvas, 'priority')).toBeNull())
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
    title: { ru: 'Ячейки приложения', en: "The app's cells" },
    hint: {
      ru: 'В колонке приоритета — текст приложения: двойной щелчок ставит следующий приоритет и сохраняет его на сервере.',
      en: "The priority column holds the app's text: a double click sets the next priority and saves it on the server.",
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сменил приоритет, но сервер отклонил значение. В ячейке прежний приоритет, в её правом верхнем углу — отметка отказа.',
      en: 'The user changed the priority, but the server rejected the value. The cell shows the previous priority, with a refusal mark in its top right corner.',
    },
    states: ['body.error'],
    enter: untilDone(
      root => !!issueIn(root, 'priority') && !cellBusy(root, 'priority'),
      reachPriorityRefusal,
    ),
  },
  {
    title: { ru: 'Отметка открыта', en: "The mark's popover is open" },
    hint: {
      ru: 'Пользователь нажал на отметку. Поповер показывает причину отказа и предлагает повторить сохранение: приложение сообщило таблице, как повторить своё действие.',
      en: 'The user clicked the mark. The popover shows the reason for the refusal and offers to retry the save: the app told the table how to repeat its action.',
    },
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
    title: { ru: 'Повтор принят', en: 'The retry was accepted' },
    hint: {
      ru: 'Пользователь повторил сохранение, и сервер принял значение. В ячейке новый приоритет, отметки отказа больше нет.',
      en: 'The user retried the save, and the server accepted the value. The cell shows the new priority, and the refusal mark is gone.',
    },
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
      title={{ ru: 'Повтор из отметки', en: 'Retry from the mark' }}
      steps={RETRY_STEPS}
      args={guideArgs(
        { columnsOverride: RETRY_COLUMNS, dataOverride: PRODUCTS },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RETRY_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(priorityOf(canvas)?.textContent).toBe(START.priority),
      )
      await settle()
    })
    await step(RETRY_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(issueIn(canvas, 'priority')).not.toBeNull())
      await until(() =>
        expect(priorityOf(canvas)?.textContent).toBe(START.priority),
      )
      await settle()
    })
    await step(RETRY_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(issuePopover()).not.toBeNull())
      expect(popoverAction('retry')).not.toBeNull()
      expect(popoverAction('discard')).not.toBeNull()
      await settle()
    })
    await step(RETRY_STEPS[3]!.title.ru, async () => {
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
    title: { ru: 'Правка ячеек', en: 'Cell editing' },
    hint: {
      ru: 'Название товара можно править: сохранённое значение уходит на сервер.',
      en: 'The product name can be edited: the saved value goes to the server.',
    },
  },
  {
    title: { ru: 'Значение сохраняется', en: 'The value is being saved' },
    hint: {
      ru: 'Пользователь сохранил новое название товара, сервер отвечает долго. Ячейка под волной ожидания.',
      en: 'The user saved a new product name, and the server is slow to respond. The cell is under the waiting wave.',
    },
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
    title: { ru: 'Меню ячейки', en: 'The cell menu' },
    hint: {
      ru: 'Пользователь открыл контекстное меню ячейки. Пока значение сохраняется, в меню есть пункт отмены сохранения.',
      en: "The user opened the cell's context menu. While the value is being saved, the menu has an item to cancel the save.",
    },
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
    title: { ru: 'Сохранение отменено', en: 'The save was canceled' },
    hint: {
      ru: 'Пользователь отменил сохранение. Волны больше нет, в ячейке снова прежнее название; отмена — не ошибка, отметки отказа нет.',
      en: 'The user canceled the save. The wave is gone, and the cell shows the previous name again; canceling is not an error, so there is no refusal mark.',
    },
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
      title={{ ru: 'Отмена сохранения', en: 'Canceling a save' }}
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
    await step(CANCEL_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(false))
      await settle()
    })
    await step(CANCEL_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(true))
      await until(() => expect(textIn(canvas, 'name')).toBe(RENAMED))
    })
    await step(CANCEL_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(cancelSaveItem()).not.toBeNull())
    })
    await step(CANCEL_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(waved(canvas, 'name')).toBe(false))
      await until(() => expect(textIn(canvas, 'name')).toBe(START.name))
      await until(() => expect(issueIn(canvas, 'name')).toBeNull())
      await settle()
    })
  },
}

// --- ADR 0182 S3 ----------------------------------------------------------------------

interface OwnLabelTable {
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { label?: string },
  ) => Promise<unknown>
}
let ownLabelTable: OwnLabelTable | undefined
/** Своё имя действия приложения — его переводом; таблица показывает его как есть. */
const OWN_LABEL = 'Recalculate the priority'
const OWN_LABEL_SEED = [
  definePlugin()({
    id: 'ownLabelSeed',
    setup: () => table => {
      ownLabelTable = table as OwnLabelTable
    },
  })(),
]
const ownLog = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log"]')
const ownLogButton = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log-button"]')
const ownCounter = () =>
  ownLogButton()?.querySelector('[data-active-indicator]')?.textContent ?? ''

/** Приложение сообщает отказ пересчёта своей подписью — один раз за открытие таблицы. */
const reportOwnFailure = () => {
  if (ownCounter()) return
  void ownLabelTable
    ?.trackCellAction(
      { cell: [PRODUCTS[1]!.id, 'priority'] },
      Promise.reject(new Error('The priority list is locked')),
      { label: OWN_LABEL },
    )
    .catch(() => {})
}

const OWN_LABEL_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Товары', en: 'Products' },
    hint: {
      ru: 'Приложение показывает товары с приоритетом. Кнопка журнала в тулбаре без счётчика: отказов пока не было.',
      en: 'The app shows products with a priority. The failure log button in the toolbar has no counter: there have been no refusals yet.',
    },
  },
  {
    title: { ru: 'Пересчёт в фоне', en: 'A background recalculation' },
    hint: {
      ru: 'Приложение пересчитало приоритет в фоне и назвало действие своей подписью. Сервер отказал: на кнопке журнала появился счётчик.',
      en: 'The app recalculated the priority in the background and named the action with its own label. The server refused, and a counter appeared on the failure log button.',
    },
    states: ['panel.toolbar'],
    enter: untilDone(() => ownCounter() === '1', reportOwnFailure),
  },
  {
    title: { ru: 'Журнал', en: 'The log' },
    hint: {
      ru: 'Пользователь открыл журнал. Запись называет действие подписью приложения как есть, причина — из ответа сервера.',
      en: "The user opened the log. The entry names the action with the app's label as is, and the reason comes from the server's response.",
    },
    states: ['overlay.failureLog'],
    enter: untilDone(
      () => !!ownLog()?.textContent?.includes(OWN_LABEL),
      () => {
        if (!ownCounter()) reportOwnFailure()
        else if (!ownLog()) ownLogButton()?.click()
      },
    ),
  },
]

/** ADR 0182, S3: приложение пишет отказ своей подписью — журнал показывает её как есть. */
export const ActionStatusOwnLabel: StoryObj<StoryProps> = {
  name: 'Own action label',
  parameters: { scenario: '0182/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Своя подпись действия', en: 'A custom action label' }}
      steps={OWN_LABEL_STEPS}
      args={guideArgs(
        {
          columnsOverride: RETRY_COLUMNS,
          dataOverride: PRODUCTS,
          enableFailureLog: true,
          enableToolbar: true,
          extraPlugins: OWN_LABEL_SEED,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_LABEL_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(ownLogButton()).not.toBeNull())
      await until(() => expect(ownCounter()).toBe(''))
      await settle()
    })
    await step(OWN_LABEL_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ownCounter()).toBe('1'))
      await settle()
    })
    await step(OWN_LABEL_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ownLog()?.textContent).toContain(OWN_LABEL))
      await until(() =>
        expect(ownLog()!.textContent).toContain('The priority list is locked'),
      )
      await settle()
    })
  },
}
