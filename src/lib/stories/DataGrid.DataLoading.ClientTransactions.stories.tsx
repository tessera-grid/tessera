import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { typeInto, press } from './__mocks__/typeGuides'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import {
  clientTx,
  clientTxSeed,
  indexOfRow,
  liveStream,
  newRow,
  rowById,
  rowIdAt,
  transact,
} from './__mocks__/clientTransactionsGuide'
import { getData } from './__mocks__/data'
import { holdRowAtLevel } from './__mocks__/rowDragHold'
import { OVERLAY } from './rowDragging.dnd'

/**
 * Клиентские транзакции и смена данных (ADR 0194, ADR 0199): `Playground` — поток изменений
 * приложения и его период — контролами; S1–S3 ADR 0194 — правка в большой таблице, строки
 * транзакцией, транзакция без обработчика; S1 ADR 0199 — сдвиги в середине большой таблицы.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Client transactions',
} satisfies Meta<StoryProps>

export default meta

/** Приложение принимает следующий `data`: обвязка истории кладёт его в свои данные. */
const keepData = () => {}

/** Высота — в окне снимка матрицы контраста (900×720, ADR 0089). */
const size: Partial<StoryProps> = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const layout: Partial<StoryProps> = {
  ...size,
  columnCount: 6,
  dataCount: 20,
  enableKeyboardNavigation: true,
}

interface ClientPlaygroundArgs extends StoryProps {
  liveUpdates: boolean
  liveIntervalMs: number
}

export const ClientTransactionsPlayground: StoryObj<ClientPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['liveUpdates', 'liveIntervalMs']),
  args: {
    ...size,
    columnCount: 6,
    dataCount: 20,
    liveUpdates: false,
    liveIntervalMs: 1000,
  },
  argTypes: {
    liveUpdates: {
      description:
        'The app sends a stream of changes: new, changed, and deleted rows',
      control: 'boolean',
    },
    liveIntervalMs: {
      description: 'Interval between app changes, ms',
      control: { type: 'range', min: 200, max: 3000, step: 100 },
      if: { arg: 'liveUpdates' },
    },
  },
  render: ({ liveUpdates, liveIntervalMs, ...args }) => (
    <StoryComponent
      {...normalizeArgs(args)}
      onDataChange={keepData}
      extraPlugins={[
        clientTxSeed,
        ...(liveUpdates ? [liveStream(liveIntervalMs)] : []),
      ]}
    />
  ),
  // Снимок — в покое: поток выключен.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await waitForRows(canvas)
    await settle()
  },
}

// --- S1: правка в большой таблице ------------------------------------------------------

const ageCellOf = (root: ParentNode, row: string) =>
  rowById(root, row)?.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="age"]',
  ) ?? null
const inputOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLInputElement>('input') ?? null
const editButtonOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLElement>('.cell__button button') ??
  null
/** Возраст в ячейке — без кнопки правки. */
const ageText = (root: ParentNode, row: string) => {
  const copy = ageCellOf(root, row)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}

/**
 * Строка, которую правит пользователь, и возраст младше всех: строка уходит наверх. Данные
 * мока с зерном — на шестом месте всегда одна и та же строка.
 */
const EDITED_AT = 5
const NEW_AGE = '17'
const large = { edited: undefined as string | undefined }

const LARGE_ARGS: Partial<StoryProps> = {
  ...layout,
  dataCount: 1000,
  enableCellEditing: true,
  enableColumnSorting: true,
  columnSortingInitialSorting: [{ id: 'age', desc: false }],
}

/** Открыть правку возраста шестой строки и набрать новый возраст. */
const draftAge = (root: HTMLElement) => {
  large.edited ??= rowIdAt(root, EDITED_AT)
  const row = large.edited!
  const input = inputOf(root, row)
  if (!input) editButtonOf(root, row)?.click()
  else if (input.value !== NEW_AGE) typeInto(input, NEW_AGE)
}

const LARGE: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Таблица отсортирована по возрасту',
      en: 'The table is sorted by age',
    },
    hint: {
      ru: 'В таблице тысяча строк, они отсортированы по возрасту. Приложение хранит данные у себя: при правке оно заменяет объект изменённой строки новым, остальные строки оставляет прежними.',
      en: "The table has a thousand rows sorted by age. The app keeps the data on its side: on an edit, it replaces the edited row's object with a new one and keeps the other rows as they were.",
    },
  },
  {
    title: { ru: 'Поле правки открыто', en: 'The edit field is open' },
    hint: {
      ru: 'Пользователь нажал кнопку правки в ячейке возраста шестой строки и набрал возраст младше всех в таблице.',
      en: "The user clicked the edit button in the age cell of the sixth row and typed an age lower than anyone else's in the table.",
    },
    states: ['body.editing'],
    enter: untilDone(
      root =>
        large.edited !== undefined &&
        inputOf(root, large.edited)?.value === NEW_AGE,
      draftAge,
    ),
  },
  {
    title: {
      ru: 'Строка встала на своё место',
      en: 'The row moved into place',
    },
    hint: {
      ru: 'Пользователь нажал Enter. Приложение положило в таблицу новые данные, в которых изменилась одна строка. Таблица пересобрала только её: строка поднялась на первое место по сортировке, остальные строки сдвинулись вниз.',
      en: 'The user pressed Enter. The app put new data into the table with one row changed. The table rebuilt only that row: it rose to first place in the sort order, and the other rows shifted down.',
    },
    enter: untilDone(
      root =>
        large.edited !== undefined &&
        !inputOf(root, large.edited) &&
        indexOfRow(root, large.edited) === 0,
      root => {
        const input = large.edited ? inputOf(root, large.edited) : null
        if (input?.value === NEW_AGE) press(input!, 'Enter')
        else draftAge(root)
      },
    ),
  },
]

/** ADR 0194, S1: правка ячейки в большой таблице с сортировкой. */
export const ClientTransactionsEditLargeTable: StoryObj<StoryProps> = {
  name: 'Edit a large sorted table',
  parameters: { scenario: '0194/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка в большой таблице', en: 'Editing in a large table' }}
      steps={LARGE}
      args={guideArgs(LARGE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LARGE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(LARGE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, large.edited!)?.value).toBe(NEW_AGE),
      )
    })
    await step(LARGE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(indexOfRow(canvas, large.edited!)).toBe(0))
      await expect(ageText(canvas, large.edited!)).toBe(NEW_AGE)
      // Строки ниже — в прежнем порядке по возрасту.
      await expect(
        Number(ageText(canvas, rowIdAt(canvas, 1)!)),
      ).toBeGreaterThan(Number(NEW_AGE))
      await settle()
    })
  },
}

// --- S2: строки транзакцией ------------------------------------------------------------

const ADDED = ['item-new-1', 'item-new-2']
const REMOVED = 'item-id-0'
const SELECTED = ['item-id-2', 'item-id-3', 'item-id-4']

const selectedRows = (root: ParentNode) =>
  [
    ...new Set(
      [
        ...root.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-row-id] .data-grid__body-cell[data-cell-selected="true"]',
        ),
      ].map(
        cell =>
          cell.closest<HTMLElement>('.data-grid__body-row')!.dataset.rowId!,
      ),
    ),
  ].sort()

const selectionShown = (root: ParentNode) =>
  selectedRows(root).join() === [...SELECTED].sort().join()

/** Приложение выделяет ячейки имени трёх строк. */
const selectRows = () => {
  ;(
    clientTx.table as unknown as {
      selectCellRange: (range: object) => void
    }
  ).selectCellRange({
    anchorRowId: SELECTED[0],
    focusRowId: SELECTED.at(-1),
    anchorColumnId: 'firstName',
    focusColumnId: 'firstName',
  })
}

const addRows = () => {
  if (clientTx.created >= ADDED.length) return
  transact({ add: [newRow(), newRow()], index: 1 })
}

const ADD_REMOVE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки приложения', en: "The app's rows" },
    hint: {
      ru: 'Приложение хранит данные у себя и меняет строки транзакцией: таблица собирает новые данные из прежних, приложение кладёт их к себе.',
      en: 'The app keeps the data on its side and changes rows with a transaction: the table builds new data from the previous data, and the app stores it.',
    },
    props: () => ({
      extraPlugins: [clientTxSeed],
      onDataChange: keepData,
      enableCellSelection: true,
    }),
  },
  {
    title: { ru: 'Ячейки выделены', en: 'Cells are selected' },
    hint: {
      ru: 'В колонке имени выделены ячейки трёх строк.',
      en: 'Cells in three rows of the name column are selected.',
    },
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
      if (!selectionShown(root)) selectRows()
      await pollUntil(() => selectionShown(root), signal)
    }),
  },
  {
    title: { ru: 'Приложение добавило строки', en: 'The app added rows' },
    hint: {
      ru: 'Приложение добавило две строки второй и третьей. Нетронутые строки остались прежними, новые встали на место, строки ниже съехали — выделение съехало вместе со своими строками.',
      en: 'The app added two rows as the second and third. Untouched rows stayed as they were, the new ones took their places, and the rows below shifted down; the selection moved along with its rows.',
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
      if (!selectionShown(root)) selectRows()
      addRows()
      await pollUntil(
        () => indexOfRow(root, ADDED[1]!) === 2 && selectionShown(root),
        signal,
      )
    }),
  },
  {
    title: { ru: 'Приложение удалило строку', en: 'The app deleted a row' },
    hint: {
      ru: 'Приложение удалило первую строку. Строки ниже поднялись, выделение поднялось вместе с ними.',
      en: 'The app deleted the first row. The rows below moved up, and the selection moved up with them.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
      if (!selectionShown(root)) selectRows()
      addRows()
      // Удаление — из данных с добавленными строками: приложение кладёт их к себе не сразу.
      await pollUntil(() => !!rowById(root, ADDED[1]!), signal)
      if (rowById(root, REMOVED)) transact({ remove: [REMOVED] })
      await pollUntil(
        () => !rowById(root, REMOVED) && selectionShown(root),
        signal,
      )
    }),
  },
]

/** ADR 0194, S2: строки добавляются и удаляются транзакцией, выделение держит свои строки. */
export const ClientTransactionsAddRemove: StoryObj<StoryProps> = {
  name: 'Add and remove rows',
  parameters: { scenario: '0194/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Строки транзакцией', en: 'Rows by transaction' }}
      steps={ADD_REMOVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ADD_REMOVE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ADD_REMOVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedRows(canvas)).toEqual([...SELECTED].sort()),
      )
    })
    await step(ADD_REMOVE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(clientTx.result).toBe('applied'))
      await until(() => expect(indexOfRow(canvas, ADDED[0]!)).toBe(1))
      await until(() => expect(indexOfRow(canvas, SELECTED[0]!)).toBe(4))
      await until(() =>
        expect(selectedRows(canvas)).toEqual([...SELECTED].sort()),
      )
      await settle()
    })
    await step(ADD_REMOVE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(indexOfRow(canvas, SELECTED[0]!)).toBe(3))
      await until(() =>
        expect(selectedRows(canvas)).toEqual([...SELECTED].sort()),
      )
      await settle()
    })
  },
}

// --- ADR 0199, S1: сдвиги в середине большой таблицы ------------------------------------

const BIG_COUNT = 100_000
let bigData: ReturnType<typeof getData> | undefined
/** Сто тысяч строк — копии тысячи строк мока со своими `id`: генератор на всё — секунды. */
const bigRows = () =>
  (bigData ??= (() => {
    const base = getData(1000)
    return Array.from({ length: BIG_COUNT }, (_, i) => ({
      ...base[i % base.length],
      id: `item-id-${i}`,
    }))
  })())

const SHIFTED_ADDED = ['item-new-1', 'item-new-2', 'item-new-3']
const MOVED = 'item-id-0'

const SHIFT_ARGS: Partial<StoryProps> = {
  ...layout,
  dataCount: BIG_COUNT,
  enableRowDragging: true,
}

/** Строка в данных приложения — по модели таблицы, а не по окну. */
const inData = (id: string) =>
  !!(
    clientTx.table as unknown as
      | { getCoreRowModel: () => { rowsById: Record<string, unknown> } }
      | undefined
  )?.getCoreRowModel().rowsById[id]
const addBetween = () => {
  if (inData(SHIFTED_ADDED[0]!)) return
  const template = clientTx.table?.options.data[0] ?? { id: '' }
  transact({
    add: SHIFTED_ADDED.map((id, k) => ({
      ...template,
      id,
      firstName: `New ${k + 1}`,
    })),
    index: 2,
  })
}
/**
 * Шаг начинается с начала таблицы: человек мог прокрутить её, и первая строка ушла из окна
 * виртуализации.
 */
const showTop = () =>
  (
    clientTx.table as unknown as {
      scrollToRow: (id: string, options: object) => unknown
    }
  ).scrollToRow(MOVED, { align: 'start', behavior: 'instant' })

/** После удаления строки — как в начале: добавленных нет, строки на своих местах. */
const removeAdded = () => {
  if (inData(SHIFTED_ADDED[0]!)) transact({ remove: SHIFTED_ADDED })
}
const removedShown = (root: ParentNode) =>
  SHIFTED_ADDED.every(id => !inData(id)) && indexOfRow(root, 'item-id-2') === 2

const SHIFTS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сто тысяч строк', en: 'A hundred thousand rows' },
    hint: {
      ru: 'В таблице сто тысяч строк. Приложение хранит данные у себя: оно меняет строки транзакцией, таблица собирает из прежних данных новые и отдаёт их приложению. Строку можно перенести за ручку.',
      en: 'The table has a hundred thousand rows. The app keeps the data on its side: it changes rows with a transaction, and the table builds new data from the previous data and hands it to the app. A row can be moved by its drag handle.',
    },
    props: () => ({
      dataOverride: bigRows(),
      extraPlugins: [clientTxSeed],
      onDataChange: keepData,
    }),
  },
  {
    title: {
      ru: 'Строки добавлены между другими',
      en: 'Rows were added between others',
    },
    hint: {
      ru: 'Приложение добавило три строки третьей, четвёртой и пятой. Строки ниже остались прежними и съехали вниз — таблица не пересобирала их, поэтому новые строки появились сразу, как при добавлении в конец, и коротко вспыхнули.',
      en: "The app added three rows as the third, fourth, and fifth. The rows below stayed as they were and shifted down; the table didn't rebuild them, so the new rows appeared right away, just as when rows are added at the end, and flashed briefly.",
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      showTop()
      await pollUntil(() => !!rowById(root, MOVED), signal)
      addBetween()
      await pollUntil(() => indexOfRow(root, SHIFTED_ADDED[2]!) === 4, signal)
    }),
  },
  {
    title: { ru: 'Строки удалены', en: 'Rows were deleted' },
    hint: {
      ru: 'Приложение удалило три добавленные строки. Они погасли на месте, затем строки ниже поднялись на свои места — тоже без пересборки остальных ста тысяч.',
      en: 'The app deleted the three added rows. They faded out in place, then the rows below moved up into their places, again without rebuilding the other hundred thousand.',
    },
    enter: stepAction(async (root, { signal }) => {
      showTop()
      await pollUntil(() => !!rowById(root, MOVED), signal)
      removeAdded()
      await pollUntil(() => removedShown(root), signal)
    }),
  },
  {
    title: { ru: 'Строка перенесена', en: 'The row was moved' },
    hint: {
      ru: 'Пользователь взял первую строку за ручку и бросил её ниже четвёртой. Таблица пересобрала одну перенесённую строку: она встала на новое место и коротко вспыхнула, строки между её прежним и новым местом сдвинулись вверх.',
      en: 'The user grabbed the first row by its drag handle and dropped it below the fourth. The table rebuilt only the moved row: it took its new place and flashed briefly, and the rows between its old and new places shifted up.',
    },
    states: ['drag.landed'],
    immediate: true,
    enter: stepAction(async (root, run) => {
      showTop()
      await pollUntil(() => !!rowById(root, MOVED), run.signal)
      removeAdded()
      await pollUntil(() => removedShown(root), run.signal)
      if (indexOfRow(root, MOVED) !== 0) return
      for (let attempt = 0; attempt < 3; attempt++) {
        const held = await holdRowAtLevel(root, MOVED, 'item-id-3', 0, run)
        run.signal.throwIfAborted()
        await held.release()
        try {
          await pollUntil(() => indexOfRow(root, MOVED) === 3, run.signal, 2000)
          break
        } catch (error) {
          if (attempt === 2) throw error
        }
      }
    }),
  },
]

/** ADR 0199, S1: вставка, удаление и перенос в середине таблицы на сто тысяч строк. */
export const ClientTransactionsShiftLargeTable: StoryObj<StoryProps> = {
  name: 'Shift rows in a large table',
  parameters: { scenario: '0199/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Строки в середине большой таблицы',
        en: 'Rows in the middle of a large table',
      }}
      steps={SHIFTS}
      args={guideArgs(SHIFT_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const done = () => stepDone(canvas, 60_000)
    await step(SHIFTS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(indexOfRow(canvas, 'item-id-2')).toBe(2))
    })
    await step(SHIFTS[1]!.title.ru, async () => {
      // Вспышка новых строк держится на время снимка (ADR 0199, MS15): токен — до транзакции.
      canvas
        .querySelector<HTMLElement>('.data-grid-theme')!
        .style.setProperty('--tsr-comp-flash-duration', '600000ms')
      await guideNext(canvas)
      await done()
      await expect(clientTx.result).toBe('applied')
      await expect(SHIFTED_ADDED.map(id => indexOfRow(canvas, id))).toEqual([
        2, 3, 4,
      ])
      // Строки ниже съехали на три места.
      await expect(indexOfRow(canvas, 'item-id-2')).toBe(5)
      for (const id of SHIFTED_ADDED) {
        await expect(rowById(canvas, id)).toHaveAttribute(
          'data-flash',
          'arrived',
        )
      }
      await expect(rowById(canvas, 'item-id-2')).not.toHaveAttribute(
        'data-flash',
      )
      await settle()
    })
    await step(SHIFTS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await done()
      await expect(SHIFTED_ADDED.every(id => !rowById(canvas, id))).toBe(true)
      await expect(indexOfRow(canvas, 'item-id-2')).toBe(2)
      await settle()
    })
    await step(SHIFTS[3]!.title.ru, async () => {
      // Вспышка броска держится на время снимка (ADR 0130, DG6): токен задан до шага 2.
      await guideNext(canvas)
      await done()
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(indexOfRow(canvas, MOVED)).toBe(3)
      // Строки между прежним и новым местом поднялись на одно место.
      await expect(rowIdAt(canvas, 0)).toBe('item-id-1')
      await expect(rowIdAt(canvas, 2)).toBe('item-id-3')
      await until(() =>
        expect(rowById(canvas, MOVED)).toHaveAttribute('data-flash', 'arrived'),
      )
      await settle()
    })
  },
}

// --- S3: транзакция без обработчика ----------------------------------------------------

const REFUSED = 'item-new-1'

const WITHOUT_HANDLER: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Данные только у приложения',
      en: 'Only the app holds the data',
    },
    hint: {
      ru: 'Приложение не передало таблице обработчик новых данных: менять данные может только оно само.',
      en: "The app didn't give the table a handler for new data: only the app itself can change the data.",
    },
    props: () => ({ extraPlugins: [clientTxSeed] }),
  },
  {
    title: {
      ru: 'Транзакция не применена',
      en: 'The transaction is not applied',
    },
    hint: {
      ru: 'Приложение попросило добавить строку. Таблице некуда отдать новые данные: транзакция не применена, строки прежние, в консоли браузера — предупреждение для разработчика.',
      en: 'The app asked to add a row. The table has nowhere to send the new data: the transaction is not applied, the rows are unchanged, and the browser console shows a warning for the developer.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowIdAt(root, 0), signal)
      if (clientTx.result === undefined) transact({ add: [newRow()], index: 0 })
    }),
  },
]

/** ADR 0194, S3: без `onDataChange` клиентская транзакция не применяется. */
export const ClientTransactionsWithoutHandler: StoryObj<StoryProps> = {
  name: 'Without a data handler',
  parameters: { scenario: '0194/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Без обработчика данных', en: 'Without a data handler' }}
      steps={WITHOUT_HANDLER}
      reset={() => {
        clientTx.result = undefined
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WITHOUT_HANDLER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(WITHOUT_HANDLER[1]!.title.ru, async () => {
      const first = rowIdAt(canvas, 0)
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(clientTx.result).toBe('unavailable'))
      await expect(rowById(canvas, REFUSED)).toBeNull()
      await expect(rowIdAt(canvas, 0)).toBe(first)
    })
  },
}
