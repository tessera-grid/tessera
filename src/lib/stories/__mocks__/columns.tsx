import { useMemo } from 'react'

import { faker } from '@faker-js/faker'
import { createColumnHelper } from '@tanstack/react-table'

const columnHelper = createColumnHelper()

const getNamesWithCounter = (row: any, key: string) => {
  const names = row.subRows.map((r: any) => r.original[key])

  return `${names.slice(0, 2).join(', ')} ${names.length > 2 ? `(and ${names.length - 2} more)` : `(${names.length} records)`}`
}

export const columns: any[] = [
  columnHelper.accessor('country', {
    id: 'country',
    header: 'Country',
    // Демо `pinSides`: только левое закрепление — инлайн даёт прямой
    // тумблер без поповера.
    meta: { pinSides: 'left' },
    aggregatedCell: cell => {
      return cell.table.options.enableGrouping
        ? getNamesWithCounter(cell.row, 'country')
        : cell.getValue()
    },
    cell: cell => {
      return cell.row.getIsGrouped()
        ? getNamesWithCounter(cell.row, 'country')
        : cell.getValue()
    },
    footer: 'Total',
    size: 200,
    minSize: 200,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('firstName', {
    id: 'firstName',
    header: 'First Name',
    aggregatedCell: cell => {
      return cell.table.options.enableGrouping
        ? getNamesWithCounter(cell.row, 'firstName')
        : cell.getValue()
    },
    cell: cell => {
      return cell.row.getIsGrouped()
        ? getNamesWithCounter(cell.row, 'firstName')
        : cell.getValue()
    },
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('lastName', {
    id: 'lastName',
    header: 'Last Name',
    aggregatedCell: cell => {
      return cell.table.options.enableGrouping
        ? getNamesWithCounter(cell.row, 'lastName')
        : cell.getValue()
    },
    cell: cell => {
      return cell.row.getIsGrouped()
        ? getNamesWithCounter(cell.row, 'lastName')
        : cell.getValue()
    },
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('age', {
    id: 'age',
    header: 'Age',
    aggregatedCell: cell => {
      return cell.table.options.enableGrouping
        ? getNamesWithCounter(cell.row, 'age')
        : cell.getValue()
    },
    cell: cell => {
      return cell.row.getIsGrouped()
        ? getNamesWithCounter(cell.row, 'age')
        : cell.getValue()
    },
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('gender', {
    id: 'gender',
    header: 'Gender',
    cell: cell => {
      return cell.row.getIsGrouped()
        ? getNamesWithCounter(cell.row, 'gender')
        : cell.getValue()
    },
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('visits', {
    id: 'visits',
    header: 'Visits',
    // В сгруппированной строке getValue() возвращает агрегат (сумму),
    // в обычной — исходное значение.
    cell: cell => cell.getValue(),
    footer: '15',
    aggregationFn: 'sum' as never,
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
  columnHelper.accessor('total', {
    id: 'total',
    header: 'Total',
    // Демо `pinSides`: только правое закрепление — инлайн даёт прямой
    // тумблер без поповера.
    meta: { pinSides: 'right' },
    aggregationFn: 'sum' as never,
    // Сумма в сгруппированной строке (getValue() = агрегат), иначе исходное.
    cell: cell =>
      cell.row.getIsGrouped() ? `${cell.getValue()}$` : cell.getValue(),
    footer: '3000$',
    size: 150,
    minSize: 150,
    maxSize: 700,
    enableResizing: true,
    enableGrouping: true,
    enableSorting: true,
    enablePinning: true,
    enableDragging: true,
  }),
]

export const groupedColumns: any[] = [
  columnHelper.group({
    id: 'countryGroup',
    header: '',
    size: 150,
    minSize: 150,
    maxSize: 700,
    rowSpan: 2,
    enableResizing: false,
    columns: [
      columnHelper.group({
        id: 'countryNestedGroup',
        rowSpan: 0,
        enableResizing: false,
        columns: [
          columnHelper.accessor<any, any>('country', {
            id: 'country',
            header: 'Country',
            footer: 'Total',
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
    ],
  }),
  columnHelper.group({
    id: 'name',
    header: 'Name',
    enableResizing: false,
    rowSpan: 2,
    columns: [
      columnHelper.group({
        id: 'first-name-group',
        enableResizing: false,
        rowSpan: 0,
        columns: [
          columnHelper.accessor<any, any>('firstName', {
            id: 'firstName',
            header: 'First Name',
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
      columnHelper.group({
        id: 'last-name-group',
        enableResizing: false,
        rowSpan: 0,
        columns: [
          columnHelper.accessor<any, any>('lastName', {
            id: 'lastName',
            header: 'Last Name',
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
    ],
  }),
  columnHelper.group({
    id: 'info',
    header: 'Info',
    enableResizing: false,
    columns: [
      columnHelper.group({
        id: 'more-info',
        header: 'More Info',
        enableResizing: false,
        columns: [
          columnHelper.accessor<any, any>('age', {
            id: 'age',
            header: 'Age',
            aggregationFn: undefined,
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
          columnHelper.accessor<any, any>('gender', {
            id: 'gender',
            header: 'Gender',
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
      columnHelper.group({
        id: 'visits-group',
        enableResizing: false,
        columns: [
          columnHelper.accessor<any, any>('visits', {
            id: 'visits',
            header: 'Visits',
            footer: '15',
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
    ],
  }),
  columnHelper.group({
    id: 'totalGroup',
    header: '',
    rowSpan: 2,
    enableResizing: false,
    columns: [
      columnHelper.group({
        id: 'totalNestedGroup',
        rowSpan: 0,
        enableResizing: false,
        columns: [
          columnHelper.accessor('total', {
            id: 'total',
            header: 'Total',
            aggregatedCell: cell => `${cell.getValue()}$`,
            cell: cell => `${cell.getValue()}$`,
            footer: '3000$',
            size: 150,
            minSize: 150,
            maxSize: 700,
            enableResizing: true,
            enableGrouping: true,
            enableSorting: true,
            enablePinning: true,
            enableDragging: true,
          }),
        ],
      }),
    ],
  }),
]

export const useColumns = (count: number) => {
  return useMemo(
    () =>
      count >= columns.length
        ? [
            ...columns,
            ...Array.from({ length: count - columns.length }, (_, i) => {
              // Имя вычисляем ОДИН раз при создании колонки, а не в render-функции:
              // иначе faker выдаёт новое значение на каждый ре-рендер и текст
              // заголовка «плывёт» (тесты, читающие колонки по тексту, ложно зелены).
              const animal = faker.animal.type()
              return columnHelper.accessor(`col_${i}`, {
                id: `col_${i}`,
                header: () => (
                  <span style={{ lineHeight: '1rem' }}>{animal}</span>
                ),
                size: 150,
                minSize: 150,
                maxSize: 700,
                enableResizing: true,
                enableGrouping: true,
                enableSorting: true,
                enablePinning: true,
                enableDragging: true,
              })
            }),
          ]
        : columns.slice(0, count < 0 ? 0 : count),
    [count],
  )
}
