/**
 * Инъекция сервисных колонок плагинов. Ядро не знает конкретных
 * плагинов: размещение задаёт `side`, порядок — `order`. Чистая функция —
 * используется и `useCreateTable`, и тестами.
 */
import type { ColumnDef } from '../../types'
import type { TableLabels } from '../localization'
import { withPluginBoundary } from '../pluginBoundary'

/** Hidden header label of a service column — a label of its owner (ADR 0182, §8). */
export type ServiceColumnLabel = (labels: TableLabels) => string

/**
 * Binds a plugin's service column into the column set (injected before the table is built).
 * `make` builds the column; `side`/`order` set placement and order.
 */
export interface ServiceColumn {
  /** Stable base id (visibility and pinning target it). */
  id: string
  make: () => ColumnDef<any, any, any>
  /** `id` of the owner plugin; the core sets it when folding plugins (error boundary, ADR 0037). */
  pluginId?: string
  /** Placement in the column SET (not pinning). */
  side: 'leading' | 'trailing'
  order: number
  /**
   * Column pinning — the plugin declares the policy, the core applies it. `when: 'always'`
   * keeps it pinned; `'with-user'` joins the pinned block when the user pinned something on
   * that side.
   */
  pin?: {
    side: 'start' | 'end'
    when: 'always' | 'with-user'
  }
  /** Hidden header label (ADR 0165): the plugin takes it from its own labels. */
  label?: ServiceColumnLabel
  /** Width follows the grid's button from the theme (ADR 0135). */
  controlSized?: boolean
  /** The column takes the free space of the row (ADR 0025). */
  fill?: boolean
}

/** Сведения служебной колонки, которыми ядро метит её при вставке (ADR 0165). */
export type ServiceColumnInfo = Pick<
  ServiceColumn,
  'id' | 'pluginId' | 'label' | 'controlSized' | 'fill'
>

const SERVICE_COLUMN = Symbol('tessera.serviceColumn')

/** Сведения служебной колонки по её описанию; у колонки приложения — `undefined`. */
export const serviceColumnOf = (
  columnDef: object | undefined,
): ServiceColumnInfo | undefined =>
  (columnDef as { [SERVICE_COLUMN]?: ServiceColumnInfo } | undefined)?.[
    SERVICE_COLUMN
  ]

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

  const make = (column: ServiceColumn) => {
    const def = column.pluginId
      ? withPluginBoundary(column.make(), column.pluginId)
      : column.make()
    const info: ServiceColumnInfo = {
      id: column.id,
      pluginId: column.pluginId,
      label: column.label,
      controlSized: column.controlSized,
      fill: column.fill,
    }
    // Символ переживает слияние с `defaultColumn`: TanStack копирует описание спредом.
    return { ...def, [SERVICE_COLUMN]: info } as TColumn
  }

  return dedupeById([
    ...leading.map(make),
    ...initialColumns,
    ...trailing.map(make),
  ])
}

// Агностичные хелперы id/размеров сервисных колонок (публичный API).
export * from './actionColumnParams'
