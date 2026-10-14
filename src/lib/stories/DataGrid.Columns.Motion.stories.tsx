import { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  headCell,
  settle,
  updateArgs,
  waitForRows,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  ColumnDraggingServerDemo,
  type ColumnDraggingServerDemoProps,
} from './demos/sessionDemos'

/**
 * Движение колонок (ADR 0115): перенос с клавиатуры (`Alt+Shift+←/→`), из меню ручки и
 * откат после отказа сервера двигают колонки к новым местам. Выключите
 * `enableColumnAnimation`, чтобы сравнить с мгновенной сменой.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Motion',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  containerHeight: 400,
  height: 300,
  maxHeight: 300,
  dataCount: 30,
  enableColumnDragging: true,
  enableKeyboardNavigation: true,
}

export const ColumnMotionServer: StoryObj<ColumnDraggingServerDemoProps> = {
  name: 'Keyboard and server rejection',
  args: {
    ...GRID,
    moveDelayMs: 400,
    moveFailMode: 'never',
  },
  argTypes: {
    moveDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    moveFailMode: { control: 'inline-radio', options: ['never', 'always'] },
  },
  // Дымовой сценарий (ADR 0115, CN14): перенос с клавиатуры, откат и смена флага.
  parameters: { requirements: ['CN14'] },
  play: async ({ canvasElement, id, step }) => {
    const doc = canvasElement.ownerDocument
    const log = () => doc.body.textContent ?? ''
    const head = (column: string) => headCell(canvasElement, column)
    await waitForRows(canvasElement)
    await waitFor(() => expect(head('firstName')).not.toBeNull())
    /** Колонки слева направо: двигаем крайние, они видны и до, и после переноса. */
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
        .map(cell => cell.dataset.columnId!)
    const move = (column: string, key: 'ArrowRight' | 'ArrowLeft') => {
      head(column).focus({ preventScroll: true })
      head(column).dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    const slow = { timeout: 5000 }

    // Каталог идёт с уменьшенным движением (снимки стабильны): сценарий проверяет
    // перенос, откат и флаг, плавность — визуальные тесты CN1–CN9.
    await step('a keyboard move puts the column to the right', async () => {
      const [first, second] = order()
      move(first, 'ArrowRight')
      await waitFor(() => expect(order().slice(0, 2)).toEqual([second, first]))
      await waitFor(
        () => expect(head(first)).not.toHaveAttribute('aria-busy'),
        slow,
      )
    })

    await step('a rejected move goes back', async () => {
      ;[...doc.querySelectorAll('button')]
        .find(button => button.textContent === 'Reject next move')!
        .click()
      const before = order()
      move(before[0], 'ArrowRight')
      await waitFor(() => expect(order()).not.toEqual(before))
      await waitFor(
        () => expect(log()).toContain(`rejected the move of ${before[0]}`),
        slow,
      )
      await waitFor(() => expect(order()).toEqual(before))
    })

    await step(
      'without enableColumnAnimation the move still works',
      async () => {
        await updateArgs(id, { enableColumnAnimation: false })
        const [first, second] = order()
        move(second, 'ArrowLeft')
        await waitFor(() =>
          expect(order().slice(0, 2)).toEqual([second, first]),
        )
      },
    )
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[aria-busy="true"][data-column-id]'),
        ).toBeNull(),
      slow,
    )
    await settle()
  },
  render: args => <ColumnDraggingServerDemo {...normalizeArgs(args)} />,
}

/** Без движения: `enableColumnAnimation: false` — смены порядка мгновенны. */
export const ColumnMotionOff: StoryObj<StoryProps> = {
  name: 'Off',
  args: {
    ...GRID,
    enableColumnAnimation: false,
  },
}
