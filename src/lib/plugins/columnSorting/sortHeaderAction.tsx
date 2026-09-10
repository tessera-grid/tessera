import { MouseEvent } from 'react'

import clsx from 'clsx'

import { HeaderAction, HeaderMenuItem } from '../../core/headerActions'
import { HeaderComponentProps } from '../types'
import { Bubble } from '../../ui/Bubble'
import { useIcons } from '../../ui/icons'

import styles from './SortButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

type SortDir = 'asc' | 'desc' | 'none'

/** Тематизируемая иконка направления сортировки (читает `useIcons`). */
const SortActionIcon = ({ direction }: { direction: SortDir }) => {
  const { sort, sortAsc, sortDesc } = useIcons()
  const Icon = direction === 'asc' ? sortAsc : direction === 'desc' ? sortDesc : sort

  return <Icon width={16} height={16} />
}

/** Позиция столбца в мультисортировке (1-based) или `null`, если не мультисорт. */
const getMultiSortPosition = ({
  column,
  table,
}: HeaderComponentProps): { position: number; total: number } | null => {
  const total = table.getState().sorting.length
  const index = column.getSortIndex()

  return total > 1 && index >= 0 ? { position: index + 1, total } : null
}

/** Тултип (без приоритета): по СЛЕДУЮЩЕЙ операции, как у `SortButton`. */
const getTitle = (
  { column }: HeaderComponentProps,
  labels: Parameters<NonNullable<HeaderAction['label']>>[1],
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

/**
 * Действие сортировки как единый дескриптор (ADR 0012). Инлайн — одна иконка-
 * кнопка, циклящая asc→desc→(сброс), с бейджем приоритета мультисорта
 * (`adornment`) и тултипом по следующей операции; в кебаб-меню разворачивается в
 * отдельные пункты (asc / desc / сброс) одной подгруппой. Инлайн воспроизводит
 * DOM `SortButton` (классы `column-sort__button` / `column-sort__priority`).
 */
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
  subscribe: ({ column, table }) => [
    column.getIsSorted(),
    column.getNextSortingOrder(),
    column.getCanSort(),
    column.getSortIndex(),
    table.getState().sorting.length,
    table.options.enableSorting,
    table.options.enableSortingRemoval,
  ],
  onSelect: ({ column, table }, event?: MouseEvent<HTMLButtonElement>) => {
    const { onToggleColumnSort } = table.getHooks().columnSorting
    const next = column.getNextSortingOrder()

    column.getToggleSortingHandler()?.(event)
    onToggleColumnSort(column.id, next)
  },
  menuItems: ({ column, table }, labels): HeaderMenuItem[] => {
    const { onToggleColumnSort } = table.getHooks().columnSorting
    const current = column.getIsSorted()

    const setDirection = (desc: boolean, dir: 'asc' | 'desc') => {
      // Явный выбор в меню задаёт направление столбца, заменяя сортировку
      // (без накопления мультисорта — оно завязано на модификатор инлайн-клика).
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

    if (table.options.enableSortingRemoval) {
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
