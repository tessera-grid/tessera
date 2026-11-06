import axe from 'axe-core'
import { composeStories } from '@storybook/react-vite'
import { addons, composeConfigs, mockChannel } from 'storybook/preview-api'
import { commands, page } from 'vitest/browser'

import { contrast, effectiveBg, toRgba } from './a11y-helpers'
import { PALETTE_ROLES } from '../../__mocks__/catalog'

// Измерения матрицы контраста (ADR 0089): сочетания палитры, темы и режима, фон по
// стилям и по пикселям снимка, обход узлов с порогами и axe. Общие для историй каталога
// (`contrast-matrix`) и шагов гайдов (`contrast-guides`, §7).

export type Palette = 'tessera' | 'stories'
export type Theme = 'light' | 'dark'
export type Mode = 'standard' | 'more' | 'forced'
export type Scheme = 'light' | 'dark'
export interface Combo {
  palette: Palette
  theme: Theme
  mode: Mode
  /** Палитра эмуляции `forced-colors` в Chromium. */
  scheme?: Scheme
}

export const BASE_COMBOS: Combo[] = (['tessera', 'stories'] as const).flatMap(
  palette =>
    (['light', 'dark'] as const).flatMap(theme =>
      (['standard', 'more'] as const).map(mode => ({ palette, theme, mode })),
    ),
)
export const FORCED_COMBOS: Combo[] = (['light', 'dark'] as const).flatMap(
  scheme =>
    (['light', 'dark'] as const).map(theme => ({
      palette: 'stories' as const,
      theme,
      mode: 'forced' as const,
      scheme,
    })),
)
export const COMBOS = [...BASE_COMBOS, ...FORCED_COMBOS]
/**
 * Сочетания шага гайда (§7, CX13): палитра историй, обе темы в обычном режиме и
 * `forced-colors` в обеих палитрах Chromium на светлой теме грида.
 */
export const STEP_COMBOS: Combo[] = [
  { palette: 'stories', theme: 'light', mode: 'standard' },
  { palette: 'stories', theme: 'dark', mode: 'standard' },
  { palette: 'stories', theme: 'light', mode: 'forced', scheme: 'light' },
  { palette: 'stories', theme: 'light', mode: 'forced', scheme: 'dark' },
]
export const comboLabel = (c: Combo) =>
  `${c.palette}/${c.theme}/${c.mode === 'forced' ? `forced-${c.scheme}` : c.mode}`

export const html = document.documentElement
export const frame = () =>
  new Promise(resolve => requestAnimationFrame(resolve))

const runningTransitions = () =>
  document
    .getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)

export const finishTransitions = () =>
  runningTransitions().forEach(animation => animation.finish())

/**
 * Доводит переходы, пока два кадра подряд не начнётся новых: смена эмуляции под
 * нагрузкой доходит до стилей кадром позже, и переход стартует после первой доводки.
 */
const settleTransitions = async () => {
  for (let quiet = 0, i = 0; quiet < 2 && i < 30; i++) {
    await frame()
    const running = runningTransitions()
    running.forEach(animation => animation.finish())
    quiet = running.length === 0 ? quiet + 1 : 0
  }
}

const fc = commands as unknown as {
  forcedColors: (active: boolean, scheme?: Scheme | null) => Promise<void>
}
let emulated: Scheme | null = null
/**
 * Схема окна до эмуляции. Сброс возвращает её, а не снимает переопределение: без него
 * Chromium берёт схему ОС, и тёмная тема машины перешла бы следующим наборам.
 */
let initialScheme: Scheme | undefined

const emulate = async (scheme: Scheme | null) => {
  if (scheme === emulated) return
  initialScheme ??= matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
  await fc.forcedColors(scheme !== null, scheme ?? initialScheme)
  emulated = scheme
}

/** `finish: false` — короткое состояние (CX15): переходы не доводятся. */
export const applyCombo = async (combo: Combo, { finish = true } = {}) => {
  await emulate(combo.mode === 'forced' ? combo.scheme! : null)
  html.classList.toggle('dark', combo.theme === 'dark')
  if (combo.mode === 'more') html.setAttribute('data-tsr-contrast', 'more')
  else html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) {
    if (combo.palette === 'tessera') html.style.setProperty(role, 'initial')
    else html.style.removeProperty(role)
  }
  if (finish) await settleTransitions()
  else await frame()
  await frame()
}

export const resetCombo = async () => {
  await emulate(null)
  html.classList.remove('dark')
  html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) html.style.removeProperty(role)
}

// --- Пиксели снимка (§6) -----------------------------------------------------------

/** Цвет пикселя в CSS-координатах окна: `[r, g, b, 1]`, вне снимка — `null`. */
/** Цвет пикселя по координатам окна; `raw` — снимок целиком, для сравнения кадров. */
export type Shot = ((x: number, y: number) => number[] | null) & { raw: string }

/** Фон под текстом, под иконкой или вокруг контрола; `null` — узел не измерить. */
type Background = (
  el: Element,
  kind: 'text' | 'icon' | 'control',
) => number[] | null

/** Граница флажка и фон вокруг: их цвета и контраст; `null` — флажок не измерить. */
type ControlRatio = (
  el: Element,
) => { ratio: number; fg: number[]; bg: number[] } | null

export interface Measure {
  background: Background
  control: ControlRatio
}

/** Сколько снимок ждёт, пока узел можно снять, мс. */
const SNAPSHOT_TIMEOUT = 10_000

let snapshotIds = 0

/**
 * Снимок окна или узла `element` (`origin` — его левый верхний угол в окне): цвет пикселя
 * по координатам окна. Узел раннер ищет по `data-testid`: селектор узла по месту
 * (`body > div:nth-child(N)`) сдвигает сосед, ушедший до того, как раннер его разрешил.
 * Без своего предела снимок ждал бы весь тайм-аут задачи — в хуке обхода час (CX17–CX18).
 */
export const snapshot = async (
  element?: Element,
  origin = { left: 0, top: 0 },
  { timeout = SNAPSHOT_TIMEOUT } = {},
): Promise<Shot> => {
  const testId = element && `snapshot-${++snapshotIds}`
  if (testId) element!.setAttribute('data-testid', testId)
  let shot: string | { base64: string }
  try {
    shot = (await page.screenshot({
      base64: true,
      save: false,
      timeout,
      ...(testId && { element: page.getByTestId(testId) }),
    })) as unknown as string | { base64: string }
  } catch (error) {
    throw new Error(
      `снимок области не снят за ${timeout} мс: ${(error as Error).message}`,
      { cause: error },
    )
  } finally {
    if (testId) element!.removeAttribute('data-testid')
  }
  const image = new Image()
  image.src = `data:image/png;base64,${typeof shot === 'string' ? shot : shot.base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const { data, width, height } = context.getImageData(
    0,
    0,
    image.width,
    image.height,
  )
  const scale =
    width / (element ? element.getBoundingClientRect().width : html.clientWidth)
  if (Math.abs(scale - 1) > 0.01) {
    throw new Error(
      `снимок ужат раннером в ${scale.toFixed(2)} — окно больше рамки`,
    )
  }
  const pixel = (x: number, y: number) => {
    const px = Math.floor((x - origin.left) * scale)
    const py = Math.floor((y - origin.top) * scale)
    if (px < 0 || py < 0 || px >= width || py >= height) return null
    const i = (py * width + px) * 4
    return [data[i]!, data[i + 1]!, data[i + 2]!, 1]
  }
  return Object.assign(pixel, { raw: image.src })
}

/**
 * Самый частый цвет в точках: под текстом это фон, а не сглаженные штрихи букв. `skip` —
 * цвет самого узла (сплошная иконка), если на снимке есть и другой.
 */
const commonColor = (
  shot: Shot,
  points: [number, number][],
  skip?: number[],
) => {
  const counts = new Map<string, [number[], number]>()
  for (const [x, y] of points) {
    const rgb = shot(x, y)
    if (!rgb) continue
    const key = rgb.join()
    const entry = counts.get(key)
    if (entry) entry[1]++
    else counts.set(key, [rgb, 1])
  }
  const own = skip && skip.slice(0, 3).concat(1).join()
  let best: [number[], number] | undefined
  for (const [key, entry] of counts) {
    if (key === own && counts.size > 1) continue
    if (!best || entry[1] > best[1]) best = entry
  }
  return best?.[0] ?? null
}

/**
 * Узел целиком в окне и сверху — в центре и у углов: узел у края прокрутки или под
 * другим слоем на снимке не виден.
 */
const onScreen = (rect: DOMRect, el: Element) => {
  if (rect.left < 0 || rect.top < 0) return false
  if (rect.right > innerWidth || rect.bottom > innerHeight) return false
  // Под обрезкой прокрутки `elementFromPoint` вернул бы предка — его не отличить.
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = style(p)
    if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
    const clip = p.getBoundingClientRect()
    if (
      rect.left < clip.left - 0.5 ||
      rect.top < clip.top - 0.5 ||
      rect.right > clip.right + 0.5 ||
      rect.bottom > clip.bottom + 0.5
    ) {
      return false
    }
  }
  const inset = Math.min(2, rect.width / 4, rect.height / 4)
  const points: [number, number][] = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
    [rect.left + inset, rect.top + inset],
    [rect.right - inset, rect.top + inset],
    [rect.left + inset, rect.bottom - inset],
    [rect.right - inset, rect.bottom - inset],
  ]
  return points.every(([x, y]) => {
    const hit = document.elementFromPoint(x, y)
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el))
  })
}

/** Цвет краски иконки: обводка или заливка SVG. */
const iconPaint = (el: Element) => {
  const s = style(el)
  return s.stroke !== 'none' ? s.stroke : s.fill
}

const textRects = (el: Element) =>
  [...el.childNodes]
    .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
    .flatMap(node => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return [...range.getClientRects()]
    })
    .filter(rect => rect.width > 0 && rect.height > 0)

/**
 * Фон узла по пикселям: под текстом — в прямоугольниках его строк, под иконкой — в её
 * рамке, кроме цвета самой иконки, у флажка — в рамке в 2px вокруг. `null` — узел вне
 * окна или перекрыт.
 */
const pixelBackground =
  (shot: Shot): Background =>
  (el, kind) => {
    const rects = kind === 'text' ? textRects(el) : [el.getBoundingClientRect()]
    if (!rects.length || !rects.every(rect => onScreen(rect, el))) return null
    const points: [number, number][] = []
    for (const r of rects) {
      if (kind === 'control') {
        for (let x = r.left - 2; x <= r.right + 2; x++) {
          points.push([x, r.top - 2], [x, r.bottom + 2])
        }
        for (let y = r.top - 2; y <= r.bottom + 2; y++) {
          points.push([r.left - 2, y], [r.right + 2, y])
        }
      } else {
        for (let x = r.left + 0.5; x < r.right; x++) {
          for (let y = r.top + 0.5; y < r.bottom; y++) points.push([x, y])
        }
      }
    }
    return commonColor(
      shot,
      points,
      kind === 'icon' ? toRgba(iconPaint(el)) : undefined,
    )
  }

/**
 * Граница флажка по пикселям: самый контрастный к фону вокруг цвет, занявший внутри его
 * рамки не меньше 6 пикселей, — сглаживание углов не в счёт. Вычисленная рамка в режиме
 * не та, которой браузер её рисует.
 */
const pixelControl =
  (shot: Shot): ControlRatio =>
  el => {
    const around = pixelBackground(shot)(el, 'control')
    if (!around) return null
    const r = el.getBoundingClientRect()
    const counts = new Map<string, [number[], number]>()
    for (let x = r.left + 0.5; x < r.right; x++) {
      for (let y = r.top + 0.5; y < r.bottom; y++) {
        const rgb = shot(x, y)
        if (!rgb) continue
        const key = rgb.join()
        const entry = counts.get(key)
        if (entry) entry[1]++
        else counts.set(key, [rgb, 1])
      }
    }
    let best = { ratio: 1, fg: around, bg: around }
    for (const [rgb, count] of counts.values()) {
      const ratio = contrast(rgb, around)
      if (count >= 6 && ratio > best.ratio)
        best = { ratio, fg: rgb, bg: around }
    }
    return best
  }

export const pixelMeasure = (shot: Shot): Measure => ({
  background: pixelBackground(shot),
  control: pixelControl(shot),
})

/** В обычном и повышенном режимах — наложение слоёв стилей. */
export const styleMeasure: Measure = {
  background: el => effectiveBg(el),
  control: el => {
    // Флажок опознаётся по границе: заливкой или рамкой, что из них заметнее.
    const s = style(el)
    const around = effectiveBg(el.parentElement!)
    const fill = toRgba(s.backgroundColor)
    const border = toRgba(s.borderTopColor)
    const byFill = fill[3]! > 0.99 ? contrast(fill, around) : 0
    const byBorder =
      parseFloat(s.borderTopWidth) > 0 || fill[3]! <= 0.99
        ? contrast(border, around)
        : 0
    return byFill >= byBorder
      ? { ratio: byFill, fg: fill, bg: around }
      : { ratio: byBorder, fg: border, bg: around }
  },
}

/** Область не помещается в окно или поповер не встал на место — снимок не делается. */
export class FitError extends Error {}

/** Попыток дождаться двух одинаковых кадров снимка. */
const STABLE_ATTEMPTS = 6

/** Поле снимка вокруг области, px: рамка в 2px вокруг флажка у её края. */
const REGION_PAD = 4

/**
 * Снимок `forced-colors` (CX16) — области корней (грид и поповеры), а не документа:
 * узел выше окна раннер снимает за пределами окна, растягивая его, раскладка съезжает,
 * и пиксели не совпадают с узлами. Область прокручивается в окно; выше или шире окна —
 * `FitError`. Поповеры появились и стоят на месте.
 */
export const fitSnapshot = async (roots: Element[], { finish = true } = {}) => {
  const moving = '[data-starting-style], [data-ending-style]'
  for (let wait = 0; document.querySelector(moving); wait += 20) {
    if (wait > 2000) throw new FitError('поповер не встал на место за 2 с')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  if (finish) finishTransitions()
  if (!roots.length) throw new FitError('нечего снимать: нет грида и поповеров')
  /** Общий прямоугольник корней в координатах окна. */
  const box = () => {
    const rects = roots.map(root => root.getBoundingClientRect())
    return {
      left: Math.min(...rects.map(r => r.left)),
      top: Math.min(...rects.map(r => r.top)),
      right: Math.max(...rects.map(r => r.right)),
      bottom: Math.max(...rects.map(r => r.bottom)),
    }
  }
  const outer = box()
  const width = outer.right - outer.left
  const height = outer.bottom - outer.top
  // Доля пикселя — округление раскладки: рамка снимка всё равно не выходит за окно.
  if (Math.floor(height) > innerHeight || Math.floor(width) > innerWidth) {
    throw new FitError(
      `проверяемая область больше окна: ${Math.round(width)}×${Math.round(height)} > ${innerWidth}×${innerHeight} px`,
    )
  }
  if (outer.top < 0 || outer.bottom > innerHeight) {
    scrollBy(0, outer.top - (innerHeight - height) / 2)
  }
  await frame()
  await frame()
  const region = box()
  const left = Math.max(0, Math.floor(region.left - REGION_PAD))
  const top = Math.max(0, Math.floor(region.top - REGION_PAD))
  const right = Math.min(innerWidth, Math.ceil(region.right + REGION_PAD))
  const bottom = Math.min(innerHeight, Math.ceil(region.bottom + REGION_PAD))
  // Невидимая рамка над областью: снимок узла в окне — без растяжения фрейма.
  const frameEl = document.createElement('div')
  Object.assign(frameEl.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
    pointerEvents: 'none',
  })
  document.body.append(frameEl)
  try {
    // Кадр устоялся — два снимка подряд совпали: короткое промежуточное состояние
    // перерисовки после смены палитры не попадает в замер. Бесконечная анимация (свет
    // ожидания, волна скелета) не устоится — тогда берётся последний снимок.
    let shot = await snapshot(frameEl, { left, top })
    for (let attempt = 0; attempt < STABLE_ATTEMPTS; attempt++) {
      await frame()
      const next = await snapshot(frameEl, { left, top })
      if (next.raw === shot.raw) return next
      shot = next
    }
    return shot
  } finally {
    frameEl.remove()
  }
}

/** Системный цвет как `rgb(…)` в текущей палитре. */
export const sys = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/** Системные цвета, которыми режим рисует состояния, — кроме фона `Canvas`. */
const STATE_COLORS = [
  'CanvasText',
  'Highlight',
  'HighlightText',
  'GrayText',
  'LinkText',
  'ButtonText',
  'ButtonFace',
  'ButtonBorder',
  'Mark',
  'MarkText',
  'AccentColor',
  'AccentColorText',
  'SelectedItem',
  'SelectedItemText',
  'Field',
  'FieldText',
]

/**
 * Псевдо-состояние в `forced-colors` (CX14): пиксели в рамке узла (+3 px) до и после
 * состояния. `changed` — сколько отличается, `system` — сколько из них системного
 * цвета, не `Canvas`.
 */
export const pseudoChange = (before: Shot, after: Shot, el: Element) => {
  const canvas = toRgba(sys('Canvas'))
  const near = (rgb: number[], target: number[]) =>
    rgb.slice(0, 3).every((v, i) => Math.abs(v - target[i]!) < 8)
  const states = STATE_COLORS.map(name => toRgba(sys(name))).filter(
    rgb => !near(rgb, canvas),
  )
  const r = el.getBoundingClientRect()
  let changed = 0
  let system = 0
  for (let x = r.left - 3 + 0.5; x < r.right + 3; x++) {
    for (let y = r.top - 3 + 0.5; y < r.bottom + 3; y++) {
      const a = before(x, y)
      const b = after(x, y)
      if (!a || !b || near(a, b)) continue
      changed++
      if (states.some(rgb => near(b, rgb))) system++
    }
  }
  return { changed, system }
}

// --- Обход узлов -------------------------------------------------------------------

export const style = (el: Element) => getComputedStyle(el)

/** Суммарная прозрачность элемента и предков. */
const opacityOf = (el: Element) => {
  let opacity = 1
  for (let e: Element | null = el; e; e = e.parentElement) {
    opacity *= Number(style(e).opacity)
  }
  return opacity
}

/** Элемент виден: есть размер, не скрыт, прозрачность не ниже `min`. */
/**
 * Содержимое ячеек удалённой строки (ADR 0178, §7) приглушено, как тело при обновлении
 * (ADR 0094): текст держит 3:1, а не 4,5:1; колонка действий не приглушена.
 */
const DELETED_ROW_CONTENT =
  '[data-row-draft="deleted"] > .data-grid__body-cell:not([data-actions-column-cell="true"]) > *'
/** Меньше этой непрозрачности приглушённый узел не виден. */
const DELETED_ROW_MIN_OPACITY = 0.5

const visible = (el: Element, min = 0.9) => {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return false
  if (style(el).visibility !== 'visible') return false
  return opacityOf(el) >= min
}

/**
 * Выключенное WCAG освобождает от контраста, как и занятая кнопка: нажатий она не
 * выполняет (1.4.11). Строка и контейнер с `aria-busy` не освобождаются.
 */
const disabled = (el: Element) =>
  !!el.closest(
    '[disabled], [aria-disabled="true"], [data-disabled]:not([data-disabled="false"]), :is(button, [role="button"])[aria-busy="true"]',
  )

const ownText = (el: Element) =>
  [...el.childNodes].some(
    node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
  )

const REGIONS: [string, string][] = [
  ['menu', '[role="menu"]'],
  ['popup', '[data-side]'],
  ['toolbar', '[role="toolbar"]'],
  ['head', '.data-grid__head-cell'],
  ['footer', '.data-grid__footer, [data-popup-footer]'],
  ['row', '.data-grid__body-row'],
]

/** Стабильное имя узла: область, строка, колонка, подпись. */
export const describeNode = (el: Element) => {
  const region =
    REGIONS.find(([, selector]) => el.closest(selector))?.[0] ?? 'panel'
  const row = el.closest('[data-row-id]')?.getAttribute('data-row-id')
  const column = el.closest('[data-column-id]')?.getAttribute('data-column-id')
  const named =
    el.closest('[aria-label]')?.getAttribute('aria-label') ??
    el.closest('[role]')?.getAttribute('role') ??
    el.tagName.toLowerCase()
  return [region, row, column, named].filter(Boolean).join('/')
}

const CONTROLS =
  'button, a[href], [role="button"], [role^="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"]'

const isLarge = (el: Element) => {
  const s = style(el)
  const size = parseFloat(s.fontSize)
  return size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
}

export interface Finding {
  key: string
  ratio: number
  need: number
}

/** Пары системных цветов палитры `forced-colors`: знак (текст, иконка, флажок) и фон. */
const SYSTEM_PAIRS = [
  ['CanvasText', 'Canvas'],
  ['HighlightText', 'Highlight'],
  ['Highlight', 'Canvas'],
  ['ButtonText', 'ButtonFace'],
  ['MarkText', 'Mark'],
  ['SelectedItemText', 'SelectedItem'],
]

const systemColor = (name: string) => {
  const probe = document.createElement('span')
  probe.style.color = name
  document.body.append(probe)
  const value = toRgba(getComputedStyle(probe).color)
  probe.remove()
  return value
}

const sameColor = (a: number[], b: number[]) =>
  a.slice(0, 3).every((c, i) => Math.abs(c - b[i]!) <= 2)

/**
 * Порог знака — текста, иконки, флажка — в `forced-colors`: цвета задаёт палитра
 * системы, и знак её пары не контрастнее самой пары — у эмуляции Firefox
 * `HighlightText` на `Highlight` и `Highlight` на `Canvas` 2,94:1.
 */
const systemPairCap = () => {
  const pairs = SYSTEM_PAIRS.map(([fg, bg]) => {
    const pair = [systemColor(fg!), systemColor(bg!)] as const
    return { pair, ratio: contrast(...pair) }
  })
  return (fg: number[], bg: number[], need: number) => {
    const own = pairs.find(
      ({ pair }) => sameColor(fg, pair[0]) && sameColor(bg, pair[1]),
    )
    return own ? Math.min(need, own.ratio) : need
  }
}

/**
 * Нарушения порогов в корнях для одного сочетания. `dim` — приглушённое тело при
 * обновлении данных (ADR 0094, GL12): его тексты сводятся по прозрачности и держат 3:1.
 */
export const auditRoots = (
  scenario: string,
  combo: Combo,
  roots: Element[],
  { background, control }: Measure,
  dim?: number,
) => {
  const more = combo.mode === 'more'
  const cap =
    combo.mode === 'forced'
      ? systemPairCap()
      : (_fg: number[], _bg: number[], need: number) => need
  const found = new Map<string, Finding>()
  let checked = 0
  const report = (kind: string, el: Element, ratio: number, need: number) => {
    checked++
    if (ratio + 0.005 >= need) return
    const key = `${scenario} | ${comboLabel(combo)} | ${kind} | ${describeNode(el)}`
    const prev = found.get(key)
    if (!prev || prev.ratio > ratio) found.set(key, { key, ratio, need })
  }
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (disabled(el)) continue
      // Прозрачная краска не рисует ничего: так скрыты кнопки строки до наведения.
      const painted = (color: string) => toRgba(color)[3]! > 0
      const deleted = !!el.closest(DELETED_ROW_CONTENT)
      const dimmed =
        (dim !== undefined && !!el.closest('.data-grid__body')) || deleted
      const dimmedBg =
        dimmed &&
        visible(el, dim !== undefined ? dim * 0.9 : DELETED_ROW_MIN_OPACITY) &&
        ownText(el) &&
        painted(style(el).color)
          ? background(el, 'text')
          : null
      if (dimmedBg) {
        const opacity = opacityOf(el)
        const shown = toRgba(style(el).color)
          .slice(0, 3)
          .map((c, i) => c * opacity + dimmedBg[i]! * (1 - opacity))
        report('text', el, contrast([...shown, 1], dimmedBg), 3)
      }
      if (!visible(el)) continue
      const textBg =
        !dimmed && ownText(el) && painted(style(el).color)
          ? background(el, 'text')
          : null
      if (textBg) {
        const need = isLarge(el) ? (more ? 4.5 : 3) : more ? 7 : 4.5
        const fg = toRgba(style(el).color)
        report('text', el, contrast(fg, textBg), cap(fg, textBg, need))
      }
      // Иконка контрола — WCAG 1.4.11; декоративная графика (стрелка поповера) — нет.
      // Слой дуги ожидания и отказа — не иконка: его контраст — IR28–IR29 ADR 0127.
      if (
        el instanceof SVGSVGElement &&
        el.closest(CONTROLS) &&
        !el.hasAttribute('data-pending-arc')
      ) {
        const paint = iconPaint(el)
        const bg =
          paint &&
          paint !== 'none' &&
          !paint.startsWith('url') &&
          painted(paint)
            ? background(el, 'icon')
            : null
        if (bg) {
          const fg = toRgba(paint)
          report('icon', el, contrast(fg, bg), cap(fg, bg, 3))
        }
      }
      const box = el.getAttribute('role') === 'checkbox' ? control(el) : null
      if (box) report('control', el, box.ratio, cap(box.fg, box.bg, 3))
    }
  }
  return { findings: [...found.values()], checked }
}

// --- axe (CX7) ----------------------------------------------------------------------

/**
 * Разобранные причины, по которым axe не считает контраст (`messageKey` проверки):
 * каждую закрывает свой расчёт CX1–CX5, у каждой — обоснование. Ошибка axe
 * (`error-occurred`) снимает правило целиком — разобранной не бывает.
 */
export const ALLOWED_INCOMPLETE: Record<string, string> = {
  bgGradient:
    'фон ячейки — сплошные слои подсветки и диапазона; effectiveBg складывает их, CX2',
  pseudoContent:
    'линии дерева и отметки — псевдоэлементы без текста; текст строки считает CX1',
  shortTextContent:
    'номер приоритета и счётчики из одной-двух цифр; их контраст считает CX3–CX4',
  bgOverlap:
    'в стопке под текстом — прозрачный слой блика ячейки или грид под непрозрачным поповером; фон — у предков, его складывает effectiveBg, CX1–CX5',
  nonBmp:
    'узел из одних символов — стрелка «было → стало» в пульте: axe такой текст не считает, его считает аудит узлов, CX1–CX5',
}

const reasonOf = (node: axe.NodeResult) => {
  const check = [...node.any, ...node.all, ...node.none][0]
  return check?.id === 'error-occurred'
    ? `ошибка axe: ${(check.data as { message?: string } | null)?.message}`
    : (check?.data as { messageKey?: string } | null)?.messageKey
}

/**
 * Узел у края прокрутки (`elmPartiallyObscured`) axe не считает: узел прокручивается в
 * поле зрения и проверяется отдельно, прокрутка предков затем возвращается.
 */
const runUnobscured = async (node: axe.NodeResult, rule: string) => {
  const el = document.querySelector(node.target.join(' '))!
  const scrolled: [Element, number, number][] = []
  for (let p = el.parentElement; p; p = p.parentElement) {
    scrolled.push([p, p.scrollTop, p.scrollLeft])
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  try {
    return await axe.run({ include: [el] }, { runOnly: [rule] })
  } finally {
    for (const [p, top, left] of scrolled) {
      p.scrollTop = top
      p.scrollLeft = left
    }
  }
}

/**
 * Подсказка, пропускающая указатель насквозь (ADR 0100): лежит поверх грида, но
 * `elementsFromPoint` её не видит, и axe считает её перекрытой; её текст считает аудит
 * узлов.
 */
const passesPointer = (node: axe.NodeResult) => {
  const el = document.querySelector(node.target.join(' '))
  return !!el && getComputedStyle(el).pointerEvents === 'none'
}

/**
 * Узел под липким предком (шапка, футер, закреплённая колонка) при прокрученном теле:
 * `scrollIntoView` его не сдвигает, и axe считает его частично перекрытым, хотя он
 * виден целиком; его текст считает аудит узлов (CX1–CX5, CX12).
 */
const insideSticky = (node: axe.NodeResult) => {
  for (
    let el = document.querySelector(node.target.join(' '));
    el;
    el = el.parentElement
  ) {
    if (getComputedStyle(el).position === 'sticky') return true
  }
  return false
}

const nodeName = (node: axe.NodeResult) => {
  const el = document.querySelector(node.target.join(' '))
  return el ? describeNode(el) : node.target.join(' ')
}

/** История из `composeStories`: компонент, параметры и `play`. */
export interface ComposedState {
  (): React.JSX.Element
  id: string
  storyName?: string
  parameters: { vrStates?: string[]; scenario?: string }
  play?: (context: Record<string, unknown>) => Promise<void>
}

export interface CatalogStory {
  /** `Группа/Фича/История` — имя в ключах базы. */
  story: string
  path: string
  Story: ComposedState
}

/** Истории каталога: с псевдо-состояниями и на холсте каталога, как в Vitest. */
export const loadStories = async (): Promise<CatalogStory[]> => {
  // Аддон псевдо-состояний берёт канал при импорте, а `play` шлёт в него событие
  // отрисовки: канал ставится до импорта, иначе каждый `getChannel` даёт новый.
  if (!addons.hasChannel()) addons.setChannel(mockChannel())
  const pseudoStates = await import('storybook-addon-pseudo-states/preview')
  const modules = import.meta.glob<Record<string, unknown>>(
    '../../*.stories.tsx',
    { eager: true },
  )
  const annotations = composeConfigs([
    pseudoStates,
    { initialGlobals: { catalog: true } },
  ])
  return Object.entries(modules).flatMap(([path, module]) => {
    const title = (module.default as { title: string }).title
    const stories = Object.values(
      composeStories(
        module as Parameters<typeof composeStories>[0],
        annotations,
      ),
    ) as unknown as ComposedState[]
    return stories.map(Story => ({
      story: `${title.replace('Tessera/', '')}/${Story.storyName!}`,
      path,
      Story,
    }))
  })
}

export const gridsAndPopups = (container: HTMLElement) => {
  const grids = [...container.querySelectorAll('[data-tsr-grid]')]
  const popups = [
    ...document.querySelectorAll('[role="menu"], [role="dialog"], [data-side]'),
  ].filter(el => !container.contains(el))
  const outer = popups.filter(
    el => !popups.some(other => other !== el && other.contains(el)),
  )
  return { grids, popups: outer }
}

/** Итог axe по корням в сочетании: нарушения с ключами базы и неразобранные `incomplete`. */
export interface AxeOutcome {
  violations: { key: string; summary: string }[]
  problems: string[]
}

/**
 * axe с `color-contrast` (в повышенном режиме — `color-contrast-enhanced`) по корням,
 * CX7. `dimmed` — тело приглушено обновлением (ADR 0094, GL12): его держит 3:1 аудит
 * узлов, пороги axe к нему не относятся; то же — содержимое удалённой строки (ADR 0178, §7).
 */
export const runAxe = async (
  label: string,
  combo: Combo,
  roots: Element[],
  dimmed = false,
): Promise<AxeOutcome> => {
  const rule =
    combo.mode === 'more' ? 'color-contrast-enhanced' : 'color-contrast'
  const outcome: AxeOutcome = { violations: [], problems: [] }
  for (const root of roots) {
    const exclude = [
      ...(dimmed ? root.querySelectorAll('.data-grid__body') : []),
      ...root.querySelectorAll(DELETED_ROW_CONTENT),
    ]
    const result = await axe.run(
      { include: [root], exclude },
      { runOnly: [rule] },
    )
    const obscured: axe.NodeResult[] = []
    const collect = (run: axe.AxeResults) => {
      for (const v of run.violations) {
        for (const node of v.nodes) {
          outcome.violations.push({
            key: `${label} | ${comboLabel(combo)} | axe | ${nodeName(node)}`,
            summary: node.failureSummary ?? '',
          })
        }
      }
      for (const v of run.incomplete) {
        for (const node of v.nodes) {
          const reason = reasonOf(node)
          if (reason && reason in ALLOWED_INCOMPLETE) continue
          if (reason === 'elmPartiallyObscured' && run === result) {
            obscured.push(node)
            continue
          }
          if (
            reason === 'elmPartiallyObscured' &&
            (insideSticky(node) || passesPointer(node))
          ) {
            continue
          }
          outcome.problems.push(
            `${label} | ${comboLabel(combo)} | incomplete | ${nodeName(node)} | ${reason ?? 'без причины'}`,
          )
        }
      }
    }
    collect(result)
    for (const node of obscured) collect(await runUnobscured(node, rule))
  }
  return outcome
}
