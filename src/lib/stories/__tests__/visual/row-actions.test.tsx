import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import { DEFAULT_ROW_ACTIONS_OPTIONS } from '../../../../lib/plugins/rowActions'
import * as stories from '../../DataGrid.stories'

// Плагин rowActions (ADR 0025): служебная колонка действий строки. Здесь — только
// требования `RA<n>`, НЕ покрытые общими наборами (авто-пин/подложка — CP14/23/24,
// подача действий/ширина в кебабе — AM15–AM19, порядок сервисных — service-columns
// R6/R8/R10, reorder-out — LP7/LP10): поведение под вложенной шапкой (RA1) и точные
// дефолты ширины (RA2). Один инвариант — один тест; состояние читается из DOM.

const composed = composeStories(stories)

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
const BY_ACTIONS = `[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`

describe('Row actions — служебная колонка действий (ADR 0025)', () => {
  test('RA1: под вложенной шапкой колонка действий замыкает ряд и присутствует в шапке', async () => {
    const { container } = await render(
      <composed.HeaderGroups enableRowActions />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    // Шапка действительно многоуровневая: есть заголовок верхней группы, не
    // совпадающий с листовой строкой (`first-headers-row` при `last=false`).
    expect(
      container.querySelector(
        `${HEAD_CELL}[data-first-headers-row='true'][data-last-headers-row='false']`,
      ),
    ).not.toBeNull()

    // Колонка действий инъектирована в шапку и помечена служебной.
    const actionsHead = container.querySelector<HTMLElement>(
      `${HEAD_CELL}${BY_ACTIONS}`,
    )
    expect(actionsHead).not.toBeNull()
    expect(actionsHead!.getAttribute('data-actions-column-cell')).toBe('true')

    // В теле она замыкает ряд — ПОСЛЕДНЯЯ (трейлинг) ячейка строки — и авто-
    // закреплена вправо (sticky у видимого правого края независимо от скролла).
    const bodyCells = Array.from(
      container.querySelectorAll<HTMLElement>(
        `.data-grid__body-row:first-of-type ${BODY_CELL}`,
      ),
    ).filter(cell => cell.getAttribute('aria-colindex') !== null)
    expect(bodyCells.length).toBeGreaterThan(1)
    const trailing = bodyCells.at(-1)!
    expect(trailing.getAttribute('data-column-id')).toBe(ROW_ACTIONS_COLUMN_ID)
    expect(trailing.getAttribute('data-cell-pinned')).toBe('right')
  })

  test('RA2: ширина колонки действий — width (120) инлайн и collapsedWidth (56) при rowActionMenu', async () => {
    const widthOf = (container: HTMLElement) =>
      Math.round(
        container
          .querySelector<HTMLElement>(`${BODY_CELL}${BY_ACTIONS}`)!
          .getBoundingClientRect().width,
      )

    // Инлайн (rowActionMenu выключен) → полная ширина `width`.
    const inline = await render(
      <composed.RowActionMenu enableRowActionMenu={false} />,
    )
    await expect
      .poll(() => inline.container.querySelector(`${BODY_CELL}${BY_ACTIONS}`))
      .not.toBeNull()
    await expect
      .poll(() => widthOf(inline.container))
      .toBe(DEFAULT_ROW_ACTIONS_OPTIONS.width)

    // Схлопнуто в кебаб (rowActionMenu включён) → суженная `collapsedWidth`.
    const collapsed = await render(
      <composed.RowActionMenu enableRowActionMenu />,
    )
    await expect
      .poll(() =>
        collapsed.container.querySelector(`${BODY_CELL}${BY_ACTIONS}`),
      )
      .not.toBeNull()
    await expect
      .poll(() => widthOf(collapsed.container))
      .toBe(DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth)
  })
})
