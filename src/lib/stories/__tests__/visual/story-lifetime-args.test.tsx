/**
 * Слой историй: аргумент-договор на время жизни (`server`, ADR 0039), сменённый из
 * Controls после монтирования, пересоздаёт грид — иначе таблица держит значение
 * монтирования, и «серверная» сортировка продолжает сортировать на клиенте.
 */
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'

const HEAD_CELL = '.data-grid__head-cell'
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
const BODY_CELL = '.data-grid__body-cell'
const SORT_BUTTON = '.column-sort__button'

const firstDataHead = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(DATA_HEAD_CELL)!

const columnValues = (container: HTMLElement, colIndex: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `${BODY_CELL}[aria-colindex='${colIndex}']`,
    ),
  )
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
    .map(cell => cell.textContent?.trim() ?? '')

describe('истории DataGrid: аргументы-договоры на время жизни', () => {
  test('смена serverColumnSorting после монтирования пересоздаёт грид: клик сортировки не меняет порядок строк', async () => {
    const { container, rerender } = await render(
      <composed.ColumnSorting serverColumnSorting={false} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    await rerender(<composed.ColumnSorting serverColumnSorting />)
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    const head = firstDataHead(container)
    const colIndex = head.getAttribute('aria-colindex')!
    const before = columnValues(container, colIndex)
    expect(before.length).toBeGreaterThan(3)

    await userEvent.hover(head)
    await userEvent.click(head.querySelector<HTMLElement>(SORT_BUTTON)!)
    await expect
      .poll(() => firstDataHead(container).getAttribute('aria-sort'))
      .not.toBe('none')

    expect(columnValues(container, colIndex)).toEqual(before)
  })
})
