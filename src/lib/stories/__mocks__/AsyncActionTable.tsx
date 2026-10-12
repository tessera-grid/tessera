import { Fragment, type ReactNode } from 'react'

export interface AsyncActionRow {
  /** Что за кнопка в строке: вариант или форма. */
  label: string
  fails: ReactNode
  succeeds: ReactNode
}

const caption = {
  color: 'var(--tsr-comp-control-color)',
  fontSize: 12,
}

/**
 * Таблица историй «Async action»: строки — варианты и формы кнопки, столбцы — чем
 * кончается действие после ожидания.
 */
export const AsyncActionTable = ({ rows }: { rows: AsyncActionRow[] }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'auto auto auto',
      gap: '12px 24px',
      alignItems: 'center',
      justifyItems: 'start',
    }}
  >
    <span />
    <span style={caption}>Fails — error flash</span>
    <span style={caption}>Succeeds — light fades</span>
    {rows.map(row => (
      <Fragment key={row.label}>
        <span style={caption}>{row.label}</span>
        {row.fails}
        {row.succeeds}
      </Fragment>
    ))}
  </div>
)
