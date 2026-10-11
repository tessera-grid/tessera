import { beforeAll, describe, expect, test } from 'vitest'

import {
  Grid,
  expectCollected,
  expectFlat,
  measureSlope,
  mount,
  settled,
  track,
  warmUpDocument,
} from '../memory.helpers'

// Детектор утечек ловит то, что должен (ADR 0092, LK11–LK12): подсаженная утечка
// каждого вида роняет проверку, а отчёт называет держателя. Каждый тест убирает
// подсаженное за собой.

beforeAll(warmUpDocument)

const holder = globalThis as { __tesseraLeakHolder?: unknown }

describe('Детектор утечек', () => {
  test('LK11: детектор ловит подсаженную утечку каждого вида — забытый обработчик на window, удержанный отсоединённый узел, удержанный объект таблицы; медленную утечку в один объект за цикл ловит наклон', async () => {
    const listeners: (() => void)[] = []
    try {
      const forgotten = await measureSlope(async () => {
        const listener = () => {}
        listeners.push(listener)
        window.addEventListener('resize', listener)
      })
      expect(() => expectFlat(forgotten)).toThrow(/jsEventListeners/)
    } finally {
      for (const listener of listeners) {
        window.removeEventListener('resize', listener)
      }
    }

    const kept: Element[] = []
    const detached = await measureSlope(async () => {
      const node = document.createElement('div')
      document.body.append(node)
      node.remove()
      kept.push(node)
    })
    kept.length = 0
    expect(() => expectFlat(detached)).toThrow(/nodes/)

    // Без утечки тот же замер ровный — детектор не падает на чистом цикле.
    const clean = await measureSlope(async () => {
      const node = document.createElement('div')
      document.body.append(node)
      node.remove()
    })
    expectFlat(clean)

    const box: { table?: object } = {}
    const mounted = mount(<Grid onTable={table => (box.table = table)} />)
    await settled(mounted.container)
    const tracked = [track('таблица', box.table!)]
    const retained = [box.table]
    box.table = undefined
    mounted.unmount()
    await expect(expectCollected(tracked)).rejects.toThrow(/удержаны: таблица/)
    retained.length = 0
    await expectCollected(tracked)
  }, 60_000)

  test('LK12: при падении отчёт содержит путь удержания от корня до удержанного объекта — для подсаженной утечки в пути есть её держатель', async () => {
    const box: { table?: object } = {}
    const mounted = mount(<Grid onTable={table => (box.table = table)} />)
    await settled(mounted.container)
    const tracked = [track('таблица', box.table!)]
    holder.__tesseraLeakHolder = box.table
    box.table = undefined
    mounted.unmount()
    try {
      await expect(expectCollected(tracked)).rejects.toThrow(
        /__tesseraLeakHolder → Object \/ <symbol tesseraLeakMarker> → TesseraLeakMarker/,
      )
    } finally {
      delete holder.__tesseraLeakHolder
    }
    await expectCollected(tracked)
  }, 60_000)
})
