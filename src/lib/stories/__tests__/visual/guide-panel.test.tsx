import { composeStories } from '@storybook/react'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../GuidePanel.dev.stories'

// Панель гайда историй (ADR 0117, SN14–SN15, SN17, SN21–SN25) — с движением: каталог
// гоняет истории с уменьшенным движением, и порядок конфетти и сдвига виден только здесь.
// SN16, SN18–SN20 — в `play` песочницы `Tessera/Dev/Guide panel`.

const { GuidePanelCollapsed, GuidePanelManySteps, GuidePanelPlayground } =
  composeStories(stories)

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const button = (id: string) => byId(id) as HTMLButtonElement
const confetti = () =>
  [...document.body.children].filter(
    element =>
      element.tagName === 'SPAN' &&
      (element as HTMLElement).style.position === 'fixed',
  )
const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Прокрутка ленты шагов по горизонтали, px. */
const slideOf = () => byId('guide-steps').scrollLeft

/** Лента шагов докрутилась: два кадра подряд на месте. */
const slideSettled = async () => {
  let last = Number.NaN
  await expect
    .poll(
      async () => {
        const before = slideOf()
        await frame()
        const same = before === slideOf() && before === last
        last = slideOf()
        return same
      },
      { timeout: 3000 },
    )
    .toBe(true)
}

/** Дождаться, пока «Далее» снова доступна: шаг дождался своей анимации. */
const settled = () =>
  expect
    .poll(() => button('guide-next').disabled, {
      timeout: 5000,
      interval: 10,
    })
    .toBe(false)

describe('панель сценария (ADR 0117)', () => {
  test('SN14: панель свёрнута по умолчанию — название, номер шага и «Воспроизвести», без кнопок шагов; раскрытие и сворачивание плавные; свёрнутое тело вне фокуса', async () => {
    await render(<GuidePanelCollapsed />)
    await expect.poll(() => byId('guide-toggle')).toBeTruthy()
    const toggle = byId('guide-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toMatch(/Гайд · .+· шаг 1 из 3/)
    expect(byId('guide-play').textContent).toContain('Воспроизвести')
    // Кнопки шагов — в свёрнутом теле: вне фокуса и дерева доступности.
    for (const id of ['guide-back', 'guide-next', 'guide-restart']) {
      expect(byId(id).closest('[inert]'), id).not.toBeNull()
    }

    const card = byId('guide')
    const height = () => Math.round(card.getBoundingClientRect().height)
    const sample = async (act: () => void) => {
      const heights: number[] = []
      act()
      const start = performance.now()
      while (performance.now() - start < 500) {
        await frame()
        heights.push(height())
      }
      return heights
    }
    const collapsed = height()
    const opening = await sample(() => toggle.click())
    const open = opening.at(-1)!
    expect(open).toBeGreaterThan(collapsed + 50)
    expect(byId('guide-next').closest('[inert]')).toBeNull()
    const closing = await sample(() => toggle.click())
    const between = (heights: number[]) =>
      heights.filter(value => value > collapsed + 2 && value < open - 2).length
    expect(between(opening)).toBeGreaterThan(3)
    expect(between(closing)).toBeGreaterThan(3)
    expect(closing.at(-1)).toBe(collapsed)
    expect(byId('guide-next').closest('[inert]')).not.toBeNull()
  })

  test('SN15: «Далее» завершает шаг — значок зеленеет с конфетти, полоска к следующему плавно заливается, после неё шаг сменяется, значок нового шага «подпрыгивает» и ряд едет; пока полоска заливается, «Назад» и «Далее» неактивны', async () => {
    await render(<GuidePanelManySteps />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    // К середине ряда: дальше шаг сдвигает ряд.
    for (let i = 0; i < 3; i++) {
      await settled()
      button('guide-next').click()
    }
    await settled()
    // Конфетти и прокрутка ленты прошлого шага закончились.
    await expect.poll(confetti, { timeout: 3000 }).toHaveLength(0)
    await slideSettled()
    const badge = document.querySelector<HTMLElement>('[data-step-index="3"]')!
    const nextBadge = document.querySelector<HTMLElement>(
      '[data-step-index="4"]',
    )!
    const bar = document.querySelector<HTMLElement>('[data-step-fill="3"]')!
    const fillOf = () =>
      bar.getBoundingClientRect().width /
      bar.parentElement!.getBoundingClientRect().width
    const toggle = byId('guide-toggle')
    expect(toggle.textContent).toMatch(/шаг 4 из/)
    expect(fillOf()).toBe(0)
    const x = slideOf()

    const start = performance.now()
    button('guide-next').click()
    await frame()
    // Значок зелёный и с конфетти, шаг ещё прежний.
    expect(badge.dataset.stepState).toBe('done')
    expect(confetti().length).toBeGreaterThan(0)
    const fills: number[] = []
    let stepChangedAt = -1
    let fillDoneAt = -1
    let movedEarly = false
    let nextPopped = false
    let disabledDuring = true
    while (performance.now() - start < 3000) {
      const now = performance.now() - start
      const fill = fillOf()
      if (stepChangedAt < 0) fills.push(fill)
      if (fillDoneAt < 0 && fill > 0.99) fillDoneAt = now
      if (stepChangedAt < 0 && /шаг 5 из/.test(toggle.textContent ?? '')) {
        stepChangedAt = now
        // Значок нового шага — текущий и «подпрыгивает».
        nextPopped =
          nextBadge.dataset.stepState === 'current' &&
          nextBadge.getAnimations().length > 0
      }
      if (stepChangedAt < 0 && Math.abs(slideOf() - x) > 0.5) movedEarly = true
      if (!button('guide-next').disabled) break
      disabledDuring &&= button('guide-back').disabled
      await frame()
    }
    // Заливка плавная: промежуточные доли между пустой и полной.
    expect(
      fills.filter(fill => fill > 0.05 && fill < 0.95).length,
    ).toBeGreaterThan(3)
    expect(fillDoneAt).toBeGreaterThan(0)
    expect(stepChangedAt).toBeGreaterThanOrEqual(fillDoneAt)
    expect(movedEarly).toBe(false)
    expect(nextPopped).toBe(true)
    expect(disabledDuring).toBe(true)
    expect(toggle.textContent).toMatch(/шаг 5 из/)
    expect(fillOf()).toBeGreaterThan(0.99)
    await expect.poll(() => Math.abs(slideOf() - x)).toBeGreaterThan(100)
  })

  test('SN17: «Воспроизвести» проходит шаги само — полоска к следующему заливается всё время шага, значок до её конца текущий, затем шаг сменяется; последний шаг выполняется сразу, и воспроизведение останавливается; «Пауза» останавливает раньше и сбрасывает заливку', async () => {
    const screen = await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-play')).toBeTruthy()
    const toggle = byId('guide-toggle')
    const badge = document.querySelector<HTMLElement>('[data-step-index="0"]')!
    const bar = document.querySelector<HTMLElement>('[data-step-fill="0"]')!
    const fillOf = () =>
      bar.getBoundingClientRect().width /
      bar.parentElement!.getBoundingClientRect().width
    const start = performance.now()
    button('guide-play').click()
    await expect.poll(() => byId('guide-play').textContent).toContain('Пауза')
    // Первый шаг: полоска заливается всё время шага, значок до конца текущий.
    const fills: number[] = []
    let fillStart = -1
    let fillEnd = -1
    let currentDuring = true
    let stepChangedAt = -1
    while (performance.now() - start < 5000) {
      if (/шаг 2 из 3/.test(toggle.textContent ?? '')) {
        stepChangedAt = performance.now() - start
        break
      }
      const fill = fillOf()
      fills.push(fill)
      const now = performance.now() - start
      if (fillStart < 0 && fill > 0.05) fillStart = now
      if (fillEnd < 0 && fill > 0.95) fillEnd = now
      currentDuring &&= badge.dataset.stepState === 'current'
      await frame()
    }
    // Заливка идёт всё время шага, а не короткой вспышкой в конце.
    expect(fillEnd - fillStart).toBeGreaterThan(1000)
    expect(stepChangedAt).toBeGreaterThanOrEqual(fillEnd)
    expect(currentDuring).toBe(true)
    expect(badge.dataset.stepState).toBe('done')

    // Последний шаг ждать нечего: пройден сразу при переходе на него.
    await expect
      .poll(() => toggle.textContent, { timeout: 5000, interval: 5 })
      .toMatch(/шаг 3 из 3|пройден/)
    const lastAt = performance.now()
    await expect
      .poll(() => toggle.textContent, { timeout: 5000, interval: 5 })
      .toContain('пройден')
    expect(performance.now() - lastAt).toBeLessThan(300)
    expect(byId('guide-play').textContent).toContain('Воспроизвести')
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-step-state]')].map(
        each => each.dataset.stepState,
      ),
    ).toEqual(['done', 'done', 'done'])
    await screen.unmount()

    // «Пауза» посреди заливки — заливка сброшена, шаг не идёт.
    await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-play')).toBeTruthy()
    const firstBar = () =>
      document.querySelector<HTMLElement>('[data-step-fill="0"]')!
    const firstFill = () =>
      firstBar().getBoundingClientRect().width /
      firstBar().parentElement!.getBoundingClientRect().width
    button('guide-play').click()
    await expect.poll(firstFill).toBeGreaterThan(0.2)
    button('guide-play').click()
    await expect.poll(firstFill).toBe(0)
    await sleep(2500)
    expect(byId('guide-toggle').textContent).toContain('шаг 1 из 3')
    expect(firstFill()).toBe(0)
    expect(confetti()).toHaveLength(0)
  })

  test('SN21: при уменьшенном движении — без конфетти, сдвига ряда и анимации раскрытия: шаг сменяется сразу', async () => {
    await motion.reducedMotion(true)
    try {
      await render(<GuidePanelManySteps />)
      await expect.poll(() => byId('guide-next')).toBeTruthy()
      for (let i = 0; i < 4; i++) {
        await settled()
        button('guide-next').click()
        // Шаг сменился в пределах кадра, без конфетти и перехода ряда.
        await frame()
        await frame()
        expect(byId('guide-toggle').textContent).toContain(`шаг ${i + 2} из`)
        expect(confetti()).toHaveLength(0)
        expect(
          byId('guide-steps').querySelector('ol')!.getAnimations(),
        ).toHaveLength(0)
      }
      // Раскрытие — без перехода высоты.
      byId('guide-toggle').click()
      await frame()
      expect(document.getAnimations()).toHaveLength(0)
    } finally {
      await motion.reducedMotion(false)
    }
  })

  test('SN22: значок крайнего шага на пике «подпрыгивания» целиком внутри окна шагов и обёртки раскрытия', async () => {
    await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    const badge = document.querySelector<HTMLElement>('[data-step-index="0"]')!
    button('guide-next').click()
    await expect.poll(() => badge.getAnimations().length).toBeGreaterThan(0)
    const pop = badge.getAnimations()[0]!
    pop.pause()
    pop.currentTime = 125
    const rect = badge.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(25)
    for (
      let element = badge.parentElement;
      element;
      element = element.parentElement
    ) {
      if (getComputedStyle(element).overflow === 'visible') continue
      const clip = element.getBoundingClientRect()
      expect(rect.left).toBeGreaterThanOrEqual(clip.left)
      expect(rect.top).toBeGreaterThanOrEqual(clip.top)
      expect(rect.right).toBeLessThanOrEqual(clip.right)
    }
    for (const animation of document.getAnimations()) animation.finish()
  })
  test('SN23: «Назад» откатывает шаг — полоска плавно пустеет, после неё шаг возвращается, значок снова число и «подпрыгивает», без конфетти; из пройденного — так же к предпоследнему шагу, значок последнего снова число', async () => {
    await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    const idle = () =>
      expect
        .poll(() => document.getAnimations().length, { timeout: 3000 })
        .toBe(0)
    const toggle = byId('guide-toggle')
    // Переход на последний шаг выполняет его: сценарий пройден (SN16).
    for (let i = 0; i < 2; i++) {
      await settled()
      button('guide-next').click()
    }
    await expect.poll(() => toggle.textContent).toContain('пройден')
    await idle()
    const lastBadge = document.querySelector<HTMLElement>(
      '[data-step-index="2"]',
    )!
    expect(lastBadge.dataset.stepState).toBe('done')
    const badge = document.querySelector<HTMLElement>('[data-step-index="1"]')!
    const bar = document.querySelector<HTMLElement>('[data-step-fill="1"]')!
    const fillOf = () =>
      bar.getBoundingClientRect().width /
      bar.parentElement!.getBoundingClientRect().width
    expect(fillOf()).toBeGreaterThan(0.99)
    expect(badge.dataset.stepState).toBe('done')

    const start = performance.now()
    button('guide-back').click()
    const fills: number[] = []
    let stepBackAt = -1
    let emptyAt = -1
    let disabledDuring = true
    let pieces = 0
    while (performance.now() - start < 3000) {
      await frame()
      const now = performance.now() - start
      const fill = fillOf()
      pieces = Math.max(pieces, confetti().length)
      if (stepBackAt < 0) fills.push(fill)
      if (emptyAt < 0 && fill < 0.01) emptyAt = now
      if (stepBackAt < 0 && /шаг 2 из 3/.test(toggle.textContent ?? '')) {
        stepBackAt = now
        // Шаг вернулся: значок — число и «подпрыгивает».
        expect(badge.dataset.stepState).toBe('current')
        expect(badge.textContent).toBe('2')
        expect(badge.getAnimations().length).toBeGreaterThan(0)
        expect(lastBadge.dataset.stepState).toBe('next')
        expect(lastBadge.textContent).toBe('3')
        break
      }
      disabledDuring &&=
        button('guide-back').disabled && button('guide-next').disabled
    }
    // Полоска пустела плавно, и только потом шаг вернулся.
    expect(
      fills.filter(fill => fill > 0.05 && fill < 0.95).length,
    ).toBeGreaterThan(3)
    expect(emptyAt).toBeGreaterThan(0)
    expect(stepBackAt).toBeGreaterThanOrEqual(emptyAt)
    expect(disabledDuring).toBe(true)
    expect(pieces).toBe(0)
    await idle()

    // Снова вперёд — последний шаг выполняется опять.
    button('guide-next').click()
    await expect.poll(() => toggle.textContent).toContain('пройден')
    expect(lastBadge.dataset.stepState).toBe('done')
    // Конфетти последнего шага догорают: следующий тест считает свои.
    await idle()
    expect(confetti()).toHaveLength(0)
  })
  test('SN24: нажатие на шаг переходит к нему ускоренно — полоски между шагами заливаются (назад — пустеют) по 120 мс на шаг, без конфетти; значок выбранного «подпрыгивает», последний — пройден; шаг — кнопка; нажатие посреди перехода меняет цель', async () => {
    await render(<GuidePanelManySteps />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    const toggle = byId('guide-toggle')
    const stepButton = (index: number) =>
      document.querySelector<HTMLButtonElement>(
        `[data-step-button="${index}"]`,
      )!
    const badge = (index: number) =>
      document.querySelector<HTMLElement>(`[data-step-index="${index}"]`)!
    const fillOf = (index: number) => {
      const bar = document.querySelector<HTMLElement>(
        `[data-step-fill="${index}"]`,
      )!
      return (
        bar.getBoundingClientRect().width /
        bar.parentElement!.getBoundingClientRect().width
      )
    }
    // Шаг — кнопка, доступна с клавиатуры; имя — её видимый текст, без своей подписи.
    expect(stepButton(4).tagName).toBe('BUTTON')
    expect(stepButton(4).hasAttribute('aria-label')).toBe(false)
    expect(stepButton(4).hasAttribute('aria-labelledby')).toBe(false)

    // Вперёд на 4 шага: подряд, ускоренно, без конфетти.
    const start = performance.now()
    stepButton(4).click()
    let pieces = 0
    const order: number[] = []
    while (performance.now() - start < 3000) {
      await frame()
      pieces = Math.max(pieces, confetti().length)
      for (let index = 0; index < 4; index++) {
        if (!order.includes(index) && fillOf(index) > 0.99) order.push(index)
      }
      if (/шаг 5 из/.test(toggle.textContent ?? '')) break
    }
    const took = performance.now() - start
    expect(toggle.textContent).toMatch(/шаг 5 из/)
    expect(order).toEqual([0, 1, 2, 3])
    expect(took).toBeGreaterThan(4 * 120 - 60)
    expect(took).toBeLessThan(4 * 120 + 600)
    expect(pieces).toBe(0)
    expect(badge(4).dataset.stepState).toBe('current')
    expect(badge(4).getAnimations().length).toBeGreaterThan(0)
    for (let index = 0; index < 4; index++) {
      expect(badge(index).dataset.stepState).toBe('done')
    }
    await expect
      .poll(() => document.getAnimations().length, { timeout: 3000 })
      .toBe(0)

    // Назад через название шага: полоски пустеют, шаги снова будущие.
    stepButton(1).querySelector('strong')!.click()
    await expect
      .poll(() => toggle.textContent, { timeout: 3000 })
      .toMatch(/шаг 2 из/)
    for (let index = 1; index < 4; index++) expect(fillOf(index)).toBe(0)
    expect(badge(1).dataset.stepState).toBe('current')
    expect(badge(2).dataset.stepState).toBe('next')
    await expect
      .poll(() => document.getAnimations().length, { timeout: 3000 })
      .toBe(0)

    // Посреди перехода — новая цель: дальше идёт к ней.
    stepButton(9).click()
    await expect
      .poll(() => toggle.textContent, { timeout: 3000 })
      .toMatch(/шаг [3-5] из/)
    stepButton(6).click()
    await expect
      .poll(() => toggle.textContent, { timeout: 3000 })
      .toMatch(/шаг 7 из/)
    await sleep(500)
    expect(toggle.textContent).toMatch(/шаг 7 из/)
    await settled()

    // Нажатие на последний шаг выполняет его: сценарий пройден (SN16).
    const last = document.querySelectorAll('[data-step-index]').length - 1
    stepButton(last).click()
    await expect
      .poll(() => toggle.textContent, { timeout: 5000 })
      .toContain('пройден')
    expect(badge(last).dataset.stepState).toBe('done')
  })
  test('SN25: шаги одной высоты — по самому высокому; при наведении шаг подсвечен тусклой подложкой на всю высоту, без наведения подложки нет', async () => {
    await render(<GuidePanelManySteps />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    const buttons = [
      ...document.querySelectorAll<HTMLElement>('[data-step-button]'),
    ]
    // Тексты разной длины: по содержимому шаги были бы разной высоты.
    const contentHeights = buttons.map(button =>
      [...button.children].reduce(
        (sum, child) => sum + child.getBoundingClientRect().height,
        0,
      ),
    )
    expect(
      Math.max(...contentHeights) - Math.min(...contentHeights),
    ).toBeGreaterThan(10)
    const heights = buttons.map(button =>
      Math.round(button.getBoundingClientRect().height),
    )
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toBeGreaterThanOrEqual(Math.max(...contentHeights))

    const backgroundOf = (element: HTMLElement) =>
      getComputedStyle(element).backgroundColor
    const transparent = 'rgba(0, 0, 0, 0)'
    expect(backgroundOf(buttons[2]!)).toBe(transparent)
    await userEvent.hover(buttons[2]!)
    await expect.poll(() => backgroundOf(buttons[2]!)).not.toBe(transparent)
    expect(backgroundOf(buttons[3]!)).toBe(transparent)
    await userEvent.unhover(buttons[2]!)
    await expect.poll(() => backgroundOf(buttons[2]!)).toBe(transparent)
  })
})
