/**
 * Линия границы колонки во всю видимую высоту (ADR 0197, §2). Строка шапки обрезает своё
 * содержимое, поэтому линия — слой над областью прокрутки грида, а не потомок заголовка:
 * пока грип активен, она стоит на месте черты от верха заголовка до низа видимой части
 * таблицы и следует за ней при смене ширины и прокрутке.
 *
 * Геометрию читают наблюдатели размеров (после раскладки кадра) и прокрутка — не коммит
 * React: чтение в коммите вынуждало бы раскладку всего грида раньше кадра.
 */
import { type RefObject, useLayoutEffect } from 'react'

/** Низ видимой части таблицы: последняя строка или футер, но не ниже области прокрутки. */
const visibleBottom = (scroller: HTMLElement, table: Element | null) => {
  const area =
    scroller.getBoundingClientRect().top +
    scroller.clientTop +
    scroller.clientHeight
  return table ? Math.min(area, table.getBoundingClientRect().bottom) : area
}

export const useResizeLine = (
  wrapperRef: RefObject<HTMLElement | null>,
  strokeRef: RefObject<HTMLElement | null>,
  active: boolean,
  className: string,
) => {
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const stroke = strokeRef.current
    if (!active || !wrapper || !stroke) return
    const scroller = wrapper.closest<HTMLElement>('.data-grid__container')
    const host = scroller?.offsetParent as HTMLElement | null | undefined
    if (!scroller || !host) return
    const cell = wrapper.closest('.data-grid__head-cell') ?? wrapper
    const table = scroller.querySelector('.data-grid__table')
    const line = document.createElement('div')
    line.className = className
    line.setAttribute('aria-hidden', 'true')
    line.dataset.columnResizeLine = ''
    host.append(line)

    let last = ''
    const measure = () => {
      const at = stroke.getBoundingClientRect()
      const area = scroller.getBoundingClientRect()
      const origin = host.getBoundingClientRect()
      const left = area.left + scroller.clientLeft
      const center = at.left + at.width / 2
      const top = cell.getBoundingClientRect().top
      // Граница ушла за край видимой области (прокрутка) — линии нет.
      const hidden = center < left || center > left + scroller.clientWidth
      // Середина линии — на середине черты; толщину задаёт тема.
      const box = [
        center - origin.left - host.clientLeft,
        top - origin.top - host.clientTop,
        Math.max(0, visibleBottom(scroller, table) - top),
      ]
      const next = `${hidden}|${box.join('|')}`
      if (next === last) return
      last = next
      line.hidden = hidden
      line.style.left = `${box[0]}px`
      line.style.top = `${box[1]}px`
      line.style.height = `${box[2]}px`
    }
    measure()
    // Ширина своей колонки, размер области и таблицы — после раскладки кадра.
    const observer = new ResizeObserver(measure)
    observer.observe(cell)
    observer.observe(scroller)
    if (table) observer.observe(table)
    scroller.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', measure)
      line.remove()
    }
  }, [active, wrapperRef, strokeRef, className])
}
