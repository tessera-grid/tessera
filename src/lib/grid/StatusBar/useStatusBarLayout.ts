// Вид нижней панели по ширине (ADR 0038, SB7–SB13): `full` — одна строка, `compact` —
// одна строка без необязательных подписей, `stacked` — две строки. Вид спускается на
// ступень, когда содержимое шире панели, и поднимается, только когда ширина покрывает
// запомненную ширину содержимого в более полном виде — без мерцания.
import { useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'

export type StatusBarLayout = 'full' | 'compact' | 'stacked'

const OFFSET = '--tsr-comp-status-bar-offset'

/** Сторона без текста и контролов — в двух строках она строку не занимает. */
const isBlank = (side: HTMLElement) =>
  !side.textContent?.trim() &&
  !side.querySelector('button, input, select, svg, img, [role]')

/** Ширина содержимого стороны, даже если сама сторона сжата. */
const contentWidth = (side: HTMLElement) =>
  Math.max(side.scrollWidth, side.getBoundingClientRect().width)

export const useStatusBarLayout = () => {
  const barRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<StatusBarLayout>('full')
  // Ширина, нужная содержимому в полном и компактном виде.
  const needed = useRef<Partial<Record<StatusBarLayout, number>>>({})

  useIsomorphicLayoutEffect(() => {
    const bar = barRef.current
    const start = startRef.current
    const end = endRef.current
    if (!bar || !start || !end) return

    const measure = () => {
      start.toggleAttribute('data-blank', isBlank(start))
      end.toggleAttribute('data-blank', isBlank(end))
      const style = getComputedStyle(bar)
      const padding =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const available = bar.clientWidth - padding
      const gap = parseFloat(style.columnGap) || 0
      const startWidth = contentWidth(start)
      const endWidth = contentWidth(end)
      const empty = (side: HTMLElement) => side.hasAttribute('data-blank')

      if (layout !== 'stacked') {
        const need =
          startWidth + endWidth + (empty(start) || empty(end) ? 0 : gap)
        needed.current[layout] = need
        if (need > available + 0.5) {
          setLayout(layout === 'full' ? 'compact' : 'stacked')
          return
        }
        if (
          layout === 'compact' &&
          (needed.current.full ?? Infinity) <= available
        )
          setLayout('full')
      } else if ((needed.current.compact ?? Infinity) <= available) {
        setLayout('compact')
      }

      // Полный текст стороны `start`, если он обрезан многоточием.
      start.title =
        layout === 'stacked' &&
        [...start.children].some(child => child.scrollWidth > child.clientWidth)
          ? (start.textContent ?? '')
          : ''
    }

    measure()
    // Реакция наблюдателей — в следующем кадре: смена вида меняет размеры наблюдаемых
    // элементов, а изменение в том же кадре — петля ResizeObserver.
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(bar)
    for (const child of [...start.children, ...end.children])
      observer.observe(child)
    // Содержимое скрытой пустой стороны меняет только DOM — размеры не меняются.
    const mutations = new MutationObserver(schedule)
    for (const side of [start, end])
      mutations.observe(side, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
    }
  }, [layout])

  // В двух строках контейнер прокрутки уменьшается на реальную высоту панели.
  useIsomorphicLayoutEffect(() => {
    const bar = barRef.current
    const wrapper = bar?.parentElement
    if (!bar || !wrapper || layout !== 'stacked') return
    const write = () =>
      wrapper.style.setProperty(
        OFFSET,
        `${bar.getBoundingClientRect().height}px`,
      )
    write()
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(write)
    })
    observer.observe(bar)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      wrapper.style.removeProperty(OFFSET)
    }
  }, [layout])

  return { layout, barRef, startRef, endRef }
}
