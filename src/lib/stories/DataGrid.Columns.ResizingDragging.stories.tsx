import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import { applyPseudoStates, waitForRows } from './__mocks__/catalogPlay'
import { expect, waitFor } from 'storybook/test'

/** Ширина и порядок колонок (ADR 0013, ADR 0006, ADR 0052): протяжка, перетаскивание, под вложенной шапкой. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Resizing & dragging',
} satisfies Meta<StoryProps>

export default meta

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Resizing',
  args: {
    enableColumnSizing: true,
    // Несколько строк, чтобы требование синхронизации ширины шапки и тела
    // (CR8) имело отрисованные body-ячейки для сверки.
    dataCount: 30,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Dragging',
  args: {
    enableColumnDragging: true,
    // Sized to overflow on both axes so the auto-scroll requirements (D26–D28)
    // have real horizontal scroll distance and a vertical axis to stay off.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

/**
 * Перетаскивание под вложенной шапкой (ADR 0052): лист — среди соседей своей группы,
 * группа — среди соседей уровня целиком. Включите `enableColumnPinning`, чтобы
 * увидеть, что закреплённые узлы не двигаются.
 */
export const HeaderGroupsDragging: StoryObj<StoryProps> = {
  name: 'Dragging under header groups',
  args: {
    headerNesting: 'nested',
    enableColumnDragging: true,
    enableRowDragging: true,
    dataCount: 40,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: {
    controls: {
      exclude: ['columnCount'],
    },
  },
}

/** Ручка ширины под наведением (ADR 0093, VR5): наведение — псевдо-состояние. */
export const ResizingStateHandle: StoryObj<StoryProps> = {
  name: 'State: resize handle',
  parameters: {
    ...vrStates('head.resizeHandle'),
    pseudo: { hover: ['.data-grid__head-cell[data-column-id="country"]'] },
  },
  args: {
    enableColumnSizing: true,
    dataCount: 20,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  play: async ({ canvasElement, id, parameters }) => {
    await waitForRows(canvasElement)
    await applyPseudoStates(id, parameters.pseudo)
  },
}

/**
 * Узкие колонки (ADR 0111): кнопки заголовка, которым не хватает ширины, уходят в
 * кебаб с конца; потяните грип на границе колонок — при расширении они вернутся.
 */
export const NarrowColumns: StoryObj<StoryProps> = {
  name: 'Narrow columns',
  args: {
    enableColumnSizing: true,
    enableColumnSorting: true,
    enableColumnFiltering: true,
    enableColumnPinning: true,
    enableHeaderActionMenu: true,
    headerActionMenuThreshold: 10,
    columnCount: 4,
    dataCount: 20,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
  parameters: { requirements: ['GB9'] },
  play: async ({ canvasElement, step }) => {
    await waitForRows(canvasElement)
    const head = () =>
      canvasElement.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="firstName"]',
      )!
    const kebab = () => head().querySelector('[aria-label^="Column options"]')
    const resizeBy = async (dx: number) => {
      const grip = head().querySelector<HTMLElement>(
        '.resize__handler--column',
      )!
      const r = grip.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const mouse = (type: string, target: EventTarget, at: number) =>
        target.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: at,
            clientY: y,
            button: 0,
            buttons: type === 'mouseup' ? 0 : 1,
          }),
        )
      mouse('mousedown', grip, x)
      mouse('mousemove', document, x + dx / 2)
      mouse('mousemove', document, x + dx)
      mouse('mouseup', document, x + dx)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    await step('narrow column: buttons move into the kebab', async () => {
      await waitFor(() => expect(kebab()).not.toBeNull())
    })
    await step('widen column: buttons return, no kebab', async () => {
      await resizeBy(160)
      await waitFor(() => expect(kebab()).toBeNull())
    })
    await step('narrow again: the kebab is back', async () => {
      await resizeBy(-160)
      await waitFor(() => expect(kebab()).not.toBeNull())
    })
  },
}
