import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useMemo, type CSSProperties, type ReactNode } from 'react'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import type { ErrorStubRender } from '../../../grid/loadError/LoadError'
import type { TableLabels } from '../../../core/localization'
import type { TableIcons } from '../../../ui/icons'
import { keyboardNavigation, quickSearch, rowExpanding } from '../../../plugins'
import { humanClick } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

// Ошибка загрузки данных (ADR 0096, LE1–LE15, LE17): красный свет под шапкой, плашка
// ошибки обновления, заглушка ошибки первой загрузки, повтор, объявление, клавиатура,
// режимы, плавность. LE16 — сценарий в `play` истории «Refresh error — server».

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
  a: string
  b: string
  c: string
  subRows?: Item[]
}

/** Вызовы функции ячейки колонки `a` — признак перерисовки строк тела (LE15). */
let cellRenders = 0

const COLUMNS = [
  {
    id: 'a',
    accessorKey: 'a',
    header: 'A',
    size: 240,
    cell: (info: { getValue: () => unknown }) => {
      cellRenders += 1
      return info.getValue() as string
    },
  },
  { id: 'b', accessorKey: 'b', header: 'B', size: 240 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 240 },
]

const DATA: Item[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  a: `A${i}`,
  b: `B${i}`,
  c: `C${i}`,
}))
const TREE: Item[] = DATA.slice(0, 4).map(item => ({
  ...item,
  subRows: [{ id: `${item.id}-1`, a: 'x', b: 'y', c: 'z' }],
}))
const EMPTY: Item[] = []

type Mode = 'plain' | 'keyboard' | 'tree' | 'search'

interface GridProps {
  data?: Item[]
  loadError?: unknown
  onRetry?: () => unknown
  enableLoading?: boolean
  enableSkeleton?: boolean
  minDurationMs?: number
  errorStub?: ErrorStubRender
  stub?: ReactNode
  mode?: Mode
  localization?: Partial<TableLabels>
  icons?: Partial<TableIcons>
  style?: CSSProperties
  width?: number
}

let api: { setGlobalFilter: (value: string) => void } | undefined

const Grid = ({
  data = DATA,
  loadError,
  onRetry,
  enableLoading,
  enableSkeleton,
  minDurationMs = 0,
  errorStub,
  stub,
  mode = 'plain',
  localization,
  icons,
  style,
  width = 600,
}: GridProps) => {
  // Набор плагинов — договор на время жизни таблицы: режим стенда не меняется.
  const plugins = useMemo(
    () =>
      mode === 'keyboard'
        ? [keyboardNavigation()]
        : mode === 'tree'
          ? [rowExpanding(), keyboardNavigation()]
          : mode === 'search'
            ? [quickSearch()]
            : [],
    [mode],
  )
  const loadingOptions = useMemo(
    () => ({ delayMs: 0, minDurationMs }),
    [minDurationMs],
  )
  const table = useCreateTable({
    columns: COLUMNS as never,
    data,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    plugins: plugins as never,
    enableLoading,
    enableSkeleton,
    loadingOptions,
    loadError,
    onRetry,
  })
  api = table as unknown as typeof api
  return (
    <>
      <button type="button" data-testid="before">
        before
      </button>
      <div style={{ width, height: 420 }}>
        <DataGrid
          table={table as never}
          errorStub={errorStub}
          stub={stub}
          localization={localization}
          icons={icons}
          style={
            {
              '--tsr-comp-error-flash-duration': '500ms',
              '--tsr-comp-error-flash-fill-duration': '150ms',
              ...style,
            } as CSSProperties
          }
        />
      </div>
    </>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const banner = () => q('[data-testid="load-error-banner"]')
const stubEl = () => q('[data-testid="load-error-stub"]')
const retryButton = () =>
  q<HTMLButtonElement>('[data-testid="load-error-retry"]')
const dismissButton = () =>
  q<HTMLButtonElement>('[data-testid="load-error-dismiss"]')
const loader = () => q('[class*="linear-progress"]')!
const flashPhase = () => loader().getAttribute('data-error-flash')
const red = () => getComputedStyle(loader(), '::after')
const wrapper = () => q('.data-grid-theme')!
const scroller = () => q('.data-grid__container')!
const liveRegion = () => q('[role="status"][aria-live="polite"]')!
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitRows = () =>
  expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)

/** Смонтировать стенд и вернуть перерисовку с частичной сменой пропов. */
const mount = async (initial: GridProps = {}) => {
  let props = initial
  const screen = await render(<Grid {...props} />)
  return {
    screen,
    update: async (next: GridProps) => {
      props = { ...props, ...next }
      await screen.rerender(<Grid {...props} />)
    },
  }
}

const SERVER_DOWN = new Error('Server responded 503')

describe('Ошибка обновления: свет и плашка', () => {
  test('LE1: loadError при данных — свечение перерастает в ровный красный, держится и гаснет; без идущего обновления красный нарастает от нуля', async () => {
    const { update } = await mount()
    await waitRows()
    await update({ enableLoading: true })
    await expect
      .poll(() => q('[class*="linear-progress"] > [class*="glows"]'))
      .not.toBeNull()
    await pause(200)
    await update({ enableLoading: false, loadError: SERVER_DOWN })
    expect(flashPhase()).toBe('on')
    // Синее гаснет, красный нарастает — переход, а не скачок.
    await frame()
    expect(Number(red().opacity)).toBeLessThan(1)
    await expect.poll(() => red().opacity).toBe('1')
    expect(red().backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    const glows = q('[class*="linear-progress"] > [class*="glows"]')
    expect(glows === null || getComputedStyle(glows).opacity === '0').toBe(true)
    await expect.poll(flashPhase, { timeout: 2000 }).toBe('off')
    await expect.poll(flashPhase, { timeout: 2000 }).toBeNull()
    expect(red().opacity).toBe('0')

    // Без идущего обновления — от нуля.
    await update({ loadError: null })
    await update({ loadError: new Error('Again') })
    expect(flashPhase()).toBe('on')
    expect(Number(red().opacity)).toBeLessThan(0.5)
    await expect.poll(() => red().opacity).toBe('1')
  })

  test('LE2: при ошибке обновления тело не приглушено сразу, без минимума показа, и откликается на наведение', async () => {
    const { update } = await mount({ minDurationMs: 5000 })
    await waitRows()
    await update({ enableLoading: true })
    await expect
      .poll(() => wrapper().hasAttribute('data-refreshing'))
      .toBe(true)
    await update({ enableLoading: false, loadError: SERVER_DOWN })
    await frame()
    expect(wrapper().hasAttribute('data-refreshing')).toBe(false)
    const row = q('.data-grid__body-row[data-row-id="r2"]')!
    await expect
      .poll(() => getComputedStyle(q('.data-grid__body')!).opacity)
      .toBe('1')
    const rest = getComputedStyle(row).backgroundColor
    await userEvent.hover(row)
    await expect
      .poll(() => getComputedStyle(row).backgroundColor)
      .not.toBe(rest)
  })

  test('LE3: плашка под шапкой по центру видимой ширины — иконка, заголовок, причина, «Retry», «Dismiss»; длинная причина — с многоточием и тултипом; раскладку не сдвигает, при горизонтальной прокрутке на месте', async () => {
    const { update } = await mount({ onRetry: () => {}, width: 520 })
    await waitRows()
    const rowTop = () =>
      q('.data-grid__body-row[data-row-id="r0"]')!.getBoundingClientRect().top
    const before = rowTop()
    await update({ loadError: SERVER_DOWN })
    await expect.poll(banner).not.toBeNull()
    await pause(250)
    const box = banner()!.getBoundingClientRect()
    const area = scroller().getBoundingClientRect()
    const visible = area.left + scroller().clientWidth / 2
    expect(Math.abs(box.left + box.width / 2 - visible)).toBeLessThan(1.5)
    const head = q('.data-grid__head-cell')!.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(head.bottom)
    expect(banner()!.querySelector('svg')).not.toBeNull()
    expect(banner()!.textContent).toContain("Couldn't refresh the data")
    expect(banner()!.textContent).toContain('Server responded 503')
    expect(retryButton()).not.toBeNull()
    expect(dismissButton()).not.toBeNull()
    expect(rowTop()).toBe(before)

    scroller().scrollLeft = 120
    await frame()
    expect(banner()!.getBoundingClientRect().left).toBeCloseTo(box.left, 0)

    // Без причины — только заголовок.
    await update({ loadError: new Error('') })
    await expect
      .poll(() => banner()?.querySelector('[class*="reason"]') ?? null)
      .toBeNull()
    expect(banner()!.textContent).toContain("Couldn't refresh the data")

    // Длинная причина — многоточие, полный текст в тултипе.
    const long = `Gateway timeout ${'while aggregating orders '.repeat(8)}`
    await update({ loadError: new Error(long) })
    const reason = () =>
      banner()!.querySelector<HTMLElement>('[class*="reason"]')!
    await expect.poll(() => reason()?.textContent).toBe(long.trim())
    expect(reason().scrollWidth).toBeGreaterThan(reason().clientWidth)
    expect(getComputedStyle(reason()).textOverflow).toBe('ellipsis')
    await userEvent.hover(reason())
    await expect
      .poll(
        () =>
          [...document.querySelectorAll('[data-side]')].some(
            el => el.textContent?.trim() === long.trim(),
          ),
        { timeout: 2000 },
      )
      .toBe(true)
  })

  test('LE4: «Retry» вызывает onRetry — в плашке она уходит и возвращается с той же ошибкой по окончании повтора, фокус в теле; в заглушке кнопка в ожидании; без onRetry кнопки нет', async () => {
    const onRetry = vi.fn()
    const { update, screen } = await mount({
      onRetry,
      loadError: SERVER_DOWN,
      mode: 'keyboard',
    })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    await humanClick(retryButton()!)
    expect(onRetry).toHaveBeenCalledTimes(1)
    await expect.poll(banner).toBeNull()
    expect(scroller().contains(document.activeElement)).toBe(true)
    // Повтор идёт — плашки нет; закончился той же ошибкой — плашка снова.
    await update({ enableLoading: true })
    await pause(100)
    expect(banner()).toBeNull()
    await update({ enableLoading: false })
    await expect.poll(banner).not.toBeNull()
    await screen.unmount()

    // Заглушка: повтор с промисом — кнопка в ожидании, нажатия не повторяют.
    const pending = vi.fn(() => new Promise<void>(() => {}))
    const stub = await mount({
      data: EMPTY,
      loadError: SERVER_DOWN,
      onRetry: pending,
    })
    await expect.poll(stubEl).not.toBeNull()
    await userEvent.click(retryButton()!)
    await expect
      .poll(() => retryButton()?.getAttribute('aria-busy'))
      .toBe('true')
    await userEvent.click(retryButton()!)
    expect(pending).toHaveBeenCalledTimes(1)
    await stub.update({ onRetry: undefined })
    expect(retryButton()).toBeNull()
    await stub.screen.unmount()

    await mount({ loadError: SERVER_DOWN })
    await expect.poll(banner).not.toBeNull()
    expect(retryButton()).toBeNull()
  })

  test('LE5: плашка уходит, когда loadError снят; «Dismiss» прячет её до нового значения; повторный рендер с тем же значением её не возвращает', async () => {
    const { update } = await mount({ loadError: SERVER_DOWN })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    await update({ loadError: null })
    await expect.poll(banner).toBeNull()

    const failure = new Error('Down again')
    await update({ loadError: failure })
    await expect.poll(banner).not.toBeNull()
    await userEvent.click(dismissButton()!)
    await expect.poll(banner).toBeNull()
    await update({ loadError: failure, enableLoading: false })
    await pause(150)
    expect(banner()).toBeNull()
    await update({ loadError: new Error('Down once more') })
    await expect.poll(banner).not.toBeNull()
  })

  test('LE6: новое значение loadError — новая вспышка и снова плашка; то же значение — без вспышки', async () => {
    const { update } = await mount()
    await waitRows()
    const first = new Error('First')
    await update({ loadError: first })
    expect(flashPhase()).toBe('on')
    await expect.poll(flashPhase, { timeout: 2000 }).toBeNull()
    await update({ loadError: first })
    await frame()
    expect(flashPhase()).toBeNull()
    await userEvent.click(dismissButton()!)
    await expect.poll(banner).toBeNull()
    await update({ loadError: new Error('Second') })
    expect(flashPhase()).toBe('on')
    await expect.poll(banner).not.toBeNull()
  })
})

describe('Ошибка первой загрузки: заглушка', () => {
  test('LE7: loadError без строк — заглушка поверх пустого тела вместо скелета и stub: иконка, заголовок, причина, «Retry»; шапка на месте', async () => {
    await mount({
      data: EMPTY,
      enableSkeleton: true,
      loadError: SERVER_DOWN,
      onRetry: () => {},
      stub: <div data-testid="app-stub">No data</div>,
    })
    await expect.poll(stubEl).not.toBeNull()
    expect(stubEl()!.querySelector('svg')).not.toBeNull()
    expect(stubEl()!.textContent).toContain("Couldn't load the data")
    expect(stubEl()!.textContent).toContain('Server responded 503')
    expect(retryButton()).not.toBeNull()
    expect(q('[data-testid="app-stub"]')).toBeNull()
    expect(q('[class*="skeleton"]')).toBeNull()
    expect(document.querySelectorAll('.data-grid__head-cell').length).toBe(3)
    const head = q('.data-grid__head-cell')!.getBoundingClientRect()
    const stubBox = stubEl()!.getBoundingClientRect()
    expect(stubBox.top).toBeGreaterThanOrEqual(head.bottom - 1)
    expect(stubBox.width).toBeCloseTo(scroller().clientWidth, 0)
  })

  test('LE8: errorStub переопределяет заглушку — узел или функция от { error, retry }', async () => {
    const onRetry = vi.fn()
    const { update } = await mount({
      data: EMPTY,
      loadError: SERVER_DOWN,
      onRetry,
      errorStub: <p data-testid="own">Own stub</p>,
    })
    await expect.poll(() => q('[data-testid="own"]')).not.toBeNull()
    expect(stubEl()!.textContent).toBe('Own stub')
    await update({
      errorStub: ({ error, retry }) => (
        <button type="button" data-testid="own-retry" onClick={retry}>
          {(error as Error).message}
        </button>
      ),
    })
    await expect
      .poll(() => q('[data-testid="own-retry"]')?.textContent)
      .toBe('Server responded 503')
    await userEvent.click(q('[data-testid="own-retry"]')!)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  test('LE9: ошибка без данных главнее скелета, stub и filterStub; без ошибки — как раньше', async () => {
    const skeleton = await mount({ data: EMPTY, enableSkeleton: true })
    await expect
      .poll(() => q('.data-grid__container[class*="skeleton"]'))
      .not.toBeNull()
    await skeleton.update({ loadError: SERVER_DOWN })
    await expect.poll(stubEl).not.toBeNull()
    expect(q('.data-grid__container[class*="skeleton"]')).toBeNull()
    await skeleton.screen.unmount()

    const own = await mount({
      data: EMPTY,
      stub: <div data-testid="app-stub">No data</div>,
    })
    await expect.poll(() => q('[data-testid="app-stub"]')).not.toBeNull()
    await own.update({ loadError: SERVER_DOWN })
    await expect.poll(stubEl).not.toBeNull()
    expect(q('[data-testid="app-stub"]')).toBeNull()
    await own.screen.unmount()

    const search = await mount({ mode: 'search' })
    await waitRows()
    api!.setGlobalFilter('nothing matches')
    await expect.poll(() => q('[data-testid="filter-stub"]')).not.toBeNull()
    await search.update({ loadError: SERVER_DOWN })
    await expect.poll(stubEl).not.toBeNull()
    expect(q('[data-testid="filter-stub"]')).toBeNull()
  })
})

describe('Объявление, клавиатура, подписи', () => {
  test('LE10: объявление один раз на новое значение loadError — заголовок и причина; окончание загрузки с ошибкой не объявляет строки; фокус не переносится', async () => {
    const { update } = await mount()
    await waitRows()
    const outside = q<HTMLButtonElement>('[data-testid="before"]')!
    outside.focus()
    // Каждое объявление — новый узел области: пишем все, а не только последнее.
    const said: string[] = []
    const observer = new MutationObserver(() =>
      said.push(liveRegion().textContent ?? ''),
    )
    observer.observe(liveRegion(), { childList: true, subtree: true })
    await update({ enableLoading: true })
    await pause(50)
    await update({ enableLoading: false, loadError: SERVER_DOWN })
    await expect
      .poll(() => liveRegion().textContent)
      .toBe("Couldn't refresh the data: Server responded 503")
    await pause(100)
    observer.disconnect()
    expect(said.some(text => text.includes('Loaded'))).toBe(false)
    expect(document.activeElement).toBe(outside)
    const node = liveRegion().firstElementChild
    await update({ loadError: SERVER_DOWN })
    await pause(100)
    expect(liveRegion().firstElementChild).toBe(node)

    // Повтор закончился той же ошибкой: новой ошибки нет — и строк не объявляем.
    await update({ enableLoading: true })
    await pause(50)
    await update({ enableLoading: false })
    await pause(150)
    expect(liveRegion().firstElementChild).toBe(node)
    expect(liveRegion().textContent).not.toContain('Loaded')
    await update({ loadError: null, data: EMPTY })
    await update({ loadError: 'Disk is full' })
    await expect
      .poll(() => liveRegion().textContent)
      .toBe("Couldn't load the data: Disk is full")
  })

  test('LE11: «Retry» и «Dismiss» — в порядке Tab перед телом, Enter и Space работают; после «Dismiss» фокус в теле', async () => {
    const onRetry = vi.fn()
    const { update } = await mount({
      loadError: SERVER_DOWN,
      onRetry,
      mode: 'keyboard',
    })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    q<HTMLButtonElement>('[data-testid="before"]')!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(retryButton())
    await userEvent.tab()
    expect(document.activeElement).toBe(dismissButton())
    await userEvent.tab()
    expect(scroller().contains(document.activeElement)).toBe(true)

    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(retryButton())
    await userEvent.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledTimes(1)

    // «Dismiss» пробелом: плашка закрыта, фокус в теле.
    await update({ loadError: new Error('Down again') })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    dismissButton()!.focus()
    await userEvent.keyboard(' ')
    await expect.poll(banner).toBeNull()
    expect(scroller().contains(document.activeElement)).toBe(true)
  })
})

/** Длительность токена в вычисленном виде (`0.15s`), как её отдаёт браузер. */
const durationOf = (token: string) => {
  const probe = document.createElement('span')
  probe.style.animationDuration = `var(${token})`
  wrapper().appendChild(probe)
  const value = getComputedStyle(probe).animationDuration
  probe.remove()
  return value
}

/** Системный цвет палитры, как его отдаёт браузер. */
const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

describe('Подписи, режимы, доступность, перерисовка, плавность', () => {
  test('LE12: подписи — localization, иконка — icons.loadFailed, вид — токены --tsr-comp-load-error-*', async () => {
    const OwnIcon = (props: Record<string, unknown>) => (
      <svg data-testid="own-icon" {...props} />
    )
    const labels = {
      loadErrorTitle: 'Обновить не удалось',
      loadFailedTitle: 'Загрузить не удалось',
      loadRetry: 'Ещё раз',
      loadErrorDismiss: 'Скрыть',
    }
    const tokens = {
      '--tsr-comp-load-error-banner-bg': 'rgb(1, 2, 3)',
      '--tsr-comp-load-error-icon-color': 'rgb(200, 0, 0)',
      '--tsr-comp-load-error-banner-max-width': '300px',
      '--tsr-comp-load-error-glow': 'rgb(9, 8, 7)',
    } as CSSProperties
    const first = await mount({
      loadError: SERVER_DOWN,
      onRetry: () => {},
      localization: labels,
      icons: { loadFailed: OwnIcon as never },
      style: tokens,
    })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    expect(banner()!.textContent).toContain('Обновить не удалось')
    expect(retryButton()!.textContent).toContain('Ещё раз')
    expect(dismissButton()!.getAttribute('aria-label')).toBe('Скрыть')
    const icon = banner()!.querySelector('[data-testid="own-icon"]')!
    expect(icon).not.toBeNull()
    expect(getComputedStyle(icon).color).toBe('rgb(200, 0, 0)')
    expect(getComputedStyle(banner()!).backgroundColor).toBe('rgb(1, 2, 3)')
    expect(banner()!.getBoundingClientRect().width).toBeLessThanOrEqual(300)
    expect(red().backgroundColor).toBe('rgb(9, 8, 7)')
    await first.screen.unmount()

    await mount({
      data: EMPTY,
      loadError: SERVER_DOWN,
      onRetry: () => {},
      localization: labels,
      icons: { loadFailed: OwnIcon as never },
    })
    await expect.poll(stubEl).not.toBeNull()
    expect(stubEl()!.textContent).toContain('Загрузить не удалось')
    expect(stubEl()!.querySelector('[data-testid="own-icon"]')).not.toBeNull()
  })

  test('LE13: уменьшенное движение — красный сразу и снимается без перехода; высокая контрастность — линия Mark вместо свечения, плашка с контуром', async () => {
    await fx.reducedMotion(true)
    const calm = await mount()
    await waitRows()
    await calm.update({ loadError: SERVER_DOWN })
    await frame()
    await frame()
    expect(red().opacity).toBe('1')
    // Удержание — по таймеру, гаснет без перехода.
    await expect.poll(flashPhase, { timeout: 2000 }).toBeNull()
    expect(red().opacity).toBe('0')
    await calm.screen.unmount()
    await fx.reducedMotion(false)

    // WebKit цвета в forced-colors не подменяет (ADR 0087).
    if (server.browser === 'webkit') return
    await fx.forcedColors(true)
    try {
      const forced = await mount()
      await waitRows()
      await forced.update({ loadError: new Error('Down') })
      const line = q('.data-grid__loader-line')!
      expect(getComputedStyle(line).display).toBe('block')
      expect(getComputedStyle(line).backgroundColor).toBe(sys('Mark'))
      expect(red().display).toBe('none')
      await expect.poll(banner).not.toBeNull()
      expect(getComputedStyle(banner()!).outlineStyle).toBe('solid')
    } finally {
      await fx.forcedColors(false)
    }
  })

  test('LE14: плашка и заглушка проходят axe с color-contrast в обеих темах и ролях table, grid, treegrid', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    for (const [mode, role] of [
      ['plain', 'table'],
      ['keyboard', 'grid'],
      ['tree', 'treegrid'],
    ] as const) {
      const view = await mount({
        mode,
        data: mode === 'tree' ? TREE : DATA,
        loadError: SERVER_DOWN,
        onRetry: () => {},
      })
      await waitRows()
      await expect.poll(banner).not.toBeNull()
      expect(q(`[role="${role}"]`), role).not.toBeNull()
      await inBothThemes(async () => {
        await pause(250)
        expect((await axe.run(wrapper(), options)).violations, role).toEqual([])
      })
      await view.screen.unmount()
    }

    await mount({ data: EMPTY, loadError: SERVER_DOWN, onRetry: () => {} })
    await expect.poll(stubEl).not.toBeNull()
    await inBothThemes(async () => {
      await pause(250)
      expect((await axe.run(wrapper(), options)).violations).toEqual([])
    })
  })

  test('LE15: смена loadError не перерисовывает строки тела', async () => {
    const { update } = await mount()
    await waitRows()
    await pause(150)
    const before = cellRenders
    expect(before).toBeGreaterThan(0)
    await update({ loadError: SERVER_DOWN })
    await expect.poll(banner).not.toBeNull()
    await update({ loadError: null })
    await update({ loadError: new Error('Down again') })
    await pause(150)
    expect(cellRenders).toBe(before)
  })

  test('LE17: плашка проявляется и уходит за --tsr-comp-motion-duration, свечение — за --tsr-comp-loader-fade-duration; уходя, плашка держит причину и не ловит указатель; без движения — сразу', async () => {
    const glows = () => q('[class*="linear-progress"] > [class*="glows"]')
    const view = await mount()
    await waitRows()
    await view.update({ enableLoading: true })
    await expect.poll(glows).not.toBeNull()
    expect(getComputedStyle(glows()!).animationName).toContain('loader-fade-in')
    expect(getComputedStyle(glows()!).animationDuration).toBe(
      durationOf('--tsr-comp-loader-fade-duration'),
    )
    await view.update({ enableLoading: false })
    await frame()
    expect(glows()!.getAttribute('data-leaving')).toBe('true')
    expect(getComputedStyle(glows()!).transitionDuration).toBe(
      durationOf('--tsr-comp-loader-fade-duration'),
    )
    await expect.poll(glows).toBeNull()

    await view.update({ loadError: SERVER_DOWN })
    await expect.poll(banner).not.toBeNull()
    expect(getComputedStyle(banner()!).animationName).toContain(
      'load-error-banner-in',
    )
    expect(getComputedStyle(banner()!).animationDuration).toBe(
      durationOf('--tsr-comp-motion-duration'),
    )
    await pause(250)
    await view.update({ loadError: null })
    await frame()
    expect(banner()!.getAttribute('data-leaving')).toBe('true')
    expect(banner()!.textContent).toContain('Server responded 503')
    expect(getComputedStyle(banner()!).pointerEvents).toBe('none')
    await expect
      .poll(() => (banner() ? Number(getComputedStyle(banner()!).opacity) : 0))
      .toBeLessThan(1)
    await expect.poll(banner).toBeNull()
    await view.screen.unmount()

    await fx.reducedMotion(true)
    const calm = await mount({ loadError: SERVER_DOWN })
    await waitRows()
    await expect.poll(banner).not.toBeNull()
    await calm.update({ loadError: null })
    await frame()
    await frame()
    expect(banner()).toBeNull()
  })
})
