// @vitest-environment happy-dom
/**
 * Вставка из буфера и запись в ячейки (ADR 0219, этап 1): разбор буфера, свой формат,
 * разбор по типу, размеры и пропуски вставки, черновики и пакет, объявления, канал действий,
 * `table.writeCells`, дерево и группировка, форма пакета для журнала, серверная модель строк.
 * Запуск: npx vitest run --config vitest.node.config.ts cellWrites
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import { cancelPending } from '../core/cancellation'
import { DEFAULT_WRITE_LIMITS } from '../core/cellWrites'
import { type Draft, discardDraft } from '../core/drafts/drafts'
import { cellFailureKey, readFailures } from '../core/failures/failuresFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { readServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  cellSelection,
  rowGroupingModel,
  serverRowModel,
} from '../plugins'
import { parseEditText } from '../plugins/cellEditing/editValue'
import {
  cellEditingViewOf,
  commitAllDrafts,
  EDIT_SESSION_KEY,
  isCellPending,
  readEditingState,
} from '../plugins/cellEditing/session'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'
import {
  parseClipboardText,
  TESSERA_FORMAT,
} from '../plugins/cellSelection/clipboard'
import { copyCellSelection } from '../plugins/cellSelection/copy'
import { cellSelectionLabels } from '../plugins/cellSelection/labels'
import { pasteData } from '../plugins/cellSelection/paste'
import { fillChanges } from '../plugins/cellSelection/fill'
import { fillMode } from '../plugins/cellSelection/rangeHandle'
import type { CellSelectionHandleOptions } from '../plugins/cellSelection/types'
import { fillSeries } from '../shared/fillSeries'
import { __resetLogger } from '../util/logger'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Owner = { id: string; name: string }
type Row = {
  id: string
  name: string
  age: number
  born: string
  active: boolean
  color: string
  tags: string[]
  owner: Owner | null
  team: string
}

const OWNERS: Owner[] = [
  { id: 'o1', name: 'Ann' },
  { id: 'o2', name: 'Bob' },
]
const COLOR_OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
]
const TAG_OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age', dataType: 'number' },
  { id: 'born', accessorKey: 'born', header: 'Born', dataType: 'dateString' },
  {
    id: 'active',
    accessorKey: 'active',
    header: 'Active',
    dataType: 'boolean',
  },
  {
    id: 'color',
    accessorKey: 'color',
    header: 'Color',
    dataType: 'select',
    options: COLOR_OPTIONS,
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    dataType: 'multiSelect',
    options: TAG_OPTIONS,
  },
  {
    id: 'owner',
    accessorKey: 'owner',
    header: 'Owner',
    dataType: 'object',
    getKey: (owner: Owner) => owner.id,
    getLabel: (owner: Owner) => owner.name,
  },
  { id: 'team', accessorKey: 'team', header: 'Team' },
  { id: 'shown', header: 'Shown', cell: () => 'x' },
]

const ROWS: Row[] = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
  born: `2026-01-${String(i + 1).padStart(2, '0')}`,
  active: i % 2 === 0,
  color: 'r',
  tags: ['a'],
  owner: OWNERS[i % 2]!,
  team: i < 5 ? 'A' : 'B',
}))

let captured: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
})

interface HostProps {
  data?: Row[]
  saveMode?: 'auto' | 'manual'
  onCellEdit?: (...args: unknown[]) => unknown
  onCommitEdits?: (
    batch: CellEditBatch,
  ) => CellEditBatchResult | void | Promise<CellEditBatchResult | void>
  onDraftsChange?: (next: readonly Draft[]) => void
  onDebugAction?: (action: unknown) => void
  canEditCell?: (ctx: { column: { id: string } }) => boolean
  validate?: (value: unknown) => string | null
  parseClipboard?: (
    clip: { text: string; html: string },
    context: { signal: AbortSignal; confirm: () => Promise<boolean> },
  ) => string[][] | null | PromiseLike<string[][] | null>
  paste?: boolean
  handle?: CellSelectionHandleOptions
  grouping?: string[]
  server?: boolean
  /** Свой «сервер» серверной модели и размер блока. */
  getRows?: (request: {
    start: number
    end: number
  }) => Promise<{ rows: Row[]; rowCount: number }>
  blockSize?: number
  maxCopyRows?: number
  locale?: string
  timeZone?: string
  /** Пределы записи (ADR 0223). */
  writeLimits?: { confirm?: number; max?: number } | false
}

const Host = ({
  data = ROWS,
  saveMode = 'auto',
  onCellEdit = () => {},
  onCommitEdits,
  onDraftsChange,
  onDebugAction,
  canEditCell,
  validate,
  parseClipboard,
  paste,
  handle,
  grouping,
  server,
  getRows,
  blockSize,
  maxCopyRows,
  locale,
  timeZone,
  writeLimits,
}: HostProps) => {
  captured = useCreateTable({
    columns: columns as never,
    data: server ? [] : data,
    getRowId: (row: Row) => row.id,
    ...(onDraftsChange ? { onDraftsChange } : {}),
    ...(onDebugAction ? { onDebugAction } : {}),
    ...(locale ? { locale } : {}),
    ...(timeZone ? { timeZone } : {}),
    ...(writeLimits === undefined ? {} : { writeLimits }),
    plugins: [
      cellEditing({
        saveMode,
        onCellEdit,
        onCommitEdits,
        ...(canEditCell ? { canEditCell } : {}),
        ...(validate ? { validate } : {}),
      } as never),
      cellSelection({
        ...(parseClipboard ? { parseClipboard } : {}),
        ...(paste === undefined ? {} : { paste }),
        ...(handle ? { handle } : {}),
        ...(maxCopyRows ? { maxCopyRows } : {}),
      }),
      ...(grouping
        ? [rowGroupingModel({ initialGrouping: grouping } as never)]
        : []),
      ...(server
        ? [
            serverRowModel({
              getRows:
                getRows ?? (() => ({ rows: data, rowCount: data.length })),
              ...(blockSize ? { blockSize } : {}),
            } as never),
          ]
        : []),
    ],
  } as never)
  return null
}

const render = (props: HostProps = {}) => {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

const flush = () => act(async () => {})

/** Выделить прямоугольник по id углов. */
const select = (...ranges: [string, string, string, string][]) =>
  act(() =>
    captured.setCellSelection(() =>
      ranges.map(
        ([anchorRowId, anchorColumnId, focusRowId, focusColumnId]) => ({
          anchorRowId,
          anchorColumnId,
          focusRowId,
          focusColumnId,
        }),
      ),
    ),
  )

const paste = async (text: string, extra: { tessera?: string } = {}) => {
  await act(async () => {
    await pasteData(captured, { text, html: '', ...extra }, 'api')
  })
}

/** Ячейки пакета: строка, колонка, значение. */
const cellsOf = (batch: CellEditBatch) =>
  batch.cells.map(cell => [cell.rowId, cell.columnId, cell.value])

const selection = () =>
  (captured.store.get().cellSelection as Record<string, unknown>[]).map(
    range => [
      range.anchorRowId,
      range.anchorColumnId,
      range.focusRowId,
      range.focusColumnId,
    ],
  )

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(ok => {
    resolve = ok
  })
  return { promise, resolve }
}

describe('вставка из буфера и запись в ячейки (ADR 0219)', () => {
  it('WR2: разбор text/plain — колонки через таб, строки через \\n и \\r\\n, поля в кавычках с "" и переводами строк внутри; хвостовая пустая строка отбрасывается', () => {
    expect(parseClipboardText('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(parseClipboardText('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    // Excel: поле с переводом строки и кавычкой внутри — в кавычках с удвоением.
    expect(parseClipboardText('"one\ntwo"\t"say ""hi"""\n')).toEqual([
      ['one\ntwo', 'say "hi"'],
    ])
    // Отбрасывается только одна хвостовая строка; пустые ячейки сохраняются.
    expect(parseClipboardText('a\t\n\n')).toEqual([['a', ''], ['']])
    expect(parseClipboardText('')).toEqual([])
  })

  it('WR3: parseClipboard возвращает строки и ячейки, null — отмена — или промис; пока промис не решён — ожидание на цели «таблица» с отменой; отмена и новая вставка прерывают signal, confirm() отвечает true на «Вставить» и false на отмену', async () => {
    const onCommitEdits = vi.fn()
    const answer = deferred<string[][] | null>()
    let hook: () => string[][] | null | PromiseLike<string[][] | null> = () => [
      ['55'],
    ]
    let signal: AbortSignal | undefined
    let confirm: (() => Promise<boolean>) | undefined
    render({
      onCommitEdits,
      parseClipboard: (_clip, context) => {
        signal = context.signal
        confirm = context.confirm
        return hook()
      },
    })
    select(['1', 'age', '1', 'age'])

    // Ответ строками — их и вставляем, текст буфера не разбирается.
    await paste('ignored')
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([['1', 'age', 55]])

    // null — отмена.
    hook = () => null
    await paste('1')
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    // Промис — ожидание с отменой.
    hook = () => answer.promise
    let done: Promise<void> | undefined
    act(() => {
      done = pasteData(captured, { text: '1', html: '' }, 'api')
    })
    expect(readServerAction(captured).loadingRows?.kind).toBe('paste')
    expect(signal?.aborted).toBe(false)
    act(() => void cancelPending(captured, { kind: 'paste' }))
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    // Отмена прерывает signal хука: приложение снимает свой вопрос.
    expect(signal?.aborted).toBe(true)
    answer.resolve([['99']])
    await act(async () => {
      await done
    })
    expect(onCommitEdits).toHaveBeenCalledTimes(1)

    // confirm(): вопрос на месте плашки ожидания; ответ «Вставить» — true, вставка идёт.
    let asked: Promise<boolean> | undefined
    hook = async () => ((await (asked = confirm!())) ? [['77']] : null)
    act(() => {
      done = pasteData(captured, { text: '1', html: '' }, 'api')
    })
    // В вопросе — одно значение буфера.
    expect(readServerAction(captured).loadingRows?.confirm).toMatchObject({
      value: '1',
      count: 1,
    })
    const accept = readServerAction(captured).loadingRows?.confirm?.accept
    expect(accept).toBeTypeOf('function')
    act(() => accept!())
    await act(async () => {
      await done
    })
    await expect(asked).resolves.toBe(true)
    expect(cellsOf(onCommitEdits.mock.calls[1]![0])).toEqual([['1', 'age', 77]])

    // Отмена вопроса — false, вставки нет; новая вставка прерывает ждущую.
    act(() => {
      done = pasteData(captured, { text: '1', html: '' }, 'api')
    })
    const first = signal
    const firstAsk = asked
    act(() => {
      void pasteData(captured, { text: '1', html: '' }, 'api')
    })
    expect(first?.aborted).toBe(true)
    await expect(firstAsk).resolves.toBe(false)
    act(() => void cancelPending(captured, { kind: 'paste' }))
    await act(async () => {
      await done
    })
    expect(onCommitEdits).toHaveBeenCalledTimes(2)
    expect(readServerAction(captured).loadingRows).toBeUndefined()
  })

  it('WR4: копирование кладёт в text/plain и text/html показанный текст по типу, в свой формат — значения в типе колонки; вставка предпочитает свой формат, object, multiSelect и даты переходят без потерь', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits })
    select(['0', 'born', '0', 'owner'])
    const data: Record<string, string> = {}
    act(() => {
      copyCellSelection(captured, {
        clipboardData: { setData: (type, value) => (data[type] = value) },
        source: 'keyboard',
      })
    })
    // Показанный текст: дата как в ячейке, булево подписью, варианты подписями.
    expect(data['text/plain']).toBe('2026-01-01\tYes\tRed\tAlpha\tAnn')
    expect(data['text/html']).toContain('<td>Yes</td>')
    expect(JSON.parse(data[TESSERA_FORMAT]!).rows).toEqual([
      ['2026-01-01', true, 'r', ['a'], { id: 'o1', name: 'Ann' }],
    ])

    // Вставка своего формата — значения как есть, без разбора текста.
    select(['3', 'born', '3', 'born'])
    await paste('garbage', { tessera: data[TESSERA_FORMAT] })
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['3', 'born', '2026-01-01'],
      ['3', 'active', true],
      ['3', 'color', 'r'],
      ['3', 'tags', ['a']],
      ['3', 'owner', { id: 'o1', name: 'Ann' }],
    ])
  })

  it('WR5: разбор текста по типу общий для вставки и поля правки: даты — ISO, вид таблицы и порядок языка в поясе таблицы; булево — true/false, 1/0 и подписи словаря; multiSelect — подписи через запятую; object — подпись среди записей, иначе parseValue', () => {
    render({ locale: 'ru-RU', timeZone: 'Asia/Tokyo' })
    const parse = (columnId: string, text: string) =>
      parseEditText(captured, columnId, text, {
        original: ROWS[0],
        current: ROWS[0]![columnId as keyof Row],
      })?.value
    // Даты: ISO, порядок языка (`ru` — день, месяц, год), двузначный год.
    expect(parse('born', '2026-11-12')).toBe('2026-11-12')
    expect(parse('born', '12.11.2026')).toBe('2026-11-12')
    expect(parse('born', '12.11.26')).toBe('2026-11-12')
    expect(parse('born', '31.02.2026')).toBeUndefined()
    // Числа по языку — как прежде (DT14).
    expect(parse('age', '1 234,5')).toBe(1234.5)
    // Булево: true/false, 1/0, подписи словаря без учёта регистра.
    expect(parse('active', 'TRUE')).toBe(true)
    expect(parse('active', '0')).toBe(false)
    expect(parse('active', 'yes')).toBe(true)
    expect(parse('active', 'No')).toBe(false)
    expect(parse('active', 'maybe')).toBeUndefined()
    // Варианты: подписи, через запятую — у нескольких.
    expect(parse('color', 'green')).toBe('g')
    expect(parse('tags', 'Alpha, beta')).toEqual(['a', 'b'])
    expect(parse('tags', 'Alpha, Gamma')).toBeUndefined()
    // Запись: подпись среди загруженных записей колонки.
    expect(parse('owner', 'bob')).toEqual({ id: 'o2', name: 'Bob' })
    expect(parse('owner', 'Nobody')).toBeUndefined()
  })

  it('WR6: размер вставки — от одной ячейки размером буфера; кратно — повтор; 1×1 — во весь диапазон; не кратно — один раз от угла; после вставки выделен записанный прямоугольник', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits })

    // От одной ячейки — размером буфера 2×2.
    select(['1', 'name', '1', 'name'])
    await paste('a\t21\nb\t22')
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['1', 'name', 'a'],
      ['1', 'age', 21],
      ['2', 'name', 'b'],
      ['2', 'age', 22],
    ])
    expect(selection()).toEqual([['1', 'name', '2', 'age']])

    // Выделение 2×4 кратно буферу 1×2 — повтор плиткой.
    select(['3', 'name', '4', 'active'])
    await paste('x\t30')
    const tiled = cellsOf(onCommitEdits.mock.calls[1]![0])
    expect(tiled).toHaveLength(4)
    expect(tiled.filter(([, column]) => column === 'name')).toEqual([
      ['3', 'name', 'x'],
      ['4', 'name', 'x'],
    ])
    expect(tiled.filter(([, column]) => column === 'age')).toEqual([
      ['3', 'age', 30],
      ['4', 'age', 30],
    ])
    // В колонки даты и булева повтор кладёт «x» и «30» — они не разобраны и не записаны.
    expect(
      readFailures(captured)[cellFailureKey('3', 'born')]?.reason,
    ).toContain('"x"')
    expect(
      readFailures(captured)[cellFailureKey('4', 'active')]?.reason,
    ).toContain('"30"')

    // Буфер 1×1 — во все ячейки диапазона.
    select(['5', 'age', '7', 'age'])
    await paste('40')
    expect(cellsOf(onCommitEdits.mock.calls[2]![0])).toEqual([
      ['5', 'age', 40],
      ['6', 'age', 40],
      ['7', 'age', 40],
    ])

    // Выделение 3×3 не кратно 2×2 — один раз от левого верхнего угла.
    select(['0', 'name', '2', 'born'])
    await paste('p\t1\nq\t2')
    expect(cellsOf(onCommitEdits.mock.calls[3]![0])).toHaveLength(4)
    expect(selection()).toEqual([['0', 'name', '1', 'age']])
  })

  it('WR7: при нескольких диапазонах буфер 1×1 пишется во все, иначе — в активный', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits })
    select(['0', 'age', '1', 'age'], ['5', 'age', '5', 'age'])
    await paste('7')
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['0', 'age', 7],
      ['1', 'age', 7],
      ['5', 'age', 7],
    ])
    select(['0', 'age', '1', 'age'], ['5', 'age', '5', 'age'])
    await paste('8\n9')
    expect(cellsOf(onCommitEdits.mock.calls[1]![0])).toEqual([
      ['5', 'age', 8],
      ['6', 'age', 9],
    ])
  })

  it('WR8: строки за концом видимого списка и колонки за последней видимой не вставляются; объявление «вставлено N из M строк»', async () => {
    const onCommitEdits = vi.fn()
    const say = vi.fn()
    render({ onCommitEdits })
    registerAnnouncer(captured, { say, labels: ENGLISH_LABELS })
    select(['9', 'shown', '9', 'shown'])
    // Последняя колонка — дальше колонок нет: вставлена одна колонка из двух.
    await paste('a\tb\nc\td\ne\tf')
    const batch = onCommitEdits.mock.calls[0]
    expect(batch).toBeUndefined()
    select(['8', 'team', '8', 'team'])
    await paste('a\tb\nc\td\ne\tf')
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['8', 'team', 'a'],
      ['9', 'team', 'c'],
    ])
    expect(say).toHaveBeenCalledWith('Pasted 2 of 3 rows: the table ended')
  })

  it('WR9: вставка идёт по видимым строкам и колонкам; служебные колонки, строки-группы и удалённые строки не занимают места буфера; нередактируемые и ждущие ячейки занимают место и не пишутся; новая строка пишется в свой черновик', async () => {
    const onDraftsChange = vi.fn()
    render({
      saveMode: 'manual',
      onDraftsChange,
      canEditCell: ctx => ctx.column.id !== 'name',
    })
    // Удалённая строка 2 места не занимает; новая строка после 4 получает значение.
    act(() => captured.removeRow('2'))
    act(() => void captured.addRow({ id: 'new' }, { index: 5 }))
    select(['1', 'name', '1', 'name'])
    await paste('n1\t31\nn3\t33\nn4\t34\nnew\t99')
    const drafts = captured.getDrafts() as Draft[]
    const cellValues = drafts
      .filter(draft => draft.kind === 'cellValue')
      .map(draft => [
        (draft.target as { cell: string[] }).cell.join('/'),
        (draft.value as { value: unknown }).value,
      ])
    // `name` нередактируем: место занимает, не пишется; удалённая строка 2 пропущена.
    expect(cellValues).toEqual([
      ['1/age', 31],
      ['3/age', 33],
      ['4/age', 34],
    ])
    const inserted = drafts.find(draft => draft.kind === 'rowInsert')!
    const newId = (inserted.target as { row: string }).row
    expect(newId).not.toBe('2')
    expect((inserted.value as { values: Row }).values.age).toBe(99)
  })

  it('WR11: при сохранении по кнопке операция — черновики cellValue одной записью в срез drafts, без вызова колбэков', async () => {
    const onDraftsChange = vi.fn()
    const onCellEdit = vi.fn()
    const onCommitEdits = vi.fn()
    render({ saveMode: 'manual', onDraftsChange, onCellEdit, onCommitEdits })
    select(['0', 'age', '5', 'age'])
    onDraftsChange.mockClear()
    await paste('1\n2\n3\n4\n5\n6')
    expect(onDraftsChange).toHaveBeenCalledTimes(1)
    expect(onDraftsChange.mock.calls[0]![0]).toHaveLength(6)
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onCommitEdits).not.toHaveBeenCalled()
  })

  it('WR12: при автосохранении операция — один вызов onCommitEdits с id и source; без него — onCellEdit по ячейке, в разработке при пакете больше 100 ячеек — подсказка', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits })
    select(['0', 'age', '2', 'age'])
    await paste('5')
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
    expect(batch.source).toBe('paste')
    expect(batch.id).toMatch(/^write-/)
    expect(batch.cells).toHaveLength(3)

    act(() => root!.unmount())
    root = undefined
    const onCellEdit = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...ROWS[0]!,
      id: String(i),
    }))
    render({ onCellEdit, data: many })
    select(['0', 'age', '2', 'age'])
    await paste('6')
    expect(onCellEdit).toHaveBeenCalledTimes(3)
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('one by one'))
    select(['0', 'age', '119', 'age'])
    await paste('7')
    expect(onCellEdit).toHaveBeenCalledTimes(123)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('one by one'))
    warn.mockRestore()
  })

  it('LM12: уже решённый пакет блокирует повторную запись, а вид ожидания публикуется только для ждущего пакета', async () => {
    const delayed = deferred<CellEditBatchResult | void>()
    const onCommitEdits = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(delayed.promise)
    render({ onCommitEdits })
    const views: { locked: boolean; visible: boolean }[] = []
    const subscription = captured.atoms[EDIT_SESSION_KEY].subscribe(() => {
      views.push({
        locked: isCellPending(captured, '0', 'age'),
        visible:
          cellEditingViewOf(readEditingState(captured), '0', 'age') !== null,
      })
    })
    try {
      const write = () =>
        captured.writeCells([{ rowId: '0', columnId: 'age', value: 50 }])
      await act(async () => {
        const first = write()
        expect(isCellPending(captured, '0', 'age')).toBe(true)
        expect(
          cellEditingViewOf(readEditingState(captured), '0', 'age'),
        ).toBeNull()
        expect((await write()).written).toBe(0)
        await first
      })
      expect(views.some(view => view.visible)).toBe(false)
      expect(isCellPending(captured, '0', 'age')).toBe(false)

      await act(async () => {
        await write()
      })
      expect(views).toContainEqual({ locked: true, visible: true })
      await act(async () => {
        expect(cancelPending(captured, { kind: 'cellEdit' })).toBe(1)
        delayed.resolve(undefined)
      })
      expect(isCellPending(captured, '0', 'age')).toBe(false)
      expect(
        cellEditingViewOf(readEditingState(captured), '0', 'age'),
      ).toBeNull()

      views.length = 0
      onCommitEdits.mockResolvedValueOnce(undefined)
      await act(async () => {
        const writing = write()
        expect(cancelPending(captured, { kind: 'cellEdit' })).toBe(1)
        await writing
      })
      expect(views.some(view => view.visible)).toBe(false)
    } finally {
      subscription.unsubscribe()
    }
  })

  it('крупная отмена публикует ожидание только для ответа дольше ближайшей микрозадачи', async () => {
    const count = DEFAULT_WRITE_LIMITS.confirm
    const data = Array.from({ length: count }, (_, id) => ({
      ...ROWS[0]!,
      id: String(id),
    }))
    const delayed = deferred<CellEditBatchResult | void>()
    const onCommitEdits = vi
      .fn()
      .mockImplementationOnce(async () => {
        await Promise.resolve()
      })
      .mockReturnValueOnce(delayed.promise)
    render({ data, onCommitEdits })
    const visible = vi.fn()
    const view = () => cellEditingViewOf(readEditingState(captured), '0', 'age')
    const subscription = captured.atoms[EDIT_SESSION_KEY].subscribe(() => {
      if (view()) visible()
    })
    const changes = data.map(row => ({
      rowId: row.id,
      columnId: 'age',
      value: 50,
    }))
    const undo = async () => {
      expect(
        (await captured.writeCells(changes, { source: 'undo' })).written,
      ).toBe(count)
    }
    try {
      await act(undo)
      expect(visible).not.toHaveBeenCalled()
      expect(isCellPending(captured, '0', 'age')).toBe(false)
      await act(undo)
      expect(visible).toHaveBeenCalled()
      expect(isCellPending(captured, '0', 'age')).toBe(true)
      await act(async () => delayed.resolve(undefined))
      expect(view()).toBeNull()
      expect(isCellPending(captured, '0', 'age')).toBe(false)
    } finally {
      subscription.unsubscribe()
    }
  })

  it('WR15: одно объявление на операцию — записано, пропущено, с ошибкой; у асинхронного пакета — итог; тексты из словаря с формами числа', async () => {
    const say = vi.fn()
    const answer = deferred<CellEditBatchResult | void>()
    render({
      onCommitEdits: () => answer.promise,
      canEditCell: ctx => ctx.column.id !== 'name',
    })
    registerAnnouncer(captured, { say, labels: ENGLISH_LABELS })
    select(['0', 'name', '0', 'name'])
    await paste('a\t1\tnot a date')
    expect(say).toHaveBeenCalledTimes(1)
    expect(say).toHaveBeenLastCalledWith(
      'Paste: 1 cell, 1 read-only skipped, 1 not recognized',
    )
    answer.resolve()
    await flush()
    expect(say).toHaveBeenLastCalledWith('Paste: saved')
  })

  it('WR16: действия записи — в справочнике и в канале действий с источником', async () => {
    const onDebugAction = vi.fn()
    render({ onCommitEdits: () => {}, onDebugAction })
    for (const action of [
      'paste',
      'cut',
      'clear',
      'fillDown',
      'fillRight',
      'bulkEdit',
    ])
      expect(
        captured.getActionLabel({ plugin: 'cellEditing', action }),
      ).not.toBe(action)
    expect(
      captured.getActionLabel({ plugin: 'cellSelection', action: 'paste' }),
    ).toBe('Paste')
    select(['0', 'age', '0', 'age'])
    await paste('3')
    const actions = onDebugAction.mock.calls.map(([report]) => [
      (report as { plugin: string }).plugin,
      (report as { action: string }).action,
      (report as { source: string }).source,
    ])
    expect(actions).toContainEqual(['cellSelection', 'paste', 'api'])
    expect(actions).toContainEqual(['cellEditing', 'paste', 'auto'])
  })

  it('WR21: table.writeCells проходит те же правила — canEditCell, разбор текста, validate, пакет или черновики', async () => {
    const onCommitEdits = vi.fn()
    render({
      onCommitEdits,
      canEditCell: ctx => ctx.column.id !== 'name',
      validate: value => (value === 13 ? 'Unlucky' : null),
    })
    let report: unknown
    await act(async () => {
      report = await captured.writeCells(
        [
          { rowId: '0', columnId: 'name', text: 'x' },
          { rowId: '0', columnId: 'age', text: '13' },
          { rowId: '1', columnId: 'age', text: '1,5' },
          { rowId: '2', columnId: 'age', value: 77 },
          { rowId: '3', columnId: 'age', text: 'abc' },
          { rowId: '4', columnId: 'shown', text: 'x' },
        ],
        { source: 'api' },
      )
    })
    expect(report).toMatchObject({ written: 2, skipped: 2, invalid: 2 })
    const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
    expect(batch.source).toBe('api')
    expect(cellsOf(batch)).toEqual([
      ['1', 'age', 1.5],
      ['2', 'age', 77],
    ])
    const failures = readFailures(captured)
    expect(failures[cellFailureKey('0', 'age')]?.reason).toBe('Unlucky: "13"')
    expect(failures[cellFailureKey('3', 'age')]?.reason).toBe(
      'Enter a number: "abc"',
    )

    render({ onCommitEdits })
    const row = captured.getRowSource().byId('2')
    const readCellContexts = vi.spyOn(row, 'getAllCellsByColumnId')
    try {
      await act(async () => {
        report = await captured.writeCells([
          { rowId: '2', columnId: 'age', value: 80 },
        ])
      })
      expect(report).toMatchObject({ written: 1, skipped: 0, invalid: 0 })
      expect(readCellContexts).not.toHaveBeenCalled()
    } finally {
      readCellContexts.mockRestore()
    }
  })

  it('WR30: дерево и группировка — вставка идёт по видимому списку, свёрнутые ветки не заполняются; строки-группы места не занимают', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits, grouping: ['team'] })
    // Обе группы свёрнуты: видимый список — две строки-группы, в них не пишут.
    const source = captured.getRowSource()
    expect(source.count()).toBe(2)
    act(() =>
      captured.setCellSelection(() => [
        {
          anchorRowId: source.at(0).id,
          anchorColumnId: 'age',
          focusRowId: source.at(0).id,
          focusColumnId: 'age',
        },
      ]),
    )
    await paste('1\n2')
    expect(onCommitEdits).not.toHaveBeenCalled()

    // Раскрытая группа: строки-группы пропускаются, дети получают значения подряд.
    act(() => captured.toggleAllRowsExpanded(true))
    const rows = captured.getRowSource()
    const firstChild = rows.at(1)
    act(() =>
      captured.setCellSelection(() => [
        {
          anchorRowId: firstChild.id,
          anchorColumnId: 'age',
          focusRowId: firstChild.id,
          focusColumnId: 'age',
        },
      ]),
    )
    await paste('1\n2\n3\n4\n5\n6')
    const written = cellsOf(onCommitEdits.mock.calls[0]![0])
    expect(written.map(([rowId]) => rowId)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
  })

  it('WR32: у пакета id и source, у ячейки — original и value в типе колонки; обратный пакет с source undo применяется тем же каналом', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits })
    select(['0', 'born', '0', 'born'])
    await paste('03/15/2026')
    const batch = onCommitEdits.mock.calls[0]![0] as CellEditBatch
    expect(batch).toMatchObject({ source: 'paste' })
    expect(batch.id).toEqual(expect.any(String))
    expect(batch.cells[0]).toMatchObject({
      rowId: '0',
      columnId: 'born',
      value: '2026-03-15',
      original: '2026-01-01',
    })
    // Обратный пакет — те же ячейки с прежними значениями.
    await act(async () => {
      await captured.writeCells(
        batch.cells.map(cell => ({
          rowId: cell.rowId,
          columnId: cell.columnId,
          value: cell.original,
        })),
        { source: 'undo' },
      )
    })
    const undo = onCommitEdits.mock.calls[1]![0] as CellEditBatch
    expect(undo.source).toBe('undo')
    expect(cellsOf(undo)).toEqual([['0', 'born', '2026-01-01']])
  })

  it('WR39: аргументы paste и parseClipboard работают на клиентской и серверной модели строк', async () => {
    const onCommitEdits = vi.fn()
    render({ onCommitEdits, server: true })
    act(() =>
      captured.getRowSource().observe({ first: 0, last: 9, fast: false }),
    )
    await flush()
    await flush()
    const source = captured.getRowSource()
    expect(source.keyByIndex).toBe(true)
    expect(source.at(2)?.id).toBe('2')
    act(() =>
      captured.setCellSelection(() => [
        {
          anchorRowIndex: 1,
          focusRowIndex: 1,
          anchorColumnId: 'age',
          focusColumnId: 'age',
        },
      ]),
    )
    await paste('5\n6')
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['1', 'age', 5],
      ['2', 'age', 6],
    ])
    // `paste: false` — вставки нет и на серверной модели.
    render({ onCommitEdits, server: true, paste: false })
    act(() =>
      captured.setCellSelection(() => [
        {
          anchorRowIndex: 1,
          focusRowIndex: 1,
          anchorColumnId: 'age',
          focusColumnId: 'age',
        },
      ]),
    )
    await paste('7')
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
  })
})

/** Значения протяжки по номерам ячеек. */
const take = (at: (index: number) => unknown, count: number) =>
  Array.from({ length: count }, (_, index) => at(index))

/** Прямоугольник по местам строк и колонок в порядке показа. */
const bounds = (rows: [number, number], columns: [number, number]) => ({
  minRowIndex: rows[0],
  maxRowIndex: rows[1],
  minColumnIndex: columns[0],
  maxColumnIndex: columns[1],
})

const columnIndex = (id: string) =>
  captured.getCellSelectionColumnIndexes()[id] as number

describe('протяжка значения и заполнение (ADR 0219, этап 2)', () => {
  it('WR24: одно значение — копия; два и больше с постоянным шагом — ряд чисел, numberString без float, дат днями, месяцами или годами; иначе, а также текст, варианты, булево и object — повтор по кругу', () => {
    // Одно значение — копия любого типа.
    expect(take(fillSeries([5]), 3)).toEqual([5, 5, 5])
    expect(take(fillSeries(['2026-01-01'], { kind: 'date' }), 2)).toEqual([
      '2026-01-01',
      '2026-01-01',
    ])
    // Ряд чисел, вперёд и назад; хвостов float нет.
    expect(take(fillSeries([1, 3]), 3)).toEqual([5, 7, 9])
    expect(take(fillSeries([1, 3], { backward: true }), 2)).toEqual([-1, -3])
    expect(take(fillSeries([0.1, 0.2]), 2)).toEqual([0.3, 0.4])
    // numberString — десятичной арифметикой.
    expect(take(fillSeries(['0.10', '0.20'], { kind: 'decimal' }), 2)).toEqual([
      '0.30',
      '0.40',
    ])
    expect(
      take(
        fillSeries(['99999999999999999.1', '99999999999999999.2'], {
          kind: 'decimal',
        }),
        1,
      ),
    ).toEqual(['99999999999999999.3'])
    // Даты: шаг днями, месяцами с тем же числом (конца месяца нет — последний день), годами.
    expect(
      take(fillSeries(['2026-01-30', '2026-01-31'], { kind: 'date' }), 2),
    ).toEqual(['2026-02-01', '2026-02-02'])
    expect(
      take(fillSeries(['2026-01-15', '2026-02-15'], { kind: 'date' }), 2),
    ).toEqual(['2026-03-15', '2026-04-15'])
    expect(
      take(fillSeries(['2025-11-30', '2025-12-30'], { kind: 'date' }), 2),
    ).toEqual(['2026-01-30', '2026-02-28'])
    expect(
      take(fillSeries(['2020-06-01', '2021-06-01'], { kind: 'date' }), 1),
    ).toEqual(['2022-06-01'])
    expect(
      take(
        fillSeries(['2026-01-01T09:00', '2026-01-01T10:30'], { kind: 'date' }),
        1,
      ),
    ).toEqual(['2026-01-01T12:00'])
    // Даты-моменты — в календаре пояса таблицы: через переход на летнее время та же полночь.
    const days = take(
      fillSeries(
        [new Date('2026-03-27T23:00:00Z'), new Date('2026-03-28T23:00:00Z')],
        { timeZone: 'Europe/Berlin' },
      ),
      1,
    ) as Date[]
    expect(days[0]!.toISOString()).toBe('2026-03-29T22:00:00.000Z')
    // Шаг не постоянный — повтор по кругу; назад — от последнего.
    expect(take(fillSeries([1, 2, 4]), 4)).toEqual([1, 2, 4, 1])
    expect(take(fillSeries([1, 2, 4], { backward: true }), 3)).toEqual([
      4, 2, 1,
    ])
    // Текст, варианты, булево и object — повтор, даже когда похожи на ряд.
    expect(take(fillSeries(['a', 'b']), 3)).toEqual(['a', 'b', 'a'])
    expect(take(fillSeries(['1', '2'], { kind: 'none' }), 2)).toEqual([
      '1',
      '2',
    ])
    expect(take(fillSeries([true, false]), 3)).toEqual([true, false, true])
    const ann = { id: 'o1' }
    expect(take(fillSeries([ann]), 2)).toEqual([ann, ann])
    // По таблице: тип колонки выбирает правило — число, дата-строка, текст.
    render()
    const changes = fillChanges(captured, {
      bound: bounds([0, 1], [columnIndex('name'), columnIndex('born')]),
      axis: 'y',
      to: 3,
    })
    const byCell = Object.fromEntries(
      changes.map(change => [
        `${change.rowId}:${change.columnId}`,
        'value' in change ? change.value : undefined,
      ]),
    )
    expect(byCell['2:age']).toBe(22)
    expect(byCell['3:age']).toBe(23)
    expect(byCell['2:born']).toBe('2026-01-03')
    expect(byCell['2:name']).toBe('Name 0')
    expect(byCell['3:name']).toBe('Name 1')
  })

  it('WR26: getFillValue задаёт значение ячейки протяжки или пропуск', async () => {
    const onCommitEdits = vi.fn()
    const getFillValue = vi.fn(
      (ctx: { index: number; value: unknown; skip: symbol }) =>
        ctx.index === 1 ? ctx.skip : `${String(ctx.value)}!`,
    )
    render({ onCommitEdits, handle: { mode: 'fill', getFillValue } })
    select(['0', 'name', '0', 'name'])
    const name = columnIndex('name')
    const mode = fillMode(
      captured,
      bounds([0, 0], [name, name]),
      captured.options.cellSelectionHandle,
      () => {},
      () => false,
    )
    act(() => {
      mode.move({ row: 3, column: 'name' })
      mode.end()
    })
    await flush()
    // Контекст — исходные значения линии, номер, направление, строка, колонка, значение по правилу.
    expect(getFillValue.mock.calls[0]![0]).toMatchObject({
      values: ['Name 0'],
      index: 0,
      direction: 'down',
      rowId: '1',
      columnId: 'name',
      value: 'Name 0',
    })
    // Пропуск оставляет ячейку: строки 2 в пакете нет.
    expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
      ['1', 'name', 'Name 0!'],
      ['3', 'name', 'Name 0!'],
    ])
    expect(onCommitEdits.mock.calls[0]![0].source).toBe('fill')
  })

  it('WR41: аргументы handle.mode, handle.direction, handle.getFillValue работают на клиентской и серверной модели строк', async () => {
    const getFillValue = (ctx: { value: unknown }) => Number(ctx.value) + 100
    for (const server of [false, true]) {
      const onCommitEdits = vi.fn()
      // Набор фич собирается при монтировании: серверная модель — новой таблицей.
      act(() => root?.unmount())
      root = undefined
      render({
        onCommitEdits,
        server,
        handle: { mode: 'fill', direction: 'x', getFillValue },
      })
      if (server) {
        act(() =>
          captured.getRowSource().observe({ first: 0, last: 9, fast: false }),
        )
        await flush()
        await flush()
      }
      const options = captured.options.cellSelectionHandle
      expect(options).toMatchObject({ mode: 'fill', direction: 'x' })
      const age = columnIndex('age')
      const mode = fillMode(
        captured,
        bounds([1, 1], [age, age]),
        options,
        () => {},
        () => false,
      )
      // Ось ограничена 'x': смещение вниз больше, но протяжка идёт вправо, в соседнюю колонку.
      act(() => {
        mode.move({ row: 5, column: 'born' })
        mode.end()
      })
      await flush()
      expect(cellsOf(onCommitEdits.mock.calls[0]![0])).toEqual([
        ['1', 'born', 121],
      ])
    }
    // Без аргумента — режим диапазона.
    render({})
    expect(captured.options.cellSelectionHandle).toMatchObject({
      mode: 'range',
      direction: 'xy',
    })
  })
})

describe('вставка в серверной модели строк (ADR 0219, этап 3)', () => {
  /** «Сервер» блоками: ответ ждёт команды; считает запросы в полёте. */
  const blockServer = () => {
    const waiting: (() => void)[] = []
    let inFlight = 0
    let most = 0
    const getRows = ({ start, end }: { start: number; end: number }) =>
      new Promise<{ rows: Row[]; rowCount: number }>(resolve => {
        inFlight++
        most = Math.max(most, inFlight)
        waiting.push(() => {
          inFlight--
          resolve({ rows: ROWS.slice(start, end), rowCount: ROWS.length })
        })
      })
    const answerAll = async (operation?: Promise<void>) => {
      let settled = !operation
      const markSettled = () => {
        settled = true
      }
      void operation?.then(markSettled, markSettled)
      while (waiting.length > 0 || !settled) {
        await act(async () => {
          for (const answer of waiting.splice(0)) answer()
        })
        await flush()
        // Серверная модель может уступить поток между пачками запросов.
        if (!settled && waiting.length === 0)
          await vi.waitFor(() =>
            expect(settled || waiting.length > 0).toBe(true),
          )
      }
      await operation
    }
    return { getRows, answerAll, most: () => most }
  }

  const mountServer = async (
    props: Omit<HostProps, 'server' | 'getRows'> = {},
  ) => {
    act(() => root?.unmount())
    root = undefined
    const backend = blockServer()
    render({ ...props, server: true, getRows: backend.getRows, blockSize: 1 })
    // В окне — только первые две строки.
    act(() =>
      captured.getRowSource().observe({ first: 0, last: 1, fast: false }),
    )
    await backend.answerAll()
    return backend
  }

  const selectIndex = (index: number, column: string) =>
    act(() =>
      captured.setCellSelection(() => [
        {
          anchorRowIndex: index,
          focusRowIndex: index,
          anchorColumnId: column,
          focusColumnId: column,
        },
      ]),
    )

  it('WR28: SSRM — цели в незагруженных строках догружаются getRows по веткам, не больше четырёх запросов сразу; строк больше cellSelectionMaxCopyRows — отказ с причиной; смена выборки до отправки пакета отменяет операцию с объявлением; отправленный пакет держится за id строк', async () => {
    const onCommitEdits = vi.fn(
      (_batch: CellEditBatch, _context?: { signal: AbortSignal }) =>
        new Promise<void>(() => {}),
    )
    let backend = await mountServer({ onCommitEdits })
    expect(captured.getRowSource().at(5)).toBeUndefined()

    // Девять строк от первой: восемь незагруженных — ожидание, догрузка, один пакет.
    selectIndex(0, 'age')
    let done: Promise<void> | undefined
    act(() => {
      done = pasteData(
        captured,
        { text: '1\n2\n3\n4\n5\n6\n7\n8\n9', html: '' },
        'api',
      )
    })
    await flush()
    expect(readServerAction(captured).loadingRows?.kind).toBe('paste')
    expect(onCommitEdits).not.toHaveBeenCalled()
    await backend.answerAll(done)
    expect(backend.most()).toBeLessThanOrEqual(4)
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    const batch = onCommitEdits.mock.calls[0]![0]
    expect(cellsOf(batch)).toEqual(
      Array.from({ length: 9 }, (_, i) => [String(i), 'age', i + 1]),
    )
    // Пакет держится за id: новое выделение и запросы его не меняют, сохранение не прервано.
    selectIndex(3, 'name')
    expect(onCommitEdits.mock.calls[0]![1]?.signal.aborted).toBe(false)
    expect(batch.cells.map(cell => cell.rowId)).toEqual(
      Array.from({ length: 9 }, (_, i) => String(i)),
    )

    // Смена выделения до отправки пакета — отмена с объявлением.
    backend = await mountServer({ onCommitEdits })
    const say = vi.fn()
    registerAnnouncer(captured, { say, labels: ENGLISH_LABELS })
    selectIndex(0, 'age')
    act(() => {
      done = pasteData(captured, { text: '1\n2\n3\n4\n5', html: '' }, 'api')
    })
    await flush()
    expect(readServerAction(captured).loadingRows?.kind).toBe('paste')
    selectIndex(1, 'name')
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    await backend.answerAll(done)
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    expect(say).toHaveBeenCalledWith(
      ENGLISH_LABELS.announceActionCancelled(ENGLISH_LABELS.actionPaste),
    )

    // Строк больше предела — отказ с причиной, без запросов.
    await mountServer({ onCommitEdits, maxCopyRows: 3 })
    selectIndex(0, 'age')
    await paste('1\n2\n3\n4\n5')
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const failed = readServerAction(captured).failed
    expect(failed?.kind).toBe('paste')
    expect((failed?.error as Error).message).toBe(
      cellSelectionLabels(ENGLISH_LABELS).writeTooManyRows(5, 3),
    )
  })

  it('LM8: серверная модель — запись подчиняется и writeLimits, и cellSelectionMaxCopyRows', async () => {
    const onCommitEdits = vi.fn(() => undefined)
    const backend = await mountServer({
      onCommitEdits,
      writeLimits: { max: 2 },
    })
    selectIndex(0, 'age')
    let done: Promise<void> | undefined
    act(() => {
      done = pasteData(captured, { text: '1\n2\n3', html: '' }, 'api')
    })
    await flush()
    await backend.answerAll(done)
    // Строки догружены, но ячеек больше writeLimits.max — отказ без пакета.
    expect(onCommitEdits).not.toHaveBeenCalled()
    const failed = readServerAction(captured).failed
    expect(failed?.kind).toBe('write')
    expect((failed?.error as Error).message).toBe(
      ENGLISH_LABELS.writeOverLimit(3, 2),
    )
  })
})

describe('пределы записи (ADR 0223)', () => {
  const ages = () =>
    ['0', '1', '2', '3'].map(id =>
      captured.getRowSource().byId(id)?.getValue('age'),
    )
  const write = async (
    changes: { rowId: string; columnId: string; value: unknown }[],
  ) => {
    let report: Record<string, unknown> | undefined
    await act(async () => {
      report = await captured.writeCells(changes)
    })
    return report!
  }
  const drafts = () =>
    (captured.getDrafts() as Draft[]).filter(
      draft => draft.kind === 'cellValue',
    ).length

  it('LM1: предел считает ячейки, которые операция действительно запишет: только для чтения, служебные и ждущие сохранения в счёт не входят', async () => {
    const onCommitEdits = vi.fn(() => undefined)
    render({
      onCommitEdits,
      canEditCell: ctx => ctx.column.id === 'age',
      writeLimits: { max: 3 },
    })
    // Шесть изменений, три из них — в колонку только для чтения: в счёт идут три.
    const changes = ['0', '1', '2'].flatMap(rowId => [
      { rowId, columnId: 'name', value: 'x' },
      { rowId, columnId: 'age', value: 90 },
    ])
    const report = await write(changes)
    expect(report.limited).toBeUndefined()
    expect(report).toMatchObject({ written: 3, skipped: 3 })
    // Ячейки, ждущие сохранения, тоже не в счёт: пакет висит — три ячейки ждут.
    onCommitEdits.mockImplementation(() => new Promise(() => {}) as never)
    await write(
      ['0', '1', '2'].map(rowId => ({ rowId, columnId: 'age', value: 91 })),
    )
    const more = await write(
      ['0', '1', '2', '3'].map(rowId => ({
        rowId,
        columnId: 'age',
        value: 92,
      })),
    )
    expect(more.limited).toBeUndefined()
    expect(more).toMatchObject({ written: 1, skipped: 3 })
  })

  it('LM4: режим «Применить» — запись, переводящая черновики через confirm, спрашивает, больше max — отказ; черновик строки — один, ячейка с черновиком второй раз не считается', async () => {
    render({ saveMode: 'manual', writeLimits: { confirm: 2, max: 3 } })
    select(['0', 'age', '1', 'age'])
    await paste('50\n51')
    expect(drafts()).toBe(2)
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    // Третий черновик переводит через confirm — вопрос.
    select(['2', 'age', '2', 'age'])
    let pasting: Promise<void> | undefined
    act(() => {
      pasting = pasteData(captured, { text: '52', html: '' }, 'api')
    })
    await flush()
    const question = readServerAction(captured).loadingRows
    expect(question).toMatchObject({
      kind: 'write',
      confirm: { count: 1, limit: true },
    })
    expect(drafts()).toBe(2)
    act(() => question!.confirm!.accept())
    await act(async () => {
      await pasting
    })
    expect(drafts()).toBe(3)
    // Ячейка с черновиком второй раз не считается — без вопроса и отказа.
    select(['0', 'age', '0', 'age'])
    await paste('60')
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    expect(readServerAction(captured).failed).toBeUndefined()
    // Четвёртый черновик — больше max: отказ, черновиков по-прежнему три.
    select(['3', 'age', '3', 'age'])
    await paste('53')
    expect(readServerAction(captured).failed?.kind).toBe('write')
    expect(drafts()).toBe(3)
    // Черновик строки — один: с ним уже три черновика у max 3 без ячеек.
    act(() => root?.unmount())
    root = undefined
    render({ saveMode: 'manual', writeLimits: { confirm: 10, max: 3 } })
    act(() => {
      captured.addRow({ name: 'New', age: 1 })
    })
    const report = await write(
      ['0', '1', '2'].map(rowId => ({ rowId, columnId: 'age', value: 70 })),
    )
    expect(report.limited).toEqual({ count: 3, max: 3 })
    const fits = await write(
      ['0', '1'].map(rowId => ({ rowId, columnId: 'age', value: 70 })),
    )
    expect(fits.limited).toBeUndefined()
  })

  it('LM6: table.writeCells больше max — отказ в отчёте limited без вопроса и предупреждение в разработке; не больше max — запись без вопроса', async () => {
    // Предупреждение выводится раз на ключ: прежние тесты его уже выводили.
    __resetLogger()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render({ writeLimits: { confirm: 1, max: 2 } })
      const before = ages()
      const over = await write(
        ['0', '1', '2'].map(rowId => ({ rowId, columnId: 'age', value: 80 })),
      )
      expect(over).toMatchObject({ written: 0, limited: { count: 3, max: 2 } })
      expect(ages()).toEqual(before)
      expect(readServerAction(captured).loadingRows).toBeUndefined()
      expect(warn.mock.calls.flat().join(' ')).toContain('writeLimits')
      // Больше confirm, не больше max — запись без вопроса.
      const fits = await write(
        ['0', '1'].map(rowId => ({ rowId, columnId: 'age', value: 81 })),
      )
      expect(fits).toMatchObject({ written: 2 })
      expect(readServerAction(captured).loadingRows).toBeUndefined()
    } finally {
      warn.mockRestore()
    }
  })

  it('LM9: сбрасывание черновиков и «Применить всё» пределу не подчиняются', async () => {
    const onCommitEdits = vi.fn(() => undefined)
    const initial: Draft[] = ['0', '1', '2', '3'].map(rowId => ({
      kind: 'cellValue',
      target: { cell: [rowId, 'age'] },
      value: { value: 99, text: '99' },
    }))
    render({
      saveMode: 'manual',
      onCommitEdits,
      writeLimits: { confirm: 1, max: 2 },
    })
    act(() => {
      for (const draft of initial) captured.setDraft(draft)
    })
    expect(drafts()).toBe(4)
    // «Применить всё» — пакет из четырёх ячеек сверх max, без вопроса.
    await act(async () => {
      commitAllDrafts(captured)
    })
    await flush()
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    expect((onCommitEdits.mock.calls[0] as unknown[])[0]).toMatchObject({
      cells: expect.arrayContaining([expect.objectContaining({ rowId: '3' })]),
    })
    expect(readServerAction(captured).loadingRows).toBeUndefined()
    expect(readServerAction(captured).failed).toBeUndefined()
    // Сбросить четыре черновика — тоже без вопроса и отказа.
    act(() => {
      for (const draft of initial) captured.setDraft(draft)
    })
    act(() => {
      for (const draft of captured.getDrafts() as Draft[])
        discardDraft(captured, draft)
    })
    expect(drafts()).toBe(0)
    expect(readServerAction(captured).loadingRows).toBeUndefined()
  })
})
