import axe from 'axe-core'
import { useState } from 'react'
import { server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { DEFAULT_LABELS } from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  keyboardNavigation,
  pagination,
  rowDragging,
  rowExpanding,
} from '../../../plugins'
import type { RowDragEnd } from '../../../plugins'
import type { Row } from '../../../types'
import { settleRowMotion } from '../helpers'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import {
  HANDLE,
  container,
  depthOf,
  dragOver,
  nextFrame,
  pointer,
  release,
  rowById,
  rowsInOrder,
  settleSlotAfter,
  sleep,
  slot,
} from './row-drop-helpers'

// Перенос строк в ленивом дереве (ADR 0112): дети групп — ответ `loadChildren`, перенос
// ждёт промиса `onRowDragEnd`. Промисами загрузки и переноса управляет тест; порядок
// данных приложения виден через `onRowOrderChange`. Перетаскивание — настоящей мышью.

type Node = {
  id: string
  country: string
  name: string
  childCount?: number
  subRows?: Node[]
}

const node = (id: string, childCount = 0, subRows?: Node[]): Node => ({
  id,
  country: id,
  name: `Name ${id}`,
  ...(childCount ? { childCount } : {}),
  ...(subRows ? { subRows } : {}),
})

/** Дети ленивых групп на «сервере». */
const SERVER: Record<string, Node[]> = {
  'node-0': [node('node-0-0'), node('node-0-1', 2), node('node-0-2')],
  'node-0-1': [node('node-0-1-0'), node('node-0-1-1')],
  'node-1': [node('node-1-0'), node('node-1-1')],
}

const ROOTS: Node[] = [
  node('node-0', 3),
  node('node-1', 2),
  node('group-0', 0, [node('group-0-0'), node('group-0-1')]),
  node('row-0'),
  node('row-1'),
  node('row-2'),
]

const COLUMNS = [
  { id: 'country', accessorKey: 'country', header: 'Country', size: 220 },
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
]

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

interface Options {
  asyncLoad?: boolean
  asyncMove?: boolean
  keyboard?: boolean
  pageSize?: number
  /** Листовые корни в конце данных — для прокрутки. */
  extraRoots?: number
}

interface Harness {
  options: Options
  onRowDragEnd: ReturnType<
    typeof vi.fn<(end: RowDragEnd) => void | Promise<void>>
  >
  onRowOrderChange: ReturnType<typeof vi.fn<(updater: unknown) => void>>
  loads: { rowId: string; answer: Deferred<Node[]> }[]
  moves: Deferred<void>[]
  setData: (update: (prev: Node[]) => Node[]) => void
  setLoadedChildren: (rowId: string, update: (prev: Node[]) => Node[]) => void
}

let harness: Harness

const LazyTree = ({ roots }: { roots: Node[] }) => {
  const [data, setData] = useState(roots)
  harness.setData = setData
  const { options } = harness
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Node) => row.id,
    handlers: {
      onRowOrderChange: (updater: (prev: Node[]) => Node[]) => {
        harness.onRowOrderChange(updater)
        setData(updater)
      },
    },
    plugins: [
      rowExpanding({
        maxDepth: 2,
        hasChildren: (row: Row<any, any>) =>
          ((row.original as Node).childCount ?? 0) > 0,
        loadChildren: (row: Row<any, any>) => {
          if (!harness.options.asyncLoad) return SERVER[row.id] ?? []
          const answer = deferred<Node[]>()
          harness.loads.push({ rowId: row.id, answer })
          return answer.promise
        },
      }),
      rowDragging({ onRowDragEnd: harness.onRowDragEnd }),
      ...(options.keyboard ? [keyboardNavigation()] : []),
      ...(options.pageSize
        ? [pagination({ initialPageSize: options.pageSize })]
        : []),
    ],
  } as never)
  harness.setLoadedChildren = (rowId, update) =>
    (
      table as unknown as {
        setLoadedChildren: (id: string, u: (prev: Node[]) => Node[]) => void
      }
    ).setLoadedChildren(rowId, update)
  return (
    <div style={{ height: 640 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const renderTree = async (options: Options = {}) => {
  harness = {
    options,
    onRowDragEnd: vi.fn((_end: RowDragEnd): void | Promise<void> => {
      if (!harness.options.asyncMove) return undefined
      const move = deferred<void>()
      harness.moves.push(move)
      return move.promise
    }),
    onRowOrderChange: vi.fn(),
    loads: [],
    moves: [],
    setData: () => {},
    setLoadedChildren: () => {},
  }
  const roots = [
    ...ROOTS,
    ...Array.from({ length: options.extraRoots ?? 0 }, (_, i) =>
      node(`leaf-${i}`),
    ),
  ]
  const screen = await render(<LazyTree roots={roots} />)
  await expect.poll(() => rowById('row-2')).not.toBeNull()
  return screen
}

const order = () => rowsInOrder().map(row => row.dataset.rowId)
const toggleOf = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>('.row-expand-button')!
const handleOf = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>(HANDLE)!
const announced = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(region => region.textContent)
    .join('|')

const expand = async (id: string, child: string) => {
  await userEvent.click(toggleOf(id))
  await expect.poll(() => rowById(child)).not.toBeNull()
  await settleRowMotion()
}

/** Бросить строку `id` сразу после `prevId` на уровне `depth`. */
const dropAfter = async (
  id: string,
  prevId: string,
  depth: number,
  overId = prevId,
) => {
  const { at } = await dragOver(id, overId, depth)
  await settleSlotAfter(prevId, at)
  await release()
}

/** Выполнить промисы переноса, ждущие сейчас. */
const settleMoves = async (ok = true, reason?: unknown) => {
  for (const move of harness.moves.splice(0)) {
    if (ok) move.resolve()
    else move.reject(reason)
  }
  await settleRowMotion()
}

const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    item => item.textContent?.trim() === label,
  )!

const fromHandleMenu = async (id: string, label: string) => {
  await userEvent.hover(rowById(id)!)
  await userEvent.click(handleOf(id))
  await expect.poll(menu).toBeTruthy()
  await userEvent.click(menuItem(label))
  await expect.poll(menu).toBeNull()
  await settleRowMotion()
}

const lastEnd = () => harness.onRowDragEnd.mock.lastCall?.[0]

describe('Перенос строк в ленивом дереве (ADR 0112)', () => {
  test('LT1: onRowDragEnd получает parentId, previousParentId и index после переноса — при броске мышью, с клавиатуры и из пунктов меню ручки «вверх», «вниз», «вложить», «вынести»', async () => {
    const screen = await renderTree({ keyboard: true })
    try {
      await dropAfter('row-2', 'group-0', 0, 'row-0')
      expect(lastEnd(), 'мышь').toEqual(
        expect.objectContaining({
          rowId: 'row-2',
          parentId: undefined,
          previousParentId: undefined,
          index: 3,
        }),
      )

      rowById('row-1')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}')
      await expect.poll(() => lastEnd()?.rowId).toBe('row-1')
      expect(lastEnd(), 'клавиатура').toEqual(
        expect.objectContaining({
          parentId: undefined,
          previousParentId: undefined,
          index: 4,
        }),
      )
      await settleRowMotion()

      await fromHandleMenu('row-2', DEFAULT_LABELS.indentRow)
      expect(lastEnd(), 'вложить').toEqual(
        expect.objectContaining({
          rowId: 'row-2',
          parentId: 'group-0',
          previousParentId: undefined,
          index: 2,
        }),
      )
      await fromHandleMenu('row-2', DEFAULT_LABELS.outdentRow)
      expect(lastEnd(), 'вынести').toEqual(
        expect.objectContaining({
          rowId: 'row-2',
          parentId: undefined,
          previousParentId: 'group-0',
          index: 3,
        }),
      )
      await fromHandleMenu('row-2', DEFAULT_LABELS.moveDown)
      expect(lastEnd(), 'вниз').toEqual(
        expect.objectContaining({
          rowId: 'row-2',
          parentId: undefined,
          index: 4,
        }),
      )
      await fromHandleMenu('row-2', DEFAULT_LABELS.moveUp)
      expect(lastEnd(), 'вверх').toEqual(
        expect.objectContaining({
          rowId: 'row-2',
          parentId: undefined,
          index: 3,
        }),
      )
    } finally {
      await screen.unmount()
    }
  })

  test('LT2: ленивый перенос сразу показывает строку на новом месте, а данные и ответы не меняются, пока промис не выполнен; обычный перенос пишется через onRowOrderChange сразу', async () => {
    const screen = await renderTree({ asyncMove: true })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      expect(order()).toEqual([
        'node-0',
        'node-0-1',
        'node-0-2',
        'node-1',
        'group-0',
        'row-0',
        'node-0-0',
        'row-1',
        'row-2',
      ])
      expect(depthOf(rowById('node-0-0')!)).toBe(0)
      expect(harness.onRowOrderChange).not.toHaveBeenCalled()
      // Ничего не записано: отказ возвращает строку в ответ группы.
      await settleMoves(false, new Error('no'))
      await expect
        .poll(order)
        .toEqual([
          'node-0',
          'node-0-0',
          'node-0-1',
          'node-0-2',
          'node-1',
          'group-0',
          'row-0',
          'row-1',
          'row-2',
        ])
      expect(harness.onRowOrderChange).not.toHaveBeenCalled()

      await dropAfter('row-2', 'group-0', 0, 'row-0')
      expect(harness.onRowOrderChange, 'обычный перенос').toHaveBeenCalledTimes(
        1,
      )
      expect(order().slice(-4)).toEqual(['group-0', 'row-2', 'row-0', 'row-1'])
      await settleMoves()
    } finally {
      await screen.unmount()
    }
  })

  test('LT3: успех ленивого переноса — грид убирает строку из старого ответа, ставит в новое место, часть в данных пишет через onRowOrderChange; строка не прыгает ни в одном кадре', async () => {
    const screen = await renderTree({ asyncMove: true })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      const placed = order().join()
      const frames: string[] = []
      let sampling = true
      const sample = () => {
        if (!sampling) return
        const row = rowById('node-0-0')
        frames.push(row ? `${order().join()} @${depthOf(row)}` : 'gone')
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
      await sleep(50)
      await settleMoves()
      await expect
        .poll(() => rowById('node-0-0')?.hasAttribute('aria-busy'))
        .toBe(false)
      for (let i = 0; i < 10; i++) await nextFrame()
      sampling = false
      expect(new Set(frames)).toEqual(new Set([`${placed} @0`]))

      expect(harness.onRowOrderChange).toHaveBeenCalledTimes(1)
      const write = harness.onRowOrderChange.mock.calls[0]![0] as (
        prev: Node[],
      ) => Node[]
      expect(write(ROOTS).map(row => row.id)).toEqual([
        'node-0',
        'node-1',
        'group-0',
        'row-0',
        'node-0-0',
        'row-1',
        'row-2',
      ])
      // Сохранённый ответ группы — уже без строки: он показывается сразу, пока идёт загрузка.
      harness.options.asyncLoad = true
      await userEvent.click(toggleOf('node-0'))
      await expect.poll(() => rowById('node-0-1')).toBeNull()
      await userEvent.click(toggleOf('node-0'))
      await expect.poll(() => rowById('node-0-1')).not.toBeNull()
      expect(order().slice(0, 3)).toEqual(['node-0', 'node-0-1', 'node-0-2'])
      expect(order().filter(id => id === 'node-0-0')).toHaveLength(1)
    } finally {
      await screen.unmount()
    }
  })

  test('LT5: пока промис onRowDragEnd не выполнен — у ленивого и обычного переноса — ручка строки ждёт, у строки aria-busy, строку не переносят ни ручкой, ни меню, ни с клавиатуры; другие строки переносятся', async () => {
    const screen = await renderTree({ asyncMove: true, keyboard: true })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      await dropAfter('row-2', 'group-0', 0, 'row-0')
      // Обычный перенос, пока ленивый ждёт: строки стадии нет в данных.
      expect(order().slice(3)).toEqual([
        'node-1',
        'group-0',
        'row-2',
        'row-0',
        'node-0-0',
        'row-1',
      ])
      for (const id of ['node-0-0', 'row-2']) {
        expect(handleOf(id).getAttribute('aria-busy'), id).toBe('true')
        expect(rowById(id)!.getAttribute('aria-busy'), id).toBe('true')
      }
      // Ручка не тянется.
      await userEvent.hover(rowById('row-2')!)
      const handle = handleOf('row-2').getBoundingClientRect()
      const from = { x: handle.left + handle.width / 2, y: handle.top + 8 }
      await pointer.realDragHold(from, { x: from.x, y: from.y + 120 })
      await sleep(150)
      expect(slot(), 'тянется').toBeNull()
      await pointer.realMouseUp()
      // Меню не открывается.
      await userEvent.click(handleOf('row-2'), { force: true })
      await sleep(150)
      expect(menu(), 'меню').toBeNull()
      // С клавиатуры не переставляется.
      const calls = harness.onRowDragEnd.mock.calls.length
      rowById('row-2')!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
      await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
      await sleep(100)
      expect(harness.onRowDragEnd, 'клавиатура').toHaveBeenCalledTimes(calls)
      // Другая строка переносится.
      await dropAfter('row-1', 'node-1', 0, 'group-0')
      expect(harness.onRowDragEnd).toHaveBeenCalledTimes(3)
      expect(lastEnd()?.rowId).toBe('row-1')

      await settleMoves()
      for (const id of ['node-0-0', 'row-2', 'row-1']) {
        await expect
          .poll(() => handleOf(id).hasAttribute('aria-busy'), { message: id })
          .toBe(false)
        expect(rowById(id)!.hasAttribute('aria-busy'), id).toBe(false)
      }
    } finally {
      await screen.unmount()
    }
  })

  test('LT6: отказ ленивого переноса — строка возвращается, ручка вспыхивает, отказ объявлен; отказ обычного переноса — вспышка и объявление без отката данных', async () => {
    const screen = await renderTree({ asyncMove: true })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      await settleMoves(false, new Error('Server said no'))
      await expect
        .poll(() => order().slice(0, 2))
        .toEqual(['node-0', 'node-0-0'])
      expect(depthOf(rowById('node-0-0')!)).toBe(1)
      await expect
        .poll(() => handleOf('node-0-0').getAttribute('data-error-flash'))
        .toBe('on')
      await expect
        .poll(announced)
        .toContain(DEFAULT_LABELS.announceMoveFailed('Server said no'))

      await dropAfter('row-2', 'group-0', 0, 'row-0')
      await settleMoves(false, '')
      await expect
        .poll(() => handleOf('row-2').getAttribute('data-error-flash'))
        .toBe('on')
      await expect
        .poll(announced)
        .toContain(
          DEFAULT_LABELS.announceMoveFailed(DEFAULT_LABELS.moveRowFailed),
        )
      expect(order().slice(-4), 'данные не откатываются').toEqual([
        'group-0',
        'row-2',
        'row-0',
        'row-1',
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('LT7: пауза над ленивой группой зовёт loadChildren, слот — её первый ребёнок, пришедшие дети встают ниже; отказ загрузки сворачивает группу, слот уходит на её уровень, пауза её больше не раскрывает', async () => {
    const screen = await renderTree({ asyncLoad: true, asyncMove: true })
    try {
      // Вверх над group-0: слот встаёт сразу под node-1.
      const first = await dragOver('row-0', 'group-0', 1)
      await settleSlotAfter('node-1', first.at)
      await expect
        .poll(() => harness.loads.map(load => load.rowId))
        .toEqual(['node-1'])
      expect(depthOf(slot()!)).toBe(1)
      harness.loads[0]!.answer.resolve(SERVER['node-1']!)
      await expect.poll(() => rowById('node-1-1')).not.toBeNull()
      await settleRowMotion()
      expect(order().slice(1, 5)).toEqual([
        'node-1',
        'row-0',
        'node-1-0',
        'node-1-1',
      ])
      await userEvent.keyboard('{Escape}')
      await expect.poll(slot).toBeNull()
      await settleRowMotion()

      const second = await dragOver('row-0', 'node-1', 1)
      // Слот под ленивой группой node-0: пауза грузит её детей, загрузка падает.
      const before = rowsInOrder().findIndex(
        row => row.dataset.rowId === 'node-0',
      )
      expect(before).toBe(0)
      await settleSlotAfter('node-0', second.at)
      await expect.poll(() => harness.loads.length).toBe(2)
      expect(harness.loads[1]!.rowId).toBe('node-0')
      harness.loads[1]!.answer.reject(new Error('down'))
      await expect
        .poll(() => rowById('node-0')!.getAttribute('data-expanded'))
        .toBe('false')
      await expect.poll(() => depthOf(slot()!)).toBe(0)
      await sleep(800)
      expect(harness.loads, 'пауза не раскрывает снова').toHaveLength(2)
      await userEvent.keyboard('{Escape}')
      await expect.poll(slot).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('LT8: в ленивом дереве лист бросается на любой уровень, строка с детьми в группу не вкладывается', async () => {
    const screen = await renderTree()
    try {
      await expand('node-0', 'node-0-2')
      await expand('node-0-1', 'node-0-1-1')
      await dropAfter('row-0', 'node-0-1-0', 2)
      expect(lastEnd()).toEqual(
        expect.objectContaining({
          rowId: 'row-0',
          parentId: 'node-0-1',
          previousParentId: undefined,
          index: 1,
        }),
      )
      await expect
        .poll(() => order().slice(2, 6))
        .toEqual(['node-0-1', 'node-0-1-0', 'row-0', 'node-0-1-1'])
      expect(depthOf(rowById('row-0')!)).toBe(2)

      const calls = harness.onRowDragEnd.mock.calls.length
      const { at } = await dragOver('node-1', 'node-0-2', 1)
      await settleSlotAfter('node-0-2', at)
      expect(container().hasAttribute('data-row-drop-invalid')).toBe(true)
      await release()
      expect(harness.onRowDragEnd).toHaveBeenCalledTimes(calls)
    } finally {
      await screen.unmount()
    }
  })

  test('LT10: ожидающий перенос переживает уход строки из окна и возврат, смену данных и смену страницы; ушедшие из модели строка или родитель снимают перенос, и поздний итог промиса ничего не пишет', async () => {
    const scroller = () =>
      document.querySelector<HTMLElement>('.data-grid__container')!
    let screen = await renderTree({ asyncMove: true, extraRoots: 80 })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      const placed = order().slice(0, 9)
      scroller().scrollTop = scroller().scrollHeight
      await expect.poll(() => rowById('node-0-0')).toBeNull()
      scroller().scrollTop = 0
      await expect.poll(() => rowById('node-0-0')).not.toBeNull()
      await settleRowMotion()
      expect(order().slice(0, 9), 'окно').toEqual(placed)
      expect(rowById('node-0-0')!.getAttribute('aria-busy')).toBe('true')

      harness.setData(prev => [...prev])
      await settleRowMotion()
      expect(order().slice(0, 9), 'данные').toEqual(placed)

      // Родитель ушёл из данных: перенос снят, итог не пишется.
      harness.setData(prev => prev.filter(row => row.id !== 'node-0'))
      await expect.poll(() => rowById('node-0-0')).toBeNull()
      await settleMoves()
      await sleep(100)
      expect(rowById('node-0-0')).toBeNull()
      expect(harness.onRowOrderChange).not.toHaveBeenCalled()
      await screen.unmount()

      // Ушла группа-цель: перенос снят — строка снова в своей группе.
      screen = await renderTree({ asyncMove: true })
      await expand('node-0', 'node-0-2')
      await expand('node-1', 'node-1-1')
      await dropAfter('node-0-0', 'node-1-0', 1)
      expect(order().indexOf('node-0-0')).toBe(order().indexOf('node-1-0') + 1)
      harness.setData(prev => prev.filter(row => row.id !== 'node-1'))
      await expect
        .poll(() => order().slice(0, 2))
        .toEqual(['node-0', 'node-0-0'])
      await settleMoves()
      await sleep(100)
      expect(order().slice(0, 2), 'итог цели').toEqual(['node-0', 'node-0-0'])
      await screen.unmount()

      // Строку убрали из ответа-источника: перенос снят, итог не пишется.
      screen = await renderTree({ asyncMove: true })
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      harness.setLoadedChildren('node-0', rows =>
        rows.filter(row => row.id !== 'node-0-0'),
      )
      await expect.poll(() => rowById('node-0-0')).toBeNull()
      await settleMoves()
      await sleep(100)
      expect(rowById('node-0-0'), 'итог строки').toBeNull()
      expect(harness.onRowOrderChange).not.toHaveBeenCalled()
      await screen.unmount()

      screen = await renderTree({
        asyncMove: true,
        pageSize: 10,
        extraRoots: 20,
      })
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      const page = order()
      await userEvent.click(
        document.querySelector<HTMLElement>(
          `[aria-label="${DEFAULT_LABELS.nextPage}"]`,
        )!,
      )
      await expect.poll(() => rowById('node-0-0')).toBeNull()
      await userEvent.click(
        document.querySelector<HTMLElement>(
          `[aria-label="${DEFAULT_LABELS.previousPage}"]`,
        )!,
      )
      await expect.poll(() => rowById('node-0-0')).not.toBeNull()
      await settleRowMotion()
      expect(order(), 'страница').toEqual(page)
      expect(rowById('node-0-0')!.getAttribute('aria-busy')).toBe('true')
      await settleMoves()
    } finally {
      await screen.unmount()
    }
  })

  test('LT15: ручка строки — квадратная кнопка кита, колонка 40px; в ожидании и при вспышке ошибки иконка видна без наведения, в покое — только при наведении', async () => {
    const screen = await renderTree({ asyncMove: true })
    /** Значение токена темы в px — тем же расчётом, что у кнопки. */
    const tokenPx = (token: string) => {
      const probe = document.createElement('div')
      probe.style.width = `var(${token})`
      handleOf('row-2').closest('.data-grid-theme')!.append(probe)
      const value = getComputedStyle(probe).width
      probe.remove()
      return value
    }
    const iconOpacity = (id: string) =>
      Number(getComputedStyle(handleOf(id).querySelector('svg')!).opacity)
    const away = async () => {
      const r = rowById('row-2')!.getBoundingClientRect()
      await pointer.realMouseMove(
        { x: r.left + 200, y: r.top + r.height / 2 },
        { x: r.left + 200, y: 880 },
        2,
      )
    }
    try {
      const handle = handleOf('row-2')
      expect(handle.tagName).toBe('BUTTON')
      expect(handle.dataset.shape).toBe('square')
      const style = getComputedStyle(handle)
      expect(style.width).toBe(tokenPx('--tsr-comp-button-size'))
      expect(style.height).toBe(tokenPx('--tsr-comp-button-size'))
      const radius = document.createElement('div')
      radius.style.borderRadius = 'var(--tsr-comp-button-radius-square)'
      handle.closest('.data-grid-theme')!.append(radius)
      expect(style.borderTopLeftRadius).toBe(
        getComputedStyle(radius).borderTopLeftRadius,
      )
      radius.remove()
      expect(
        Math.round(
          handle.closest('.data-grid__body-cell')!.getBoundingClientRect()
            .width,
        ),
      ).toBe(40)

      await away()
      await expect
        .poll(() => iconOpacity('row-2'), { message: 'покой' })
        .toBe(0)
      await userEvent.hover(rowById('row-2')!)
      await expect
        .poll(() => iconOpacity('row-2'), { message: 'наведение' })
        .toBe(1)

      await dropAfter('row-2', 'group-0', 0, 'row-0')
      await away()
      await sleep(400)
      expect(handleOf('row-2').getAttribute('aria-busy')).toBe('true')
      expect(iconOpacity('row-2'), 'ожидание').toBe(1)

      await settleMoves(false, new Error('no'))
      await expect
        .poll(() => handleOf('row-2').getAttribute('data-error-flash'))
        .toBe('on')
      expect(iconOpacity('row-2'), 'вспышка').toBe(1)
      await expect
        .poll(() => handleOf('row-2').hasAttribute('data-error-flash'), {
          timeout: 4000,
        })
        .toBe(false)
      await expect
        .poll(() => iconOpacity('row-2'), { message: 'после вспышки' })
        .toBe(0)
    } finally {
      await screen.unmount()
    }
  })

  test('LT13: axe с контрастом в обеих темах во время ожидания и после отказа; высокая контрастность — свет ожидания ручки Highlight, ошибка — Mark', async () => {
    const screen = await renderTree({ asyncMove: true })
    const sys = (color: string) => {
      const probe = document.createElement('span')
      probe.style.color = color
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return toRgba(value)
    }
    const checkAxe = () =>
      inBothThemes(async () => {
        const result = await axe.run(
          document.querySelector<HTMLElement>(
            '[role="treegrid"], [role="table"]',
          )!,
          {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          },
        )
        expect(result.violations).toEqual([])
      })
    try {
      await expand('node-0', 'node-0-2')
      await dropAfter('node-0-0', 'row-0', 0)
      await checkAxe()
      if (server.browser !== 'webkit') {
        await pointer.forcedColors(true)
        const glow = getComputedStyle(handleOf('node-0-0')).getPropertyValue(
          '--tsr-comp-pending-glow-1',
        )
        expect(toRgba(glow.trim())).toEqual(sys('Highlight'))
        const ring = getComputedStyle(handleOf('node-0-0'), '::after')
        expect(ring.forcedColorAdjust).toBe('none')
        expect(ring.boxShadow).not.toBe('none')
        await pointer.forcedColors(false)
      }
      await settleMoves(false, new Error('no'))
      await expect
        .poll(() => handleOf('node-0-0').getAttribute('data-error-flash'))
        .toBe('on')
      if (server.browser !== 'webkit') {
        await pointer.forcedColors(true)
        const error = getComputedStyle(handleOf('node-0-0')).getPropertyValue(
          '--tsr-comp-error-flash-color',
        )
        expect(toRgba(error.trim())).toEqual(sys('Mark'))
        await pointer.forcedColors(false)
      }
      await checkAxe()
    } finally {
      await pointer.forcedColors(false)
      await screen.unmount()
    }
  })
})
