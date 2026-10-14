import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { COLUMN_DRAGGING_ID } from '../../../../lib/plugins/rowDragging'
import { COLUMN_EXPANDING_ID } from '../../../../lib/plugins/rowExpanding'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'
import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import { renderGrid } from '../helpers'
import { headCellsLeftRight, waitForGrid } from './core-helpers'
import {
  menuItemByText,
  pinViaPopover,
  revealPin,
  withWideViewport,
} from './column-pinning-helpers'

// Золотой оракул композиции сервисных колонок — сеть безопасности под инверсию
// ядра (docs/decisions/0010-invert-core-plugins-registry.md). Читает
// СМОНТИРОВАННЫЙ результат (DOM), поэтому переживает смену публичного API
// (enable* → presence-based плагины): при инверсии поменяется лишь строка сборки
// истории, а ожидаемый порядок/видимость/пиннинг останутся точкой отсчёта для
// требований IV6 (порядок сервисных колонок), IV8 (гейт инъекции наличием фичи) и
// IV10 (пиннинг, ADR 0010). Один инвариант композиции — один тест.

const SERVICE_HEAD = ".data-grid__head-cell[data-actions-column-cell='true']"

/** id заголовков слева направо (реальные колонки несут aria-colindex). */
const headIds = () =>
  headCellsLeftRight()
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .map(cell => cell.getAttribute('data-column-id'))

/** Заголовок сервисной колонки по её id. */
const serviceHead = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id='${id}']`,
  )

describe('Сервисные колонки — гейт наличием фичи (R8)', () => {
  test('без фич сервисных колонок в шапке нет', async () => {
    renderGrid({ columnCount: 4, dataCount: 5 })
    await waitForGrid()

    // Ни одной сервисной колонки: инъекция гейтится включённостью фичи.
    expect(document.querySelector(SERVICE_HEAD)).toBeNull()
  })

  test('включение только выбора добавляет ровно одну лидирующую сервисную колонку', async () => {
    renderGrid({ columnCount: 4, dataCount: 5, enableRowSelection: true })
    await waitForGrid()

    const services = document.querySelectorAll(SERVICE_HEAD)
    expect(services).toHaveLength(1)
    // Она — самый первый заголовок и это колонка выбора.
    expect(headIds()[0]).toBe(COLUMN_SELECTION_ID)
  })
})

describe('Сервисные колонки — порядок по умолчанию (R6)', () => {
  test('три лидирующие сервисные колонки идут в фиксированном порядке: dragging → selection → expanding', async () => {
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableRowDragging: true,
      enableRowSelection: true,
      enableRowExpanding: true,
      // Колонка раскрытия нужна и на плоских данных (ADR 0050).
      rowExpandingColumn: 'always',
    })
    await waitForGrid()

    // Первые три заголовка — сервисные, в каноническом порядке, перед данными.
    expect(headIds().slice(0, 3)).toEqual([
      COLUMN_DRAGGING_ID,
      COLUMN_SELECTION_ID,
      COLUMN_EXPANDING_ID,
    ])
  })
})

describe('Сервисные колонки — размещение и пиннинг (R6, R10)', () => {
  test('лидирующие сервисные — в начале, колонка действий — последняя и запиннена вправо', async () => {
    renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableRowDragging: true,
      enableRowSelection: true,
      enableRowExpanding: true,
      // Колонка раскрытия нужна и на плоских данных (ADR 0050).
      rowExpandingColumn: 'always',
      enableRowActions: true,
    })
    await waitForGrid()

    const ids = headIds()
    // Лидирующий блок сохраняет порядок…
    expect(ids.slice(0, 3)).toEqual([
      COLUMN_DRAGGING_ID,
      COLUMN_SELECTION_ID,
      COLUMN_EXPANDING_ID,
    ])
    // …колонка действий — трейлинг (последний заголовок)…
    expect(ids.at(-1)).toBe(ROW_ACTIONS_COLUMN_ID)
    // …и по умолчанию запиннена к правому краю.
    await expect
      .poll(() =>
        serviceHead(ROW_ACTIONS_COLUMN_ID)?.getAttribute('data-cell-pinned'),
      )
      .toBe('right')
  })
})

describe('Сервисные колонки — порядок при закреплении (ADR 0010)', () => {
  test('IV13: закрепление пользовательской колонки слева и справа и его снятие не меняют порядок сервисных колонок', async () => {
    // Два закреплённых блока сразу не помещаются в узкий кадр тестов.
    await withWideViewport(async () => {
      renderGrid({
        columnCount: 6,
        dataCount: 10,
        dataNesting: 'nested',
        enableRowDragging: true,
        enableRowSelection: true,
        enableRowExpanding: true,
        enableRowActions: true,
        enableColumnPinning: true,
      })
      await waitForGrid()
      const services = () =>
        headCellsLeftRight()
          .filter(
            cell => cell.getAttribute('data-actions-column-cell') === 'true',
          )
          .map(cell => cell.getAttribute('data-column-id'))
      const expected = [
        COLUMN_DRAGGING_ID,
        COLUMN_SELECTION_ID,
        COLUMN_EXPANDING_ID,
        ROW_ACTIONS_COLUMN_ID,
      ]
      const head = (id: string) => serviceHead(id)!
      await expect.poll(services).toEqual(expected)

      await pinViaPopover(head('firstName'), 'Pin right')
      await expect
        .poll(() => head('firstName').getAttribute('data-cell-pinned'))
        .toBe('right')
      expect(services(), 'справа').toEqual(expected)

      // У «Country» одна сторона — закрепляется кликом.
      await userEvent.click(await revealPin(head('country')))
      await expect
        .poll(() => head(COLUMN_DRAGGING_ID).getAttribute('data-cell-pinned'))
        .toBe('left')
      expect(services(), 'справа и слева').toEqual(expected)

      // Снять оба закрепления: у двусторонней колонки — повторным выбором отмеченной
      // стороны, у односторонней — кликом по кнопке.
      await userEvent.click(await revealPin(head('firstName')))
      await expect.poll(() => menuItemByText('Pin right')).toBeTruthy()
      await userEvent.click(menuItemByText('Pin right')!)
      await expect
        .poll(() =>
          /left|right/.test(
            head('firstName').getAttribute('data-cell-pinned') ?? '',
          ),
        )
        .toBe(false)
      await userEvent.click(await revealPin(head('country')))
      await expect
        .poll(() =>
          /left|right/.test(
            head('country').getAttribute('data-cell-pinned') ?? '',
          ),
        )
        .toBe(false)
      expect(services(), 'без закрепления').toEqual(expected)
    })
  })
})
