import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect, waitFor, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  bodyCell,
  headCell,
  settle,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'

/** Закрепление колонок (ADR 0011): с одной и двух сторон, под вложенной шапкой, листья. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Pinning',
} satisfies Meta<StoryProps>

export default meta

export const ColumnPinning: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: showControls(['enableColumnPinning', 'columnPinningLeafPinning']),
  args: {
    enableColumnPinning: true,
    // Sized to overflow on both axes so the sticky requirements (CP10–CP12)
    // have real horizontal scroll distance to prove the pinned offset against.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

export const ColumnPinningTwoSides: StoryObj<StoryProps> = {
  name: 'Two sides',
  parameters: showControls([
    'enableColumnPinning',
    'columnPinningLeafPinning',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableRowActions',
    'rowActionsWidth',
    'rowActionsCollapsedWidth',
    'rowActionsColumn',
  ]),
  args: {
    // Двустороннее закрепление в UI. Стороны задаёт
    // `columnDef.meta.pinSides` (см. mock `columns.tsx`): `country` — только
    // влево (`start`), `total` — только вправо (`end`; инлайн-тумблер без
    // поповера), остальные — обе стороны (инлайн даёт поповер «Закрепить слева /
    // справа»). Колонка
    // действий (`enableRowActions`) авто-закреплена справа: пользовательский
    // right-pin встаёт левее неё (с подложкой и разделителем). По умолчанию у
    // колонки действий подложки нет; как только есть хотя бы один пользовательский
    // правый пин — она входит в правозакреплённый блок и получает ту же подложку.
    enableColumnPinning: true,
    enableRowActions: true,
    enableRowSelection: true,
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

export const HeaderGroupsPinning: StoryObj<StoryProps> = {
  name: 'Header groups',
  args: {
    // Вложенная шапка + пиннинг: закрепляется только группа верхнего уровня
    // целиком. Узкий вьюпорт по горизонтали, чтобы sticky-закрепление
    // было видно при прокрутке.
    headerNesting: 'nested',
    enableColumnPinning: true,
    dataCount: 40,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  parameters: showControls(
    ['headerNesting', 'enableColumnPinning', 'columnPinningLeafPinning'],
    { columnCount: 'колонки задаёт вложенная шапка' },
  ),
}

export const HeaderGroupsLeafPinning: StoryObj<StoryProps> = {
  name: 'Header groups — leaves',
  args: {
    // Reorder-out: под вложенной шапкой можно пиннить любую единицу —
    // лист или группу любого уровня; при закреплении листья цели вырываются к
    // левому краю, а спанящие шапки родителей режутся на сегменты.
    headerNesting: 'nested',
    enableColumnPinning: true,
    columnPinningLeafPinning: true,
    dataCount: 40,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  parameters: showControls(
    ['headerNesting', 'enableColumnPinning', 'columnPinningLeafPinning'],
    { columnCount: 'колонки задаёт вложенная шапка' },
  ),
}

/** Колонки закреплены слева и справа (ADR 0093, VR4): справа — колонка действий. */
export const PinningStateBothSides: StoryObj<StoryProps> = {
  name: 'State: pinned both sides',
  parameters: {
    ...vrStates('body.pinnedStart', 'body.pinnedEnd'),
    ...showControls([
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowActions',
      'rowActionsWidth',
      'rowActionsCollapsedWidth',
      'rowActionsColumn',
    ]),
  },
  args: {
    enableColumnPinning: true,
    // Справа — колонка данных: кнопки колонки действий скрыты до наведения.
    initialColumnPinning: { start: [], end: ['total'] },
    enableRowActions: true,
    enableRowSelection: true,
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await userEvent.click(
      headCell(canvasElement, 'country').querySelector<HTMLElement>(
        '.column-pin__button',
      )!,
    )
    await waitFor(() =>
      expect(bodyCell(canvasElement, 'item-id-0', 'country')).toHaveAttribute(
        'data-cell-pinned',
        'left',
      ),
    )
    // Тело уходит под закреплённые колонки: без прокрутки они не отличаются от обычных.
    const pinnedLeft = () =>
      bodyCell(canvasElement, 'item-id-0', 'country').getBoundingClientRect()
        .left
    const before = pinnedLeft()
    canvasElement.querySelector<HTMLElement>(
      '.data-grid__container',
    )!.scrollLeft = 400
    await waitFor(() =>
      expect(
        canvasElement.querySelector<HTMLElement>('.data-grid__container')!
          .scrollLeft,
      ).toBe(400),
    )
    expect(pinnedLeft()).toBe(before)
    expect(bodyCell(canvasElement, 'item-id-0', 'total')).toHaveAttribute(
      'data-cell-pinned',
      'right',
    )
    await settle()
  },
}
