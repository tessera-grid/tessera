import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellErrors,
  columnFiltering,
  failureLog,
  unsavedChanges,
} from '../../../plugins'
import {
  saveEdit,
  startEditSession,
} from '../../../plugins/cellEditing/session'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'

// Длинный текст в поповерах черновиков и отказов (ADR 0178; DR37, DR38): поповер отметки ячейки
// и её тултип, пульт и журнал не переполняются на широком и узком окне и при прокрутке списков;
// край записей в пульте и журнале — как у заголовка и подвала.

const WORD = 'Antidisestablishmentarianism'.repeat(3)
const LONG = `The payroll service rejected the request: the employee contract was changed after the commission period was closed ${WORD} and must be confirmed again.`
const HEADER = `Very long column header ${WORD}`

const DATA = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: i === 1 ? LONG : `Name ${i}`,
  age: 20 + i,
}))
const COLUMNS = [
  {
    id: 'name',
    accessorKey: 'name',
    header: HEADER,
    size: 220,
    dataType: 'text',
  },
  {
    id: 'age',
    accessorKey: 'age',
    header: 'Age',
    size: 120,
    dataType: 'number',
  },
]

let api: any

const Grid = ({ width }: { width: number }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    dataMode: { filtering: 'server' },
    plugins: [
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      cellErrors({
        getCellError: ({
          row,
          column,
        }: {
          row: { id: string }
          column: { id: string }
        }) => (row.id === '5' && column.id === 'age' ? LONG : undefined),
      } as never),
      columnFiltering({ onFilterChange: () => Promise.resolve() }),
      failureLog(),
      unsavedChanges(),
    ] as never,
  })
  api = table
  return (
    <div style={{ width, height: 520 }}>
      <DataGrid table={table as never} height={480} />
    </div>
  )
}

afterEach(async () => {
  await page.viewport(1024, 700)
})

const cell = (rowId: string, column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const cellPopover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
const dialog = () =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1) ?? null
const tooltip = () =>
  [...document.querySelectorAll<HTMLElement>('[data-side]')].find(el =>
    el.textContent?.trim(),
  ) ?? null
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Что вылезает за рамку поповера или окна и где текст прокручивается вбок. */
const overflowOf = (pop: HTMLElement) => {
  const box = pop.getBoundingClientRect()
  const found: string[] = []
  if (
    box.left < -0.5 ||
    box.right > innerWidth + 0.5 ||
    box.top < -0.5 ||
    box.bottom > innerHeight + 0.5
  )
    found.push('поповер за окном')
  if (pop.scrollWidth > pop.clientWidth + 1) found.push('прокрутка вбок')
  for (const el of pop.querySelectorAll<HTMLElement>('*')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) continue
    // Текст только для скринридера обрезан нарочно.
    if (el.closest('[data-visually-hidden]')) continue
    const name = (el.textContent ?? '').slice(0, 24)
    if (rect.right > box.right + 0.5 || rect.left < box.left - 0.5)
      found.push(`за рамкой: ${el.tagName} «${name}»`)
    if (
      el.clientWidth > 0 &&
      el.scrollWidth > el.clientWidth + 1 &&
      getComputedStyle(el).overflowX !== 'visible'
    )
      found.push(`обрезано: ${el.tagName} «${name}»`)
  }
  return found
}

/** Тултип: текст не шире подложки. */
const tooltipOverflow = (tip: HTMLElement) => {
  const box = tip.getBoundingClientRect()
  const range = document.createRange()
  range.selectNodeContents(tip)
  const text = range.getBoundingClientRect()
  return text.right > box.right + 0.5 || tip.scrollWidth > tip.clientWidth + 1
}

/** Отказ, ошибка данных и черновик с длинным текстом; списки для прокрутки. */
const seed = async () => {
  api.reportFailure({
    label: HEADER,
    target: { cell: ['3', 'age'] },
    reason: LONG,
    retry: () => {},
  })
  startEditSession(api, api.getRowSource().byId('1'), { id: 'name' })
  saveEdit(
    api,
    { rowId: '1', columnId: 'name' },
    { text: `New ${LONG}` },
    api.getHooks().cellEditing,
  )
  for (let i = 10; i < 40; i++) {
    api.setDraft({
      kind: 'cellValue',
      target: { cell: [String(i), 'name'] },
      value: { value: `${WORD} ${i}`, text: `${WORD} ${i}` },
    })
    api.reportFailure({
      label: `${HEADER} ${i}`,
      target: { cell: [String(i), 'age'] },
      reason: LONG,
    })
  }
  api.setDraft({
    kind: 'columnFilter',
    target: { column: 'name' },
    value: { operator: 'contains', value: LONG },
  })
  await expect
    .poll(() => cell('1', 'name')?.querySelector('[data-cell-draft]'))
    .toBeTruthy()
}

const MARKS = [
  ['3', 'age', 'data-cell-issue'],
  ['5', 'age', 'data-cell-issue'],
  ['1', 'name', 'data-cell-draft'],
] as const

/** Открыть список кнопкой тулбара — тулбар грузится лениво (ADR 0061), кнопку ждём. */
const openList = async (button: () => HTMLElement | null | undefined) => {
  await expect.poll(button).toBeTruthy()
  await humanClick(button()!)
  await expect.poll(dialog).not.toBeNull()
  const pop = dialog()!
  const list = await expect
    .poll(() => pop.querySelector<HTMLElement>('[data-popup-scroller]'))
    .toBeTruthy()
  void list
  return pop
}
const pultButton = () =>
  document.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')!
const logButton = () =>
  [...document.querySelectorAll<HTMLElement>('[role="toolbar"] button')].find(
    button => button.getAttribute('data-testid') === 'failure-log-button',
  ) ??
  [...document.querySelectorAll<HTMLElement>('[role="toolbar"] button')].find(
    button => /failure/i.test(button.getAttribute('aria-label') ?? ''),
  )!

describe('Длинный текст в поповерах черновиков и отказов (ADR 0178)', () => {
  test('DR37: поповер отметки ячейки и её тултип, пульт и журнал отказов не переполняются длинным текстом — словом без пробелов, длинной причиной, подписью и значением: текст переносится, поповер не шире окна и без прокрутки вбок, на широком и узком (360 px) окне и при прокрутке списков', async () => {
    for (const [viewport, width] of [
      [1024, 760],
      [360, 340],
    ] as const) {
      await page.viewport(viewport, 700)
      const screen = await render(<Grid width={width} />)
      await waitForGrid()
      try {
        await seed()
        for (const [row, column, attr] of MARKS) {
          cell(row, column)!.scrollIntoView({ block: 'center' })
          const mark = await expect
            .poll(() =>
              cell(row, column)?.querySelector<HTMLElement>(`[${attr}]`),
            )
            .toBeTruthy()
          void mark
          const target = cell(row, column)!.querySelector<HTMLElement>(
            `[${attr}]`,
          )!
          // Тултип отметки: длинная причина переносится внутри подложки.
          await userEvent.hover(target, { position: { x: 20, y: 4 } })
          await expect.poll(tooltip).not.toBeNull()
          expect(tooltipOverflow(tooltip()!), `${viewport} тултип ${row}`).toBe(
            false,
          )
          await humanClick(target)
          await expect.poll(cellPopover).not.toBeNull()
          expect(
            overflowOf(cellPopover()!),
            `${viewport} поповер ${row}`,
          ).toEqual([])
          await userEvent.keyboard('{Escape}')
          await expect.poll(cellPopover).toBeNull()
        }

        for (const [name, button] of [
          ['пульт', pultButton],
          ['журнал', logButton],
        ] as const) {
          const pop = await openList(button)
          const list = pop.querySelector<HTMLElement>('[data-popup-scroller]')!
          expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
          for (const at of [0, 0.5, 1]) {
            list.scrollTop = (list.scrollHeight - list.clientHeight) * at
            // eslint-disable-next-line no-await-in-loop
            await wait(150)
            expect(overflowOf(pop), `${viewport} ${name} ${at}`).toEqual([])
            expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
          }
          await userEvent.keyboard('{Escape}')
          await expect.poll(dialog).toBeNull()
        }
      } finally {
        await screen.unmount()
      }
    }
  })

  test('DR38: поповер отметки ячейки — поповер-панель: над кнопками разделителя нет; от верхнего края до заголовка и от кнопок до нижнего края — поле поповера, от заголовка до содержимого и от содержимого до кнопок — двойное поле (ADR 0183, PK33)', async () => {
    await page.viewport(1024, 700)
    const screen = await render(<Grid width={760} />)
    await waitForGrid()
    try {
      /**
       * Отступы по вертикали: от верхнего края до заголовка, от заголовка до содержимого, от
       * содержимого до кнопок, от кнопок до нижнего края; линий над кнопками нет.
       */
      const verticalGaps = (pop: HTMLElement) => {
        const box = pop.getBoundingClientRect()
        const blocks: { top: number; bottom: number }[] = []
        const walker = document.createTreeWalker(pop, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement!
          if (!node.textContent?.trim() || parent.closest('button')) continue
          if (parent.closest('[data-visually-hidden]')) continue
          // Шапка поповера — строка высоты пункта (ADR 0183, PK33): блок — сама строка.
          const heading = parent.closest<HTMLElement>(
            '[data-popup-level-title]',
          )
          if (heading) {
            const rect = heading.getBoundingClientRect()
            blocks.push({ top: rect.top, bottom: rect.bottom })
            continue
          }
          // Строки текста — блок без полей: межстрочный интервал входит в строку, как в раскладке.
          const rect = parent.getBoundingClientRect()
          const style = getComputedStyle(parent)
          if (rect.height > 0)
            blocks.push({
              top: rect.top + parseFloat(style.paddingTop),
              bottom: rect.bottom - parseFloat(style.paddingBottom),
            })
        }
        const buttons = [...pop.querySelectorAll('button')].map(button =>
          button.getBoundingClientRect(),
        )
        // Линия — рамка сверху или псевдоэлемент у блока, а не рамка кнопки.
        const lines = [...pop.querySelectorAll<HTMLElement>('*')].filter(el => {
          if (el.closest('button')) return false
          const line = getComputedStyle(el, '::before')
          return (
            parseFloat(getComputedStyle(el).borderTopWidth) > 0 ||
            (line.content !== 'none' && parseFloat(line.borderTopWidth) > 0)
          )
        })
        expect(lines).toEqual([])
        const all = [...blocks, ...buttons]
        const title = Math.min(...blocks.map(block => block.top))
        const titleBottom = Math.max(
          ...blocks.filter(b => b.top <= title + 0.5).map(b => b.bottom),
        )
        const gaps = [
          title - box.top,
          Math.min(
            ...blocks.filter(b => b.top >= titleBottom - 0.5).map(b => b.top),
          ) - titleBottom,
          box.bottom - Math.max(...all.map(block => block.bottom)),
        ]
        if (buttons.length > 0) {
          const row = Math.min(...buttons.map(b => b.top))
          gaps.push(
            row -
              Math.max(
                ...blocks.filter(b => b.bottom <= row + 0.5).map(b => b.bottom),
              ),
          )
        }
        return gaps.map(Math.round)
      }
      /**
       * Края — поле поповера, промежутки внутри — двойное поле (ADR 0183, PK33); на пиксель —
       * округление раскладки и межстрочный интервал строки.
       */
      const expectEven = (gaps: number[], field: number, name: string) => {
        const [top, inner, bottom, ...rest] = gaps
        for (const [gap, expected] of [
          [top, field],
          [inner, field * 2],
          [bottom, field],
          ...rest.map(gap => [gap, field * 2]),
        ] as const) {
          expect(gap, `${name}: ${gaps.join(', ')}`).toBeGreaterThanOrEqual(
            expected,
          )
          expect(gap, `${name}: ${gaps.join(', ')}`).toBeLessThanOrEqual(
            expected + 1,
          )
        }
      }

      // Отказ ячейки — поповер её отметки с причиной и кнопками.
      api.reportFailure({
        label: 'Age',
        target: { cell: ['3', 'age'] },
        reason: 'Locked',
      })
      api.setDraft({
        kind: 'cellValue',
        target: { cell: ['2', 'age'] },
        value: { value: 5, text: '5' },
      })

      // Поповер отметки ячейки: отступы поповера-панели.
      cell('3', 'age')?.scrollIntoView({ block: 'center' })
      const found = await expect
        .poll(() =>
          cell('3', 'age')?.querySelector<HTMLElement>('[data-cell-issue]'),
        )
        .toBeTruthy()
      void found
      await humanClick(
        cell('3', 'age')!.querySelector<HTMLElement>('[data-cell-issue]')!,
      )
      await expect.poll(cellPopover).not.toBeNull()
      const issue = cellPopover()!
      expectEven(
        verticalGaps(issue),
        parseFloat(getComputedStyle(issue).paddingLeft),
        'поповер отметки',
      )
      await userEvent.keyboard('{Escape}')
      await expect.poll(cellPopover).toBeNull()
    } finally {
      await screen.unmount()
    }
  })
})
