/**
 * Инъекция сервисных колонок плагинов. Ядро не знает конкретных
 * плагинов: размещение задаёт `side`, порядок — `order`. Чистая функция —
 * используется и `useCreateTable`, и тестами.
 */
import type { ColumnDef } from '../../types'
import { withPluginBoundary } from '../pluginBoundary'

/**
 * Привязка сервисной колонки плагина к сборке колонок (pre-table инъекция).
 * `make` строит колонку; `side`/`order` — размещение и порядок.
 */
export interface ServiceColumn {
  /** Стабильный базовый id (по нему таргетят видимость/пиннинг). */
  id: string
  make: () => ColumnDef<any, any, any>
  /** `id` плагина-владельца; проставляет ядро при свёртке (граница ошибок, ADR 0037). */
  pluginId?: string
  /** Размещение в НАБОРЕ колонок (не пиннинг). */
  side: 'leading' | 'trailing'
  order: number
  /**
   * Пиннинг колонки — политику объявляет плагин, ядро исполняет (columnPinning,
   * фаза E позже). `when: 'always'` — закреплена всегда; `'with-user'` —
   * присоединяется к блоку, когда потребитель сам закрепил что-то с этой стороны.
   */
  pin?: {
    side: 'start' | 'end'
    when: 'always' | 'with-user'
  }
}

/**
 * Структура колонок одной строкой: `id` и вложенность групп. Новый массив с той же
 * структурой (инлайн-колонки) даёт ту же подпись.
 */
export const getColumnsSignature = (columns: readonly unknown[]): string =>
  columns
    .map(column => {
      const {
        id,
        accessorKey,
        columns: children,
      } = column as {
        id?: string
        accessorKey?: string
        columns?: unknown[]
      }
      const key = id ?? accessorKey ?? ''
      return children ? `${key}(${getColumnsSignature(children)})` : key
    })
    .join(',')

const dedupeById = <TColumn>(columns: TColumn[]): TColumn[] => {
  const map = new Map<unknown, TColumn>()
  for (const col of columns) {
    map.set((col as { id?: unknown }).id, col)
  }
  return Array.from(map.values())
}

const byOrder = (a: ServiceColumn, b: ServiceColumn) => a.order - b.order

/**
 * Вставить сервисные колонки: leading — в начало (по order), trailing — в конец,
 * дедуп по id. Пустой набор пользовательских колонок → пусто.
 *
 * Генерик по типу колонки `TColumn`: v9 `ColumnDef` — строгий discriminated union,
 * поэтому инъекция прозрачна к конкретной инстанциации (make кастится к `TColumn`).
 */
export const injectServiceColumns = <TColumn>(
  initialColumns: TColumn[],
  serviceColumns: ServiceColumn[],
): TColumn[] => {
  if (initialColumns.length === 0) {
    return []
  }

  const leading = serviceColumns.filter(c => c.side === 'leading').sort(byOrder)
  const trailing = serviceColumns
    .filter(c => c.side === 'trailing')
    .sort(byOrder)

  const make = (column: ServiceColumn) =>
    (column.pluginId
      ? withPluginBoundary(column.make(), column.pluginId)
      : column.make()) as TColumn

  return dedupeById([
    ...leading.map(make),
    ...initialColumns,
    ...trailing.map(make),
  ])
}

// Агностичные хелперы id/размеров сервисных колонок (публичный API).
export * from './actionColumnParams'
