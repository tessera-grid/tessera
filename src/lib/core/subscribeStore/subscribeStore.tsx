import {
  ReactNode,
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

import { Table } from '@tanstack/react-table'

type Listener = () => void

interface SubscriptionStore {
  subscribe: (listener: Listener) => () => void
  notify: () => void
}

const createSubscriptionStore = (): SubscriptionStore => {
  const listeners = new Set<Listener>()

  return {
    subscribe: listener => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    notify: () => {
      listeners.forEach(listener => listener())
    },
  }
}

const NOOP_SUBSCRIBE = () => () => undefined

const SubscriptionStoreContext = createContext<SubscriptionStore | null>(null)

export interface SubscriptionStoreProviderProps {
  table: Table<any>
  children: ReactNode
}

export const SubscriptionStoreProvider = ({
  table,
  children,
}: SubscriptionStoreProviderProps) => {
  const store = useMemo(createSubscriptionStore, [])

  const state = table.getState()
  const hooks = table.getHooks()
  const options = table.options

  const previousState = useRef(state)
  const previousHooks = useRef(hooks)
  const previousOptions = useRef(options)

  useLayoutEffect(() => {
    if (
      previousState.current === state &&
      previousHooks.current === hooks &&
      previousOptions.current === options
    ) {
      return
    }

    previousState.current = state
    previousHooks.current = hooks
    previousOptions.current = options

    store.notify()
  })

  return (
    <SubscriptionStoreContext.Provider value={store}>
      {children}
    </SubscriptionStoreContext.Provider>
  )
}

export type SubscribeParamsType = string | number | boolean | null | undefined

const PARAMS_SEPARATOR = '\u0000'

/**
 * Механизм гранулированной подписки на состояния и параметры таблицы для реактивности внешних плагинов
 * @param getSubscribeParams Набор примитивных зависимостей
 */
export const useSubscribeStore = (
  getSubscribeParams: () => SubscribeParamsType[],
) => {
  const store = useContext(SubscriptionStoreContext)

  return useSyncExternalStore(store ? store.subscribe : NOOP_SUBSCRIBE, () =>
    getSubscribeParams().join(PARAMS_SEPARATOR),
  )
}
