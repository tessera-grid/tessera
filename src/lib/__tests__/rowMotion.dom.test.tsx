// @vitest-environment happy-dom
/**
 * Движение строк при новой выборке источника по индексу (ADR 0228, EM9): план — только по
 * окну, журнал смен прежней выборки к новой не применяется.
 * Запуск: npx vitest run --config vitest.node.config.ts rowMotion.dom
 */
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RowListChange, RowSource } from '../core/rowSource'
import { RowMotion } from '../grid/rowMotion/RowMotion'

vi.mock('../ui/theme/rowMotionTiming', () => ({
  rowMotionTiming: () => ({ duration: 250, easing: 'linear' }),
}))
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const SIZE = 50

/** Источник по индексу: строки окна, номер раскладки и журнал её смен. */
const list = {
  rows: [] as string[],
  version: 0,
  journal: [] as RowListChange[][],
}
const source = {
  keyByIndex: true,
  count: () => list.rows.length,
  at: (index: number) =>
    list.rows[index] === undefined ? undefined : { id: list.rows[index] },
  byId: (id: string) => (list.rows.includes(id) ? { id } : undefined),
  indexOf: (id: string) => list.rows.indexOf(id),
  version: () => list.version,
  changesSince: (since: number) => list.journal.slice(since),
} as unknown as RowSource<{ id: string }>
const noRows = () => [] as { id: string }[]

/** Анимации строк: `id` строки и её ключевые кадры. */
let played: { id: string | undefined; keyframes: Keyframe[] }[]
let root: Root
let host: HTMLDivElement

const bodyRef = createRef<HTMLDivElement>()
const Body = ({ epoch }: { epoch: number }) => (
  <div ref={bodyRef}>
    <RowMotion
      enabled
      getRows={noRows}
      source={source}
      listVersion={list.version}
      epoch={epoch}
      virtualRows={list.rows.map((_, index) => ({
        key: index,
        index,
        start: index * SIZE,
        end: (index + 1) * SIZE,
        size: SIZE,
        lane: 0,
      }))}
      bodyRef={bodyRef}
    >
      {list.rows.map((id, index) => (
        <div key={id} data-row-id={id} style={{ top: `${index * SIZE}px` }} />
      ))}
    </RowMotion>
  </div>
)

beforeEach(() => {
  played = []
  // Раскладки нет: верх строки — из её `style.top`.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const top = Number.parseFloat(this.style.top) || 0
      return DOMRect.fromRect({ x: 0, y: top, width: 100, height: SIZE })
    },
  )
  HTMLElement.prototype.animate = function (
    this: HTMLElement,
    keyframes: Keyframe[],
  ) {
    played.push({ id: this.dataset.rowId, keyframes })
    return { cancel: () => {} } as unknown as Animation
  } as never
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

const animationsOf = (id: string) =>
  played.filter(animation => animation.id === id)
const translateFrom = (id: string) =>
  animationsOf(id).find(animation => 'translate' in animation.keyframes[0]!)
    ?.keyframes[0]!.translate

describe('движение строк новой выборки (ADR 0228)', () => {
  it('EM9: транзакция прежней выборки в одном коммите с приходом новой не даёт сдвигов по её журналу — план только по окну', () => {
    list.rows = ['a', 'b', 'c', 'd']
    list.version = 0
    list.journal = []
    act(() => root.render(<Body epoch={1} />))
    expect(played).toHaveLength(0)

    // Прежней выборке пришла вставка в начало, и в том же коммите на экране — новая выборка.
    list.rows = ['b', 'd', 'y', 'z']
    list.version = 1
    list.journal = [[{ at: 0, delta: 1 }]]
    act(() => root.render(<Body epoch={2} />))

    // Уцелевшие едут от своей позиции в DOM.
    expect(translateFrom('b')).toBe(`0 ${SIZE}px`)
    expect(translateFrom('d')).toBe(`0 ${2 * SIZE}px`)
    // Вошедшие проявляются на месте: сдвига по журналу прежней выборки нет.
    for (const id of ['y', 'z']) {
      expect(animationsOf(id)).toHaveLength(1)
      expect(translateFrom(id)).toBeUndefined()
      expect(animationsOf(id)[0]!.keyframes[0]).toEqual({ opacity: 0 })
    }
  })
})
