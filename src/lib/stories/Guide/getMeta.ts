import { ColumnMeta } from '@tanstack/react-table'

import { FieldType } from './types'

export const DEFAULT_META: FieldType = {
  id: '',
  name: 'id',
  label: '',
  width: 150,
  type: '',
}

export const getMeta = (meta: ColumnMeta<any, unknown> | undefined) => {
  return { ...DEFAULT_META, ...meta } satisfies FieldType
}

export const setMeta = (meta: FieldType) => meta
