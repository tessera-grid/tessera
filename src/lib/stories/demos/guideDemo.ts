/**
 * Показ действий шага гайда (ADR 0117, SN46–SN52): цель нажатия сперва принимает вид
 * наведения, затем нажатый вид, в точке нажатия расходится волна; клавиша — плашкой у
 * цели. Вид наведения и нажатия — классы аддона псевдо-состояний: он переписывает
 * `:hover` и `:active` в них. Волны и плашки не перехватывают указатель и скрыты от дерева
 * доступности; показ живёт только в живом Storybook.
 */

import { INPUT_MODALITY_ATTR } from '../../core/inputModality'
import { keyNameOf } from '../../core/keyboardActions'

export interface Point {
  x: number
  y: number
}

/** Цель держит вид наведения перед нажатием, мс. */
export const HOVER_MS = 700
/** Цель держит нажатый вид до нажатия, мс. */
export const PRESS_MS = 300
/** Набор одного символа, мс. */
export const TYPE_MS = 140
/** Вид наведения снимается без событий шага, мс. */
export const IDLE_MS = 1500
const CLICK_MS = 700
const KEY_MS = 1400

const HOVER_CLASS = 'pseudo-hover'
const ACTIVE_CLASS = 'pseudo-active'

const KEY_LABELS: Record<string, string> = {
  Enter: '↵',
  Escape: 'Esc',
  Tab: '⇥',
  ' ': '␣',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Delete: 'Del',
}
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/**
 * Подпись клавиши: символ и модификаторы через «+»; одиночный модификатор — без подписи. Буква
 * сочетания с Ctrl, Alt или ⌘ — по коду клавиши, как её ловит грид (ADR 0220); набранный текст —
 * как набран.
 */
export const keyLabel = (event: KeyboardEvent) => {
  if (MODIFIERS.has(event.key)) return undefined
  const shortcut = event.ctrlKey || event.altKey || event.metaKey
  const name = shortcut ? keyNameOf(event) : event.key
  const parts = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && '⌘',
    KEY_LABELS[name] ?? (name.length === 1 ? name.toUpperCase() : name),
  ].filter(Boolean)
  return parts.join('+')
}

/** Слои показа на странице: уходят вместе с ним. */
const layers = new Set<HTMLElement>()

/** Слой поверх страницы: без указателя, вне дерева доступности. */
const overlay = (marker: string) => {
  const element = document.createElement('div')
  element.setAttribute(marker, '')
  element.setAttribute('aria-hidden', 'true')
  Object.assign(element.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  })
  document.body.append(element)
  layers.add(element)
  return element
}

const drop = (element: HTMLElement) => {
  element.remove()
  layers.delete(element)
}

/** Мышь — цель и её предки, касание — только цель: фон строки не подсвечивается. */
const chainOf = (target: Element) => {
  if (target.closest('[data-action-menu]')) return []
  if (document.documentElement.getAttribute(INPUT_MODALITY_ATTR) === 'touch')
    return [target]
  const chain: Element[] = []
  for (
    let node: Element | null = target;
    node && node !== document.body;
    node = node.parentElement
  )
    chain.push(node)
  return chain
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export const createGuideDemo = (reducedMotion: boolean) => {
  let hovered: Element[] = []
  let pressed: Element[] = []
  let idle = 0

  const unhover = () => {
    window.clearTimeout(idle)
    for (const node of hovered) node.classList.remove(HOVER_CLASS)
    hovered = []
  }
  const release = () => {
    for (const node of pressed) node.classList.remove(ACTIVE_CLASS)
    pressed = []
  }
  const touch = () => {
    window.clearTimeout(idle)
    idle = window.setTimeout(unhover, IDLE_MS)
  }

  return {
    /** Цель наведена: вид наведения на цепочке до новой цели или простоя. */
    hover: (target: Element) => {
      touch()
      if (hovered[0] === target) return
      unhover()
      touch()
      hovered = chainOf(target)
      for (const node of hovered) node.classList.add(HOVER_CLASS)
    },
    hovers: (target: Element) => hovered[0] === target,
    unhover,
    /** Нажатый вид на цепочке цели. */
    press: (target: Element) => {
      touch()
      release()
      pressed = chainOf(target)
      for (const node of pressed) node.classList.add(ACTIVE_CLASS)
    },
    release,
    /** Волна нажатия в точке; `follow` переставляет её за сдвинувшейся целью. */
    click: (point: Point) => {
      touch()
      const ring = overlay('data-guide-click')
      const place = (at: Point) =>
        Object.assign(ring.style, {
          left: `${at.x - 12}px`,
          top: `${at.y - 12}px`,
        })
      place(point)
      Object.assign(ring.style, {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '2px solid rgb(59 130 246)',
        boxSizing: 'border-box',
      })
      if (!reducedMotion)
        ring.animate(
          [
            { transform: 'scale(0.4)', opacity: 1 },
            { transform: 'scale(1.6)', opacity: 0 },
          ],
          { duration: CLICK_MS, easing: 'ease-out', fill: 'forwards' },
        )
      window.setTimeout(() => drop(ring), CLICK_MS)
      return { follow: place }
    },
    /** Плашка клавиши у цели. */
    key: (label: string, box: DOMRect) => {
      touch()
      const badge = overlay('data-guide-key')
      badge.textContent = label
      Object.assign(badge.style, {
        left: `${box.left}px`,
        top: `${box.bottom + 6}px`,
        padding: '2px 8px',
        borderRadius: '6px',
        background: 'rgb(17 17 17 / 0.85)',
        color: '#fff',
        font: '600 12px/18px system-ui, sans-serif',
        whiteSpace: 'nowrap',
      })
      if (!reducedMotion)
        badge.animate([{ opacity: 1, offset: 0.7 }, { opacity: 0 }], {
          duration: KEY_MS,
          fill: 'forwards',
        })
      window.setTimeout(() => drop(badge), KEY_MS)
    },
    dispose: () => {
      unhover()
      release()
      for (const layer of layers) drop(layer)
    },
  }
}

export type GuideDemo = ReturnType<typeof createGuideDemo>

/** Живой Storybook: не тесты каталога и не снимки Chromatic (SN51). */
export const isLiveStorybook = () =>
  typeof window !== 'undefined' &&
  /\/iframe\.html$/.test(window.location.pathname) &&
  !/Chromatic/.test(window.navigator.userAgent) &&
  !/[?&]chromatic=true/.test(window.location.search)
