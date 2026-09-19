import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  SEL,
  Stories,
  bodyRows,
  getScroller,
  headCells,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from '../helpers'

// Каждое требование виртуализации из docs/decisions/0005-virtualization-tanstack-virtual.md —
// это отдельный именованный тест с префиксом `V<n>`, чтобы `npm test` отчитывался
// и падал по каждому требованию поимённо (см. docs/decisions/0009-test-coverage-visual-and-performance.md).
// Основная часть тестов гоняет каноническую историю `All Features`, подобранную по
// размеру так, чтобы переполнять по обеим осям (иначе виртуализация «схлопнется» и
// требования пройдут вхолостую); guard-тест V11 их защищает. Путь с вложенными
// заголовками (V3) проверяется на истории `Header Groups` (`grid`-layout).

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

/** Ширина спейсера центра (`--virtual-center-width`) на узле `.MuiTable-root`. */
const centerWidth = () => {
  const table = document.querySelector<HTMLElement>('.MuiTable-root')!
  return (
    parseFloat(
      getComputedStyle(table).getPropertyValue('--virtual-center-width'),
    ) || 0
  )
}

/** Head-ячейка колонки, закреплённая слева (после клика по кнопке пина). */
const PINNED_HEAD = `${SEL.headCell}[data-cell-pinned='left']`

// --- Setup guard --------------------------------------------------------------
// Не требование, а защита: если история не переполняет по обеим осям, виртуализация
// не включится и V1/V2/V5/V8–V11 пройдут вхолостую.

describe('Виртуализация — setup guard', () => {
  test('V11: канонная история переполняет по обеим осям', async () => {
    renderGrid()
    await waitForGrid()

    const scroller = getScroller()
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
  })
})

// --- V1–V7: виртуализаторы строк и столбцов -----------------------------------

describe('Виртуализация — окно строк и столбцов', () => {
  test('V1: строки виртуализированы — в DOM только видимые + overscan, не весь набор', async () => {
    const dataCount = 300
    renderGrid({ dataCount })
    await waitForGrid()

    const rendered = bodyRows().length
    expect(rendered).toBeGreaterThan(0)
    // Видимых ~10 (500px / 50px) + overscan; заведомо меньше всего набора.
    expect(rendered).toBeLessThan(dataCount)
  })

  test('V2: при плоских заголовках столбцы виртуализированы — в DOM только видимые + overscan', async () => {
    const columnCount = 20
    renderGrid({ columnCount })
    await waitForGrid()

    const rendered = headCells().length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(columnCount)
  })

  test('V3: при вложенных заголовках виртуализация столбцов отключена — набор не меняется при скролле', async () => {
    render(<Stories.HeaderGroups />)
    await waitForGrid()

    const scroller = getScroller()
    const before = renderedColumnIndexes().sort((a, b) => a - b)

    await scrollToEnd('x')
    const after = renderedColumnIndexes().sort((a, b) => a - b)

    // Все leaf-столбцы всегда в DOM: набор индексов не изменился прокруткой, и
    // крайний левый (0) остаётся отрендеренным даже у правого края.
    expect(after).toEqual(before)
    expect(before).toContain(0)
  })

  test('V4: закреплённый столбец удерживается в диапазоне при любом горизонтальном скролле', async () => {
    const container = document.body
    renderGrid({ enableColumnPinning: true, columnCount: 20, dataCount: 100 })
    await waitForGrid()

    // Закрепляем крайний левый столбец через UI (кнопка пина скрыта до hover).
    const firstHead = headCells().sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )[0]
    await userEvent.hover(firstHead)
    await userEvent.click(
      firstHead.querySelector<HTMLElement>('.column-pin__button')!,
    )
    await expect
      .poll(() => container.querySelector(PINNED_HEAD) !== null)
      .toBe(true)

    // После прокрутки до правого края закреплённый заголовок всё ещё в DOM.
    await scrollToEnd('x')
    expect(container.querySelector(PINNED_HEAD)).not.toBeNull()
  })

  test('V5: диапазон строк расширен overscan — над/под вьюпортом смонтирован запас', async () => {
    renderGrid({ dataCount: 300 })
    await waitForGrid()

    const scroller = getScroller()
    // Прокрутка в середину, чтобы overscan был с обеих сторон.
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2
    await nextFrame()
    await nextFrame()

    const view = scroller.getBoundingClientRect()
    const outside = bodyRows().filter(row => {
      const r = row.getBoundingClientRect()
      return r.bottom <= view.top || r.top >= view.bottom
    })
    // Есть хотя бы одна смонтированная строка целиком за пределами вьюпорта.
    expect(outside.length).toBeGreaterThan(0)
  })

  test('V6: высота body соответствует полному числу строк (скроллбар отражает весь набор)', async () => {
    const dataCount = 300
    const rowHeight = 50 // ESTIMATE_SIZE / --tsr-comp-row-height
    renderGrid({ dataCount })
    await waitForGrid()

    const scroller = getScroller()
    // scrollHeight ≈ dataCount * rowHeight (+ шапка), а не число смонтированных строк.
    expect(scroller.scrollHeight).toBeGreaterThanOrEqual(dataCount * rowHeight)
  })
})

// --- V8–V11: filler-паддинги и достижимость краёв -----------------------------

describe('Виртуализация — filler-паддинги и достижимость', () => {
  test('V7: виртуальный экстент учитывает невидимые столбцы по их реальным размерам', async () => {
    renderGrid({ columnCount: 30, dataCount: 100 })
    await waitForGrid()

    const scroller = getScroller()
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    await nextFrame()
    await nextFrame()

    // Спейсер центра (сумма ВСЕХ центральных столбцов по реальным размерам) задаёт
    // горизонтальный экстент — без пиннинга сходится со scrollWidth. Если бы размер
    // невидимого столбца разошёлся с виртуальным клоном, экстент бы поехал.
    expect(Math.abs(centerWidth() - scroller.scrollWidth)).toBeLessThan(1)
  })

  test('V8: строка достижима и рендерится в начале, середине и конце списка', async () => {
    const dataCount = 300
    renderGrid({ dataCount })
    await waitForGrid()

    const scroller = getScroller()

    // Начало.
    scroller.scrollTop = 0
    await nextFrame()
    expect(Math.min(...renderedRowIndexes())).toBe(0)

    // Середина.
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedRowIndexes().some(
          i => i > dataCount * 0.4 && i < dataCount * 0.6,
        ),
      )
      .toBe(true)

    // Конец: последняя строка достижима до самого низа.
    await scrollToEnd('y')
    expect(Math.max(...renderedRowIndexes())).toBe(dataCount - 1)
  })

  test('V9: столбец достижим и рендерится в начале, середине и конце списка', async () => {
    const columnCount = 30
    renderGrid({ columnCount, dataCount: 100 })
    await waitForGrid()

    const scroller = getScroller()

    // Начало: крайний левый столбец отрендерен.
    scroller.scrollLeft = 0
    await nextFrame()
    expect(Math.min(...renderedColumnIndexes())).toBe(0)

    // Середина.
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    await nextFrame()
    await nextFrame()
    await expect
      .poll(() =>
        renderedColumnIndexes().some(
          i => i > columnCount * 0.4 && i < columnCount * 0.6,
        ),
      )
      .toBe(true)

    // Конец: крайний правый столбец достижим до самого края.
    await scrollToEnd('x')
    expect(Math.max(...renderedColumnIndexes())).toBe(columnCount - 1)
  })

  test('V10: при горизонтальном скролле окно колонок сдвигается — левые столбцы уходят', async () => {
    renderGrid({ columnCount: 30, dataCount: 100 })
    await waitForGrid()

    const scroller = getScroller()
    scroller.scrollLeft = 0
    await nextFrame()
    const minAtStart = Math.min(...renderedColumnIndexes())

    await scrollToEnd('x')
    const minAtEnd = Math.min(...renderedColumnIndexes())

    // У левого края в окне столбцы с нулевого; после прокрутки левые уходят —
    // минимальный отрендеренный индекс заметно вырос.
    expect(minAtEnd).toBeGreaterThan(minAtStart)
  })
})
