import { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { getData } from './__mocks__/data'
import {
  applyPseudoStates,
  bodyRow,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/**
 * Состояния каталога только для снимков (ADR 0093, ADR 0117 §8): в `storybook dev` и
 * сборке для Chromatic, не в публичной. Состояние, которое не показать шагом гайда.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Common/Catalog states',
} satisfies Meta<StoryProps>

export default meta

/**
 * Наведённые строки (ADR 0093, VR4, VR8): обычная и выбранная; наведение — псевдо-состояние,
 * а не курсор.
 */
const HOVERED_ROWS = ['item-id-2', 'item-id-4'].map(
  id => `.data-grid__body-row[data-row-id="${id}"]`,
)

export const CoreStateHoveredRow: StoryObj<StoryProps> = {
  name: 'State: hovered row',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes({
      ...vrStates('body.hover'),
      requirements: ['VR8'],
      catalogPseudo: {
        // Строка и одна ячейка под указателем — с кнопкой правки.
        hover: HOVERED_ROWS.flatMap(row => [
          row,
          `${row} .data-grid__body-cell[data-column-id="age"]`,
        ]),
      },
    }),
    ...showControls([
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowActions',
      'rowActionsWidth',
      'rowActionsCollapsedWidth',
      'rowActionsColumn',
      'enableCellEditing',
    ]),
  },
  args: {
    enableRowSelection: true,
    enableCellEditing: true,
    enableRowActions: true,
    // Строки — с первого рендера: псевдо-состояние ставится на смонтированные узлы.
    dataOverride: getData(12),
    dataCount: 12,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement, id, parameters }) => {
    await waitForRows(canvasElement)
    await userEvent.click(
      bodyRow(canvasElement, 'item-id-4').querySelector('[role="checkbox"]')!,
    )
    ;(document.activeElement as HTMLElement | null)?.blur()
    await until(() =>
      expect(bodyRow(canvasElement, 'item-id-4')).toHaveAttribute(
        'data-selected',
        'true',
      ),
    )
    await applyPseudoStates(id, parameters.catalogPseudo)
    // Кнопки наведённой строки видны, у соседней — нет: вид не зависит от указателя.
    const hidden = (row: string) =>
      [
        ...canvasElement.querySelectorAll<HTMLElement>(
          `.data-grid__body-row[data-row-id="${row}"] .cell__button--hidden`,
        ),
      ].map(button => getComputedStyle(button).opacity)
    await waitFor(() => expect(hidden('item-id-2')).toContain('1'))
    // Указатель мог пройти над соседней строкой по пути к флажку: её кнопки гаснут переходом.
    await waitFor(() =>
      expect(hidden('item-id-3').every(opacity => opacity === '0')).toBe(true),
    )
    // В высокой контрастности цвет чипа системный (ADR 0087), его прячет прозрачность обёртки.
    if (matchMedia('(forced-colors: active)').matches) return
    // Чип действий строки — тоже: значок наведённой строки закрашен, у соседней прозрачен.
    const chipColor = (row: string) =>
      getComputedStyle(
        canvasElement.querySelector(
          `.data-grid__body-row[data-row-id="${row}"] .row__button--hidden > button`,
        )!,
      ).color
    await waitFor(() => {
      expect(chipColor('item-id-2')).not.toBe('rgba(0, 0, 0, 0)')
      // Указатель мог стоять над этой строкой, пока щелчок не увёл его к флажку.
      expect(chipColor('item-id-3')).toBe('rgba(0, 0, 0, 0)')
    })
  },
}

/**
 * Ручка ширины под наведением заголовка (ADR 0093, VR5): ручка видна только при наведении,
 * а у наведения заголовка своего вида нет — шагом гайда его не проверить (CX14).
 */
export const ColumnsStateResizeHandle: StoryObj<StoryProps> = {
  name: 'State: resize handle',
  parameters: {
    ...vrStates('head.resizeHandle'),
    catalogPseudo: {
      hover: ['.data-grid__head-cell[data-column-id="country"]'],
    },
    ...showControls(['enableColumnSizing']),
  },
  args: {
    enableColumnSizing: true,
    dataCount: 20,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: async ({ canvasElement, id, parameters }) => {
    await waitForRows(canvasElement)
    await applyPseudoStates(id, parameters.catalogPseudo)
  },
}
