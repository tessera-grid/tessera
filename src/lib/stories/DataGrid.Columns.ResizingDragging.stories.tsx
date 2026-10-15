import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { vrStates } from './__mocks__/catalog'
import {
  applyPseudoStates,
  updateArgs,
  waitForRows,
} from './__mocks__/catalogPlay'
import { expect, waitFor } from 'storybook/test'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  ColumnDraggingServerDemo,
  type ColumnDraggingServerDemoProps,
} from './demos/sessionDemos'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Ширина и порядок колонок (ADR 0013, ADR 0006, ADR 0052): протяжка, перетаскивание, под вложенной шапкой. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Resizing & dragging',
} satisfies Meta<StoryProps>

export default meta

export const ColumnResizing: StoryObj<StoryProps> = {
  name: 'Resizing',
  parameters: showControls(['enableColumnSizing']),
  args: {
    enableColumnSizing: true,
    // Несколько строк, чтобы требование синхронизации ширины шапки и тела
    // (CR8) имело отрисованные body-ячейки для сверки.
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

export const ColumnDragging: StoryObj<StoryProps> = {
  name: 'Dragging',
  parameters: showControls([
    'enableColumnDragging',
    'columnDraggingRevertOnReject',
  ]),
  args: {
    enableColumnDragging: true,
    // Sized to overflow on both axes so the auto-scroll requirements (D26–D28)
    // have real horizontal scroll distance and a vertical axis to stay off.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
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
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  parameters: showControls(
    [
      'headerNesting',
      'enableColumnDragging',
      'columnDraggingRevertOnReject',
      'enableRowDragging',
      'rowDraggingExpandDelay',
      'rowDraggingRevertOnReject',
    ],
    { columnCount: 'колонки задаёт вложенная шапка' },
  ),
}

/** Ручка ширины под наведением (ADR 0093, VR5): наведение — псевдо-состояние. */
export const ResizingStateHandle: StoryObj<StoryProps> = {
  name: 'State: resize handle',
  parameters: {
    ...vrStates('head.resizeHandle'),
    pseudo: { hover: ['.data-grid__head-cell[data-column-id="country"]'] },
    ...showControls(['enableColumnSizing']),
  },
  args: {
    enableColumnSizing: true,
    dataCount: 20,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
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
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  parameters: {
    requirements: ['GB9'],
    ...showControls([
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableColumnSizing',
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableColumnFiltering',
      'columnFilteringDebounceMs',
      'columnFilteringFilteredCount',
      'columnFilteringTimeZone',
    ]),
  },
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

/**
 * Перенос колонок с сервером (ADR 0114): порядок сохраняется промисом `onColumnDragEnd`
 * — ручка ждёт, отказ возвращает колонку к прежним соседям. Ручка — кнопка, раскрывается
 * при наведении на заголовок. «Reject next move» и `moveFailMode` — отказ.
 */
export const ColumnDraggingServer: StoryObj<ColumnDraggingServerDemoProps> = {
  name: 'Dragging — Server',
  args: {
    enableColumnDragging: true,
    enableColumnSorting: true,
    dataCount: 30,
    enableKeyboardNavigation: true,
    moveDelayMs: 900,
    moveFailMode: 'never',
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  argTypes: {
    moveDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    moveFailMode: { control: 'inline-radio', options: ['never', 'always'] },
  },
  parameters: {
    requirements: ['CO12', 'CO17'],
    ...showControls([
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'columnSortingServer',
      'columnSortingRevertOnReject',
      'enableColumnDragging',
      'columnDraggingRevertOnReject',
      'enableKeyboardNavigation',
      'moveDelayMs',
      'moveFailMode',
    ]),
  },
  play: async ({ canvasElement, id, step }) => {
    const doc = canvasElement.ownerDocument
    const log = () => doc.body.textContent ?? ''
    const head = (id: string) =>
      canvasElement.querySelector<HTMLElement>(
        `.data-grid__head-cell[data-column-id="${id}"]`,
      )!
    const order = () =>
      [
        ...canvasElement.querySelectorAll<HTMLElement>(
          '.data-grid__head-cell[data-column-id]',
        ),
      ]
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )
        .map(cell => cell.dataset.columnId)
    const handle = (id: string) =>
      head(id).querySelector<HTMLElement>('.drag__handler--column')!
    const slow = { timeout: 5000 }
    await waitForRows(canvasElement)
    await waitFor(() => expect(head('firstName')).not.toBeNull())

    /** Переставить колонку вправо с клавиатуры — тем же путём, что бросок. */
    const moveRight = async (id: string) => {
      head(id).focus()
      head(id).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      )
    }

    await step(
      'move a column: the handle waits, the server saves the order',
      async () => {
        const before = order().indexOf('country')
        await moveRight('country')
        await waitFor(() => expect(order().indexOf('country')).toBe(before + 1))
        await waitFor(() =>
          expect(handle('country')).toHaveAttribute('aria-busy', 'true'),
        )
        await waitFor(() => expect(log()).toContain('saved the order'), slow)
        await waitFor(() =>
          expect(handle('country')).not.toHaveAttribute('aria-busy'),
        )
      },
    )

    await step(
      'the server rejects the next move: the column goes back',
      async () => {
        ;[...doc.querySelectorAll('button')]
          .find(button => button.textContent === 'Reject next move')!
          .click()
        const before = order()
        await moveRight('lastName')
        await waitFor(() => expect(order()).not.toEqual(before))
        await waitFor(
          () => expect(log()).toContain('rejected the move of lastName'),
          slow,
        )
        await waitFor(() => expect(order()).toEqual(before))
        await waitFor(() =>
          expect(handle('lastName')).toHaveAttribute('data-error-flash', 'on'),
        )
        expect(head('lastName')).toHaveAttribute(
          'data-column-highlight',
          'danger',
        )
        // Вспышка отгорела — история в покое.
        await waitFor(
          () =>
            expect(handle('lastName')).not.toHaveAttribute('data-error-flash'),
          slow,
        )
      },
    )

    await step(
      'revertOnReject off: the rejected column stays where it was dropped',
      async () => {
        await updateArgs(id, { columnDraggingRevertOnReject: false })
        ;[...doc.querySelectorAll('button')]
          .find(button => button.textContent === 'Reject next move')!
          .click()
        const before = order().indexOf('firstName')
        await moveRight('firstName')
        await waitFor(() =>
          expect(order().indexOf('firstName')).toBe(before + 1),
        )
        await waitFor(
          () => expect(log()).toContain('rejected the move of firstName'),
          slow,
        )
        await waitFor(() =>
          expect(head('firstName')).toHaveAttribute(
            'data-column-highlight',
            'danger',
          ),
        )
        expect(order().indexOf('firstName')).toBe(before + 1)
        await waitFor(
          () =>
            expect(handle('firstName')).not.toHaveAttribute('data-error-flash'),
          slow,
        )
      },
    )
  },
  render: args => <ColumnDraggingServerDemo {...normalizeArgs(args)} />,
}
