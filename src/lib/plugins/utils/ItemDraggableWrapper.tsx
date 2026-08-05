import { PropsWithChildren } from 'react'

import {
  ItemSortableContextProps,
  ItemSortableContextProvider,
} from './ItemSortableContext'

interface ItemDraggableWrapperProps extends ItemSortableContextProps {
  isRowDraggingEnable: boolean
}

export const ItemDraggableWrapper = ({
  isRowDraggingEnable,
  setActivatorNodeRef,
  attributes,
  listeners,
  children,
}: PropsWithChildren<ItemDraggableWrapperProps>) => {
  if (isRowDraggingEnable) {
    return (
      <ItemSortableContextProvider
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
      >
        {children}
      </ItemSortableContextProvider>
    )
  }

  return children
}
