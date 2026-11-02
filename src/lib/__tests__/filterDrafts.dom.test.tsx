// @vitest-environment happy-dom
/**
 * Черновик условия фильтра (ADR 0178, §2; DR4, DR5, DR8): запись реестра вида `columnFilter`,
 * её жизнь, отказ и отмена запроса, клиентский режим.
 * Запуск: npx vitest run --config vitest.node.config.ts filterDrafts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { activeDrafts, applyDraft, type Draft } from '../core/drafts/drafts'
import { cancelServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import { columnFiltering } from '../plugins'
import { storeFilterDraft } from '../plugins/columnFiltering/filterDraft'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string }

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Row[] = [
  { id: '1', name: 'Ann' },
  { id: '2', name: 'Bob' },
]

const BOB = { operator: 'contains', value: 'Bob' }
const ANN = { operator: 'contains', value: 'Ann' }

let captured: any
let root: Root | undefined
let container: HTMLElement | undefined
let answer: () => Promise<void> = () => Promise.resolve()

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.restoreAllMocks()
})

const Host = ({ server }: { server: boolean }) => {
  captured = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: Row) => row.id,
    dataMode: { filtering: server ? 'server' : 'client' },
    plugins: [columnFiltering({ onFilterChange: () => answer() })],
  } as never)
  return null
}

const mount = (server = true) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(createElement(Host, { server })))
}

const draftOfName = (): Draft | undefined =>
  captured
    .getDrafts()
    .find(
      (draft: Draft) =>
        draft.kind === 'columnFilter' &&
        'column' in draft.target &&
        draft.target.column === 'name',
    )
const applied = () =>
  (captured.atoms.columnFilters.get() as { id: string; value: unknown }[]).find(
    (filter: { id: string }) => filter.id === 'name',
  )?.value
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

describe('черновик условия фильтра (ADR 0178)', () => {
  it('DR4: черновик условия фильтра в серверном режиме — запись вида columnFilter с целью «колонка»; жизнь черновика — прежняя (ADR 0154, FD5–FD6); отказ и отмена запроса возвращают срез фильтров к подтверждённому, а отказанное условие кладут черновиком', async () => {
    mount()
    // Набранное условие — запись реестра с целью «колонка».
    act(() => storeFilterDraft(captured, 'name', BOB))
    expect(draftOfName()).toEqual({
      kind: 'columnFilter',
      target: { column: 'name' },
      value: BOB,
    })

    // Отказ: срез — к подтверждённому (фильтра нет), условие — снова черновик.
    answer = () => Promise.reject(new Error('refused'))
    act(() => void applyDraft(captured, draftOfName()!))
    expect(applied()).toEqual(BOB)
    await flush()
    expect(applied()).toBeUndefined()
    expect(draftOfName()?.value).toEqual(BOB)

    // Отмена: так же — срез к подтверждённому, условие — черновик.
    answer = () => new Promise(() => {})
    act(() => void applyDraft(captured, draftOfName()!))
    expect(applied()).toEqual(BOB)
    act(() => cancelServerAction(captured, 'user' as never))
    await flush()
    expect(applied()).toBeUndefined()
    expect(draftOfName()?.value).toEqual(BOB)

    // Ответ сервера: условие действует, черновика нет.
    answer = () => Promise.resolve()
    act(() => void applyDraft(captured, draftOfName()!))
    await flush()
    expect(applied()).toEqual(BOB)
    expect(draftOfName()).toBeUndefined()

    // Смена фильтра колонки снаружи забывает черновик (FD6).
    act(() => storeFilterDraft(captured, 'name', ANN))
    expect(draftOfName()?.value).toEqual(ANN)
    act(() => captured.setColumnFilters([]))
    expect(draftOfName()).toBeUndefined()
  })

  it('DR5: черновик фильтра есть, только когда условие отличается от действующего, в том числе пустое при действующем фильтре; совпавшее условие снимает запись; срез меняется на каждую правку', async () => {
    mount()
    const changes: unknown[] = []
    const atom = captured.atoms['plugin:drafts']
    const subscription = atom.subscribe(() => changes.push(atom.get()))

    // Без действующего фильтра пустое условие — не черновик.
    act(() => storeFilterDraft(captured, 'name', undefined))
    expect(draftOfName()).toBeUndefined()

    act(() => storeFilterDraft(captured, 'name', { ...BOB, value: 'B' }))
    act(() => storeFilterDraft(captured, 'name', { ...BOB, value: 'Bo' }))
    act(() => storeFilterDraft(captured, 'name', BOB))
    expect(changes).toHaveLength(3)
    expect(draftOfName()?.value).toEqual(BOB)

    // Действует BOB: то же условие снимает запись, пустое — черновик «снять фильтр».
    act(() => void applyDraft(captured, draftOfName()!))
    await flush()
    act(() => storeFilterDraft(captured, 'name', ANN))
    expect(draftOfName()?.value).toEqual(ANN)
    act(() => storeFilterDraft(captured, 'name', BOB))
    expect(draftOfName()).toBeUndefined()
    act(() => storeFilterDraft(captured, 'name', { ...BOB, value: '' }))
    expect(draftOfName()?.value).toBeNull()
    subscription.unsubscribe()
  })

  it('DR8: в клиентском режиме черновиков фильтра нет; черновик фильтра от приложения инертен, в разработке — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(false)
    act(() =>
      captured.setDraft({
        kind: 'columnFilter',
        target: { column: 'name' },
        value: BOB,
      }),
    )
    expect(captured.getDrafts()).toHaveLength(1)
    expect(activeDrafts(captured)).toEqual([])
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes('"columnFilter"'),
      ),
    ).toBe(true)
  })
})
