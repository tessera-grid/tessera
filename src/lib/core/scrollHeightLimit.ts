/**
 * Выше этого тело растягивается (ADR 0142): ниже координаты точны во всех движках, а у
 * самого предела Chromium ставит строки с ошибкой в пиксели. Ниже — и мерить незачем.
 */
const SAFE_HEIGHT = 8_000_000

/** Атрибут пробника замера: значение — вид замера, `height` или `sticky`. */
export const LIMIT_PROBE_ATTRIBUTE = 'data-tsr-limit-probe'

let heightLimit: number | undefined
let stickyLimit: number | undefined

const createProbe = (kind: 'height' | 'sticky') => {
  const box = document.createElement('div')
  box.setAttribute(LIMIT_PROBE_ATTRIBUTE, kind)
  box.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:100px;overflow:hidden;visibility:hidden;pointer-events:none'
  document.body.append(box)
  return box
}

/**
 * Наибольшая высота элемента (ADR 0141, BH1): выше Chromium и WebKit её обрезают, а
 * Firefox даёт высоту 0 — тогда предел ищется бинарным поиском. Меряется один раз.
 */
export const measureScrollHeightLimit = (): number => {
  if (heightLimit !== undefined) return heightLimit
  const box = createProbe('height')
  const block = document.createElement('div')
  box.append(block)
  const heightOf = (px: number) => {
    block.style.height = `${px}px`
    return block.getBoundingClientRect().height
  }
  const clamped = heightOf(1e9)
  if (clamped > 0) {
    heightLimit = clamped
  } else {
    // На таких высотах Firefox округляет до пикселей: блок «получил» высоту — значит не 0.
    let fits = SAFE_HEIGHT
    let fails = 1e9
    while (fails - fits > 1) {
      const middle = Math.floor((fits + fails) / 2)
      if (heightOf(middle) > 0) fits = middle
      else fails = middle
    }
    heightLimit = fits
  }
  box.remove()
  return heightLimit
}

/**
 * Наибольшая прокрутка, на которой `sticky; top: 0` остаётся у верха области (BH2);
 * `Infinity` — предела нет. Меряется один раз.
 */
export const measureStickyScrollLimit = (): number => {
  if (stickyLimit !== undefined) return stickyLimit
  const height = Math.floor(measureScrollHeightLimit())
  const box = createProbe('sticky')
  box.style.overflow = 'scroll'
  const sticky = document.createElement('div')
  sticky.style.cssText = 'position:sticky;top:0;height:1px'
  const tall = document.createElement('div')
  tall.style.height = `${height - 1}px`
  box.append(sticky, tall)
  const top = box.getBoundingClientRect().top
  const holds = (scroll: number) => {
    box.scrollTop = scroll
    return Math.abs(sticky.getBoundingClientRect().top - top) < 1
  }
  const end = box.scrollHeight - box.clientHeight
  if (holds(end)) {
    stickyLimit = Infinity
  } else {
    let held = 0
    let lost = end
    while (lost - held > 1) {
      const middle = Math.floor((held + lost) / 2)
      if (holds(middle)) held = middle
      else lost = middle
    }
    stickyLimit = held
  }
  box.remove()
  return stickyLimit
}

/**
 * Наибольшая высота тела (ADR 0142, XS1): меньшее из 8 млн px и пределов высоты и
 * липкости за вычетом шапки и футера над и под ним (`reserved`) — Firefox режет всё, что
 * дальше предела от начала области прокрутки, и не держит шапку глубже предела липкости.
 */
export const stretchBorder = (reserved: number) =>
  Math.floor(
    Math.min(
      SAFE_HEIGHT,
      measureScrollHeightLimit(),
      measureStickyScrollLimit(),
    ) - reserved,
  )

/** Тело не выше границы: выше — растянутая область (ADR 0142). */
export const clampBodyHeight = (height: number, reserved: number): number =>
  height <= SAFE_HEIGHT || typeof document === 'undefined'
    ? height
    : Math.min(height, stretchBorder(reserved))

/** Сброс замеров между тестами. */
export const __resetScrollLimits = (): void => {
  heightLimit = undefined
  stickyLimit = undefined
}
