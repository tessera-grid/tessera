import type { CSSProperties, ReactNode } from 'react'

import type { TableLabels } from '../../lib/core/localization'
import type { ColorMode } from '../../lib/core/themeVariables'
import type { TableIcons } from '../../lib/ui/icons'
import type { Table } from '../types'

export interface DataGridProps {
  /** Инстанс таблицы, возвращаемый useCreateTable. */
  table: Table<any, any>
  /**
   * Цветовая схема таблицы (light/dark).
   * @default 'light'
   */
  colorMode?: ColorMode
  /** Переопределение иконок таблицы. */
  icons?: Partial<TableIcons>
  /** Переопределение подписей элементов управления (локализация). */
  localization?: Partial<TableLabels>
  /**
   * number — высота в px; string — в процентах (50%, 100%); auto — контейнер по
   * flexbox с flex: 1.
   */
  height?: number | string | 'auto'
  /** number — max-высота в px; string — в процентах. */
  maxHeight?: number | string
  /** Компонент, отображающийся при отсутствии данных. */
  stub?: ReactNode
  /** Доп. CSS-класс на обёртке грида (несущей `.data-grid-theme`). */
  className?: string
  /** Инлайн-стиль обёртки грида (пер-инстансное переопределение токенов темы). */
  style?: CSSProperties
}
