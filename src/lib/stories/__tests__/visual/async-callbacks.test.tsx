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

// Асинхронный контракт бизнес-колбэков (ADR 0041, AS2–AS3, AS5–AS6, AS11, AS13):
// сохранение с промисом отделяет ячейку в ожидание, правка других ячеек не ждёт
// сервера, отказ —
// «ошибка» с черновиком; раскрытие ждёт подгрузки. AS1, AS4, AS7–AS10, AS12 —
// модульные
// (`src/lib/__tests__/asyncCallbacks.dom.test.tsx`).

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
  test('AS2: onCellEdit вернул промис — редактор закрыт, ячейка показывает отправленное значение с aria-busy, кнопки правки нет, Enter игнорируется', async () => {
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEdit={allow}
        onCellEdit={never}
      />,
    )
    await waitForGrid()
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')

    const busy = () => ageCell(0).querySelector('[aria-busy="true"]')
    await expect.poll(busy).not.toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(busy()!.textContent).toBe('999')

    await userEvent.hover(ageCell(0))
    expect(ageCell(0).querySelector('.cell__button button')).toBeNull()

    await humanClick(ageCell(0))
    await expect.poll(() => document.activeElement).toBe(ageCell(0))
    await userEvent.keyboard('{Enter}')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(ageCell(0).querySelector('input')).toBeNull()
    expect(busy()).not.toBeNull()
  })

  test('AS3: пока ячейка ожидает, другую ячейку можно править', async () => {
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
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

  test('AS5: промис отклонён — ячейка в «ошибке» с меткой и текстом, отказ объявлен; активная правка другой ячейки не тронута', async () => {
    const server = controlledServer()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    const original = ageCell(0).textContent
    await openAndType(0, '999')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => server.settle.length).toBe(1)
    const active = await openAndType(1, '42')

    server.settle[0].reject(new Error('Server down'))
    const failed = () =>
      ageCell(0).querySelector<HTMLElement>('[aria-invalid="true"]')
    await expect.poll(failed).not.toBeNull()
    expect(ageCell(0).textContent).toContain(original)
    expect(failed()!.querySelector('svg')).not.toBeNull()
    const description = document.getElementById(
      failed()!.getAttribute('aria-describedby')!,
    )
    expect(description!.textContent).toBe('Server down')
    expect(failed()!.title).toBe('Server down')
    await expect
      .poll(() => liveRegion().textContent)
      .toContain('Age: Server down')

    expect(ageCell(1).querySelector('input')).toBe(active)
    expect(active.value).toBe('42')
    expect(document.activeElement).toBe(active)
  })

  test('AS6: из «ошибки» Enter или кнопка правки открывают редактор с черновиком и текстом ошибки; успешное сохранение снимает ошибку', async () => {
    const server = controlledServer()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        enableKeyboardNavigation
        cellEditingCanEdit={allow}
        onCellEdit={server.onCellEdit}
      />,
    )
    await waitForGrid()
    const failed = (index: number) =>
      ageCell(index).querySelector('[aria-invalid="true"]')
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
    expect(ageCell(0).querySelector('[aria-invalid="true"]')).toBeNull()
    expect(ageCell(0).querySelector('input')).toBeNull()
  })

  test('AS11: onExpandRow вернул промис при раскрытии — кнопка раскрытия в ожидании, строка с aria-busy, повторное нажатие игнорируется', async () => {
    const onExpandRow = vi.fn(() => new Promise<void>(() => {}))
    const { container } = await render(
      <composed.RowExpanding onExpandRow={onExpandRow} />,
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

  test('AS13: ожидание, «ошибка» и раскрытие в ожидании проходят axe, включая контраст текста', async () => {
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
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
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
    await expect
      .poll(() => ageCell(1).querySelector('[aria-invalid="true"]'))
      .not.toBeNull()
    expect(ageCell(0).querySelector('[aria-busy="true"]')).not.toBeNull()
    await inBothThemes(async () => {
      expect((await run()).violations).toEqual([])
    })
    await cells.unmount()

    await render(
      // С навигацией — treegrid: aria-expanded у строк законен только в нём.
      <composed.RowExpanding
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

// Обратная связь асинхронной правки (ADR 0057, CF1–CF6, CF8–CF11; вид — ADR 0095): свет
// ожидания по периметру ячейки, красный свет отказа, подсветка сохранения. CF7 — модульный
// (`asyncCallbacks.dom`), CF12 — перф в `scroll`.

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
const ringOf = (index: number) =>
  getComputedStyle(feedbackOf(index)!, '::after')
const tintOf = (index: number) =>
  getComputedStyle(feedbackOf(index)!, '::before')
const savedAt = (index: number) =>
  feedbackOf(index)?.hasAttribute('data-saved') ?? false
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Пиксели скриншота в CSS-координатах окна. */
const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const base64 = typeof shot === 'string' ? shot : shot.base64
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const scale = image.width / document.documentElement.clientWidth
  return (x: number, y: number) =>
    Array.from(
      context
        .getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
        .data.slice(0, 3),
    )
}

const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

const cellIn = (index: number, columnId: string) =>
  bodyRows()
    .find(row => row.dataset.index === String(index))!
    .querySelector<HTMLElement>(
      `.data-grid__body-cell[data-column-id="${columnId}"]`,
    )!

/** Точка у левого верхнего угла ячейки — глубже фокус-кольца, в полосе света. */
const cornerOf = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  return [box.left + 5, box.top + 5] as const
}

/** Точка за полосой света у правого верхнего угла, но внутри пятна в этом углу. */
const innerOf = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  return [box.right - 18, box.top + 14] as const
}

/** Точка в середине ячейки по высоте, правее короткого значения. */
const middleOf = (cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  return [box.left + box.width * 0.6, box.top + box.height / 2] as const
}

/** Пиксель покраснел: красный канал заметно выше зелёного и синего. */
const reddish = ([r, g, b]: number[]) => r! - g! > 15 && r! - b! > 15

const editableGrid = (props: Record<string, unknown> = {}) =>
  render(
    <Stories.AllFeatures
      {...GRID}
      enableCellEditing
      cellEditingCanEdit={allow}
      {...props}
    />,
  )

/** Сохранить `value` в ячейку `age` строки через Enter. */
const saveAge = async (index: number, value: string) => {
  await openAndType(index, value)
  await userEvent.keyboard('{Enter}')
}

describe('Асинхронная правка: блик, вспышка, подсветка', () => {
  let restore = () => {}
  afterEach(async () => {
    restore()
    restore = () => {}
    await reducedMotion(false)
  })

  test('CF1: ячейка в ожидании — свет по периметру внутри ячейки, середина и соседние ячейки не окрашены; значение как текст обычной ячейки, раскладка та же', async () => {
    // Без движения пятна стоят по углам — кадр детерминирован.
    await reducedMotion(true)
    // История сервера: контейнер крупнее шрифта ячейки — значение не должно его унаследовать.
    await render(<composed.CellEditingServer serverDelayMs={60_000} />)
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
    await userEvent.hover(ageCell(0))
    const plain = await snapshot()
    await saveAge(0, '999')
    await expect.poll(() => feedbackOf(0)?.dataset.pending).toBe('true')
    await new Promise(resolve => requestAnimationFrame(resolve))

    expect(ringOf(0).content).not.toBe('none')
    const shot = await snapshot()
    // Опора — те же точки до сохранения: угол окрашен, середина и соседи — нет.
    const changed = (point: readonly [number, number]) =>
      distance(shot(...point), plain(...point))
    expect(changed(cornerOf(ageCell(0)))).toBeGreaterThan(12)
    expect(changed(middleOf(ageCell(0)))).toBeLessThan(4)
    // За полосой света — чисто: сравнение с той же точкой соседней колонки строки.
    expect(
      distance(
        shot(...innerOf(ageCell(0))),
        shot(...innerOf(cellIn(0, 'lastName'))),
      ),
    ).toBeLessThan(4)
    // Соседи справа и снизу не окрашены.
    expect(changed(cornerOf(cellIn(0, 'gender')))).toBeLessThan(4)
    expect(changed(cornerOf(ageCell(1)))).toBeLessThan(4)

    const busy = ageCell(0).querySelector<HTMLElement>('[aria-busy="true"]')!
    expect(getComputedStyle(busy).color).toBe(plainColor)
    const plainText = ageCell(2).querySelector<HTMLElement>(
      '[data-testid="table-field-cell-name"]',
    )!
    for (const prop of ['fontSize', 'lineHeight'] as const) {
      expect(getComputedStyle(busy)[prop], prop).toBe(
        getComputedStyle(plainText)[prop],
      )
    }
    expect(getComputedStyle(busy).opacity).toBe('1')
    expect(box(ageCell(0))).toEqual(before)
    // Слой — по контуру ячейки внутри фокус-кольца и не перехватывает указатель.
    const ringWidth = parseFloat(
      resolvedIn(ageCell(0), 'var(--tsr-comp-focus-ring-width)', 'width'),
    )
    const layer = feedbackOf(0)!.getBoundingClientRect()
    expect(layer.width).toBeCloseTo(
      ageCell(0).getBoundingClientRect().width - 2 * ringWidth,
      0,
    )
    expect(getComputedStyle(feedbackOf(0)!).pointerEvents).toBe('none')
  })

  test('CF2: блик виден у закреплённой ячейки, с клавиатурной навигацией и без неё и в выделении cellSelection; фокус-кольцо и рамка выделения видны', async () => {
    for (const keyboard of [false, true]) {
      const screen = await render(
        <composed.ColumnPinning
          enableCellEditing
          cellEditingCanEdit={allow}
          onCellEdit={never}
          enableCellSelection
          enableKeyboardNavigation={keyboard}
        />,
      )
      await waitForGrid()
      const head = await pinFirstColumn(screen.container)
      const columnId = head.dataset.columnId!
      const cellAt = (index: number) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
        )!
      const feedback = () =>
        cellAt(0).querySelector<HTMLElement>('.cell-edit-feedback')!
      // Контур виден: слой отрисован и его псевдоэлемент на месте.
      const ring = () => ({
        content: feedback().checkVisibility()
          ? getComputedStyle(feedback(), '::after').content
          : 'none',
      })
      await expect
        .poll(() => cellAt(0).getAttribute('data-cell-pinned'))
        .toBe('left')

      await userEvent.hover(cellAt(0))
      await humanClick(
        cellAt(0).querySelector<HTMLElement>('.cell__button button')!,
      )
      await expect.poll(() => cellAt(0).querySelector('input')).not.toBeNull()
      await userEvent.type(cellAt(0).querySelector('input')!, 'x')
      await userEvent.keyboard('{Enter}')
      await expect
        .poll(() => cellAt(0).querySelector('[data-pending]'))
        .not.toBeNull()
      expect(ring().content, `keyboard=${keyboard}`).not.toBe('none')

      // Выделение диапазона из ожидающей ячейки и соседней.
      await humanClick(cellAt(0))
      await userEvent.keyboard('{Shift>}')
      await humanClick(cellAt(1))
      await userEvent.keyboard('{/Shift}')
      await expect
        .poll(() => cellAt(0).getAttribute('data-cell-selected'))
        .toBe('true')
      expect(getComputedStyle(cellAt(0)).boxShadow).not.toBe('none')
      expect(ring().content).not.toBe('none')

      if (keyboard) {
        // Фокус с клавиатуры: стрелка вверх возвращает на ожидающую ячейку.
        await userEvent.keyboard('{ArrowUp}')
        await expect.poll(() => document.activeElement).toBe(cellAt(0))
        expect(getComputedStyle(cellAt(0)).outlineStyle).toBe('solid')
        // Блик идёт внутри фокус-кольца, а не под ним.
        const outline = parseFloat(getComputedStyle(cellAt(0)).outlineWidth)
        const cellBox = cellAt(0).getBoundingClientRect()
        const layerBox = feedback().getBoundingClientRect()
        expect(layerBox.left - cellBox.left).toBeGreaterThanOrEqual(outline)
        expect(cellBox.bottom - layerBox.bottom).toBeGreaterThanOrEqual(outline)
        expect(ring().content).not.toBe('none')
      }
      await screen.unmount()
    }
  })

  test('CF3: отказ — свет ячейки переходит в ровный красный по всему периметру, держится и гаснет; после — метка ошибки', async () => {
    restore = themeTokens({
      '--tsr-comp-error-flash-fill-duration': '100ms',
      '--tsr-comp-error-flash-duration': '800ms',
    })
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await saveAge(0, '999')
    await expect.poll(() => server.settle.length).toBe(1)
    server.settle[0].reject(new Error('Server down'))

    await expect.poll(() => feedbackOf(0)?.dataset.errorFlash).toBe('on')
    await expect
      .poll(() => parseFloat(ringOf(0).getPropertyValue('--tsr-ring-fill')))
      .toBe(100)
    const cell = ageCell(0).getBoundingClientRect()
    const shot = await snapshot()
    const midX = cell.left + cell.width / 2
    const midY = cell.top + cell.height / 2
    for (const [x, y] of [
      [midX, cell.top + 4],
      [midX, cell.bottom - 4],
      [cell.left + 4, midY],
      [cell.right - 4, midY],
    ] as const) {
      expect(reddish(shot(x, y)), `${x},${y}`).toBe(true)
    }
    expect(ageCell(0).querySelector('[aria-invalid="true"]')).not.toBeNull()
    await expect
      .poll(() => feedbackOf(0)!.hasAttribute('data-error-flash'), {
        timeout: 3000,
      })
      .toBe(false)
    expect(ageCell(0).querySelector('[aria-invalid="true"]')).not.toBeNull()
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
    await expect
      .poll(() => ageCell(0).querySelector('[aria-invalid="true"]'))
      .not.toBeNull()
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
    expect(ageCell(0).querySelector('[aria-invalid="true"]')).toBeNull()
  })

  test('CF6: ячейка, ушедшая из окна виртуализации по строке и по колонке, подсвечена при возврате до истечения времени; после — нет', async () => {
    // Запас на два круга прокрутки со скелетами быстрой прокрутки в Firefox под StrictMode.
    restore = themeTokens({ '--tsr-comp-cell-saved-duration': '5000ms' })
    await render(
      <Stories.AllFeatures
        containerHeight={600}
        height={500}
        columnCount={40}
        dataCount={200}
        enableCellEditing
        cellEditingCanEdit={allow}
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

  test('CF8: при уменьшенном движении свет стоит и виден, вспышка и подсветка держатся ту же длительность и снимаются без перехода', async () => {
    await reducedMotion(true)
    restore = themeTokens({
      '--tsr-comp-error-flash-duration': '400ms',
      '--tsr-comp-cell-saved-duration': '400ms',
      '--tsr-comp-cell-saved-fade-duration': '3000ms',
    })
    const server = controlledServer()
    await editableGrid({ onCellEdit: server.onCellEdit })
    await waitForGrid()
    await userEvent.hover(ageCell(1))
    const plain = await snapshot()
    await saveAge(0, '999')
    await saveAge(1, '42')
    await expect.poll(() => server.settle.length).toBe(2)
    await new Promise(resolve => requestAnimationFrame(resolve))

    // Свет стоит: два кадра одинаковы; и виден — угол окрашен против кадра до правки.
    const points = [cornerOf(ageCell(0)), middleOf(ageCell(0))]
    const first = await snapshot()
    expect(
      distance(first(...cornerOf(ageCell(0))), plain(...cornerOf(ageCell(0)))),
    ).toBeGreaterThan(12)
    await pause(200)
    const second = await snapshot()
    for (const [i, point] of points.entries()) {
      expect(second(...point), `point ${i} ${point}`).toEqual(first(...point))
    }

    server.settle[0].reject(new Error('Server down'))
    server.settle[1].resolve()
    await expect.poll(() => feedbackOf(0)?.dataset.errorFlash).toBe('on')
    await expect.poll(() => savedAt(1)).toBe(true)
    // Ошибка без перехода: свет сразу полный.
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(parseFloat(ringOf(0).getPropertyValue('--tsr-ring-fill'))).toBe(100)
    await pause(250)
    expect(feedbackOf(0)!.dataset.errorFlash).toBe('on')
    expect(savedAt(1)).toBe(true)
    await expect.poll(() => savedAt(1)).toBe(false)
    expect(tintOf(1).opacity).toBe('0')
    await expect
      .poll(() => feedbackOf(0)!.dataset.errorFlash ?? 'gone')
      .not.toBe('on')
    // Кадр на применение стиля фазы; с переходом свет гас бы ещё ~150 мс.
    await new Promise(resolve => requestAnimationFrame(resolve))
    // После удержания света нет: слой погашен или снят, без перехода.
    expect(ringOf(0).content === 'none' || ringOf(0).opacity === '0').toBe(true)
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
    await expect
      .poll(() => ageCell(1).querySelector('[aria-invalid="true"]'))
      .not.toBeNull()
    expect(feedbackOf(0)!.dataset.pending).toBe('true')

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
