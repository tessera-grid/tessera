import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import { type CSSProperties, useState } from 'react'

import type { FooterPosition } from '../../../core/footer'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  infiniteScroll,
  pagination,
  quickSearch,
  rowExpanding,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import {
  headCellById,
  pinViaPopover,
  renderColumnPinning,
  scrollerOf,
} from './column-pinning-helpers'
import { tableLabels } from '../labels'

// Футер колонок и его положение (ADR 0118, FT1–FT2, FT4–FT13, FT15–FT17): закреплённый
// у низа области, незакреплённый за последней строкой. FT3 — `play` истории
// «Core/Footer — Position switch», FT14 — перф в `scroll`.

const fx = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  await fx.reducedMotion(false)
  document.documentElement.classList.remove('dark')
})

interface Item {
  id: string
  name: string
  amount: number
  note: string
  subRows?: Item[]
}

const COLUMNS = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 200,
    footer: () => 'Total',
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    size: 160,
    footer: () => 'Sum 42',
  },
  // Колонка без `footer` — пустая ячейка футера (FT16).
  { id: 'note', accessorKey: 'note', header: 'Note', size: 200 },
]

const makeRows = (count: number, prefix = 'r'): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `Name ${i}`,
    amount: i,
    note: `Note ${i}`,
  }))

const makeTree = (parents: number, children: number): Item[] =>
  makeRows(parents).map(item => ({
    ...item,
    subRows: makeRows(children, `${item.id}-c`),
  }))

type Mode = 'plain' | 'keyboard' | 'tree'

interface GridProps {
  data?: Item[]
  enableFooter?: boolean
  footerPosition?: FooterPosition
  mode?: Mode
  /** Высота области, px; `null` — без высоты, по содержимому. */
  height?: number | null
  pageSize?: number
  onLoadMore?: () => Promise<void>
  search?: boolean
  loading?: 'initial' | false
  loadError?: unknown
  enableRowAnimation?: boolean
  style?: CSSProperties
}

let api:
  | {
      getRow: (id: string) => { toggleExpanded: () => void }
      setPageIndex: (index: number) => void
      setGlobalFilter: (value: string) => void
      scrollToRow: (
        id: string,
        options?: { align?: 'start' | 'end' | 'center' | 'auto' },
      ) => Promise<boolean>
    }
  | undefined

const Grid = ({
  data = makeRows(200),
  enableFooter = true,
  footerPosition,
  mode = 'plain',
  height = 400,
  pageSize,
  onLoadMore,
  search,
  loading,
  loadError,
  enableRowAnimation,
  style,
}: GridProps) => {
  // Набор плагинов — договор на время жизни таблицы: стенд его не меняет.
  const [plugins] = useState(() => [
    ...(mode === 'tree' ? [rowExpanding()] : []),
    ...(pageSize ? [pagination({ initialPageSize: pageSize })] : []),
    ...(onLoadMore ? [infiniteScroll({ onLoadMore, hasMore: true })] : []),
    ...(search ? [quickSearch()] : []),
  ])
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: plugins as never,
    enableKeyboardNavigation: mode !== 'plain',
    enableFooter,
    footerPosition,
    loading,
    loadError,
    onRetry: () => {},
    enableRowAnimation,
  })
  api = table as unknown as typeof api
  return (
    <div style={{ width: 700, ...(height === null ? {} : { height }) }}>
      <DataGrid table={table as never} style={style} />
    </div>
  )
}

const mount = async (initial: GridProps = {}) => {
  let props = initial
  const screen = await render(<Grid {...props} />)
  await waitRows()
  return {
    screen,
    update: async (next: GridProps) => {
      props = { ...props, ...next }
      await screen.rerender(<Grid {...props} />)
    },
  }
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const footer = () => q('.data-grid__footer')!
const head = () => q('.data-grid__head')!
const errorRow = () => q('[data-testid="infinite-scroll-error"]')
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitRows = () =>
  expect
    .poll(
      () =>
        document.querySelectorAll(
          '.data-grid__body-row, .data-grid__body-row--skeleton',
        ).length,
    )
    .toBeGreaterThan(0)

const rect = (element: Element) => element.getBoundingClientRect()
/** Низ видимой части области прокрутки — без полосы прокрутки. */
const clientBottom = () => {
  const s = scroller()
  return rect(s).top + s.clientTop + s.clientHeight
}
/** Строка тела с наибольшим индексом среди смонтированных. */
const lastRow = () =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__body-row')].reduce(
    (found, row) =>
      Number(row.dataset.index) > Number(found.dataset.index) ? row : found,
  )
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)!
const footerCell = (column: string) =>
  q(`.data-grid__footer-cell[data-column-id="${column}"]`)!
const expectNear = (actual: number, expected: number, message?: string) =>
  expect(Math.abs(actual - expected), message).toBeLessThanOrEqual(1)
/** `a` стоит в DOM раньше `b`. */
const precedes = (a: Node, b: Node) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const scrollToEnd = async () => {
  const s = scroller()
  s.scrollTop = s.scrollHeight
  await frame()
  await frame()
}
const scrollTop = async (top: number) => {
  scroller().scrollTop = top
  await frame()
  await frame()
}

/** Цвет токена в вычисленном виде — для сравнения с цветом рамки. */
const tokenColor = (token: string) => {
  const probe = document.createElement('div')
  probe.style.color = `var(${token})`
  footer().appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe('Футер колонок', () => {
  test('FT16: enableFooter — одна строка футера под телом: в колонках с columnDef.footer — его содержимое, в остальных — пустая ячейка; без флага строки футера нет', async () => {
    const view = await mount({ data: makeRows(5) })
    const footers = document.querySelectorAll('.data-grid__footer')
    expect(footers).toHaveLength(1)
    const rows = footers[0].querySelectorAll('[role="row"]')
    expect(rows).toHaveLength(1)
    const cells = [
      ...rows[0].querySelectorAll<HTMLElement>('.data-grid__footer-cell'),
    ]
    expect(cells.map(cell => cell.dataset.columnId)).toEqual([
      'name',
      'amount',
      'note',
    ])
    expect(cells.map(cell => cell.textContent?.trim())).toEqual([
      'Total',
      'Sum 42',
      '',
    ])
    // Под телом: после последней строки в DOM и не выше неё на экране.
    expect(precedes(lastRow(), footers[0])).toBe(true)
    expect(rect(footers[0]).top).toBeGreaterThanOrEqual(
      rect(lastRow()).bottom - 1,
    )

    await view.update({ enableFooter: false })
    await frame()
    expect(document.querySelector('.data-grid__footer')).toBeNull()
    expect(document.querySelector('.data-grid__footer-cell')).toBeNull()
  })
})

describe('Положение футера', () => {
  test("FT1: 'pinned' (по умолчанию) — футер у низа области при любой прокрутке, строки уходят под него; 'inline' — футер за последней строкой и прокручивается вместе с телом", async () => {
    const pinned = await mount()
    for (const top of [0, 2000, Infinity]) {
      await scrollTop(top === Infinity ? scroller().scrollHeight : top)
      expectNear(rect(footer()).bottom, clientBottom(), `pinned at ${top}`)
    }
    // Строки уходят под футер: есть смонтированная строка, закрытая им.
    await scrollTop(0)
    const footerTop = rect(footer()).top
    expect(
      [...document.querySelectorAll('.data-grid__body-row')].some(
        row => rect(row).top < footerTop && rect(row).bottom > footerTop,
      ),
    ).toBe(true)
    await pinned.screen.unmount()

    await mount({ footerPosition: 'inline' })
    await scrollTop(0)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(clientBottom())
    await scrollTop(2000)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(clientBottom())
    await scrollToEnd()
    expectNear(rect(footer()).top, rect(rowById('r199')).bottom)
    expectNear(rect(footer()).bottom, clientBottom())
    // Прокрутка уносит футер вместе с последней строкой.
    const before = rect(footer()).top
    await scrollTop(scroller().scrollTop - 100)
    expectNear(rect(footer()).top, before + 100)
    expectNear(rect(footer()).top, rect(rowById('r199')).bottom)
  })

  test("FT2: короткая таблица — в 'pinned' футер у низа области с пустым местом над ним, в 'inline' — сразу под последней строкой", async () => {
    const pinned = await mount({ data: makeRows(3) })
    expectNear(rect(footer()).bottom, clientBottom())
    expect(rect(footer()).top - rect(lastRow()).bottom).toBeGreaterThan(50)
    // Пустое место — не прокрутка: таблица ровно в области.
    expect(scroller().scrollHeight).toBeLessThanOrEqual(scroller().clientHeight)
    await pinned.screen.unmount()

    await mount({ data: makeRows(3), footerPosition: 'inline' })
    expectNear(rect(footer()).top, rect(lastRow()).bottom)
    expect(clientBottom() - rect(footer()).bottom).toBeGreaterThan(50)
  })

  test("FT4: в 'inline' у футера нет тени и есть линия сверху по токену; в 'pinned' — тень --tsr-comp-shadow-footer, линии нет", async () => {
    const pinned = await mount({ data: makeRows(3) })
    const pinnedStyle = getComputedStyle(footer())
    expect(pinnedStyle.boxShadow).not.toBe('none')
    expect(pinnedStyle.borderTopWidth).toBe('0px')
    await pinned.screen.unmount()

    await mount({ data: makeRows(3), footerPosition: 'inline' })
    const inlineStyle = getComputedStyle(footer())
    expect(inlineStyle.boxShadow).toBe('none')
    expect(inlineStyle.borderTopStyle).toBe('solid')
    expect(inlineStyle.borderTopWidth).toBe('1px')
    expect(inlineStyle.borderTopColor).toBe(
      tokenColor('--tsr-comp-cell-divider-color'),
    )
    // Высота строки футера та же: линия внутри неё.
    expectNear(rect(footer()).height, rect(lastRow()).height)
  })

  test("FT5: в 'inline' при горизонтальной прокрутке ячейки футера закреплённых колонок остаются над своими колонками тела; колонка действий — как в CP35", async () => {
    const container = await renderColumnPinning({
      enableFooter: true,
      footerPosition: 'inline',
      enableRowActions: true,
    })
    const s = scrollerOf(container)
    const ACTIONS = "[data-actions-column-cell='true']"
    const toBottom = async (left: number) => {
      s.scrollTop = s.scrollHeight
      s.scrollLeft = left
      await expect.poll(() => s.scrollLeft).toBeGreaterThan(left - 2)
      await frame()
      await frame()
    }
    // Действия — единственные справа: у правого края футера видны данные.
    await toBottom(400)
    const row = container.querySelector<HTMLElement>(
      '.data-grid__footer [role="row"]',
    )!
    const at = document
      .elementFromPoint(
        rect(s).right - 12,
        rect(row).top + rect(row).height / 2,
      )
      ?.closest<HTMLElement>('.data-grid__footer-cell')
    expect(at).toBeTruthy()
    expect(at!.matches(ACTIONS)).toBe(false)

    s.scrollLeft = 0
    s.scrollTop = 0
    await pinViaPopover(
      headCellById(container, 'firstName'),
      tableLabels.pinLeft,
    )
    await pinViaPopover(
      headCellById(container, 'lastName'),
      tableLabels.pinRight,
    )
    await expect
      .poll(() => footerCell('lastName').getAttribute('data-cell-pinned'))
      .toBe('right')
    await toBottom(400)
    // Футер — за последней строкой, а не у низа области поверх строк.
    expectNear(rect(footer()).top, rect(lastRow()).bottom)
    s.scrollTop = 0
    await frame()
    expect(rect(footer()).top).toBeGreaterThanOrEqual(
      rect(s).top + s.clientTop + s.clientHeight,
    )
    await toBottom(400)
    const body = lastRow()
    for (const id of ['firstName', 'lastName']) {
      const cell = body.querySelector(
        `.data-grid__body-cell[data-column-id="${id}"]`,
      )!
      expectNear(rect(footerCell(id)).left, rect(cell).left, id)
      expectNear(rect(footerCell(id)).width, rect(cell).width, id)
      expect(getComputedStyle(footerCell(id)).backgroundColor).not.toBe(
        'rgba(0, 0, 0, 0)',
      )
    }
    // В правом блоке с пользовательским пином действия закреплены с подложкой.
    const actions = container.querySelector<HTMLElement>(
      `.data-grid__footer-cell${ACTIONS}`,
    )!
    const headActions = container.querySelector<HTMLElement>(
      `.data-grid__head-cell${ACTIONS}`,
    )!
    expectNear(rect(actions).left, rect(headActions).left)
  })

  test("FT6: в 'inline' стрелка вниз с последней строки доводит футер в вид целиком, вверх с футера — строку; так же, когда последняя строка вне окна виртуализации", async () => {
    await mount({ footerPosition: 'inline', mode: 'keyboard' })
    await scrollToEnd()
    const cell = rowById('r199').querySelector<HTMLElement>(
      '[data-kn-cell][data-column-id="amount"]',
    )!
    await humanClick(cell)
    await expect.poll(() => document.activeElement).toBe(cell)
    // Футер за краем области, последняя строка — у самого низа.
    await scrollTop(scroller().scrollTop - rect(footer()).height)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(clientBottom() - 1)

    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(footerCell('amount'))
    await frame()
    expect(rect(footer()).bottom).toBeLessThanOrEqual(clientBottom() + 1)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(rect(head()).bottom)

    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => document.activeElement).toBe(cell)
    await frame()
    expect(rect(cell).top).toBeGreaterThanOrEqual(rect(head()).bottom - 1)
    expect(rect(cell).bottom).toBeLessThanOrEqual(clientBottom() + 1)

    // Последняя строка вне окна: прокрутка в начало, фокус остаётся на ней.
    await scrollTop(0)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(footerCell('amount'))
    await frame()
    expect(rect(footer()).bottom).toBeLessThanOrEqual(clientBottom() + 1)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(rect(head()).bottom)
  })

  test("FT7: scrollToRow в 'inline' по низу — строка у низа области при футере вне вида и над футером, когда он виден", async () => {
    await mount({ footerPosition: 'inline' })
    expect(await api!.scrollToRow('r100', { align: 'end' })).toBe(true)
    await frame()
    expectNear(rect(rowById('r100')).bottom, clientBottom())
    expect(rect(footer()).top).toBeGreaterThanOrEqual(clientBottom() - 1)

    expect(await api!.scrollToRow('r199', { align: 'end' })).toBe(true)
    await frame()
    const row = rect(rowById('r199'))
    expectNear(row.bottom, rect(footer()).top)
    expect(rect(footer()).bottom).toBeLessThanOrEqual(clientBottom() + 1)
  })

  test("FT8: с пагинацией в 'inline' футер за последней строкой страницы, в 'pinned' — у низа области", async () => {
    const pinned = await mount({ pageSize: 5, height: 600 })
    expectNear(rect(footer()).bottom, clientBottom())
    expect(rect(footer()).top - rect(lastRow()).bottom).toBeGreaterThan(50)
    await pinned.screen.unmount()

    await mount({ pageSize: 5, height: 600, footerPosition: 'inline' })
    expectNear(rect(footer()).top, rect(rowById('r4')).bottom)
    api!.setPageIndex(1)
    await expect.poll(() => q('[data-row-id="r9"]')).not.toBeNull()
    await frame()
    expectNear(rect(footer()).top, rect(rowById('r9')).bottom)
  })

  test("FT9: лента — в 'inline' строки, хвост скелетов, футер, строка ошибки; в 'pinned' строка ошибки над футером у низа; порядок Tab и стрелок — как на экране", async () => {
    const answers: ((error?: Error) => void)[] = []
    const onLoadMore = () =>
      new Promise<void>((resolve, reject) =>
        answers.push(error => (error ? reject(error) : resolve())),
      )
    const tail = () => q('.data-grid__body--infinite-tail')
    const retry = () =>
      errorRow()!.querySelector<HTMLElement>('[data-kn-body-end]')!

    // 'inline': хвост — продолжение строк, до футера; ошибка — после футера.
    const inline = await mount({
      data: makeRows(4),
      footerPosition: 'inline',
      mode: 'keyboard',
      onLoadMore,
    })
    await expect.poll(tail).not.toBeNull()
    expect(precedes(tail()!, footer())).toBe(true)
    expect(rect(footer()).top).toBeGreaterThanOrEqual(rect(tail()!).bottom - 1)
    // В StrictMode первый запрос устаревает: отвечаем на последний.
    answers.at(-1)!(new Error('Down'))
    await expect.poll(errorRow).not.toBeNull()
    expect(precedes(footer(), errorRow()!)).toBe(true)
    expect(rect(errorRow()!).top).toBeGreaterThanOrEqual(
      rect(footer()).bottom - 1,
    )
    // Стрелки по экрану: строка → футер → ошибка → футер.
    const cell = rowById('r3').querySelector<HTMLElement>(
      '[data-kn-cell][data-column-id="name"]',
    )!
    await humanClick(cell)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(footerCell('name'))
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(retry())
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => document.activeElement).toBe(footerCell('name'))
    await inline.screen.unmount()

    // 'pinned': ошибка над футером, футер у низа области.
    answers.length = 0
    await mount({ data: makeRows(4), mode: 'keyboard', onLoadMore })
    await expect.poll(() => answers.length).toBeGreaterThan(0)
    answers.at(-1)!(new Error('Down'))
    await expect.poll(errorRow).not.toBeNull()
    expect(precedes(errorRow()!, footer())).toBe(true)
    await scrollToEnd()
    expect(rect(errorRow()!).bottom).toBeLessThanOrEqual(rect(footer()).top + 1)
    expectNear(rect(footer()).bottom, clientBottom())
    const pinnedCell = rowById('r3').querySelector<HTMLElement>(
      '[data-kn-cell][data-column-id="name"]',
    )!
    await humanClick(pinnedCell)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(retry())
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(footerCell('name'))
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => document.activeElement).toBe(retry())
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => document.activeElement).toBe(pinnedCell)
  })

  test("FT17: лента в 'inline' — отказ блока у края оставляет область у края, строка ошибки под футером видна целиком; вдали от края прокрутка не меняется", async () => {
    const answers: ((error: Error) => void)[] = []
    const onLoadMore = () =>
      new Promise<void>((_, reject) => answers.push(reject))
    const tail = () => q('.data-grid__body--infinite-tail')
    await mount({ footerPosition: 'inline', onLoadMore })

    // У края: блок в пути, отказ — строка ошибки в области целиком.
    await scrollToEnd()
    await expect.poll(tail).not.toBeNull()
    answers.at(-1)!(new Error('Down'))
    await expect.poll(errorRow).not.toBeNull()
    await frame()
    expect(rect(errorRow()!).top).toBeGreaterThanOrEqual(
      rect(footer()).bottom - 1,
    )
    expect(rect(errorRow()!).bottom).toBeLessThanOrEqual(clientBottom() + 1)

    // Вдали от края: пока блок в пути, пользователь ушёл вверх — отказ прокрутку не трогает.
    answers.length = 0
    errorRow()!.querySelector<HTMLElement>('[data-kn-body-end]')!.click()
    await expect.poll(tail).not.toBeNull()
    await scrollTop(0)
    answers.at(-1)!(new Error('Down'))
    await expect.poll(errorRow).not.toBeNull()
    await frame()
    expect(scroller().scrollTop).toBe(0)
  })

  test('FT10: без строк с заглушкой фильтра или ошибки загрузки — в обоих режимах заглушка между шапкой и футером, футер у низа области под ней', async () => {
    const stubs = [
      {
        props: { data: [], loadError: new Error('Down') },
        stub: '[data-testid="load-error-stub"]',
        apply: async () => {},
      },
      {
        props: { search: true },
        stub: '[data-testid="filter-stub"]',
        apply: async () => api!.setGlobalFilter('zzz'),
      },
    ]
    const positions = ['pinned', 'inline'] as const
    for (const { props, stub, apply } of stubs)
      for (const position of positions) {
        const message = `${stub} ${position}`
        const view = await render(<Grid {...props} footerPosition={position} />)
        await apply()
        await expect.poll(() => q(stub)).not.toBeNull()
        // Место заглушки под шапкой отдаёт наблюдатель размеров — к кадру после появления.
        await expect
          .poll(() => rect(q(stub)!).bottom, { message })
          .toBeLessThanOrEqual(rect(footer()).top + 1)
        const box = rect(q(stub)!)
        expect(box.top, message).toBeGreaterThanOrEqual(rect(head()).bottom - 1)
        expect(precedes(q(stub)!, footer()), message).toBe(true)
        // В 'inline' футер едет к низу движением строк (FT12) — к концу движения.
        await expect
          .poll(() => Math.abs(rect(footer()).bottom - clientBottom()), {
            message,
          })
          .toBeLessThanOrEqual(1)
        // Заглушка — во всю видимую ширину области, как без футера (FL41). После
        // движения: пока футер едет, область выше, и WebKit показывает полосу прокрутки.
        const settled = rect(q(stub)!)
        expectNear(
          settled.left,
          rect(scroller()).left + scroller().clientLeft,
          message,
        )
        expectNear(settled.width, scroller().clientWidth, message)
        await view.unmount()
      }
  })

  test("FT11: футер скелета первой загрузки у низа области — с тенью в 'pinned' и с линией в 'inline'", async () => {
    const skeletonFooter = () => q('.data-grid__footer--skeleton')!
    for (const position of ['pinned', 'inline'] as const) {
      const view = await render(
        <Grid data={[]} loading="initial" footerPosition={position} />,
      )
      await expect.poll(skeletonFooter).not.toBeNull()
      await frame()
      expectNear(rect(skeletonFooter()).bottom, clientBottom(), position)
      const style = getComputedStyle(skeletonFooter())
      if (position === 'pinned') {
        expect(style.boxShadow).not.toBe('none')
        expect(style.borderTopWidth).toBe('0px')
      } else {
        expect(style.boxShadow).toBe('none')
        expect(style.borderTopStyle).toBe('solid')
        expect(style.borderTopWidth).toBe('1px')
      }
      await view.unmount()
    }
  })

  test("FT12: в 'inline' при смене числа строк над видимым футером он едет вместе со строками без скачка; при уменьшенном движении и enableRowAnimation: false — сразу на месте", async () => {
    const slow = {
      '--tsr-comp-row-motion-duration': '600ms',
    } as CSSProperties
    /**
     * Верх футера по кадрам с коммита раскрытия до конца движения. Коммит React бывает
     * и после первого кадра: отсчёт — с кадра, где строк тела стало больше.
     */
    const sampleExpand = async () => {
      const from = rect(footer()).top
      const rowsBefore = document.querySelectorAll(
        '.data-grid__body-row',
      ).length
      api!.getRow('r0').toggleExpanded()
      do await frame()
      while (
        document.querySelectorAll('.data-grid__body-row').length <= rowsBefore
      )
      const tops: number[] = [rect(footer()).top]
      for (let i = 0; i < 50; i++) {
        await frame()
        tops.push(rect(footer()).top)
      }
      return { from, tops, to: tops.at(-1)! }
    }

    const glide = await mount({
      data: makeTree(3, 3),
      mode: 'tree',
      footerPosition: 'inline',
      style: slow,
    })
    const { from, tops, to } = await sampleExpand()
    expect(to - from).toBeGreaterThan(100)
    // Первый кадр после коммита — у прежнего места, дальше без скачков к новому.
    expect(tops[0] - from).toBeLessThan((to - from) / 2)
    expect(tops.some(top => top > from + 10 && top < to - 10)).toBe(true)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeLessThan((to - from) / 2)
    }
    expectNear(to, rect(lastRow()).bottom)
    await glide.screen.unmount()

    for (const calm of ['reduced', 'flag'] as const) {
      if (calm === 'reduced') await fx.reducedMotion(true)
      const view = await mount({
        data: makeTree(3, 3),
        mode: 'tree',
        footerPosition: 'inline',
        style: slow,
        enableRowAnimation: calm === 'flag' ? false : undefined,
      })
      const sample = await sampleExpand()
      expectNear(sample.tops[0], sample.to, calm)
      await view.screen.unmount()
      await fx.reducedMotion(false)
    }
  })

  test("FT13: axe с color-contrast в обоих режимах, темах и ролях table, grid, treegrid; в forced-colors линия 'inline' видна", async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    for (const position of ['pinned', 'inline'] as const) {
      for (const [mode, role] of [
        ['plain', 'table'],
        ['keyboard', 'grid'],
        ['tree', 'treegrid'],
      ] as const) {
        const view = await mount({
          data: mode === 'tree' ? makeTree(3, 2) : makeRows(5),
          mode,
          footerPosition: position,
        })
        expect(q(`[role="${role}"]`), role).not.toBeNull()
        await inBothThemes(async () => {
          await pause(250)
          const { violations } = await axe.run(q('.data-grid-theme')!, options)
          expect(violations, `${position} ${role}`).toEqual([])
        })
        await view.screen.unmount()
      }
    }

    // WebKit цвета в forced-colors не подменяет (ADR 0087).
    if (server.browser === 'webkit') return
    await fx.forcedColors(true)
    try {
      await mount({ data: makeRows(3), footerPosition: 'inline' })
      const style = getComputedStyle(footer())
      expect(style.borderTopStyle).toBe('solid')
      expect(style.borderTopWidth).toBe('1px')
      expect(style.borderTopColor).not.toBe(style.backgroundColor)
      expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await fx.forcedColors(false)
    }
  })

  test('FT15: грид без высоты — оба режима дают одну раскладку, пустого места над футером нет', async () => {
    const tops: number[] = []
    for (const position of ['pinned', 'inline'] as const) {
      const view = await mount({
        data: makeRows(4),
        height: null,
        footerPosition: position,
      })
      expectNear(rect(footer()).top, rect(lastRow()).bottom, position)
      expect(scroller().scrollHeight, position).toBeLessThanOrEqual(
        scroller().clientHeight,
      )
      tops.push(rect(footer()).top - rect(head()).top)
      await view.screen.unmount()
    }
    expectNear(tops[0], tops[1])
  })
})
