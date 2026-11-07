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

/**
 * Клиентские транзакции и смена данных (ADR 0194): `Playground` — поток изменений
 * приложения и его период — контролами; S1–S3 — правка в большой таблице, строки
 * транзакцией, транзакция без обработчика.
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
        'Приложение шлёт поток изменений: новые, изменённые и удалённые строки',
      control: 'boolean',
    },
    liveIntervalMs: {
      description: 'Период изменений приложения, мс',
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
    title: 'Таблица отсортирована по возрасту',
    hint: 'В таблице тысяча строк, они отсортированы по возрасту. Приложение хранит данные у себя: при правке оно заменяет объект изменённой строки новым, остальные строки оставляет прежними.',
  },
  {
    title: 'Поле правки открыто',
    hint: 'Пользователь нажал кнопку правки в ячейке возраста шестой строки и набрал возраст младше всех в таблице.',
    states: ['body.editing'],
    enter: untilDone(
      root =>
        large.edited !== undefined &&
        inputOf(root, large.edited)?.value === NEW_AGE,
      draftAge,
    ),
  },
  {
    title: 'Строка встала на своё место',
    hint: 'Пользователь нажал Enter. Приложение положило в таблицу новые данные, в которых изменилась одна строка. Таблица пересобрала только её: строка поднялась на первое место по сортировке, остальные строки сдвинулись вниз.',
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
      title="Правка в большой таблице"
      steps={LARGE}
      args={guideArgs(LARGE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LARGE[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(LARGE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, large.edited!)?.value).toBe(NEW_AGE),
      )
    })
    await step(LARGE[2]!.title, async () => {
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
    title: 'Строки приложения',
    hint: 'Приложение хранит данные у себя и меняет строки транзакцией: таблица собирает новые данные из прежних, приложение кладёт их к себе.',
    props: () => ({
      extraPlugins: [clientTxSeed],
      onDataChange: keepData,
      enableCellSelection: true,
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
    }),
  },
  {
    title: 'Ячейки выделены',
    hint: 'В колонке имени выделены ячейки трёх строк.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
      if (!selectionShown(root)) selectRows()
      await pollUntil(() => selectionShown(root), signal)
    }),
  },
  {
    title: 'Приложение добавило строки',
    hint: 'Приложение добавило две строки второй и третьей. Нетронутые строки остались прежними, новые встали на место, строки ниже съехали — выделение съехало вместе со своими строками.',
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
    title: 'Приложение удалило строку',
    hint: 'Приложение удалило первую строку. Строки ниже поднялись, выделение поднялось вместе с ними.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowById(root, SELECTED[0]!), signal)
      if (!selectionShown(root)) selectRows()
      addRows()
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
      title="Строки транзакцией"
      steps={ADD_REMOVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ADD_REMOVE[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(ADD_REMOVE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectedRows(canvas)).toEqual([...SELECTED].sort())
    })
    await step(ADD_REMOVE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(clientTx.result).toBe('applied')
      await expect(indexOfRow(canvas, ADDED[0]!)).toBe(1)
      await expect(indexOfRow(canvas, SELECTED[0]!)).toBe(4)
      await expect(selectedRows(canvas)).toEqual([...SELECTED].sort())
      await settle()
    })
    await step(ADD_REMOVE[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, SELECTED[0]!)).toBe(3)
      await expect(selectedRows(canvas)).toEqual([...SELECTED].sort())
      await settle()
    })
  },
}

// --- S3: транзакция без обработчика ----------------------------------------------------

const REFUSED = 'item-new-1'

const WITHOUT_HANDLER: readonly GuideStoryStep[] = [
  {
    title: 'Данные только у приложения',
    hint: 'Приложение не передало таблице обработчик новых данных: менять данные может только оно само.',
    props: () => ({ extraPlugins: [clientTxSeed] }),
    enter: stepAction(async (root, { signal }) => {
      clientTx.result = undefined
      await pollUntil(() => !!rowIdAt(root, 0), signal)
    }),
  },
  {
    title: 'Транзакция не применена',
    hint: 'Приложение попросило добавить строку. Таблице некуда отдать новые данные: транзакция не применена, строки прежние, в консоли браузера — предупреждение для разработчика.',
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
      title="Без обработчика данных"
      steps={WITHOUT_HANDLER}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WITHOUT_HANDLER[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(WITHOUT_HANDLER[1]!.title, async () => {
      const first = rowIdAt(canvas, 0)
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(clientTx.result).toBe('unavailable'))
      await expect(rowById(canvas, REFUSED)).toBeNull()
      await expect(rowIdAt(canvas, 0)).toBe(first)
    })
  },
}
