import type { FilterStubRender } from './filtering/FilterStub'
import type { ErrorStubRender } from './loadError/LoadError'
import type { CSSProperties, ReactNode } from 'react'

import type { TableLabels } from '../core/localization'
import type { ColorMode, ContrastMode } from '../core/themeVariables'
import type { TableIcons } from '../ui/icons'
import type { PluginDiagnostic } from '../core/pluginDiagnostics'

/**
 * Таблица из `useCreateTable` (ADR 0091): тип по форме, без параметров TanStack —
 * таблица с конкретными плагинами и данными к `Table<any, any>` не подходит.
 */
export interface DataGridTable {
  getPluginDiagnostics: () => PluginDiagnostic[]
}

export interface DataGridProps {
  /** Инстанс таблицы, возвращаемый useCreateTable. */
  table: DataGridTable
  /**
   * Тема (ADR 0090): 'auto' — по `.dark` у предка, 'light' и 'dark' — всегда.
   * @default 'auto'
   */
  colorMode?: ColorMode
  /**
   * Повышенный контраст (ADR 0088): 'auto' — по системной настройке
   * prefers-contrast: more, 'more' — всегда, 'standard' — никогда.
   * @default 'auto'
   */
  contrast?: ContrastMode
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
  /**
   * Заглушка пустого результата при активном фильтре или поиске (ADR 0045, FL28):
   * узел или функция от `{ reset }`. По умолчанию — подпись и «Сбросить фильтры».
   */
  filterStub?: FilterStubRender
  /**
   * Заглушка ошибки первой загрузки (ADR 0096): узел или функция от
   * `{ error, retry }`. По умолчанию — иконка, «Couldn't load the data», причина, «Retry».
   */
  errorStub?: ErrorStubRender
  /** Доп. CSS-класс на обёртке грида (несущей `.data-grid-theme`). */
  className?: string
  /** Инлайн-стиль обёртки грида (пер-инстансное переопределение токенов темы). */
  style?: CSSProperties
}
