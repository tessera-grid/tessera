import { composeStories } from '@storybook/react'
import { commands, page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'
import { humanClick } from '../helpers'

import * as contextMenuStories from '../../DataGrid.Cells.ContextMenu.stories'
import * as editingStories from '../../DataGrid.Cells.Editing.stories'
import * as skeletonStories from '../../DataGrid.DataLoading.Skeleton.stories'
import * as visibilityStories from '../../DataGrid.Columns.Visibility.stories'
import * as stories from '../../GuidePanel.dev.stories'
import {
  type GuideStoryStep,
  GuideStory,
  guideArgs,
  stepAction,
} from '../../demos/GuideStory'
import {
  afterRows,
  centerOf,
  dragHold,
  pollUntil,
  pressEscape,
  repeat,
  shieldHeldDrag,
} from '../../__mocks__/catalogPlay'
import { pressCell, untilDone } from '../../__mocks__/cellGestures'
import { HANDLE, ROW, rowIdOrder } from '../../rowDragging.dnd'
import { openViewSettingsSection } from '../../__mocks__/viewSettings'

// Панель гайда историй (ADR 0117, SN14–SN15, SN17, SN21–SN27, SN33–SN35, SN40–SN58, SN69) — с
// движением: каталог гоняет истории с уменьшенным движением, и порядок конфетти и сдвига
// виден только здесь. SN16, SN18–SN20 — в `play` песочницы `Tessera/Common/Guide panel`.

const { GuidePanelCollapsed, GuidePanelManySteps, GuidePanelPlayground } =
  composeStories(stories)
const { SkeletonDataArrives } = composeStories(skeletonStories)
const { ColumnVisibilityToggleAll } = composeStories(visibilityStories)
const { EditingSession } = composeStories(editingStories)
const { ContextMenuCancelFromMenu } = composeStories(contextMenuStories)

interface Point {
  x: number
  y: number
}

const motion = commands as unknown as {
  reducedMotion: (reduce: boolean) => Promise<void>
}
const pointer = commands as unknown as {
  realWheel: (
    at: Point,
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
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
  test('SN69: при открытом контекстном меню шага первое нажатие на панель гайда срабатывает и закрывает меню', async () => {
    const screen = await render(<ContextMenuCancelFromMenu />)
    try {
      const menu = () => document.querySelector('[role="menu"]')
      await humanClick(byId('guide-toggle'))
      await sleep(600)
      for (const step of ['2 из 4', '3 из 4']) {
        await expect
          .poll(() => button('guide-next').disabled, { timeout: 8000 })
          .toBe(false)
        await humanClick(button('guide-next'))
        await expect
          .poll(() => byId('guide').textContent, { timeout: 8000 })
          .toContain(step)
      }
      await expect.poll(menu, { timeout: 8000 }).not.toBeNull()
      await expect
        .poll(() => button('guide-next').disabled, { timeout: 8000 })
        .toBe(false)

      await humanClick(byId('guide-toggle'))
      expect(byId('guide-toggle').getAttribute('aria-expanded')).toBe('false')
      await expect.poll(menu).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SN35: нажатие мышью на панель гайда не забирает фокус у таблицы — открытая правка не сохраняется потерей фокуса', async () => {
    const screen = await render(<EditingSession />)
    try {
      const input = () =>
        document.querySelector<HTMLInputElement>(
          '.data-grid__body-row[data-row-id="item-id-0"] .data-grid__body-cell[data-column-id="age"] input',
        )
      await expect.poll(() => input()?.value).toBe('55')
      input()!.focus()
      await humanClick(byId('guide-toggle'))
      await expect
        .poll(() => byId('guide-toggle').getAttribute('aria-expanded'))
        .toBe('true')
      expect(document.activeElement).toBe(input())
      // Панель раскрывается переходом высоты: кнопка «Далее» — на своём месте после него.
      await sleep(600)
      await expect.poll(() => button('guide-next').disabled).toBe(false)
      await humanClick(button('guide-next'))
      await expect
        .poll(() => byId('guide').textContent, { timeout: 5000 })
        .toContain('2 из 4')
      // Черновик не сохранён: поле открыто, фокус — в нём.
      expect(input()?.value).toBe('55')
      expect(document.activeElement).toBe(input())
    } finally {
      await screen.unmount()
    }
  })

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

  test('SN17: «Воспроизвести» проходит шаги само — полоска к следующему заливается всё время шага, значок до её конца текущий, затем шаг сменяется; последний шаг выполняется сразу, и воспроизведение останавливается; «Пауза» останавливает раньше — заливка замирает на месте, «Воспроизвести» продолжает её с того же места; «Далее» доливает её с того же места', async () => {
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

    // «Пауза» посреди заливки — заливка замирает на месте, шаг не идёт.
    const pausedScreen = await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-play')).toBeTruthy()
    const firstBar = () =>
      document.querySelector<HTMLElement>('[data-step-fill="0"]')!
    const firstFill = () =>
      firstBar().getBoundingClientRect().width /
      firstBar().parentElement!.getBoundingClientRect().width
    button('guide-play').click()
    await expect.poll(firstFill, { interval: 5 }).toBeGreaterThan(0.4)
    button('guide-play').click()
    await frame()
    const paused = firstFill()
    expect(paused).toBeGreaterThan(0.4)
    await sleep(2500)
    expect(byId('guide-toggle').textContent).toContain('шаг 1 из 3')
    expect(byId('guide-play').textContent).toContain('Воспроизвести')
    expect(Math.abs(firstFill() - paused)).toBeLessThan(0.02)
    expect(confetti()).toHaveLength(0)

    // «Воспроизвести» продолжает с того же места: заливка не начинается заново, и
    // шаг сменяется за оставшуюся долю шага, а не за целый.
    const resumed = performance.now()
    button('guide-play').click()
    let restartedFromZero = false
    while (!/шаг 2 из 3/.test(byId('guide-toggle').textContent ?? '')) {
      if (performance.now() - resumed > 5000) break
      if (firstFill() < paused - 0.02) restartedFromZero = true
      await frame()
    }
    const resumeTook = performance.now() - resumed
    expect(restartedFromZero).toBe(false)
    expect(byId('guide-toggle').textContent).toContain('шаг 2 из 3')
    expect(resumeTook).toBeLessThan(1500 * (1 - paused) + 400)
    await expect.poll(confetti, { timeout: 3000 }).toHaveLength(0)
    await pausedScreen.unmount()

    // «Далее» после паузы доливает полоску с того же места.
    const view = await render(<GuidePanelPlayground />)
    await expect.poll(() => byId('guide-play')).toBeTruthy()
    button('guide-play').click()
    await expect.poll(firstFill, { interval: 5 }).toBeGreaterThan(0.4)
    button('guide-play').click()
    await frame()
    const from = firstFill()
    button('guide-next').click()
    let dropped = false
    const started = performance.now()
    while (!/шаг 2 из 3/.test(byId('guide-toggle').textContent ?? '')) {
      if (performance.now() - started > 3000) break
      if (firstFill() < from - 0.02) dropped = true
      await frame()
    }
    expect(dropped).toBe(false)
    expect(byId('guide-toggle').textContent).toContain('шаг 2 из 3')
    // Конфетти пройденного шага догорают: следующий тест начинает без них.
    await expect.poll(confetti, { timeout: 3000 }).toHaveLength(0)
    await view.unmount()
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
  test('SN24: нажатие на шаг переходит к нему сразу — шаги до него пройдены, после — будущие, без заливки полосок, конфетти и «подпрыгивания», лента без плавности; последний — пройден; переход «Далее» и воспроизведение прерываются; шаг — кнопка', async () => {
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
    const states = () =>
      [...document.querySelectorAll<HTMLElement>('[data-step-state]')].map(
        each => each.dataset.stepState,
      )
    const statesAt = (step: number, count: number) =>
      Array.from({ length: count }, (_, index) =>
        index < step ? 'done' : index === step ? 'current' : 'next',
      )
    // Анимации значков и полосок: подпрыгивание, заливка, откат.
    const stepAnimations = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-step-index], [data-step-fill]',
        ),
      ].flatMap(element => element.getAnimations())
    const idle = () =>
      expect
        .poll(() => document.getAnimations().length, { timeout: 3000 })
        .toBe(0)
    const count = states().length
    // Шаг — кнопка, доступна с клавиатуры; имя — её видимый текст, без своей подписи.
    expect(stepButton(4).tagName).toBe('BUTTON')
    expect(stepButton(4).hasAttribute('aria-label')).toBe(false)
    expect(stepButton(4).hasAttribute('aria-labelledby')).toBe(false)

    // Вперёд на 4 шага — за один кадр, без заливки, конфетти и подпрыгивания.
    await idle()
    const before = slideOf()
    stepButton(4).click()
    await frame()
    expect(toggle.textContent).toMatch(/шаг 5 из/)
    expect(states()).toEqual(statesAt(4, count))
    for (let index = 0; index < 4; index++) {
      expect(fillOf(index)).toBeGreaterThan(0.99)
    }
    expect(fillOf(4)).toBe(0)
    expect(confetti()).toHaveLength(0)
    expect(stepAnimations()).toHaveLength(0)
    // Лента уже у нового шага и дальше не едет.
    const x = slideOf()
    expect(x).not.toBe(before)
    await frame()
    await frame()
    expect(slideOf()).toBe(x)

    // Назад через название шага настоящим нажатием: полоски пусты, шаги снова будущие.
    await userEvent.click(stepButton(1).querySelector('strong')!)
    expect(toggle.textContent).toMatch(/шаг 2 из/)
    expect(states()).toEqual(statesAt(1, count))
    for (let index = 1; index < 4; index++) expect(fillOf(index)).toBe(0)
    expect(confetti()).toHaveLength(0)
    expect(stepAnimations()).toHaveLength(0)

    // Посреди заливки «Далее» — нажатие на шаг прерывает её, шаг дальше не меняется.
    await idle()
    button('guide-next').click()
    await frame()
    expect(byId('guide').dataset.busy).toBe('true')
    stepButton(6).click()
    await frame()
    expect(toggle.textContent).toMatch(/шаг 7 из/)
    expect(states()).toEqual(statesAt(6, count))
    // Значок, пройденный «Далее», доигрывает её подпрыгивание — оно не от перехода.
    expect(
      stepAnimations().filter(
        animation => (animation.effect as KeyframeEffect).target !== badge(1),
      ),
    ).toHaveLength(0)
    await sleep(400)
    expect(toggle.textContent).toMatch(/шаг 7 из/)
    expect(button('guide-next').disabled).toBe(false)

    // Посреди воспроизведения — нажатие на шаг останавливает его.
    await idle()
    button('guide-play').click()
    await expect.poll(() => fillOf(6), { interval: 5 }).toBeGreaterThan(0.1)
    stepButton(2).click()
    await frame()
    expect(toggle.textContent).toMatch(/шаг 3 из/)
    expect(byId('guide-play').textContent).toContain('Воспроизвести')
    expect(stepAnimations()).toHaveLength(0)
    await sleep(1700)
    expect(toggle.textContent).toMatch(/шаг 3 из/)

    // Нажатие на последний шаг выполняет его сразу и без конфетти (SN16).
    await idle()
    stepButton(count - 1).click()
    await frame()
    expect(toggle.textContent).toContain('пройден')
    expect(states()).toEqual(statesAt(count, count))
    expect(button('guide-next').disabled).toBe(true)
    expect(confetti()).toHaveLength(0)
    expect(stepAnimations()).toHaveLength(0)
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
  test('SN26: конфетти летят от значка пройденного шага — лента едет к новому шагу посреди полёта, частицы смещаются вместе со значком', async () => {
    await render(<GuidePanelManySteps />)
    await expect.poll(() => byId('guide-next')).toBeTruthy()
    // К середине ряда: дальше шаг сдвигает ленту.
    for (let i = 0; i < 3; i++) {
      await settled()
      button('guide-next').click()
    }
    await settled()
    await expect.poll(confetti, { timeout: 3000 }).toHaveLength(0)
    await slideSettled()
    const badge = document.querySelector<HTMLElement>('[data-step-index="3"]')!
    const centerX = () => {
      const { left, width } = badge.getBoundingClientRect()
      return left + width / 2
    }
    const startX = centerX()
    button('guide-next').click()
    let moved = 0
    let drift = 0
    let samples = 0
    while (confetti().length > 0) {
      // После всех колбэков кадра: частицы и лента — в одном кадре.
      await frame()
      await sleep(0)
      const pieces = confetti() as HTMLElement[]
      if (!pieces.length) break
      const x = centerX()
      moved = Math.max(moved, Math.abs(x - startX))
      for (const piece of pieces) {
        drift = Math.max(drift, Math.abs(parseFloat(piece.style.left) + 3 - x))
      }
      samples++
    }
    // Лента уехала, пока частицы летели, а их точка вылета осталась у значка.
    expect(samples).toBeGreaterThan(5)
    expect(moved).toBeGreaterThan(20)
    expect(drift).toBeLessThan(1.5)
  })

  test('SN27: история сценария со скрытыми контролами не берёт функции из оставшихся аргументов Storybook — линии дерева и колонка раскрытия появляются только на своих шагах', async () => {
    await motion.reducedMotion(true)
    try {
      // Аргументы, оставшиеся в URL с тех пор, как у истории были контролы.
      await render(<SkeletonDataArrives enableTreeLines enableRowExpanding />)
      await expect.poll(() => byId('guide-next')).toBeTruthy()
      byId('guide-toggle').click()
      const elbows = () =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '.data-grid__body-cell--skeleton span[class]',
          ),
        ].filter(part => /elbow/i.test(part.className)).length
      const expandColumn = () =>
        document.querySelector('[data-column-id*="rowExpanding"]')
      const goTo = async (step: number) => {
        button('guide-next').click()
        await expect
          .poll(() => byId('guide-toggle').textContent)
          .toContain(`шаг ${step} из`)
      }
      await goTo(2)
      // «Иерархия данных»: подстроки есть, линий и колонки раскрытия ещё нет.
      await goTo(3)
      await expect
        .poll(
          () =>
            document.querySelectorAll('.data-grid__body-row--skeleton').length,
        )
        .toBeGreaterThan(0)
      expect(elbows()).toBe(0)
      expect(expandColumn()).toBeNull()
      // «Линии дерева» — линии появились, колонки раскрытия ещё нет.
      await goTo(4)
      await expect.poll(elbows).toBeGreaterThan(0)
      expect(expandColumn()).toBeNull()
      await goTo(5)
      await expect.poll(expandColumn).not.toBeNull()
    } finally {
      await motion.reducedMotion(false)
    }
  })

  test('SN33: «Назад» и нажатие на прошлый шаг возвращают таблицу в состояние этого шага, даже если отменённый шаг выполнил действие', async () => {
    await motion.reducedMotion(true)
    try {
      // «Toggle all»: шаг 2 снимает флажок всех колонок — таблица уходит в заглушку.
      await render(<ColumnVisibilityToggleAll />)
      await expect.poll(() => byId('guide-next')).toBeTruthy()
      byId('guide-toggle').click()
      const stub = () =>
        document.querySelector('[data-testid="columns-hidden-stub"]')
      const rows = () =>
        document.querySelectorAll('.data-grid__body-row').length
      const stepButton = (index: number) =>
        document.querySelector<HTMLButtonElement>(
          `[data-step-button="${index}"]`,
        )!
      const toHidden = async () => {
        stepButton(1).click()
        await expect.poll(stub).not.toBeNull()
        expect(rows()).toBe(0)
      }
      await expect.poll(rows).toBeGreaterThan(0)

      await toHidden()
      byId('guide-back').click()
      await expect.poll(rows).toBeGreaterThan(0)
      expect(stub()).toBeNull()

      await toHidden()
      stepButton(0).click()
      await expect.poll(rows).toBeGreaterThan(0)
      expect(stub()).toBeNull()
    } finally {
      await motion.reducedMotion(false)
    }
  })

  test('SN34: свёрнутая панель показывает прогресс линией по нижнему краю — доля шаг / (шагов − 1), пройденный — вся; воспроизведение заливает её вместе с шагом в реальном времени, пауза замораживает; перезапуск без отката; в раскрытой линии нет', async () => {
    await render(<GuidePanelPlayground stepCount={3} expanded={false} />)
    await expect.poll(() => byId('guide-progress')).toBeTruthy()
    const bar = () => byId('guide-progress')
    const layer = () => bar().parentElement!.parentElement!
    const share = () =>
      bar().getBoundingClientRect().width /
      bar().parentElement!.getBoundingClientRect().width
    const panel = byId('guide').getBoundingClientRect()
    // Линия — у нижнего края панели, во всю её ширину.
    const track = bar().parentElement!.getBoundingClientRect()
    expect(track.height).toBe(2)
    expect(Math.round(panel.bottom - track.bottom)).toBeLessThanOrEqual(1)
    expect(Math.round(track.width)).toBe(Math.round(panel.width) - 2)
    expect(getComputedStyle(bar()).backgroundColor).not.toBe(
      getComputedStyle(bar().parentElement!).backgroundColor,
    )
    expect(share()).toBe(0)
    expect(getComputedStyle(layer()).opacity).toBe('1')

    // Воспроизведение в свёрнутой панели: линия растёт посреди шага, а не скачком.
    byId('guide-play').click()
    await expect.poll(share).toBeGreaterThan(0.1)
    expect(byId('guide-toggle').textContent).toContain('шаг 1 из 3')
    const [running] = bar().getAnimations()
    expect(running!.effect!.getComputedTiming().duration).toBe(1500)
    // «Пауза» замораживает линию на месте.
    byId('guide-play').click()
    // Пауза встаёт со следующего кадра.
    await sleep(100)
    const frozen = share()
    await sleep(300)
    expect(share()).toBeCloseTo(frozen, 3)
    // Продолжение — с того же места, до конца сценария.
    byId('guide-play').click()
    await expect
      .poll(() => byId('guide-toggle').textContent, { timeout: 8000 })
      .toContain('пройден')
    expect(share()).toBeCloseTo(1, 2)

    // Перезапуск: линия сразу пустая, без отката.
    byId('guide-play').click()
    await expect.poll(() => bar().getAnimations()).toEqual([])
    await expect.poll(() => byId('guide-toggle').textContent).toContain('шаг 1')
    expect(share()).toBeLessThan(0.05)
    byId('guide-play').click()

    // Раскрытая панель — без линии.
    byId('guide-toggle').click()
    await expect.poll(() => getComputedStyle(layer()).opacity).toBe('0')

    // Уменьшенное движение — без заливки: линия меняется сразу.
    await motion.reducedMotion(true)
    try {
      await render(<GuidePanelPlayground stepCount={3} expanded={false} />)
      await expect.poll(() => byId('guide-progress')).toBeTruthy()
      byId('guide-play').click()
      await expect
        .poll(() => byId('guide-toggle').textContent, { timeout: 8000 })
        .toContain('шаг 2')
      expect(bar().getAnimations()).toEqual([])
      expect(share()).toBeCloseTo(0.5, 2)
    } finally {
      await motion.reducedMotion(false)
    }
  })
})

// Стенд вмешательства (SN40–SN43): шаг 1 — действие нажимает ячейку и клавишу, когда
// появились строки (не `stepAction`: его ввод гасит щит SN43), шаг 2 — без действия,
// шаг 3 — действие идёт, пока тест его не отпустит.
const run = { enters: 0, pending: false, release: false }
const INPUT_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица открыта',
    hint: 'Действие шага нажимает ячейку и клавишу.',
    enter: root => {
      run.enters++
      run.pending = true
      const timer = setInterval(() => {
        const cell = root.querySelector<HTMLElement>('.data-grid__body-cell')
        if (!cell) return
        clearInterval(timer)
        cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        )
        cell.click()
        run.pending = false
      }, 16)
      return () => clearInterval(timer)
    },
  },
  { title: 'Без действия', hint: 'Шаг только показывает таблицу.' },
  {
    title: 'Действие идёт',
    hint: 'Действие ждёт, пока тест его отпустит.',
    enter: stepAction(async (_root, step) => {
      await pollUntil(() => run.release, step.signal, 60_000)
    }),
  },
]

const InputGuide = () => (
  <GuideStory
    title="Ввод человека"
    steps={INPUT_STEPS}
    args={guideArgs(
      { dataCount: 200, height: 320, enableColumnVisibility: true },
      { colorMode: 'light', locale: 'en' },
    )}
  />
)

const guideRoot = () =>
  document.querySelector<HTMLElement>('[data-guide-root]')!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const changed = () => document.querySelector('[data-testid="guide-changed"]')
const bodyCell = () =>
  document.querySelector<HTMLElement>(
    `${ROW}[data-index="1"] .data-grid__body-cell`,
  )!
const visibilityButton = () =>
  document.querySelector<HTMLElement>('[data-testid="view-settings-button"]')!
const visibilityMenu = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="column-visibility-menu"][data-open]',
  )
const wheelTable = (deltaY: number) =>
  pointer.realWheel(centerOf(scroller()), deltaY, 3, 30)
const stepText = () => byId('guide-toggle').textContent ?? ''
/** Таблица открылась, и действие первого шага нажало ячейку и клавишу. */
const opened = async () => {
  await expect
    .poll(() => document.querySelectorAll(ROW).length)
    .toBeGreaterThan(0)
  await expect.poll(() => run.pending).toBe(false)
}
const expandGuide = async () => {
  byId('guide-toggle').click()
  // Раскрытие — переходом высоты: кнопки на своих местах после него.
  await sleep(600)
}

describe('ввод человека посреди гайда (ADR 0117)', () => {
  test('SN40: настоящий ввод в таблицу, её поповер и клавиша ставят пометку «Таблица изменена» с «Вернуть шаг» и в свёрнутой панели; наведение, Tab, колесо без прокрутки, панель и ввод действия шага — нет', async () => {
    run.release = false
    const screen = await render(<InputGuide />)
    try {
      await opened()
      // Действие шага уже нажало ячейку и клавишу — синтетически.
      await userEvent.hover(bodyCell())
      await humanClick(byId('guide-toggle'))
      await humanClick(byId('guide-toggle'))
      visibilityButton().focus()
      await userEvent.keyboard('{Tab}')
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
      // Колесо вверх у верхнего края таблицу не прокручивает.
      await wheelTable(-120)
      await sleep(300)
      expect(scroller().scrollTop).toBe(0)
      expect(changed()).toBeNull()

      // Колесо, прокрутившее таблицу: пометка в свёрнутой панели.
      expect(byId('guide-toggle').getAttribute('aria-expanded')).toBe('false')
      await wheelTable(200)
      await expect.poll(changed).not.toBeNull()
      expect(scroller().scrollTop).toBeGreaterThan(0)
      expect(changed()!.textContent).toBe('Таблица изменена')
      expect(byId('guide-restore').textContent).toContain('Вернуть шаг')
      expect(byId('guide-restore').closest('[inert]')).toBeNull()
      await humanClick(byId('guide-restore'))
      await expect.poll(changed).toBeNull()
      await opened()

      // Меню, открытое не человеком, пометки не ставит; нажатие в нём (портал) — ставит.
      await expect
        .poll(() => {
          if (!visibilityMenu()) openViewSettingsSection(document, 'columns')
          return !!visibilityMenu()
        })
        .toBe(true)
      expect(changed()).toBeNull()
      await userEvent.click(
        visibilityMenu()!.querySelector<HTMLElement>(
          '[data-column-id] [role="checkbox"]',
        )!,
      )
      await expect.poll(changed).not.toBeNull()
      await humanClick(byId('guide-restore'))
      await expect.poll(changed).toBeNull()
      await opened()

      // Клавиша в таблице. Человек взялся за клавиатуру — фокус дальше его (SN58).
      await userEvent.keyboard('{Shift}')
      visibilityButton().focus()
      await userEvent.keyboard('{ArrowDown}')
      await expect.poll(changed).not.toBeNull()
      await humanClick(byId('guide-restore'))
      await expect.poll(changed).toBeNull()
      await opened()

      // Нажатие в таблице.
      await userEvent.click(bodyCell())
      await expect.poll(changed).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SN41: после пометки «Далее», «Назад», нажатие на шаг и «Вернуть шаг» открывают таблицу заново и выполняют действие шага; переход и «Сначала» снимают пометку', async () => {
    run.release = false
    const screen = await render(<InputGuide />)
    try {
      await opened()
      await expandGuide()
      const scrollTable = async () => {
        await wheelTable(200)
        await expect.poll(changed).not.toBeNull()
        expect(scroller().scrollTop).toBeGreaterThan(0)
      }
      const fresh = async () => {
        await expect.poll(() => scroller()?.scrollTop).toBe(0)
        expect(changed()).toBeNull()
      }

      // «Далее» на шаг без действия: таблица заново, а не прокрученная.
      await scrollTable()
      button('guide-next').click()
      await expect.poll(stepText).toContain('шаг 2 из 3')
      await fresh()

      // «Назад» — заново и с действием целевого шага.
      await scrollTable()
      const enters = run.enters
      button('guide-back').click()
      await expect.poll(stepText).toContain('шаг 1 из 3')
      await fresh()
      await expect.poll(() => run.enters).toBeGreaterThan(enters)
      await opened()

      // «Вернуть шаг» — заново, с действием текущего шага.
      await scrollTable()
      const restoring = run.enters
      byId('guide-restore').click()
      await fresh()
      await expect.poll(() => run.enters).toBeGreaterThan(restoring)
      await opened()

      // Нажатие на шаг.
      await scrollTable()
      document.querySelector<HTMLElement>('[data-step-button="1"]')!.click()
      await expect.poll(stepText).toContain('шаг 2 из 3')
      await fresh()

      // «Сначала».
      await scrollTable()
      byId('guide-restart').click()
      await expect.poll(stepText).toContain('шаг 1 из 3')
      await fresh()
    } finally {
      await screen.unmount()
    }
  })

  test('SN42: пометка во время воспроизведения ставит его на паузу — заливка замирает, шаг не меняется; «Воспроизвести» продолжает, и переход открывает таблицу заново', async () => {
    run.release = false
    const screen = await render(<InputGuide />)
    try {
      await opened()
      const share = () => {
        const bar = byId('guide-progress')
        return (
          bar.getBoundingClientRect().width /
          bar.parentElement!.getBoundingClientRect().width
        )
      }
      byId('guide-play').click()
      await expect.poll(share, { interval: 5 }).toBeGreaterThan(0.1)
      await wheelTable(200)
      await expect.poll(changed).not.toBeNull()
      expect(byId('guide-play').textContent).toContain('Воспроизвести')
      await sleep(100)
      const paused = share()
      await sleep(2000)
      expect(stepText()).toContain('шаг 1 из 3')
      expect(share()).toBeCloseTo(paused, 2)

      byId('guide-play').click()
      await expect.poll(stepText, { timeout: 5000 }).toContain('шаг 2 из 3')
      byId('guide-play').click()
      await expect.poll(() => scroller()?.scrollTop).toBe(0)
      expect(changed()).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SN43: пока действие шага идёт, нажатие, колесо и клавиша в таблице до неё не доходят и пометки не ставят; когда дошло — доходят', async () => {
    run.release = false
    const screen = await render(<InputGuide />)
    try {
      await opened()
      await expandGuide()
      document.querySelector<HTMLElement>('[data-step-button="2"]')!.click()
      await expect
        .poll(() => guideRoot().getAttribute('data-step-action'))
        .toBe('running')

      await wheelTable(200)
      await userEvent.click(visibilityButton())
      visibilityButton().focus()
      await userEvent.keyboard('{Enter}')
      await sleep(500)
      expect(scroller().scrollTop).toBe(0)
      expect(visibilityMenu()).toBeNull()
      expect(changed()).toBeNull()

      run.release = true
      await expect
        .poll(() => guideRoot().getAttribute('data-step-action'))
        .toBe('done:2')
      await wheelTable(200)
      await expect.poll(changed).not.toBeNull()
      expect(scroller().scrollTop).toBeGreaterThan(0)
    } finally {
      run.release = true
      await screen.unmount()
    }
  })

  test('SN44: удержание перетаскивания действием шага прокручивает страницу к ручке — таблица за краем окна бросок не сдвигает', async () => {
    const args = guideArgs(
      { dataCount: 30, height: 400, enableRowDragging: true },
      { colorMode: 'light', locale: 'en' },
    )
    const steps: readonly GuideStoryStep[] = [{ title: 'Строки', hint: '' }]
    const rowAt = (index: number) =>
      document.querySelector<HTMLElement>(`${ROW}[data-index="${index}"]`)!
    /**
     * Строку 0 держат у нижнего края строки 3 и бросают; порядок строк после броска.
     * Не над центром: центр — граница «до» и «после», бросок на ней перескакивает.
     */
    const drop = async () => {
      const screen = await render(
        <GuideStory title="Бросок" steps={steps} args={args} />,
      )
      try {
        await expect
          .poll(() => document.querySelectorAll(HANDLE).length)
          .toBeGreaterThan(3)
        const handle = rowAt(0).querySelector<HTMLElement>(HANDLE)!
        const held = await dragHold(handle, {
          x: centerOf(handle).x,
          y: rowAt(3).getBoundingClientRect().bottom - 1,
        })
        const box = handle.getBoundingClientRect()
        const inView = box.top >= 0 && box.bottom <= window.innerHeight
        held.release()
        await sleep(600)
        return { order: rowIdOrder(document.body), inView }
      } finally {
        await screen.unmount()
      }
    }
    const plain = await drop()
    expect(plain.order.indexOf('item-id-0')).toBeGreaterThan(0)

    const spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.prepend(spacer)
    try {
      window.scrollTo(0, 0)
      const scrolled = await drop()
      expect(scrolled.inView).toBe(true)
      expect(scrolled.order).toEqual(plain.order)
    } finally {
      spacer.remove()
      window.scrollTo(0, 0)
    }
  })

  test('SN70: пока шаг держит перетаскивание, колесо человека не прокручивает ни страницу, ни таблицу — бросок приходится на цель шага', async () => {
    const args = guideArgs(
      { dataCount: 30, height: 400, enableRowDragging: true },
      { colorMode: 'light', locale: 'en' },
    )
    const steps: readonly GuideStoryStep[] = [{ title: 'Строки', hint: '' }]
    const rowAt = (index: number) =>
      document.querySelector<HTMLElement>(`${ROW}[data-index="${index}"]`)!
    /** Строку 0 держат у нижнего края строки 3, `during` — пока держат; порядок после броска. */
    const drop = async (during: () => Promise<void>) => {
      const screen = await render(
        <GuideStory title="Бросок" steps={steps} args={args} />,
      )
      try {
        await expect
          .poll(() => document.querySelectorAll(HANDLE).length)
          .toBeGreaterThan(3)
        const handle = rowAt(0).querySelector<HTMLElement>(HANDLE)!
        const lift = shieldHeldDrag()
        try {
          const held = await dragHold(handle, {
            x: centerOf(handle).x,
            y: rowAt(3).getBoundingClientRect().bottom - 1,
          })
          await during()
          held.release()
        } finally {
          lift()
        }
        await sleep(600)
        return rowIdOrder(document.body)
      } finally {
        await screen.unmount()
      }
    }
    // Страница с прокруткой: колесо без щита увело бы таблицу из-под точки удержания.
    const spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.prepend(spacer)
    try {
      window.scrollTo(0, 0)
      const plain = await drop(async () => {})
      expect(plain.indexOf('item-id-0')).toBeGreaterThan(0)
      // Удержание само подводит ручку в окно (SN44): сравнивается прокрутка до колеса и после.
      const moved: { page: number; table: number }[] = []
      const order = await drop(async () => {
        const page = window.scrollY
        const table = scroller().scrollTop
        await pointer.realWheel({ x: 4, y: 4 }, -400, 3, 30)
        await wheelTable(400)
        await sleep(200)
        moved.push({
          page: window.scrollY - page,
          table: scroller().scrollTop - table,
        })
      })
      expect(moved).toEqual([{ page: 0, table: 0 }])
      expect(order).toEqual(plain)
    } finally {
      spacer.remove()
      window.scrollTo(0, 0)
    }
  })

  test('SN45: событие действия шага ячейке вне вида таблицы ждёт прокрутки к ней и доходит в прежнем порядке с координатами по новому месту; ячейке в виду — сразу', async () => {
    const args = guideArgs(
      { dataCount: 30, columnCount: 20, height: 300 },
      { colorMode: 'light', locale: 'en' },
    )
    const steps: readonly GuideStoryStep[] = [{ title: 'Таблица', hint: '' }]
    const screen = await render(
      <GuideStory title="Цель вне вида" steps={steps} args={args} />,
    )
    const cells = () => [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__body-row [data-column-id]',
      ),
    ]
    const centerHit = (cell: HTMLElement) => {
      const box = cell.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return !!hit && cell.contains(hit)
    }
    const scroller = () =>
      document.querySelector<HTMLElement>('.data-grid__container')!
    try {
      await expect.poll(() => cells().length).toBeGreaterThan(20)
      // Ячейка в виду: событие доходит, пока идёт dispatchEvent.
      const near = cells().find(centerHit)!
      let nearHit = false
      near.addEventListener('click', () => (nearHit = true), { once: true })
      near.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(nearHit).toBe(true)

      // Смонтированная ячейка ниже и правее видимой части.
      const far = cells()
        .filter(cell => !centerHit(cell))
        .sort(
          (a, b) =>
            b.getBoundingClientRect().bottom +
            b.getBoundingClientRect().right -
            (a.getBoundingClientRect().bottom +
              a.getBoundingClientRect().right),
        )[0]!
      const before = far.getBoundingClientRect()
      expect(before.bottom).toBeGreaterThan(
        scroller().getBoundingClientRect().bottom,
      )
      const order: string[] = []
      const points: { x: number; y: number }[] = []
      for (const type of ['pointerover', 'mouseover', 'contextmenu'])
        far.addEventListener(type, event => {
          order.push(type)
          const { clientX: x, clientY: y } = event as MouseEvent
          points.push({ x, y })
        })
      const at = {
        bubbles: true,
        cancelable: true,
        clientX: before.left + 10,
        clientY: before.top + 10,
      }
      far.dispatchEvent(new PointerEvent('pointerover', at))
      far.dispatchEvent(new MouseEvent('mouseover', at))
      far.dispatchEvent(new MouseEvent('contextmenu', { ...at, button: 2 }))
      expect(order).toEqual([])
      await expect
        .poll(() => order)
        .toEqual(['pointerover', 'mouseover', 'contextmenu'])
      expect(centerHit(far)).toBe(true)
      expect(scroller().scrollTop).toBeGreaterThan(0)
      expect(scroller().scrollLeft).toBeGreaterThan(0)
      // Координаты — по новому месту ячейки.
      const cell = far.getBoundingClientRect()
      for (const point of points) {
        expect(Math.abs(point.x - cell.left - 10)).toBeLessThanOrEqual(1)
        expect(Math.abs(point.y - cell.top - 10)).toBeLessThanOrEqual(1)
      }
    } finally {
      await screen.unmount()
    }
  })
})

// Стенд остановки шага вводом человека (SN66–SN68).
const loop = { acts: 0, clicks: 0, leaking: false }
const cellOfRow = (index: number) =>
  document.querySelector<HTMLElement>(
    `${ROW}[data-index="${index}"] [data-column-id="country"]`,
  )!
const STOP_ARGS = guideArgs(
  { dataCount: 10, columnCount: 6 },
  { colorMode: 'light', locale: 'en' },
)
const tableTop = () =>
  document.querySelector('.data-grid__container')!.getBoundingClientRect().top

describe('остановка шага вводом человека (ADR 0117)', () => {
  test('SN66: ввод человека останавливает действие шага — цикл шага больше не действует, задержанный щелчок шага не доходит, показ нажатия снят', async () => {
    loop.acts = 0
    const looping = await render(
      <GuideStory
        title="Цикл шага"
        steps={[
          {
            title: 'Цикл',
            hint: '',
            enter: untilDone(
              () => false,
              () => {
                loop.acts++
              },
            ),
          },
        ]}
        args={STOP_ARGS}
      />,
    )
    try {
      await expect.poll(() => loop.acts).toBeGreaterThan(2)
      await userEvent.click(cellOfRow(1))
      await expect.poll(changed).not.toBeNull()
      const acts = loop.acts
      await sleep(500)
      expect(loop.acts).toBe(acts)
    } finally {
      await looping.unmount()
    }

    const clicks: Event[] = []
    const showing = await render(
      <GuideStory
        title="Показ шага"
        steps={[
          {
            title: 'Нажатие',
            hint: '',
            enter: afterRows(root => {
              const cell = root.querySelector<HTMLElement>(
                `${ROW}[data-index="3"] [data-column-id="country"]`,
              )!
              cell.addEventListener('click', event => clicks.push(event))
              cell.click()
            }),
          },
        ]}
        args={STOP_ARGS}
        showActions
      />,
    )
    try {
      // Гайд навёл указатель на цель шага и ждёт, прежде чем нажать.
      await expect
        .poll(() => cellOfRow(3)?.classList.contains('pseudo-hover'))
        .toBe(true)
      await userEvent.click(cellOfRow(1))
      await sleep(1500)
      expect(clicks).toEqual([])
      expect(cellOfRow(3).classList.contains('pseudo-hover')).toBe(false)
      expect(cellOfRow(3).classList.contains('pseudo-active')).toBe(false)
      expect(document.querySelectorAll('[data-guide-click]')).toHaveLength(0)
    } finally {
      await showing.unmount()
    }
  })

  test('SN67: пометка «Таблица изменена» не сдвигает таблицу в узкой панели, свёрнутой и раскрытой; подпись — подсказкой у кнопки «Вернуть шаг»', async () => {
    run.release = false
    const screen = await render(<InputGuide />)
    try {
      await opened()
      expect(innerWidth).toBeLessThan(500)
      const collapsed = tableTop()
      await userEvent.click(bodyCell())
      await expect.poll(changed).not.toBeNull()
      expect(tableTop()).toBe(collapsed)
      await humanClick(byId('guide-restore'))
      await expect.poll(changed).toBeNull()
      await opened()

      await expandGuide()
      const expanded = tableTop()
      await userEvent.click(bodyCell())
      await expect.poll(changed).not.toBeNull()
      expect(tableTop()).toBe(expanded)

      await userEvent.hover(byId('guide-restore'))
      await expect
        .poll(() => document.body.textContent)
        .toContain('Таблица изменена: открыть шаг заново')
    } finally {
      await screen.unmount()
    }
  })

  test('SN68: пока шаг остановлен, событие его действия до таблицы не доходит и в консоли ошибка; переход снимает остановку', async () => {
    loop.clicks = 0
    loop.leaking = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Действие без отмены: щёлкает ячейку, пока тест его не остановит.
    const leak = (root: HTMLElement) => {
      const tick = () => {
        if (!loop.leaking) return
        const cell = root.querySelector<HTMLElement>(
          `${ROW}[data-index="3"] [data-column-id="country"]`,
        )
        if (cell && !cell.dataset.counted) {
          cell.dataset.counted = ''
          cell.addEventListener('click', () => loop.clicks++)
        }
        cell?.click()
        setTimeout(tick, 100)
      }
      setTimeout(tick, 0)
    }
    const screen = await render(
      <GuideStory
        title="Шаг без отмены"
        steps={[
          { title: 'Утечка', hint: '', enter: leak },
          { title: 'Дальше', hint: '' },
        ]}
        args={STOP_ARGS}
      />,
    )
    try {
      await expect.poll(() => loop.clicks).toBeGreaterThan(1)
      await userEvent.click(cellOfRow(1))
      await expect.poll(changed).not.toBeNull()
      await sleep(150)
      const clicks = loop.clicks
      await sleep(500)
      expect(loop.clicks).toBe(clicks)
      expect(errors).toHaveBeenCalledWith(
        'Гайд: действие остановленного шага шлёт «click» (ADR 0117, SN68)',
      )
      // Переход открывает таблицу заново и снимает остановку: щелчки снова доходят.
      await expandGuide()
      await humanClick(byId('guide-next'))
      await expect.poll(changed).toBeNull()
      const after = loop.clicks
      await expect.poll(() => loop.clicks).toBeGreaterThan(after)
    } finally {
      loop.leaking = false
      errors.mockRestore()
      await screen.unmount()
    }
  })
})

describe('показ действий шага (ADR 0117)', () => {
  const args = guideArgs(
    { dataCount: 10, columnCount: 6, enableCellEditing: true },
    { colorMode: 'light', locale: 'en' },
  )
  const steps: readonly GuideStoryStep[] = [{ title: 'Таблица', hint: '' }]
  const mount = (showActions?: boolean) =>
    render(
      <GuideStory
        title="Показ действий"
        steps={steps}
        args={args}
        showActions={showActions}
      />,
    )
  const cellAt = (row: number, column: string) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-index="${row}"] [data-column-id="${column}"]`,
    )!
  const middle = (element: Element) => {
    const box = element.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }
  const mouse = (type: string, at: { x: number; y: number }) =>
    new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, {
      bubbles: true,
      cancelable: true,
      clientX: at.x,
      clientY: at.y,
    })
  const record = (element: EventTarget, types: string[]) => {
    const seen: string[] = []
    for (const type of types)
      element.addEventListener(type, () => seen.push(type))
    return seen
  }
  const hovered = (element: Element) =>
    element.classList.contains('pseudo-hover')
  const pressed = (element: Element) =>
    element.classList.contains('pseudo-active')
  const rings = () => [...document.querySelectorAll('[data-guide-click]')]
  const guidePanel = () =>
    document.querySelector<HTMLElement>('[data-testid="guide"]')!
  const rows = () =>
    expect.poll(() => document.querySelectorAll('.data-grid__body-row').length)

  test('SN46: нажатие ждёт — цель сперва наведена с событиями наведения, затем нажата и в точке волна; события доходят в прежнем порядке, следующие события жеста — сразу', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(2, 'country')
      const at = middle(cell)
      const seen = record(cell, [
        'pointerover',
        'mouseover',
        'pointerdown',
        'click',
      ])
      const started = performance.now()
      cell.dispatchEvent(mouse('click', at))
      // Наведение: вид у ячейки и её строки, нажатия ещё нет.
      expect(hovered(cell)).toBe(true)
      expect(hovered(cell.closest('.data-grid__body-row')!)).toBe(true)
      expect(pressed(cell)).toBe(false)
      expect(seen).toEqual(['pointerover', 'mouseover'])
      // Нажатие: нажатый вид и волна в точке.
      await expect.poll(() => pressed(cell), { timeout: 3000 }).toBe(true)
      expect(rings()).toHaveLength(1)
      const ring = rings()[0]!.getBoundingClientRect()
      expect(ring.left + ring.width / 2).toBeCloseTo(at.x, 0)
      expect(ring.top + ring.height / 2).toBeCloseTo(at.y, 0)
      await expect
        .poll(() => seen, { timeout: 3000 })
        .toEqual(['pointerover', 'mouseover', 'pointerdown', 'click'])
      expect(performance.now() - started).toBeGreaterThanOrEqual(450)
      // Тот же жест — сразу: отпускание после показанного нажатия кнопки.
      const up = record(cell, ['pointerup'])
      cell.dispatchEvent(mouse('pointerup', at))
      expect(up).toEqual(['pointerup'])

      // Цель сдвинулась, пока наведена (скрытая кнопка раскрылась): волна — по новому месту.
      const moving = cellAt(4, 'firstName')
      moving.addEventListener(
        'mouseover',
        () => (moving.style.transform = 'translateX(30px)'),
        { once: true },
      )
      await expect.poll(() => rings().length, { timeout: 3000 }).toBe(0)
      // Голый `click()` — как мышью: кнопка вниз на нажатом виде, вверх — перед щелчком.
      const press = record(moving, [
        'pointerdown',
        'mousedown',
        'pointerup',
        'mouseup',
        'click',
      ])
      let downWhilePressed = false
      moving.addEventListener(
        'pointerdown',
        () => (downWhilePressed = pressed(moving)),
        { once: true },
      )
      // Отпускание ещё раз сдвинуло цель: волна к щелчку — за ней.
      moving.addEventListener(
        'pointerup',
        () => (moving.style.transform = 'translateX(60px)'),
        { once: true },
      )
      let clickAs: Partial<PointerEvent> = {}
      moving.addEventListener(
        'click',
        event => {
          clickAs = event as PointerEvent
          const wave = rings().at(-1)!.getBoundingClientRect()
          waveAtClick = {
            x: wave.left + wave.width / 2,
            y: wave.top + wave.height / 2,
          }
        },
        { once: true },
      )
      let waveAtClick = { x: 0, y: 0 }
      moving.click()
      await expect
        .poll(() => press, { timeout: 3000 })
        .toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      expect(downWhilePressed).toBe(true)
      const moved = middle(moving)
      expect(waveAtClick.x).toBeCloseTo(moved.x, 0)
      expect(waveAtClick.y).toBeCloseTo(moved.y, 0)
      // Щелчок — как от мыши: Base UI не примет его за клавиатурный.
      expect(clickAs.detail).toBe(1)
      expect(clickAs.pointerType).toBe('mouse')

      // У кнопки меню — без нажатия: меню Base UI открывается уже им.
      const menuButton = document.createElement('button')
      menuButton.setAttribute('aria-haspopup', 'menu')
      menuButton.textContent = 'menu'
      cellAt(5, 'country').append(menuButton)
      const menuPress = record(menuButton, [
        'pointerdown',
        'mousedown',
        'click',
      ])
      menuButton.click()
      await expect.poll(() => menuPress, { timeout: 3000 }).toEqual(['click'])

      // Прошлый повтор перерисовал цель: следующий — узлу на том же месте.
      const old = cellAt(6, 'country')
      const fresh = old.cloneNode(true) as HTMLElement
      old.addEventListener('contextmenu', () => old.replaceWith(fresh), {
        once: true,
      })
      const reached = record(fresh, ['mouseup'])
      const spot = middle(old)
      old.dispatchEvent(mouse('contextmenu', spot))
      old.dispatchEvent(mouse('mouseup', spot))
      await expect.poll(() => reached, { timeout: 3000 }).toEqual(['mouseup'])
    } finally {
      await screen.unmount()
    }
  })

  test('SN47: клавиша действия шага — плашка с её именем у цели: Enter символом, сочетание через «+», одиночный модификатор — без плашки', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(1, 'country')
      const badges = () =>
        [...document.querySelectorAll('[data-guide-key]')].map(
          badge => badge.textContent,
        )
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
      cell.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          bubbles: true,
        }),
      )
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }),
      )
      expect(badges()).toEqual(['↵', 'Ctrl+A'])
      const badge = document
        .querySelector('[data-guide-key]')!
        .getBoundingClientRect()
      const box = cell.getBoundingClientRect()
      expect(badge.left).toBeCloseTo(box.left, 0)
      expect(badge.top).toBeGreaterThanOrEqual(box.bottom)
    } finally {
      await screen.unmount()
    }
  })

  test('SN48: наведение ставит цели вид наведения до наведения на другую цель, ухода указателя, движения настоящей мыши над таблицей или секунды без событий; мышь над панелью его не снимает', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const first = cellAt(1, 'country')
      const second = cellAt(2, 'country')
      const seen = record(first, ['pointerover'])
      first.dispatchEvent(mouse('pointerover', middle(first)))
      expect(seen).toEqual(['pointerover'])
      expect(hovered(first)).toBe(true)
      second.dispatchEvent(mouse('pointerover', middle(second)))
      expect(hovered(first)).toBe(false)
      expect(hovered(second)).toBe(true)
      second.dispatchEvent(mouse('pointerout', middle(second)))
      expect(hovered(second)).toBe(false)

      first.dispatchEvent(mouse('pointerover', middle(first)))
      await sleep(600)
      expect(hovered(first)).toBe(true)
      await expect.poll(() => hovered(first), { timeout: 2000 }).toBe(false)

      first.dispatchEvent(mouse('pointerover', middle(first)))
      expect(hovered(first)).toBe(true)
      // Мышь над панелью гайда — не над таблицей: вид остаётся.
      await userEvent.hover(guidePanel())
      expect(hovered(first)).toBe(true)
      // Раньше секунды простоя: снимает именно настоящая мышь над таблицей.
      const moved = performance.now()
      await userEvent.hover(cellAt(4, 'age'))
      expect(hovered(first)).toBe(false)
      expect(performance.now() - moved).toBeLessThan(900)
    } finally {
      await screen.unmount()
    }
  })

  test('SN60: пока гайд показывает нажатие, настоящая мышь вне таблицы не снимает вид наведения цели и наведение её строки — скрытая кнопка видна до щелчка', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      // Порции окна позади (ADR 0203): строка цели больше не перерисовывается.
      await expect
        .poll(() => document.querySelector('[data-portions-pending]'))
        .toBeNull()
      const button = cellAt(2, 'age').querySelector<HTMLElement>(
        '.cell__button button',
      )!
      // Части панели: переход с одной на другую — `pointerover` вне таблицы.
      const parts = [
        ...guidePanel().querySelectorAll<HTMLElement>('button'),
      ].filter(part => part.getBoundingClientRect().width > 0)
      expect(parts.length).toBeGreaterThan(1)
      button.click()
      await expect.poll(() => hovered(button)).toBe(true)
      await userEvent.hover(parts[0]!)
      await userEvent.hover(parts[1]!)
      expect(pressed(button)).toBe(false)
      expect(hovered(button)).toBe(true)
      // Значок скрытой кнопки — только у строки под указателем (ADR 0149, §4).
      expect(button.querySelector('svg')).not.toBeNull()
      await expect.poll(() => pressed(button)).toBe(true)
      expect(button.querySelector('svg')).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SN61: цель нажатия вне окна страницы сперва прокручивается в окно, затем показ нажатия — по её новому месту', async () => {
    const { innerWidth: width, innerHeight: height } = window
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(3, 'country')
      // Окно ниже ячейки: таблица её показывает, страница — нет.
      await page.viewport(
        width,
        Math.floor(cell.getBoundingClientRect().top) - 20,
      )
      scrollTo(0, 0)
      expect(cell.getBoundingClientRect().bottom).toBeGreaterThan(innerHeight)
      cell.click()
      await expect.poll(() => pressed(cell), { timeout: 4000 }).toBe(true)
      const box = cell.getBoundingClientRect()
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(innerHeight)
      const ring = rings().at(-1)!.getBoundingClientRect()
      const ringX = ring.left + ring.width / 2
      const ringY = ring.top + ring.height / 2
      expect(ringX).toBeGreaterThanOrEqual(box.left)
      expect(ringX).toBeLessThanOrEqual(box.right)
      expect(ringY).toBeGreaterThanOrEqual(box.top)
      expect(ringY).toBeLessThanOrEqual(box.bottom)
    } finally {
      await page.viewport(width, height)
      scrollTo(0, 0)
      await screen.unmount()
    }
  })

  test('SN49: ввод текста действием шага идёт по символу, следующие события шага ждут конца ввода', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      // Своё поле на странице: набор идёт в любое текстовое поле, не только в ячейку.
      const input = document.createElement('input')
      document.body.append(input)
      input.focus()
      const values: string[] = []
      const order: string[] = []
      input.addEventListener('input', () => {
        values.push(input.value)
        order.push('input')
      })
      input.addEventListener('keydown', () => order.push('keydown'))
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'Zelda')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
      expect(input.value).not.toBe('Zelda')
      await expect.poll(() => order.at(-1), { timeout: 3000 }).toBe('keydown')
      expect(values.at(-1)).toBe('Zelda')
      expect(values.length).toBeGreaterThanOrEqual(4)
      for (const value of values) expect('Zelda'.startsWith(value)).toBe(true)
      expect(order.indexOf('keydown')).toBe(order.length - 1)
      input.remove()
    } finally {
      await screen.unmount()
    }
  })

  test('SN62: стирание поля действием шага и до пустой строки доходит событием input со стёртым значением', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const input = document.createElement('input')
      document.body.append(input)
      const setValue = (value: string) =>
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!.call(input, value)
      // Поле уже держит текст: гайд запоминает его при фокусе.
      setValue('Zelda')
      input.focus()
      const values: string[] = []
      input.addEventListener('input', () => values.push(input.value))
      setValue('')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await expect.poll(() => values.at(-1), { timeout: 3000 }).toBe('')
      expect(input.value).toBe('')
      input.remove()
    } finally {
      await screen.unmount()
    }
  })

  test('SN65: щелчок человека по флажку строки доходит сразу и без показа — скрытое поле, которое щёлкает флажок, гайд за действие шага не принимает', async () => {
    const { innerWidth: width, innerHeight: height } = window
    // Шапка панели в одну строку: пометка «Таблица изменена» не сдвигает таблицу посреди щелчка.
    await page.viewport(1000, height)
    const screen = await render(
      <GuideStory
        title="Показ действий"
        steps={steps}
        args={guideArgs(
          { dataCount: 10, columnCount: 6, enableRowSelection: true },
          { colorMode: 'light', locale: 'en' },
        )}
        showActions
      />,
    )
    try {
      await rows().toBeGreaterThan(3)
      const box = document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="2"] [role="checkbox"]',
      )!
      const hidden = box
        .closest('.data-grid__body-cell')!
        .querySelector('input[type="checkbox"]')!
      const clicks: boolean[] = []
      hidden.addEventListener('click', event => clicks.push(event.isTrusted))
      await userEvent.click(box)
      // Показ нажатия ждал бы наведения и нажатия — дольше секунды.
      await expect
        .poll(() => box.getAttribute('aria-checked'), { timeout: 300 })
        .toBe('true')
      expect(clicks).toEqual([false])
      expect(rings()).toHaveLength(0)
      expect(hovered(box.closest('.data-grid__body-cell')!)).toBe(false)
    } finally {
      await screen.unmount()
      await page.viewport(width, height)
    }
  })

  test('SN50: нажатие кнопки мыши не ждёт — волна сразу, нажатие и движение указателя после него доходят без ожидания', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      // Ячейка в виду: иначе нажатие ждало бы прокрутки к ней (SN45).
      const cell = cellAt(1, 'country')
      const at = middle(cell)
      const seen = record(cell, ['pointerdown'])
      // Нажатие доходит сразу, волна — тут же.
      cell.dispatchEvent(mouse('pointerdown', at))
      expect(seen).toEqual(['pointerdown'])
      expect(rings().length).toBeGreaterThan(0)
      // Указатель ведут и по документу (перетаскивание), и по ячейкам (выделение мышью).
      // Дошло само событие, а не его повтор после ожидания.
      const moves: Event[] = []
      document.addEventListener('pointermove', event => moves.push(event))
      const onDocument = mouse('pointermove', { x: at.x + 40, y: at.y })
      document.dispatchEvent(onDocument)
      expect(moves).toContain(onDocument)
      const over = cellAt(3, 'country')
      const onCell = mouse('pointermove', middle(over))
      over.dispatchEvent(onCell)
      expect(moves).toContain(onCell)
      document.dispatchEvent(mouse('pointerup', at))
    } finally {
      await screen.unmount()
    }
  })

  test('SN51: вне живого Storybook показа и задержек нет; при уменьшенном движении волна и плашка — без анимации', async () => {
    const plain = await mount()
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(2, 'country')
      const seen = record(cell, ['click'])
      cell.click()
      cell.dispatchEvent(mouse('pointerover', middle(cell)))
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
      expect(seen).toEqual(['click'])
      expect(hovered(cell)).toBe(false)
      expect(rings()).toEqual([])
      expect(document.querySelector('[data-guide-key]')).toBeNull()
    } finally {
      await plain.unmount()
    }
    await motion.reducedMotion(true)
    const reduced = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(2, 'country')
      cell.dispatchEvent(mouse('click', middle(cell)))
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
      await expect
        .poll(() => rings().length, { timeout: 3000 })
        .toBeGreaterThan(0)
      expect(rings().at(-1)!.getAnimations()).toEqual([])
      // Клавиша ждёт конца нажатия: плашка — когда она доходит.
      await expect
        .poll(() => document.querySelector('[data-guide-key]'))
        .not.toBeNull()
      expect(
        document.querySelector('[data-guide-key]')!.getAnimations(),
      ).toEqual([])
    } finally {
      await reduced.unmount()
      await motion.reducedMotion(false)
    }
  })

  test('SN52: нажатый вид снимается вскоре после нажатия; волна и плашка не перехватывают указатель и скрыты от дерева доступности', async () => {
    const screen = await mount(true)
    try {
      await rows().toBeGreaterThan(3)
      const cell = cellAt(2, 'country')
      const seen = record(cell, ['click'])
      cell.dispatchEvent(mouse('click', middle(cell)))
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
      await expect.poll(() => pressed(cell), { timeout: 3000 }).toBe(true)
      await expect.poll(() => seen, { timeout: 3000 }).toEqual(['click'])
      await expect
        .poll(() => document.querySelector('[data-guide-key]'))
        .not.toBeNull()
      for (const layer of [
        rings()[0]!,
        document.querySelector('[data-guide-key]')!,
      ]) {
        expect(getComputedStyle(layer).pointerEvents).toBe('none')
        expect(layer.getAttribute('aria-hidden')).toBe('true')
      }
      await expect.poll(() => pressed(cell), { timeout: 1000 }).toBe(false)
    } finally {
      await screen.unmount()
    }
  })

  test('SN53: нажатие по панели гайда не закрывает меню таблицы — и после нажатия внутри меню', async () => {
    const menuArgs = guideArgs(
      { dataCount: 10, columnCount: 6, enableColumnVisibility: true },
      { colorMode: 'light', locale: 'en' },
    )
    const screen = await render(
      <GuideStory
        title="Меню и панель"
        steps={[
          { title: 'Таблица', hint: '' },
          { title: 'Дальше', hint: '' },
        ]}
        args={menuArgs}
      />,
    )
    try {
      await expect
        .poll(() => {
          if (!visibilityMenu()) openViewSettingsSection(document, 'columns')
          return !!visibilityMenu()
        })
        .toBe(true)
      await humanClick(byId('guide-toggle'))
      await sleep(300)
      expect(visibilityMenu()).not.toBeNull()
      // И после нажатия внутри меню: Base UI помнит его и закрыл бы меню щелчком мимо.
      await humanClick(
        visibilityMenu()!.querySelectorAll<HTMLElement>(
          '[role="checkbox"]',
        )[1]!,
      )
      await humanClick(byId('guide-toggle'))
      await sleep(300)
      expect(visibilityMenu()).not.toBeNull()
      // И когда фокус вне открытого меню: нажатие по панели его не забирает.
      ;(document.activeElement as HTMLElement).blur()
      await humanClick(byId('guide-toggle'))
      await sleep(300)
      expect(visibilityMenu()).not.toBeNull()
    } finally {
      await userEvent.keyboard('{Escape}')
      await screen.unmount()
    }
  })

  test('SN54: пока гайд показывает нажатие, цикл шага его не повторяет — до цели доходит одно нажатие', async () => {
    const clicks: Event[] = []
    const cellOf = (root: ParentNode) =>
      root.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="2"] [data-column-id="country"]',
      )
    const steps: readonly GuideStoryStep[] = [
      { title: 'Таблица', hint: '' },
      {
        title: 'Нажатие',
        hint: '',
        enter: untilDone(
          () => clicks.length > 0,
          root => {
            const cell = cellOf(root)
            if (!cell) return
            if (!cell.dataset.counted) {
              cell.dataset.counted = 'yes'
              cell.addEventListener('click', event => clicks.push(event))
            }
            cell.click()
          },
        ),
      },
    ]
    const screen = await render(
      <GuideStory
        title="Одно нажатие"
        steps={steps}
        args={guideArgs(
          { dataCount: 10, columnCount: 6 },
          { colorMode: 'light', locale: 'en' },
        )}
        showActions
      />,
    )
    try {
      await expect
        .poll(() => document.querySelectorAll('.data-grid__body-row').length)
        .toBeGreaterThan(3)
      await expandGuide()
      button('guide-next').click()
      await expect.poll(() => clicks.length, { timeout: 3000 }).toBe(1)
      await sleep(400)
      expect(clicks).toHaveLength(1)
      // Повтор того же нажатия сразу после показа, пока таблица отвечает, — отброшен.
      cellOf(document)!.click()
      expect(clicks).toHaveLength(1)

      // `repeat` не повторяет и `pollUntil` не тратит время, пока идёт показ.
      const guide = document.querySelector<HTMLElement>('[data-guide-root]')!
      guide.setAttribute('data-guide-showing', '')
      let acts = 0
      const controller = new AbortController()
      const repeated = repeat(
        () => acts > 0,
        () => acts++,
        controller.signal,
      )
      let polled = false
      const waited = pollUntil(() => polled, controller.signal, 100).then(
        () => 'done',
        () => 'timeout',
      )
      await sleep(400)
      expect(acts).toBe(0)
      polled = true
      expect(await waited).toBe('done')
      guide.removeAttribute('data-guide-showing')
      await repeated
      expect(acts).toBe(1)
    } finally {
      await screen.unmount()
    }
  })
})

// Стенд фокуса (SN55–SN58): поле вне таблицы, нажатие ячейки, меню, закрытое Escape.
const field = () => document.querySelector<HTMLInputElement>('#guide-field')!
const focusCell = () =>
  document.querySelector<HTMLElement>(
    `${ROW}[data-index="1"] [data-column-id="country"]`,
  )!
const modality = () => document.documentElement.getAttribute('data-tsr-input')
/** Ни один элемент таблицы и её поповеров не в фокусе. */
const tableReleased = () => {
  const active = document.activeElement
  return (
    !active ||
    active === document.body ||
    active === field() ||
    !!active.closest('[data-testid="guide"]')
  )
}
const FOCUS_STEPS: readonly GuideStoryStep[] = [
  { title: 'Таблица', hint: '' },
  {
    title: 'Нажатие ячейки',
    hint: '',
    // Нажатие сделало ячейку активной; фокус с неё гайд снимает.
    enter: untilDone(
      () => focusCell()?.dataset.knActive === 'true',
      () => {
        const cell = focusCell()
        if (cell) pressCell(cell)
      },
    ),
  },
  {
    title: 'Меню закрыто',
    hint: '',
    enter: stepAction(async (_root, { signal }) => {
      await pollUntil(() => {
        if (!visibilityMenu()) openViewSettingsSection(document, 'columns')
        return !!visibilityMenu()
      }, signal)
      pressEscape()
      await pollUntil(
        () =>
          !visibilityMenu() && document.activeElement === visibilityButton(),
        signal,
      )
    }),
  },
  { title: 'Поле', hint: '', enter: () => field().focus() },
]
const KEY_STEPS: readonly GuideStoryStep[] = [
  { title: 'Таблица', hint: '' },
  {
    title: 'Стрелка вниз',
    hint: '',
    keyboard: true,
    enter: untilDone(
      () => !!document.activeElement?.closest(`${ROW}[data-index="2"]`),
      () => {
        const cell = focusCell()
        cell?.focus()
        cell?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        )
      },
    ),
  },
]
const focusArgs = guideArgs(
  {
    dataCount: 20,
    columnCount: 6,
    enableColumnVisibility: true,
    enableKeyboardNavigation: true,
  },
  { colorMode: 'light', locale: 'en' },
)
/** Гайд со своим полем вне таблицы: фокус в поле шаг держит. */
const mountFocusGuide = async (steps: readonly GuideStoryStep[]) => {
  const input = document.createElement('input')
  input.id = 'guide-field'
  document.body.append(input)
  const screen = await render(
    <GuideStory title="Фокус" steps={steps} args={focusArgs} />,
  )
  await expect.poll(() => !!focusCell()).toBe(true)
  await humanClick(byId('guide-toggle'))
  await sleep(600)
  return {
    unmount: async () => {
      await screen.unmount()
      input.remove()
    },
  }
}
const stepIs = (n: number) =>
  expect
    .poll(() => guideRoot().dataset.guideStep, { timeout: 5000 })
    .toBe(String(n - 1))
/** Сторож фокуса дождался тишины после действия шага. */
const quiet = () => sleep(500)

describe('фокус после шага (ADR 0117)', () => {
  test('SN55: нажатие по панели вне поля и поповера — как нажатие мимо таблицы: фокус на кнопке панели без кольца, признак ввода — указатель', async () => {
    const guide = await mountFocusGuide([
      { title: 'Таблица', hint: '' },
      { title: 'Дальше', hint: '' },
    ])
    try {
      focusCell().focus()
      pressEscape()
      expect(modality()).toBe('keyboard')
      await humanClick(byId('guide-toggle'))
      expect(document.activeElement).toBe(byId('guide-toggle'))
      expect(byId('guide-toggle').matches(':focus-visible')).toBe(false)
      expect(modality()).toBe('pointer')
    } finally {
      await guide.unmount()
    }
  })

  test('SN56: после шага не про клавиатуру фокус действия и закрытого меню уходит на кнопку панели, признак ввода прежний — «Далее», «Назад», шаг, воспроизведение; поле и открытый поповер фокус держат', async () => {
    const guide = await mountFocusGuide(FOCUS_STEPS)
    try {
      // «Далее»: нажатие ячейки фокуса не оставляет.
      await humanClick(button('guide-next'))
      await stepIs(2)
      await quiet()
      expect(tableReleased()).toBe(true)

      // Закрытое Escape меню вернуло фокус кнопке «Колонки» — он уходит уже к отметке
      // `done`, признак ввода — указатель, как до клавиши шага.
      let releasedAtDone: boolean | undefined
      const done = new MutationObserver(() => {
        if (guideRoot().dataset.stepAction === 'done:2')
          releasedAtDone ??= tableReleased() && modality() === 'pointer'
      })
      done.observe(guideRoot(), { attributeFilter: ['data-step-action'] })
      await humanClick(button('guide-next'))
      await stepIs(3)
      await expect
        .poll(() => guideRoot().dataset.stepAction, { timeout: 5000 })
        .toBe('done:2')
      done.disconnect()
      expect(releasedAtDone).toBe(true)
      await quiet()
      expect(tableReleased()).toBe(true)
      expect(modality()).toBe('pointer')

      // Поле держит фокус и после нажатия по панели.
      await humanClick(button('guide-next'))
      await stepIs(4)
      await quiet()
      expect(document.activeElement).toBe(field())
      await humanClick(byId('guide-toggle'))
      await humanClick(byId('guide-toggle'))
      await sleep(600)
      expect(document.activeElement).toBe(field())
      // Контрол формы — сегмент редактора — держит фокус, как поле.
      const segment = document.createElement('span')
      segment.setAttribute('role', 'radio')
      segment.tabIndex = 0
      document.body.append(segment)
      segment.focus()
      await quiet()
      expect(document.activeElement).toBe(segment)
      segment.remove()
      field().focus()

      // Нажатие на шаг: таблица открывается заново, ячейку нажимает действие шага.
      await humanClick(
        document.querySelector<HTMLElement>('[data-step-button="1"]')!,
      )
      await stepIs(2)
      await quiet()
      expect(tableReleased()).toBe(true)

      // «Назад» и снова «Далее».
      await humanClick(button('guide-back'))
      await stepIs(1)
      await humanClick(button('guide-next'))
      await stepIs(2)
      await quiet()
      expect(tableReleased()).toBe(true)

      // Открытое меню держит фокус.
      await expect
        .poll(() => {
          if (!visibilityMenu()) openViewSettingsSection(document, 'columns')
          return !!visibilityMenu()
        })
        .toBe(true)
      await expect
        .poll(() => visibilityMenu()!.contains(document.activeElement))
        .toBe(true)
      await quiet()
      expect(visibilityMenu()!.contains(document.activeElement)).toBe(true)
      pressEscape()
      await expect.poll(visibilityMenu).toBeNull()

      // Воспроизведение с начала: фокус, который нажатие ячейки и закрытое меню забрали у
      // «Пауза», возвращается на неё без кольца.
      await humanClick(byId('guide-restart'))
      await stepIs(1)
      await humanClick(byId('guide-play'))
      await stepIs(2)
      await quiet()
      expect(document.activeElement).toBe(byId('guide-play'))
      expect(byId('guide-play').matches(':focus-visible')).toBe(false)
      await expect
        .poll(() => guideRoot().dataset.stepAction, { timeout: 10_000 })
        .toBe('done:2')
      await quiet()
      expect(document.activeElement).toBe(byId('guide-play'))
      expect(modality()).toBe('pointer')
    } finally {
      await guide.unmount()
    }
  })

  test('SN57: шаг про клавиатуру оставляет фокус своего действия и клавиатурный признак ввода — кольцо видно', async () => {
    const guide = await mountFocusGuide(KEY_STEPS)
    try {
      await humanClick(button('guide-next'))
      await stepIs(2)
      await expect
        .poll(() => document.activeElement?.closest(`${ROW}[data-index="2"]`))
        .not.toBeNull()
      await quiet()
      const active = document.activeElement as HTMLElement
      expect(active.closest(`${ROW}[data-index="2"]`)).not.toBeNull()
      expect(modality()).toBe('keyboard')
      expect(getComputedStyle(active).outlineStyle).toBe('solid')
    } finally {
      await guide.unmount()
    }
  })

  test('SN58: фокус, поставленный нажатием человека в таблице, гайд не снимает', async () => {
    const guide = await mountFocusGuide([
      { title: 'Таблица', hint: '' },
      { title: 'Дальше', hint: '' },
    ])
    try {
      await humanClick(button('guide-next'))
      await stepIs(2)
      await userEvent.click(focusCell())
      await expect.poll(() => document.activeElement).toBe(focusCell())
      await quiet()
      expect(document.activeElement).toBe(focusCell())

      // Tab с панели в таблицу (тулбар): фокус человека.
      await humanClick(button('guide-back'))
      await stepIs(1)
      byId('guide-restart').focus()
      for (let tabs = 0; tabs < 20 && tableReleased(); tabs++)
        await userEvent.keyboard('{Tab}')
      expect(tableReleased()).toBe(false)
      const tabbed = document.activeElement
      await quiet()
      expect(document.activeElement).toBe(tabbed)
    } finally {
      await guide.unmount()
    }
  })
  test('SN59: вне живого Storybook голый щелчок шага в гриде доходит как от мыши — кнопка вниз и вверх, щелчок с одним нажатием; у кнопки меню и вне грида — без нажатия', async () => {
    const seen: string[] = []
    // StrictMode входит в шаг дважды: щелчки — один раз.
    let clicked = false
    const menuButton = document.createElement('button')
    menuButton.setAttribute('aria-haspopup', 'menu')
    const outside = document.createElement('button')
    document.body.append(outside)
    const track = (element: Element, name: string) => {
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup'])
        element.addEventListener(type, () => seen.push(`${name}:${type}`))
      element.addEventListener('click', event =>
        seen.push(`${name}:click:${(event as MouseEvent).detail}`),
      )
    }
    const guide = await mountFocusGuide([
      { title: 'Таблица', hint: '' },
      {
        title: 'Щелчки',
        hint: '',
        enter: () => {
          if (clicked) return
          clicked = true
          const cell = focusCell()
          cell.closest('[role="grid"]')!.append(menuButton)
          for (const [element, name] of [
            [cell, 'cell'],
            [menuButton, 'menu'],
            [outside, 'outside'],
          ] as const) {
            track(element, name)
            element.click()
          }
        },
      },
    ])
    try {
      await humanClick(button('guide-next'))
      await stepIs(2)
      await expect.poll(() => seen.includes('outside:click:0')).toBe(true)
      expect(seen).toEqual([
        'cell:pointerdown',
        'cell:mousedown',
        'cell:pointerup',
        'cell:mouseup',
        'cell:click:1',
        'menu:click:0',
        'outside:click:0',
      ])
    } finally {
      await guide.unmount()
      menuButton.remove()
      outside.remove()
    }
  })
})
