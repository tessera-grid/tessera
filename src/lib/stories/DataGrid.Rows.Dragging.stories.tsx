import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  RowDraggingLazyTreeDemo,
  type RowDraggingLazyTreeDemoProps,
} from './demos/sessionDemos'
import { expect, userEvent, waitFor } from 'storybook/test'
import { settle, updateArgs } from './__mocks__/catalogPlay'
import {
  DRAG_FILL,
  HANDLE,
  OVERLAY,
  ROW,
  beginDrag,
  firePointer,
  nextFrame,
  rowSignatures,
  sortedRows,
} from './rowDragging.dnd'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Перетаскивание строк (ADR 0006). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Dragging',
} satisfies Meta<StoryProps>

export default meta

/**
 * Демо одной перестановки для панели Interactions. Требования (ручка, облако, ширина,
 * автопрокрутка) — именованные тесты `__tests__/row-dragging.test.tsx`; хореография
 * указателя у демо и тестов общая — `rowDragging.dnd.ts`.
 */
const rowDraggingPlay: NonNullable<StoryObj<StoryProps>['play']> = async ({
  args,
  canvasElement,
  step,
}) => {
  // Во время скелета первой загрузки строк данных нет — тянуть нечего.
  if (!args.enableRowDragging || args.loading === 'initial') return

  const canvas = canvasElement

  await waitFor(() =>
    expect(canvas.querySelectorAll(ROW).length).toBeGreaterThan(3),
  )

  await step('drag the first row onto a lower row and drop', async () => {
    const before = rowSignatures(canvas)
    const rows = sortedRows(canvas)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    // Keep x fixed (no horizontal drift) so nesting depth stays 0 on flat data.
    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty) // over the target row
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1) // settle collision/over
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // Sanity for the demo: the drop reordered the rows.
    await waitFor(() =>
      expect(rowSignatures(canvas).join('¦')).not.toBe(before.join('¦')),
    )
    // История заканчивается в покое: облако долетело, слот строки снова обычный —
    // по нему каталог проверяет axe и снимает снимок (ADR 0093).
    await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
  })
}

export const RowDragging: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls([
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
  ]),
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: rowDraggingPlay,
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
    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  parameters: {
    requirements: ['PV9'],
    ...showControls([
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'rowExpandingTreeLines',
      'enableRowDragging',
      'rowDraggingExpandDelay',
      'rowDraggingRevertOnReject',
    ]),
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
    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  parameters: {
    requirements: ['NX9'],
    ...showControls([
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'rowExpandingTreeLines',
      'enableRowDragging',
      'rowDraggingExpandDelay',
      'rowDraggingRevertOnReject',
    ]),
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

/**
 * Перенос в ленивом дереве (ADR 0112): дети групп приходят с «сервера», перенос
 * сохраняется промисом `onRowDragEnd` — ручка ждёт, отказ возвращает строку на место.
 * «Reject next move» и `moveFailMode` — отказ переноса, «Fail next load» — отказ загрузки.
 */
export const RowDraggingLazyTree: StoryObj<RowDraggingLazyTreeDemoProps> = {
  name: 'Lazy tree (server)',
  args: {
    enableRowDragging: true,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 3,
    rowExpandingTreeLines: true,
    loadDelayMs: 900,
    moveDelayMs: 900,
    moveFailMode: 'never',
    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    moveDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    moveFailMode: { control: 'inline-radio', options: ['never', 'always'] },
  },
  parameters: {
    requirements: ['LT14', 'CO19'],
    ...showControls(
      [
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'rowExpandingTreeLines',
        'enableRowDragging',
        'rowDraggingExpandDelay',
        'rowDraggingRevertOnReject',
        'loadDelayMs',
        'moveDelayMs',
        'moveFailMode',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement, id, step }) => {
    const canvas = canvasElement
    const log = () => canvas.ownerDocument.body.textContent ?? ''
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(`${ROW}[data-row-id="${id}"]`)
    const toggle = (id: string) =>
      row(id)!.querySelector<HTMLElement>('.row-expand-button')!
    const order = () =>
      [...canvas.querySelectorAll<HTMLElement>(ROW)]
        .sort((a, b) => a.offsetTop - b.offsetTop)
        .map(item => item.dataset.rowId)
    const slow = { timeout: 5000 }
    await waitFor(() => expect(row('node-1')).not.toBeNull())
    await userEvent.click(toggle('node-0'))
    await waitFor(() => expect(row('node-0-0')).not.toBeNull(), slow)
    await userEvent.click(toggle('node-0-0'))
    await waitFor(() => expect(row('node-0-0-2')).not.toBeNull(), slow)
    await settle()

    /** Держать лист над свёрнутой группой на уровне её детей и отпустить. */
    const dropInto = async (id: string, groupId: string) => {
      const source = row(id)!
      // Сдвиг вправо с запасом: уровень ограничивает группа (облако — без отступа).
      const levelStep =
        2 *
        (source
          .querySelector('[data-column-id="country"]')!
          .getBoundingClientRect().left -
          source.getBoundingClientRect().left)
      const { hx } = await beginDrag(source.querySelector<HTMLElement>(HANDLE)!)
      const target = row(groupId)!.getBoundingClientRect()
      const ty = target.top + target.height / 2
      firePointer('pointermove', document, hx + levelStep, ty)
      await nextFrame()
      firePointer('pointermove', document, hx + levelStep, ty + 1)
      return () => firePointer('pointerup', document, hx + levelStep, ty + 1)
    }

    await step(
      'drop into a lazy group: it loads, the move waits for the server',
      async () => {
        const drop = await dropInto('node-0-0-0', 'node-1')
        await waitFor(
          () => expect(log()).toContain('loadChildren rowId="node-1"'),
          slow,
        )
        await waitFor(() => expect(row('node-1-0')).not.toBeNull(), slow)
        drop()
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(() =>
          expect(row('node-0-0-0')).toHaveAttribute('aria-busy', 'true'),
        )
        await waitFor(
          () => expect(log()).toContain('moved node-0-0-0 to node-1 #0'),
          slow,
        )
        await waitFor(() =>
          expect(row('node-0-0-0')).not.toHaveAttribute('aria-busy'),
        )
        const placed = order()
        expect(placed.indexOf('node-0-0-0')).toBe(placed.indexOf('node-1') + 1)
      },
    )

    await step(
      'the server rejects the next move: the row goes back',
      async () => {
        await userEvent.click(
          [...canvas.ownerDocument.querySelectorAll('button')].find(
            button => button.textContent === 'Reject next move',
          )!,
        )
        const drop = await dropInto('node-0-0-1', 'node-1')
        drop()
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(
          () => expect(log()).toContain('rejected the move of node-0-0-1'),
          slow,
        )
        await waitFor(() => {
          const back = order()
          expect(back.indexOf('node-0-0-1')).toBe(back.indexOf('node-0-0') + 1)
        })
        const handle = row('node-0-0-1')!.querySelector(HANDLE)!
        await waitFor(() =>
          expect(handle).toHaveAttribute('data-error-flash', 'on'),
        )
        expect(row('node-0-0-1')).toHaveAttribute('data-highlight', 'danger')
        // Вспышка отгорела — история в покое.
        await waitFor(
          () => expect(handle).not.toHaveAttribute('data-error-flash', 'on'),
          slow,
        )
      },
    )

    await step(
      'revertOnReject off: the rejected row stays where it was dropped',
      async () => {
        await updateArgs(id, { rowDraggingRevertOnReject: false })
        await userEvent.click(
          [...canvas.ownerDocument.querySelectorAll('button')].find(
            button => button.textContent === 'Reject next move',
          )!,
        )
        const drop = await dropInto('node-0-0-2', 'node-1')
        drop()
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(
          () => expect(log()).toContain('rejected the move of node-0-0-2'),
          slow,
        )
        await waitFor(() =>
          expect(row('node-0-0-2')).toHaveAttribute('data-highlight', 'danger'),
        )
        const kept = order()
        expect(kept.indexOf('node-0-0-2')).toBe(kept.indexOf('node-1') + 1)
        const handle = row('node-0-0-2')!.querySelector(HANDLE)!
        await waitFor(
          () => expect(handle).not.toHaveAttribute('data-error-flash', 'on'),
          slow,
        )
      },
    )
    await settle()
  },
  render: args => <RowDraggingLazyTreeDemo {...normalizeArgs(args)} />,
}
