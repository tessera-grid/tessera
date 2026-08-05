import { useMemo } from 'react'

import { createColumnHelper } from '@tanstack/react-table'

import { OverflowTypography } from '../_shims'

import { Cell } from './Cell'
import { setMeta } from './getMeta'
import { switchActionColumn } from './switchActionColumn'
import {
  FieldType,
  ItemType,
  MyTableHooks,
  MyTableOptions,
  MyTableState,
} from './types'

interface UseColumnsParams {
  fields: FieldType[]
}

const columnHelper = createColumnHelper<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
>()

export const useColumns = ({ fields }: UseColumnsParams) => {
  const columns = useMemo(
    () =>
      fields.map((field: FieldType) => {
        return columnHelper.accessor(row => row[field.name], {
          id: field.id,
          header: () => (
            <OverflowTypography typographyProps={{ variant: 'subtitle2' }}>
              {field.label}
            </OverflowTypography>
          ),
          cell: Cell,
          meta: setMeta(field),
          size: field.width,
          enableSorting: true,
          enableResizing: true,
        })
      }),
    [fields],
  )

  return useMemo(
    () => (columns.length > 0 ? [...columns, switchActionColumn] : []),
    [columns],
  )
}
