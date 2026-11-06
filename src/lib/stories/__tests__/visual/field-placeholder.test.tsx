import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Field } from '../../../ui/Field/Field'
import {
  BASE_COMBOS,
  applyCombo,
  auditRoots,
  comboLabel,
  resetCombo,
  styleMeasure,
} from './contrast-helpers'

// Заполнитель поля (ADR 0183, PK26) и его место в матрице контраста (ADR 0089, CX21).

const combo = BASE_COMBOS[0]!

const audit = async (input: React.ReactNode, css = '') => {
  const screen = await render(
    <div className={DATA_GRID_THEME_CLASS} style={{ width: 260 }}>
      <style>{css}</style>
      {input}
    </div>,
  )
  const result = auditRoots('CX21', combo, [screen.container], styleMeasure)
  await screen.unmount()
  return result
}

describe('Заполнитель поля', () => {
  afterEach(() => resetCombo())

  test('PK26: заполнитель поля кита — токен --tsr-comp-field-placeholder-color, не ниже порога текста в обоих режимах, темах и палитрах', async () => {
    for (const each of BASE_COMBOS) {
      await applyCombo(each)
      const screen = await render(
        <div
          className={DATA_GRID_THEME_CLASS}
          style={{ width: 260, background: 'var(--tsr-sys-surface)' }}
        >
          <Field aria-label="Search" placeholder="Search" />
        </div>,
      )
      const field = screen.container.querySelector('input')!
      const { findings, checked } = auditRoots(
        'PK26',
        each,
        [screen.container],
        styleMeasure,
      )
      expect(checked, comboLabel(each)).toBeGreaterThan(0)
      expect(findings, comboLabel(each)).toEqual([])
      const token = document.createElement('span')
      token.style.color = 'var(--tsr-comp-field-placeholder-color)'
      field.after(token)
      expect(getComputedStyle(field, '::placeholder').color).toBe(
        getComputedStyle(token).color,
      )
      await screen.unmount()
    }
  })

  test('CX21: аудит матрицы считает заполнитель пустого поля текстом: бледный заполнитель — находка, поле со значением — нет', async () => {
    const pale = 'input::placeholder { color: #ddd; }'
    const empty = await audit(<input placeholder="Search" />, pale)
    expect(empty.findings.map(finding => finding.key).join()).toContain(
      '| placeholder |',
    )
    expect(empty.findings[0]!.need).toBe(4.5)
    const filled = await audit(
      <input placeholder="Search" defaultValue="Text" />,
      pale,
    )
    expect(filled.findings).toEqual([])
  })
})
