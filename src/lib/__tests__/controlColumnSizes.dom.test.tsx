// @vitest-environment happy-dom
/**
 * Ширина колонок контролов по кнопке грида из темы (ADR 0135, GZ15, GZ17): запись в
 * авто-слайс размеров — только при своей теме и только при смене записи; проба кнопки —
 * только при смене колонок контролов и темы.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useControlColumnSizes } from '../grid/useControlColumnSizes'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const columns = [
  { id: 'select', columnDef: { controlSized: true } },
  { id: 'expand', columnDef: { controlSized: true } },
  { id: 'name', columnDef: {} },
]

const Host = ({
  table,
  size,
  themeKey,
}: {
  table: object
  size: string
  themeKey: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  useControlColumnSizes(table, ref, themeKey)
  return (
    <div
      ref={ref}
      style={{ '--tsr-comp-grid-button-size': size } as React.CSSProperties}
    />
  )
}

let container: HTMLDivElement | null = null
afterEach(() => {
  container?.remove()
  container = null
})

const mount = () => {
  container = document.createElement('div')
  document.body.append(container)
  return createRoot(container)
}

describe('Ширина колонок контролов из темы (ADR 0135)', () => {
  it('GZ15: при теме по умолчанию в размеры ничего не пишется; своя тема пишет ширину колонок контролов один раз; повторные рендеры без смены записи сеттер не зовут', () => {
    const setColumnAutoSizing = vi.fn()
    const table = { getAllLeafColumns: () => columns, setColumnAutoSizing }
    const root = mount()

    // Тема по умолчанию (28px): записи нет — ширина из определения колонки.
    act(() => root.render(<Host table={table} size="28px" themeKey="a" />))
    act(() => root.render(<Host table={table} size="28px" themeKey="a" />))
    expect(setColumnAutoSizing).not.toHaveBeenCalled()

    // Своя тема (32px): ширина колонок контролов — кнопка плюс 2 × 4px, один раз.
    act(() => root.render(<Host table={table} size="32px" themeKey="b" />))
    expect(setColumnAutoSizing).toHaveBeenCalledTimes(1)
    const updater = setColumnAutoSizing.mock.calls[0]![0] as (
      prev: object,
    ) => object
    expect(updater({ other: 120 })).toEqual({
      other: 120,
      select: 40,
      expand: 40,
    })

    // Повторные рендеры с той же записью — без вызовов, даже с новым объектом таблицы.
    const same = { ...table }
    act(() => root.render(<Host table={same} size="32px" themeKey="b" />))
    act(() => root.render(<Host table={same} size="32px" themeKey="b" />))
    expect(setColumnAutoSizing).toHaveBeenCalledTimes(1)

    // Возврат к теме по умолчанию снимает запись.
    act(() => root.render(<Host table={same} size="28px" themeKey="c" />))
    expect(setColumnAutoSizing).toHaveBeenCalledTimes(2)
    const reset = setColumnAutoSizing.mock.calls[1]![0] as (
      prev: object,
    ) => object
    expect(reset({ other: 120, select: 40, expand: 40 })).toEqual({
      other: 120,
    })
    act(() => root.unmount())
  })

  it('GZ17: размер кнопки грида меряется только при смене состава колонок контролов и ключа темы, а не на каждой перерисовке грида', () => {
    const probe = vi.spyOn(window, 'getComputedStyle')
    try {
      const table = {
        getAllLeafColumns: () => columns,
        setColumnAutoSizing: vi.fn(),
      }
      const root = mount()
      act(() => root.render(<Host table={table} size="32px" themeKey="a" />))
      expect(probe).toHaveBeenCalledTimes(1)

      // Перерисовки грида: обёртка таблицы новая на каждой, тема и колонки прежние.
      for (let i = 0; i < 3; i++) {
        act(() =>
          root.render(<Host table={{ ...table }} size="32px" themeKey="a" />),
        )
      }
      expect(probe).toHaveBeenCalledTimes(1)

      act(() => root.render(<Host table={table} size="28px" themeKey="b" />))
      expect(probe).toHaveBeenCalledTimes(2)
      act(() => root.unmount())
    } finally {
      probe.mockRestore()
    }
  })
})
