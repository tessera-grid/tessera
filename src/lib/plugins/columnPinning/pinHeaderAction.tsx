import { Column } from '@tanstack/react-table'
import clsx from 'clsx'

import { HeaderAction } from '../../core/headerActions'
import { HeaderComponentProps } from '../types'
import { useIcons } from '../../ui/icons'

import styles from './PinButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

/**
 * Листья ЭТОЙ ячейки заголовка. В режиме reorder-out (ADR 0011) спанящая шапка
 * группы режется на сегменты, поэтому активность и переключение считаем по листьям
 * СЕГМЕНТА (`getLeafHeaders`), а не по всей группе-колонке. Для листовой шапки
 * `getLeafHeaders()` = [сама шапка]. Вне режима — по самой колонке.
 */
const getSegmentLeafColumns = ({
  header,
  column,
  table,
}: HeaderComponentProps): Column<any>[] => {
  const enableLeafPinning = (table.options as { enableLeafPinning?: boolean })
    .enableLeafPinning

  return enableLeafPinning && header
    ? header.getLeafHeaders().map(leafHeader => leafHeader.column)
    : [column]
}

const getIsSegmentLeftPinned = (segmentLeafColumns: Column<any>[]): boolean =>
  segmentLeafColumns.length > 0 &&
  segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'left')

/** Тематизируемая иконка пина (читает `useIcons` как компонент). */
const PinActionIcon = () => {
  const { pin: PinIcon } = useIcons()

  return <PinIcon width={16} height={16} />
}

const togglePin = (ctx: HeaderComponentProps) => {
  const { table } = ctx
  const enableLeafPinning = (table.options as { enableLeafPinning?: boolean })
    .enableLeafPinning

  const segmentLeafColumns = getSegmentLeafColumns(ctx)
  const isSegmentLeftPinned = getIsSegmentLeftPinned(segmentLeafColumns)
  const nextPinned = isSegmentLeftPinned ? false : 'left'

  const { onTogglePin } = table.getHooks().columnPinning

  if (!enableLeafPinning) {
    // Штатный режим (плоская шапка / групповой пиннинг без reorder-out):
    // закрепление живёт на уровне колонки.
    ctx.column.pin(nextPinned)
    onTogglePin(!!nextPinned)

    return
  }

  // Reorder-out: закрепляем/открепляем ровно листья этого сегмента и уводим
  // закреплённые листья влево. `getVisibleLeafColumns`/`getHeaderGroups` сами
  // ставят их слева и режут/склеивают спанящую шапку; sticky-путь замораживает.
  const targetLeafIds = segmentLeafColumns.map(leaf => leaf.id)
  const { left = [], right = [] } = table.getState().columnPinning
  const withoutTargets = left.filter(id => !targetLeafIds.includes(id))
  const nextLeft =
    nextPinned === 'left'
      ? [...withoutTargets, ...targetLeafIds]
      : withoutTargets

  // Пиннинг сегмента точечно (не `column.pin`, который закрепил бы ВСЕ листья
  // группы, а не только сегмент после разреза).
  table.setColumnPinning({ left: nextLeft, right })

  // Естественный порядок листьев — из ДЕРЕВА колонок (обход `.columns`), а не из
  // `getAllLeafColumns()`: последний уже применяет `columnOrder`, поэтому не
  // восстановил бы исходный порядок при откреплении.
  const collectDefinitionLeafIds = (cols: Column<any>[]): string[] =>
    cols.flatMap(col =>
      col.columns.length ? collectDefinitionLeafIds(col.columns) : [col.id],
    )
  const naturalOrder = collectDefinitionLeafIds(table.getAllColumns())

  // Reorder уважает сервисные столбцы: ведущие (selection/expander/drag) держат
  // левый край, замыкающий (rowActions) — правый; пользовательские пиннутые листья
  // встают ПОСЛЕ ведущих сервисных, а не впереди них. Сервисные id в стор пиннинга
  // не пишутся (ядро их срезает) — они лишь занимают своё место в порядке.
  const isServiceColumn = (id: string) =>
    !!table.getColumn(id)?.getIsActionsColumn()
  const pinnedUserLeaves = nextLeft.filter(id => !isServiceColumn(id))
  const withoutPinned = naturalOrder.filter(id => !pinnedUserLeaves.includes(id))
  // Точка вставки — сразу за ведущим блоком сервисных столбцов.
  let insertAt = 0
  while (
    insertAt < withoutPinned.length &&
    isServiceColumn(withoutPinned[insertAt])
  ) {
    insertAt++
  }
  table.setColumnOrder([
    ...withoutPinned.slice(0, insertAt),
    ...pinnedUserLeaves,
    ...withoutPinned.slice(insertAt),
  ])

  onTogglePin(!!nextPinned)
}

/**
 * Действие закрепления столбца как единый дескриптор (ADR 0011): применимость,
 * состояние-тумблер, подпись, иконка и обработчик — данными, а ядро решает подачу
 * (инлайн-кнопка или строка кебаб-меню). Инлайн воспроизводит DOM `PinButton`
 * (класс `column-pin__button`, иконка `pin` 16×16, акцент закреплённого состояния).
 */
export const pinHeaderAction: HeaderAction = {
  id: 'columnPinning',
  slot: 'rightHeaderSlot',
  order: 0,
  visible: ({ column }) => column.getCanPin(),
  icon: () => <PinActionIcon />,
  label: (ctx, labels) =>
    getIsSegmentLeftPinned(getSegmentLeafColumns(ctx))
      ? labels.unpin
      : labels.pin,
  active: ctx => getIsSegmentLeftPinned(getSegmentLeafColumns(ctx)),
  className: ctx =>
    clsx('column-pin__button', styles.root, {
      [styles.pinned]: getIsSegmentLeftPinned(getSegmentLeafColumns(ctx)),
    }),
  subscribe: ({ header, column, table }) => [
    ...getSegmentLeafColumns({ header, column, table } as HeaderComponentProps).map(
      leaf => leaf.getIsPinned(),
    ),
    column.getCanPin(),
    table.options.enableColumnPinning,
  ],
  onSelect: togglePin,
}
