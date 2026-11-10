import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Button } from '../../../ui/Button'
import { Field, SearchField } from '../../../ui/Field/Field'

// Поле ввода кита и общий отступ контрола (ADR 0183, PK25).

const left = (el: Element) => el.getBoundingClientRect().left

/** Левый край текста поля: рамка и отступ от внешнего края. */
const fieldTextInset = (el: Element) => {
  const style = getComputedStyle(el)
  return parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
}

const labelLeft = (button: Element) => {
  const range = document.createRange()
  range.selectNodeContents(button.lastChild!)
  return range.getBoundingClientRect().left
}

describe('Поле ввода кита', () => {
  test('PK25: текст поля, подпись кнопки, лупа поиска и иконка кнопки — на общем отступе контрола (8px) от внешнего края; текст поиска и подпись кнопки со значком — после значка и промежутка кнопки', async () => {
    const view = await render(
      <div className={DATA_GRID_THEME_CLASS} style={{ width: 260 }}>
        <Field aria-label="Plain" data-testid="plain" />
        <SearchField icon={<svg data-testid="loupe" width={16} height={16} />}>
          <Field aria-label="Search" data-testid="search" />
        </SearchField>
        <Button data-testid="text">Reset</Button>
        <Button
          data-testid="icon"
          icon={<svg data-testid="glyph" width={16} height={16} />}
        >
          Retry
        </Button>
      </div>,
    )
    const byId = (id: string) =>
      document.querySelector(`[data-testid="${id}"]`)!
    const plain = byId('plain')
    const search = byId('search')
    expect(fieldTextInset(plain)).toBe(8)
    expect(Math.round(labelLeft(byId('text')) - left(byId('text')))).toBe(8)
    expect(left(byId('loupe')) - left(search)).toBe(8)
    expect(left(byId('glyph')) - left(byId('icon'))).toBe(8)
    // Лупа 16px и промежуток кнопки 6px — как иконка и подпись кнопки.
    expect(fieldTextInset(search)).toBe(8 + 16 + 6)
    expect(Math.round(labelLeft(byId('icon')) - left(byId('icon')))).toBe(
      8 + 16 + 6,
    )
    await view.unmount()
  })
})
