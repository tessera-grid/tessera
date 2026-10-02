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
  return [
    ...SAMPLES.map(([name, selector]) => [name, query(selector)[0]] as const),
    ['popover', query('[data-testid="column-visibility-menu"]')[0]] as const,
  ].map(([name, el]) => {
    expect(el, `${name} is rendered`).toBeTruthy()
    return [name, el] as [string, HTMLElement]
  })
}

const list = (value: string) => value.split(',').map(part => part.trim())

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
    expect(read(cell, 'transition-property')).toBe('opacity')
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
