import { PropsWithChildren, createContext, useContext } from 'react'

import { FastScrollState, INITIAL_STATE } from './useFastScroll'

const FastScrollContext = createContext<FastScrollState>(INITIAL_STATE)

interface FastScrollProviderProps {
  state: FastScrollState
}

export const FastScrollProvider = ({
  state,
  children,
}: PropsWithChildren<FastScrollProviderProps>) => {
  return (
    <FastScrollContext.Provider value={state}>
      {children}
    </FastScrollContext.Provider>
  )
}

export const useFastScrollState = () => useContext(FastScrollContext)
