import type { ReactNode } from 'react'

import { VariantGrid } from './VariantGrid'

export interface AsyncActionRow {
  /** Что за кнопка в строке: вариант или форма. */
  label: string
  fails: ReactNode
  succeeds: ReactNode
}

/**
 * Таблица историй «Async action»: строки — варианты и формы кнопки, столбцы — чем
 * кончается действие после ожидания.
 */
export const AsyncActionTable = ({ rows }: { rows: AsyncActionRow[] }) => (
  <VariantGrid
    columns={['Fails — error flash', 'Succeeds — arc fades']}
    rows={rows.map(({ label, fails, succeeds }) => ({
      label,
      cells: [fails, succeeds],
    }))}
  />
)
