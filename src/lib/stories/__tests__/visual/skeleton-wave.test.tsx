import { commands } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useState } from 'react'

import { definePlugin, isSkeletonShown } from '../../../../index'
import { Skeleton } from '../../../../ui'
import { DATA_GRID_THEME_CLASS } from '../../../core/themeVariables'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { Stories, getScroller } from '../helpers'
import { snapshot } from './tree-lines-helpers'

// Общая волна скелетов рамки (ADR 0121, WV1–WV7): одна наклонная полоса света по всем
// скелетам рамки, в фазе для смонтированных позже, на токенах темы. Перф WV8–WV9 — в
// `performance/scroll`.

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

type Args = Partial<Parameters<typeof Stories.AllFeatures>[0]>

const BASE: Args = {
  containerHeight: 600,
  height: 500,
  columnCount: 40,
  dataCount: 40,
  enablePagination: true,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableColumnPinning: true,
  pinFirstColumn: true,
  enableFooter: true,
  loading: 'initial',
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const frame = () => document.querySelector<HTMLElement>('[data-skeleton-wave]')!
const waveBars = () => [
  ...frame().querySelectorAll<HTMLElement>('[data-tsr-skeleton-wave]'),
]
const token = (name: string) =>
  Number.parseFloat(getComputedStyle(frame()).getPropertyValue(name))
const lightShift = (bar: Element) =>
  new DOMMatrix(getComputedStyle(bar, '::after').transform).m41
/** Путь блика за проход: ширина рамки, полоса и высота рамки на наклон. */
const periodOf = () => {
  const box = frame().getBoundingClientRect()
  return (
    box.width +
    token('--tsr-comp-skeleton-wave-width') +
    box.height * token('--tsr-comp-skeleton-wave-tilt')
  )
}
/**
 * Место полосы, общее для всех скелетов: блик скелета в координатах содержимого плюс
 * `y × наклон`, по модулю пути за проход.
 */
const wavePlace = (bar: Element) => {
  const origin = frame().getBoundingClientRect()
  const box = bar.getBoundingClientRect()
  const period = periodOf()
  const place =
    box.left -
    origin.left +
    getScroller().scrollLeft +
    lightShift(bar) +
    (box.top - origin.top) * token('--tsr-comp-skeleton-wave-tilt')
  return ((place % period) + period) % period
}
/** Разброс мест по кругу длиной в путь за проход. */
const spreadOf = (places: number[]) => {
  const period = periodOf()
  const sorted = [...places].sort((a, b) => a - b)
  let gap = sorted[0]! + period - sorted.at(-1)!
  for (let i = 1; i < sorted.length; i++) {
    gap = Math.max(gap, sorted[i]! - sorted[i - 1]!)
  }
  return period - gap
}
const waveAnimations = () =>
  document
    .getAnimations()
    .filter(animation =>
      (animation as CSSAnimation).animationName?.includes(
        'skeleton-frame-wave',
      ),
    )
/** Все блики — на долю прохода `progress`, на паузе. */
const pauseAt = async (progress: number) => {
  for (const animation of waveAnimations()) {
    const { delay, duration } = animation.effect!.getComputedTiming()
    animation.pause()
    animation.currentTime =
      Number(delay) + Number(duration) * (((progress % 1) + 1) % 1)
  }
  await nextFrame()
  await nextFrame()
}
const waitWave = async () => {
  await expect.poll(() => waveBars().length).toBeGreaterThan(10)
  // Задержка до первого прохода и досчёт положений позади.
  await sleep(700)
}

describe('Общая волна скелетов (ADR 0121)', () => {
  afterEach(async () => {
    await motion.reducedMotion(false)
    document.getElementById('wave-tokens')?.remove()
  })

  test('WV1: блик всех скелетов рамки — тела, футера, квадратов служебных колонок и нижней панели — на одной наклонной полосе: ниже строка — левее блик', async () => {
    await render(<Stories.AllFeatures {...BASE} />)
    await waitWave()
    const bars = waveBars()
    const kinds = {
      body: bars.filter(bar =>
        bar.closest(
          '.data-grid__body-cell--skeleton:not([data-column-id*="Select"])',
        ),
      ),
      footer: bars.filter(bar =>
        bar.closest('.data-grid__footer-cell--skeleton'),
      ),
      control: bars.filter(bar =>
        bar.closest(
          '.data-grid__body-cell--skeleton[data-column-id*="Select"]',
        ),
      ),
      statusBar: bars.filter(bar =>
        bar.closest('[data-testid="data-grid-status-bar"]'),
      ),
    }
    for (const [kind, list] of Object.entries(kinds)) {
      expect(list.length, kind).toBeGreaterThan(0)
    }
    expect(spreadOf(bars.map(wavePlace))).toBeLessThan(3)

    // Наклон: в одной колонке блик нижней строки левее на разницу высот × наклон.
    const column =
      kinds.body[0]!.closest<HTMLElement>('[data-column-id]')!.dataset.columnId!
    const inColumn = kinds.body.filter(
      bar =>
        bar.closest<HTMLElement>('[data-column-id]')!.dataset.columnId ===
        column,
    )
    const top = inColumn[0]!
    const bottom = inColumn.at(-1)!
    const light = (bar: HTMLElement) =>
      bar.getBoundingClientRect().left + lightShift(bar)
    const rise =
      bottom.getBoundingClientRect().top - top.getBoundingClientRect().top
    expect(rise).toBeGreaterThan(100)
    expect(light(top) - light(bottom)).toBeCloseTo(
      rise * token('--tsr-comp-skeleton-wave-tilt'),
      0,
    )
  })

  test('WV2: путь блика за проход — ширина рамки, полоса и высота × наклон при любой ширине таблицы; прокрутка двигает свет вместе с содержимым, полоса одна', async () => {
    const pathOf = async () => {
      const bar = waveBars()[0]!
      await pauseAt(0)
      const from = lightShift(bar)
      await pauseAt(0.999)
      const to = lightShift(bar)
      return (to - from) / 0.999
    }
    const narrow = await render(
      <Stories.AllFeatures {...BASE} columnCount={6} />,
    )
    await waitWave()
    const narrowDuration =
      waveAnimations()[0]!.effect!.getComputedTiming().duration
    expect(await pathOf()).toBeCloseTo(periodOf(), 0)
    await narrow.unmount()

    const wide = await render(
      <Stories.AllFeatures {...BASE} columnCount={1000} />,
    )
    await waitWave()
    expect(waveAnimations()[0]!.effect!.getComputedTiming().duration).toBe(
      narrowDuration,
    )
    expect(await pathOf()).toBeCloseTo(periodOf(), 0)
    // Путь за проход длиннее рамки: на экране одна полоса.
    expect(periodOf()).toBeGreaterThan(frame().getBoundingClientRect().width)
    await wide.unmount()

    // Пауза выше сдвинула фазу: прокрутка — на свежем гриде, без вмешательства в волну.
    await render(<Stories.AllFeatures {...BASE} columnCount={1000} />)
    await waitWave()
    getScroller().scrollLeft = 3000
    await sleep(400)
    expect(spreadOf(waveBars().map(wavePlace))).toBeLessThan(3)

    // Свет едет с содержимым: на паузе прокрутка сдвигает блик полоски на столько же.
    // Полоска у середины рамки: после сдвига она остаётся в окне виртуализации.
    const middle = frame().getBoundingClientRect().width / 2
    const bar = waveBars()
      .filter(candidate => candidate.closest('[data-virtual-cell="true"]'))
      .sort(
        (a, b) =>
          Math.abs(a.getBoundingClientRect().left - middle) -
          Math.abs(b.getBoundingClientRect().left - middle),
      )[0]!
    const light = () => bar.getBoundingClientRect().left + lightShift(bar)
    for (const animation of waveAnimations()) animation.pause()
    await nextFrame()
    const before = light()
    getScroller().scrollLeft += 100
    await sleep(400)
    expect(bar.isConnected).toBe(true)
    expect(light()).toBeCloseTo(before - 100, 0)
  })

  test('WV3: светятся только полоски — пиксели полоски под полосой света меняются, фон ячейки рядом с ней нет', async () => {
    await render(<Stories.AllFeatures {...BASE} columnCount={6} />)
    await waitWave()
    const bar = waveBars().find(
      candidate =>
        candidate.closest('.data-grid__body-cell--skeleton') &&
        candidate
          .closest<HTMLElement>('[data-column-id]')!
          .getBoundingClientRect().width -
          candidate.getBoundingClientRect().width >
          20,
    )!
    const cell = bar.closest<HTMLElement>('[data-column-id]')!
    const style = getComputedStyle(bar)
    const x = Number.parseFloat(style.getPropertyValue('--tsr-skeleton-x'))
    const y = Number.parseFloat(style.getPropertyValue('--tsr-skeleton-y'))
    const band = token('--tsr-comp-skeleton-wave-width')
    const box = bar.getBoundingClientRect()
    // Доля прохода, на которой середина полосы — над серединой полоски.
    const centred =
      (box.width / 2 +
        band / 2 +
        x +
        y * token('--tsr-comp-skeleton-wave-tilt')) /
      periodOf()
    const barPoint = [box.left + box.width / 2, box.top + box.height / 2]
    const gapPoint = [
      (box.right + cell.getBoundingClientRect().right) / 2,
      box.top + box.height / 2,
    ]

    await pauseAt(centred)
    const lit = await snapshot()
    await pauseAt(centred + 0.5)
    const dark = await snapshot()
    expect(
      Math.abs(
        lit.at(barPoint[0]!, barPoint[1]!) -
          dark.at(barPoint[0]!, barPoint[1]!),
      ),
    ).toBeGreaterThan(3)
    expect(lit.rgb(gapPoint[0]!, gapPoint[1]!)).toEqual(
      dark.rgb(gapPoint[0]!, gapPoint[1]!),
    )
  })

  test('WV4: скелеты, смонтированные посреди загрузки — колонки после горизонтальной прокрутки и строки после роста области, — сразу в той же полосе', async () => {
    const screen = await render(<Stories.AllFeatures {...BASE} height={300} />)
    await waitWave()
    const before = new Set(waveBars())
    getScroller().scrollLeft = 1500
    await screen.rerender(<Stories.AllFeatures {...BASE} height={500} />)
    await sleep(400)
    const bars = waveBars()
    const mounted = bars.filter(bar => !before.has(bar))
    expect(mounted.length).toBeGreaterThan(10)
    expect(spreadOf(bars.map(wavePlace))).toBeLessThan(3)
  })

  test('WV5: токены темы приложения меняют проход, задержку, ширину, наклон и цвет полосы; при уменьшенном движении полосы нет', async () => {
    const style = document.createElement('style')
    style.id = 'wave-tokens'
    style.textContent = `.data-grid-theme {
      --tsr-comp-skeleton-frame-wave-duration: 1200ms;
      --tsr-comp-skeleton-wave-delay: 0ms;
      --tsr-comp-skeleton-wave-width: 300px;
      --tsr-comp-skeleton-wave-tilt: 0;
      --tsr-comp-skeleton-frame-wave: rgb(255, 0, 0);
    }`
    document.head.append(style)
    const screen = await render(<Stories.AllFeatures {...BASE} />)
    await waitWave()
    const timing = waveAnimations()[0]!.effect!.getComputedTiming()
    expect(timing.duration).toBe(1200)
    expect(timing.delay).toBe(0)
    const bar = waveBars()[0]!
    const after = getComputedStyle(bar, '::after')
    expect(after.width).toBe('300px')
    expect(after.backgroundImage).toContain('rgb(255, 0, 0) 50%')
    // Без наклона блик в одной колонке — на одном месте во всех строках.
    const column = waveBars().filter(
      candidate =>
        candidate.closest<HTMLElement>('[data-column-id]')?.dataset.columnId ===
        bar.closest<HTMLElement>('[data-column-id]')?.dataset.columnId,
    )
    const lights = column.map(
      candidate =>
        candidate.getBoundingClientRect().left + lightShift(candidate),
    )
    expect(Math.max(...lights) - Math.min(...lights)).toBeLessThan(2)
    await screen.unmount()

    await motion.reducedMotion(true)
    await render(<Stories.AllFeatures {...BASE} />)
    await waitWave()
    for (const candidate of waveBars()) {
      // Полоса целиком за левым краем скелета.
      expect(lightShift(candidate)).toBeLessThanOrEqual(-300)
    }
  })

  test('WV6: Skeleton из /ui в компоненте слота плагина в нижней панели встаёт в ту же полосу без своих настроек', async () => {
    const info = definePlugin()({
      id: 'waveInfo',
      slots: [
        {
          id: 'waveInfo',
          slot: 'statusBarSlot',
          component: ({ table }) => (
            <span data-testid="wave-info">
              {isSkeletonShown(table) && (
                <Skeleton
                  width={64}
                  height="var(--tsr-comp-skeleton-text-height)"
                />
              )}
            </span>
          ),
        },
      ],
    })
    const Grid = () => {
      const [plugins] = useState(() => [info()])
      const table = useCreateTable({
        columns: [
          { id: 'name', accessorKey: 'name', header: 'Name' },
          { id: 'city', accessorKey: 'city', header: 'City' },
        ] as never,
        data: [],
        plugins: plugins as never,
        loading: 'initial',
      })
      return (
        <div style={{ width: 640, height: 400 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<Grid />)
    await waitWave()
    const slotBar = document.querySelector(
      '[data-testid="wave-info"] [data-tsr-skeleton-wave]',
    )!
    expect(slotBar).not.toBeNull()
    const bars = waveBars()
    expect(bars).toContain(slotBar)
    expect(spreadOf(bars.map(wavePlace))).toBeLessThan(3)
  })

  test('WV7: Skeleton приложения вне рамки грида — прежняя волна по своей полоске; после загрузки общей волны нет', async () => {
    // Скелет приложения в теме кита, но не в рамке грида.
    const screen = await render(
      <>
        <span data-testid="outside" className={DATA_GRID_THEME_CLASS}>
          <Skeleton width={120} height={16} />
        </span>
        <Stories.AllFeatures {...BASE} columnCount={6} />
      </>,
    )
    await waitWave()
    const outside = document.querySelector<HTMLElement>(
      '[data-testid="outside"] [data-tsr-skeleton-wave]',
    )!
    const own = outside
      .getAnimations({ subtree: true })
      .map(animation => (animation as CSSAnimation).animationName)
    expect(own).toHaveLength(1)
    expect(own[0]).toContain('skeleton-wave')
    expect(own[0]).not.toContain('frame-wave')
    expect(getComputedStyle(outside, '::after').width).toBe('120px')

    await screen.rerender(
      <>
        <span data-testid="outside" className={DATA_GRID_THEME_CLASS}>
          <Skeleton width={120} height={16} />
        </span>
        <Stories.AllFeatures {...BASE} columnCount={6} loading={false} />
      </>,
    )
    await expect
      .poll(() => document.querySelector('[data-skeleton-wave]'))
      .toBeNull()
    expect(waveAnimations()).toHaveLength(0)
  })
})
