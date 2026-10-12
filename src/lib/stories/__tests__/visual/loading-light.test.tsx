import { commands, page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'
import type { CSSProperties, ReactNode } from 'react'

import '../../../core/themeVariables/theme.css'
import { IconButton } from '@/lib/ui/IconButton'
import { parseDuration } from '@/lib/ui/buttonStates'
import { SvgIcon } from '@/lib/ui/icons'
import ringStyles from '@/lib/ui/ringStates/ringStates.module.css'
import { renderGrid } from '../helpers'
import { submittedCellsSeed } from '../performance/perf-cases'
import { inBothThemes, toRgba } from './a11y-helpers'

// Свет ожидания и ошибки (ADR 0095, LL1–LL5): пятна оттенков свечения загрузки у кнопок,
// ячеек и спиннера, фаза, статичный красный свет ошибки, сила света. Вид кнопок и ячеек
// по отдельности — BS* (`button-states`) и CF* (`async-callbacks`).

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

const icon = <SvgIcon width={20} height={20} />
const buttons = () => [
  ...document.querySelectorAll<HTMLButtonElement>('button'),
]
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Цвет токена, разрешённый в контексте элемента. */
const tokenIn = (el: Element, name: string) => {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  el.appendChild(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/** Анимации пятен света элемента (CSS-анимации его `::after` или его самого). */
const spotAnimations = (el: Element) =>
  el
    .getAnimations({ subtree: true })
    .filter(animation =>
      (animation as CSSAnimation).animationName?.includes('pendingSpot'),
    ) as CSSAnimation[]

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

describe('Свет ожидания и ошибки (ADR 0095)', () => {
  test('LL1: у каждого из четырёх пятен место и яркость идут по своим ключевым кадрам — за период пятно загорается не меньше двух раз в разных четвертях, гаснет между вспышками, дрейф в обе стороны; периоды разные', async () => {
    await render(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    const button = buttons()[0]!
    const animations = spotAnimations(button)
    expect(animations).toHaveLength(4)
    const durations = animations.map(
      a => a.effect!.getComputedTiming().duration as number,
    )
    expect(new Set(durations).size).toBe(4)

    const drifts: number[] = []
    animations.forEach((animation, index) => {
      const spot = index + 1
      animation.pause()
      const samples = Array.from({ length: 120 }, (_, i) => {
        animation.currentTime = (durations[index]! * i) / 120
        const style = getComputedStyle(button, '::after')
        return {
          angle: parseFloat(
            style.getPropertyValue(`--tsr-pending-spot-a${spot}`),
          ),
          lit: parseFloat(
            style.getPropertyValue(`--tsr-pending-spot-f${spot}`),
          ),
        }
      })
      // Вспышки — подряд идущие сэмплы ярче половины, по кругу периода.
      const start = samples.findIndex(sample => sample.lit < 10)
      expect(start, `spot ${spot} goes dark`).toBeGreaterThanOrEqual(0)
      const ordered = [...samples.slice(start), ...samples.slice(0, start)]
      const episodes: { angle: number }[][] = []
      let current: { angle: number }[] | null = null
      for (const sample of ordered) {
        if (sample.lit > 50) {
          if (!current) episodes.push((current = []))
          current.push(sample)
        } else {
          current = null
        }
      }
      expect(episodes.length, `spot ${spot} episodes`).toBeGreaterThanOrEqual(2)
      const quarters = new Set(
        episodes.map(episode => {
          const mean =
            episode.reduce((sum, s) => sum + s.angle, 0) / episode.length
          return Math.floor((((mean % 360) + 360) % 360) / 90)
        }),
      )
      expect(quarters.size, `spot ${spot} quarters`).toBeGreaterThanOrEqual(2)
      for (const episode of episodes) {
        for (let i = 1; i < episode.length; i++) {
          drifts.push(episode[i]!.angle - episode[i - 1]!.angle)
        }
      }
    })
    expect(drifts.some(delta => delta > 0)).toBe(true)
    expect(drifts.some(delta => delta < 0)).toBe(true)
  })

  test('LL2: соседние кнопки и ячейки не идут в такт — у кнопки своя случайная фаза, у ячейки фаза от ключа, разная у соседних и та же после повторного монтирования', async () => {
    const screen = await render(
      <Theme>
        <IconButton aria-label="One" pending>
          {icon}
        </IconButton>
        <IconButton aria-label="Two" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    const [one, two] = buttons()
    const phaseOf = (el: HTMLElement) =>
      Number(el.style.getPropertyValue('--tsr-pending-phase'))
    for (const el of [one!, two!]) {
      expect(phaseOf(el)).toBeGreaterThanOrEqual(0)
      expect(phaseOf(el)).toBeLessThan(1)
    }
    expect(phaseOf(one!)).not.toBe(phaseOf(two!))
    expect(getComputedStyle(one!, '::after').animationDelay).not.toBe(
      getComputedStyle(two!, '::after').animationDelay,
    )
    await screen.unmount()

    /** Фазы слоёв ожидания по ключу ячейки «строка:колонка». */
    const cellPhases = async () => {
      const grid = await renderGrid({
        columnCount: 6,
        dataCount: 20,
        enableCellEditing: true,
        extraPlugins: [submittedCellsSeed(4, 'pending')],
      })
      await expect
        .poll(() => document.querySelectorAll('.cell-edit-feedback').length)
        .toBeGreaterThan(3)
      const phases = new Map<string, number>()
      for (const layer of document.querySelectorAll<HTMLElement>(
        '.cell-edit-feedback[data-pending]',
      )) {
        const cell = layer.closest<HTMLElement>('.data-grid__body-cell')!
        const row = layer.closest<HTMLElement>('.data-grid__body-row')!
        phases.set(
          `${row.dataset.index}:${cell.dataset.columnId}`,
          phaseOf(layer),
        )
      }
      await grid.unmount()
      return phases
    }
    const first = await cellPhases()
    // Соседи по строке и по колонке.
    for (const [a, b] of [
      ['0:age', '0:visits'],
      ['0:age', '1:age'],
      ['1:visits', '1:gender'],
    ]) {
      expect(first.get(a), a).toBeDefined()
      expect(first.get(a), `${a} vs ${b}`).not.toBe(first.get(b))
    }
    const second = await cellPhases()
    expect([...second]).toEqual([...first])
  })

  test('LL3: красный свет ошибки статичен — пока держится вспышка, анимации пятен на паузе и два кадра удержания одинаковы', async () => {
    const long = { '--tsr-comp-error-flash-duration': '10s' } as CSSProperties
    const screen = await render(
      <Theme style={long}>
        <IconButton aria-label="Load" pending errorFlash={0}>
          {icon}
        </IconButton>
      </Theme>,
    )
    await pause(300)
    await screen.rerender(
      <Theme style={long}>
        <IconButton aria-label="Load" errorFlash={1}>
          {icon}
        </IconButton>
      </Theme>,
    )
    const button = buttons()[0]!
    await expect
      .poll(() =>
        parseFloat(
          getComputedStyle(button, '::after').getPropertyValue(
            '--tsr-ring-fill',
          ),
        ),
      )
      .toBe(100)
    for (const animation of spotAnimations(button)) {
      expect(animation.playState).toBe('paused')
    }
    const points = [0, 60, 120, 180, 240, 300].map(degrees =>
      onCircle(button, button.getBoundingClientRect().width / 2 + 2, degrees),
    )
    const first = await snapshot()
    await pause(400)
    const second = await snapshot()
    for (const point of points) {
      expect(second(...point), `${point}`).toEqual(first(...point))
    }
  })

  test('LL4: спиннер — бледная дорожка с прозрачной серединой, по ней бежит дуга в четверть круга той же толщины, свет не выходит за дорожку; цвет дуги перетекает оттенками --tsr-comp-pending-spinner-1…4; оборот 0,5, цикл цвета 1,7 длительности света; без движения — дуга первым оттенком', async () => {
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

    // Кадр: дуга наверху первым оттенком.
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
    // Дуга — четверть круга на средней линии: внутри её края — оттенок, за ними — дорожка.
    for (const degrees of [0, 30, -30, 40, -40]) {
      expect(
        distance(at(middle, degrees), first),
        `arc ${degrees}°`,
      ).toBeLessThan(40)
    }
    const track = at(middle, 180)
    expect(distance(track, first)).toBeGreaterThan(60)
    expect(distance(track, background)).toBeGreaterThan(10)
    for (const degrees of [60, -60]) {
      expect(
        distance(at(middle, degrees), track),
        `track ${degrees}°`,
      ).toBeLessThan(10)
    }
    // Середина прозрачна, свет не выходит за дорожку ни внутрь, ни наружу.
    expect(distance(at(0, 0), background)).toBeLessThan(4)
    expect(distance(at(outer - WIDTH - 3, 0), background)).toBeLessThan(4)
    expect(distance(at(outer + 3, 0), background)).toBeLessThan(4)
    await screen.unmount()

    // Без движения дуга стоит наверху первым оттенком.
    await reducedMotion(true)
    await render(<Spinner />)
    await frame()
    const still = await snapshot()
    expect(
      distance(still(...onCircle(spinner(), middle, -90)), first),
    ).toBeLessThan(40)
  })

  test('LL5: сила света — --tsr-comp-loader-glow-opacity равна 80 % --tsr-sys-glow-strength; красный свет ошибки той же силы, что оттенок ожидания, в обеих темах', async () => {
    await render(
      <Theme>
        <IconButton aria-label="Load" pending>
          {icon}
        </IconButton>
      </Theme>,
    )
    const theme = document.querySelector('.data-grid-theme')!
    await inBothThemes(async () => {
      const strength =
        parseFloat(
          getComputedStyle(theme).getPropertyValue('--tsr-sys-glow-strength'),
        ) / 100
      const loader = toRgba(tokenIn(theme, '--tsr-comp-loader-glow-1'))[3]!
      expect(Math.abs(loader - strength * 0.8)).toBeLessThan(0.01)
      const pending = toRgba(tokenIn(theme, '--tsr-comp-pending-glow-1'))[3]!
      const error = toRgba(tokenIn(theme, '--tsr-comp-error-flash-glow'))
      expect(Math.abs(error[3]! - pending)).toBeLessThan(0.01)
      // Красный — цвет ошибки.
      expect(error[0]!).toBeGreaterThan(error[1]! + 50)
      expect(error[0]!).toBeGreaterThan(error[2]! + 50)
    })
  })
})
