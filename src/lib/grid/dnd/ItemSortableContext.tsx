import { type PropsWithChildren, createContext, useContext, useMemo } from 'react'

import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

export interface ItemSortableContextProps {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  listeners: SyntheticListenerMap | undefined
  attributes: DraggableAttributes
}

const ItemSortableContext = createContext<ItemSortableContextProps>({
  setActivatorNodeRef: () => null,
  attributes: {
    'aria-describedby': '',
    'aria-disabled': false,
    'aria-pressed': undefined,
    'aria-roledescription': '',
    role: '',
    tabIndex: 0,
  },
  listeners: undefined,
})

export const ItemSortableContextProvider = ({
  setActivatorNodeRef,
  attributes,
  listeners,
  children,
}: PropsWithChildren<ItemSortableContextProps>) => {
  const value = useMemo(
    () => ({
      setActivatorNodeRef,
      attributes,
      listeners,
    }),
    [setActivatorNodeRef, attributes, listeners],
  )

  return (
    <ItemSortableContext.Provider value={value}>
      {children}
    </ItemSortableContext.Provider>
  )
}

export const useItemSortableContext = () => useContext(ItemSortableContext)
