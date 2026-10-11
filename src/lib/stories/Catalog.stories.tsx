import { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/**
 * Холст каталога визуальных состояний (ADR 0093, VR16): в проектах каталога и снимках
 * Chromatic полос прокрутки нет, движение уменьшено, холст вмещает меню и панели. В живом Storybook холст обычный — проверка `play` там пропускается.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Catalog',
} satisfies Meta<StoryProps>

export default meta

export const CatalogCanvas: StoryObj<StoryProps> = {
  name: 'Canvas',
  parameters: { requirements: ['VR16'] },
  args: {
    // Данных и колонок больше окна: у контейнера прокрутки есть что скрывать.
    dataCount: 60,
    columnCount: 20,
    containerHeight: 460,
    height: 360,
    maxHeight: 360,
    enableColumnVisibility: true,
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return

    await waitFor(() =>
      expect(
        canvasElement.querySelector('.data-grid__body-row'),
      ).not.toBeNull(),
    )
    const scroller = canvasElement.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(getComputedStyle(scroller).scrollbarWidth).toBe('none')
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)

    // Холст — обёртка истории в preview — не ниже 640 px и не ниже окна: место под
    // меню и панели; их вмещение проверяют истории наложений (VR6).
    const canvas = canvasElement.firstElementChild!.getBoundingClientRect()
    expect(canvas.height).toBeGreaterThanOrEqual(640)
    expect(canvas.height).toBeGreaterThanOrEqual(window.innerHeight)
  },
}
