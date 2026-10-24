/**
 * Кнопка при отказе без красного контура (ADR 0136, FB10): стили кнопок кита и их
 * носителей в гриде не ссылаются на токены красного света — он остаётся только у полосы
 * под шапкой; дуга при отказе гаснет за `--tsr-comp-pending-stop-duration`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = join(process.cwd(), 'src/lib')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/** CSS кнопок: кит, кроме полосы загрузки, и стили кнопок грида и плагинов. */
const BUTTON_CSS = [
  ...readdirSync(join(root, 'ui'), { recursive: true })
    .map(String)
    .filter(path => path.endsWith('.css') && !path.includes('LinearProgress'))
    .map(path => `ui/${path}`),
  'grid/cellControls/buttonVisibility.css',
  'grid/headerActions/ActionButton.module.css',
  'plugins/pagination/Pagination.module.css',
]

describe('Отказ кнопки без красного контура (ADR 0136)', () => {
  it('FB10: стили кнопок кита не ссылаются на --tsr-comp-error-flash-*; угасание дуги при отказе — --tsr-comp-pending-stop-duration', () => {
    expect(BUTTON_CSS.length).toBeGreaterThan(5)
    for (const path of BUTTON_CSS) {
      expect(read(path), path).not.toMatch(/--tsr-comp-error-flash-/)
    }
    expect(read('core/themeVariables/theme.css')).toMatch(
      /--tsr-comp-pending-stop-duration:\s*200ms;/,
    )
    expect(read('ui/ringStates/ringStates.module.css')).toMatch(
      /\[data-phase='stopping'\][\s\S]*?transition: opacity var\(--tsr-comp-pending-stop-duration\)/,
    )
    // Красный свет под шапкой остаётся на своих токенах.
    expect(read('ui/LinearProgress/LinearProgress.module.css')).toMatch(
      /--tsr-comp-error-flash-/,
    )
  })
})
