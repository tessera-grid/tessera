// HeadRow: строка заголовка (заголовки группы → HeadCell). Перетаскивание колонок
// приносят обёртка серии соседей и декоратор ячейки плагина (ADR 0168, §2).
import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import { Fragment } from 'react'

import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { HeadCell } from './HeadCell'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { useDecorators, wrapWith, wrappersOf } from './pluginWrappers'
import { isCoveredHeader } from '../core/headerSpans'
import { siblingKeyOf } from '../core/columnNodes'
import { getHeaderPinning } from './headCellParams'

import styles from '../grid/HeadRow/HeadRow.module.css'

interface TableHeadRowProps {
  lastGroup: boolean
  headerGroup: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  /** Начала всех колонок в порядке отображения: место заголовка группы (ADR 0207, §2). */
  columnStarts?: number[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
}

/**
 * Серии подряд идущих соседей строки (ADR 0052): у каждой своя обёртка плагина, чтобы
 * перетаскивание шло только среди соседей. Порядок в DOM сохраняется — от него
 * зависит раскладка CSS grid; покрытые заголовки идут в текущую серию.
 */
const siblingRuns = <THeader extends { id: string }>(headers: THeader[]) => {
  const runs: { key: string; headers: THeader[]; ids: string[] }[] = []
  for (const header of headers) {
    const covered = isCoveredHeader(header as never)
    const key = covered ? runs.at(-1)?.key : siblingKeyOf(header as never)
    let run = runs.at(-1)
    if (!run || (key !== undefined && run.key !== key)) {
      run = { key: key ?? '', headers: [], ids: [] }
      runs.push(run)
    }
    run.headers.push(header)
    if (!covered) run.ids.push(header.id)
  }
  return runs
}

export const HeadRow = ({
  lastGroup,
  headerGroup,
  virtualColumns,
  columnStarts = [],
  leftHeaderSlot,
  rightHeaderSlot,
}: TableHeadRowProps) => {
  const { headers } = headerGroup
  const table = headers[0]?.getContext().table
  const wrappers = wrappersOf(table)
  const decorated = useDecorators(wrappers.headCellDecorator, HeadCell, 'Cell')

  const cell = (header: (typeof headers)[number], absoluteLeft?: number) => {
    const props = {
      header,
      leftHeaderSlot,
      rightHeaderSlot,
      absoluteLeft,
    }
    return decorated ? (
      <decorated.Outer key={header.id} {...props} Cell={decorated.Inner} />
    ) : (
      <HeadCell key={header.id} {...props} />
    )
  }

  // Пиннутые заголовки — sticky в потоке; центральные — position:absolute по началу
  // первого листа (вне потока). Спейсер постоянной ширины держит поток. Симметрично телу.
  // Заголовок группы — если в окне колонок хотя бы один его лист (ADR 0207, §2).
  type Item = (typeof headers)[number]
  const inWindow = new Set(virtualColumns.map(column => column.index))
  const startHeaders: Item[] = []
  const endHeaders: Item[] = []
  const centerHeaders: { header: Item; start: number }[] = []
  let at = 0
  for (const header of headers) {
    const from = at
    at += Math.max(1, header.colSpan)
    // Покрытый заголовок не рисуется: его строки занимает растянутый лист над ним.
    if (isCoveredHeader(header)) continue
    const pinned = getHeaderPinning(header).headerPinned
    if (pinned === 'start') startHeaders.push(header)
    else if (pinned === 'end') endHeaders.push(header)
    else {
      for (let index = from; index < at; index++) {
        if (inWindow.has(index)) {
          centerHeaders.push({ header, start: columnStarts[from] ?? 0 })
          break
        }
      }
    }
  }

  // Порядок в DOM: спейсер, левые закреплённые, центральные, правые закреплённые.
  const items = [
    ...startHeaders.map(header => ({ header, node: cell(header) })),
    ...centerHeaders.map(({ header, start }) => ({
      header,
      node: cell(header, start),
    })),
    ...endHeaders.map(header => ({ header, node: cell(header) })),
  ]
  // Серии соседей (ADR 0052): у каждой своя обёртка плагина, перетаскивание — только среди
  // соседей. У плоской шапки серия одна — обёртки нет.
  const nested = (table?.getHeaderGroups().length ?? 1) > 1
  const nodes =
    nested && wrappers.headSeries.length > 0
      ? siblingRuns(items.map(item => item.header)).map(run => (
          <Fragment key={run.ids[0] ?? run.headers[0]!.id}>
            {wrapWith(
              wrappers.headSeries,
              { ids: run.ids },
              items
                .filter(item => run.headers.includes(item.header))
                .map(item => item.node),
            )}
          </Fragment>
        ))
      : items.map(item => item.node)

  return (
    <div
      className={clsx('data-grid__head-row', styles.HeadRow)}
      role="row"
      aria-rowindex={headerGroup.depth + 1}
      data-last-head-row={lastGroup || undefined}
    >
      <VirtualCenterSpacer />
      {/* Один массив с ключами: при закреплении заголовок переезжает, а не монтируется заново. */}
      {nodes}
    </div>
  )
}
