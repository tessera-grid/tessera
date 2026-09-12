import { Column } from '@tanstack/react-table'
import clsx from 'clsx'

import { HeaderAction, HeaderMenuItem } from '../../core/headerActions'
import { HeaderComponentProps } from '../types'
import { useIcons } from '../../ui/icons'
import type { PinSides } from './types'

import styles from './PinButton.module.css'
import '../../grid/cellControls/buttonVisibility.css'

type PinSide = 'left' | 'right'

/**
 * Разрешённые стороны закрепления столбца — из `columnDef.meta.pinSides`, по
 * умолчанию `both` (ADR 0011). Ограничивает только affordance: при `both` инлайн
 * даёт поповер выбора стороны, при одной стороне — прямой тумблер.
 */
const getPinSides = (column: Column<any>): PinSides =>
  column.columnDef.meta?.pinSides ?? 'both'

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

/**
 * Сторона закрепления сегмента: `left`/`right`, если ВСЕ его листья закреплены на
 * одной стороне, иначе `false`. Так частично закреплённая группа (после разреза
 * reorder-out) корректно считается незакреплённой на уровне сегмента.
 */
const getSegmentPinnedSide = (
  segmentLeafColumns: Column<any>[],
): PinSide | false => {
  if (segmentLeafColumns.length === 0) {
    return false
  }

  if (segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'left')) {
    return 'left'
  }

  if (segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'right')) {
    return 'right'
  }

  return false
}

/** Тематизируемая иконка пина (читает `useIcons` как компонент). */
const PinActionIcon = () => {
  const { pin: PinIcon } = useIcons()

  return <PinIcon width={16} height={16} />
}

/**
 * Переключение закрепления сегмента на сторону `side` (тумблер: повторный выбор
 * той же стороны — открепляет; выбор другой стороны — переносит). Штатный путь
 * живёт на уровне колонки (`column.pin`); reorder-out (ADR 0011) точечно двигает
 * листья сегмента между `left`/`right` и переупорядочивает `columnOrder`, уводя
 * закреплённые листья к нужному краю (левые — за ведущими сервисными, правые —
 * перед замыкающим `rowActions`).
 */
const togglePin = (ctx: HeaderComponentProps, side: PinSide) => {
  const { table } = ctx
  const enableLeafPinning = (table.options as { enableLeafPinning?: boolean })
    .enableLeafPinning

  const segmentLeafColumns = getSegmentLeafColumns(ctx)
  const currentSide = getSegmentPinnedSide(segmentLeafColumns)
  const nextPinned: PinSide | false = currentSide === side ? false : side

  const { onTogglePin } = table.getHooks().columnPinning

  if (!enableLeafPinning) {
    // Штатный режим (плоская шапка / групповой пиннинг без reorder-out):
    // закрепление живёт на уровне колонки. `column.pin` сам убирает лист из
    // противоположной стороны при переносе.
    ctx.column.pin(nextPinned)
    onTogglePin(!!nextPinned)

    return
  }

  // Reorder-out: закрепляем/открепляем ровно листья этого сегмента и уводим их к
  // нужному краю. `getVisibleLeafColumns`/`getHeaderGroups` сами ставят их у края
  // и режут/склеивают спанящую шапку; sticky-путь замораживает.
  const targetLeafIds = segmentLeafColumns.map(leaf => leaf.id)
  const { left = [], right = [] } = table.getState().columnPinning
  const leftWithout = left.filter(id => !targetLeafIds.includes(id))
  const rightWithout = right.filter(id => !targetLeafIds.includes(id))

  // Пиннинг сегмента точечно (не `column.pin`, который тронул бы ВСЕ листья
  // группы, а не только сегмент после разреза). Левый пин дописывается в конец
  // левого блока (внутренний край), правый — в начало правого (тоже внутренний
  // край, ближе к прокрутке); замыкающий `rowActions` ядро держит правее.
  const nextLeft =
    nextPinned === 'left' ? [...leftWithout, ...targetLeafIds] : leftWithout
  const nextRight =
    nextPinned === 'right' ? [...targetLeafIds, ...rightWithout] : rightWithout

  table.setColumnPinning({ left: nextLeft, right: nextRight })

  // Естественный порядок листьев — из ДЕРЕВА колонок (обход `.columns`), а не из
  // `getAllLeafColumns()`: последний уже применяет `columnOrder`, поэтому не
  // восстановил бы исходный порядок при откреплении.
  const collectDefinitionLeafIds = (cols: Column<any>[]): string[] =>
    cols.flatMap(col =>
      col.columns.length ? collectDefinitionLeafIds(col.columns) : [col.id],
    )
  const naturalOrder = collectDefinitionLeafIds(table.getAllColumns())

  // Reorder уважает сервисные столбцы: ведущие (selection/expander/drag) держат
  // левый край, замыкающий (rowActions) — правый. Пользовательские пиннутые листья
  // встают между ними: левые — сразу за ведущим сервисным блоком, правые — сразу
  // перед замыкающим. Сервисные id в стор пиннинга не пишутся (ядро их срезает) —
  // они лишь занимают своё место в порядке.
  const isServiceColumn = (id: string) =>
    !!table.getColumn(id)?.getIsActionsColumn()
  const pinnedLeftLeaves = nextLeft.filter(id => !isServiceColumn(id))
  const pinnedRightLeaves = nextRight.filter(id => !isServiceColumn(id))
  const rest = naturalOrder.filter(
    id => !pinnedLeftLeaves.includes(id) && !pinnedRightLeaves.includes(id),
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
    ...pinnedLeftLeaves,
    ...rest.slice(leadEnd, trailStart),
    ...pinnedRightLeaves,
    ...rest.slice(trailStart),
  ])

  onTogglePin(!!nextPinned)
}

/**
 * Действие закрепления столбца как единый дескриптор (ADR 0011/0024):
 * применимость, состояние-тумблер, подпись, иконка и обработчики — данными, а ядро
 * решает подачу. Стороны закрепления берутся из `columnDef.meta.pinSides`:
 *
 * - **`both`** — инлайн подаётся мини-меню (поповер, `inlineAsMenu`) с пунктами
 *   «Закрепить слева / справа»; в кебаб-меню — те же два пункта.
 * - **`left`/`right`** — инлайн подаётся кнопкой-тумблером одной стороны; в кебаб —
 *   одной строкой.
 *
 * Инлайн воспроизводит DOM `PinButton` (класс `column-pin__button`, иконка `pin`
 * 16×16, акцент закреплённого состояния).
 */
export const pinHeaderAction: HeaderAction = {
  id: 'columnPinning',
  slot: 'rightHeaderSlot',
  order: 0,
  visible: ({ column }) => column.getCanPin(),
  icon: () => <PinActionIcon />,
  label: (ctx, labels) =>
    getSegmentPinnedSide(getSegmentLeafColumns(ctx)) ? labels.unpin : labels.pin,
  active: ctx => !!getSegmentPinnedSide(getSegmentLeafColumns(ctx)),
  className: ctx =>
    clsx('column-pin__button', styles.root, {
      [styles.pinned]: !!getSegmentPinnedSide(getSegmentLeafColumns(ctx)),
    }),
  subscribe: ({ header, column, table }) => [
    ...getSegmentLeafColumns({ header, column, table } as HeaderComponentProps).map(
      leaf => leaf.getIsPinned(),
    ),
    column.getCanPin(),
    table.options.enableColumnPinning,
  ],
  // Инлайн-поповер только когда доступны обе стороны — тогда клик неоднозначен.
  // При одной стороне остаётся прямой тумблер (`onSelect`).
  inlineAsMenu: ({ column }) => getPinSides(column) === 'both',
  onSelect: ctx => {
    // Путь одной стороны (инлайн-тумблер): переключаем ровно разрешённую сторону.
    const side: PinSide = getPinSides(ctx.column) === 'right' ? 'right' : 'left'
    togglePin(ctx, side)
  },
  menuItems: (ctx, labels): HeaderMenuItem[] => {
    const sides = getPinSides(ctx.column)
    const current = getSegmentPinnedSide(getSegmentLeafColumns(ctx))

    // Одна сторона — единственная строка-тумблер с подписью Pin/Unpin (как до
    // двустороннего UI); обе — два направленных пункта «слева / справа».
    if (sides !== 'both') {
      const side: PinSide = sides === 'right' ? 'right' : 'left'

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
        id: 'left',
        label: labels.pinLeft,
        icon: <PinActionIcon />,
        active: current === 'left',
        onSelect: () => togglePin(ctx, 'left'),
      },
      {
        id: 'right',
        label: labels.pinRight,
        icon: <PinActionIcon />,
        active: current === 'right',
        onSelect: () => togglePin(ctx, 'right'),
      },
    ]
  },
}
