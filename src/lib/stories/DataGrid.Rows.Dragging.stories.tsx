import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { expect, waitFor } from 'storybook/test'
import {
  DRAG_FILL,
  HANDLE,
  OVERLAY,
  ROW,
  beginDrag,
  firePointer,
  nextFrame,
} from './rowDragging.dnd'

/** Перетаскивание строк (ADR 0006). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Dragging',
} satisfies Meta<StoryProps>

export default meta

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

// Группы с детьми и плоские корни: строку есть куда вложить и откуда вынести
// (перестановка — в пределах двух уровней, ADR 0006).
const treeData = [
  ...makeData({ shape: 'flat', count: 2 }),
  ...makeData({ shape: 'tree', count: 4, depth: 2, breadth: 3 }),
]

/**
 * Перетаскивание по дереву с линиями (ADR 0108): слот — скелет строки на уровне броска,
 * линии окна — как после броска. Сдвиньте указатель вправо или влево — уровень слота
 * меняется; на недопустимом уровне полоски красные.
 */
export const RowDraggingTreeLines: StoryObj<StoryProps> = {
  name: 'Tree lines',
  args: {
    dataOverride: treeData,
    enableRowDragging: true,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 1,
    rowExpandingTreeLines: true,
    initialExpanded: true,
    containerHeight: 640,
    height: 540,
    maxHeight: 540,
  },
  parameters: {
    controls: { exclude: ['columnCount', 'dataCount', 'dataOverride'] },
    requirements: ['PV9'],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = canvasElement
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(`${ROW}[data-row-id="${id}"]`)
    const indentOf = (id: string) =>
      parseFloat(
        getComputedStyle(row(id)!.querySelector('[data-column-id="country"]')!)
          .paddingLeft,
      )
    await waitFor(() => expect(row('node-1-1')).not.toBeNull())

    await step(
      'drag a root row into a group: skeleton slot on the nested level, then drop',
      async () => {
        const levelIndent = indentOf('node-1-0')
        const source = row('row-0')!
        const indentCell = source
          .querySelector('[data-column-id="country"]')!
          .getBoundingClientRect()
        const levelStep =
          indentCell.left - source.getBoundingClientRect().left + levelIndent
        const { hx } = await beginDrag(
          source.querySelector<HTMLElement>(HANDLE)!,
        )
        const target = row('node-1-1')!.getBoundingClientRect()
        const ty = target.top + target.height / 2
        firePointer('pointermove', document, hx + levelStep, ty)
        await nextFrame()
        await nextFrame()
        firePointer('pointermove', document, hx + levelStep, ty + 1)
        await waitFor(() => {
          const slot = canvas.querySelector<HTMLElement>(DRAG_FILL)!
          expect(slot.querySelector('[class*="skeleton"]')).not.toBeNull()
          expect(
            parseFloat(
              getComputedStyle(
                slot.querySelector('[data-column-id="country"]')!,
              ).paddingLeft,
            ),
          ).toBe(levelIndent)
        })
        firePointer('pointerup', document, hx + levelStep, ty + 1)
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(() => expect(indentOf('row-0')).toBe(levelIndent))
      },
    )
  },
}

/**
 * Свёрнутые группы (ADR 0109): задержите строку над группой на уровне её детей —
 * через паузу `rowDraggingExpandDelay` группа раскроется, будущий родитель подсвечен.
 * Группы, раскрытые паузой, после броска сворачиваются, кроме группы броска.
 */
export const RowDraggingCollapsedGroups: StoryObj<StoryProps> = {
  name: 'Collapsed groups',
  args: {
    dataOverride: treeData,
    enableRowDragging: true,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 1,
    rowExpandingTreeLines: true,
    containerHeight: 640,
    height: 540,
    maxHeight: 540,
  },
  parameters: {
    controls: { exclude: ['columnCount', 'dataCount', 'dataOverride'] },
    requirements: ['NX9'],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = canvasElement
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(`${ROW}[data-row-id="${id}"]`)
    const indentOf = (id: string) =>
      parseFloat(
        getComputedStyle(row(id)!.querySelector('[data-column-id="country"]')!)
          .paddingLeft,
      )
    await waitFor(() => expect(row('node-2')).not.toBeNull())

    await step(
      'pause over two collapsed groups, drop into the second: the first collapses back',
      async () => {
        const source = row('row-0')!
        // Сдвиг вправо с запасом: текст облака дальше отступа ребёнка, глубже уровень
        // не уходит — его ограничивает группа.
        const levelStep =
          2 *
          (source
            .querySelector('[data-column-id="country"]')!
            .getBoundingClientRect().left -
            source.getBoundingClientRect().left)
        const { hx } = await beginDrag(
          source.querySelector<HTMLElement>(HANDLE)!,
        )
        const holdOver = async (id: string) => {
          const target = row(id)!.getBoundingClientRect()
          const ty = target.top + target.height / 2
          firePointer('pointermove', document, hx + levelStep, ty)
          await nextFrame()
          await nextFrame()
          firePointer('pointermove', document, hx + levelStep, ty + 1)
          return ty + 1
        }
        await holdOver('node-1')
        await waitFor(() => expect(row('node-1-0')).not.toBeNull(), {
          timeout: 3000,
        })
        await waitFor(() =>
          expect(row('node-1')!.hasAttribute('data-row-drop-parent')).toBe(
            true,
          ),
        )
        // Строки ниже доезжают после раскрытия (ADR 0107) — цель меряется на месте.
        await new Promise(resolve => setTimeout(resolve, 400))
        const ty = await holdOver('node-2')
        await waitFor(() => expect(row('node-2-0')).not.toBeNull(), {
          timeout: 3000,
        })
        firePointer('pointerup', document, hx + levelStep, ty)
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(() => expect(row('node-1-0')).toBeNull())
        expect(row('node-2-0')).not.toBeNull()
        await waitFor(() =>
          expect(indentOf('row-0')).toBe(indentOf('node-2-0')),
        )
      },
    )
  },
}
