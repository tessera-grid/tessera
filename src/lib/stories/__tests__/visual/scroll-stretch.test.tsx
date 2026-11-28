import { render } from 'vitest-browser-react'
import { commands, server, userEvent } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  backToTop,
  columnSorting,
  columnSortingModel,
  serverRowModel,
  type ServerRowsRequest,
} from '../../../plugins'
import { composed } from '../stories'
import { HANDLE, pointer, sleep } from './row-drop-helpers'

// Растяжка высоты сверх предела браузера (ADR 0142): тело выше 8 млн px — растянутая
// область со слоем координат. Набор идёт ещё и в `test:browsers`: пределы и колесо у
// движков свои.

const MILLION = 1_000_000
/** Тело 150 000 строк по 50px — 7,5 млн px, ниже границы. */
const BELOW = 150_000
const BORDER = 8_000_000
/** Координаты Firefox и шаг колеса движков — с точностью до пикселя. */
const PRECISION = 1

interface Item {
  id: string
  name: string
}
const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const getRows = ({ start, end }: ServerRowsRequest) => ({
  rows: Array.from({ length: end - start }, (_, k) => ({
    id: `r${start + k}`,
    name: `N${start + k}`,
  })),
})

interface StretchTable {
  scrollToRowIndex: (index: number) => Promise<boolean>
  scrollToRow: (id: string, options?: { index?: number }) => Promise<boolean>
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
}

const Grid = ({
  rowCount,
  keyboard = false,
  onTable,
}: {
  rowCount: number
  keyboard?: boolean
  onTable?: (table: StretchTable) => void
}) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    rowCount,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    // Нижняя панель — место кнопки «наверх» (ADR 0082).
    enableStatusBar: true,
    plugins: [
      serverRowModel({ getRows }),
      backToTop(),
      columnSortingModel(),
      columnSorting(),
    ],
  } as never)
  onTable?.(table as unknown as StretchTable)
  return (
    <div style={{ width: 400, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)
const scroller = () => q('.data-grid__container')!
const layer = () => scrollLayer(scroller())
const rowAt = (index: number) =>
  q(`.data-grid__body-row[data-index="${index}"][data-row-id]`)
/** Верх строки относительно области прокрутки. */
const rowTop = (index: number) =>
  rowAt(index)!.getBoundingClientRect().top -
  scroller().getBoundingClientRect().top
/** Строки с данными, видимые в области прокрутки. */
const visibleIndexes = () => {
  const view = scroller().getBoundingClientRect()
  return [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]',
    ),
  ]
    .filter(row => {
      const box = row.getBoundingClientRect()
      return box.bottom > view.top + 51 && box.top < view.bottom - 1
    })
    .map(row => Number(row.dataset.index))
}
const nextFrame = () => new Promise(requestAnimationFrame)
/** Верх строки после конца анимации щелчка: место не меняется три кадра подряд. */
const settledTop = async (index: number) => {
  let last = rowTop(index)
  for (let still = 0; still < 3;) {
    await nextFrame()
    const top = rowTop(index)
    still = top === last ? still + 1 : 0
    last = top
  }
  return last
}
const center = () => {
  const box = scroller().getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}
const wheel = commands as unknown as {
  realWheel: (
    at: { x: number; y: number },
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
  reducedMotion: (reduce: boolean) => Promise<void>
}
/** Синтетическое колесо: в растянутой области его ведёт слой. */
const syntheticWheel = (init: WheelEventInit) => {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  scroller().dispatchEvent(event)
  return event
}
const mount = async (rowCount: number, props: object = {}) => {
  const screen = await render(<Grid rowCount={rowCount} {...props} />)
  await expect.poll(() => rowAt(0)).not.toBeNull()
  return screen
}
/** Прокрутка в долю итога — ползунком. */
const thumbTo = async (fraction: number) => {
  const el = scroller()
  el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction
  await expect.poll(() => visibleIndexes().length).toBeGreaterThan(3)
}
/** Строка в середине видимой области. */
const middleRow = () => {
  const shown = visibleIndexes()
  return shown[Math.floor(shown.length / 2)]!
}

describe('Растяжка высоты (ADR 0142)', () => {
  test('XS1: растяжка включается, только когда тело выше границы — меньшего из 8 млн px и пределов ADR 0141 за вычетом шапки и строки футера; ниже границы высота тела — итог, прокрутка нативная, слушателя колеса нет', async () => {
    let screen = await mount(BELOW)
    const rowHeight = rowAt(0)!.getBoundingClientRect().height
    expect(q('.data-grid__body')!.getBoundingClientRect().height).toBe(
      BELOW * rowHeight,
    )
    expect(layer().stretched).toBe(false)
    expect(syntheticWheel({ deltaY: 30 }).defaultPrevented).toBe(false)
    await screen.unmount()

    screen = await mount(MILLION)
    const body = q('.data-grid__body')!.getBoundingClientRect().height
    expect(layer().stretched).toBe(true)
    expect(body).toBeLessThan(BORDER)
    expect(body).toBeGreaterThan(BORDER - 3 * rowHeight)
    expect(syntheticWheel({ deltaY: 30 }).defaultPrevented).toBe(true)
    await screen.unmount()
  })

  test('XS2: в растянутом режиме высота тела — граница, ползунок пропорционален итогу: протяжка в конец показывает последнюю строку итога, в середину — строку середины', async () => {
    const screen = await mount(MILLION)
    await thumbTo(1)
    await expect.poll(() => Math.max(...visibleIndexes())).toBe(MILLION - 1)
    await thumbTo(0.5)
    await expect
      .poll(() => Math.abs(middleRow() - MILLION / 2))
      .toBeLessThan(MILLION / 1000)
    await screen.unmount()
  })

  test('XS3: колесо 1:1 — событие сдвигает строки ровно на свою дельту (строки и страницы deltaMode — в px) на любой глубине, точность 1px; Ctrl + колесо и горизонталь не перехватываются', async () => {
    const screen = await mount(MILLION)
    for (const fraction of [0.3, 0.9]) {
      await thumbTo(fraction)
      const watched = middleRow()
      const before = await settledTop(watched)
      await wheel.realWheel(center(), 30, 4, 50)
      await expect
        .poll(() => Math.abs(before - rowTop(watched) - 120))
        .toBeLessThanOrEqual(PRECISION)
    }
    // Строка и страница колеса — в px; сдвиг доезжает за анимацию щелчка.
    // Точка отсчёта — после конца анимации прошлого щелчка: на ходу ошибка складывается.
    const watched = middleRow()
    let before = await settledTop(watched)
    syntheticWheel({ deltaY: 1, deltaMode: 1 })
    await expect
      .poll(() => Math.abs(before - rowTop(watched) - 20))
      .toBeLessThanOrEqual(PRECISION)
    before = await settledTop(watched)
    syntheticWheel({ deltaY: -1, deltaMode: 2 })
    await expect
      .poll(() => Math.abs(rowTop(watched) - before - scroller().clientHeight))
      .toBeLessThanOrEqual(PRECISION)

    const top = layer().top()
    expect(syntheticWheel({ deltaY: 30, ctrlKey: true }).defaultPrevented).toBe(
      false,
    )
    expect(syntheticWheel({ deltaX: 30 }).defaultPrevented).toBe(true)
    expect(layer().top()).toBe(top)
    await screen.unmount()
  })

  test('XS4: клавиши клавиатурной навигации доводят активную ячейку до любой строки итога и сдвигают экран, как без растяжки', async () => {
    const screen = await mount(MILLION, { keyboard: true })
    q('.data-grid__body-row[data-index="0"] [data-kn-cell]')!.focus()
    await userEvent.keyboard('{Control>}{End}{/Control}')
    await expect.poll(() => visibleIndexes()).toContain(MILLION - 1)
    const active = () =>
      Number(
        q('[data-kn-cell][data-kn-active="true"]')?.closest<HTMLElement>(
          '.data-grid__body-row',
        )?.dataset.index,
      )
    expect(active()).toBe(MILLION - 1)

    await userEvent.keyboard('{PageUp}')
    await expect.poll(active).toBeLessThan(MILLION - 1)
    await expect.poll(() => visibleIndexes()).toContain(active())

    // К началу — через шапку: Ctrl+Home ведёт в неё (ADR 0021).
    await userEvent.keyboard('{Control>}{Home}{/Control}{ArrowDown}')
    await expect.poll(active).toBe(0)
    await expect.poll(() => layer().top()).toBeLessThanOrEqual(PRECISION)
    await expect
      .poll(() =>
        Math.abs(
          rowTop(0) - q('.data-grid__head')!.getBoundingClientRect().height,
        ),
      )
      .toBeLessThanOrEqual(PRECISION)
    await screen.unmount()
  })

  test('XS5: scrollToRow, scrollToRowIndex, «наверх» и сброс прокрутки при смене выборки доводят до любой строки итога', async () => {
    const ref: { table?: StretchTable } = {}
    const screen = await mount(MILLION, {
      onTable: (table: StretchTable) => (ref.table = table),
    })
    expect(await ref.table!.scrollToRowIndex(MILLION - 1)).toBe(true)
    expect(visibleIndexes()).toContain(MILLION - 1)
    expect(await ref.table!.scrollToRow('r750000', { index: 750_000 })).toBe(
      true,
    )
    expect(visibleIndexes()).toContain(750_000)

    await expect.poll(() => q('[data-testid="back-to-top"]')).not.toBeNull()
    await userEvent.click(q('[data-testid="back-to-top"]')!)
    await expect.poll(() => layer().top()).toBe(0)
    await expect.poll(() => visibleIndexes()).toContain(0)

    await thumbTo(0.8)
    ref.table!.setSorting([{ id: 'name', desc: false }])
    await expect.poll(() => layer().top()).toBe(0)
    await screen.unmount()
  })

  test('XS6: автопрокрутка у края при перетаскивании строк и выделении ячеек двигает строки с той же скоростью, что без растяжки', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'миллион строк на клиенте в Firefox и WebKit — дольше минуты; сдвиг 1:1 считает слой, от движка он не зависит',
    )
    /** Сколько виртуальных px прокрутка прошла за удержание указателя у нижнего края. */
    const holdAtEdge = async (
      grab: () => { x: number; y: number },
      release: () => Promise<void>,
    ) => {
      const from = grab()
      const box = scroller().getBoundingClientRect()
      const edge = { x: from.x, y: box.bottom - 6 }
      await pointer.realDragHold(from, edge)
      const start = layer().top()
      await sleep(800)
      const passed = layer().top() - start
      await release()
      return passed
    }
    const rowHandle = () => {
      const row = q('.data-grid__body-row[data-index="2"]')!
      const handle = row.querySelector<HTMLElement>(HANDLE)!
      const box = handle.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }
    const firstCell = () => {
      const box = q(
        '.data-grid__body-row[data-index="2"] .data-grid__body-cell[data-column-id]',
      )!.getBoundingClientRect()
      return { x: box.left + 10, y: box.top + box.height / 2 }
    }
    const measure = async (stretched: boolean) => {
      const dataCount = stretched ? MILLION : 1000
      let screen = await render(
        <composed.RowDraggingPlayground dataCount={dataCount} />,
      )
      await expect.poll(() => rowAt(2)).not.toBeNull()
      expect(layer().stretched).toBe(stretched)
      await userEvent.hover(rowAt(2)!)
      const rows = await holdAtEdge(rowHandle, async () => {
        await pointer.realMouseUp()
        await sleep(300)
      })
      await screen.unmount()
      screen = await render(
        <composed.CellSelectionPlayground dataCount={dataCount} />,
      )
      await expect.poll(() => rowAt(2)).not.toBeNull()
      const cells = await holdAtEdge(firstCell, () => pointer.realMouseUp())
      await screen.unmount()
      return { rows, cells }
    }
    const base = await measure(false)
    const stretched = await measure(true)
    expect(base.rows).toBeGreaterThan(0)
    expect(base.cells).toBeGreaterThan(0)
    expect(stretched.rows).toBeLessThan(base.rows * 1.35)
    expect(stretched.cells).toBeLessThan(base.cells * 1.35)
  }, 60_000)

  test('XS7: быстрая прокрутка считает скорость по виртуальной позиции — протяжка ползунка включает режим, колесо — как без растяжки', async () => {
    const fastNow = () => scroller().hasAttribute('data-fast-scrolling')
    const screen = await mount(MILLION)
    await thumbTo(0.4)
    await expect.poll(fastNow).toBe(false)
    let seen = false
    const watch = setInterval(() => (seen ||= fastNow()), 4)
    // 10px за 16 мс — втрое ниже порога: щелчки под нагрузкой приходят пачкой.
    await wheel.realWheel(center(), 10, 40, 16)
    clearInterval(watch)
    expect(seen).toBe(false)

    // 600 физических px/s ниже порога 2000, а при scale > 5 — выше него.
    // Задаём путь по времени: под нагрузкой WebKit пропускает кадры.
    const thumb = async () => {
      let fast = false
      const el = scroller()
      const top = el.scrollTop
      const started = performance.now()
      for (let step = 0; step < 40; step++) {
        await nextFrame()
        fast ||= fastNow()
        el.scrollTop = top + (performance.now() - started) * 0.6
      }
      await nextFrame()
      return fast || fastNow()
    }
    expect(layer().scale()).toBeGreaterThan(5)
    expect(await thumb()).toBe(true)
    await screen.unmount()

    await mount(BELOW)
    await thumbTo(0.4)
    await expect.poll(fastNow).toBe(false)
    expect(await thumb()).toBe(false)
  })

  test('XS8: в растянутом режиме липкая шапка у верха области на любой глубине во всех движках; предупреждений о пределах нет', async () => {
    const warn = vi.spyOn(console, 'warn')
    try {
      const screen = await mount(MILLION)
      for (const fraction of [0.2, 0.5, 0.99, 1]) {
        await thumbTo(fraction)
        expect(
          q('.data-grid__head')!.getBoundingClientRect().top -
            scroller().getBoundingClientRect().top,
        ).toBe(0)
      }
      await screen.unmount()
      expect(
        warn.mock.calls.some(call =>
          /sticking|out of reach/.test(String(call[0])),
        ),
      ).toBe(false)
    } finally {
      warn.mockRestore()
    }
  })

  test('XS12: щелчок колеса доезжает плавно за длительность токена движения, следующие щелчки продлевают цель; мелкие дельты тачпада и уменьшенное движение — сразу', async () => {
    const screen = await mount(MILLION)
    await thumbTo(0.5)
    const watched = middleRow()
    const start = rowTop(watched)
    const moved = () => start - rowTop(watched)
    const path: number[] = []
    let sampling = true
    const sample = () => {
      path.push(moved())
      if (sampling) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    syntheticWheel({ deltaY: 100 })
    syntheticWheel({ deltaY: 100 })
    await expect
      .poll(() => Math.abs(moved() - 200))
      .toBeLessThanOrEqual(PRECISION)
    sampling = false
    expect(path.some(value => value > 1 && value < 199)).toBe(true)

    // Тачпад: мелкая дельта — в том же кадре.
    let before = rowTop(watched)
    syntheticWheel({ deltaY: 10 })
    await nextFrame()
    expect(Math.abs(before - rowTop(watched) - 10)).toBeLessThanOrEqual(
      PRECISION,
    )

    await wheel.reducedMotion(true)
    try {
      before = rowTop(watched)
      syntheticWheel({ deltaY: 100 })
      await nextFrame()
      expect(Math.abs(before - rowTop(watched) - 100)).toBeLessThanOrEqual(
        PRECISION,
      )
    } finally {
      await wheel.reducedMotion(false)
    }
    await screen.unmount()
  })
})
