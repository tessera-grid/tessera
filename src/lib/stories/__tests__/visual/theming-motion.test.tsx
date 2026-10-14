import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { composed } from '../stories'

// Контракт движения (ADR 0017, MO1–MO3): все переходы грида собираются из двух базовых
// токенов, скрытые кнопки ячейки и строки проявляются одним переходом, а настройка
// системы «меньше движения» гасит всё одним правилом. Сравниваются вычисленные стили.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

afterEach(() => reducedMotion(false))

const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

const resolve = (token: string, prop: string): string => {
  const probe = document.createElement('div')
  probe.className = 'data-grid-theme'
  probe.style.setProperty(prop, `var(${token})`)
  document.body.appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop).trim()
  probe.remove()
  return value
}

const query = (selector: string) => [
  ...document.querySelectorAll<HTMLElement>(selector),
]

const SAMPLES: [string, string][] = [
  ['body row', '.data-grid__body-row'],
  ['head cell', '.data-grid__head-cell'],
  ['body cell', '.data-grid__body-cell'],
  ['cell button', '.cell__button'],
  ['row button', '.row__button'],
  ['row action chip', '.row__button button'],
  ['toolbar button', '[role="toolbar"] button'],
  ['row checkbox', '.data-grid__body-row [role="checkbox"]'],
]

const renderAll = async () => {
  await render(
    <composed.AllFeatures
      containerHeight={500}
      height={400}
      dataCount={20}
      columnCount={5}
      enableToolbar
      enableColumnVisibility
      enableRowSelection
      enableRowActions
      enableRowActionMenu
      enableCellEditing
      enableColumnSorting
    />,
  )
  await expect.poll(() => query('.row__button').length).toBeGreaterThan(0)
  await expect
    .poll(() => query('[data-testid="column-visibility-button"]').length)
    .toBe(1)
}

/** Элементы выборки плюс открытый поповер меню колонок. */
const sampled = async (): Promise<[string, HTMLElement][]> => {
  await userEvent.click(query('[data-testid="column-visibility-button"]')[0])
  await expect
    .poll(() => query('[data-testid="column-visibility-menu"]').length)
    .toBe(1)
  // Поповер на первом кадре открытия ещё в начальном состоянии перехода.
  const popover = query('[data-testid="column-visibility-menu"]')[0]
  await expect
    .poll(() => popover.hasAttribute('data-starting-style'))
    .toBe(false)
  await new Promise(resolve => requestAnimationFrame(resolve))
  return [
    ...SAMPLES.map(([name, selector]) => [name, query(selector)[0]] as const),
    ['popover', query('[data-testid="column-visibility-menu"]')[0]] as const,
  ].map(([name, el]) => {
    expect(el, `${name} is rendered`).toBeTruthy()
    return [name, el] as [string, HTMLElement]
  })
}

const list = (value: string) => value.split(',').map(part => part.trim())

/**
 * Ячейка в видимой области и прокрутка улеглась: наведение Playwright не прокрутит
 * грид, и раскрытие кнопок идёт плавно, а не как во время прокрутки (RW3).
 */
const pointer = commands as unknown as {
  realMouseMove: (from: object, to: object, steps?: number) => Promise<void>
}

/** Настоящее движение мыши к центру элемента: в отличие от `hover`, грид не прокручивает. */
const moveMouseTo = async (element: Element) => {
  const rect = element.getBoundingClientRect()
  await pointer.realMouseMove(
    { x: 1, y: 1 },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    4,
  )
}

const settleIntoView = async (cell: Element) => {
  cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  // Событие прокрутки приходит кадром позже самой прокрутки.
  for (let i = 0; i < 2; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
  const scroller = cell.closest('.data-grid__container')!
  await expect
    .poll(() => scroller.hasAttribute('data-scrolling'), { timeout: 2000 })
    .toBe(false)
}

describe('Motion contract', () => {
  test('MO1 every transition is built from the motion tokens: one duration, the shared easing (or the entrance easing)', async () => {
    await renderAll()
    const duration = resolve(
      '--tsr-comp-motion-duration',
      'transition-duration',
    )
    const easings = [
      resolve('--tsr-comp-motion-easing', 'transition-timing-function'),
      resolve('--tsr-comp-motion-easing-out', 'transition-timing-function'),
    ]
    for (const [name, el] of await sampled()) {
      for (const part of list(read(el, 'transition-duration'))) {
        expect(part, `${name} duration`).toBe(duration)
      }
      // Timing-function с запятыми внутри `cubic-bezier(…)` режем по границе функций.
      const timing = read(el, 'transition-timing-function').match(
        /cubic-bezier\([^)]*\)|[a-z-]+/g,
      )!
      for (const part of timing) {
        expect(easings, `${name} easing`).toContain(part)
      }
    }
  })

  test('MO2 hidden cell buttons and row action chips are revealed at ONE pace: same duration and entrance easing', async () => {
    await renderAll()
    const cell = query('.cell__button')[0]
    const chip = query('.row__button > button')[0]
    const easingOut = resolve(
      '--tsr-comp-motion-easing-out',
      'transition-timing-function',
    )
    const duration = resolve(
      '--tsr-comp-motion-duration',
      'transition-duration',
    )
    expect(read(cell, 'transition-property')).toBe(
      'opacity, grid-template-columns, flex-basis, padding-right, overflow',
    )
    expect(read(chip, 'transition-property')).toBe('color, box-shadow')
    for (const el of [cell, chip]) {
      for (const part of list(read(el, 'transition-duration'))) {
        expect(part).toBe(duration)
      }
      for (const part of read(el, 'transition-timing-function').match(
        /cubic-bezier\([^)]*\)/g,
      )!) {
        expect(part).toBe(easingOut)
      }
    }
  })

  test('MO5 a row action chip covers what lies beneath it from the first frame of its reveal; hidden, it covers nothing', async () => {
    await renderAll()
    const row = query('.data-grid__body-row')[2]
    const wrapper = row.querySelector<HTMLElement>('.row__button')!
    const chip = wrapper.querySelector<HTMLElement>(':scope > button')!
    const opaque = resolve('--tsr-comp-action-button-bg', 'background-color')

    // Скрыт: не закрывает контент ячейки под собой.
    await userEvent.hover(document.body)
    await expect
      .poll(() => read(chip, 'background-color'))
      .toBe('rgba(0, 0, 0, 0)')

    // Наведение на строку: фон непрозрачен сразу, обёртка не полупрозрачна —
    // проявляются только значок и граница.
    await userEvent.hover(row.querySelector('.data-grid__body-cell')!)
    expect(read(chip, 'background-color')).toBe(opaque)
    expect(read(wrapper, 'opacity')).toBe('1')
    expect(chip.getAnimations().length).toBeGreaterThan(0)

    // Кебаб лежит поверх ячеек: в центре чипа — сам чип.
    const box = chip.getBoundingClientRect()
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    )
    expect(chip.contains(hit)).toBe(true)
  })

  test('MO4 the hover outline of a body cell fades in with the shared motion instead of switching instantly', async () => {
    await renderAll()
    const cell = query(
      '.data-grid__body-cell:not([data-actions-column-cell="true"])',
    )[0]
    expect(read(cell, 'transition-property')).toContain('outline-color')
    expect(read(cell, 'outline-color')).toBe('rgba(0, 0, 0, 0)')
    await userEvent.hover(cell)
    await expect
      .poll(() => read(cell, 'outline-color'), { timeout: 3000 })
      .toBe(resolve('--tsr-comp-cell-outline-color', 'color'))
  })

  test('RW1 a hidden cell button of a body cell and a header passes through intermediate widths on hover instead of jumping', async () => {
    await renderAll()
    const theme = query('.data-grid-theme')[0]
    // Длинный переход, чтобы замер попал в его середину независимо от задержек RPC.
    theme.style.setProperty('--tsr-comp-motion-duration', '10s')
    try {
      for (const [name, cellSelector] of [
        ['body cell', '.data-grid__body-cell'],
        ['header', '.data-grid__head-cell'],
      ] as const) {
        const wrapper = query(
          `${cellSelector} .cell__button--hidden:not([data-button-active='true'])`,
        )[0]
        expect(wrapper, `${name} has a hidden button`).toBeTruthy()
        const full = wrapper
          .querySelector('button')!
          .getBoundingClientRect().width
        expect(wrapper.getBoundingClientRect().width, `${name} hidden`).toBe(0)

        await settleIntoView(wrapper.closest(cellSelector)!)
        await moveMouseTo(wrapper.closest(cellSelector)!)
        await expect
          .poll(() => wrapper.getBoundingClientRect().width)
          .toBeGreaterThan(0)
        expect(
          wrapper.getBoundingClientRect().width,
          `${name} mid-transition`,
        ).toBeLessThan(full)
        await userEvent.hover(document.body)
      }
    } finally {
      theme.style.removeProperty('--tsr-comp-motion-duration')
    }
  })

  test('RW3 while the grid scrolls a hidden cell button opens to its full width at once, afterwards smoothly again', async () => {
    await renderAll()
    const theme = query('.data-grid-theme')[0]
    const scroller = query('.data-grid__container')[0]
    theme.style.setProperty('--tsr-comp-motion-duration', '10s')
    const hiddenWrapper = () =>
      query(
        ".data-grid__body-cell .cell__button--hidden:not([data-button-active='true'])",
      )[0]
    // Прокрутка идёт всё время наведения: по пикселю туда-обратно.
    let step = 1
    const scrolling = setInterval(() => {
      scroller.scrollTop += step
      step = -step
    }, 30)
    try {
      await expect
        .poll(() => scroller.hasAttribute('data-scrolling'))
        .toBe(true)
      const wrapper = hiddenWrapper()
      const full = wrapper
        .querySelector('button')!
        .getBoundingClientRect().width
      // Ячейка всё время сдвигается прокруткой — Playwright не ждёт неподвижности.
      await userEvent.hover(wrapper.closest('.data-grid__body-cell')!, {
        force: true,
      })
      expect(scroller.hasAttribute('data-scrolling')).toBe(true)
      expect(wrapper.getBoundingClientRect().width, 'while scrolling').toBe(
        full,
      )
      clearInterval(scrolling)

      await userEvent.hover(document.body)
      const next = query(
        ".data-grid__body-cell .cell__button--hidden:not([data-button-active='true'])",
      ).find(
        el =>
          el !== wrapper &&
          el.getBoundingClientRect().width === 0 &&
          el.getBoundingClientRect().height > 0,
      )!
      await settleIntoView(next.closest('.data-grid__body-cell')!)
      await moveMouseTo(next.closest('.data-grid__body-cell')!)
      await expect
        .poll(() => next.getBoundingClientRect().width)
        .toBeGreaterThan(0)
      expect(
        next.getBoundingClientRect().width,
        'after scrolling',
      ).toBeLessThan(full)
    } finally {
      clearInterval(scrolling)
      theme.style.removeProperty('--tsr-comp-motion-duration')
    }
  })

  test('MO3 prefers-reduced-motion switches every transition off with one rule', async () => {
    await renderAll()
    await reducedMotion(true)
    for (const [name, el] of await sampled()) {
      for (const part of list(read(el, 'transition-duration'))) {
        expect(part, `${name} duration`).toBe('0s')
      }
    }
  })
})
