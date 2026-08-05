import { useMemo } from 'react'

import { ItemType } from './types'

const useDataQuery = (): ItemType[] => {
  return useMemo(
    () => [
      { id: '0', name: 'Name 1', description: 'desc', price: 100 },
      { id: '1', name: 'Name 2', description: 'desc', price: 200 },
      { id: '2', name: 'Name 3', description: 'desc', price: 300 },
    ],
    [],
  )
}

export const useData = () => {
  return useDataQuery()
}
