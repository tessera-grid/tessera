import { createContext, useContext } from 'react'

import { type ContrastMode, DATA_GRID_THEME_CLASS } from './types'

/**
 * Класс темы для порталов (меню, поповеры, тултипы). Они рендерятся вне корня грида
 * и не наследуют его `dark`, поэтому грид передаёт фактическую тему через контекст.
 * Пользовательский `className` грида сюда не входит: он может нести раскладку.
 */
export const portalThemeClass = (dark: boolean): string =>
  dark ? `${DATA_GRID_THEME_CLASS} dark` : DATA_GRID_THEME_CLASS

/** Значение `data-tsr-contrast` (ADR 0088); у `'auto'` атрибута нет. */
export const contrastAttribute = (
  contrast?: ContrastMode,
): 'more' | 'standard' | undefined =>
  contrast === 'more' || contrast === 'standard' ? contrast : undefined

/** Атрибуты темы корня портала: контраст (ADR 0088) и светлая тема под тёмным предком (ADR 0090). */
export interface PortalThemeData {
  'data-tsr-contrast'?: 'more' | 'standard'
  'data-tsr-color-mode'?: 'light'
}

const PortalThemeContext = createContext<string>(DATA_GRID_THEME_CLASS)
const PortalThemeDataContext = createContext<PortalThemeData>({})

export const PortalThemeProvider = PortalThemeContext.Provider
export const PortalThemeDataProvider = PortalThemeDataContext.Provider

/** Класс темы для элемента в портале; вне грида — светлая тема по умолчанию. */
export const usePortalThemeClass = (): string => useContext(PortalThemeContext)

/** Атрибуты темы для корня портала. */
export const usePortalThemeData = (): PortalThemeData =>
  useContext(PortalThemeDataContext)
