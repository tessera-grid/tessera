/**
 * Инъекция сервисных колонок плагинов. Ядро не знает конкретных
 * плагинов: размещение задаёт `side`, порядок — `order`. Чистая функция —
 * используется и `useCreateTable`, и тестами.
 */
import type { ColumnDef } from '../../types'
import { withPluginBoundary } from '../pluginBoundary'

/**
 * Привязка сервисной колонки плагина к сборке колонок (pre-table инъекция).
 * `make` строит колонку по глубине шапки; `side`/`order` — размещение и порядок.
 */
export interface ServiceColumn {
  /** Стабильный базовый id (по нему таргетят видимость/пиннинг). */
  id: string
  make: (depth: number) => ColumnDef<any, any, any>
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

/** Максимальная глубина вложенности шапки (число уровней). */
export const getMaxColumnsDepth = (
  columns: ColumnDef<any, any, any>[],
): number => {
  if (!columns || columns.length === 0) {
    return 0
  }

  let maxDepth = 0
  const stack: [ColumnDef<any, any, any>[], number][] = [[columns, 1]]

  while (stack.length > 0) {
    const item = stack.pop()

    if (!item) {
      continue
    }

    const [currentColumns, currentDepth] = item
    maxDepth = Math.max(maxDepth, currentDepth)

    for (const col of currentColumns) {
      const group = col as { columns?: ColumnDef<any, any, any>[] }
      if (Array.isArray(group.columns) && group.columns.length > 0) {
        stack.push([group.columns, currentDepth + 1])
      }
    }
  }

  return maxDepth
}

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
 * дедуп по id. `make(depth)` учитывает глубину шапки (сервисная колонка строит
 * группы под вложенной шапкой). Пустой набор пользовательских колонок → пусто.
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

  const depth = getMaxColumnsDepth(initialColumns as ColumnDef<any, any, any>[])

  const leading = serviceColumns.filter(c => c.side === 'leading').sort(byOrder)
  const trailing = serviceColumns
    .filter(c => c.side === 'trailing')
    .sort(byOrder)

  const make = (column: ServiceColumn) =>
    (column.pluginId
      ? withPluginBoundary(column.make(depth), column.pluginId)
      : column.make(depth)) as TColumn

  return dedupeById([
    ...leading.map(make),
    ...initialColumns,
    ...trailing.map(make),
  ])
}

// Агностичные хелперы id/размеров сервисных колонок (публичный API).
export * from './actionColumnParams'
