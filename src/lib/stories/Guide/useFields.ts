import { useMemo } from 'react'

import { FieldType } from './types'

export const useFields = (): FieldType[] => {
  return useMemo(
    () => [
      {
        id: '0',
        name: 'id',
        label: 'ID',
        width: 100,
        type: 'string',
      },
      {
        id: '1',
        name: 'name',
        label: 'Name',
        width: 100,
        type: 'string',
      },
      {
        id: '2',
        name: 'description',
        label: 'Description',
        width: 100,
        type: 'string',
      },
      {
        id: '3',
        name: 'price',
        label: 'Price',
        width: 100,
        type: 'number',
      },
    ],
    [],
  )
}
