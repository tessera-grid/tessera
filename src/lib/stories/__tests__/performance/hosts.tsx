import { useMemo } from 'react'
import { render } from 'vitest-browser-react'

import { getData } from '../../__mocks__/data'
import { useColumns } from '../../__mocks__/columns'
import { useCreateTable } from '../../../core/useCreateTable'
import type { TesseraFeatureEntry } from '../../../core/features'
import { DataGrid } from '../../../grid/DataGrid'
import type { LabelDictionary } from '../../../core/localization'

interface PluginsGridProps {
  columnCount: number
  dataCount: number
  plugins: readonly TesseraFeatureEntry[]
  /** Готовые данные: меряется монтирование, а не генератор. */
  dataOverride?: ReturnType<typeof getData>
  /** Словарь подписей и язык (ADR 0132, LC11). */
  localization?: LabelDictionary
  locale?: string
}

/**
 * Грид без обвязки историй (ADR 0004, «Края оси „плагины“»): та обвязка держит в
 * наборе все фабрики выключенными, а здесь в наборе ровно `plugins`. Размеры — как у
 * `renderGrid`.
 */
const PluginsGrid = ({
  columnCount,
  dataCount,
  plugins,
  dataOverride,
  localization,
  locale,
}: PluginsGridProps) => {
  const columns = useColumns(columnCount)
  const data = useMemo(
    () => dataOverride ?? getData(dataCount),
    [dataOverride, dataCount],
  )
  const table = useCreateTable({
    columns: columns as never,
    data,
    plugins: plugins as never,
  })
  return (
    <div
      style={{
        padding: 16,
        height: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DataGrid
        table={table as never}
        height={500}
        localization={localization}
        locale={locale}
      />
    </div>
  )
}

/** Грид из `useCreateTable` с заданным набором плагинов (по умолчанию — пустым). */
export const renderPluginsGrid = ({
  plugins = [],
  ...props
}: Omit<PluginsGridProps, 'plugins'> & {
  plugins?: readonly TesseraFeatureEntry[]
}) => render(<PluginsGrid plugins={plugins} {...props} />)
