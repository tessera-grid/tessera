/**
 * Кнопка «Раскрыть всё / Свернуть всё» в шапке колонки раскрытия (ADR 0160, §2): «Раскрыть
 * всё», если есть свёрнутые строки, иначе «Свернуть всё». В серверной модели строк
 * раскрытие всего — срез «всё, кроме»; в клиентском — `expanded: true` и сессия, в которой
 * ленивые строки окна грузят детей.
 */
import clsx from 'clsx'

import { reportAction, sourceOf } from '../../core/debugActions'
import type { PluginHeaderProps } from '../../core/definePlugin'
import { isExpandedAll } from '../../core/expandAll'
import { useLocalization } from '../../core/localization'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { useSlice } from '../../core/reactivity'
import { IconButton } from '../../ui/IconButton'
import { useIcons } from '../../ui/icons'
import styles from './ExpandButton.module.css'
import type { Row } from '../../types'
import type { RowExpandingHooks } from './types'

interface ExpandAllTable {
  getPreExpandedRowModel: () => { flatRows: Row<any, any>[] }
  setExpanded: (value: unknown) => void
  setRowExpandAll?: (on: boolean) => void
}

/** Есть раскрываемая строка, показанная свёрнутой. */
const hasCollapsedRows = (table: ExpandAllTable) =>
  table
    .getPreExpandedRowModel()
    .flatRows.some(row => row.getCanExpand() && !row.getIsExpanded())

export const ExpandAllComponent = ({
  table,
}: PluginHeaderProps<Partial<RowExpandingHooks>>) => {
  const value = useSlice(table, 'expanded') as unknown
  const session = useSlice(table, 'rowExpandAll' as never) as
    boolean | undefined
  const labels = useLocalization()
  const { expandAll: ExpandAllIcon, collapseAll: CollapseAllIcon } = useIcons()
  const t = table as unknown as ExpandAllTable
  const server = !!serverRowModelReason(table)
  // Кнопку выключает аргумент фабрики `expandAll: false` (ADR 0160, §2).
  const enabled = (table.options as { rowExpandAllButton?: boolean })
    .rowExpandAllButton

  const allOpen =
    value === true ||
    (isExpandedAll(value)
      ? value.except.length === 0
      : !server && (!!session || !hasCollapsedRows(t)))
  const label = allOpen ? labels.collapseAll : labels.expandAll
  // Как у кнопки строки: свой значок «свернуть всё» заменяет шеврон и не поворачивается.
  const swapped = allOpen && CollapseAllIcon !== ExpandAllIcon
  const Icon = swapped ? CollapseAllIcon : ExpandAllIcon

  if (!enabled) return null

  const onClick = (event: unknown) => {
    reportAction(table, {
      plugin: 'rowExpanding',
      action: allOpen ? 'collapseAll' : 'expandAll',
      source: sourceOf(event),
    })
    if (allOpen) {
      t.setRowExpandAll?.(false)
      t.setExpanded({})
      return
    }
    if (server) {
      t.setExpanded({ all: true, except: [] })
      return
    }
    t.setExpanded(true)
    t.setRowExpandAll?.(true)
  }

  return (
    <IconButton
      className="row-expand-all-button"
      label={label}
      onClick={onClick}
    >
      <Icon
        width={16}
        height={16}
        className={clsx(styles.icon, allOpen && !swapped && styles.expanded)}
      />
    </IconButton>
  )
}

ExpandAllComponent.displayName = 'ExpandAllComponent'
