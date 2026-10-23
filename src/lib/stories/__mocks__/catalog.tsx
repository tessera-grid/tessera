import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useState,
} from 'react'
import type { Args } from '@storybook/react'
import { UPDATE_STORY_ARGS } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'

import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'

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
    'refreshing',
    'treeLines',
    'groups',
    'pinnedStart',
    'pinnedEnd',
    'skeleton',
    'empty',
    'loadError',
    'loadFailed',
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
  // Перетаскивание (ADR 0130): шаги гайдов историй строк и колонок.
  drag: [
    'rowHandle',
    'columnHandle',
    'row',
    'column',
    'rowInvalid',
    'groupParent',
    'pending',
    'rejected',
    'landed',
  ],
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

export interface TwinSource {
  args?: object
  argTypes?: object
  decorators?: unknown
  loaders?: unknown
  parameters?: Record<string, unknown>
  render?: unknown
  play?: unknown
}

const list = (value: unknown) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

/** Истории каталога, у которых есть близнец высокой контрастности (VR17). */
export const forcedTwinSources = new WeakSet<object>()

/** Истории сценариев и номера их шагов с близнецом (ADR 0130, DG3). */
export const stepTwins = new Map<object, number[]>()

const parametersOf = (meta: TwinSource, story: TwinSource) => ({
  ...meta.parameters,
  ...story.parameters,
})

/**
 * Близнец истории каталога для снимка в высокой контрастности (ADR 0093, §1, VR17):
 * аргументы, декораторы, `render` и `play` истории и её меты, `forcedColors` и базовый
 * режим. Состояние, требования и сценарий остаются у исходной истории. Поля меты, общие
 * с метой файла близнеца (`base`), не копируются — их даёт сама мета файла.
 */
export const forced = <S extends TwinSource>(
  meta: TwinSource,
  story: S,
  base: TwinSource = {},
): S => {
  if (!parametersOf(meta, story).vrStates) {
    throw new Error('forced: близнец — только у истории каталога (vrStates)')
  }
  forcedTwinSources.add(story)
  return forcedTwin(meta, story, base)
}

/**
 * Регистрирует близнеца шага `step` истории сценария (ADR 0130, DG3); его `play` даёт
 * `forcedStep` из `catalogPlay`.
 */
export const registerStepTwin = (
  meta: TwinSource,
  story: TwinSource,
  step: number,
) => {
  if (!parametersOf(meta, story).scenario) {
    throw new Error('forcedStep: близнец шага — только у истории сценария')
  }
  stepTwins.set(story, [...(stepTwins.get(story) ?? []), step])
}

/** Близнец без проверки источника: общая часть `forced` и `forcedStep`. */
export const forcedTwin = <S extends TwinSource>(
  meta: TwinSource,
  story: S,
  base: TwinSource = {},
): S => {
  const own = <K extends keyof TwinSource>(key: K) =>
    meta[key] === base[key] ? undefined : meta[key]
  const parameters = parametersOf(meta, story)
  delete parameters.vrStates
  delete parameters.requirements
  delete parameters.scenario
  const snapshot = { ...(parameters.chromatic as object | undefined) }
  delete (snapshot as { modes?: unknown }).modes
  return {
    args: { ...own('args'), ...story.args },
    argTypes: { ...own('argTypes'), ...story.argTypes },
    decorators: [...list(story.decorators), ...list(own('decorators'))],
    loaders: [...list(story.loaders), ...list(own('loaders'))],
    render: story.render ?? own('render'),
    play: story.play,
    parameters: {
      ...parameters,
      chromatic: { ...snapshot, forcedColors: 'active', modes: BASE_MODES },
    },
  } as unknown as S
}

/**
 * Среда истории по глобалам: запасная палитра — сброс ролей shadcn на `<html>` (их
 * читают и порталы), каталог — класс на `<html>`: без полос прокрутки (VR16).
 */
export const CatalogEnvironment = ({
  catalog,
  palette,
  children,
}: PropsWithChildren<{ catalog: boolean; palette: Palette }>) => {
  useIsomorphicLayoutEffect(() => {
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
