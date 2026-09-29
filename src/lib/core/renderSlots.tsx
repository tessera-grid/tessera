/**
 * RenderSlot: рисует компоненты слота (плагины) в переданном контексте
 * (типизирован как unknown — слот-компоненты принимают HeaderContext/CellContext).
 */
import { Fragment, type ReactNode } from 'react'

import type { RegisterSlotParams } from './createSlots'
import { PluginErrorBoundary } from './pluginBoundary'

interface RenderSlotProps {
  slot?: RegisterSlotParams<any>[]
  context: unknown
}

// `render` вызывается внутри компонента, чтобы его исключение поймала граница плагина.
const SlotRender = ({
  render,
  context,
}: {
  render: RegisterSlotParams<any>['render']
  context: unknown
}): ReactNode =>
  typeof render === 'function' ? render(context as never) : (render ?? null)

const tableOf = (context: unknown) => (context as { table?: unknown }).table

export const RenderSlot = ({ slot, context }: RenderSlotProps) => {
  if (!slot?.length) {
    return null
  }

  return (
    <>
      {slot.map(({ id, order, render, component: Component, pluginId }) => {
        const node = Component ? (
          <Component {...(context as object)} />
        ) : (
          <SlotRender render={render} context={context} />
        )
        return (
          <Fragment key={`${id}-${order}`}>
            {pluginId ? (
              <PluginErrorBoundary pluginId={pluginId} table={tableOf(context)}>
                {node}
              </PluginErrorBoundary>
            ) : (
              node
            )}
          </Fragment>
        )
      })}
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
    (child, { component: Component, pluginId }) => {
      if (!Component) {
        return child
      }
      const owner = <Component {...(context as object)} content={child} />
      // Упавший владелец отдаёт контент ячейки как есть.
      return pluginId ? (
        <PluginErrorBoundary
          pluginId={pluginId}
          table={tableOf(context)}
          fallback={child}
        >
          {owner}
        </PluginErrorBoundary>
      ) : (
        owner
      )
    },
    content,
  )
}
