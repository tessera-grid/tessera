import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { HeaderComponentProps } from '../types'
import { PinButton } from './PinButton'

export const ColumnPinningComponent = memo(
  ({ header, column, table }: HeaderComponentProps) => {
    const enableLeafPinning = (table.options as { enableLeafPinning?: boolean })
      .enableLeafPinning

    // Листья ЭТОЙ ячейки заголовка. В режиме reorder-out (ADR 0011) спанящая шапка
    // группы может быть разрезана на сегменты, поэтому активность кнопки и её
    // переключение считаем по листьям СЕГМЕНТА (`getLeafHeaders`), а не по всей
    // группе-колонке: иначе `column.getIsPinned()` агрегирует по всем листьям и
    // сегмент над откреплённым листом остаётся «активным». Для листовой шапки
    // getLeafHeaders() = [сама шапка]. Вне режима — прежнее поведение по колонке.
    const segmentLeafColumns =
      enableLeafPinning && header
        ? header.getLeafHeaders().map(leafHeader => leafHeader.column)
        : [column]

    useSubscribeStore(() => [
      ...segmentLeafColumns.map(leaf => leaf.getIsPinned()),
      column.getCanPin(),
      table.options.enableColumnPinning,
    ])

    if (!column.getCanPin()) {
      return null
    }

    const isSegmentLeftPinned =
      segmentLeafColumns.length > 0 &&
      segmentLeafColumns.every(leaf => leaf.getIsPinned() === 'left')
    const nextPinned = isSegmentLeftPinned ? false : 'left'

    const handleClick = () => {
      const { onTogglePin } = table.getHooks().columnPinning

      if (!enableLeafPinning) {
        // Штатный режим (плоская шапка / групповой пиннинг без reorder-out):
        // закрепление живёт на уровне колонки.
        column.pin(nextPinned)
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

      // Естественный порядок листьев — из ДЕРЕВА колонок (обход `.columns`), а не
      // из `getAllLeafColumns()`: последний уже применяет `columnOrder`, поэтому
      // не восстановил бы исходный порядок при откреплении.
      const collectDefinitionLeafIds = (cols: typeof column[]): string[] =>
        cols.flatMap(col =>
          col.columns.length
            ? collectDefinitionLeafIds(col.columns)
            : [col.id],
        )
      const naturalOrder = collectDefinitionLeafIds(table.getAllColumns())

      // Reorder уважает сервисные столбцы: ведущие (selection/expander/drag) держат
      // левый край, замыкающий (rowActions) — правый; пользовательские пиннутые
      // листья встают ПОСЛЕ ведущих сервисных, а не впереди них. Сервисные id в
      // сам стор пиннинга не пишутся (ядро их срезает) — они лишь занимают своё
      // место в порядке.
      const isServiceColumn = (id: string) =>
        !!table.getColumn(id)?.getIsActionsColumn()
      const pinnedUserLeaves = nextLeft.filter(id => !isServiceColumn(id))
      const withoutPinned = naturalOrder.filter(
        id => !pinnedUserLeaves.includes(id),
      )
      // Точка вставки — сразу за ведущим блоком сервисных столбцов.
      let insertAt = 0
      while (insertAt < withoutPinned.length && isServiceColumn(withoutPinned[insertAt])) {
        insertAt++
      }
      table.setColumnOrder([
        ...withoutPinned.slice(0, insertAt),
        ...pinnedUserLeaves,
        ...withoutPinned.slice(insertAt),
      ])

      onTogglePin(!!nextPinned)
    }

    return <PinButton isPinned={isSegmentLeftPinned} onClick={handleClick} />
  },
)
