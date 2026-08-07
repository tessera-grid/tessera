import {
  PropsWithChildren,
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react'

import { FastScrollState, FastScrollStore, INITIAL_STATE } from './useFastScroll'

const NOOP_STORE: FastScrollStore = {
  subscribe: () => () => {},
  getSnapshot: () => INITIAL_STATE,
}

const FastScrollContext = createContext<FastScrollStore>(NOOP_STORE)

interface FastScrollProviderProps {
  store: FastScrollStore
}

export const FastScrollProvider = ({
  store,
  children,
}: PropsWithChildren<FastScrollProviderProps>) => {
  return (
    <FastScrollContext.Provider value={store}>
      {children}
    </FastScrollContext.Provider>
  )
}

/** Полное состояние быстрого скролла. */
export const useFastScrollState = (): FastScrollState => {
  const store = useContext(FastScrollContext)

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * Признак того, что ячейка, смонтированная в текущей сессии быстрого скролла,
 * должна показывать заглушку. Селектор возвращает `boolean`, поэтому ячейка
 * перерисовывается только при смене этого значения — ячейки, смонтированные до
 * текущей сессии, не реагируют на вход/выход из режима.
 */
export const useFastScrollSuppressed = (): boolean => {
  const store = useContext(FastScrollContext)
  const mountedInSession = useRef(store.getSnapshot().sessionId).current

  return useSyncExternalStore(store.subscribe, () => {
    const state = store.getSnapshot()

    return state.isFastScrolling && mountedInSession === state.sessionId
  })
}
