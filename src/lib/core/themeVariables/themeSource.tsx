// Источник темы грида (ADR 0090): проп `colorMode`, `.dark` у предка, переходы при
// смене темы и фактическая тема порталов.
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { logWarn, shouldLog } from '../logger'
import {
  contrastAttribute,
  PortalThemeDataProvider,
  PortalThemeProvider,
  portalThemeClass,
} from './portalTheme'
import type { ColorMode, ContrastMode } from './types'
import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'

const SWITCHING_ATTRIBUTE = 'data-tsr-theme-switching'
let switchId = 0

/**
 * Гасит переходы грида и порталов на кадр смены темы (`theme.css`): цвет темы
 * меняется сразу, а не переходом, начатым из старых цветов. Вызывать до отрисовки
 * кадра смены — переходы, уже начатые пересчётом стилей, `transition: none` отменяет.
 */
export const suppressThemeTransitions = () => {
  const root = document.documentElement
  root.setAttribute(SWITCHING_ATTRIBUTE, '')
  const id = ++switchId
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (id === switchId) root.removeAttribute(SWITCHING_ATTRIBUTE)
    }),
  )
}

const hasDarkClass = (className: string | null) =>
  /(^|\s)dark(\s|$)/.test(className ?? '')

const themeChanged = (record: MutationRecord) => {
  const target = record.target as Element
  return record.attributeName === 'class'
    ? hasDarkClass(record.oldValue) !== target.classList.contains('dark')
    : record.oldValue !== target.getAttribute(record.attributeName!)
}

let canvas: CanvasRenderingContext2D | null | undefined

const luminance = (color: string): number | null => {
  canvas ??= document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true })
  if (!canvas) return null
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = color
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b] = [...canvas.getImageData(0, 0, 1, 1).data].map(c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Фон и текст грида не сходятся с его темой: в тёмной фон светлее текста или наоборот. */
export const paletteMismatch = (node: HTMLElement): boolean => {
  const probe = document.createElement('span')
  probe.style.cssText =
    'position:absolute;visibility:hidden;background-color:var(--tsr-sys-bg);color:var(--tsr-sys-fg)'
  node.append(probe)
  const style = getComputedStyle(probe)
  const bg = luminance(style.backgroundColor)
  const fg = luminance(style.color)
  const dark = style.colorScheme === 'dark'
  probe.remove()
  if (bg === null || fg === null) return false
  return dark ? bg > fg : bg < fg
}

const MISMATCH_WARNING =
  'Theme palette does not match the grid color mode: the background is lighter than the text in a dark grid (or the other way round). Declare the app palette on `.dark` rather than `html.dark`, or use `colorMode="auto"`. See ADR 0090.'

interface ThemeScopeProps {
  colorMode: ColorMode
  contrast: ContrastMode
  /** Корень грида: от его родителя грид следит за `.dark` предков. */
  rootRef: RefObject<HTMLElement | null>
  host: Parameters<typeof logWarn>[0]
  children: ReactNode
}

/**
 * Тема порталов по фактической теме грида и гашение переходов при её смене — от
 * пропа или от `.dark` и `data-tsr-contrast` у предков. Свой компонент: смена темы
 * предка перерисовывает только порталы, а не весь грид.
 */
export const ThemeScope = ({
  colorMode,
  contrast,
  rootRef,
  host,
  children,
}: ThemeScopeProps) => {
  const [ancestorDark, setAncestorDark] = useState(false)
  const dark = colorMode === 'dark' || (colorMode === 'auto' && ancestorDark)

  const props = useRef({ colorMode, contrast })
  useIsomorphicLayoutEffect(() => {
    const previous = props.current
    if (previous.colorMode === colorMode && previous.contrast === contrast) {
      return
    }
    props.current = { colorMode, contrast }
    suppressThemeTransitions()
  }, [colorMode, contrast])

  useIsomorphicLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const read = () => setAncestorDark(!!parent.closest('.dark'))
    read()
    const observer = new MutationObserver(records => {
      if (!records.some(themeChanged)) return
      suppressThemeTransitions()
      read()
    })
    for (let node: Element | null = parent; node; node = node.parentElement) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: ['class', 'data-tsr-contrast'],
        attributeOldValue: true,
      })
    }
    return () => observer.disconnect()
  }, [rootRef])

  // Светлую тему порталу даёт коммит React, а он под нагрузкой (Firefox) приходит
  // позже кадров гашения от наблюдателя: гасим ещё раз в кадре коммита.
  const committedDark = useRef(dark)
  useIsomorphicLayoutEffect(() => {
    if (committedDark.current === dark) return
    committedDark.current = dark
    suppressThemeTransitions()
  }, [dark])

  useEffect(() => {
    const node = rootRef.current
    if (!node || !shouldLog(host, 'warn')) return
    if (paletteMismatch(node)) {
      logWarn(host, MISMATCH_WARNING, 'theme-palette-mismatch')
    }
  }, [rootRef, host, dark, colorMode])

  const contrastAttr = contrastAttribute(contrast)
  const themeData = useMemo(
    () => ({
      'data-tsr-contrast': contrastAttr,
      'data-tsr-color-mode':
        colorMode === 'light' ? ('light' as const) : undefined,
    }),
    [contrastAttr, colorMode],
  )

  return (
    <PortalThemeProvider value={portalThemeClass(dark)}>
      <PortalThemeDataProvider value={themeData}>
        {children}
      </PortalThemeDataProvider>
    </PortalThemeProvider>
  )
}
