import { type PropsWithChildren, useLayoutEffect } from 'react'

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

interface StoryAnnotations {
  tags?: string[]
  parameters?: Record<string, unknown>
  [annotation: string]: unknown
}

/** Узловая история: снимается во всех режимах осей (тег `vr-modes`). */
export const withVrModes = <T extends StoryAnnotations>(
  story: T,
): T & Required<Pick<StoryAnnotations, 'tags' | 'parameters'>> => ({
  ...story,
  tags: [...(story.tags ?? []), 'vr-modes'],
  parameters: {
    ...story.parameters,
    chromatic: {
      ...(story.parameters?.chromatic as object | undefined),
      modes: FULL_MODES,
    },
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
