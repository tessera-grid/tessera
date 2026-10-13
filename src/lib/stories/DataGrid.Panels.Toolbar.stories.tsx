import { Meta, StoryObj } from '@storybook/react'
import { toolbarDemoPlugins } from './toolbarDemo'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { filteringColumns, filteringData } from './__mocks__/filteringData'
import { vrStates } from './__mocks__/catalog'

/** Тулбар (ADR 0035, ADR 0051): кнопки плагинов, все кнопки, пустой тулбар. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Toolbar',
} satisfies Meta<StoryProps>

export default meta

export const WithToolbar: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    // Демо-кнопки в двух подгруппах (`view` и `data`): видны порядок, разделитель
    // и состояния F4 — активное (Settings) и disabled (Export). Тулбар вызывают
    // сами кнопки — флаг не нужен (ADR 0046).
    extraPlugins: toolbarDemoPlugins,
  },
}

export const ToolbarAllButtons: StoryObj<StoryProps> = {
  name: 'All buttons',
  parameters: vrStates('panel.toolbar'),
  args: {
    // Все встроенные кнопки разом (ADR 0051): слева поиск и «Фильтры», справа
    // «Колонки», затем «Экспорт». Порядок задают группы search → view → data, а не
    // порядок плагинов. Сузьте окно — поле поиска сжимается, стороны не наезжают.
    columnsOverride: filteringColumns,
    dataOverride: filteringData,
    enableQuickSearch: true,
    enableColumnFiltering: true,
    enableColumnVisibility: true,
    enableDataExport: true,
  },
}

export const WithEmptyToolbar: StoryObj<StoryProps> = {
  name: 'Empty',
  args: {
    // Пустой тулбар держит только явный enableToolbar: true (ADR 0046).
    enableToolbar: true,
  },
}
