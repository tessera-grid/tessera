import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import { DEFAULT_LABELS } from '../../../core/localization'
import { renderGrid } from '../helpers'
import { composed } from '../stories'
import { AXE_OPTIONS, contrast, effectiveBg, toRgba } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Обновление данных (ADR 0094, GL1–GL12): свечение под шапкой, приглушение тела и
// футера, тайминг показа, отклики на наведение, режимы, токены, доступность.

const media = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
  forcedColors: (active: boolean) => Promise<void>
}

afterEach(async () => {
  await media.reducedMotion(false)
  await media.forcedColors(false)
})

const el = (selector: string) => document.querySelector<HTMLElement>(selector)
const loader = () => el('.data-grid__loader')
const glows = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__loader-glow'),
]
const line = () => el('.data-grid__loader-line')!
const wrapper = () => el('.data-grid-theme[class*="theme-wrapper"]')!
const body = () => el('.data-grid__body')!
const footerRow = () => el('.data-grid__footer')!.firstElementChild!
const rows = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
]
const headCells = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__head-cell'),
]
const rect = (node: Element) => node.getBoundingClientRect()
const style = (node: Element) => getComputedStyle(node)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const headBottom = () => Math.max(...headCells().map(c => rect(c).bottom))
const firstRowTop = () => Math.min(...rows().map(r => rect(r).top))
const refreshing = () => wrapper().hasAttribute('data-refreshing')

/** Значение токена темы на обёртке грида. */
const token = (name: string) => style(wrapper()).getPropertyValue(name).trim()

/** Цвет токена так, как его отдаёт `background-color`. */
const tokenColor = (name: string) => {
  const probe = document.createElement('div')
  probe.style.backgroundColor = `var(${name})`
  wrapper().append(probe)
  const value = style(probe).backgroundColor
  probe.remove()
  return value
}

/** Переходы доиграли: приглушение — в конечном значении. */
const finishTransitions = () =>
  document
    .getAnimations()
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .forEach(a => a.finish())

const GRID = { columnCount: 6, dataCount: 30 }

const renderRefreshing = async (args: Record<string, unknown> = {}) => {
  await renderGrid({ ...GRID, enableLoading: true, ...args })
  await waitForGrid()
  await expect.poll(loader).not.toBeNull()
  finishTransitions()
}

/** Анимации слоя по имени keyframes (имена модуля хешированы). */
const animationOf = (node: Element, name: string) =>
  node
    .getAnimations()
    .find(a => (a as CSSAnimation).animationName.includes(name)) as
    CSSAnimation | undefined

const animatedProperties = (animation: Animation) =>
  new Set(
    (animation.effect as KeyframeEffect)
      .getKeyframes()
      .flatMap(frame => Object.keys(frame))
      .filter(
        key =>
          !['offset', 'computedOffset', 'easing', 'composite'].includes(key),
      ),
  )

describe('Обновление данных (ADR 0094)', () => {
  test('GL1: свечение под шапкой — размытая полоса оттенков синего, видна её нижняя половина: свет уходит вниз на тело, шапка не светится, линии нет; указатель не перехватывает, раскладку не сдвигает', async () => {
    await renderGrid(GRID)
    await waitForGrid()
    const restingTop = firstRowTop()
    await cleanup()

    await renderRefreshing()
    expect(firstRowTop()).toBe(restingTop)

    // Свет начинается у нижней границы шапки и уходит вниз на глубину токена.
    expect(Math.abs(rect(loader()!).top - headBottom())).toBeLessThanOrEqual(1)
    expect(rect(loader()!).height).toBeCloseTo(
      parseFloat(token('--tsr-comp-loader-glow-size')),
      0,
    )
    expect(style(loader()!).overflow).toBe('hidden')

    // Полоса размыта, её верхняя половина — выше границы и обрезана.
    for (const glow of glows()) {
      expect(style(glow).filter).toContain('blur')
      expect(rect(glow).top).toBeLessThan(rect(loader()!).top)
    }
    // Оттенки синего — все четыре токена в градиенте.
    const flow = style(glows()[0]!).backgroundImage
    for (const shade of [1, 2, 3, 4]) {
      expect(flow).toContain(tokenColor(`--tsr-comp-loader-glow-${shade}`))
    }
    // Линии нет.
    expect(style(line()).display).toBe('none')

    // Указатель проходит сквозь свет к ячейке.
    expect(style(loader()!).pointerEvents).toBe('none')
    const box = rect(loader()!)
    const under = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    )
    expect(under?.closest('.data-grid__body-cell')).not.toBeNull()
  })

  test('GL2: цвета текут вдоль шапки двумя встречными слоями с некратными периодами, яркость дышит и не ниже 55 %; анимируются только transform и opacity', async () => {
    await renderRefreshing()
    const [flow, counter] = glows()
    const flows = [flow!, counter!].map(glow => animationOf(glow, 'flow')!)
    const breaths = [flow!, counter!].map(glow => animationOf(glow, 'breathe')!)

    // Встречные: у второго слоя обратное направление.
    expect(flows[0]!.effect!.getTiming().direction).toBe('normal')
    expect(flows[1]!.effect!.getTiming().direction).toBe('reverse')
    // Периоды не кратны друг другу.
    const periods = [...flows, ...breaths].map(a =>
      Number(a.effect!.getTiming().duration),
    )
    for (const a of periods) {
      for (const b of periods) {
        if (a === b) continue
        const ratio = Math.max(a, b) / Math.min(a, b)
        expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.05)
      }
    }
    // Все бесконечны, анимируют только transform и opacity, дыхание не ниже 55 %.
    for (const animation of [...flows, ...breaths]) {
      expect(animation.effect!.getTiming().iterations).toBe(Infinity)
      for (const key of animatedProperties(animation)) {
        expect(['transform', 'opacity']).toContain(key)
      }
    }
    for (const breath of breaths) {
      const opacities = (breath.effect as KeyframeEffect)
        .getKeyframes()
        .map(frame => Number(frame.opacity))
      expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.55)
    }

    // Цвета движутся: сдвиг полосы меняется во времени.
    const shift = () => new DOMMatrix(style(flow!).transform).m41
    flows[0]!.pause()
    flows[0]!.currentTime = 0
    const start = shift()
    flows[0]!.currentTime = Number(flows[0]!.effect!.getTiming().duration) / 2
    expect(shift()).toBeLessThan(start)
  })

  test('GL3: во время обновления тело и футер приглушены токеном (по умолчанию 0,6), переход — токенами движения; шапка, тулбар и нижняя панель не приглушаются', async () => {
    await renderRefreshing({
      enableFooter: true,
      enableToolbar: true,
      enableStatusBar: true,
    })
    expect(token('--tsr-comp-loader-dim-opacity')).toBe('0.6')
    expect(style(body()).opacity).toBe('0.6')
    expect(style(footerRow()).opacity).toBe('0.6')
    for (const node of [
      headCells()[0]!,
      el('[role="toolbar"]')!,
      el('[data-testid="data-grid-status-bar"]')!,
      el('.data-grid__footer')!,
    ]) {
      expect(style(node).opacity).toBe('1')
    }
    // Переход приглушения — токены движения.
    expect(style(body()).transitionProperty).toContain('opacity')
    expect(style(body()).transitionDuration).toBe(
      style(wrapper())
        .getPropertyValue('--tsr-comp-motion-duration')
        .trim()
        .replace(/^(\d+)ms$/, (_, ms) => `${Number(ms) / 1000}s`),
    )
  })

  test('GL4: тело во время обновления рабочее, но не откликается на наведение — нет фона и обводки строки и ячейки, кнопки по наведению не проявляются', async () => {
    const hoverState = async () => {
      const row = rows().find(r => r.dataset.index === '2')!
      // Ячейка с кнопкой правки — она проявляется по наведению.
      const cell = [
        ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
      ].find(c => c.querySelector('.cell__button--hidden'))!
      await userEvent.hover(cell)
      await sleep(400)
      finishTransitions()
      return {
        rowBg: style(row).backgroundColor,
        outline: style(cell).outlineColor,
        buttons: [
          ...cell.querySelectorAll<HTMLElement>('.cell__button--hidden'),
        ].map(b => style(b).opacity),
      }
    }
    const args = {
      ...GRID,
      enableCellEditing: true,
      enableRowSelection: true,
    }

    // Без обновления наведение откликается.
    await renderGrid(args)
    await waitForGrid()
    const live = await hoverState()
    await cleanup()

    await renderRefreshing(args)
    const dimmed = await hoverState()
    expect(dimmed.rowBg).not.toBe(live.rowBg)
    expect(dimmed.outline).not.toBe(live.outline)
    expect(toRgba(dimmed.outline)[3]).toBe(0)
    expect(live.buttons).toContain('1')
    expect(dimmed.buttons.every(opacity => opacity === '0')).toBe(true)

    // Тело рабочее: не inert, выбор нажатием работает, прокрутка идёт.
    expect(body().closest('[inert]')).toBeNull()
    const row = rows().find(r => r.dataset.index === '1')!
    await userEvent.click(row.querySelector<HTMLElement>('[role="checkbox"]')!)
    await expect.poll(() => row.getAttribute('data-selected')).toBe('true')
    const scroller = el('.data-grid__container')!
    scroller.scrollTop = 200
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
  })

  test('GL5: свечение и приглушение появляются через loadingOptions.delayMs (по умолчанию 300 мс) после включения enableLoading; загрузка, кончившаяся раньше, их не показывает', async () => {
    const seen: boolean[] = []
    const observer = new MutationObserver(() => seen.push(!!loader()))
    observer.observe(document.body, { subtree: true, childList: true })
    try {
      const screen = await render(
        <composed.AllFeatures {...GRID} enableLoading />,
      )
      await waitForGrid()
      await sleep(150)
      expect(loader()).toBeNull()
      expect(refreshing()).toBe(false)
      await screen.rerender(
        <composed.AllFeatures {...GRID} enableLoading={false} />,
      )
      await sleep(600)
      expect(seen).not.toContain(true)
      await cleanup()

      // Без раннего снятия — через задержку.
      await render(<composed.AllFeatures {...GRID} enableLoading />)
      await waitForGrid()
      const started = performance.now()
      await expect.poll(loader).not.toBeNull()
      expect(performance.now() - started).toBeGreaterThanOrEqual(150)
      expect(refreshing()).toBe(true)
      await cleanup()

      // Своя задержка из опций.
      await render(
        <composed.AllFeatures
          {...GRID}
          enableLoading
          loadingOptions={{ delayMs: 0 }}
        />,
      )
      await expect.poll(loader, { timeout: 200 }).not.toBeNull()
    } finally {
      observer.disconnect()
    }
  })

  test('GL6: показанные свечение и приглушение держатся не меньше loadingOptions.minDurationMs (по умолчанию 500 мс)', async () => {
    const screen = await render(
      <composed.AllFeatures {...GRID} enableLoading />,
    )
    await waitForGrid()
    await expect.poll(loader).not.toBeNull()
    await screen.rerender(
      <composed.AllFeatures {...GRID} enableLoading={false} />,
    )
    await sleep(300)
    expect(loader()).not.toBeNull()
    expect(refreshing()).toBe(true)
    await expect.poll(loader, { timeout: 1000 }).toBeNull()
    expect(refreshing()).toBe(false)
  })

  test('GL7: aria-busy таблицы и объявление об окончании загрузки — по флагу, без задержки показа и без минимума', async () => {
    const table = () => el('[role="table"], [role="grid"], [role="treegrid"]')!
    const screen = await render(
      <composed.AllFeatures {...GRID} enableLoading />,
    )
    await waitForGrid()
    // До показа свечения таблица уже занята.
    expect(loader()).toBeNull()
    expect(table().getAttribute('aria-busy')).toBe('true')

    await expect.poll(loader).not.toBeNull()
    await screen.rerender(
      <composed.AllFeatures {...GRID} enableLoading={false} />,
    )
    // Свечение ещё держит минимум, а таблица уже свободна и окончание объявлено.
    await expect.poll(() => table().getAttribute('aria-busy')).toBeNull()
    expect(loader()).not.toBeNull()
    await expect
      .poll(() => el('[role="status"][aria-live]')?.textContent ?? '')
      .toContain(DEFAULT_LABELS.announceLoaded(GRID.dataCount))
  })

  test('GL8: enableSkeleton главнее — при скелете нет ни свечения, ни приглушения', async () => {
    await renderGrid({ ...GRID, enableLoading: true, enableSkeleton: true })
    await sleep(700)
    expect(loader()).toBeNull()
    expect(refreshing()).toBe(false)
  })

  test('GL9: prefers-reduced-motion — цвета не текут, яркость медленно пульсирует (только opacity, период ≥ 2 с), исключение в едином гасителе движения; приглушение — без перехода', async () => {
    await media.reducedMotion(true)
    await renderRefreshing()
    for (const glow of glows()) {
      expect(style(glow).animationName).toBe('data-grid-loader-pulse')
      const [animation] = glow.getAnimations()
      expect(animation!.effect!.getTiming().iterations).toBe(Infinity)
      expect(
        Number(animation!.effect!.getTiming().duration),
      ).toBeGreaterThanOrEqual(2000)
      expect([...animatedProperties(animation!)]).toEqual(['opacity'])
      expect(style(glow).transform).toBe('none')
    }
    expect(style(body()).transitionDuration).toBe('0s')
  })

  test('GL10: forced-colors — свечения нет, линия Highlight во всю ширину; приглушение остаётся', async () => {
    await media.forcedColors(true)
    await renderRefreshing()
    const highlight = (() => {
      const probe = document.createElement('span')
      probe.style.color = 'Highlight'
      document.body.append(probe)
      const value = style(probe).color
      probe.remove()
      return value
    })()
    for (const glow of glows()) expect(style(glow).display).toBe('none')
    expect(style(line()).display).toBe('block')
    expect(style(line()).backgroundColor).toBe(highlight)
    expect(rect(line()).width).toBeCloseTo(rect(loader()!).width, 0)
    expect(style(body()).opacity).toBe('0.6')
  })

  test('GL11: вид задают токены — цвет, оттенки, глубина и сила свечения, проход цветов, сила приглушения; переопределение токена меняет вид', async () => {
    await renderRefreshing()
    const resting = style(glows()[0]!).backgroundImage
    const own = document.createElement('style')
    own.textContent = `.data-grid-theme.data-grid-theme {
      --tsr-comp-loader-glow-1: rgb(200, 0, 0);
      --tsr-comp-loader-glow-2: rgb(0, 128, 0);
      --tsr-comp-loader-glow-3: rgb(0, 0, 200);
      --tsr-comp-loader-glow-4: rgb(200, 200, 0);
      --tsr-comp-loader-glow-size: 40px;
      --tsr-comp-loader-duration: 3s;
      --tsr-comp-loader-dim-opacity: 0.4;
    }`
    document.head.append(own)
    try {
      finishTransitions()
      const flow = style(glows()[0]!).backgroundImage
      expect(flow).not.toBe(resting)
      for (const color of [
        'rgb(200, 0, 0)',
        'rgb(0, 128, 0)',
        'rgb(0, 0, 200)',
        'rgb(200, 200, 0)',
      ]) {
        expect(flow).toContain(color)
      }
      expect(rect(loader()!).height).toBeCloseTo(40, 0)
      expect(
        Number(animationOf(glows()[0]!, 'flow')!.effect!.getTiming().duration),
      ).toBe(3000)
      expect(style(body()).opacity).toBe('0.4')
    } finally {
      own.remove()
    }
    // Цвет загрузки — исходный токен первого оттенка и линии.
    expect(style(line()).backgroundColor).toBe(
      tokenColor('--tsr-comp-loader-bar'),
    )
  })

  test('GL12: роль progressbar и подпись, axe без нарушений; во время обновления тексты тела не ниже 3:1', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      await renderRefreshing({ colorMode })
      expect(loader()!.getAttribute('role')).toBe('progressbar')
      expect(loader()!.getAttribute('aria-label')).toBe(DEFAULT_LABELS.loading)
      const { violations } = await axe.run(wrapper(), AXE_OPTIONS)
      expect(
        violations.map(v => v.id),
        colorMode,
      ).toEqual([])

      const dim = Number(style(body()).opacity)
      const texts = [
        ...body().querySelectorAll<HTMLElement>('.data-grid__body-cell *'),
      ].filter(node =>
        [...node.childNodes].some(
          child =>
            child.nodeType === Node.TEXT_NODE && child.textContent!.trim(),
        ),
      )
      expect(texts.length).toBeGreaterThan(0)
      for (const text of texts) {
        const bg = effectiveBg(text)
        const fg = toRgba(style(text).color)
        const shown = fg.slice(0, 3).map((c, i) => c * dim + bg[i]! * (1 - dim))
        expect(contrast([...shown, 1], bg), colorMode).toBeGreaterThanOrEqual(3)
      }
      await cleanup()
    }
  })
})
