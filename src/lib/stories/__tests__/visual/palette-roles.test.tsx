import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Bubble } from '../../../ui/Bubble'
import { Field } from '../../../ui/Field/Field'
import { contrast, resolveColor, toRgba } from './a11y-helpers'
import {
  BASE_COMBOS,
  applyCombo,
  auditRoots,
  comboLabel,
  resetCombo,
  styleMeasure,
} from './contrast-helpers'

// Роли палитры (ADR 0191): кольцо фокуса (PN3), роли с цифрой (PN4), несохранённое (PN5).

const SURFACE = { background: 'var(--tsr-sys-surface)', width: 260 }

/** Стандартная тема shadcn: то, что задаёт обычное приложение. */
const SHADCN = {
  light: {
    '--foreground': 'oklch(0.145 0 0)',
    '--background': 'oklch(1 0 0)',
    '--card': 'oklch(1 0 0)',
    '--ring': 'oklch(0.708 0 0)',
  },
  dark: {
    '--foreground': 'oklch(0.985 0 0)',
    '--background': 'oklch(0.145 0 0)',
    '--card': 'oklch(0.205 0 0)',
    '--ring': 'oklch(0.556 0 0)',
  },
} as const

const settle = () => {
  for (const animation of document.getAnimations()) animation.finish()
}

describe('Роли палитры', () => {
  afterEach(() => resetCombo())

  test('PN3: кольцо фокуса не зависит от --ring приложения и не ниже 3:1 к фону в запасной палитре и в стандартной shadcn, в обеих темах', async () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const vars of [{}, SHADCN[theme]]) {
        const screen = await render(
          <div
            className={`${DATA_GRID_THEME_CLASS}${theme === 'dark' ? ' dark' : ''}`}
            style={{ ...vars, ...SURFACE }}
          >
            <Field aria-label="Search" />
          </div>,
        )
        const root = screen.container.firstElementChild as HTMLElement
        const field = root.querySelector('input')!
        await userEvent.tab()
        expect(document.activeElement).toBe(field)
        settle()
        const ring = toRgba(getComputedStyle(field).borderTopColor)
        const surface = toRgba(resolveColor(root, 'var(--tsr-sys-surface)'))
        expect(contrast(ring, surface), theme).toBeGreaterThanOrEqual(3)

        root.style.setProperty('--ring', 'rgb(255, 0, 0)')
        settle()
        expect(toRgba(getComputedStyle(field).borderTopColor), theme).toEqual(
          ring,
        )
        await screen.unmount()
      }
    }
  })

  test('PN4: роль с цифрой на заливке держит 4,5:1 к своей цифре, в повышенном контрасте 7:1, в обеих темах', async () => {
    for (const combo of BASE_COMBOS) {
      await applyCombo(combo)
      const screen = await render(
        <div className={DATA_GRID_THEME_CLASS} style={SURFACE}>
          <Bubble tone="active">1</Bubble>
          <Bubble tone="draft">1</Bubble>
          <Bubble tone="error">1</Bubble>
        </div>,
      )
      const { findings, checked } = auditRoots(
        'PN4',
        combo,
        [screen.container],
        styleMeasure,
      )
      expect(checked, comboLabel(combo)).toBeGreaterThanOrEqual(3)
      expect(findings, comboLabel(combo)).toEqual([])
      await screen.unmount()
    }
  })

  test('PN5: роль --tsr-sys-unsaved меняет бабл и новую строку, --warning приложения на них не влияет', async () => {
    const colorsWith = async (vars: Record<string, string>) => {
      const screen = await render(
        <div className={DATA_GRID_THEME_CLASS} style={{ ...vars, ...SURFACE }}>
          <Bubble tone="draft">1</Bubble>
        </div>,
      )
      const root = screen.container.firstElementChild as HTMLElement
      const colors = [
        getComputedStyle(root.querySelector('span')!).backgroundColor,
        resolveColor(root, 'var(--tsr-comp-draft-color)'),
        resolveColor(root, 'var(--tsr-comp-row-new-bg)'),
      ]
      await screen.unmount()
      return colors
    }
    const base = await colorsWith({})
    const own = await colorsWith({ '--tsr-sys-unsaved': 'rgb(10, 120, 200)' })
    expect(own[0]).toBe('rgb(10, 120, 200)')
    expect(own[1]).toBe('rgb(10, 120, 200)')
    expect(own[2]).not.toBe(base[2])
    expect(await colorsWith({ '--warning': 'rgb(0, 255, 0)' })).toEqual(base)
  })
})
