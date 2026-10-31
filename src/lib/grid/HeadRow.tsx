// HeadRow: строка заголовка (заголовки группы → HeadCell). Перетаскивание колонок
// приносят обёртка серии соседей и декоратор ячейки плагина (ADR 0168, §2).
import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import { Fragment } from 'react'

import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { HeadCell } from './HeadCell'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { RightFillerHeadColumn } from './RightFillerHeadColumn'
import { needsRightFiller } from './layout'
import { useDecorators, wrapWith, wrappersOf } from './pluginWrappers'
import { isCoveredHeader } from '../core/headerSpans'
import { siblingKeyOf } from '../core/columnNodes'

import styles from '../grid/HeadRow/HeadRow.module.css'

interface TableHeadRowProps {
  layout: 'grid' | 'flex'
  lastGroup: boolean
  headerGroup: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
  isVirtualColumns: boolean
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
  layout,
  lastGroup,
  headerGroup,
  virtualColumns,
  leftHeaderSlot,
  rightHeaderSlot,
  isVirtualColumns,
}: TableHeadRowProps) => {
  const { headers } = headerGroup
  const wrappers = wrappersOf(headers[0]?.getContext().table)
  const decorated = useDecorators(wrappers.headCellDecorator, HeadCell, 'Cell')

  const cell = (
    header: (typeof headers)[number],
    absoluteLeft?: number,
    plain = false,
  ) => {
    const props = {
      layout,
      header,
      leftHeaderSlot,
      rightHeaderSlot,
      absoluteLeft,
    }
    return decorated && !plain ? (
      <decorated.Outer key={header.id} {...props} Cell={decorated.Inner} />
    ) : (
      <HeadCell key={header.id} {...props} />
    )
  }

  if (!isVirtualColumns) {
    // Покрытый заголовок не рисуется и в сортировке не участвует.
    const renderCell = (header: (typeof headers)[number]) =>
      cell(header, undefined, isCoveredHeader(header))

    return (
      <div
        role="row"
        aria-rowindex={headerGroup.depth + 1}
        style={{ display: 'contents' }}
      >
        {wrappers.headSeries.length > 0
          ? siblingRuns(headers).map(run => (
              <Fragment key={run.ids[0] ?? run.headers[0].id}>
                {wrapWith(
                  wrappers.headSeries,
                  { ids: run.ids },
                  run.headers.map(renderCell),
                )}
              </Fragment>
            ))
          : headers.map(renderCell)}
        {needsRightFiller(headers.at(-1)?.getLeafHeaders().at(-1)?.column) && (
          <RightFillerHeadColumn
            gridRow={headerGroup.depth + 1}
            hasBorderBottom={!lastGroup}
            hasBorderRight
          />
        )}
      </div>
    )
  }

  // Пиннутые заголовки — sticky в потоке; центральные — position:absolute по своему
  // `left` (вне потока). Спейсер постоянной ширины держит поток. Симметрично телу.
  const startHeaders: typeof headers = []
  const endHeaders: typeof headers = []
  const centerHeaders: { header: (typeof headers)[number]; start: number }[] =
    []
  for (const virtualColumn of virtualColumns) {
    const header = headers[virtualColumn.index]
    const pinned = header.column.getIsPinned()
    if (pinned === 'start') startHeaders.push(header)
    else if (pinned === 'end') endHeaders.push(header)
    else centerHeaders.push({ header, start: virtualColumn.start })
  }

  return (
    <div
      className={clsx('data-grid__head-row', styles.HeadRow)}
      role="row"
      aria-rowindex={headerGroup.depth + 1}
    >
      <VirtualCenterSpacer />
      {/* Один массив с ключами: при закреплении заголовок переезжает, а не монтируется заново. */}
      {[
        ...startHeaders.map(header => cell(header)),
        ...centerHeaders.map(({ header, start }) => cell(header, start)),
        ...endHeaders.map(header => cell(header)),
      ]}
    </div>
  )
}
