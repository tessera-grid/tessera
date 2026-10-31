/**
 * Обёртки и декораторы плагинов в гриде (ADR 0168, §2): внешний — первый в наборе. Без
 * записей грид рисует как есть, без лишних компонентов.
 */
import { type ComponentType, type ReactNode, useMemo } from 'react'

import { commonOptionsOf } from '../core/commonFeature'
import {
  type FoldedWrappers,
  type PluginWrapper,
  createEmptyWrappers,
} from '../core/pluginWrappers'

const NO_WRAPPERS = createEmptyWrappers()

export const wrappersOf = (table: unknown): FoldedWrappers =>
  commonOptionsOf(table).pluginWrappers ?? NO_WRAPPERS

/**
 * Декораторы вокруг базового компонента: внешний получает следующий слой пропсом `slot`,
 * без декораторов — `undefined`.
 */
export const useDecorators = <P extends object, K extends string>(
  decorators: readonly PluginWrapper<any>[],
  Base: ComponentType<P>,
  slot: K,
) =>
  useMemo(() => {
    if (decorators.length === 0) return undefined
    const layer = (index: number): ComponentType<P> => {
      if (index === decorators.length) return Base
      const Decorator = decorators[index].component as ComponentType<
        P & Record<K, ComponentType<P>>
      >
      const Next = layer(index + 1)
      const Layer = (props: P) => (
        <Decorator {...props} {...({ [slot]: Next } as Record<K, never>)} />
      )
      return Layer
    }
    return {
      Outer: decorators[0].component as ComponentType<
        P & Record<K, ComponentType<P>>
      >,
      Inner: layer(1),
    }
  }, [decorators, Base, slot])

/** Обёртки вокруг детей: внешняя — первая в наборе. */
export const wrapWith = <P extends { children: ReactNode }>(
  wrappers: readonly PluginWrapper<P>[],
  props: Omit<P, 'children'>,
  children: ReactNode,
): ReactNode =>
  wrappers.reduceRight<ReactNode>((inner, { id, component: Wrapper }) => {
    const all = { ...props, children: inner } as P
    return <Wrapper key={id} {...all} />
  }, children)
