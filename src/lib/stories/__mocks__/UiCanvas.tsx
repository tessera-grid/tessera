// Холст историй UI-примитивов `/ui`: тема грида и, по выбору, рамка ячейки или
// строки — в ней кнопки проявляются при наведении, как в гриде.
import type { CSSProperties, ReactNode } from 'react'

import '../../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../core/themeVariables'

const HOSTS = {
  cell: { className: 'data-grid__body-cell', 'data-cell-interact': 'true' },
  head: { className: 'data-grid__head-cell' },
  row: { className: 'data-grid__body-row', 'data-row-interact': 'true' },
}

const hostStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 12px',
  border: '1px solid var(--tsr-sys-border)',
  borderRadius: 6,
  background: 'var(--tsr-sys-surface)',
}

interface UiCanvasProps {
  /** Рамка с глобальным классом грида: кнопки внутри скрыты до наведения. */
  host?: keyof typeof HOSTS
  /** Подпись в рамке — содержимое «ячейки». */
  caption?: string
  width?: number
  children: ReactNode
}

export const UiCanvas = ({ host, caption, width, children }: UiCanvasProps) => (
  <div
    className={DATA_GRID_THEME_CLASS}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 24,
      background: 'var(--tsr-sys-surface)',
      color: 'var(--tsr-sys-fg)',
    }}
  >
    {host ? (
      <div {...HOSTS[host]} style={{ ...hostStyle, width }}>
        {caption && <span style={{ flex: 1 }}>{caption}</span>}
        {children}
      </div>
    ) : (
      children
    )}
  </div>
)
