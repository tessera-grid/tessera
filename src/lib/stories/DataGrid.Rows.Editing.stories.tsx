import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { definePlugin } from '../core/definePlugin'
import type { Draft } from '../core/drafts/drafts'
import type { RowAction } from '../core/headerActions'
import { vrStates } from './__mocks__/catalog'
import {
  consoleText,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { seed } from './__mocks__/seed'
import { press, typeInto } from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

/**
 * Строки до сохранения (ADR 0178, §7): приложение добавляет строку, пользователь удаляет и
 * возвращает строку, пакет сохраняет всё одним запросом. `Playground` — новая и удалённая строки
 * в покое; без сохранения по кнопке строк до сохранения нет.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Editing',
} satisfies Meta<StoryProps>

export default meta

type RowsTable = {
  getDrafts: () => readonly Draft[]
  addRow: (
    values: Record<string, unknown>,
    place?: { index?: number },
  ) => string
  removeRow: (id: string) => void
}

let rowsTable: RowsTable | undefined
const TABLE_SEED = seed<RowsTable>('rowsEditingTable', table => {
  rowsTable = table
})

/** Действие приложения «Удалить» в колонке действий строки. */
const deleteRow: RowAction = {
  id: 'deleteRow',
  slot: 'actionRowSlot',
  icon: () => <Trash2 width={16} height={16} />,
  label: () => 'Delete',
  tone: 'danger',
  // У строки с черновиком строки — откат, а не удаление.
  visible: ({ table, row }) =>
    !(table as unknown as RowsTable)
      .getDrafts()
      .some(draft => 'row' in draft.target && draft.target.row === row.id),
  onSelect: ({ table, row }) =>
    (table as unknown as RowsTable).removeRow(row.id),
}
const DELETE_PLUGIN = definePlugin()({
  id: 'deleteRowAction',
  slotActions: [deleteRow],
})()

/** «Сервер» пакета: сохраняет новые строки под id из таблицы или отказывает им, если задано. */
const rowServer = {
  refuseInserts: false,
  reset: () => {
    rowServer.refuseInserts = false
  },
  save: (batch: CellEditBatch): Promise<CellEditBatchResult> =>
    Promise.resolve(
      rowServer.refuseInserts
        ? {
            refused: (batch.inserts ?? []).map(item => ({
              rowId: item.rowId,
              reason: 'A row with this name already exists',
            })),
          }
        : {
            saved: (batch.inserts ?? []).map(item => ({
              rowId: item.rowId,
              // Сервер сохраняет строку под id, который выдала таблица (ADR 0181).
              row: { ...item.values, id: item.rowId },
            })),
          },
    ),
}

const ROWS_ARGS = {
  enableCellEditing: true,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
  enableToolbar: true,
  enableRowActions: true,
  actionsDemo: 'none',
  enableKeyboardNavigation: true,
  columnCount: 6,
  dataCount: 10,
  editableColumns: ['firstName', 'lastName', 'age'],
  onCommitEdits: rowServer.save,
  extraPlugins: [TABLE_SEED, DELETE_PLUGIN],
} satisfies Partial<StoryProps>

const rowEl = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const newRow = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    '.data-grid__body-row[data-row-draft="inserted"]',
  )
const deletedRow = (root: ParentNode, id: string) =>
  rowEl(root, id)?.getAttribute('data-row-draft') === 'deleted'
const cellOf = (row: HTMLElement | null, column: string) =>
  row?.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  ) ?? null
/** Значение в ячейке — без кнопки правки и отметок. */
const textOf = (cell: HTMLElement | null) => {
  const copy = cell?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim() ?? ''
}
const actionOf = (row: HTMLElement | null, label: string) =>
  row?.querySelector<HTMLElement>(`button[aria-label^="${label}"]`) ?? null
const panelButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const panelCount = (root: ParentNode) => {
  const bubble = panelButton(root)?.querySelector('[data-active-indicator]')
  return bubble?.getAttribute('data-shown') === 'true'
    ? Number(bubble.textContent)
    : 0
}
const panelOpen = () =>
  !!document.querySelector('[data-testid="unsaved-changes"]')
/** Пульт открыт — «Применить всё»; закрыт — открыть. */
const applyAll = (root: HTMLElement) => {
  if (!panelOpen()) panelButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}

/** Набрать значение в ячейке строки и сохранить его клавишей Enter; `true` — уже в ячейке. */
const fill = (row: HTMLElement | null, column: string, value: string) => {
  const cell = cellOf(row, column)
  if (!cell) return false
  const input = cell.querySelector<HTMLInputElement>('input')
  if (!input) {
    if (textOf(cell) === value) return true
    cell.querySelector<HTMLElement>('.cell__button button')?.click()
  } else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
  return false
}

// --- Playground -----------------------------------------------------------------------

const PLAYGROUND_DRAFTS: Draft[] = [
  {
    kind: 'rowInsert',
    target: { row: 'tsr-new-row:playground' },
    value: {
      values: { firstName: 'Ada', age: 36 },
      index: 2,
      after: 'item-id-1',
    },
  },
  { kind: 'rowDelete', target: { row: 'item-id-4' }, value: null },
]

export const RowEditingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Новая строка залита тоном несохранённого, удалённая приглушена; откат — в колонке действий.
  args: { ...ROWS_ARGS, initialDrafts: PLAYGROUND_DRAFTS },
  parameters: {
    ...vrStates('body.rowDraft'),
    ...showControls([
      'enableCellEditing',
      'cellEditingSaveMode',
      'enableRowActions',
      'actionsDemo',
      'enableUnsavedChanges',
      'enableToolbar',
      'enableKeyboardNavigation',
    ]),
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- ADR 0178 S8 ----------------------------------------------------------------------

const NEW_NAME = 'Ada'
const NEW_AGE = '36'

/** Приложение добавляет пустую строку под второй — один раз. */
const addRowOnce = () => {
  if (!rowsTable?.getDrafts().some(draft => draft.kind === 'rowInsert'))
    rowsTable?.addRow({}, { index: 2 })
}
const savedRow = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')].find(
    row =>
      !row.hasAttribute('data-row-draft') &&
      textOf(cellOf(row, 'firstName')) === NEW_NAME,
  ) ?? null

/** Новая строка заполнена и поле правки закрыто. */
const newRowFilled = (root: ParentNode) => {
  const row = newRow(root)
  return (
    !!row &&
    !row.querySelector('input') &&
    textOf(cellOf(row, 'firstName')) === NEW_NAME &&
    textOf(cellOf(row, 'age')) === NEW_AGE
  )
}

/** Добавить строку и вписать имя, затем возраст. */
const fillNewRow = (root: HTMLElement) => {
  const row = newRow(root)
  if (!row) addRowOnce()
  else if (fill(row, 'firstName', NEW_NAME)) fill(row, 'age', NEW_AGE)
}

const INSERT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сохранение по кнопке', en: 'Saving with a button' },
    hint: {
      ru: 'Приложение сохраняет изменения не сразу, а пакетом — по кнопке пульта в тулбаре. Новые строки тоже ждут сохранения.',
      en: 'The app saves changes not right away but in a batch, with the unsaved changes panel button in the toolbar. New rows wait to be saved too.',
    },
  },
  {
    title: { ru: 'Новая строка', en: 'A new row' },
    hint: {
      ru: 'Приложение добавило пустую строку под второй. Она залита тоном несохранённого и коротко вспыхнула; на кнопке пульта — одно несохранённое изменение.',
      en: 'The app added an empty row below the second one. It is filled with the unsaved tone and flashed briefly; the unsaved changes panel button shows one unsaved change.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(
      root => !!newRow(root),
      () => addRowOnce(),
    ),
  },
  {
    title: { ru: 'Строка заполнена', en: 'The row is filled in' },
    hint: {
      ru: 'Пользователь вписал имя и возраст. Значения стоят в ячейках новой строки без отметок ячеек: вся строка пока не сохранена.',
      en: "The user typed a name and an age. The values sit in the new row's cells without cell marks: the whole row is not saved yet.",
    },
    states: ['body.rowDraft'],
    enter: untilDone(newRowFilled, fillNewRow),
  },
  {
    title: { ru: 'Строка сохранена', en: 'The row is saved' },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил строку: заливки нет, это обычная строка данных, несохранённых изменений не осталось.',
      en: 'The user applied everything from the unsaved changes panel. The server saved the row: there is no fill, it is an ordinary data row, and no unsaved changes are left.',
    },
    enter: untilDone(
      root => !!savedRow(root) && !newRow(root) && !panelOpen(),
      root => {
        if (savedRow(root)) return
        if (!newRowFilled(root)) fillNewRow(root)
        else applyAll(root)
      },
    ),
  },
]

/** ADR 0178, S8: приложение добавляет строку, пользователь её заполняет и сохраняет. */
export const RowDraftInsert: StoryObj<StoryProps> = {
  name: 'Add a row',
  parameters: { scenario: '0178/S8', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Новая строка', en: 'A new row' }}
      steps={INSERT}
      reset={() => rowServer.reset()}
      args={guideArgs(ROWS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(INSERT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(INSERT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(newRow(canvas)).not.toBeNull())
      expect(panelCount(canvas)).toBe(1)
    })
    await step(INSERT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(textOf(cellOf(newRow(canvas), 'age'))).toBe(NEW_AGE),
      )
      expect(newRow(canvas)!.querySelector('[data-cell-draft]')).toBeNull()
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(INSERT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(savedRow(canvas)).not.toBeNull())
      expect(newRow(canvas)).toBeNull()
      expect(panelCount(canvas)).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0178 S9 ----------------------------------------------------------------------

const DELETED = 'item-id-3'

const DELETE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Удаление строки', en: 'Deleting a row' },
    hint: {
      ru: 'Приложение сохраняет изменения пакетом по кнопке пульта. У строк в колонке действий — кнопка удаления.',
      en: 'The app saves changes in a batch with the unsaved changes panel button. Rows have a delete button in the actions column.',
    },
  },
  {
    title: { ru: 'Строка удалена', en: 'The row was deleted' },
    hint: {
      ru: 'Пользователь удалил третью строку. Она осталась на месте до сохранения: текст приглушён, ячейки не правятся, в колонке действий — кнопка возврата.',
      en: 'The user deleted the third row. It stays in place until saved: its text is dimmed, its cells cannot be edited, and the actions column has a restore button.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(
      root => deletedRow(root, DELETED),
      root => actionOf(rowEl(root, DELETED), 'Delete')?.click(),
    ),
  },
  {
    title: { ru: 'Строка возвращена', en: 'The row is restored' },
    hint: {
      ru: 'Пользователь вернул строку. Она снова обычная, несохранённых изменений не осталось.',
      en: 'The user restored the row. It is an ordinary row again, and no unsaved changes are left.',
    },
    enter: untilDone(
      root => !!rowEl(root, DELETED) && !deletedRow(root, DELETED),
      root => {
        const row = rowEl(root, DELETED)
        if (!deletedRow(root, DELETED)) actionOf(row, 'Delete')?.click()
        else
          row
            ?.querySelector<HTMLElement>(
              '[data-action-id="cellEditing:rowDraftDiscard"]',
            )
            ?.click()
      },
    ),
  },
]

/** ADR 0178, S9: пользователь удаляет строку и возвращает её. */
export const RowDraftDelete: StoryObj<StoryProps> = {
  name: 'Delete and restore a row',
  parameters: { scenario: '0178/S9', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Удаление строки', en: 'Deleting a row' }}
      steps={DELETE}
      reset={() => rowServer.reset()}
      args={guideArgs(ROWS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DELETE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(DELETE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(deletedRow(canvas, DELETED)).toBe(true))
      expect(panelCount(canvas)).toBe(1)
    })
    await step(DELETE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(deletedRow(canvas, DELETED)).toBe(false))
      expect(panelCount(canvas)).toBe(0)
      await settle()
    })
  },
}

// --- ADR 0178 S10 ---------------------------------------------------------------------

const EDITED = 'item-id-1'
const EDITED_AGE = '77'
const REMOVED = 'item-id-5'

/** Три изменения пакета готовы: новая строка, удалённая строка и правка. */
const threeDone = (root: ParentNode) =>
  !!newRow(root) &&
  deletedRow(root, REMOVED) &&
  !rowEl(root, EDITED)?.querySelector('input') &&
  textOf(cellOf(rowEl(root, EDITED), 'age')) === EDITED_AGE

/** Добавить строку, удалить пятую, поправить возраст в первой. */
const makeThreeChanges = (root: HTMLElement) => {
  if (!newRow(root)) addRowOnce()
  else if (!deletedRow(root, REMOVED))
    actionOf(rowEl(root, REMOVED), 'Delete')?.click()
  else fill(rowEl(root, EDITED), 'age', EDITED_AGE)
}

const REFUSED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сохранение по кнопке', en: 'Saving with a button' },
    hint: {
      ru: 'Приложение сохраняет изменения пакетом по кнопке пульта. Сервер сейчас не принимает новые строки.',
      en: 'The app saves changes in a batch with the unsaved changes panel button. The server does not accept new rows right now.',
    },
  },
  {
    title: { ru: 'Три изменения', en: 'Three changes' },
    hint: {
      ru: 'Приложение добавило строку, пользователь удалил пятую строку и поправил возраст в первой. На кнопке пульта — три несохранённых изменения.',
      en: 'The app added a row, and the user deleted the fifth row and edited the age in the first. The unsaved changes panel button shows three unsaved changes.',
    },
    states: ['body.rowDraft', 'body.cellDraft'],
    enter: untilDone(threeDone, makeThreeChanges),
  },
  {
    title: {
      ru: 'Сервер отказал новой строке',
      en: 'The server refused the new row',
    },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил правку и удаление и отклонил новую строку: удалённой строки больше нет, правленная ячейка вспыхнула тоном успеха, а новая — тоном отката и осталась несохранённой.',
      en: 'The user applied everything from the unsaved changes panel. The server saved the edit and the deletion and rejected the new row: the deleted row is gone, the edited cell flashed in the success tone, and the new row flashed in the revert tone and stayed unsaved.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(
      root =>
        !rowEl(root, REMOVED) &&
        !!newRow(root) &&
        panelCount(root) === 1 &&
        !panelOpen(),
      root => {
        rowServer.refuseInserts = true
        if (!rowEl(root, REMOVED)) return
        if (!threeDone(root)) makeThreeChanges(root)
        else applyAll(root)
      },
    ),
  },
]

/** ADR 0178, S10: пакет со вставкой, удалением и правкой; сервер отказал вставке. */
export const RowDraftsCommitRefused: StoryObj<StoryProps> = {
  name: 'Refused new row',
  parameters: { scenario: '0178/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ новой строке', en: 'A new row refused' }}
      steps={REFUSED}
      reset={() => {
        rowServer.reset()
        rowServer.refuseInserts = true
      }}
      args={guideArgs(ROWS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(panelCount(canvas)).toBe(3))
    })
    await step(REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowEl(canvas, REMOVED)).toBeNull())
      await until(() => expect(newRow(canvas)).not.toBeNull())
      await until(() =>
        expect(textOf(cellOf(rowEl(canvas, EDITED), 'age'))).toBe(EDITED_AGE),
      )
      await until(() => expect(panelCount(canvas)).toBe(1))
      await settle()
    })
  },
}

// --- ADR 0181 S1 ----------------------------------------------------------------------

/** Место новой строки в теле — индекс среди строк. */
const placeOf = (root: ParentNode, row: HTMLElement | null) =>
  row ? [...root.querySelectorAll('.data-grid__body-row')].indexOf(row) : -1

const SAVE_IN_PLACE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правок нет', en: 'No edits yet' },
    hint: {
      ru: 'Приложение сохраняет изменения по кнопке пульта. Пользователь ещё ничего не добавлял.',
      en: 'The app saves changes with the unsaved changes panel button. The user has not added anything yet.',
    },
  },
  {
    title: { ru: 'Новая строка заполнена', en: 'The new row is filled in' },
    hint: {
      ru: 'Приложение сохраняет изменения по кнопке пульта. Пользователь добавил строку под второй и вписал имя и возраст: строка залита тоном несохранённого.',
      en: 'The app saves changes with the unsaved changes panel button. The user added a row below the second one and typed a name and an age: the row is filled with the unsaved tone.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(newRowFilled, root => {
      rowServer.reset()
      fillNewRow(root)
    }),
  },
  {
    title: { ru: 'Строка сохранена на месте', en: 'The row is saved in place' },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил строку под тем же номером, что выдала ей таблица, — это та же строка: она осталась на месте, не погасла и не появилась заново, а коротко вспыхнула тоном успеха.',
      en: 'The user applied everything from the unsaved changes panel. The server saved the row under the same id the table gave it, so it is the same row: it stayed in place, did not fade out or reappear, and flashed briefly in the success tone.',
    },
    immediate: true,
    enter: untilDone(
      root => !!savedRow(root) && !newRow(root) && !panelOpen(),
      root => {
        if (savedRow(root)) return
        if (!newRowFilled(root)) fillNewRow(root)
        else applyAll(root)
      },
    ),
  },
]

/** ADR 0181, S1: пользователь сохраняет новую строку — она остаётся на месте. */
export const RowDraftSaveInPlace: StoryObj<StoryProps> = {
  name: 'Save a row in place',
  parameters: { scenario: '0181/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сохранение на месте', en: 'Saving in place' }}
      steps={SAVE_IN_PLACE}
      reset={() => rowServer.reset()}
      args={guideArgs(ROWS_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let place = -1
    await step(SAVE_IN_PLACE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SAVE_IN_PLACE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(newRowFilled(canvas)).toBe(true))
      place = placeOf(canvas, newRow(canvas))
    })
    await step(SAVE_IN_PLACE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(savedRow(canvas)).not.toBeNull())
      expect(newRow(canvas)).toBeNull()
      expect(placeOf(canvas, savedRow(canvas))).toBe(place)
      expect(canvas.querySelector('[data-row-ghost]')).toBeNull()
      await settle()
    })
  },
}
