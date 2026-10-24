import { commands, page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { parseDuration } from '@/lib/ui/buttonStates'
import ringStyles from '@/lib/ui/ringStates/ringStates.module.css'
import { toRgba } from './a11y-helpers'

// Спиннер ожидания (ADR 0095, LL4; вид — ADR 0127). Дуга кнопок — набор `pending-arc`,
// свет ячейки в правке — CF* (`async-callbacks`).

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const Theme = ({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) => (
  <div className="data-grid-theme" style={{ padding: 24, ...style }}>
    {children}
  </div>
)

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Цвет токена, разрешённый в контексте элемента. */
const tokenIn = (el: Element, name: string) => {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  el.appendChild(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/** Пиксели скриншота в CSS-координатах окна. */
const snapshot = async () => {
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
  return (x: number, y: number) =>
    Array.from(
      context
        .getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1)
        .data.slice(0, 3),
    )
}

const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

/** Точка на окружности `radius` вокруг центра элемента, угол в градусах. */
const onCircle = (el: Element, radius: number, degrees: number) => {
  const box = el.getBoundingClientRect()
  const a = (degrees * Math.PI) / 180
  return [
    box.left + box.width / 2 + Math.cos(a) * radius,
    box.top + box.height / 2 + Math.sin(a) * radius,
  ] as const
}

describe('Спиннер ожидания (ADR 0095)', () => {
  test('LL4: спиннер — дуга --tsr-comp-pending-spinner-arc со скруглённой головой и хвостом, плотность которого падает к концу, бежит по кругу над бледной дорожкой силой --tsr-comp-pending-track-strength, середина прозрачна, свет не выходит за линию дуги; цвет дуги и дорожки перетекает оттенками --tsr-comp-pending-spinner-1…4; оборот 0,5, цикл цвета 1,7 длительности света; дуга в фазе с дугой круглой кнопки — в начале оборота хвост от верха по часовой; без движения — так и стоит первым оттенком (ADR 0127)', async () => {
    // Толщина крупнее, чем в пункте меню, — чтобы мерить пиксели; геометрия — от токена.
    const WIDTH = 6
    const SIZE = 96
    const Spinner = () => (
      <Theme
        style={
          { '--tsr-comp-pending-ring-width': `${WIDTH}px` } as CSSProperties
        }
      >
        <span
          className={ringStyles.spinner}
          data-testid="spinner"
          style={{ display: 'block', width: SIZE, height: SIZE }}
        />
      </Theme>
    )
    const spinner = () =>
      document.querySelector<HTMLElement>('[data-testid="spinner"]')!
    const screen = await render(<Spinner />)
    const el = spinner()
    const tone = (index: number) =>
      tokenIn(el.parentElement!, `--tsr-comp-pending-spinner-${index}`)

    // Тайминги — доли длительности света ожидания.
    const base = parseDuration(
      getComputedStyle(el).getPropertyValue('--tsr-comp-pending-glow-duration'),
    )
    const animations = el.getAnimations() as CSSAnimation[]
    const turn = animations.find(a => a.animationName.includes('spinnerTurn'))!
    const tones = animations.find(a =>
      a.animationName.includes('spinnerTones'),
    )!
    expect(turn.effect!.getComputedTiming().duration).toBeCloseTo(base * 0.5)
    expect(tones.effect!.getComputedTiming().duration).toBeCloseTo(base * 1.7)

    // Цвет дуги перетекает по четырём оттенкам.
    const cycle = tones.effect!.getComputedTiming().duration as number
    tones.pause()
    for (const index of [1, 2, 3, 4]) {
      tones.currentTime = (cycle * (index - 1)) / 4
      expect(
        getComputedStyle(el).getPropertyValue('--tsr-spinner-tone'),
        `tone ${index}`,
      ).toBe(tone(index))
    }

    // Кадр начала оборота: дуга от верха по часовой первым оттенком, как у круглой кнопки.
    turn.pause()
    turn.currentTime = 0
    tones.currentTime = 0
    await frame()
    const outer = SIZE / 2
    const middle = outer - WIDTH / 2
    const shot = await snapshot()
    const box = el.getBoundingClientRect()
    const background = shot(box.right + 20, box.top + box.height / 2)
    const first = toRgba(tone(1)).slice(0, 3)
    const at = (radius: number, degrees: number) =>
      shot(...onCircle(el, radius, degrees - 90))
    const arcTurn = parseFloat(
      getComputedStyle(el).getPropertyValue('--tsr-comp-pending-spinner-arc'),
    )
    expect(arcTurn).toBe(0.3)
    const head = arcTurn * 360
    const strength =
      parseFloat(
        getComputedStyle(el).getPropertyValue(
          '--tsr-comp-pending-track-strength',
        ),
      ) / 100
    // Дорожка — оттенок поверх фона силой токена.
    const track = background.map((c, i) => c + (first[i]! - c) * strength)
    // Голова у конца дуги — полный оттенок; к началу хвоста плотность падает до дорожки.
    expect(distance(at(middle, head - 4), first), 'голова').toBeLessThan(40)
    const tail = [0.85, 0.6, 0.35, 0.1].map(share =>
      distance(at(middle, head * share), first),
    )
    for (let i = 1; i < tail.length; i += 1) {
      expect(tail[i], `хвост слабее к концу, шаг ${i}`).toBeGreaterThan(
        tail[i - 1]!,
      )
    }
    // Вне дуги на средней линии — дорожка, а не фон.
    for (const degrees of [-30, head + 20, 180]) {
      expect(
        distance(at(middle, degrees), track),
        `дорожка ${degrees}°`,
      ).toBeLessThan(6)
      expect(
        distance(at(middle, degrees), background),
        `не фон ${degrees}°`,
      ).toBeGreaterThan(10)
    }
    // Середина прозрачна, свет не выходит за линию дуги ни внутрь, ни наружу.
    expect(distance(at(0, 0), background)).toBeLessThan(4)
    expect(distance(at(outer - WIDTH - 3, 45), background)).toBeLessThan(4)
    expect(distance(at(outer + 3, 45), background)).toBeLessThan(4)
    await screen.unmount()

    // Без движения дуга стоит хвостом от верха по часовой первым оттенком над дорожкой.
    await reducedMotion(true)
    await render(<Spinner />)
    await frame()
    const still = await snapshot()
    expect(
      distance(still(...onCircle(spinner(), middle, head - 4 - 90)), first),
    ).toBeLessThan(40)
    expect(
      distance(still(...onCircle(spinner(), middle, -30 - 90)), track),
    ).toBeLessThan(6)
  })
})
