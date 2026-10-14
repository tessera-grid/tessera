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

const byOrder = (
  a: Pick<ServiceColumn, 'order'>,
  b: Pick<ServiceColumn, 'order'>,
) => a.order - b.order

/**
 * Сервисные колонки в порядке показа: leading по `order`, затем trailing по `order`.
 * Один порядок для вставки колонок и для их закрепления (ADR 0010, IV14).
 */
export const orderServiceColumns = <
  T extends Pick<ServiceColumn, 'side' | 'order'>,
>(
  serviceColumns: readonly T[],
): T[] => [
  ...serviceColumns.filter(c => c.side === 'leading').sort(byOrder),
  ...serviceColumns.filter(c => c.side === 'trailing').sort(byOrder),
]

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

  const ordered = orderServiceColumns(serviceColumns)
  const leading = ordered.filter(c => c.side === 'leading')
  const trailing = ordered.filter(c => c.side === 'trailing')

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
