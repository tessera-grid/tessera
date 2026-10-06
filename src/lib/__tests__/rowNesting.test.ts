/**
 * Шаг вложенности при перетаскивании строки (ADR 0059, RE63): смещение строки-оверлея
 * на уровень — ширина ведущих служебных колонок плюс шаг из темы смонтированного грида.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { afterEach, describe, expect, it } from 'vitest'

import { registerAnnouncer } from '../core/announcer'
import { DEFAULT_LABELS } from '../core/localization'
import { getRowDraggableOffsetLeft } from '../plugins/rowDragging/getRowDraggableOffsetLeft'

const column = (size: number, service: boolean) => ({
  getSize: () => size,
  getIsActionsColumn: () => service,
})

/** Таблица с ведущими служебными колонками 24 и 40 px перед пользовательскими. */
const table = {
  store: {},
  getVisibleLeafColumns: () => [
    column(24, true),
    column(40, true),
    column(150, false),
    column(150, false),
  ],
}

let unregister = () => {}
afterEach(() => unregister())

describe('шаг вложенности при перетаскивании', () => {
  it('RE63: смещение уровня — ширина ведущих служебных колонок плюс шаг из темы; без грида — 16px', () => {
    const offset = () => getRowDraggableOffsetLeft({ table: table as never })
    // Грид не смонтирован — запасной шаг.
    expect(offset()).toBe(24 + 40 + 16)

    // Смонтированный грид с переопределённым шагом в теме.
    unregister = registerAnnouncer(table, {
      labels: DEFAULT_LABELS,
      say: () => {},
      token: name => (name === '--tsr-comp-row-nesting-indent' ? ' 24px' : ''),
    })
    expect(offset()).toBe(24 + 40 + 24)
  })
})
