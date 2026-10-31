import type { StubsOverride } from '../core/stubs'
import type { CSSProperties } from 'react'

import type { LabelDictionary } from '../core/localization'
import type { ColorMode, ContrastMode } from '../ui/theme'
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
  /**
   * Подписи таблицы: строка-шаблон с `{имя}` или функция; формы слова — ключами
   * `<ключ>_<форма>` (ADR 0132).
   */
  localization?: LabelDictionary
  /** Язык форм слова, чисел и списков в подписях (BCP 47), по умолчанию `en-US`. */
  locale?: string
  /**
   * number — высота в px; string — в процентах (50%, 100%); auto — контейнер по
   * flexbox с flex: 1.
   */
  height?: number | string | 'auto'
  /** number — max-высота в px; string — в процентах. */
  maxHeight?: number | string
  /**
   * Свой вид заглушек пустой таблицы по причине (ADR 0123): `noData`, `noColumns`,
   * `columnsHidden`, `filtered`, `loadError` и причины плагинов — узел или функция от
   * `{ action, error }`. Какую заглушку показать, решает грид.
   */
  stubs?: StubsOverride
  /** Доп. CSS-класс на обёртке грида (несущей `.data-grid-theme`). */
  className?: string
  /** Инлайн-стиль обёртки грида (пер-инстансное переопределение токенов темы). */
  style?: CSSProperties
}
