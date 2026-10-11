import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import type { Args } from '@storybook/react'
import { UPDATE_STORY_ARGS } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'

// Оси каталога визуальных состояний (ADR 0093, §1, VR9, VR16): тема, палитра, контраст
// и ширина. Ширина — режим Chromatic (`viewport`), остальное — глобалы Storybook.

export const THEMES = ['light', 'dark'] as const
/** `stories` — палитра shadcn приложения историй, `tessera` — запасная палитра грида. */
export const PALETTES = ['stories', 'tessera'] as const
export const CONTRASTS = ['standard', 'more'] as const
/** Ширина окна снимка, px: настольная и телефонная. */
export const WIDTHS = { desktop: 1280, phone: 390 } as const

export type Palette = (typeof PALETTES)[number]
export type Contrast = (typeof CONTRASTS)[number]

/**
 * Состояния каталога (ADR 0093, VR4–VR7): у каждого — история с `parameters.vrStates`,
 * которая показывает его в покое.
 */
export const CATALOG_STATES = {
  body: [
    'hover',
    'selection',
    'focus',
    'editing',
    'pending',
    'error',
    'highlight',
    'cellRange',
    'treeLines',
    'groups',
    'pinnedStart',
    'pinnedEnd',
    'skeleton',
    'empty',
  ],
  head: [
    'sorting',
    'activeIndicator',
    'nested',
    'kebab',
    'resizeHandle',
    'footer',
  ],
  overlay: [
    'menu',
    'submenu',
    'contextMenu',
    'filterText',
    'filterDate',
    'filterOptions',
    'export',
    'columns',
    'tooltip',
  ],
  panel: ['toolbar', 'statusBar', 'pagination', 'narrow'],
} as const

type Area = keyof typeof CATALOG_STATES
export type CatalogState = {
  [A in Area]: `${A}.${(typeof CATALOG_STATES)[A][number]}`
}[Area]

/** Параметры истории-состояния каталога. */
export const vrStates = (...states: CatalogState[]) => ({ vrStates: states })

/** Роли shadcn, которые мост темы берёт из палитры приложения (ADR 0089). */
export const PALETTE_ROLES = [
  '--foreground',
  '--background',
  '--card',
  '--muted',
  '--primary',
  '--primary-foreground',
  '--border',
  '--ring',
  '--destructive',
  '--info',
  '--warning',
  '--success',
] as const

interface Mode {
  theme: (typeof THEMES)[number]
  palette: Palette
  contrast: Contrast
  catalog: true
  viewport: number
}

/** Базовый режим снимка: каждая история один раз, светлая тема, настольная ширина. */
export const BASE_MODES: Record<string, Mode> = {
  base: {
    theme: 'light',
    palette: 'stories',
    contrast: 'standard',
    catalog: true,
    viewport: WIDTHS.desktop,
  },
}

/** Полный перебор осей — для узловых историй тела, шапки и меню. */
export const FULL_MODES: Record<string, Mode> = Object.fromEntries(
  THEMES.flatMap(theme =>
    PALETTES.flatMap(palette =>
      CONTRASTS.flatMap(contrast =>
        Object.entries(WIDTHS).map(([width, viewport]) => [
          `${theme} ${palette} ${contrast} ${width}`,
          { theme, palette, contrast, catalog: true as const, viewport },
        ]),
      ),
    ),
  ),
)

/**
 * Параметры узловой истории: снимок во всех режимах осей. История ставит рядом тег
 * `vr-modes` — статично, чтобы его видел индексатор Storybook (VR9).
 */
export const vrModes = (parameters: Record<string, unknown> = {}) => ({
  ...parameters,
  chromatic: {
    ...(parameters.chromatic as object | undefined),
    modes: FULL_MODES,
  },
})

/**
 * Среда истории по глобалам: запасная палитра — сброс ролей shadcn на `<html>` (их
 * читают и порталы), каталог — класс на `<html>`: без полос прокрутки (VR16).
 */
export const CatalogEnvironment = ({
  catalog,
  palette,
  children,
}: PropsWithChildren<{ catalog: boolean; palette: Palette }>) => {
  useLayoutEffect(() => {
    const html = document.documentElement
    if (catalog) html.classList.add('tsr-catalog')
    const fallback = palette === 'tessera'
    if (fallback) {
      for (const role of PALETTE_ROLES) html.style.setProperty(role, 'initial')
    }
    return () => {
      if (catalog) html.classList.remove('tsr-catalog')
      if (fallback) {
        for (const role of PALETTE_ROLES) html.style.removeProperty(role)
      }
    }
  }, [catalog, palette])
  return children
}

/** Событие `updateArgs` из `catalogPlay` для `PlayArgs`. */
export const PLAY_ARGS = 'tessera/play-args'

export interface ArgsUpdate {
  storyId: string
  updatedArgs: Args
}

/**
 * Смена аргументов из `render` без хука Storybook `useArgs`: история, которой `play` меняет
 * аргументы, перерисовывается `PlayArgs` — силами React, вне хуков Storybook.
 */
export const argsUpdater = (storyId: string) => (updatedArgs: Args) =>
  addons
    .getChannel()
    .emit(UPDATE_STORY_ARGS, { storyId, updatedArgs } satisfies ArgsUpdate)

/**
 * Аргументы, поменянные `play`, в проектах каталога: переносимые истории Vitest смену
 * аргументов не обрабатывают — история перерисовывается здесь. Живой Storybook и
 * Chromatic перерисовывают её сами.
 */
export const PlayArgs = ({
  storyId,
  children,
}: {
  storyId: string
  children: (updates: Args) => ReactNode
}) => {
  const [updates, setUpdates] = useState<Args>({})
  useEffect(() => {
    const channel = addons.getChannel()
    const onUpdate = (event: ArgsUpdate) => {
      if (event.storyId === storyId) {
        setUpdates(prev => ({ ...prev, ...event.updatedArgs }))
      }
    }
    channel.on(PLAY_ARGS, onUpdate)
    return () => channel.off(PLAY_ARGS, onUpdate)
  }, [storyId])
  return children(updates)
}
