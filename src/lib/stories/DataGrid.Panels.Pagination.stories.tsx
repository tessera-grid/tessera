import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  ServerPaginationDemo,
  type ServerPaginationDemoProps,
} from './demos/panelsDemos'
import { expect, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  callbackLog,
  firstRowText,
  headCell,
  orderedRows,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'

/** Пагинация (ADR 0038): на клиенте и серверная с сортировкой. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Pagination',
} satisfies Meta<StoryProps>

export default meta

export const Pagination: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: vrStates('panel.pagination'),
  args: {
    // Пагинация в нижней панели: размер страницы, диапазон и кнопки. Включите
    // enableColumnSorting — смена сортировки вернёт на первую страницу.
    enablePagination: true,
    dataCount: 1000,
  },
}

export const PaginationServer: StoryObj<ServerPaginationDemoProps> = {
  name: 'Server',
  args: {
    containerHeight: 560,
    height: 460,
    maxHeight: 460,
    serverDelayMs: 400,
    // Грид не режет и не сортирует строки: страница и сортировка уходят в
    // onPageChange / onToggleColumnSort (журнал справа), «сервер» отвечает страницей
    // с задержкой, итог страниц — из paginationRowCount.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <ServerPaginationDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0042, DS6): страница и сортировка приходят с сервера, итог —
  // из paginationRowCount.
  parameters: { requirements: ['DS6'] },
  play: async ({ canvasElement }) => {
    const firstName = () => firstRowText(canvasElement, 'name')
    const range = () => byTestId('pagination-range')?.textContent
    await waitForRows(canvasElement)
    await until(() => expect(range()).toBe('1–25 of 230'))
    expect(firstName()).toBe('Alice 0')

    await userEvent.click(
      canvasElement.querySelector<HTMLElement>('[data-page-action="next"]')!,
    )
    await until(() => expect(firstName()).toMatch(/ 25$/))
    expect(range()).toBe('26–50 of 230')
    expect(callbackLog()).toContain('onPageChange')
    expect(callbackLog()).toContain('page 2 of 10')

    await userEvent.click(
      headCell(canvasElement, 'name').querySelector<HTMLElement>(
        '.column-sort__button',
      )!,
    )
    await until(() =>
      expect(callbackLog()).toMatch(/page 2 of 10 by name (asc|desc)/),
    )
    expect(callbackLog()).toContain('onToggleColumnSort')
    const sign = /by name desc/.test(callbackLog()) ? -1 : 1
    const sorted = () => {
      const names = orderedRows(canvasElement).map(row =>
        row.querySelector('[data-column-id="name"]')!.textContent!.trim(),
      )
      return names.every(
        (name, i) =>
          i === 0 ||
          sign *
            names[i - 1]!.localeCompare(name, undefined, { numeric: true }) <=
            0,
      )
    }
    await until(() => expect(sorted()).toBe(true))
    expect(range()).toBe('26–50 of 230')
    await settle()
  },
}
