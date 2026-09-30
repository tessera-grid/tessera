import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import { composed } from '../stories'

// Плагин cellEditing: инлайн-редактирование ячейки на ЛОКАЛЬНОМ
// state-канале definePlugin (ADR 0028, CE1–CE5). Один инвариант — один тест,
// состояние читается из DOM; `:hover`-раскрытие (CE3) — доверенный ввод.

const BODY_CELL = '.data-grid__body-cell'
/** Обёртка кнопки редактирования (cellEditing → CellButton). */
const CELL_BUTTON = '.cell__button'
/** Класс «скрыта до наведения»: прозрачна, раскрывает CSS `:hover` ячейки. */
const HIDDEN = 'cell__button--hidden'
/** Инлайн-ввод редактирования (CellEditInput). */
const EDIT_INPUT = '.data-grid__body-cell input'

/** Первая ячейка тела указанной колонки. */
const bodyCell = (container: HTMLElement, columnId: string) =>
  container.querySelector<HTMLElement>(
    `${BODY_CELL}[data-column-id='${columnId}']`,
  )!

/** Рендер канонической истории Cell Editing и ожидание строк тела. */
async function renderCellEditing(
  args: Partial<Parameters<typeof composed.CellEditing>[0]> = {},
) {
  const { container } = await render(<composed.CellEditing {...args} />)
  await expect
    .poll(() => container.querySelectorAll(BODY_CELL).length)
    .toBeGreaterThan(3)
  return container
}

describe('Cell editing — инлайн-редактирование ячейки', () => {
  test('CE1: кнопка правки есть в правом слоте разрешённых canEdit ячеек, нет в остальных', async () => {
    const container = await renderCellEditing()

    // Демо разрешает редактирование по контексту (CELL_EDITABLE_COLUMNS =
    // age/visits/gender) — кнопка в ЛЮБОЙ из этих не-сервисных колонок.
    for (const columnId of ['age', 'visits', 'gender']) {
      expect(
        bodyCell(container, columnId).querySelector(CELL_BUTTON),
        `кнопка редактирования в колонке ${columnId}`,
      ).not.toBeNull()
    }

    // Колонка вне предиката (firstName) — предикат вернул false, кнопки нет вовсе.
    expect(
      bodyCell(container, 'firstName').querySelector(CELL_BUTTON),
    ).toBeNull()
  })

  test('CE2: без наведения кнопка правки прозрачна', async () => {
    const container = await renderCellEditing()

    const button = bodyCell(container, 'age').querySelector<HTMLElement>(
      CELL_BUTTON,
    )!
    expect(button.classList.contains(HIDDEN)).toBe(true)
    expect(getComputedStyle(button).opacity).toBe('0')
  })

  test('CE3: наведение на ячейку показывает кнопку правки', async () => {
    const container = await renderCellEditing()

    const cell = bodyCell(container, 'age')
    const button = cell.querySelector<HTMLElement>(CELL_BUTTON)!
    // Доверенный hover: раскрытие делает CSS `:hover` ячейки.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(button).opacity).toBe('1')
  })

  test('CE4: клик по кнопке открывает инлайн-ввод, Enter коммитит значение в ячейку (локальный state-канал)', async () => {
    const container = await renderCellEditing()

    const cell = bodyCell(container, 'age')
    // Ховерим ячейку — кнопка становится кликабельной (снят opacity/overflow).
    await userEvent.hover(cell)
    const button = cell.querySelector<HTMLElement>(`${CELL_BUTTON} button`)!
    await humanClick(button)

    // Открылся инлайн-ввод (слайс «редактируемая ячейка» = `rowId:columnId`).
    const input = await expect
      .poll(() => cell.querySelector<HTMLInputElement>(EDIT_INPUT))
      .not.toBeNull()
      .then(() => cell.querySelector<HTMLInputElement>(EDIT_INPUT)!)

    // Ввод нового значения + Enter → onCellEdit пишет в мок-данные, слайс сбрасывается.
    await userEvent.fill(input, '999')
    await userEvent.keyboard('{Enter}')

    // Ввод закрылся, а значение колонки обновилось (getValue после setData).
    await expect
      .poll(() => bodyCell(container, 'age').querySelector(EDIT_INPUT))
      .toBeNull()
    await expect
      .poll(() => bodyCell(container, 'age').textContent)
      .toContain('999')
  })

  test('CE5: в режиме правки редактор ЗАМЕЩАЕТ контент ячейки (ядровый seam cellSlot), кнопка скрыта', async () => {
    const container = await renderCellEditing()

    const cell = bodyCell(container, 'age')
    const original = cell.textContent?.trim() ?? ''
    expect(original.length).toBeGreaterThan(0)

    await userEvent.hover(cell)
    await humanClick(cell.querySelector<HTMLElement>(`${CELL_BUTTON} button`)!)

    // Открылся редактор.
    await expect
      .poll(() => bodyCell(container, 'age').querySelector(EDIT_INPUT))
      .not.toBeNull()

    // Собственный рендер ячейки подавлен: исходного значения рядом с инпутом нет,
    // а кнопки правки (rightCellSlot) в режиме правки тоже нет.
    const editing = bodyCell(container, 'age')
    expect(editing.textContent).not.toContain(original)
    expect(editing.querySelector(CELL_BUTTON)).toBeNull()
  })
})
