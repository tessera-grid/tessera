/**
 * Дескриптор закрепления столбца (ADR 0011/0024). Логическая сторона `start`/`end`
 * (getIsPinned/pin/state); состояние пиннинга читается из
 * `table.atoms.columnPinning`. Гранулярность под вложенной шапкой — в `visible`:
 * плоская шапка — любая закрепляемая; reorder-out (`enableLeafPinning`) — любая
 * единица; иначе только группа верхнего уровня (`depth === 0`).
 */
import clsx from 'clsx'

import type { Column } from '../../types'
import type { HeaderAction, HeaderMenuItem } from '../../core/headerActions'
import type { HeaderComponentProps } from '../../core/createSlots'
import { useIcons } from '../../ui/icons'
import type { ColumnPinningPlugin, PinSides } from './types'

import styles from '../../plugins/columnPinning/PinButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

type PinSide = 'start' | 'end'
type PinningState = { start: string[]; end: string[] }

/** Разрешённые стороны из `columnDef.meta.pinSides` (по умолчанию `both`). */
const getPinSides = (column: Column<any, any>): PinSides =>
  (column.columnDef.meta as { pinSides?: PinSides } | undefined)?.pinSides ??
  'both'

const isLeafPinningEnabled = (table: HeaderComponentProps['table']): boolean =>
  !!(table.options as { enableLeafPinning?: boolean }).enableLeafPinning

const getPinningState = (table: HeaderComponentProps['table']): PinningState =>
  ((
    table as unknown as {
      atoms: { columnPinning: { get: () => PinningState } }
    }
  ).atoms.columnPinning.get() as PinningState) ?? { start: [], end: [] }

/** Листья сегмента: под reorder-out — листья ячейки заголовка, иначе сама колонка. */
const getSegmentLeafColumns = ({
  header,
  column,
  table,
}: HeaderComponentProps): Column<any, any>[] =>
  isLeafPinningEnabled(table) && header
    ? header.getLeafHeaders().map(leafHeader => leafHeader.column)
    : [column]

/** Сторона закрепления сегмента, если ВСЕ листья на одной стороне, иначе false. */
const getSegmentPinnedSide = (
  segmentLeafColumns: Column<any, any>[],
): PinSide | false => {
  if (segmentLeafColumns.length === 0) {
    return false
  }
  if (segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'start')) {
    return 'start'
  }
  if (segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'end')) {
    return 'end'
  }
  return false
}

/**
 * Можно ли закрепить эту единицу заголовка (гранулярность, ADR 0011). Заменяет
 * v8-обёртку getCanPin: в v9 нет опции per-column canPin — считаем в дескрипторе.
 */
const canPin = ({ column, table }: HeaderComponentProps): boolean => {
  if (!column.getCanPin()) {
    return false
  }
  if (table.getHeaderGroups().length === 1) {
    return true
  }
  if (isLeafPinningEnabled(table)) {
    return true
  }
  // Вложенная шапка: только группа верхнего уровня. Явную просьбу закрепить лист
  // под группой в v9 не предупреждаем здесь (TODO: dev-warn через логгер, ADR 0022).
  return column.depth === 0
}

/** Тематизируемая иконка пина. */
const PinActionIcon = () => {
  const { pin: PinIcon } = useIcons()

  return <PinIcon width={16} height={16} />
}

const pinningHooks = (
  table: HeaderComponentProps['table'],
): ColumnPinningPlugin => table.getHooks() as ColumnPinningPlugin

/**
 * Переключение закрепления сегмента на сторону `side` (тумблер). Штатный путь —
 * `column.pin`; reorder-out точечно двигает листья сегмента и переупорядочивает
 * columnOrder, уводя закреплённые листья к нужному краю.
 */
const togglePin = (ctx: HeaderComponentProps, side: PinSide) => {
  const { table } = ctx
  const segmentLeafColumns = getSegmentLeafColumns(ctx)
  const currentSide = getSegmentPinnedSide(segmentLeafColumns)
  const nextPinned: PinSide | false = currentSide === side ? false : side

  const { onTogglePin } = pinningHooks(table).columnPinning

  if (!isLeafPinningEnabled(table)) {
    ctx.column.pin(nextPinned)
    onTogglePin(!!nextPinned)
    return
  }

  const targetLeafIds = segmentLeafColumns.map(leaf => leaf.id)
  const { start = [], end = [] } = getPinningState(table)
  const startWithout = start.filter(id => !targetLeafIds.includes(id))
  const endWithout = end.filter(id => !targetLeafIds.includes(id))

  const nextStart =
    nextPinned === 'start' ? [...startWithout, ...targetLeafIds] : startWithout
  const nextEnd =
    nextPinned === 'end' ? [...targetLeafIds, ...endWithout] : endWithout

  table.setColumnPinning({ start: nextStart, end: nextEnd })

  const collectDefinitionLeafIds = (cols: Column<any, any>[]): string[] =>
    cols.flatMap(col =>
      col.columns.length ? collectDefinitionLeafIds(col.columns) : [col.id],
    )
  const naturalOrder = collectDefinitionLeafIds(table.getAllColumns())

  const isServiceColumn = (id: string) =>
    !!table.getColumn(id)?.getIsActionsColumn()
  const pinnedStartLeaves = nextStart.filter(id => !isServiceColumn(id))
  const pinnedEndLeaves = nextEnd.filter(id => !isServiceColumn(id))
  const rest = naturalOrder.filter(
    id => !pinnedStartLeaves.includes(id) && !pinnedEndLeaves.includes(id),
  )

  let leadEnd = 0
  while (leadEnd < rest.length && isServiceColumn(rest[leadEnd])) {
    leadEnd++
  }
  let trailStart = rest.length
  while (trailStart > leadEnd && isServiceColumn(rest[trailStart - 1])) {
    trailStart--
  }

  table.setColumnOrder([
    ...rest.slice(0, leadEnd),
    ...pinnedStartLeaves,
    ...rest.slice(leadEnd, trailStart),
    ...pinnedEndLeaves,
    ...rest.slice(trailStart),
  ])

  onTogglePin(!!nextPinned)
}

export const pinHeaderAction: HeaderAction = {
  id: 'columnPinning',
  slot: 'rightHeaderSlot',
  order: 0,
  visible: canPin,
  icon: () => <PinActionIcon />,
  label: (ctx, labels) =>
    getSegmentPinnedSide(getSegmentLeafColumns(ctx))
      ? labels.unpin
      : labels.pin,
  active: ctx => !!getSegmentPinnedSide(getSegmentLeafColumns(ctx)),
  className: ctx =>
    clsx('column-pin__button', styles.root, {
      [styles.pinned]: !!getSegmentPinnedSide(getSegmentLeafColumns(ctx)),
    }),
  // Инлайн-поповер только когда доступны обе стороны — клик неоднозначен.
  inlineAsMenu: ({ column }) => getPinSides(column) === 'both',
  onSelect: ctx => {
    const side: PinSide = getPinSides(ctx.column) === 'end' ? 'end' : 'start'
    togglePin(ctx, side)
  },
  menuItems: (ctx, labels): HeaderMenuItem[] => {
    const sides = getPinSides(ctx.column)
    const current = getSegmentPinnedSide(getSegmentLeafColumns(ctx))

    if (sides !== 'both') {
      const side: PinSide = sides === 'end' ? 'end' : 'start'

      return [
        {
          id: side,
          label: current ? labels.unpin : labels.pin,
          icon: <PinActionIcon />,
          active: current === side,
          onSelect: () => togglePin(ctx, side),
        },
      ]
    }

    return [
      {
        id: 'start',
        label: labels.pinLeft,
        icon: <PinActionIcon />,
        active: current === 'start',
        onSelect: () => togglePin(ctx, 'start'),
      },
      {
        id: 'end',
        label: labels.pinRight,
        icon: <PinActionIcon />,
        active: current === 'end',
        onSelect: () => togglePin(ctx, 'end'),
      },
    ]
  },
}
