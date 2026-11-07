import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  pagination,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { paginationLabels } from '../../../plugins/pagination/labels'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'
import { tokenColor } from './tree-lines-helpers'

// Номера страниц и поле перехода (ADR 0192, PJ2–PJ10, PJ12, PJ14–PJ15). PJ1, PJ11 — модульные
// (`src/lib/__tests__/pageNumbers.test.ts`), PJ13 — перф в `interaction`.

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const DATA: Item[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))
const PAGES = 40
const labels = paginationLabels(tableLabels)

const fx = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

let onPageChange: (...args: unknown[]) => unknown

interface GridProps {
  mode?: 'buttons' | 'input' | false
  width?: number
  server?: boolean
  pageSize?: number
}

const Grid = ({ mode, width = 860, server, pageSize = 25 }: GridProps) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA.slice(0, server ? 25 : DATA.length),
    getRowId: (row: Item) => row.id,
    ...(server && {
      dataMode: { pagination: 'server' as const },
      rowCount: DATA.length,
    }),
    plugins: [
      pagination({
        initialPageSize: pageSize,
        pageNumbers: mode,
        onPageChange: (...args) => onPageChange(...args) as never,
      }),
    ] as never,
  })
  return (
    <div style={{ width, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

interface ServerGridProps {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  onTable: (table: unknown) => void
}

const ServerGrid = ({ getRows, onTable }: ServerGridProps) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: [] as Item[],
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: 25 }),
      pagination({ initialPageSize: 25 }),
    ] as never,
  })
  onTable(table)
  return (
    <div style={{ width: 860, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const number = (page: number) =>
  q<HTMLButtonElement>(`[data-page-number="${page}"]`)
const current = () => q('[aria-current="page"]')?.textContent
const numbers = () => q('[data-testid="pagination-numbers"]')
const field = () =>
  q<HTMLInputElement>('[data-testid="pagination-input"] input')
const action = (name: string) =>
  q<HTMLButtonElement>(`[data-page-action="${name}"]`)!
const shown = (el: Element | null) => !!el && el.getClientRects().length > 0
const range = () => q('[data-testid="pagination-range"]')!.textContent
const layout = () =>
  q('[data-testid="data-grid-status-bar"]')!.getAttribute(
    'data-status-bar-layout',
  )
const live = () => q('[role="status"][aria-live="polite"]')!.textContent

const mount = async (props: GridProps = {}) => {
  const screen = await render(<Grid {...props} />)
  await expect.poll(() => range()).toMatch(/^1–/)
  await expect.poll(layout).toBe('full')
  return screen
}

beforeEach(async () => {
  onPageChange = () => undefined
  await page.viewport(900, 720)
})

afterEach(async () => {
  await fx.forcedColors(false)
  document.documentElement.classList.remove('dark')
})

describe('Номера страниц (ADR 0192)', () => {
  test('PJ2: смена страницы не сдвигает кнопки «назад» и «вперёд» и не меняет ширину ряда, пока разрядность номеров прежняя', async () => {
    await mount()
    const place = () => ({
      previous: action('previous').getBoundingClientRect().left,
      next: action('next').getBoundingClientRect().left,
      width: numbers()!.getBoundingClientRect().width,
    })
    // С края ряда в середину: одно многоточие сменяется двумя.
    const first = place()
    for (const target of [5, 6, 7, 40, 36]) {
      await humanClick(number(target)!)
      await expect.poll(current).toBe(String(target))
      expect(place()).toEqual(first)
    }
  })

  test('PJ3: нажатие и Enter или Space на номере переходят на страницу: onPageChange, объявление страницы, тело у начала', async () => {
    const calls: unknown[][] = []
    onPageChange = (...args) => {
      calls.push(args.slice(0, 2))
    }
    await mount()
    const scroller = q('.data-grid__container')!
    scroller.scrollTop = 200

    await humanClick(number(3)!)
    await expect.poll(current).toBe('3')
    expect(range()).toContain('51–75')
    await expect.poll(() => scroller.scrollTop).toBe(0)
    await expect.poll(live).toBe(labels.pageAnnouncement(3, PAGES))

    number(4)!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(current).toBe('4')
    number(5)!.focus()
    await userEvent.keyboard(' ')
    await expect.poll(current).toBe('5')
    expect(calls).toEqual([
      [2, 25],
      [3, 25],
      [4, 25],
    ])
  })

  test('PJ4: текущая страница — aria-current="page", отличается не только цветом, в порядке фокуса; повторное нажатие не вызывает onPageChange', async () => {
    const calls: unknown[] = []
    onPageChange = () => calls.push(1)
    await mount()
    expect(q('[aria-current="page"]')).toBe(number(1))
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
    const style = getComputedStyle(number(1)!)
    expect(style.boxShadow).not.toBe('none')
    expect(getComputedStyle(number(2)!).boxShadow).toBe('none')
    expect(number(1)!.tabIndex).toBe(0)

    await humanClick(number(1)!)
    expect(calls).toEqual([])
    expect(range()).toContain('1–25')
  })

  test('PJ5: многоточие — не кнопка, вне порядка фокуса и дерева доступности', async () => {
    await mount()
    await humanClick(number(5)!)
    await expect.poll(current).toBe('5')
    const gaps = [...numbers()!.children].filter(
      el => el.tagName !== 'BUTTON',
    ) as HTMLElement[]
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      expect(gap.textContent).toBe('…')
      expect(gap.getAttribute('aria-hidden')).toBe('true')
      expect(gap.tabIndex).toBe(-1)
    }
  })

  test('PJ6: при buttons кнопок «первая» и «последняя» нет; «назад» и «вперёд» блокируются на краях и остаются в порядке фокуса', async () => {
    await mount()
    expect(shown(action('first'))).toBe(false)
    expect(shown(action('last'))).toBe(false)
    expect(action('previous').getAttribute('aria-disabled')).toBe('true')
    action('previous').focus()
    expect(document.activeElement).toBe(action('previous'))
    expect(action('next').getAttribute('aria-disabled')).not.toBe('true')

    await humanClick(number(PAGES)!)
    await expect.poll(current).toBe(String(PAGES))
    expect(action('next').getAttribute('aria-disabled')).toBe('true')
    action('next').focus()
    expect(document.activeElement).toBe(action('next'))
    expect(action('previous').getAttribute('aria-disabled')).not.toBe('true')
  })

  test('PJ7: input — Enter и уход фокуса переходят; значение вне диапазона приводится к границе; не число возвращает прежний номер; Escape отменяет ввод', async () => {
    const calls: number[] = []
    onPageChange = index => {
      calls.push(index as number)
    }
    await mount({ mode: 'input' })
    expect(numbers()).toBeNull()
    expect(shown(action('first'))).toBe(true)
    expect(shown(action('last'))).toBe(true)
    expect(q('[data-testid="pagination-input"]')!.textContent).toContain(
      labels.pageOfTotal(PAGES),
    )
    const enter = async (text: string, key: string) => {
      await userEvent.clear(field()!)
      if (text) await userEvent.type(field()!, text)
      if (key === 'blur') await userEvent.click(q('.data-grid__head-cell')!)
      else await userEvent.keyboard(`{${key}}`)
    }

    await enter('7', 'Enter')
    await expect.poll(() => range()).toContain('151–175')
    await enter('9', 'blur')
    await expect.poll(() => range()).toContain('201–225')
    await enter('1000', 'Enter')
    await expect.poll(() => range()).toContain('976–1,000')
    expect(field()!.value).toBe(String(PAGES))
    await enter('0', 'Enter')
    await expect.poll(() => range()).toContain('1–25')

    await enter('abc', 'Enter')
    await expect.poll(() => field()!.value).toBe('1')
    await enter('', 'Enter')
    await expect.poll(() => field()!.value).toBe('1')
    await enter('12', 'Escape')
    await expect.poll(() => field()!.value).toBe('1')
    expect(range()).toContain('1–25')
    expect(calls).toEqual([6, 8, 39, 0])
  })

  test('PJ16: поле вмещает номер последней страницы с отступами кита и запасом под каретку — и двузначный, и с разделителем разрядов', async () => {
    for (const pageSize of [25, 1]) {
      const screen = await mount({ mode: 'input', pageSize })
      await humanClick(action('last'))
      await expect.poll(() => field()!.value).not.toBe('1')
      const style = getComputedStyle(field()!)
      const room =
        field()!.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      const probe = document.createElement('span')
      probe.style.fontFamily = style.fontFamily
      probe.style.fontSize = style.fontSize
      probe.style.fontVariantNumeric = style.fontVariantNumeric
      probe.textContent = field()!.value
      document.body.append(probe)
      const text = probe.getBoundingClientRect().width
      probe.remove()
      // Запас под каретку: без него браузер обрезает номер.
      expect(text + 4, field()!.value).toBeLessThanOrEqual(room)
      expect(parseFloat(style.paddingLeft)).toBe(
        parseFloat(
          style.getPropertyValue('--tsr-comp-field-padding-x') || '12',
        ),
      )
      await screen.unmount()
    }
  })

  test('PJ8: в компактном и двухстрочном виде панели номера и поле скрыты, видны четыре кнопки; смена вида ничего не перемонтирует', async () => {
    const screen = await mount()
    const before = number(2)!
    expect(shown(action('last'))).toBe(false)

    for (const [width, kind] of [
      [440, 'compact'],
      [300, 'stacked'],
    ] as const) {
      await screen.rerender(<Grid width={width} />)
      await expect.poll(layout).toBe(kind)
      expect(shown(numbers())).toBe(false)
      for (const name of ['first', 'previous', 'next', 'last'])
        expect(shown(action(name)), `${kind}: ${name}`).toBe(true)
    }

    await screen.rerender(<Grid />)
    await expect.poll(layout).toBe('full')
    expect(shown(numbers())).toBe(true)
    expect(shown(action('last'))).toBe(false)
    expect(number(2)).toBe(before)
    await screen.unmount()

    const input = await mount({ mode: 'input' })
    await input.rerender(<Grid mode="input" width={300} />)
    await expect.poll(layout).toBe('stacked')
    expect(shown(field())).toBe(false)
  })

  test('PJ9: итог неизвестен — четыре кнопки; итог пришёл — номера; итог снова неизвестен — четыре кнопки', async () => {
    let total: number | undefined
    let last = 1000
    const getRows = async ({ start, end }: ServerRowsRequest) => ({
      rows: Array.from(
        { length: Math.max(0, Math.min(end, last) - start) },
        (_, k) => ({ id: `r${start + k}`, name: `N${start + k}` }),
      ),
      ...(total === undefined ? {} : { rowCount: total }),
    })
    let table: {
      refreshRows: (options?: { purge?: boolean }) => void
      setPageIndex: (index: number) => void
    }
    await render(
      <ServerGrid
        getRows={getRows}
        onTable={value => {
          table = value as typeof table
        }}
      />,
    )
    await expect.poll(() => range()).toContain('1–25')
    expect(range()).toBe(labels.pageRangeOfMany(1, 25))
    expect(numbers()).toBeNull()
    for (const name of ['first', 'previous', 'next', 'last'])
      expect(shown(action(name)), name).toBe(true)

    total = 1000
    table!.refreshRows({ purge: true })
    await expect.poll(numbers).not.toBeNull()
    expect(shown(action('last'))).toBe(false)
    expect(number(PAGES)).not.toBeNull()

    total = undefined
    table!.refreshRows({ purge: true })
    await expect.poll(numbers).toBeNull()
    expect(shown(action('last'))).toBe(true)
    last = 1000
  })

  test('PJ10: серверный переход номером — ряд показывает новую страницу, отказ откатывает её, отмена в плашке возвращает прежнюю без отказа', async () => {
    let answer: { reject: (error: Error) => void } | undefined
    let signal: AbortSignal | undefined
    onPageChange = (...args) =>
      new Promise((_, reject) => {
        answer = { reject }
        signal = (args[2] as { signal: AbortSignal }).signal
        signal.addEventListener('abort', () => reject(signal!.reason), {
          once: true,
        })
      })
    await mount({ server: true })
    const failure = () => q('[data-testid="load-error-banner"]')

    await humanClick(number(5)!)
    await expect.poll(current).toBe('5')
    answer!.reject(new Error('Refused'))
    await expect.poll(current).toBe('1')
    await expect.poll(failure).not.toBeNull()
    expect(failure()!.textContent).toContain('Refused')

    await humanClick(
      failure()!.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.loadErrorDismiss}"]`,
      )!,
    )
    await expect.poll(failure).toBeNull()

    await humanClick(number(3)!)
    await expect.poll(current).toBe('3')
    await expect
      .poll(() => q('[data-testid="pending-action-cancel"]'), { timeout: 3000 })
      .not.toBeNull()
    await humanClick(q('[data-testid="pending-action-cancel"]')!)
    await expect.poll(() => signal!.aborted).toBe(true)
    await expect.poll(current).toBe('1')
    expect(failure()).toBeNull()
  })

  test('PJ12: номера и поле — клавиатура, axe с color-contrast в обеих темах, forced-colors, зона нажатия не меньше 24×24', async () => {
    const rules = { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } }
    const check = async () => {
      await inBothThemes(async () => {
        const result = await axe.run(q('[data-testid="pagination"]')!, {
          ...AXE_OPTIONS,
          rules,
        })
        expect(result.violations.map(v => v.id)).toEqual([])
      })
    }
    const screen = await mount()
    await check()
    for (const button of numbers()!.querySelectorAll('button')) {
      const box = button.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(24)
      expect(box.height).toBeGreaterThanOrEqual(24)
    }

    action('previous').focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(number(1))
    await userEvent.tab()
    expect(document.activeElement).toBe(number(2))

    await fx.forcedColors(true)
    const fill = () => toRgba(getComputedStyle(number(1)!).backgroundColor)
    await expect
      .poll(fill)
      .toEqual(
        toRgba(tokenColor('--tsr-comp-segments-selected-bg', number(1)!)),
      )
    expect(fill()).not.toEqual(
      toRgba(getComputedStyle(number(2)!).backgroundColor),
    )
    expect(toRgba(getComputedStyle(number(1)!).color)).toEqual(
      toRgba(tokenColor('--tsr-comp-segments-selected-color', number(1)!)),
    )
    await fx.forcedColors(false)
    await screen.unmount()

    await mount({ mode: 'input' })
    await check()
  })

  test('PJ14: pageNumbers работает на клиентской и серверной модели строк', async () => {
    const client = await mount()
    await humanClick(number(PAGES)!)
    await expect.poll(current).toBe(String(PAGES))
    await client.unmount()

    await render(
      <ServerGrid
        getRows={async ({ start, end }) => ({
          rows: Array.from({ length: end - start }, (_, k) => ({
            id: `r${start + k}`,
            name: `N${start + k}`,
          })),
          rowCount: 1000,
        })}
        onTable={() => {}}
      />,
    )
    await expect.poll(numbers).not.toBeNull()
    await humanClick(number(PAGES)!)
    await expect.poll(current).toBe(String(PAGES))
    await expect.poll(() => range()).toContain('976–1,000')
  })

  test('PJ15: pageNumbers: false — четыре кнопки, как в ADR 0038', async () => {
    await mount({ mode: false })
    expect(numbers()).toBeNull()
    expect(field()).toBeNull()
    for (const name of ['first', 'previous', 'next', 'last'])
      expect(shown(action(name)), name).toBe(true)
    await humanClick(action('last'))
    await expect.poll(() => range()).toContain('976–1,000')
  })
})
