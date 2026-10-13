import { page } from 'vitest/browser'

// Помощники наборов линий дерева (ADR 0058, ADR 0102): пиксели скриншота и геометрия
// веток по токенам темы. Линии проверяются видом, а не устройством стилей.

/** Скриншот страницы как пиксели в CSS-координатах окна. */
export const snapshot = async () => {
  const shot = (await page.screenshot({
    base64: true,
    save: false,
  })) as unknown as string | { base64: string }
  const base64 = typeof shot === 'string' ? shot : shot.base64
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const scale = image.width / document.documentElement.clientWidth
  const pixel = (x: number, y: number) =>
    context.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
      .data
  return {
    scale,
    /** Яркость (0–255) пикселя в точке окна. */
    at: (x: number, y: number) => {
      const [r, g, b] = pixel(x, y)
      return (r! + g! + b!) / 3
    },
    rgb: (x: number, y: number) => Array.from(pixel(x, y).slice(0, 3)),
  }
}
export type Shot = Awaited<ReturnType<typeof snapshot>>

/** Значение токена длины, вычисленное в теме грида, px. */
export const tokenPx = (name: string) => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;display:block;width:var(${name})`
  document.querySelector('.data-grid-theme')!.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return value
}

/** Цвет токена, вычисленный в контексте элемента. */
export const tokenColor = (name: string, inside: Element) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = `var(${name})`
  inside.appendChild(probe)
  const value = getComputedStyle(probe).backgroundColor
  probe.remove()
  return value
}

export const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )

/** Ячейка отступа строки — первая пользовательская колонка историй дерева. */
export const indentOf = (id: string) =>
  rowEl(id)!.querySelector<HTMLElement>('[data-column-id="country"]')!

/** Геометрия веток: шаг, начало текста уровня, толщина и радиус — по токенам темы. */
export const treeGeometry = () => ({
  step: tokenPx('--tsr-comp-row-nesting-indent'),
  inset: tokenPx('--tsr-comp-tree-line-inset'),
  width: tokenPx('--tsr-comp-tree-line-width'),
  radius: tokenPx('--tsr-comp-tree-line-radius'),
  gap: tokenPx('--tsr-comp-tree-line-gap'),
})
export type TreeGeometry = ReturnType<typeof treeGeometry>

/**
 * Ось вертикали уровня `level` в ячейке отступа: под началом текста строки глубины
 * `level − 1`. `zoom` — масштаб контейнера (`transform`), ячейка уже в его координатах.
 */
export const railX = (
  cell: HTMLElement,
  level: number,
  g: TreeGeometry,
  zoom = 1,
) =>
  cell.getBoundingClientRect().left +
  (parseFloat(getComputedStyle(cell).borderLeftWidth) +
    (level - 1) * g.step +
    g.inset) *
    zoom

export const box = (cell: HTMLElement) => {
  const rect = cell.getBoundingClientRect()
  return {
    top: rect.top,
    bottom: rect.bottom,
    mid: rect.top + rect.height / 2,
    height: rect.height,
  }
}

/**
 * Вертикальная линия видна в точке: в окне ±1.5px по горизонтали есть пиксель темнее
 * фона в стороне на `minDiff` уровней яркости. Окно — на округление скриншота и масштаба.
 */
export const verticalAt = (shot: Shot, x: number, y: number, minDiff = 6) =>
  shot.at(x + 6, y) -
    Math.min(
      ...[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(dx => shot.at(x + dx, y)),
    ) >=
  minDiff

/** Горизонтальная линия видна в точке — окно ±1.5px по вертикали, фон выше на 6px. */
export const horizontalAt = (shot: Shot, x: number, y: number, minDiff = 6) =>
  shot.at(x, y - 6) -
    Math.min(
      ...[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(dy => shot.at(x, y + dy)),
    ) >=
  minDiff

/** Строка целиком в видимой области прокрутки грида — её пиксели на скриншоте. */
export const showRow = async (id: string) => {
  rowEl(id)!.scrollIntoView({ block: 'center' })
  for (let i = 0; i < 3; i++)
    await new Promise(resolve => requestAnimationFrame(resolve))
}

export const themeTokens = (vars: Record<string, string>) => {
  const style = document.createElement('style')
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  style.textContent = `.data-grid-theme.data-grid-theme { ${body} }`
  document.head.append(style)
  return () => style.remove()
}

/**
 * Строки истории «Tree lines» (двоичное дерево в 4 уровня, корни `node-i`): ветка
 * `node-0` — Turkey (0-0) с детьми Zimbabwe (0-0-0) и Colombia (0-0-1), Myanmar (0-1).
 */
export const TREE = {
  root: 'node-0',
  turkey: 'node-0-0',
  zimbabwe: 'node-0-0-0',
  portugal: 'node-0-0-0-0',
  falkland: 'node-0-0-0-1',
  colombia: 'node-0-0-1',
  samoa: 'node-0-0-1-1',
  myanmar: 'node-0-1',
  marshall: 'node-0-1-1-1',
} as const
