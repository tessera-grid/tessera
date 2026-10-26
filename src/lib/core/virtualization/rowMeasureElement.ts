import type { Virtualizer } from '../../../vendor/tanstack-virtual/react-virtual'

export const rowMeasureElement = (
  element: HTMLDivElement,
  _entry: ResizeObserverEntry | undefined,
  instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
) => {
  const direction = instance.scrollDirection

  if (direction === 'forward' || direction === null) {
    return element.clientHeight
  }

  const indexKey = Number(element.getAttribute('data-index'))
  const cachedMeasurement = instance.measurementsCache[indexKey]?.size

  return cachedMeasurement || element.clientHeight
}
