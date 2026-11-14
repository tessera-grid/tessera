import { type ComponentProps, useMemo } from 'react'
import { composeStory } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'

import * as playground from '../../DataGrid.Playground.stories'
import { StoryComponent } from '../../DataGridStory'
import { normalizeArgs } from '../../__mocks__/utils/normalizeArgs'

import { getData } from '../../__mocks__/data'
import { useColumns } from '../../__mocks__/columns'
import { useCreateTable } from '../../../core/useCreateTable'
import type { TesseraFeatureEntry } from '../../../core/features'
import { DataGrid } from '../../../grid/DataGrid'
import type { DataMode } from '../../../core/dataMode'
import type { Draft } from '../../../core/drafts/drafts'
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
  /** Режим данных (ADR 0169) — серверный фильтр для черновиков (ADR 0178, DR13). */
  dataMode?: DataMode
  /** Черновики при монтировании (ADR 0178). */
  initialDrafts?: readonly Draft[]
  /** Пределы записи (ADR 0223); `false` — замер без них. */
  writeLimits?: { confirm?: number; max?: number } | false
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
  dataMode,
  initialDrafts,
  writeLimits,
}: PluginsGridProps) => {
  const columns = useColumns(columnCount)
  const data = useMemo(
    () => dataOverride ?? getData(dataCount),
    [dataOverride, dataCount],
  )
  const table = useCreateTable({
    columns: columns as never,
    data,
    locale,
    dataMode,
    initialDrafts,
    writeLimits,
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

/**
 * Песочница грида без консоли истории: перф-кейсы меряют грид, а не журнал обвязки — консоль
 * перерисовывает историю и таблицу записей на каждый колбэк. Аргументы меты — те же.
 */
const BareGrid = composeStory(
  {
    ...playground.DataGridPlayground,
    render: args => <StoryComponent {...normalizeArgs(args)} />,
  },
  playground.default,
)

/** Грид перф-кейса с размерами `renderGrid` из `helpers`, без консоли истории. */
export const renderGrid = (
  args: Partial<ComponentProps<typeof BareGrid>> = {},
) =>
  render(
    <BareGrid
      containerHeight={600}
      height={500}
      columnCount={20}
      dataCount={300}
      {...args}
    />,
  )
