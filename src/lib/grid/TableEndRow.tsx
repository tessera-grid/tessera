/**
 * Строка в конце таблицы перед футером (ADR 0118, §3): заглушка пустого
 * результата или ошибки загрузки встаёт между шапкой и футером. Строка с ячейкой во
 * всю видимую ширину области — как строка ошибки ленты (ADR 0081).
 */
import { type CSSProperties, type ReactNode, useRef, useState } from 'react'

import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'

import styles from './Footer/Footer.module.css'

interface TableEndRowProps {
  /** Ячейка навигации грида или простая ячейка таблицы. */
  navigable: boolean
  columnCount: number
  children: ReactNode
}

export const TableEndRow = ({
  navigable,
  columnCount,
  children,
}: TableEndRowProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState<number>()
  useIsomorphicLayoutEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('.data-grid__container')
    if (!scroller) return
    const observer = new ResizeObserver(() =>
      setViewportWidth(scroller.clientWidth),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} role="rowgroup" className="data-grid__table-end">
      <div role="row" className={styles['table-end__row']}>
        <div
          role={navigable ? 'gridcell' : 'cell'}
          aria-colspan={columnCount || undefined}
          className={styles['table-end__cell']}
          style={
            viewportWidth
              ? ({
                  '--tsr-table-end-viewport': `${viewportWidth}px`,
                } as CSSProperties)
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
