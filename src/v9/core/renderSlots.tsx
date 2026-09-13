/**
 * Cutover — v9-порт RenderSlot: рисует компоненты слота (плагины) в переданном
 * контексте. Логика идентична v8; контекст теперь v9 (типизирован как unknown —
 * слот-компоненты принимают HeaderContext/CellContext v9).
 */
import { Fragment } from 'react'

import type { RegisterSlotParams } from './createSlots'

interface RenderSlotProps {
  slot?: RegisterSlotParams<any>[]
  context: unknown
}

export const RenderSlot = ({ slot, context }: RenderSlotProps) => {
  if (!slot?.length) {
    return null
  }

  return (
    <>
      {slot.map(({ id, order, render, component: Component }) => (
        <Fragment key={`${id}-${order}`}>
          {Component ? (
            <Component {...(context as object)} />
          ) : typeof render === 'function' ? (
            render(context as never)
          ) : (
            render
          )}
        </Fragment>
      ))}
    </>
  )
}
