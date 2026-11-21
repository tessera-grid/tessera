// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'

import { trackStickyGeometry } from '../core/stickyGeometry'

test('событие указателя на window не проверяет попадание в грид', () => {
  const supports = vi.spyOn(CSS, 'supports').mockReturnValue(true)
  const scroller = document.createElement('div')
  const contains = vi.spyOn(scroller, 'contains').mockReturnValue(false)
  const stop = trackStickyGeometry(() => scroller)
  try {
    window.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'mouse' }),
    )
    expect(contains).not.toHaveBeenCalled()
  } finally {
    stop()
    contains.mockRestore()
    supports.mockRestore()
  }
})
