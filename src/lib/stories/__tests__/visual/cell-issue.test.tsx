import axe from 'axe-core'
import { commands, server, userEvent } from 'vitest/browser'
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import type { CellComponentProps } from '../../../core/createSlots'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, cellErrors } from '../../../plugins'
import { cellKey } from '../../../plugins/cellEditing/session'
import type { CellEditingState } from '../../../plugins/cellEditing/types'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import {
  AXE_OPTIONS,
  contrast,
  effectiveBg,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Треугольник отказа ячейки (ADR 0177; OB7–OB9, OB12, OB17): отказ сохранения значения любым
// путём и ошибка данных — один треугольник, нарисованный ячейкой; подсказка, описание, снятие
// «Сбросить» и Escape, контраст. OB10 — в `touch` (касание угла), OB11 — модульный.

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const edits: Deferred[] = []
const answerEdit = () => edits.at(-1)!

interface Item {
  id: string
  name: string
  city: string
  inStock: boolean
}

const DATA: Item[] = Array.from({ length: 20 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  city: `City ${index}`,
  inStock: index % 2 === 0,
}))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 240 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 240 },
  {
    id: 'inStock',
    accessorKey: 'inStock',
    header: 'In stock',
    dataType: 'boolean',
    size: 120,
  },
]

let table: {
  trackCellAction: (
    target: unknown,
    promise: Promise<unknown>,
    options?: { label?: string },
  ) => Promise<unknown>
}
let setEditing: (next: CellEditingState | undefined) => void = () => {}

interface GridProps {
  /** Ошибка данных `cellErrors` по контексту ячейки. */
  getCellError?: (ctx: CellComponentProps) => string | undefined
  /** Состояние правки у приложения (ADR 0028, CE6). */
  controlled?: boolean
}

const Grid = ({ getCellError, controlled = false }: GridProps) => {
  const [editing, setState] = useState<CellEditingState>()
  setEditing = setState
  const created = useCreateTable({
    enableKeyboardNavigation: true,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      cellEditing({
        canEditCell: () => true,
        onCellEdit: () => {
          const answer = deferred()
          edits.push(answer)
          return answer.promise
        },
        ...(controlled ? { editing, onEditingChange: setState } : {}),
      }),
      ...(getCellError ? [cellErrors({ getCellError })] : []),
    ] as never,
  })
  table = created as never
  return (
    <div style={{ width: 700, height: 480 }}>
      <DataGrid table={created as never} />
    </div>
  )
}

const mount = async (props: GridProps = {}) => {
  edits.length = 0
  const screen = await render(<Grid {...props} />)
  await waitForGrid()
  return screen
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
})

const REASON = 'Server said no'
const DATA_ERROR = 'Name is required'

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const cellEl = (id: string, column = 'name') =>
  rowEl(id).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const issuesOf = (cell: HTMLElement) => [
  ...cell.querySelectorAll<HTMLElement>('button[data-cell-issue]'),
]
const issueOf = (cell: HTMLElement) => issuesOf(cell)[0] ?? null
const triangleOf = (cell: HTMLElement) =>
  issueOf(cell)?.querySelector<HTMLElement>('span[aria-hidden]') ?? null
const descriptionOf = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
const popover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const editorOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLInputElement>('input:not([aria-hidden="true"])')
const checkbox = (id: string) =>
  cellEl(id, 'inStock').querySelector<HTMLElement>('[role="checkbox"]')!
const tooltipText = () =>
  [...document.querySelectorAll<HTMLElement>('[data-side]')]
    .map(el => el.textContent?.trim())
    .find(Boolean) ?? null
const tooltipEl = () =>
  [...document.querySelectorAll<HTMLElement>('[data-side]')].find(el =>
    el.textContent?.trim(),
  ) ?? null
const away = () => userEvent.hover(document.body, { position: { x: 1, y: 1 } })

/** Открыть правку ячейки кнопкой правки. */
const openEditor = async (cell: HTMLElement) => {
  await revealCellButtons(cell)
  await humanClick(
    cell.querySelector<HTMLElement>(
      `button[aria-label="${cellEditingLabels(tableLabels).editCell}"]`,
    )!,
  )
  await expect.poll(() => editorOf(cell)).not.toBeNull()
}

/** Сохранить в ячейке `value` и получить отказ сервера. */
const refuseEdit = async (cell: HTMLElement, value: string) => {
  await openEditor(cell)
  await userEvent.keyboard(`{Control>}a{/Control}${value}{Enter}`)
  await expect.poll(() => edits.length).toBeGreaterThan(0)
  answerEdit().reject(new Error(REASON))
  await expect.poll(() => issueOf(cell)).not.toBeNull()
}

/**
 * Треугольник в правом верхнем углу ячейки, нарисованный ячейкой: не внутри кнопок ячейки и
 * не внутри её содержимого.
 */
const drawnByCell = (cell: HTMLElement) => {
  const issue = issueOf(cell)
  const triangle = triangleOf(cell)
  if (!issue || !triangle) return false
  const box = cell.getBoundingClientRect()
  const mark = triangle.getBoundingClientRect()
  return (
    issue.closest('.data-grid__body-cell') === cell &&
    !issue.closest('.cell__button') &&
    !issue.closest('.data-grid__cell-wrapper-title') &&
    !issue.closest('[role="checkbox"]') &&
    mark.width > 0 &&
    Math.abs(mark.right - box.right) <= 1 &&
    Math.abs(mark.top - box.top) <= 1
  )
}

describe('Треугольник отказа ячейки (ADR 0177)', () => {
  test('OB7: отказ сохранения значения ячейки любым путём — встроенная правка, встроенный флажок, trackCellAction, правка из кода — оставляет красный треугольник в правом верхнем углу ячейки, нарисованный ячейкой, а не её кнопками и содержимым', async () => {
    let screen = await mount()
    try {
      // Встроенная правка.
      await refuseEdit(cellEl('r1'), 'Changed')
      expect(drawnByCell(cellEl('r1'))).toBe(true)

      // Встроенный флажок.
      await humanClick(checkbox('r2'))
      await expect.poll(() => edits.length).toBe(2)
      answerEdit().reject(new Error(REASON))
      await expect.poll(() => issueOf(cellEl('r2', 'inStock'))).not.toBeNull()
      expect(drawnByCell(cellEl('r2', 'inStock'))).toBe(true)

      // trackCellAction.
      void table
        .trackCellAction(
          { cell: ['r3', 'city'] },
          Promise.reject(new Error(REASON)),
        )
        .catch(() => {})
      await expect.poll(() => issueOf(cellEl('r3', 'city'))).not.toBeNull()
      expect(drawnByCell(cellEl('r3', 'city'))).toBe(true)
    } finally {
      await screen.unmount()
    }

    // Правка из кода приложения: отказ — в состоянии правки, которое ведёт приложение.
    screen = await mount({ controlled: true })
    try {
      setEditing({
        active: null,
        submitted: {
          [cellKey('r4', 'name')]: {
            rowId: 'r4',
            columnId: 'name',
            draft: 'From code',
            text: 'From code',
            original: 'Row 4',
            status: 'error',
            error: REASON,
            attempt: 1,
          },
        },
      })
      await expect.poll(() => issueOf(cellEl('r4'))).not.toBeNull()
      expect(drawnByCell(cellEl('r4'))).toBe(true)
      expect(descriptionOf(issueOf(cellEl('r4'))!)).toBe(REASON)
    } finally {
      await screen.unmount()
    }
  })

  test('OB8: ошибка данных cellErrors — тот же треугольник; при отказе и ошибке данных треугольник один, причина отказа — первой', async () => {
    const screen = await mount({
      getCellError: ctx =>
        ctx.column.id === 'name' && ['r1', 'r2'].includes(ctx.row.id)
          ? DATA_ERROR
          : undefined,
    })
    try {
      // Тот же треугольник: та же кнопка, тот же вид и место, что у отказа.
      await refuseEdit(cellEl('r3'), 'Changed')
      const refused = triangleOf(cellEl('r3'))!
      const dataError = triangleOf(cellEl('r2'))!
      expect(drawnByCell(cellEl('r2'))).toBe(true)
      expect(dataError.className).toBe(refused.className)
      for (const property of ['backgroundColor', 'width', 'height', 'clipPath'])
        expect(getComputedStyle(dataError)[property as never]).toBe(
          getComputedStyle(refused)[property as never],
        )
      expect(descriptionOf(issueOf(cellEl('r2'))!)).toBe(DATA_ERROR)

      // Отказ на ячейке с ошибкой данных: треугольник один, причина отказа первой.
      await refuseEdit(cellEl('r1'), 'Again')
      await expect
        .poll(() => descriptionOf(issueOf(cellEl('r1'))!))
        .toBe(REASON)
      expect(issuesOf(cellEl('r1'))).toHaveLength(1)
      await humanClick(issueOf(cellEl('r1'))!)
      await expect.poll(popover).not.toBeNull()
      expect(popover()!.textContent).toContain(REASON)
      await humanClick(
        popover()!.querySelector<HTMLElement>('[data-action="discard"]')!,
      )
      await expect
        .poll(() => descriptionOf(issueOf(cellEl('r1'))!))
        .toBe(DATA_ERROR)
      expect(issuesOf(cellEl('r1'))).toHaveLength(1)
    } finally {
      await screen.unmount()
    }
  })

  test('OB9: наведение на треугольник ячейки — подсказка с причиной, только чтение, пропускает указатель; у ячейки aria-invalid и описание с причиной', async () => {
    const screen = await mount()
    try {
      await refuseEdit(cellEl('r1'), 'Changed')
      await away()
      const cell = cellEl('r1')
      // Указатель — в треугольной зоне у угла.
      await userEvent.hover(issueOf(cell)!, { position: { x: 20, y: 4 } })
      await expect.poll(tooltipText).toBe(REASON)
      // Только чтение: ни кнопок, ни ссылок, ни остановок Tab.
      expect(
        tooltipEl()!.querySelector(
          'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).toBeNull()
      // Указатель проходит насквозь (ADR 0100): под подсказкой — то, что за ней.
      expect(getComputedStyle(tooltipEl()!).pointerEvents).toBe('none')
      const tip = tooltipEl()!.getBoundingClientRect()
      const under = document.elementFromPoint(
        tip.left + tip.width / 2,
        tip.top + tip.height / 2,
      )
      expect(tooltipEl()!.contains(under)).toBe(false)

      expect(cell.getAttribute('aria-invalid')).toBe('true')
      expect(descriptionOf(cell) || descriptionOf(issueOf(cell)!)).toContain(
        REASON,
      )
      expect(cellEl('r2').hasAttribute('aria-invalid')).toBe(false)
    } finally {
      await screen.unmount()
    }
  })

  test('OB12: «Сбросить» и Escape в открытой правке с отклонённым значением удаляют хранимое значение и снимают отметку', async () => {
    const screen = await mount()
    try {
      // «Сбросить» в поповере треугольника.
      await refuseEdit(cellEl('r1'), 'Rejected one')
      await humanClick(issueOf(cellEl('r1'))!)
      await expect.poll(popover).not.toBeNull()
      await humanClick(
        popover()!.querySelector<HTMLElement>('[data-action="discard"]')!,
      )
      await expect.poll(() => issueOf(cellEl('r1'))).toBeNull()
      await openEditor(cellEl('r1'))
      expect(editorOf(cellEl('r1'))!.value).toBe('Row 1')
      await userEvent.keyboard('{Escape}')

      // Escape в открытой правке с отклонённым значением.
      await refuseEdit(cellEl('r2'), 'Rejected two')
      await openEditor(cellEl('r2'))
      expect(editorOf(cellEl('r2'))!.value).toBe('Rejected two')
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => editorOf(cellEl('r2'))).toBeNull()
      expect(issueOf(cellEl('r2'))).toBeNull()
      await openEditor(cellEl('r2'))
      expect(editorOf(cellEl('r2'))!.value).toBe('Row 2')
      await userEvent.keyboard('{Escape}')
    } finally {
      await screen.unmount()
    }
  })

  test('OB17: контраст треугольника не ниже 3:1 в обеих темах, в forced-colors — системный цвет; поповер и подсказка проходят axe с color-contrast', async () => {
    const screen = await mount()
    try {
      await refuseEdit(cellEl('r1'), 'Changed')
      await away()
      const cell = cellEl('r1')
      await inBothThemes(async () => {
        const ratio = contrast(
          toRgba(getComputedStyle(triangleOf(cell)!).backgroundColor),
          effectiveBg(cell),
        )
        expect(ratio).toBeGreaterThanOrEqual(3)

        // Подсказка: указатель — в треугольной зоне у угла.
        await userEvent.hover(issueOf(cell)!, { position: { x: 20, y: 4 } })
        await expect.poll(tooltipText).toBe(REASON)
        let result = await axe.run(tooltipEl()!, AXE_OPTIONS)
        expect(result.violations.map(v => v.id)).toEqual([])
        await away()

        // Поповер.
        await humanClick(issueOf(cell)!)
        await expect.poll(popover).not.toBeNull()
        result = await axe.run(popover()!, AXE_OPTIONS)
        expect(result.violations.map(v => v.id)).toEqual([])
        await userEvent.keyboard('{Escape}')
        await expect.poll(popover).toBeNull()
      })

      if (server.browser === 'webkit') return
      await commands.forcedColors(true)
      await expect
        .poll(() => getComputedStyle(triangleOf(cell)!).backgroundColor)
        .toBe(toCss('CanvasText'))
    } finally {
      await screen.unmount()
    }
  })
})

/** Системный цвет, как его вычисляет браузер. */
const toCss = (color: string) => {
  const probe = document.createElement('span')
  probe.style.color = color
  probe.style.forcedColorAdjust = 'none'
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}
