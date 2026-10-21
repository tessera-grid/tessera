import type { TesseraFeatureEntry } from '../core/features'
import { Meta, StoryObj } from '@storybook/react'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { HighlightDemo } from './demos/highlightDemos'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  bodyRow,
  headCell,
  orderedRows,
  settle,
  sleep,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

/**
 * Публичная подсветка (ADR 0080): «Delete» в строке подсвечивает её красным, пока
 * удаление не подтверждено; поиск отмечает совпадения; кнопки — вспышка ячейки и
 * подсветка колонки. Включите выбор строк, закрепление или выделение ячеек в Controls,
 * чтобы увидеть подсветку поверх этих состояний.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Highlight',
} satisfies Meta<StoryProps>

export default meta

export const RowHighlight: StoryObj<StoryProps> = {
  name: 'Default',
  args: {
    enableRowActions: true,
    // Действия строки — только «Delete» демо-плагина.
    actionsDemo: 'none',
    enableFooter: true,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  render: function Render(args) {
    return <HighlightDemo {...normalizeArgs(args)} />
  },
  // Дымовой тест (ADR 0080, HL21): удаление с подсветкой до подтверждения, поиск,
  // вспышка ячейки и подсветка колонки.
  parameters: {
    requirements: ['HL21'],
    ...showControls(
      [
        'enableFooter',
        'enableRowActions',
        'rowActionsWidth',
        'rowActionsCollapsedWidth',
        'rowActionsColumn',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    await waitForRows(canvasElement)
    const row = (id: string) => bodyRow(canvasElement, id)
    const remove = async (id: string) => {
      await userEvent.hover(row(id))
      await userEvent.click(
        row(id).querySelector<HTMLElement>('button[aria-label="Удалить"]')!,
      )
    }
    const [first, , second] = orderedRows(canvasElement).map(
      r => r.dataset.rowId!,
    )
    const gridTop = () =>
      canvasElement
        .querySelector('.data-grid__container')!
        .getBoundingClientRect().top
    const top = gridTop()

    await remove(first!)
    await until(() =>
      expect(row(first!)).toHaveAttribute('data-highlight', 'danger'),
    )
    // Подтверждение — в строке заголовка демо: таблица не сдвигается.
    expect(gridTop()).toBe(top)
    // Подсветка держится, пока удаление не подтверждено, — дольше затухания.
    await sleep(800)
    expect(row(first!)).toHaveAttribute('data-highlight', 'danger')
    expect(row(first!)).not.toHaveAttribute('data-highlight-out')

    // Вторая строка встаёт в ту же очередь, повторное нажатие первой — не дубль.
    await remove(second!)
    await remove(first!)
    const confirm = () =>
      screen.getByRole('group', { name: 'Подтверждение удаления' })
    await until(() => expect(confirm()).toHaveTextContent('Удалить 2 строки?'))
    expect(row(second!)).toHaveAttribute('data-highlight', 'danger')
    await userEvent.click(
      within(confirm()).getByRole('button', { name: 'Отмена' }),
    )
    const faded = (id: string) =>
      row(id).hasAttribute('data-highlight-out') ||
      !row(id).hasAttribute('data-highlight')
    await until(() => expect(faded(first!) && faded(second!)).toBe(true))

    await remove(first!)
    await userEvent.click(
      within(confirm()).getByRole('button', { name: 'Удалить' }),
    )
    await until(() => expect(row(first!)).toBeNull())

    // Остальные шаги — в свёрнутом аккордеоне «Демо».
    await userEvent.click(screen.getByRole('button', { name: /Демо/ }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Поиск по имени и стране' }),
      'a',
    )
    await until(() =>
      expect(
        canvasElement.querySelectorAll(
          '.data-grid__body-cell[data-highlight="warning"]',
        ).length,
      ).toBeGreaterThan(0),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Подсветить ячейку' }),
    )
    await until(() =>
      expect(
        canvasElement.querySelectorAll(
          '.data-grid__body-cell[data-highlight="success"]',
        ),
      ).toHaveLength(1),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Подсветить колонку' }),
    )
    await until(() =>
      expect(headCell(canvasElement, 'total')).toHaveAttribute(
        'data-column-highlight',
        'success',
      ),
    )
    await settle()
  },
}

/** Подсветки строки, ячейки и колонки — один раз, как только появились строки. */
const highlightsDemo: TesseraFeatureEntry = {
  id: 'highlightsDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      highlight: (target: object, options?: object) => unknown
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.highlight({ row: 'item-id-1' }, { tone: 'info' })
      t.highlight({ row: 'item-id-3' }, { tone: 'danger' })
      t.highlight(
        { cell: { row: 'item-id-5', column: 'firstName' } },
        { tone: 'success' },
      )
      t.highlight({ column: 'age' }, { tone: 'warning' })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/** Подсвеченные строка, ячейка и колонка (ADR 0093, VR4). */
export const HighlightStateLit: StoryObj<StoryProps> = {
  name: 'State: highlights',
  parameters: { ...vrStates('body.highlight'), ...showControls([]) },
  args: {
    extraPlugins: [highlightsDemo],
    dataCount: 12,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-highlight]')).not.toBeNull(),
    )
    await settle()
  },
}
