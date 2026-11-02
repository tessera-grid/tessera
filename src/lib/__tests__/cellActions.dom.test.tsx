// @vitest-environment happy-dom
/**
 * Ожидание и итог действия на ячейке (ADR 0176; AC1, AC3, AC4): `table.trackCellAction`
 * ставит ожидание на цель и снимает итогом, отказ — вспышкой и объявлением, хук
 * `useCellPending` перерисовывает только свою ячейку.
 * Запуск: npx vitest run --config vitest.node.config.ts cellActions
 */
import { act, createElement, memo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import { readFlashes } from '../core/flashes/flashFeature'
import { readActionStatus } from '../core/headerActions/actionStatusFeature'
import { cellPendingOf } from '../core/headerActions/actionStatus'
import { cellHighlightKey } from '../core/highlights/highlightFeature'
import { ENGLISH_LABELS } from '../core/localization/resolveLabels'
import { useCreateTable } from '../core/useCreateTable'
import { useCellPending } from '../../index'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const ROWS = ['r1', 'r2'].map(id => ({ id, a: id, b: id }))
const columns = ['a', 'b'].map(id => ({ id, accessorKey: id }))

let captured: any
let root: Root | undefined
const renders: Record<string, number> = {}
const pendingSeen: Record<string, unknown> = {}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  captured = undefined
  for (const key of Object.keys(renders)) delete renders[key]
})

// Хост перерисовывается с таблицей: свой рендер у пробы — только от её подписки.
const Probe = memo(({ table, rowId }: { table: unknown; rowId: string }) => {
  const pending = useCellPending(table, rowId, 'a')
  renders[rowId] = (renders[rowId] ?? 0) + 1
  pendingSeen[rowId] = pending
  return null
})

const Host = () => {
  captured = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: [],
  } as never)
  // Таблица первого рендера: тот же store, проба не получает новых пропсов.
  const [table] = useState(captured)
  return createElement(
    'div',
    null,
    createElement(Probe, { table, rowId: 'r1' }),
    createElement(Probe, { table, rowId: 'r2' }),
  )
}

const mount = () => {
  root = createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host)))
}

const deferred = () => {
  let resolve!: (value: string) => void
  let reject!: (error: Error) => void
  const promise = new Promise<string>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const pendingOf = (rowId: string, columnId = 'a') =>
  cellPendingOf(captured, readActionStatus(captured), rowId, columnId)
const flashOf = (rowId: string, columnId = 'a') =>
  readFlashes(captured)[cellHighlightKey(rowId, columnId)]?.outcome

const said: string[] = []
const listen = () => {
  said.length = 0
  registerAnnouncer(captured, {
    say: message => said.push(message),
    labels: ENGLISH_LABELS,
  })
}

describe('trackCellAction (ADR 0176)', () => {
  it('AC1: table.trackCellAction(target, promise, options) — пока промис ждёт, ячейки цели несут ожидание; итог снимает его; вызов возвращает тот же промис', async () => {
    mount()
    const save = deferred()
    let tracked!: Promise<string>
    act(() => {
      tracked = captured.trackCellAction({ cell: ['r1', 'a'] }, save.promise)
    })
    expect(pendingOf('r1')).toBe('wave')
    expect(pendingOf('r1', 'b')).toBeUndefined()
    expect(pendingOf('r2')).toBeUndefined()

    // `indicator: 'control'` — ожидание без волны.
    const control = deferred()
    act(() => {
      captured.trackCellAction({ row: 'r2' }, control.promise, {
        indicator: 'control',
      })
    })
    expect(pendingOf('r2')).toBe('busy')
    expect(pendingOf('r2', 'b')).toBe('busy')

    await act(async () => {
      save.resolve('saved')
      control.resolve('ok')
      await tracked
    })
    await expect(tracked).resolves.toBe('saved')
    expect(pendingOf('r1')).toBeUndefined()
    expect(pendingOf('r2')).toBeUndefined()
    expect(readActionStatus(captured) ?? {}).toEqual({})

    // Не промис — без ожидания, вызов отдаёт промис значения.
    let plain!: Promise<number>
    act(() => {
      plain = captured.trackCellAction({ cell: ['r1', 'a'] }, 7)
    })
    expect(pendingOf('r1')).toBeUndefined()
    await expect(plain).resolves.toBe(7)
  })

  it('AC3: отказ — вспышка reverted на цели и объявление с именем label и причиной; успех без вспышки, flashOnSuccess — вспышка accepted', async () => {
    mount()
    listen()
    const refused = deferred()
    let tracked!: Promise<string>
    act(() => {
      tracked = captured.trackCellAction(
        { cell: ['r1', 'a'] },
        refused.promise,
        {
          label: 'Publish',
        },
      )
    })
    await act(async () => {
      refused.reject(new Error('Server down'))
      await tracked.catch(() => {})
    })
    await expect(tracked).rejects.toThrow('Server down')
    expect(flashOf('r1')).toBe('reverted')
    expect(said).toContain(
      ENGLISH_LABELS.announceActionFailed('Publish', 'Server down'),
    )

    // Успех без `flashOnSuccess` — без вспышки.
    const quiet = deferred()
    await act(async () => {
      const done = captured.trackCellAction(
        { cell: ['r2', 'a'] },
        quiet.promise,
      )
      quiet.resolve('ok')
      await done
    })
    expect(flashOf('r2')).toBeUndefined()

    const loud = deferred()
    await act(async () => {
      const done = captured.trackCellAction(
        { cell: ['r2', 'b'] },
        loud.promise,
        {
          flashOnSuccess: true,
          label: 'Publish',
        },
      )
      loud.resolve('ok')
      await done
    })
    expect(flashOf('r2', 'b')).toBe('accepted')
    expect(said).toContain(ENGLISH_LABELS.announceActionDone('Publish'))
  })

  it('AC4: useCellPending(table, rowId, columnId) отдаёт ожидание ячейки и перерисовывает только её', async () => {
    mount()
    const r2Before = renders.r2!
    const save = deferred()
    act(() => {
      captured.trackCellAction({ cell: ['r1', 'a'] }, save.promise, {
        indicator: 'control',
      })
    })
    expect(pendingSeen.r1).toBe('busy')
    expect(pendingSeen.r2).toBeUndefined()
    expect(renders.r2).toBe(r2Before)
    await act(async () => {
      save.resolve('ok')
      await save.promise
    })
    expect(pendingSeen.r1).toBeUndefined()
    expect(renders.r2).toBe(r2Before)
  })
})
