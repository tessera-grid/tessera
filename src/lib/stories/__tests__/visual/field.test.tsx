import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Field, SearchField } from '../../../ui/Field/Field'

// Поле ввода кита (ADR 0183, PK25).

const left = (el: Element) => el.getBoundingClientRect().left

describe('Поле ввода кита', () => {
  test('PK25: отступ текста поля от рамки — как у подписи Button (12px); лупа поиска на этом отступе, текст — после лупы и промежутка кнопки', async () => {
    const view = await render(
      <div className={DATA_GRID_THEME_CLASS} style={{ width: 260 }}>
        <Field aria-label="Plain" data-testid="plain" />
        <SearchField icon={<svg data-testid="loupe" width={16} height={16} />}>
          <Field aria-label="Search" data-testid="search" />
        </SearchField>
      </div>,
    )
    const plain = document.querySelector('[data-testid="plain"]')!
    const search = document.querySelector('[data-testid="search"]')!
    const loupe = document.querySelector('[data-testid="loupe"]')!
    expect(getComputedStyle(plain).paddingLeft).toBe('12px')
    expect(left(loupe) - left(search)).toBe(12)
    // Лупа 16px и промежуток кнопки 6px.
    expect(getComputedStyle(search).paddingLeft).toBe(`${12 + 16 + 6}px`)
    await view.unmount()
  })
})
