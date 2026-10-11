// Общие хелперы наборов доступности: axe в пределах грида и контраст (WCAG 1.4.11).
import axe from 'axe-core'

// Отключённые правила — вне зоны структурной доступности этого набора:
// - color-contrast: зависит от токенов темы, покрыт тестами темизации;
// - region: документ-левел landmark-правило, неприменимо к встраиваемому гриду;
// - scrollable-region-focusable: без плагина keyboardNavigation грид — role="table"
//   только для чтения; с плагином правило включено и проверяется в A7.
export const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
    'scrollable-region-focusable': { enabled: false },
  },
}

/** Корень таблицы (`role="table"`) — контекст для axe. */
export const gridRoot = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[role="table"]')
  if (!el) {
    throw new Error('grid root [role="table"] not found')
  }
  return el
}

/** Нарушения axe в пределах грида. */
export const violations = async (): Promise<axe.Result[]> => {
  const { violations } = await axe.run(gridRoot(), AXE_OPTIONS)
  return violations
}

export const byRule = (list: axe.Result[], id: string) =>
  list.filter(v => v.id === id)

// --- Контраст (WCAG 1.4.11): цвет → RGBA через canvas, наложение альфы на фон.
export const canvas = document.createElement('canvas').getContext('2d', {
  willReadFrequently: true,
})!
export const toRgba = (color: string): number[] => {
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = '#000'
  canvas.fillStyle = color
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}
export const luminance = (rgb: number[]) =>
  rgb
    .slice(0, 3)
    .map(c => c / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
/**
 * Непрозрачный фон элемента: первый предок грида с заливкой, иначе поверхность
 * темы (`--tsr-sys-surface`) — фон страницы в тесте не зависит от темы.
 */
export const backgroundOf = (el: Element | null): number[] => {
  const theme = el?.closest('.data-grid-theme')
  for (; el && el !== theme; el = el.parentElement) {
    const color = toRgba(getComputedStyle(el).backgroundColor)
    if (color[3] > 0.99) return color
  }
  return toRgba(
    getComputedStyle(theme ?? document.body).getPropertyValue(
      '--tsr-sys-surface',
    ),
  )
}
export const contrast = (fg: number[], bg: number[]) => {
  const solid = fg.map((c, i) => (i < 3 ? c * fg[3] + bg[i] * (1 - fg[3]) : 1))
  const [hi, lo] = [luminance(solid), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}
/** Прогнать проверку в светлой и тёмной теме (класс `.dark` на <html>). */
export const inBothThemes = async (check: () => Promise<void>) => {
  for (const dark of [false, true]) {
    document.documentElement.classList.toggle('dark', dark)
    // Цвета контролов анимируются (transition) — читаем конечные значения;
    // бесконечную анимацию (кольцо ожидания) довести до конца нельзя.
    document
      .getAnimations()
      .filter(
        animation => animation.effect?.getTiming().iterations !== Infinity,
      )
      .forEach(animation => animation.finish())
    try {
      await check()
    } finally {
      document.documentElement.classList.remove('dark')
    }
  }
}

/** Значение выражения цвета (токен, `color-mix`) в контексте элемента. */
export const resolveColor = (parent: Element, value: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = value
  parent.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

const over = (top: number[], bottom: number[]) =>
  [0, 1, 2].map(i => top[i]! * top[3]! + bottom[i]! * (1 - top[3]!)).concat(1)

/**
 * Слои подсветки (ADR 0080) — однотонные `linear-gradient`, верхний первым; другие
 * картинки фона не учитываются.
 */
const solidLayers = (image: string): number[][] =>
  image === 'none'
    ? []
    : image.split(/,\s*(?=linear-gradient\()/).flatMap(layer => {
        if (!layer.startsWith('linear-gradient(') || !layer.endsWith(')')) {
          return []
        }
        const inner = layer.slice('linear-gradient('.length, -1)
        const half = (inner.length - 2) / 2
        const first = inner.slice(0, half)
        return Number.isInteger(half) &&
          inner.slice(half, half + 2) === ', ' &&
          first === inner.slice(half + 2)
          ? [toRgba(first)]
          : []
      })
/**
 * Видимый фон элемента: заливки и однотонные градиенты его и всех предков до первого
 * непрозрачного слоя; под ними — белый холст страницы.
 */
export const effectiveBg = (el: Element): number[] => {
  const layers: number[][] = []
  for (let e: Element | null = el; e; e = e.parentElement) {
    const style = getComputedStyle(e)
    for (const layer of solidLayers(style.backgroundImage)) {
      if (layer[3]! > 0) layers.push(layer)
    }
    const color = toRgba(style.backgroundColor)
    if (color[3]! > 0) layers.push(color)
    if ((layers.at(-1)?.[3] ?? 0) > 0.99) break
  }
  let base =
    layers.length && layers.at(-1)![3]! > 0.99
      ? layers.pop()!
      : [255, 255, 255, 1]
  for (const layer of layers.reverse()) base = over(layer, base)
  return base
}
