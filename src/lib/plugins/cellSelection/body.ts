/**
 * Вклад интерфейса выделения ячеек в тело (ADR 0170, §5): мышь и копирование над телом,
 * автопрокрутка у края, клавиши выделения.
 */
import type {
  BodyContributions,
  RootHookProps,
} from '../../core/bodyContributions'
import { useCellSelectionAutoScroll } from './autoScroll'
import { copyOnEvent, useCopyAbort } from './copyEvent'
import { cellSelectionKeys } from './keys'
import { extendSelection, startSelection } from './pointer'
import { useRangeHandle } from './rangeHandle'

const useCellSelectionRoot = (props: RootHookProps) => {
  // Автопрокрутка при протяжке выделения у края и за пределами таблицы.
  useCellSelectionAutoScroll(props.table, props.getScrollElement)
  useCopyAbort(props)
  // Маркер угла активного диапазона (ADR 0198).
  return useRangeHandle(props)
}

export const cellSelectionBody: BodyContributions = {
  root: {
    id: 'cellSelection',
    useRoot: useCellSelectionRoot,
    events: {
      mousedown: startSelection,
      hover: extendSelection,
      copy: copyOnEvent,
    },
  },
  keys: cellSelectionKeys,
}
