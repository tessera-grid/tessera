/**
 * Дескриптор действия сортировки (ADR 0012). Инлайн — циклящая иконка-кнопка с
 * бейджем приоритета мультисорта; в кебаб-меню — пункты asc/desc/сброс. Длина
 * сортировки читается через `table.atoms.sorting.get()`; реактивность обеспечивает
 * грид подпиской на `table.atoms.sorting`.
 */
import type { MouseEvent } from 'react'

import clsx from 'clsx'

import type { TableLabels } from '../../core/localization'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'
import type { HeaderAction, HeaderMenuItem } from '../../core/headerActions'
import type { HeaderComponentProps } from '../../core/createSlots'
import { readPluginHooks } from '../../core/definePlugin'
import type { ColumnSortingHooks } from './types'

import styles from '../../plugins/columnSorting/SortButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

type SortDir = 'asc' | 'desc' | 'none'

/** Тематизируемая иконка направления сортировки (читает `useIcons`). */
const SortActionIcon = ({ direction }: { direction: SortDir }) => {
  const { sort, sortAsc, sortDesc } = useIcons()
  const Icon =
    direction === 'asc' ? sortAsc : direction === 'desc' ? sortDesc : sort

  return <Icon width={16} height={16} />
}

/** Число сортируемых столбцов (в v9 читаем из атома, не из getState). */
const getSortingCount = (table: HeaderComponentProps['table']): number =>
  (
    table as unknown as { atoms: { sorting: { get: () => unknown[] } } }
  ).atoms.sorting.get().length

/** Позиция столбца в мультисортировке (1-based) или `null`. */
const getMultiSortPosition = ({
  column,
  table,
}: HeaderComponentProps): { position: number; total: number } | null => {
  const total = getSortingCount(table)
  const index = column.getSortIndex()

  return total > 1 && index >= 0 ? { position: index + 1, total } : null
}

/** Тултип (без приоритета): по СЛЕДУЮЩЕЙ операции. */
const getTitle = (
  { column }: HeaderComponentProps,
  labels: TableLabels,
): string => {
  const operation = column.getIsSorted()
  const next = column.getNextSortingOrder()

  if (!operation && next === 'desc') {
    return labels.sortDescending
  }

  if (!next) {
    return labels.clearSort
  }

  return next === 'asc' ? labels.sortAscending : labels.sortDescending
}

export const sortHeaderAction: HeaderAction = {
  id: 'columnSorting',
  slot: 'rightHeaderSlot',
  order: 1,
  visible: ({ column }) => column.getCanSort(),
  icon: ctx => (
    <SortActionIcon direction={ctx.column.getIsSorted() || 'none'} />
  ),
  label: getTitle,
  ariaLabel: (ctx, labels) => {
    const title = getTitle(ctx, labels)
    const multi = getMultiSortPosition(ctx)

    return multi
      ? `${title}, ${labels.sortPriority(multi.position, multi.total)}`
      : title
  },
  active: ({ column }) => !!column.getIsSorted(),
  className: ({ column }) =>
    clsx('column-sort__button', styles.root, {
      [styles.sorted]: !!column.getIsSorted(),
    }),
  adornment: ctx => {
    const multi = getMultiSortPosition(ctx)

    if (!multi) {
      return null
    }

    return (
      <Bubble
        size="sm"
        className={clsx('column-sort__priority', styles.priority)}
        data-sort-priority={multi.position}
        aria-hidden
      >
        {multi.position}
      </Bubble>
    )
  },
  onSelect: ({ column, table }, event?: MouseEvent<HTMLButtonElement>) => {
    const { onToggleColumnSort } = readPluginHooks<ColumnSortingHooks>(
      table,
      'columnSorting',
    )
    const next = column.getNextSortingOrder()

    column.getToggleSortingHandler()?.(event)
    onToggleColumnSort(column.id, next)
  },
  menuItems: ({ column, table }, labels): HeaderMenuItem[] => {
    const { onToggleColumnSort } = readPluginHooks<ColumnSortingHooks>(
      table,
      'columnSorting',
    )
    const current = column.getIsSorted()

    const setDirection = (desc: boolean, dir: 'asc' | 'desc') => {
      // Явный выбор в меню задаёт направление, заменяя сортировку (без накопления).
      column.toggleSorting(desc, false)
      onToggleColumnSort(column.id, dir)
    }

    const items: HeaderMenuItem[] = [
      {
        id: 'asc',
        label: labels.sortAscending,
        icon: <SortActionIcon direction="asc" />,
        active: current === 'asc',
        onSelect: () => setDirection(false, 'asc'),
      },
      {
        id: 'desc',
        label: labels.sortDescending,
        icon: <SortActionIcon direction="desc" />,
        active: current === 'desc',
        onSelect: () => setDirection(true, 'desc'),
      },
    ]

    if (
      (table.options as { enableSortingRemoval?: boolean }).enableSortingRemoval
    ) {
      items.push({
        id: 'clear',
        label: labels.clearSort,
        icon: <SortActionIcon direction="none" />,
        disabled: !current,
        onSelect: () => {
          column.clearSorting()
          onToggleColumnSort(column.id, false)
        },
      })
    }

    return items
  },
}
