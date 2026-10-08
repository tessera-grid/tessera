import { Meta, StoryObj } from '@storybook/react'

import { exportFormats } from '../plugins/dataExport'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { ExportServerDemo } from './demos/exportDemos'

/** Экспорт данных (ADR 0044, ADR 0073): панель настроек, быстрые наборы, Excel, серверный режим. */

interface ExportArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: 'never' | 'always'
}

const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Export',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 6,
  containerHeight: 560,
  height: 460,
  maxHeight: 460,
  enableExport: true,
}

export const Export: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    ...GRID,
    dataCount: 50,
    // Кнопка «Экспорт» открывает панель: «Колонки» — видимые или все; «Строки» — все
    // данные. CSV с UTF-8 BOM и защитой от формул. Включите enableColumnVisibility и
    // скройте колонку — «Видимые колонки» её не выгрузят, «Все колонки» выгрузят.
  },
}

export const ExportDirect: StoryObj<StoryProps> = {
  name: 'Direct click',
  args: {
    ...GRID,
    dataCount: 50,
    // Разработчик оставил одну допустимую комбинацию (`allow.columns: ['visible']`,
    // строки — только «все данные»): панели нет, клик сразу скачивает CSV.
    exportOptions: { allow: { columns: ['visible'] } },
  },
}

export const ExportPresets: StoryObj<StoryProps> = {
  name: 'Settings and quick sets',
  args: {
    ...GRID,
    dataCount: 200,
    // Оси «Строки» появляются по активным плагинам: «С учётом сортировки», «Текущая
    // страница», «Выбранные строки» (недоступны, пока ничего не выбрано). Быстрые наборы
    // сверху панели заполняют оси, но не выгружают; выбор запоминается до перезагрузки.
    enableColumnSorting: true,
    enablePagination: true,
    paginationPageSize: 25,
    enableRowSelection: true,
    exportOptions: {
      presets: [
        { id: 'everything', label: 'Everything', rows: 'all', columns: 'all' },
        {
          id: 'selection',
          label: 'Selection',
          rows: 'selected',
          columns: 'visible',
        },
      ],
    },
  },
}

export const ExportExcel: StoryObj<StoryProps> = {
  name: 'Excel',
  args: {
    ...GRID,
    dataCount: 200,
    // Формат Excel подключён рядом с CSV (`exportFormats.xlsx()`): числа и даты в
    // файле — типизированные ячейки, шапка закреплена, ширины — как в гриде. Закрепите
    // колонку слева — в Excel она тоже закреплена. Генератор грузится при первой
    // выгрузке в Excel.
    enableColumnPinning: true,
    enableColumnResizing: true,
    exportOptions: { formats: [exportFormats.csv(), exportFormats.xlsx()] },
  },
  argTypes: { exportOptions: { control: false } },
}

export const ExportServer: StoryObj<ExportArgs> = {
  name: 'Server',
  args: {
    ...GRID,
    // Страница из 1000 строк: «Текущая страница» скачивает клиент (onExported),
    // остальные значения строк уходят в onExport с ожиданием — кнопка занята,
    // «Выгрузить» с серверным значением заблокирована; «Выбранные строки» отдают
    // rowIds. Режим отказа — ошибка в консоли, кнопка освобождается.
    enableColumnSorting: true,
    enablePagination: true,
    paginationPageSize: 25,
    enableRowSelection: true,
    serverDelayMs: 2000,
    serverFailMode: 'never',
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    serverFailMode: { control: 'inline-radio', options: ['never', 'always'] },
  },
  parameters: {
    controls: {
      exclude: ['columnCount', 'dataCount', 'colorMode'],
    },
  },
  render: args => <ExportServerDemo {...normalizeArgs(args)} />,
}
