import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'
import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'

// Runtime-toggle parity for EVERY plugin (R11). Presence-based
// композиция обещает: включение/выключение плагина в рантайме (без перезагрузки
// страницы) меняет грид ровно так же, как свежий маунт с тем же набором — никаких
// «застрявших» пустых артефактов и никаких падений. Опасный класс: TanStack
// вычисляет `_features` ОДИН раз при createTable и не перечитывает их, поэтому
// фича, вешающая на инстанс методы (`getCanDrag`, `getCanPin`, `getCanExpand`,
// `getCanSomeRowsSelect`) или `renderComponent` сервисной ячейки/шапки, обязана
// оставаться в `_features` и при `enabled: false` (`keepFeatureWhenDisabled`) —
// иначе аффорданс при live-включении не появляется (пустая колонка) или зовётся
// несуществующий метод. Каждый плагин — отдельное требование (свой тест).
//
// Демо-слой мапит boolean-тумблер в `фабрика({ enabled })` (см.
// `__mocks__/utils/argsToPlugins`), поэтому переключение флага истории и есть
// presence-based включение/выключение плагина.

const composed = composeStories(stories)

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'

interface ToggleCase {
  /** Плагин (id записи реестра) — часть имени теста. */
  plugin: string
  /** Каноническая история плагина: несёт нужные данные/размеры. */
  story: keyof typeof composed
  /** Boolean-тумблер демо, который маппится в `enabled` фабрики. */
  flag: string
  /** Селектор аффорданса, который рендерит плагин, когда включён. */
  affordance: string
}

// Ручка dnd — общий компонент с классом `.drag__handler--column` и для строк, и
// для столбцов; в канонической истории активен лишь один dnd-плагин, поэтому
// строчную и столбцовую ручки различаем по месту (тело против шапки).
const CASES: ToggleCase[] = [
  {
    plugin: 'rowSelection',
    story: 'RowSelection',
    flag: 'enableRowSelection',
    affordance: '.row-select-checkbox',
  },
  {
    plugin: 'rowExpanding',
    story: 'RowExpanding',
    flag: 'enableRowExpanding',
    affordance: '.row-expand-button',
  },
  {
    plugin: 'rowDragging',
    story: 'RowDragging',
    flag: 'enableRowDragging',
    affordance: `${BODY_CELL} .drag__handler--column`,
  },
  {
    plugin: 'rowGrouping',
    story: 'RowGrouping',
    flag: 'enableGrouping',
    affordance: '.column-group__button',
  },
  {
    plugin: 'rowActions',
    story: 'RowActions',
    flag: 'enableRowActions',
    affordance: `${HEAD_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
  },
  {
    plugin: 'columnSorting',
    story: 'ColumnSorting',
    flag: 'enableColumnSorting',
    affordance: '.column-sort__button',
  },
  {
    plugin: 'columnResizing',
    story: 'ColumnResizing',
    flag: 'enableColumnResizing',
    affordance: '.resize__handler--column',
  },
  {
    plugin: 'columnDragging',
    story: 'ColumnDragging',
    flag: 'enableColumnDragging',
    affordance: `${HEAD_CELL} .drag__handler--column`,
  },
  {
    plugin: 'columnPinning',
    story: 'ColumnPinning',
    flag: 'enableColumnPinning',
    affordance: '.column-pin__button',
  },
]

describe('Plugin runtime toggle — enable/disable parity (no reload)', () => {
  for (const { plugin, story, flag, affordance } of CASES) {
    test(`RT-${plugin}: toggling ${flag} at runtime adds then removes the affordance without a remount`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- динамический флаг истории
      const Story = composed[story] as any
      const withFlag = (on: boolean) => <Story {...{ [flag]: on }} />

      const { container, rerender } = await render(withFlag(false))
      await expect
        .poll(() => container.querySelectorAll(HEAD_CELL).length)
        .toBeGreaterThan(1)

      // Выключен: аффорданса нет.
      expect(container.querySelectorAll(affordance).length).toBe(0)

      // Live-включение (без ремаунта): аффорданс появляется, как на свежем маунте.
      await rerender(withFlag(true))
      await expect
        .poll(() => container.querySelectorAll(affordance).length)
        .toBeGreaterThan(0)

      // Live-выключение: аффорданс исчезает без остаточных пустых артефактов.
      await rerender(withFlag(false))
      await expect
        .poll(() => container.querySelectorAll(affordance).length)
        .toBe(0)
    })
  }
})
