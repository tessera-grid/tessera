import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  Stories,
  bodyRows,
  getScroller,
  headCells,
  humanClick,
  scrollToEnd,
} from '../helpers'
import { composed } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { pinFirstColumn } from './column-pinning-helpers'
import { tableLabels } from '../labels'

// Асинхронный контракт бизнес-колбэков (ADR 0041, AS2–AS3, AS5–AS6, AS11, AS13, AS15):
// сохранение с промисом отделяет ячейку в ожидание, правка других ячеек не ждёт
// сервера, отказ —
// «ошибка» с черновиком; раскрытие ждёт подгрузки. AS1, AS4, AS7–AS10, AS12 —
// модульные
// (`src/lib/__tests__/asyncCallbacks.dom.test.tsx`). Ожидание и отказ сохранения
// показывает кнопка правки (ADR 0127, IR16); IR21 — модульный там же.

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 30,
}

const allow = () => true
/** Сервер, который не отвечает: ячейка остаётся в ожидании. */
const never = () => new Promise<void>(() => {})

const ageCell = (index: number) =>
  bodyRows()
    .find(row => row.dataset.index === String(index))!
    .querySelector<HTMLElement>('.data-grid__body-cell[data-column-id="age"]')!

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const editButtonOf = (index: number) =>
  ageCell(index).querySelector<HTMLElement>('.cell__button button')

/** Отметка отказа на кнопке правки: есть ли и видна ли. */
const failureOf = (index: number) =>
  ageCell(index).querySelector('[data-failure-indicator]')
const failureShown = (index: number) =>
  failureOf(index)?.getAttribute('data-shown') === 'true'

/** Содержимое ячейки без её кнопок. */
const contentOf = (index: number) => {
  const clone = ageCell(index).cloneNode(true) as HTMLElement
  clone.querySelectorAll('.cell__button').forEach(button => button.remove())
  return clone
}
const valueOf = (index: number) => contentOf(index).textContent!.trim()

/** Открыть правку ячейки `age` строки и ввести `value`. */
const openAndType = async (index: number, value: string) => {
  await userEvent.hover(ageCell(index))
  await humanClick(
    ageCell(index).querySelector<HTMLElement>('.cell__button button')!,
  )
  await expect.poll(() => ageCell(index).querySelector('input')).not.toBeNull()
  const input = ageCell(index).querySelector<HTMLInputElement>('input')!
  await userEvent.clear(input)
  await userEvent.type(input, value)
  return input
}

/** Сервер, ответ которого задаёт тест: `settle[i]` — итог i-го сохранения. */
const controlledServer = () => {
  const settle: { resolve: () => void; reject: (reason: unknown) => void }[] =
    []
  const onCellEdit = () =>
    new Promise<void>((resolve, reject) => settle.push({ resolve, reject }))
  return { settle, onCellEdit }
}

const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!

describe('Асинхронный контракт бизнес-колбэков', () => {
  test('AS2: onCellEdit вернул промис — редактор закрыт, ячейка показывает отправленное значение, Enter игнорируется', async () => {
    await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEditCell={allow}
        onCellEdit={never}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')

    const busy = () => ageCell(0).querySelector('[aria-busy="true"]')
    await expect.poll(busy).not.toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(valueOf(0)).toBe('999')

    await humanClick(ageCell(0))
    await expect.poll(() => document.activeElement).toBe(ageCell(0))
    await userEvent.keyboard('{Enter}')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(busy()).not.toBeNull()
  })

  test('AS3: пока ячейка ожидает, другую ячейку можно править', async () => {
    await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        cellEditingCanEditCell={allow}
        onCellEdit={never}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .not.toBeNull()

    const input = await openAndType(1, '42')
    expect(input.value).toBe('42')
    expect(ageCell(0).querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('AS5: промис отклонён — ячейка показывает значение из data, отказ объявлен; активная правка другой ячейки не тронута', async () => {
    const server = controlledServer()
    await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        cellEditingCanEditCell={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    const original = valueOf(0)
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(1)
    const active = await openAndType(1, '42')

    server.settle[0].reject(new Error('Server down'))
    await expect
      .poll(() => liveRegion().textContent)
      .toContain('Age: Server down')
    expect(valueOf(0)).toBe(original)

    expect(ageCell(1).querySelector('input')).toBe(active)
    expect(active.value).toBe('42')
    expect(document.activeElement).toBe(active)
  })

  test('AS6: из «ошибки» Enter или кнопка правки открывают редактор с черновиком и текстом ошибки; успешное сохранение снимает ошибку', async () => {
    const server = controlledServer()
    await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEditCell={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    const failed = failureOf
    await openAndType(1, '42')
    await userEvent.keyboard('{Enter}')
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(2)
    server.settle[0].reject(new Error('Server down'))
    server.settle[1].reject(new Error('Server down'))
    await expect.poll(() => failed(0) && failed(1)).toBeTruthy()

    // Enter на ячейке в «ошибке».
    await humanClick(ageCell(1))
    await expect.poll(() => document.activeElement).toBe(ageCell(1))
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => ageCell(1).querySelector('input')).not.toBeNull()
    expect(ageCell(1).querySelector<HTMLInputElement>('input')!.value).toBe(
      '42',
    )
    expect(ageCell(1).querySelector('[role="alert"]')!.textContent).toBe(
      'Server down',
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => ageCell(1).querySelector('input')).toBeNull()

    // Кнопка правки на ячейке в «ошибке».

    await userEvent.hover(ageCell(0))
    await humanClick(
      ageCell(0).querySelector<HTMLElement>('.cell__button button')!,
    )
    await expect.poll(() => ageCell(0).querySelector('input')).not.toBeNull()
    const input = ageCell(0).querySelector<HTMLInputElement>('input')!
    expect(input.value).toBe('999')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(ageCell(0).querySelector('[role="alert"]')!.textContent).toBe(
      'Server down',
    )

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(3)
    server.settle[2].resolve()
    await expect
      .poll(() => ageCell(0).querySelector('[aria-busy="true"]'))
      .toBeNull()
    expect(failureOf(0)).toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
  })

  test('AS11: onExpandRow вернул промис при раскрытии — кнопка раскрытия в ожидании, строка с aria-busy, повторное нажатие игнорируется', async () => {
    const onExpandRow = vi.fn(() => new Promise<void>(() => {}))
    const { container } = await render(
      <composed.RowExpandingPlayground onExpandRow={onExpandRow} />,
    )
    const firstExpandable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>('.data-grid__body-row'),
      ).find(row => row.querySelector('.row-expand-button'))!
    await expect.poll(() => firstExpandable()).toBeTruthy()
    const toggle = () =>
      firstExpandable().querySelector<HTMLElement>('.row-expand-button')!

    await userEvent.click(toggle())
    await expect
      .poll(() => firstExpandable().getAttribute('aria-busy'))
      .toBe('true')
    expect(firstExpandable().getAttribute('data-expanded')).toBe('true')
    expect(toggle().getAttribute('aria-busy')).toBe('true')

    await userEvent.click(toggle())
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(onExpandRow).toHaveBeenCalledTimes(1)
    expect(firstExpandable().getAttribute('data-expanded')).toBe('true')
    expect(firstExpandable().getAttribute('aria-busy')).toBe('true')
  })

  test('AS15: без своего onExpandRow или с колбэком без промиса раскрытие не входит в ожидание ни на кадр — ни aria-busy, ни света ожидания и его ухода', async () => {
    const BUSY = ['aria-busy', 'data-pending-leaving']
    for (const onExpandRow of [undefined, vi.fn(() => undefined)]) {
      const screen = await render(
        <composed.RowExpandingPlayground onExpandRow={onExpandRow} />,
      )
      const firstExpandable = () =>
        Array.from(
          document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
        ).find(row => row.querySelector('.row-expand-button'))!
      await expect.poll(() => firstExpandable()).toBeTruthy()
      const row = firstExpandable()

      const seen: string[] = []
      const observer = new MutationObserver(records =>
        records.forEach(record => {
          const target = record.target as Element
          if (target.getAttribute(record.attributeName!) !== null) {
            seen.push(record.attributeName!)
          }
        }),
      )
      observer.observe(row, {
        subtree: true,
        attributes: true,
        attributeFilter: BUSY,
      })
      await userEvent.click(
        row.querySelector<HTMLElement>('.row-expand-button')!,
      )
      await expect.poll(() => row.getAttribute('data-expanded')).toBe('true')
      await new Promise(resolve => setTimeout(resolve, 300))
      observer.disconnect()

      expect(seen).toEqual([])
      if (onExpandRow) expect(onExpandRow).toHaveBeenCalledTimes(1)
      await screen.unmount()
    }
  })

  test('AS13:ожидание, «ошибка» и раскрытие в ожидании проходят axe, включая контраст текста', async () => {
    const grid = () =>
      document.querySelector<HTMLElement>(
        '[role="table"], [role="grid"], [role="treegrid"]',
      )!
    // Общие правила набора доступности плюс контраст текста.
    const run = () =>
      axe.run(grid(), {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })

    const server = controlledServer()
    const cells = await render(
      <Stories.DataGridPlayground
        {...GRID}
        enableCellEditing
        cellEditingCanEditCell={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await openAndType(1, '42')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(2)
    server.settle[1].reject(new Error('Server down'))
    // Отметка проступает после вспышки отказа.
    await expect.poll(() => failureShown(1), { timeout: 5000 }).toBe(true)
    expect(ageCell(0).querySelector('[aria-busy="true"]')).not.toBeNull()
    await inBothThemes(async () => {
      expect((await run()).violations).toEqual([])
    })
    await cells.unmount()

    await render(
      // С навигацией — treegrid: aria-expanded у строк законен только в нём.
      <composed.RowExpandingPlayground
        enableKeyboardNavigation
        onExpandRow={() => new Promise<void>(() => {})}
      />,
    )
    const expandable = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
      ).find(row => row.querySelector('.row-expand-button'))!
    await expect.poll(() => expandable()).toBeTruthy()
    await humanClick(
      expandable().querySelector<HTMLElement>('.row-expand-button')!,
    )
    await expect.poll(() => expandable().getAttribute('aria-busy')).toBe('true')
    expect((await run()).violations).toEqual([])
  })
})

// Обратная связь асинхронной правки (ADR 0057, CF1, CF4–CF6, CF8–CF11): значение в
// ожидании, подсветка сохранения; ожидание и отказ — на кнопке правки (ADR 0127). CF7 —
// модульный (`asyncCallbacks.dom`), CF12 — перф в `scroll`.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

/** Переопределить токены темы грида на время теста. */
const themeTokens = (vars: Record<string, string>) => {
  const style = document.createElement('style')
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  style.textContent = `.data-grid-theme.data-grid-theme { ${body} }`
  document.head.append(style)
  return () => style.remove()
}

/** Значение `value` (цвет или токен), разрешённое в контексте элемента. */
const resolvedIn = (el: Element, value: string, prop = 'background-color') => {
  const probe = document.createElement('span')
  probe.style.setProperty(prop, value)
  el.appendChild(probe)
  const resolved = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return resolved
}

const feedbackOf = (index: number) =>
  ageCell(index).querySelector<HTMLElement>('.cell-edit-feedback')
const tintOf = (index: number) =>
  getComputedStyle(feedbackOf(index)!, '::before')
const savedAt = (index: number) =>
  feedbackOf(index)?.hasAttribute('data-saved') ?? false
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const editableGrid = (props: Record<string, unknown> = {}) =>
  render(
    <Stories.DataGridPlayground
      {...GRID}
      enableCellEditing
      cellEditingCanEditCell={allow}
      {...props}
    />,
  )

/** Сохранить `value` в ячейку `age` строки через Enter. */
const saveAge = async (index: number, value: string) => {
  await openAndType(index, value)
  await userEvent.keyboard('{Enter}')
}

describe('Асинхронная правка: значение и подсветка сохранения', () => {
  let restore = () => {}
  afterEach(async () => {
    restore()
    restore = () => {}
    await reducedMotion(false)
  })

  test('CF1: ячейка в ожидании показывает отправленное значение как текст обычной ячейки — цвет, размер, высота строки, без приглушения; раскладка не меняется', async () => {
    // Песочница с консолью: контейнер крупнее шрифта ячейки — значение не должно его
    // унаследовать. Сервер не отвечает.
    await render(
      <composed.CellEditingPlayground
        enableKeyboardNavigation
        onCellEdit={() => new Promise<void>(() => {})}
      />,
    )
    await waitForGrid()
    const box = (el: HTMLElement) => [
      el.offsetLeft,
      el.offsetTop,
      el.offsetWidth,
      el.offsetHeight,
    ]
    const before = box(ageCell(0))
    const plainColor = getComputedStyle(
      ageCell(2).querySelector('.cell__wrapper') ?? ageCell(2),
    ).color
    await saveAge(0, '999')
    await expect
      .poll(() => editButtonOf(0)?.getAttribute('aria-busy'))
      .toBe('true')

    const value = [...ageCell(0).querySelectorAll<HTMLElement>('*')].find(
      el => el.childElementCount === 0 && el.textContent === '999',
    )!
    expect(getComputedStyle(value).color).toBe(plainColor)
    const plainText = ageCell(2).querySelector<HTMLElement>(
      '[data-testid="table-field-cell-name"]',
    )!
    for (const prop of ['fontSize', 'lineHeight'] as const) {
      expect(getComputedStyle(value)[prop], prop).toBe(
        getComputedStyle(plainText)[prop],
      )
    }
    expect(getComputedStyle(value).opacity).toBe('1')
    expect(box(ageCell(0))).toEqual(before)
  })

  test('CF4: успех промиса — ячейка подсвечена цветом токена, подсветка держится и гаснет; синхронный onCellEdit подсветки не даёт', async () => {
    restore = themeTokens({
      '--tsr-comp-cell-saved-duration': '400ms',
      '--tsr-comp-cell-saved-fade-duration': '200ms',
    })
    const server = controlledServer()
    const screen = await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => server.settle.length).toBe(1)
    server.settle[0].resolve()
    await expect.poll(() => savedAt(0)).toBe(true)
    const shown = performance.now()
    expect(tintOf(0).opacity).toBe('1')
    expect(tintOf(0).backgroundColor).toBe(
      resolvedIn(ageCell(0), 'var(--tsr-comp-cell-saved-color)'),
    )
    await expect.poll(() => savedAt(0)).toBe(false)
    // Удержание — из токена (400 мс), а не умолчание.
    expect(performance.now() - shown).toBeLessThan(900)
    expect(Number(tintOf(0).opacity)).toBeGreaterThan(0)
    await expect.poll(() => tintOf(0).opacity).toBe('0')
    await screen.unmount()

    await editableGrid({ onCellEdit: () => undefined })
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => ageCell(0).querySelector('input')).toBeNull()
    await pause(100)
    expect(feedbackOf(0)).toBeNull()
  })

  test('CF5: успешное сохранение из «ошибки» снимает метку и подсвечивает ячейку', async () => {
    restore = themeTokens({ '--tsr-comp-cell-saved-duration': '60000ms' })
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => server.settle.length).toBe(1)
    server.settle[0].reject(new Error('Server down'))
    await expect.poll(() => failureOf(0)).not.toBeNull()
    expect(savedAt(0)).toBe(false)

    await userEvent.hover(ageCell(0))
    await humanClick(
      ageCell(0).querySelector<HTMLElement>('.cell__button button')!,
    )
    await expect.poll(() => ageCell(0).querySelector('input')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(2)
    server.settle[1].resolve()
    await expect.poll(() => savedAt(0)).toBe(true)
    expect(failureOf(0)).toBeNull()
  })

  test('CF6: ячейка, ушедшая из окна виртуализации по строке и по колонке, подсвечена при возврате до истечения времени; после — нет', async () => {
    // Запас на два круга прокрутки со скелетами быстрой прокрутки в Firefox под StrictMode.
    restore = themeTokens({ '--tsr-comp-cell-saved-duration': '5000ms' })
    await render(
      <Stories.DataGridPlayground
        containerHeight={600}
        height={500}
        columnCount={40}
        dataCount={200}
        enableCellEditing
        cellEditingCanEditCell={allow}
        onCellEdit={() => Promise.resolve()}
      />,
    )
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => savedAt(0)).toBe(true)
    const cellGone = () =>
      !document.querySelector(
        '.data-grid__body-row[data-index="0"] .data-grid__body-cell[data-column-id="age"]',
      )

    for (const axis of ['y', 'x'] as const) {
      await scrollToEnd(axis)
      await expect.poll(cellGone).toBe(true)
      if (axis === 'y') getScroller().scrollTop = 0
      else getScroller().scrollLeft = 0
      // После быстрой прокрутки ячейка сперва — скелет; ждём её содержимое.
      await expect.poll(() => savedAt(0), { timeout: 1500 }).toBe(true)
      expect(tintOf(0).opacity, axis).toBe('1')
    }

    await scrollToEnd('y')
    await expect.poll(cellGone).toBe(true)
    await pause(5100)
    getScroller().scrollTop = 0
    await expect.poll(cellGone).toBe(false)
    await expect
      .poll(() => ageCell(0).querySelector('[class*="skeleton"]'))
      .toBeNull()
    expect(savedAt(0)).toBe(false)
  })

  test('CF8: при уменьшенном движении подсветка сохранения держится ту же длительность и снимается без перехода', async () => {
    await reducedMotion(true)
    restore = themeTokens({
      '--tsr-comp-cell-saved-duration': '400ms',
      '--tsr-comp-cell-saved-fade-duration': '3000ms',
    })
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(1, '42')
    await expect.poll(() => server.settle.length).toBe(1)
    server.settle[0].resolve()
    await expect.poll(() => savedAt(1)).toBe(true)
    await pause(250)
    expect(savedAt(1)).toBe(true)
    await expect.poll(() => savedAt(1)).toBe(false)
    // С переходом подсветка гасла бы ещё три секунды.
    expect(tintOf(1).opacity).toBe('0')
  })

  test('CF9: успех сохранения не объявляется; отказ объявляется', async () => {
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => server.settle.length).toBe(1)
    const before = liveRegion().textContent
    server.settle[0].resolve()
    await expect.poll(() => savedAt(0)).toBe(true)
    await pause(100)
    expect(liveRegion().textContent).toBe(before)

    await saveAge(1, '42')
    await expect.poll(() => server.settle.length).toBe(2)
    server.settle[1].reject(new Error('Server down'))
    await expect
      .poll(() => liveRegion().textContent)
      .toContain('Age: Server down')
  })

  test('CF10: ячейки в ожидании, в «ошибке» и с подсветкой проходят axe; текст под подсветкой держит 4.5:1 в обеих темах', async () => {
    restore = themeTokens({ '--tsr-comp-cell-saved-duration': '60000ms' })
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(0, '1')
    await saveAge(1, '2')
    await saveAge(2, '3')
    await expect.poll(() => server.settle.length).toBe(3)
    server.settle[1].reject(new Error('Server down'))
    server.settle[2].resolve()
    await expect.poll(() => savedAt(2)).toBe(true)
    // Отметка проступает после вспышки отказа.
    await expect.poll(() => failureShown(1), { timeout: 5000 }).toBe(true)
    expect(editButtonOf(0)!.getAttribute('aria-busy')).toBe('true')

    const over = (top: number[], bottom: number[]) => [
      ...[0, 1, 2].map(i => top[i]! * top[3]! + bottom[i]! * (1 - top[3]!)),
      1,
    ]
    const grid = document.querySelector<HTMLElement>(
      '[role="table"], [role="grid"], [role="treegrid"]',
    )!
    await inBothThemes(async () => {
      // Слой лежит и над фоном, и над текстом: axe его не видит — считаем сами.
      const value = ageCell(2).textContent!.trim()
      const text = [...ageCell(2).querySelectorAll<HTMLElement>('*')].find(
        el => el.childElementCount === 0 && el.textContent!.trim() === value,
      )!
      const bg = backgroundOf(ageCell(2))
      const tint = toRgba(tintOf(2).backgroundColor)
      const ratio = contrast(
        over(tint, over(toRgba(getComputedStyle(text).color), bg)),
        over(tint, bg),
      )
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      const result = await axe.run(grid, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(result.violations).toEqual([])
    })
  })

  test('CF11: токены --tsr-comp-cell-saved-* по умолчанию равны --tsr-comp-row-arrival-* и переопределяются отдельно', async () => {
    await editableGrid({ onCellEdit: never })
    await waitForGrid()
    const cell = ageCell(0)
    const pairs = [
      [
        '--tsr-comp-cell-saved-color',
        '--tsr-comp-row-arrival-color',
        'background-color',
      ],
      [
        '--tsr-comp-cell-saved-duration',
        '--tsr-comp-row-arrival-duration',
        'transition-duration',
      ],
      [
        '--tsr-comp-cell-saved-fade-duration',
        '--tsr-comp-row-arrival-fade-duration',
        'transition-duration',
      ],
    ] as const
    for (const [saved, arrival, prop] of pairs) {
      expect(resolvedIn(cell, `var(${saved})`, prop), saved).toBe(
        resolvedIn(cell, `var(${arrival})`, prop),
      )
    }
    restore = themeTokens({
      '--tsr-comp-cell-saved-color': 'rgb(1, 2, 3)',
      '--tsr-comp-cell-saved-duration': '7s',
    })
    expect(resolvedIn(cell, 'var(--tsr-comp-cell-saved-color)')).toBe(
      'rgb(1, 2, 3)',
    )
    expect(resolvedIn(cell, 'var(--tsr-comp-row-arrival-color)')).not.toBe(
      'rgb(1, 2, 3)',
    )
    expect(
      resolvedIn(
        cell,
        'var(--tsr-comp-row-arrival-duration)',
        'transition-duration',
      ),
    ).not.toBe('7s')
  })
})

describe('Ожидание и отказ сохранения на кнопке правки (ADR 0127)', () => {
  let restore = () => {}
  afterEach(() => {
    restore()
    restore = () => {}
  })

  test('IR16: правка ячейки — пока сохранение ждёт, кнопка правки на месте и в ожидании; отказ — заполнение и отметка на ней, нажатие открывает правку с черновиком; ячейка показывает только значение', async () => {
    restore = themeTokens({ '--tsr-comp-error-flash-duration': '300ms' })
    const wrapperOf = (index: number) =>
      ageCell(index).querySelector<HTMLElement>('.cell__button')!
    /** Кнопка видна и встала: проявление закончено. */
    const settled = (index: number) =>
      getComputedStyle(wrapperOf(index)).opacity === '1' &&
      wrapperOf(index).getAnimations().length === 0
    /** Место кнопки относительно ячейки. */
    const placeOf = (index: number) => {
      const cell = ageCell(index).getBoundingClientRect()
      const button = editButtonOf(index)!.getBoundingClientRect()
      return [
        Math.round(cell.right - button.right),
        Math.round(button.top - cell.top),
        Math.round(button.width),
      ]
    }
    const away = () => userEvent.hover(headCells()[0]!)
    /** В ячейке, кроме кнопки, — только значение: ни значков, ни меток. */
    const onlyValue = (index: number) => {
      const content = contentOf(index)
      return (
        content.querySelector(
          'svg, [aria-invalid], [aria-busy], .cell-edit-feedback',
        ) === null
      )
    }

    for (const keyboard of [false, true]) {
      const server = controlledServer()
      const screen = await editableGrid({
        onCellEdit: server.onCellEdit,
        enableKeyboardNavigation: keyboard,
      })
      await waitForGrid()
      const original = valueOf(0)
      await userEvent.hover(ageCell(0))
      await expect.poll(() => settled(0)).toBe(true)
      const place = placeOf(0)

      await saveAge(0, '999')
      await expect
        .poll(() => editButtonOf(0)?.getAttribute('aria-busy'))
        .toBe('true')
      expect(
        editButtonOf(0)!.querySelector<HTMLElement>('[data-pending-arc]')!
          .dataset.phase,
      ).toBe('pending')
      await away()
      await expect.poll(() => settled(0)).toBe(true)
      expect(placeOf(0)).toEqual(place)
      expect(valueOf(0)).toBe('999')
      expect(onlyValue(0)).toBe(true)

      server.settle[0].reject(new Error('Server down'))
      await expect
        .poll(() => editButtonOf(0)!.getAttribute('data-error-flash'))
        .toBe('on')
      expect(
        editButtonOf(0)!.querySelector<HTMLElement>('[data-pending-arc]')!
          .dataset.phase,
      ).toBe('error')
      await expect.poll(() => failureShown(0)).toBe(true)
      const described = editButtonOf(0)!
        .getAttribute('aria-describedby')!
        .split(' ')[0]!
      expect(document.getElementById(described)!.textContent).toBe(
        tableLabels.actionFailedRetry('Server down'),
      )
      expect(placeOf(0)).toEqual(place)
      expect(valueOf(0)).toBe(original)
      expect(onlyValue(0)).toBe(true)

      await humanClick(editButtonOf(0)!)
      await expect.poll(() => ageCell(0).querySelector('input')).not.toBeNull()
      expect(ageCell(0).querySelector<HTMLInputElement>('input')!.value).toBe(
        '999',
      )
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
    }
  })
})
