/**
 * RenderSlot: рисует компоненты слота (плагины) в переданном контексте
 * (типизирован как unknown — слот-компоненты принимают HeaderContext/CellContext).
 */
import { Fragment, type ReactNode } from 'react'

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

interface RenderCellSlotProps {
  slot?: RegisterSlotParams<any>[]
  context: unknown
  /** Собственный рендер ячейки — владелец получает его пропсом `content`. */
  content: ReactNode
}

/**
 * Рендер слота-владельца ячейки (`cellSlot`): собственный контент прокидывается
 * компоненту пропсом `content`, тот решает — показать его или заместить своим.
 * Несколько владельцев вкладываются (reduceRight): внешний оборачивает внутреннего.
 * Пустой слот отдаёт контент как есть.
 */
export const RenderCellSlot = ({
  slot,
  context,
  content,
}: RenderCellSlotProps): ReactNode => {
  if (!slot?.length) {
    return content
  }

  return slot.reduceRight<ReactNode>(
    (child, { component: Component }) =>
      Component ? (
        <Component {...(context as object)} content={child} />
      ) : (
        child
      ),
    content,
  )
}
