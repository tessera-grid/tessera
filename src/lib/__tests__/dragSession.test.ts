/**
 * Сессия перетаскивания — срез ядра (ADR 0168, §3).
 * Запуск: npx vitest run --config vitest.node.config.ts dragSession
 */
import { describe, expect, it } from 'vitest'

import {
  ROW_DRAG_SESSION,
  type RowDragSession,
  dropPreviewOf,
} from '../core/dragSession'
import { DEFAULT_ROW_DRAG_OVERLAY_STATE } from '../plugins/rowDragging/types'
import { edgeKey, edges } from './importGraph'

/** Модули грида, которые рисуют сессию; обёртки перетаскивания уходят в плагины на этапе 2. */
const RENDERERS = [
  'lib/grid/Body.tsx',
  'lib/grid/DataGrid.tsx',
  'lib/grid/DataGridTable.tsx',
]

describe('сессия перетаскивания (ADR 0168)', () => {
  it('DM5: сессия перетаскивания — срез ядра: DataGrid, DataGridTable и Body читают её типом ядра и не импортируют плагины; срез rowDragging расширяет тип ядра', () => {
    const fromRenderers = edges().filter(edge =>
      RENDERERS.includes(edge.from.path),
    )
    expect(
      fromRenderers.filter(edge => edge.to.layer === 'plugins').map(edgeKey),
    ).toEqual([])
    expect(
      fromRenderers
        .filter(edge => edge.to.path === 'lib/core/dragSession.ts')
        .map(edge => edge.from.path)
        .sort(),
    ).toEqual(RENDERERS)

    const idle: RowDragSession = DEFAULT_ROW_DRAG_OVERLAY_STATE
    expect(dropPreviewOf({ [ROW_DRAG_SESSION]: idle })).toBeNull()
    expect(
      dropPreviewOf({
        [ROW_DRAG_SESSION]: {
          ...idle,
          activeId: 7,
          fromIndex: 1,
          overIndex: 3,
          depth: 1,
          acceptable: false,
        },
      }),
    ).toEqual({ activeId: '7', from: 1, to: 3, depth: 1, acceptable: false })
  })
})
