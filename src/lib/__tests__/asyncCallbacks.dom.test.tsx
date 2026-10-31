// @vitest-environment happy-dom
/**
 * Асинхронный контракт бизнес-колбэков (ADR 0041, AS1, AS4, AS7–AS10, AS12): промис от
 * `onCellEdit` отделяет ячейку в ожидание, отказ переводит её в «ошибку» с
 * черновиком; поздний итог снятого ожидания игнорируется. Отметки сохранения
 * (ADR 0057, CF7). Света по периметру ячейки нет — ожидание и отказ на кнопке правки
 * (ADR 0127, IR21).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Fragment, act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TesseraFeatureEntry } from '../core/features'
import { useCreateTable } from '../core/useCreateTable'
import { cellEditing, rowExpanding } from '../plugins'
import { readFlashes } from '../core/flashes/flashFeature'
import { targetKey } from '../core/highlights/highlightFeature'
import {
  commitEditSession,
  startEditSession,
} from '../plugins/cellEditing/session'
import { toggleRowExpanded } from '../plugins/rowExpanding/toggleRowExpanded'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const rows = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
]

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
  plugins: TesseraFeatureEntry[]
  data?: { id: string; name: string; subRows?: unknown[] }[]
  probe?: boolean
}

const Host = ({ plugins, data = rows, probe = false }: HostProps) => {
  captured = useCreateTable({ columns: columns as never, data, plugins })
  if (!probe) {
    return null
  }
  const cell = captured.getRow('1').getAllCells()[0]
  const slots = captured.getRenderSlots()
  const own = (entries: { id: string; component: never }[]) =>
    entries.find(entry => entry.id === 'cellEditing')!.component
  // Содержимое ячейки и кнопка правки — носитель ожидания и отказа (ADR 0127, §6).
  return createElement(
    Fragment,
    null,
    createElement(own(slots.cellSlot), {
      ...cell.getContext(),
      content: 'content',
    }),
    createElement(own(slots.rightCellSlot), cell.getContext()),
  )
}

const render = (props: HostProps) => {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => root!.render(createElement(Host, props)))
}

const state = () => captured.atoms['plugin:cellEditing'].get()
const busy = () => container!.querySelector('button[aria-busy="true"]')
/** Описание отметки отказа на кнопке правки. */
const failed = () => {
  const ids = container!
    .querySelector('button[aria-describedby]')
    ?.getAttribute('aria-describedby')
  return ids ? document.getElementById(ids.split(' ')[0]!) : null
}

/** Открыть правку первой ячейки и сохранить `value` через Enter. */
const editAndCommit = (value: string) => {
  act(() => startEditSession(captured, captured.getRow('1'), { id: 'name' }))
  const input = container!.querySelector('input')!
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
  })
}

/** Промис, итог которого задаёт тест. */
const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const flush = () => act(async () => {})

describe('асинхронный контракт бизнес-колбэков', () => {
  it('AS1: onCellEdit и onExpandRow, вернувшие не промис, работают как раньше', () => {
    const onCellEdit = vi.fn(() => undefined)
    render({ plugins: [cellEditing({ onCellEdit })], probe: true })
    editAndCommit('new')
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'new' }),
    )
    expect(state()).toEqual({ active: null, submitted: {} })
    expect(busy()).toBeNull()
    expect(container!.textContent).toBe('content')
    act(() => root!.unmount())
    root = undefined

    const onExpandRow = vi.fn(() => 42 as unknown as void)
    const tree = [{ id: 'p', name: 'P', subRows: [{ id: 'c', name: 'C' }] }]
    render({ plugins: [rowExpanding({ onExpandRow })], data: tree })
    act(() => toggleRowExpanded(captured.getRow('p'), { onExpandRow }))
    expect(onExpandRow).toHaveBeenCalledTimes(1)
    expect(captured.getRow('p').getIsExpanded()).toBe(true)
  })

  it('AS4: промис выполнен — ожидание снято, колбэки отмены не зовутся', async () => {
    const save = deferred()
    const onEditCancel = vi.fn()
    render({
      plugins: [cellEditing({ onCellEdit: () => save.promise, onEditCancel })],
      probe: true,
    })
    editAndCommit('new')
    expect(Object.values(state().submitted)).toEqual([
      expect.objectContaining({ status: 'pending', draft: 'new' }),
    ])

    save.resolve()
    await flush()
    expect(state()).toEqual({ active: null, submitted: {} })
    expect(busy()).toBeNull()
    expect(onEditCancel).not.toHaveBeenCalled()
  })

  it('AS8: ожидание и ошибка переживают размонтирование ячейки', async () => {
    const save = deferred()
    const plugins = [cellEditing({ onCellEdit: () => save.promise })]
    render({ plugins, probe: true })
    editAndCommit('kept')
    expect(busy()).not.toBeNull()
    expect(container!.textContent).toBe('kept')

    render({ plugins, probe: false })
    expect(busy()).toBeNull()
    render({ plugins, probe: true })
    expect(busy()).not.toBeNull()
    expect(container!.textContent).toBe('kept')

    save.reject(new Error('down'))
    await flush()
    render({ plugins, probe: false })
    expect(failed()).toBeNull()
    render({ plugins, probe: true })
    expect(failed()?.textContent).toContain('down')
    expect(Object.values(state().submitted)).toEqual([
      expect.objectContaining({ status: 'error', draft: 'kept' }),
    ])
  })

  it('AS9: строка ушла из данных — ожидание и ошибка сняты, у ошибки onEditCancel с unavailable; плагин выключен — то же с revoke; поздний итог промиса игнорируется', async () => {
    const save = deferred()
    const plugins = [cellEditing({ onCellEdit: () => save.promise })]
    render({ plugins, probe: true })
    editAndCommit('new')
    render({ plugins, data: rows.filter(row => row.id !== '1') })
    expect(state().submitted).toEqual({})

    save.reject(new Error('late'))
    await flush()
    expect(state()).toEqual({ active: null, submitted: {} })
    act(() => root!.unmount())
    root = undefined

    const second = deferred()
    render({
      plugins: [cellEditing({ onCellEdit: () => second.promise })],
      probe: true,
    })
    editAndCommit('new')
    render({
      plugins: [
        cellEditing({ enabled: false, onCellEdit: () => second.promise }),
      ],
    })
    expect(state().submitted).toEqual({})
    second.resolve()
    await flush()
    expect(state().submitted).toEqual({})
    act(() => root!.unmount())
    root = undefined

    // «Ошибка» при уходе строки и выключении плагина отдаёт черновик.
    const onEditCancel = vi.fn()
    const toError = async (extra: object) => {
      const save = deferred()
      const plugins = [
        cellEditing({ onCellEdit: () => save.promise, onEditCancel, ...extra }),
      ]
      render({ plugins, probe: true })
      editAndCommit('lost?')
      save.reject(new Error('down'))
      await flush()
    }
    await toError({})
    render({
      plugins: [cellEditing({ onEditCancel })],
      data: rows.filter(row => row.id !== '1'),
    })
    expect(state().submitted).toEqual({})
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'unavailable',
        draft: 'lost?',
        error: 'down',
      }),
    )
    act(() => root!.unmount())
    root = undefined

    await toError({})
    render({ plugins: [cellEditing({ enabled: false, onEditCancel })] })
    expect(state().submitted).toEqual({})
    expect(onEditCancel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'revoke',
        draft: 'lost?',
        error: 'down',
      }),
    )
  })

  it('AS7: Escape в редакторе, открытом из «ошибки», снимает ошибку и зовёт onEditCancel с cancel, черновиком и error', async () => {
    const save = deferred()
    const onEditCancel = vi.fn()
    const plugins = [
      cellEditing({ onCellEdit: () => save.promise, onEditCancel }),
    ]
    render({ plugins, probe: true })
    editAndCommit('draft')
    save.reject(new Error('down'))
    await flush()
    expect(failed()).not.toBeNull()

    act(() => startEditSession(captured, captured.getRow('1'), { id: 'name' }))
    const input = container!.querySelector('input')!
    expect(input.value).toBe('draft')
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(state()).toEqual({ active: null, submitted: {} })
    expect(failed()).toBeNull()
    expect(onEditCancel).toHaveBeenCalledTimes(1)
    expect(onEditCancel).toHaveBeenCalledWith({
      rowId: '1',
      columnId: 'name',
      reason: 'cancel',
      draft: 'draft',
      original: 'A',
      error: 'down',
    })
  })

  it('AS10: текст ошибки — Error.message, строка как есть, иначе подпись saveFailed', async () => {
    const errorOf = async (reason: unknown) => {
      const save = deferred()
      render({
        plugins: [cellEditing({ onCellEdit: () => save.promise })],
        probe: true,
      })
      editAndCommit('draft')
      save.reject(reason)
      await flush()
      const text = (Object.values(state().submitted)[0] as { error: string })
        .error
      act(() => root!.unmount())
      root = undefined
      return text
    }
    expect(await errorOf(new Error('from error'))).toBe('from error')
    expect(await errorOf('from string')).toBe('from string')
    expect(await errorOf({ code: 500 })).toBe("Couldn't save")
    expect(await errorOf(new Error(''))).toBe("Couldn't save")
  })

  it('AS12: промис onExpandRow отклонён — строка свёрнута обратно; выполнен — остаётся раскрытой', async () => {
    const tree = [{ id: 'p', name: 'P', subRows: [{ id: 'c', name: 'C' }] }]
    const expandWith = async (outcome: 'resolve' | 'reject') => {
      const load = deferred()
      const hooks = { onExpandRow: () => load.promise }
      render({ plugins: [rowExpanding(hooks)], data: tree })
      act(() => toggleRowExpanded(captured.getRow('p'), hooks))
      expect(captured.getRow('p').getIsExpanded()).toBe(true)
      expect(captured.getRow('p').getIsExpandPending()).toBe(true)
      if (outcome === 'resolve') {
        load.resolve()
      } else {
        load.reject(new Error('down'))
      }
      await flush()
      const row = captured.getRow('p')
      const result = [row.getIsExpanded(), row.getIsExpandPending()]
      act(() => root!.unmount())
      root = undefined
      return result
    }
    expect(await expandWith('reject')).toEqual([false, false])
    expect(await expandWith('resolve')).toEqual([true, false])
  })

  it('CF7: итог сохранения с промисом — вспышка ячейки в срезе вспышек ядра: успех — accepted, отказ — reverted; своего среза отметок у плагина нет', async () => {
    const answers: Array<() => Promise<void>> = [
      () => Promise.resolve(),
      () => Promise.reject(new Error('down')),
    ]
    const onCellEdit = () => answers.shift()!()
    const save = (rowId: string) => {
      act(() =>
        startEditSession(captured, captured.getRow(rowId), { id: 'name' }),
      )
      act(() =>
        commitEditSession(
          captured,
          { rowId, columnId: 'name' },
          `edited-${rowId}`,
          { onCellEdit },
        ),
      )
    }
    const outcomeOf = (rowId: string) =>
      readFlashes(captured)[targetKey({ cell: [rowId, 'name'] })]?.outcome
    render({ plugins: [cellEditing({ onCellEdit })] })
    save('1')
    save('2')
    await act(async () => {})
    expect(outcomeOf('1')).toBe('accepted')
    expect(outcomeOf('2')).toBe('reverted')
    expect(Object.keys(captured.store.get())).not.toContain('cellSaved')
  })
})

describe('ожидание и отказ у кнопки правки (ADR 0127)', () => {
  it('IR21: света по периметру ячейки нет — у ячейки в ожидании и после отказа нет слоя света, токенов --tsr-comp-cell-pending-glow-* в теме нет', async () => {
    const save = deferred()
    render({
      plugins: [cellEditing({ onCellEdit: () => save.promise })],
      probe: true,
    })
    editAndCommit('new')
    expect(busy()).not.toBeNull()
    expect(container!.querySelector('.cell-edit-feedback')).toBeNull()

    save.reject(new Error('down'))
    await flush()
    expect(failed()?.textContent).toContain('down')
    expect(container!.querySelector('.cell-edit-feedback')).toBeNull()

    const theme = readFileSync(
      join(process.cwd(), 'src/lib/ui/theme/theme.css'),
      'utf8',
    )
    expect(theme).not.toMatch(/--tsr-comp-cell-pending-glow-/)
  })
})
