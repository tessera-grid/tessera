import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  ServerPaginationDemo,
  type ServerPaginationDemoProps,
} from './demos/panelsDemos'

/** Пагинация (ADR 0038): на клиенте и серверная с сортировкой. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Pagination',
} satisfies Meta<StoryProps>

export default meta

export const Pagination: StoryObj<StoryProps> = {
  name: 'Basic',
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
}
