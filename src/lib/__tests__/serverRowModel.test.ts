/**
 * Хранилище блоков серверной модели строк (ADR 0138; SD7–SD8, SD39, SD47–SD48): очередь
 * запросов, отмена блоков, ушедших из окна, автоповтор отказавшего блока, словарь мест
 * строк дерева и хранилища свёрнутых веток; `aria-*` дерева — паритет с клиентским счётом
 * (SD54).
 * Запуск: npx vitest run --config vitest.node.config.ts serverRowModel
 */
import { describe, expect, it } from 'vitest'

import { getTreeAria } from '../grid/treeAria'

import {
  type BlockRequest,
  type BlockResponse,
  BlockStore,
} from '../plugins/serverRowModel/blockStore'
import { BlockTree } from '../plugins/serverRowModel/tree'

interface Item {
  id: string
}

interface Call {
  request: BlockRequest<string>
  resolve: (response: BlockResponse<Item>) => void
  reject: (reason: unknown) => void
}

const BLOCK = 10

/** Хранилище с «сервером», который отвечает по команде теста. */
const setup = (options: { rowCount?: number; maxBlocks?: number } = {}) => {
  const calls: Call[] = []
  const store = new BlockStore<Item, Item, string>({
    blockSize: BLOCK,
    maxBlocks: options.maxBlocks ?? 100,
    rowCount: options.rowCount ?? 1000,
    query: () => 'q',
    getRows: request =>
      new Promise<BlockResponse<Item>>((resolve, reject) => {
        calls.push({ request, resolve, reject })
      }),
    toRows: data => data,
    idOf: row => row.id,
    onChange: () => {},
  })
  /** Ответить на запрос блока строками `start…end`. */
  const answered = new Set<Call>()
  const answer = async (call: Call) => {
    answered.add(call)
    const { start, end } = call.request
    call.resolve({
      rows: Array.from({ length: end - start }, (_, i) => ({
        id: `r${start + i}`,
      })),
    })
    await Promise.resolve()
    await Promise.resolve()
  }
  const starts = () => calls.map(call => call.request.start)
  /** Запросов в пути: без ответа и без отмены. */
  const inFlight = () =>
    calls.filter(call => !answered.has(call) && !call.request.signal.aborted)
      .length
  return { store, calls, answer, starts, inFlight }
}

describe('Хранилище блоков (ADR 0138)', () => {
  it('SD7: не больше двух запросов одновременно; очередь — по близости к окну', async () => {
    const { store, calls, answer, starts, inFlight } = setup()
    // Окно на пять блоков 40…89: середина — в блоке 6.
    store.setWindow(40, 89)
    expect(starts()).toEqual([60, 50])
    expect(inFlight()).toBe(2)

    await answer(calls[0]!)
    expect(starts()).toEqual([60, 50, 70])
    await answer(calls[1]!)
    expect(starts()).toEqual([60, 50, 70, 40])
    await answer(calls[2]!)
    expect(starts()).toEqual([60, 50, 70, 40, 80])
    expect(inFlight()).toBe(2)

    await answer(calls[3]!)
    await answer(calls[4]!)
    expect(calls).toHaveLength(5)
    expect(inFlight()).toBe(0)
    expect(store.rowAt(40)).toEqual({ id: 'r40' })
    expect(store.rowAt(89)).toEqual({ id: 'r89' })
  })

  it('SD8: блок, ушедший из окна до ответа, отменён signal, а его поздний ответ игнорируется', async () => {
    const { store, calls, answer } = setup()
    store.setWindow(0, 19)
    const [first, second] = calls
    expect(first!.request.signal.aborted).toBe(false)

    // Прыжок вдаль: оба блока ушли из окна, в очереди — блоки нового окна.
    store.setWindow(500, 519)
    expect(first!.request.signal.aborted).toBe(true)
    expect(second!.request.signal.aborted).toBe(true)
    expect(calls.slice(2).map(call => call.request.start)).toEqual([500, 510])

    // Сервер не послушал signal и ответил: строк от устаревшего запроса нет.
    await answer(first!)
    expect(store.rowAt(0)).toBeUndefined()
    expect(store.statusOf(0)).toBe('missing')
    expect(store.indexOf('r0')).toBe(-1)

    // Вернулись к началу — блок запрошен заново, а не взят из отменённого ответа.
    store.setWindow(0, 9)
    expect(calls.at(-1)!.request.start).toBe(0)
    expect(calls.at(-1)!.request.signal.aborted).toBe(false)
  })

  it('SD39: отказавший блок, ушедший из окна и вернувшийся в него, запрашивается сам один раз, не во время быстрой прокрутки; отказ автоповтора — строка ошибки, дальше повтор только кнопкой', async () => {
    const { store, calls, answer } = setup()
    const fail = async (call: Call) => {
      call.reject(new Error('down'))
      await Promise.resolve()
      await Promise.resolve()
    }
    const requestsOf = (start: number) =>
      calls.filter(call => call.request.start === start).length
    store.setWindow(0, 9)
    await fail(calls[0]!)
    expect(store.statusOf(0)).toBe('error')

    // В окне без ухода — блок не повторяется.
    store.setWindow(0, 9)
    expect(requestsOf(0)).toBe(1)

    // Ушёл и вернулся быстрой прокруткой — ещё не повторяется.
    store.setWindow(500, 509)
    store.setWindow(0, 9, true)
    expect(requestsOf(0)).toBe(1)
    expect(store.statusOf(0)).toBe('error')

    // Прокрутка успокоилась — один автоповтор.
    store.setWindow(0, 9)
    expect(requestsOf(0)).toBe(2)
    await fail(calls.at(-1)!)
    expect(store.statusOf(0)).toBe('error')
    expect(store.failures().map(failure => failure.start)).toEqual([0])

    // Автоповтор отказал: уход и возврат больше не повторяют.
    store.setWindow(500, 509)
    store.setWindow(0, 9)
    expect(requestsOf(0)).toBe(2)

    // Кнопка повтора — по-прежнему.
    store.retry(0)
    expect(requestsOf(0)).toBe(3)
    await answer(calls.at(-1)!)
    expect(store.statusOf(0)).toBe('loaded')
  })
})

describe('Дерево хранилищ (ADR 0138)', () => {
  it('SD47: место строки в её ветке дерево помнит только для строк загруженных блоков и раскрытых строк: вытесненный блок уносит записи своих строк, раскрытая строка свою сохраняет, и её ветка остаётся на месте', async () => {
    const expanded = new Set(['r1'])
    const tree = new BlockTree<Item, Item, string>({
      blockSize: BLOCK,
      maxBlocks: 2,
      rowCount: 1000,
      query: () => 'q',
      // Корни — `r<номер>`, у раскрытой строки пять детей `<родитель>.<номер>`.
      getRows: ({ start, end, parentId }) => ({
        rows: Array.from(
          { length: Math.min(end, parentId ? 5 : end) - start },
          (_, i) => ({
            id: parentId ? `${parentId}.${start + i}` : `r${start + i}`,
          }),
        ),
        ...(parentId ? { rowCount: 5 } : {}),
      }),
      toRows: data => data,
      idOf: row => row.id,
      expanded: () => expanded,
      onChange: () => {},
    })
    const settle = () => new Promise(resolve => setTimeout(resolve, 0))
    const positions = () =>
      (tree as unknown as { positions: Map<string, unknown> }).positions.size

    tree.setWindow(0, 9)
    await settle()
    tree.count()
    await settle()
    expect(tree.rowAt(2)?.id).toBe('r1.0')

    // Долгая прокрутка: записей не больше, чем строк в двух блоках, и раскрытой строки.
    for (let first = 105; first < 1000; first += 50) {
      tree.setWindow(first, first + 9)
      await settle()
      expect(positions()).toBeLessThanOrEqual(2 * BLOCK + 1)
    }
    // Блок строки 1 вытеснен, её ветка — на месте.
    expect(tree.rowAt(1)).toBeUndefined()
    expect(tree.count()).toBe(1005)
  })

  it('SD48: хранилище ветки свёрнутой строки без загруженных блоков уходит; повторное раскрытие запрашивает детей заново', async () => {
    let expanded: ReadonlySet<string> = new Set(['r1'])
    const asked: string[] = []
    const signals: Record<string, AbortSignal> = {}
    const tree = new BlockTree<Item, Item, string>({
      blockSize: BLOCK,
      maxBlocks: 2,
      rowCount: 1000,
      query: () => 'q',
      // Дети строки 2 ждут ответа без конца; остальные приходят сразу.
      getRows: ({ start, end, parentId, signal }) => {
        if (parentId) asked.push(parentId)
        if (parentId === 'r2') {
          signals.r2 = signal
          return new Promise<BlockResponse<Item>>(() => {})
        }
        return {
          rows: Array.from(
            { length: Math.min(end, parentId ? 5 : end) - start },
            (_, i) => ({
              id: parentId ? `${parentId}.${start + i}` : `r${start + i}`,
            }),
          ),
          ...(parentId ? { rowCount: 5 } : {}),
        }
      },
      toRows: data => data,
      idOf: row => row.id,
      expanded: () => expanded,
      onChange: () => {},
    })
    const settle = () => new Promise(resolve => setTimeout(resolve, 0))
    const branches = () =>
      (tree as unknown as { nodes: Map<unknown, unknown> }).nodes.size - 1
    /** Сменить раскрытые строки; тело читает число строк и сообщает окно. */
    const setExpanded = async (ids: string[]) => {
      expanded = new Set(ids)
      tree.count()
      await settle()
    }

    tree.setWindow(0, 9)
    await settle()
    tree.count()
    await settle()
    expect(tree.rowAt(2)?.id).toBe('r1.0')

    // Свёрнутая ветка с блоком в кэше живёт, без блока — уходит.
    await setExpanded([])
    expect(branches()).toBe(1)
    for (const first of [100, 200]) {
      tree.setWindow(first, first + 9)
      await settle()
    }
    expect(branches()).toBe(0)

    // Свёрнута до ответа — уходит сразу; запрос отменён уходом из окна (SD8).
    tree.setWindow(0, 9)
    await settle()
    await setExpanded(['r2'])
    expect(asked).toEqual(['r1', 'r2'])
    await setExpanded([])
    expect(branches()).toBe(0)
    expect(signals.r2!.aborted).toBe(true)

    // Повторное раскрытие запрашивает детей заново.
    await setExpanded(['r1'])
    expect(asked).toEqual(['r1', 'r2', 'r1'])
    expect(tree.rowAt(2)?.id).toBe('r1.0')
  })
})

/** Детерминированный генератор: тест воспроизводим. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** Дети узла по id (у корней — ключ `''`), до четырёх уровней. */
const treeSpec = (next: () => number) => {
  const children = new Map<string, number>()
  const grow = (id: string, depth: number) => {
    const count =
      depth === 0 ? 3 + Math.floor(next() * 8) : Math.floor(next() * 6)
    if (depth > 0 && (count === 0 || depth > 3)) return
    children.set(id, count)
    for (let k = 0; k < count; k++) {
      if (next() < 0.5) grow(depth === 0 ? `n${k}` : `${id}.${k}`, depth + 1)
    }
  }
  grow('', 0)
  return children
}

const settleAnswers = async () => {
  for (let tick = 0; tick < 20; tick++) await Promise.resolve()
}

describe('aria-* дерева серверной модели (ADR 0138, §14)', () => {
  it('SD54: уровень, место среди соседей и их число у каждой строки раскрытого дерева совпадают с клиентским счётом тела на тех же строках', async () => {
    const next = random(11)
    for (let round = 0; round < 100; round++) {
      const children = treeSpec(next)
      const idOf = (parent: string | undefined, k: number) =>
        parent === undefined ? `n${k}` : `${parent}.${k}`
      const expanded = new Set([...children.keys()].filter(id => id !== ''))
      const tree = new BlockTree<Item, Item, string>({
        blockSize: 4,
        maxBlocks: Number.POSITIVE_INFINITY,
        rowCount: children.get(''),
        query: () => 'q',
        getRows: ({ start, end, parentId }) => {
          const total = children.get(parentId ?? '') ?? 0
          return {
            rows: Array.from(
              { length: Math.max(0, Math.min(end, total) - start) },
              (_, i) => ({ id: idOf(parentId, start + i) }),
            ),
            rowCount: total,
          }
        },
        toRows: data => data,
        idOf: row => row.id,
        expanded: () => expanded,
        onChange: () => {},
      })
      for (let pass = 0, size = -1; size !== tree.count(); pass++) {
        size = tree.count()
        tree.setWindow(0, size - 1)
        await settleAnswers()
        if (pass > 200) throw new Error('раскладка не устоялась')
      }

      // Строки тела клиентского режима: то же дерево обходом в глубину.
      const rows: { id: string; depth: number; parentId?: string }[] = []
      const walk = (parent: string | undefined, depth: number) => {
        for (let k = 0; k < (children.get(parent ?? '') ?? 0); k++) {
          const id = idOf(parent, k)
          rows.push({ id, depth, parentId: parent })
          if (expanded.has(id)) walk(id, depth + 1)
        }
      }
      walk(undefined, 0)
      const client = getTreeAria(rows)

      expect(tree.count()).toBe(rows.length)
      rows.forEach((row, index) => {
        const where = `round ${round}, index ${index}`
        expect(tree.rowAt(index)?.id, where).toBe(row.id)
        expect(tree.ariaAt(index), where).toEqual({
          level: row.depth + 1,
          posInSet: client.posInSet(index),
          setSize: client.setSize(index),
        })
      })
    }
  })
})
