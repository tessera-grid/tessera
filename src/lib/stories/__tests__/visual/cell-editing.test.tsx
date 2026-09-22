import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Плагин cellEditing: инлайн-редактирование ячейки на ЛОКАЛЬНОМ
// state-канале definePlugin. Один инвариант — один тест, имя с префиксом
// требования (CE<n>), состояние читается из DOM. Требования из запроса:
//  1. кнопка живёт в правом слоте ЛЮБОЙ не-сервисной колонки;
//  2. кнопка появляется только по hover;
//  3. без hover кнопка не занимает места;
//  4. показ гейтит предикат по контексту ячейки (демо: CELL_EDITABLE_COLUMNS).
// Синтетический ввод крутит механику; `:hover`-раскрытие (CE2) — доверенный ввод.

const composed = composeStories(stories)

const BODY_CELL = '.data-grid__body-cell'
/** Обёртка кнопки редактирования (cellEditing → CellButton). */
const CELL_BUTTON = '.cell__button'
/** Класс «скрыта до hover»: opacity/min-width 0, overflow hidden → места не занимает. */
const HIDDEN = 'cell__button--hidden'
/** Инлайн-ввод редактирования (CellEditInput). */
const EDIT_INPUT = "[aria-label='edit cell value']"

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
  test('CE1: кнопка есть в правом слоте канредактируемых колонок, нет в остальных (req 1 + 4)', async () => {
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

  test('CE2/CE3: без hover кнопка скрыта (класс cell__button--hidden — места не занимает) (req 2 + 3)', async () => {
    const container = await renderCellEditing()

    const button = bodyCell(container, 'age').querySelector<HTMLElement>(
      CELL_BUTTON,
    )!
    // До hover — контрактный класс «скрыта»: раскрытие делает CSS `:hover`.
    expect(button.classList.contains(HIDDEN)).toBe(true)
  })

  test('CE4: клик по кнопке открывает инлайн-ввод, Enter коммитит значение в ячейку (локальный state-канал)', async () => {
    const container = await renderCellEditing()

    const cell = bodyCell(container, 'age')
    // Ховерим ячейку — кнопка становится кликабельной (снят opacity/overflow).
    await userEvent.hover(cell)
    const button = cell.querySelector<HTMLElement>(`${CELL_BUTTON} button`)!
    await userEvent.click(button)

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
    await userEvent.click(
      cell.querySelector<HTMLElement>(`${CELL_BUTTON} button`)!,
    )

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
