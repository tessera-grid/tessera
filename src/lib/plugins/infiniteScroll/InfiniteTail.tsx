/**
 * Конец тела ленты (ADR 0081): у края просит следующий блок, пока он в пути рисует
 * скелет-строки; строку ошибки с повтором рисует `InfiniteErrorRow` в конце таблицы.
 * Смена сортировки, фильтров или поиска отменяет загрузку и возвращает тело в начало.
 */
import { useEffect, useRef, useState } from 'react'

import type { BodyEndComponentProps } from '../../core/createSlots'
import { knownCount, rowCountOf } from '../../core/dataMode'
import { useTableState } from '../../core/reactivity'
import { InfiniteLoader, registerLoader } from './loader'
import { infiniteScrollInertReason } from './model'
import type { InfiniteScrollHooks, InfiniteScrollState } from './types'

import styles from './InfiniteTail.module.css'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { rowsOf } from '../../core/rowEngine/rows'

interface InfiniteOptions {
  infiniteScrollHasMore?: boolean
  infiniteScrollThreshold?: number
}

type InfiniteTailProps = BodyEndComponentProps & {
  hooks: Partial<InfiniteScrollHooks>
  state: [InfiniteScrollState, (next: InfiniteScrollState) => void]
}

const sameConditions = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

export const InfiniteTail = ({
  table,
  renderSkeletonRows,
  hooks,
  state: [value, setValue],
}: InfiniteTailProps) => {
  const options = table.options as InfiniteOptions
  const inert = !!infiniteScrollInertReason(table)
  const hasMore = !!options.infiniteScrollHasMore
  const loaded = rowsOf(table, 'core').rows.length
  const bodyRows = table.getRowSource().count()
  const [loader] = useState(() => new InfiniteLoader())
  const sentinelRef = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    loader.update({
      table,
      hooks,
      hasMore,
      loaded,
      rowCount: knownCount(rowCountOf(table)),
      threshold: options.infiniteScrollThreshold,
      inert,
      setValue,
      sentinel: sentinelRef.current,
    })
  })

  // Край проверяется при прокрутке и после смены данных или состояния.
  useEffect(() => {
    if (value.status === 'idle') loader.check()
  }, [loader, loaded, hasMore, value.status, inert])

  useEffect(() => loader.listen(), [loader])

  // Смена условия выборки: ответ на прежнее устарел.
  const conditions = useTableState(table, s => [
    s.sorting,
    s.columnFilters,
    s.globalFilter,
  ])
  const previousConditions = useRef(conditions)
  useEffect(() => {
    if (sameConditions(previousConditions.current, conditions)) return
    previousConditions.current = conditions
    loader.cancel({ abort: true })
    loader.scrollToTop()
  }, [conditions, loader])

  // Ячейки хвоста — только пока его блок пересекает область прокрутки.
  const [tailInView, setTailInView] = useState(true)
  const pending = value.status === 'pending'
  useEffect(() => {
    const sentinel = sentinelRef.current
    const scroller = sentinel?.closest('.data-grid__container')
    const block = sentinel?.parentElement?.querySelector(
      '.data-grid__body--infinite-tail',
    )
    if (!pending || !scroller || !block) return
    const observer = new IntersectionObserver(
      ([entry]) => setTailInView(!!entry?.isIntersecting),
      { root: scroller },
    )
    observer.observe(block)
    return () => {
      observer.disconnect()
      // Следующая загрузка начинается у края — хвост сразу с ячейками.
      setTailInView(true)
    }
  }, [pending])

  // Без грида загрузка не видна: поздний итог не оставляет таблицу «занятой».
  useEffect(() => () => loader.cancel({ abort: false }), [loader])

  // Повтор после отказа просит строка ошибки в конце таблицы (ADR 0118, §3).
  useEffect(() => registerLoader(table, loader), [table, loader])

  if (inert) return null

  return (
    <div style={{ display: 'contents' }} data-testid="infinite-scroll-tail">
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {value.status === 'pending' &&
        value.tailRows > 0 &&
        renderSkeletonRows({
          rowCount: value.tailRows,
          firstRowIndex: bodyRows,
          className: 'data-grid__body--infinite-tail',
          cells: tailInView,
        })}
    </div>
  )
}
