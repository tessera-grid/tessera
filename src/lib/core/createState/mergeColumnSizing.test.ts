import { describe, expect, it } from 'vitest'

import { mergeColumnSizing } from './mergeColumnSizing'

describe('mergeColumnSizing', () => {
  it('CR17: авто-слайс плагина побеждает контролируемый columnSizing для служебной колонки', () => {
    const external = { actionColumn__rowActions: 200, name: 300 }
    const auto = { actionColumn__rowActions: 120 }

    const merged = mergeColumnSizing(external, {}, auto)

    // Ширину служебной колонки задаёт плагин (120), а не потребитель (200).
    expect(merged.actionColumn__rowActions).toBe(120)
    // Пользовательские колонки контролируемого columnSizing сохраняются.
    expect(merged.name).toBe(300)
  })

  it('CR17: авто-слайс побеждает и внутренний columnSizing, когда внешнего нет', () => {
    const internal = { actionColumn__rowActions: 200 }
    const auto = { actionColumn__rowActions: 120 }

    expect(
      mergeColumnSizing(undefined, internal, auto).actionColumn__rowActions,
    ).toBe(120)
  })

  it('CR17: внешний columnSizing имеет приоритет над внутренним для пользовательских колонок', () => {
    const merged = mergeColumnSizing({ name: 300 }, { name: 150 }, {})

    expect(merged.name).toBe(300)
  })
})
