import { Fragment, memo } from 'react'

import { CellContext, HeaderContext } from '@tanstack/react-table'

import { RegisterSlotParams } from '../createSlots'

interface PluginSlotProps {
  slot?: RegisterSlotParams<any>[]
  context: HeaderContext<any, unknown> | CellContext<any, unknown>
}

export const RenderSlot = memo(({ slot, context }: PluginSlotProps) => {
  if (!slot?.length) {
    return null
  }

  return slot.map(({ id, order, render, component: Component }) => {
    if (Component) {
      return (
        <Fragment key={`${id}-${order}`}>
          <Component {...context} />
        </Fragment>
      )
    }

    return (
      <Fragment key={`${id}-${order}`}>
        {typeof render === 'function' ? render(context) : render}
      </Fragment>
    )
  })
})

RenderSlot.displayName = 'RenderSlot'
