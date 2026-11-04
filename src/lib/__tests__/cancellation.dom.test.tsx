// @vitest-environment happy-dom
/**
 * Отмена длительных операций (ADR 0153; CA1, CA8, CA9, CA11, CA12): `signal` у колбэков,
 * ответ после отмены, `table.cancelPending`, подписи словаря и канал действий.
 * Запуск: npx vitest run --config vitest.node.config.ts cancellation
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import type { ContextMenuAction, HeaderAction } from '../../index'
import type {
  ExportContext,
  ExportFormat,
  ExportOptions,
  RowExpandingHooks,
} from '../../plugins'
import { registerAnnouncer } from '../core/announcer'
import { cancelPending, cancelSourceOf } from '../core/cancellation'
import type { DebugAction } from '../core/debugActions'
import { readFlashes } from '../core/flashes/flashFeature'
import { runMenuAction } from '../core/headerActions/actionStatus'
import { readActionStatus } from '../core/headerActions/actionStatusFeature'
import type { MenuAction } from '../core/headerActions/types'
import { ENGLISH_LABELS, resolveLabels } from '../core/localization'
import { __resetLogger } from '../util/logger'
import { readServerAction } from '../core/serverActions'
import { readPluginHooks } from '../core/definePlugin'
import { useCreateTable } from '../core/useCreateTable'
import { columnSorting, dataExport, rowExpanding } from '../plugins'
import { sortHeaderAction } from '../plugins/columnSorting/sortHeaderAction'
import { downloadFile } from '../plugins/dataExportModel/download'
import { readLoadedChildren } from '../plugins/rowExpanding/lazyChildrenFeature'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'
import { RU_LABELS } from '../stories/__mocks__/localization.ru'
import { rowExpandingLabels } from '../plugins/rowExpanding/labels'

vi.mock('../plugins/dataExportModel/download', () => ({
  downloadFile: vi.fn(),
}))

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Node {
  id: string
  name: string
  kids?: number
}

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const DATA: Node[] = [
  { id: 'a', name: 'a', kids: 2 },
  { id: 'b', name: 'b' },
]

interface Deferred<T = void> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const deferred = <T = void,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

/** Ответы колбэков в порядке вызова и их `signal`. */
interface Call {
  kind: string
  signal: AbortSignal
  reply: Deferred<any>
}

let calls: Call[] = []
let actions: DebugAction[] = []
let captured: any
let root: Root | undefined

const reply = (kind: string, signal: AbortSignal) => {
  const call: Call = { kind, signal, reply: deferred<any>() }
  calls.push(call)
  return call.reply.promise
}

const slowFormat: ExportFormat = {
  id: 'slow',
  label: 'Slow',
  extension: 'txt',
  mimeType: 'text/plain',
  serialize: (_data, context) => reply('serialize', context!.signal),
}

const Host = ({ server }: { server: boolean }) => {
  captured = useCreateTable({
    columns: columns as never,
    data: DATA,
    dataMode: { sorting: 'server', export: server ? 'server' : 'client' },
    onDebugAction: action => actions.push(action),
    plugins: [
      columnSorting({
        onToggleColumnSort: (...args: unknown[]) =>
          reply('sorting', (args.at(-1) as { signal: AbortSignal }).signal),
      }),
      rowExpanding({
        hasChildren: row => (row.original.kids ?? 0) > 0,
        loadChildren: (_row, context) => reply('children', context!.signal),
      }),
      dataExport({
        formats: [slowFormat],
        onExport: (_request, context) => reply('export', context!.signal),
        onExported: () => calls.push({ kind: 'exported' } as Call),
      }),
    ],
  })
  return null
}

const mount = (server = false) => {
  act(() => root?.unmount())
  root = createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, { server })))
  const said: string[] = []
  registerAnnouncer(captured, {
    say: (text: string) => said.push(text),
    labels: ENGLISH_LABELS,
  } as never)
  return said
}

beforeEach(() => {
  calls = []
  actions = []
  __resetLogger()
  vi.mocked(downloadFile).mockClear()
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
  vi.restoreAllMocks()
})

const menuAction = (id = 'archive'): MenuAction => ({
  id,
  icon: () => null,
  label: () => 'Archive',
  onSelect: (_ctx, _event, context) => reply(id, context!.signal),
})

const ctxOf = () => ({
  table: captured,
  row: captured.getRow('b'),
  column: captured.getColumn('name'),
})

const runMenu = (action: MenuAction) =>
  act(() => runMenuAction(action, ctxOf()))
const sort = () =>
  act(() =>
    sortHeaderAction.onSelect(
      { column: captured.getColumn('name'), table: captured } as never,
      { shiftKey: false } as never,
    ),
  )
const expandA = () =>
  act(() =>
    toggleRowExpanded(
      captured.getCoreRowModel().rowsById.a,
      readPluginHooks<Partial<RowExpandingHooks>>(captured, 'rowExpanding'),
    ),
  )
const exportSlow = (rows = 'view') => {
  let done: Promise<void> | undefined
  act(() => {
    done = captured.exportData({ rows, format: 'slow' })
  })
  return done!
}
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))
const callOf = (kind: string) => calls.find(call => call.kind === kind)!
const cancelEvents = () => actions.filter(action => action.action === 'cancel')

describe('Отмена длительных операций: signal и cancelPending (ADR 0153)', () => {
  it('CA1: onSelect пунктов меню и инлайн-кнопок, onExport и serialize формата, loadChildren получают { signal }, его прерывает отмена; серверные действия — как раньше; типы — в публичном API', async () => {
    expectTypeOf<Parameters<ContextMenuAction['onSelect']>[2]>().toEqualTypeOf<
      { signal: AbortSignal } | undefined
    >()
    expectTypeOf<Parameters<HeaderAction['onSelect']>[2]>().toEqualTypeOf<
      { signal: AbortSignal } | undefined
    >()
    expectTypeOf<ExportContext>().toEqualTypeOf<{ signal: AbortSignal }>()
    expectTypeOf<Parameters<ExportFormat['serialize']>[1]>().toEqualTypeOf<
      ExportContext | undefined
    >()
    expectTypeOf<
      Parameters<NonNullable<ExportOptions['onExport']>>[1]
    >().toEqualTypeOf<ExportContext | undefined>()
    expectTypeOf<
      Parameters<NonNullable<RowExpandingHooks['loadChildren']>>[1]
    >().toEqualTypeOf<{ signal: AbortSignal } | undefined>()

    mount()
    runMenu(menuAction())
    expandA()
    void exportSlow()
    sort()
    const kinds = ['archive', 'children', 'serialize', 'sorting']
    for (const kind of kinds) {
      expect(callOf(kind).signal.aborted).toBe(false)
    }
    act(() => captured.cancelPending())
    for (const kind of kinds) {
      expect(callOf(kind).signal.aborted).toBe(true)
    }

    mount(true)
    void exportSlow('all')
    expect(callOf('export').signal.aborted).toBe(false)
    act(() => captured.cancelPending({ kind: 'export' }))
    expect(callOf('export').signal.aborted).toBe(true)
    await flush()
  })

  it('CA8: ответ после отмены игнорируется — ни успеха, ни отказа, ни вспышки, ни детей, ни файла; выполненный промис — одно dev-предупреждение о signal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const said = mount()
    runMenu(menuAction('archive'))
    runMenu(menuAction('restore'))
    expandA()
    const exported = exportSlow()
    const sortingBefore = captured.atoms.sorting.get()
    sort()
    act(() => captured.cancelPending())
    said.length = 0

    await act(async () => {
      callOf('archive').reply.resolve(undefined)
      callOf('restore').reply.reject(new Error('Refused'))
      callOf('children').reply.resolve([{ id: 'a1', name: 'a1' }])
      callOf('serialize').reply.resolve('file')
      callOf('sorting').reply.reject(new Error('Refused'))
      await exported
    })
    await flush()

    expect(readActionStatus(captured)).toEqual({})
    expect(readFlashes(captured)).toEqual({})
    expect(readServerAction(captured)).toEqual({})
    expect(captured.atoms.sorting.get()).toEqual(sortingBefore)
    expect(readLoadedChildren(captured)).toEqual({})
    expect(captured.getRow('a').getIsExpanded()).toBe(false)
    expect(downloadFile).not.toHaveBeenCalled()
    expect(calls.some(call => call.kind === 'exported')).toBe(false)
    expect(said).toEqual([])
    const late = warn.mock.calls.filter(([message]) =>
      String(message).includes('signal'),
    )
    expect(late).toHaveLength(1)

    // Приложение прервало запрос по signal — предупреждения нет.
    __resetLogger()
    warn.mockClear()
    runMenu(menuAction('again'))
    act(() => captured.cancelPending())
    await act(async () =>
      callOf('again').reply.reject(new DOMException('Aborted', 'AbortError')),
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('CA9: table.cancelPending(filter?) отменяет все ждущие действия или по виду и id; итог — как у отмены человеком', async () => {
    const said = mount()
    runMenu(menuAction('archive'))
    runMenu(menuAction('restore'))
    expandA()
    sort()

    act(() => captured.cancelPending({ kind: 'menu', id: 'restore' }))
    expect(callOf('restore').signal.aborted).toBe(true)
    expect(callOf('archive').signal.aborted).toBe(false)
    expect(Object.keys(readActionStatus(captured))).toHaveLength(1)

    act(() => captured.cancelPending({ kind: 'children' }))
    expect(callOf('children').signal.aborted).toBe(true)
    expect(callOf('archive').signal.aborted).toBe(false)
    expect(captured.getRow('a').getIsExpanded()).toBe(false)
    expect(captured.getRow('a').getIsExpandPending()).toBe(false)

    act(() => captured.cancelPending())
    expect(callOf('archive').signal.aborted).toBe(true)
    expect(callOf('sorting').signal.aborted).toBe(true)
    expect(readActionStatus(captured)).toEqual({})
    expect(readServerAction(captured)).toEqual({})
    expect(captured.atoms.sorting.get()).toEqual([])
    expect(readFlashes(captured)).toEqual({})
    await flush()
    expect(said).toEqual(
      expect.arrayContaining([
        ENGLISH_LABELS.announceActionCancelled('Archive'),
        ENGLISH_LABELS.announceActionCancelled(
          rowExpandingLabels(ENGLISH_LABELS).expandRow,
        ),
        ENGLISH_LABELS.announceActionCancelled(ENGLISH_LABELS.actionSorting),
      ]),
    )
    expect(cancelEvents().every(event => event.source === 'api')).toBe(true)
  })

  it('CA11: подписи «Отменить: ‹имя›», «‹имя›: отменено», «Идёт ‹действие›…», «Отменить» — ключи словаря localization', () => {
    expect(ENGLISH_LABELS.cancelAction('Archive')).toBe('Cancel: Archive')
    expect(ENGLISH_LABELS.announceActionCancelled('Archive')).toBe(
      'Archive: cancelled',
    )
    expect(ENGLISH_LABELS.cancel).toBe('Cancel')
    expect(ENGLISH_LABELS.pendingSearch).toBe('Searching…')

    const ru = resolveLabels(RU_LABELS, 'ru')
    expect(ru.cancelAction('Архивировать')).toBe('Отменить: Архивировать')
    expect(ru.announceActionCancelled('Поиск')).toBe('Поиск: отменено')
    expect(ru.cancel).toBe('Отменить')
    expect(ru.pendingSearch).toBe('Идёт поиск…')
    expect(ru.pendingCopy).toBe('Копирование…')

    const own = resolveLabels(
      { cancelAction: 'Stop {name}', pendingSorting: 'Ordering…' },
      'en',
    )
    expect(own.cancelAction('Archive')).toBe('Stop Archive')
    expect(own.pendingSorting).toBe('Ordering…')
  })

  it('CA12: отмена — действие канала cancel с источником pointer, keyboard или api и id отменённого', () => {
    expect(cancelSourceOf(new MouseEvent('click', { detail: 1 }))).toBe(
      'pointer',
    )
    expect(cancelSourceOf(new PointerEvent('pointerdown'))).toBe('pointer')
    expect(cancelSourceOf(new KeyboardEvent('keydown'))).toBe('keyboard')
    expect(cancelSourceOf(undefined)).toBe('api')

    mount()
    runMenu(menuAction('archive'))
    expandA()
    sort()
    void exportSlow()
    act(() => {
      cancelPending(captured, { kind: 'menu' }, 'pointer')
    })
    act(() => {
      cancelPending(captured, { kind: 'children' }, 'keyboard')
    })
    act(() => {
      cancelPending(captured, { kind: 'server' }, 'pointer')
    })
    act(() => captured.cancelPending({ kind: 'export' }))

    expect(
      cancelEvents().map(({ plugin, detail, source }) => ({
        plugin,
        detail,
        source,
      })),
    ).toEqual([
      { plugin: 'core', detail: { action: 'archive' }, source: 'pointer' },
      {
        plugin: 'rowExpanding',
        detail: { action: 'loadChildren', rowId: 'a' },
        source: 'keyboard',
      },
      {
        plugin: 'columnSorting',
        detail: { action: 'sorting' },
        source: 'pointer',
      },
      { plugin: 'dataExport', detail: { action: 'slow' }, source: 'api' },
    ])
  })
})
