import { Fragment, type ReactNode } from 'react'

export interface VariantRow {
  /** Подпись строки: вариант или форма; без подписей у всех строк столбца подписей нет. */
  label?: string
  cells: ReactNode[]
}

const caption = {
  color: 'var(--tsr-comp-control-color)',
  fontSize: 12,
}

/**
 * Таблица вариантов кнопки на холсте истории: подписи столбцов сверху (состояние,
 * исход), подписи строк слева (вариант, форма).
 */
export const VariantGrid = ({
  columns,
  rows,
}: {
  columns?: string[]
  rows: VariantRow[]
}) => {
  const labelled = rows.some(row => row.label !== undefined)
  const count = Math.max(columns?.length ?? 0, ...rows.map(r => r.cells.length))
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${count + (labelled ? 1 : 0)}, auto)`,
        gap: '12px 24px',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
      {columns && (
        <>
          {labelled && <span />}
          {columns.map(column => (
            <span key={column} style={caption}>
              {column}
            </span>
          ))}
        </>
      )}
      {rows.map((row, i) => (
        <Fragment key={row.label ?? i}>
          {labelled && <span style={caption}>{row.label}</span>}
          {row.cells.map((cell, j) => (
            <Fragment key={j}>{cell}</Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  )
}
