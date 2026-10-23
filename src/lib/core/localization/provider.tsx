import { ReactNode, useMemo } from 'react'

import { LocalizationContext } from './localization'
import {
  DEFAULT_LOCALE,
  type LabelDictionary,
  resolveLabels,
} from './resolveLabels'

export interface LocalizationProviderProps {
  localization?: LabelDictionary
  locale?: string
  children: ReactNode
}

export const LocalizationProvider = ({
  localization,
  locale = DEFAULT_LOCALE,
  children,
}: LocalizationProviderProps) => {
  const value = useMemo(
    () => resolveLabels(localization, locale),
    [localization, locale],
  )

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  )
}
