/**
 * Хранилище блоков серверной модели строк (ADR 0138, этап 2; SD7–SD8): очередь запросов
 * и отмена блоков, ушедших из окна.
 * Запуск: npx vitest run --config vitest.node.config.ts serverRowModel
 */
import { describe, expect, it } from 'vitest'

import {
  type BlockRequest,
  type BlockResponse,
  BlockStore,
} from '../plugins/serverRowModel/blockStore'

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
})
