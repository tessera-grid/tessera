import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { composed, treeLinesArgs } from '../stories'
import {
  TREE,
  box,
  horizontalAt,
  indentOf,
  railX,
  rowEl,
  snapshot,
  treeGeometry,
  verticalAt,
} from './tree-lines-helpers'

// TL7 (ADR 0102): линии и дуги не пропадают при дробном масштабе страницы — CSS `zoom`,
// как Ctrl+колесо: линия в 1px при привязке к пикселям экрана не должна схлопнуться
// (ADR 0084). Набор идёт и в `npm run test:browsers`.

const ZOOMS = [0.67, 0.8, 0.9, 1.1, 1.25, 1.5]

// Стенд Vitest снимает это окно в масштабе 1.
const viewport = { width: innerWidth, height: innerHeight }
beforeAll(() => page.viewport(900, 700))
afterAll(() => page.viewport(viewport.width, viewport.height))

describe('Tree lines under fractional zoom', () => {
  test('TL7: lines and arcs stay visible at 67–90 % and 110–150 % zoom', async () => {
    for (const zoom of ZOOMS) {
      const screen = await render(
        // Холст истории имеет min-height: 100vh. Ограничиваем его внешнюю рамку,
        // чтобы при увеличении не появилась полоса прокрутки документа.
        <div
          style={{ zoom, height: (innerHeight - 1) / zoom, overflow: 'clip' }}
        >
          <composed.RowExpandingPlayground {...treeLinesArgs} />
        </div>,
      )
      await expect.poll(() => rowEl(TREE.falkland)).not.toBeNull()
      for (let i = 0; i < 3; i++)
        await new Promise(resolve => requestAnimationFrame(resolve))
      const g = treeGeometry()
      const shot = await snapshot()
      // Снимок в масштабе 1: уменьшенный кадр сам растворил бы линию в 1px.
      expect(shot.scale).toBeGreaterThanOrEqual(1)
      const cell = indentOf(TREE.falkland)
      const { top, mid, height } = box(cell)
      const x = railX(cell, 3, g, zoom)
      // Вертикаль поворота, горизонталь после дуги, сквозная линия предка.
      expect(
        verticalAt(shot, x, top + height * 0.25, 4),
        `${zoom} vertical`,
      ).toBe(true)
      expect(
        horizontalAt(shot, x + (g.step - g.gap - 1) * zoom, mid, 4),
        `${zoom} horizontal`,
      ).toBe(true)
      expect(
        verticalAt(shot, railX(cell, 2, g, zoom), mid + height / 4, 4),
        `${zoom} ancestor`,
      ).toBe(true)
      // Дуга: середина поворота между вертикалью и горизонталью.
      const arc = g.radius * (1 - Math.SQRT1_2) * zoom
      expect(
        verticalAt(shot, x + arc, mid - arc, 4) ||
          horizontalAt(shot, x + arc, mid - arc, 4),
        `${zoom} arc`,
      ).toBe(true)
      await screen.unmount()
    }
  })
})
