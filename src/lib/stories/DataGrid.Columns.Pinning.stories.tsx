import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Закрепление колонок (ADR 0011): с одной и двух сторон, под вложенной шапкой, листья. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Pinning',
} satisfies Meta<StoryProps>

export default meta

export const ColumnPinning: StoryObj<StoryProps> = {
  name: 'Basic',
  args: {
    enableColumnPinning: true,
    // Sized to overflow on both axes so the sticky requirements (CP10–CP12)
    // have real horizontal scroll distance to prove the pinned offset against.
    dataCount: 60,
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
  },
}

export const ColumnPinningTwoSides: StoryObj<StoryProps> = {
  name: 'Two sides',
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
    containerHeight: 400,
    height: 300,
    maxHeight: 300,
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

export const HeaderGroupsLeafPinning: StoryObj<StoryProps> = {
  name: 'Header groups — leaves',
  args: {
    // Reorder-out: под вложенной шапкой можно пиннить любую единицу —
    // лист или группу любого уровня; при закреплении листья цели вырываются к
    // левому краю, а спанящие шапки родителей режутся на сегменты.
    headerNesting: 'nested',
    enableColumnPinning: true,
    enableLeafPinning: true,
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
