/**
 * Плагин cellErrors (ADR 0150) — ошибки ячеек, которые знает приложение: проверка данных,
 * импорт, ответ сервера. `getCellError` выводит текст ошибки из контекста ячейки; ячейка с
 * текстом показывает красный треугольник в углу (ADR 0177, §5). Работает и без `cellEditing`.
 */
import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { CellErrorMark } from './CellErrorMark'
import type { CellErrorsHooks } from './types'

export interface CellErrorsOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Текст ошибки ячейки по её контексту или `undefined`; читается живо. */
  getCellError?: CellErrorsHooks['getCellError']
}

export const cellErrors = definePlugin<CellErrorsOptions>()({
  id: 'cellErrors',
  // Ошибки влияют на отрисовку ячеек: новая функция — перерисовка (ADR 0039).
  refreshOn: ['getCellError'],
  diagnose: neverInert,
  hooks: o => ({
    getCellError: o.getCellError ?? (() => undefined),
  }),
  slots: [
    {
      id: 'cellErrors',
      slot: 'rightCellSlot',
      order: 'last',
      component: CellErrorMark,
    },
  ],
})
