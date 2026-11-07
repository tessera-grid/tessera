// @vitest-environment happy-dom
/**
 * Id новой строки задаёт таблица (ADR 0181; NI1–NI4): UUID в `addRow`, одна строка в данных и
 * при раннем рендере, черновик серверной модели до записи в кэш без вспышки прихода,
 * предупреждение о смене id.
 * Запуск: npx vitest run --config vitest.node.config.ts newRowId
 */
import { act, createElement, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import {
  applyAllDrafts,
  readDrafts,
  rowDraftMarkOf,
} from '../core/drafts/drafts'
import { readFlashes } from '../core/flashes/flashFeature'
import { rowHighlightKey } from '../core/highlights/highlightFeature'
import { ENGLISH_LABELS } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import { cellEditing, serverRowModel } from '../plugins'
import type { CellEditBatch } from '../plugins/cellEditing/types'
import { serverRowModelLabels } from '../plugins/serverRowModel/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string; age: number }

const columns = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const ROWS: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let table: any
let root: Root | undefined
let container: HTMLElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.unstubAllGlobals()
})

const mount = (element: ReturnType<typeof createElement>) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(element))
}

const flush = () => act(async () => {})
/** Черновик сохранённой новой строки снимается задачей после ответа. */
const afterTask = () => act(() => new Promise(resolve => setTimeout(resolve)))

/** Ответ «сервера»: новая строка сохранена под id, который ей выдала таблица. */
const keepId = (batch: CellEditBatch) => ({
  saved: (batch.inserts ?? []).map(item => ({
    rowId: item.rowId,
    row: { ...item.values, id: item.rowId },
  })),
})

/** Строки источника с id `id` — по индексу: у серверной модели списка целиком нет. */
const rowsWith = (id: string) => {
  const source = table.getRowSource()
  return Array.from({ length: source.count() }, (_, i) => source.at(i)).filter(
    (row: { id: string } | undefined) => row?.id === id,
  )
}

/**
 * Клиентский режим: приложение держит данные. `early` — приложение отрисовывает сохранённую
 * строку в ответе, раньше, чем грид разберёт ответ.
 */
const ClientHost = ({
  early = false,
  answer = keepId,
}: {
  early?: boolean
  answer?: (batch: CellEditBatch) => {
    saved: { rowId: string; row: unknown }[]
  }
}) => {
  const [data, setData] = useState(ROWS)
  const insert = (batch: CellEditBatch, saved: ReturnType<typeof answer>) =>
    setData(prev => {
      const next = [...prev]
      for (const item of batch.inserts ?? []) {
        const at = item.after
          ? next.findIndex(row => row.id === item.after) + 1
          : 0
        next.splice(
          at,
          0,
          saved.saved.find(s => s.rowId === item.rowId)!.row as Row,
        )
      }
      return next
    })
  table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    plugins: [
      cellEditing({
        saveMode: 'manual',
        onCommitEdits: (batch: CellEditBatch) => {
          const saved = answer(batch)
          if (!early) {
            insert(batch, saved)
            return saved
          }
          return Promise.resolve().then(() => {
            flushSync(() => insert(batch, saved))
            // Кадр раннего рендера: строка одна, ещё до разбора ответа.
            earlyFrame = rowsWith(batch.inserts![0]!.rowId).length
            return saved
          })
        },
      } as never),
    ],
  } as never)
  return null
}
let earlyFrame = -1

/** Серверная модель: строки первого блока загружены. */
const mountServer = async () => {
  const ServerHost = () => {
    table = useCreateTable({
      columns: columns as never,
      data: [],
      getRowId: (row: Row) => row.id,
      plugins: [
        serverRowModel({
          blockSize: 20,
          getRows: ({ start, end }: { start: number; end: number }) => ({
            rows: ROWS.slice(start, end),
            rowCount: ROWS.length,
          }),
        }),
        cellEditing({ saveMode: 'manual', onCommitEdits: keepId } as never),
      ],
    } as never)
    return null
  }
  mount(createElement(ServerHost))
  await flush()
  act(() => table.getRowSource().observe?.({ first: 0, last: 5 }))
  await flush()
}

const addRow = () => {
  let id = ''
  act(() => {
    id = table.addRow({ name: 'Ada', age: 36 }, { index: 2 })
  })
  return id
}

describe('id новой строки задаёт таблица (ADR 0181)', () => {
  it('NI1: addRow выдаёт новой строке уникальный id формы UUID и без crypto.randomUUID; этот id — rowId вставки в пакете onCommitEdits; новую строку отличает черновик rowInsert', async () => {
    const batches: CellEditBatch[] = []
    const Host = () => {
      table = useCreateTable({
        columns: columns as never,
        data: ROWS,
        getRowId: (row: Row) => row.id,
        plugins: [
          cellEditing({
            saveMode: 'manual',
            onCommitEdits: (batch: CellEditBatch) => {
              batches.push(batch)
              return { refused: [] }
            },
          } as never),
        ],
      } as never)
      return null
    }
    mount(createElement(Host))
    const first = addRow()
    const second = addRow()
    expect(first).toMatch(UUID)
    expect(second).toMatch(UUID)
    expect(second).not.toBe(first)
    expect(rowDraftMarkOf(table, first)).toBe('inserted')
    expect(rowDraftMarkOf(table, '3')).toBeUndefined()
    act(() => applyAllDrafts(table))
    await flush()
    expect(batches[0]!.inserts!.map(item => item.rowId).sort()).toEqual(
      [first, second].sort(),
    )

    // Без crypto.randomUUID (страница не по HTTPS) — та же форма.
    const { getRandomValues } = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: getRandomValues.bind(globalThis.crypto),
    })
    expect(addRow()).toMatch(UUID)
  })

  it('NI2: клиентский режим — строка, вставленная приложением в data под id новой строки, — одна строка без вида новой: слой не рисует новую строку, чей id уже в data, и когда приложение отрисовало data раньше разбора ответа', async () => {
    for (const early of [false, true]) {
      earlyFrame = -1
      mount(createElement(ClientHost, { early }))
      const id = addRow()
      const at = table.getRowSource().indexOf(id)
      act(() => applyAllDrafts(table))
      await afterTask()
      if (early) expect(earlyFrame, 'ранний рендер').toBe(1)
      expect(rowsWith(id), String(early)).toHaveLength(1)
      expect(table.getRowSource().indexOf(id)).toBe(at)
      expect(table.getRowSource().count()).toBe(ROWS.length + 1)
      // Отметку снимает итог пакета: он приходит позже записи в данные.
      await vi.waitFor(() => expect(rowDraftMarkOf(table, id)).toBeUndefined())
      expect(readDrafts(table)).toEqual([])
      act(() => root!.unmount())
      root = undefined
    }
  })

  it('NI3: серверная модель — черновик новой строки держится до записи сохранённой строки в кэш, строка не пропадает из источника между ответом и записью; приход строки не вспыхивает «пришла» и не объявляется', async () => {
    await mountServer()
    const say = vi.fn()
    registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
    const id = addRow()
    const at = table.getRowSource().indexOf(id)
    act(() => applyAllDrafts(table))
    // Ответ разобран, строки в кэше ещё нет: строка на месте, черновик держится.
    expect(table.getRowSource().indexOf(id)).toBe(at)
    expect(readDrafts(table).map(draft => draft.kind)).toEqual(['rowInsert'])
    for (let i = 0; i < 50 && readDrafts(table).length > 0; i++)
      await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    // Строка легла в кэш: черновик снят, строка одна на том же месте, без «пришла».
    expect(readDrafts(table)).toEqual([])
    expect(rowsWith(id)).toHaveLength(1)
    expect(table.getRowSource().indexOf(id)).toBe(at)
    expect(readFlashes(table)[rowHighlightKey(id)]?.outcome).toBe('accepted')
    expect(say).not.toHaveBeenCalledWith(
      serverRowModelLabels(ENGLISH_LABELS).announceRowsAdded(1),
    )
  })

  it('NI4: сохранённая новая строка под другим id — предупреждение в разработке с обоими id; с тем же id — без предупреждения', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      mount(createElement(ClientHost))
      addRow()
      act(() => applyAllDrafts(table))
      await flush()
      expect(warn.mock.calls.flat().join(' ')).not.toContain('saved new row')
      act(() => root!.unmount())
      root = undefined

      const other = (batch: CellEditBatch) => ({
        saved: (batch.inserts ?? []).map(item => ({
          rowId: item.rowId,
          row: { ...item.values, id: 'db-42' },
        })),
      })
      mount(createElement(ClientHost, { answer: other }))
      const id = addRow()
      act(() => applyAllDrafts(table))
      await flush()
      const text = warn.mock.calls.flat().join(' ')
      expect(text).toContain('db-42')
      expect(text).toContain(id)
    } finally {
      warn.mockRestore()
    }
  })
})
