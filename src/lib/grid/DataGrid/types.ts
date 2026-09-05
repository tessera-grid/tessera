import { CSSProperties, ReactNode } from 'react'

import { Table } from '@tanstack/react-table'

import { TableLabels } from '../../core/localization'
import { ColorMode } from '../../core/themeVariables'
import { TableIcons } from '../../ui/icons'

export interface DataGridProps {
  /**
   * Инстанс таблицы, возвращаемый функцией useCreateTable
   */
  table: Table
  /**
   * Цветовая схема таблицы (light/dark).
   * @default 'light'
   */
  colorMode?: ColorMode
  /**
   * Переопределение иконок таблицы. Любую иконку можно заменить своим компонентом.
   */
  icons?: Partial<TableIcons>
  /**
   * Переопределение подписей элементов управления (локализация).
   */
  localization?: Partial<TableLabels>
  /**
   * number - числовое значение высоты таблицы
   *
   * string - значение высоты таблицы в процентном соотношении (50%, 100% etc.)
   *
   * auto - контейнер таблицы ведет себя по правилам flexbox со значением flex: 1
   * */
  height?: number | string | 'auto'
  /**
   * number - числовое значение максимальной высоты таблицы
   *
   * string - значение максимальной высоты таблицы в процентном соотношении (50%, 100% etc.)
   */
  maxHeight?: number | string
  /**
   * Компонент, отображающийся при отсутствии данных в таблице
   */
  stub?: ReactNode
  /**
   * Дополнительный CSS-класс на обёртке грида (несущей `.data-grid-theme`).
   * Удобно для скоупинга переопределений темы под конкретный инстанс.
   */
  className?: string
  /**
   * Инлайн-стиль обёртки грида. Основное назначение — пер-инстансное
   * переопределение токенов темы: `style={{ '--data-grid-loader-bar': '#f00' }}`
   * (инлайн бьёт дефолты слоя `.data-grid-theme`). Также принимает обычные
   * CSS-свойства.
   */
  style?: CSSProperties
}
