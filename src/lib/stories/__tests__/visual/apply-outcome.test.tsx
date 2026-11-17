import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, failureLog, unsavedChanges } from '../../../plugins'
import {
  APPLY_SAVED_HIDE_AFTER,
  readApplyOutcome,
  saveEdit,
  startEditSession,
} from '../../../plugins/cellEditing/session'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { waitForGrid } from './core-helpers'

// Плашка итога применения (ADR 0227, §1; AO1, AO2, AO4, AO22): тон успеха и самостоятельный
// уход, частичный итог в нейтральном тоне с действием, одна плашка на применение, уход по решённым отказам. AO3 — модульный (`applyOutcome.dom`).

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 200,
    dataType: 'number',
  },
]
const DATA = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  name: `Name ${i}`,
  age: 20 + i,
}))

interface Batch {
  cells: { rowId: string; columnId: string; value: unknown }[]
}

let api: any
let answer: (batch: Batch) => unknown = () => undefined
const batches: Batch[] = []

const Grid = ({ withLog = false }: { withLog?: boolean }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      cellEditing({
        saveMode: 'manual',
        onCommitEdits: (batch: Batch) => {
          batches.push(batch)
          return answer(batch)
        },
      } as never),
      unsavedChanges(),
      ...(withLog ? [failureLog()] : []),
    ] as never,
  })
  api = table
  return (
    <div style={{ width: 700, height: 520 }}>
      <DataGrid table={table as never} height={480} />
    </div>
  )
}

const mount = async (withLog?: boolean) => {
  batches.length = 0
  const screen = await render(<Grid withLog={withLog} />)
  await waitForGrid()
  return screen
}

afterEach(() => {
  vi.useRealTimers()
  answer = () => undefined
})

const own = cellEditingLabels(tableLabels)
const notices = () =>
  document.querySelectorAll<HTMLElement>('[data-testid="table-notice"]')
const notice = () => notices()[0] ?? null
const noticeTitle = () => notice()?.querySelector('[id]')?.textContent
const noticeAction = () =>
  notice()?.querySelector<HTMLElement>('[data-testid="table-notice-action"]') ??
  null
/** Иконка плашки по ключу набора иконок. */
const iconOf = (key: string) =>
  notice()?.querySelector(`svg[data-icon="${key}"]`) ?? null

const cornerOf = (rowId: string) =>
  document.querySelector(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="age"] [data-cell-draft]`,
  )

/** Правка возраста строки сохранена, как Enter: в ячейке черновик. */
const draftAge = async (rowId: string, value: string) => {
  startEditSession(api, api.getRowSource().byId(rowId), { id: 'age' })
  saveEdit(
    api,
    { rowId, columnId: 'age' },
    { text: value },
    api.getHooks().cellEditing,
  )
  await expect.poll(() => cornerOf(rowId)).not.toBeNull()
}

/** «Применить всё» в пульте — нажатиями. */
const applyAll = async () => {
  await humanClick(await found('[data-testid="unsaved-changes-button"]'))
  await humanClick(await found('[data-action="apply-all"]'))
}

const found = (selector: string) =>
  vi.waitFor(() => {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) throw new Error(`no ${selector}`)
    return element
  })

/** Сдвинуть подменённые таймеры и дать React отрисовать. */
const advance = async (ms: number) => {
  await frame()
  vi.advanceTimersByTime(ms)
  await frame()
}

const frame = () =>
  new Promise(resolve => requestAnimationFrame(() => resolve(null)))

describe('Плашка итога применения (ADR 0227)', () => {
  test('AO1: применение, в котором сохранено всё, показывает плашку «Сохранено N изменений» в тоне успеха; она уходит сама через 3 с и не уходит, пока на ней указатель или в ней фокус', async () => {
    expect(APPLY_SAVED_HIDE_AFTER).toBe(3000)
    let resolve: (value: unknown) => void = () => {}
    answer = () => new Promise(done => (resolve = done))
    const screen = await mount()
    try {
      await draftAge('0', '50')
      await draftAge('1', '51')
      await applyAll()
      await expect.poll(() => batches.length).toBe(1)
      // Отсчёт плашки — на подменённых таймерах; ответ сервера — после подмены.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      resolve({})
      await expect.poll(noticeTitle).toBe(own.applySaved(2))
      expect(notices()).toHaveLength(1)
      expect(notice()!.getAttribute('data-tone')).toBe('success')

      // Под указателем отсчёт стоит.
      await userEvent.hover(notice()!)
      await advance(APPLY_SAVED_HIDE_AFTER * 2)
      expect(notice()?.hasAttribute('data-leaving')).toBe(false)
      await userEvent.unhover(notice()!)

      // С фокусом внутри — тоже.
      const dismiss = notice()!.querySelector<HTMLElement>(
        '[data-alert-dismiss]',
      )!
      dismiss.focus()
      await advance(APPLY_SAVED_HIDE_AFTER * 2)
      expect(notice()?.hasAttribute('data-leaving')).toBe(false)
      dismiss.blur()

      // Без указателя и фокуса — уходит ровно через 3 с.
      await advance(APPLY_SAVED_HIDE_AFTER - 50)
      expect(notice()?.hasAttribute('data-leaving')).toBe(false)
      await advance(100)
      await expect
        .poll(() => notice()?.hasAttribute('data-leaving') ?? true)
        .toBe(true)
      expect(readApplyOutcome(api)).toBeUndefined()
      await advance(2000)
      await expect.poll(notice).toBeNull()
    } finally {
      vi.useRealTimers()
      await screen.unmount()
    }
  })

  test('AO2: применение с отказом части показывает плашку «сохранено X из N» — число сохранённых из общего числа, в нейтральном тоне, без иконки отказа, сама она не уходит; её действие с плагином failureLog открывает журнал и закрывает плашку, без него — применяет несохранённое повторно', async () => {
    answer = batch =>
      batches.length === 1
        ? {
            refused: batch.cells
              .filter(cell => cell.rowId === '1')
              .map(cell => ({ ...cell, reason: 'Locked' })),
          }
        : {}

    // Без журнала: «Повторить несохранённые» шлёт отказанное ещё раз.
    let screen = await mount()
    try {
      await draftAge('0', '50')
      await draftAge('1', '51')
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyPartly(1, 2))
      expect(noticeTitle()).toBe('Saved 1 of 2')
      // Сохранена часть — не провал: нейтральный тон с иконкой «информация».
      expect(notice()!.getAttribute('data-tone')).toBe('neutral')
      expect(iconOf('loadFailed')).toBeNull()
      expect(iconOf('alertNeutral')).not.toBeNull()
      await advance(APPLY_SAVED_HIDE_AFTER * 3)
      expect(notice()?.hasAttribute('data-leaving')).toBe(false)
      vi.useRealTimers()
      expect(noticeAction()?.textContent).toBe(own.applyRetry)
      await humanClick(noticeAction()!)
      await expect.poll(() => batches.length).toBe(2)
      expect(batches[1]!.cells.map(cell => [cell.rowId, cell.value])).toEqual([
        ['1', 51],
      ])
      await expect.poll(noticeTitle).toBe(own.applySaved(1))
    } finally {
      vi.useRealTimers()
      await screen.unmount()
    }

    // С журналом: «Показать» открывает журнал и закрывает плашку.
    batches.length = 0
    screen = await mount(true)
    let shown = 0
    try {
      const open = api.showFailureLog as (() => void) | undefined
      api.showFailureLog = () => {
        shown++
        open?.call(api)
      }
      await draftAge('0', '50')
      await draftAge('1', '51')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyPartly(1, 2))
      expect(noticeAction()?.textContent).toBe(own.applyShow)
      await humanClick(noticeAction()!)
      expect(shown).toBe(1)
      await expect
        .poll(() => notice()?.hasAttribute('data-leaving') ?? true)
        .toBe(true)
      expect(readApplyOutcome(api)).toBeUndefined()
      expect(batches).toHaveLength(1)
    } finally {
      await screen.unmount()
    }
  })

  test('AO4: на одно применение — одна плашка; новое применение заменяет плашку прежнего', async () => {
    answer = batch =>
      batches.length === 1
        ? {
            refused: batch.cells
              .filter(cell => cell.rowId === '1')
              .map(cell => ({ ...cell, reason: 'Locked' })),
          }
        : batches.length === 2
          ? {}
          : Promise.reject(new Error('Server is down'))
    const screen = await mount()
    const loadErrors = () =>
      document.querySelectorAll('[data-testid="load-error-banner"]')
    try {
      // Частичный итог.
      await draftAge('0', '50')
      await draftAge('1', '51')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyPartly(1, 2))
      expect(notices()).toHaveLength(1)
      expect(notice()!.getAttribute('data-tone')).toBe('neutral')

      // Новое применение — успех: та же одна плашка с новым итогом.
      await draftAge('2', '52')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applySaved(2))
      expect(notices()).toHaveLength(1)

      // Запрос не прошёл целиком: одна плашка, без плашки отказа загрузки.
      await draftAge('3', '53')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyFailed('Server is down'))
      expect(notices()).toHaveLength(1)
      expect(loadErrors()).toHaveLength(0)
      expect(noticeAction()?.textContent).toBe(tableLabels.loadRetry)
      // Сбой запроса — провал: иконка отказа, тона нет.
      expect(notice()!.hasAttribute('data-tone')).toBe(false)
      expect(iconOf('loadFailed')).not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('AO22: плашка частичного итога уходит, когда решён последний отказ её применения: правки отброшены, сохранены повтором или исправлены', async () => {
    let resolveRetry: (value: unknown) => void = () => {}
    answer = batch => {
      const refuse = (rows: string[]) => ({
        refused: batch.cells
          .filter(cell => rows.includes(cell.rowId))
          .map(cell => ({ ...cell, reason: 'Locked' })),
      })
      if (batches.length === 1) return refuse(['1', '2'])
      if (batches.length === 2) return refuse(['5'])
      return new Promise(done => (resolveRetry = done))
    }
    const screen = await mount(true)
    const live = () =>
      notice() && !notice()!.hasAttribute('data-leaving') ? notice() : null
    const log = () =>
      document.querySelector<HTMLElement>('[data-testid="failure-log"]')
    const entryOf = (rowId: string) =>
      [
        ...(log()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []),
      ].find(entry =>
        entry.getAttribute('data-failure-key')?.includes(rowId),
      ) ?? null
    const ageCell = (rowId: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="age"]`,
      )!
    const refused = (rowId: string) =>
      !!ageCell(rowId).querySelector('[data-cell-issue]')
    const popupsClosed = () =>
      !log() && !document.querySelector('[data-testid="unsaved-changes"]')
    /** Закрыть открытые пульт и журнал клавишей Escape. */
    const closePopups = () =>
      vi.waitFor(async () => {
        if (popupsClosed()) return
        await userEvent.keyboard('{Escape}')
        await frame()
        if (!popupsClosed()) throw new Error('popups are open')
      })
    /** Журнал — кнопкой тулбара: «Показать» на плашке закрыл бы её сам (AO2). */
    const openLog = () =>
      humanClick(
        document.querySelector<HTMLElement>(
          '[data-testid="failure-log-button"]',
        )!,
      )
    try {
      await draftAge('0', '50')
      await draftAge('1', '51')
      await draftAge('2', '52')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyPartly(1, 3))
      await closePopups()

      // Исправлено: новое значение в ячейке снимает её отказ, второй отказ держит плашку.
      await revealCellButtons(ageCell('1'))
      await humanClick(
        ageCell('1').querySelector<HTMLElement>(
          `button[aria-label="${own.editCell}"]`,
        )!,
      )
      await expect
        .poll(() => ageCell('1').querySelector('input'))
        .not.toBeNull()
      const input = ageCell('1').querySelector<HTMLInputElement>('input')!
      await userEvent.clear(input)
      await userEvent.type(input, '61')
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => refused('1')).toBe(false)
      expect(refused('2')).toBe(true)
      await frame()
      expect(live()).not.toBeNull()
      expect(noticeTitle()).toBe(own.applyPartly(1, 3))

      // Отброшено из журнала: последний отказ решён — плашка уходит.
      await openLog()
      await expect.poll(() => entryOf('2')).not.toBeNull()
      expect(live()).not.toBeNull()
      await humanClick(
        entryOf('2')!.querySelector<HTMLElement>('[data-action="discard"]')!,
      )
      await expect.poll(live).toBeNull()
      expect(readApplyOutcome(api)).toBeUndefined()
      await closePopups()

      // Сохранено повтором: повтор из журнала решает отказ, плашка уходит, не дожидаясь ответа.
      await draftAge('5', '55')
      await applyAll()
      await expect.poll(noticeTitle).toBe(own.applyPartly(1, 2))
      await closePopups()
      await openLog()
      await expect.poll(() => entryOf('5')).not.toBeNull()
      expect(live()).not.toBeNull()
      await humanClick(
        entryOf('5')!.querySelector<HTMLElement>('[data-action="retry"]')!,
      )
      await expect.poll(() => batches.length).toBe(3)
      await expect.poll(live).toBeNull()
      resolveRetry({})
      await expect.poll(noticeTitle).toBe(own.applySaved(1))
    } finally {
      await screen.unmount()
    }
  })
})
