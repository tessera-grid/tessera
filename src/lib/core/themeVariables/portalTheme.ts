import { createContext, useContext } from 'react'

import {
  type ColorMode,
  type ContrastMode,
  DATA_GRID_THEME_CLASS,
} from './types'

/**
 * Класс темы для порталов (меню, поповеры, тултипы). Они рендерятся вне корня грида
 * и не наследуют его `dark`, поэтому грид передаёт класс своей цветовой схемы через
 * контекст. Пользовательский `className` грида сюда не входит: он может нести раскладку.
 */
export const portalThemeClass = (colorMode?: ColorMode): string =>
  colorMode === 'dark' ? `${DATA_GRID_THEME_CLASS} dark` : DATA_GRID_THEME_CLASS

/** Значение `data-tsr-contrast` (ADR 0088); у `'auto'` атрибута нет. */
export const contrastAttribute = (
  contrast?: ContrastMode,
): 'more' | 'standard' | undefined =>
  contrast === 'more' || contrast === 'standard' ? contrast : undefined

const PortalThemeContext = createContext<string>(DATA_GRID_THEME_CLASS)
const PortalContrastContext = createContext<'more' | 'standard' | undefined>(
  undefined,
)

export const PortalThemeProvider = PortalThemeContext.Provider
export const PortalContrastProvider = PortalContrastContext.Provider

/** Класс темы для элемента в портале; вне грида — светлая тема по умолчанию. */
export const usePortalThemeClass = (): string => useContext(PortalThemeContext)

/** `data-tsr-contrast` для корня портала: режим контраста грида. */
export const usePortalContrast = (): 'more' | 'standard' | undefined =>
  useContext(PortalContrastContext)
