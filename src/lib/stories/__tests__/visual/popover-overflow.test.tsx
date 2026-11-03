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
    .poll(() => pop.querySelector<HTMLElement>('[class*="scroller"]'))
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
          const list = pop.querySelector<HTMLElement>('[class*="scroller"]')!
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

  test('DR38: в пульте и журнале отказов край записей совпадает с краем заголовка и подвала — с полосой прокрутки списка и без неё; разделители в поповерах отметки, пульта и журнала — по ширине содержимого, отступ от верхнего края до заголовка, от содержимого до разделителя, от разделителя до содержимого и от кнопок до нижнего края — один: двойное поле поповера', async () => {
    await page.viewport(1024, 700)
    const screen = await render(<Grid width={760} />)
    await waitForGrid()
    try {
      /**
       * Отступы по вертикали: от верхнего края до первого текста, от содержимого до каждой
       * линии и от линии до содержимого, от последней кнопки до нижнего края.
       */
      const verticalGaps = (pop: HTMLElement) => {
        const box = pop.getBoundingClientRect()
        const blocks: { top: number; bottom: number }[] = []
        const walker = document.createTreeWalker(pop, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement!
          if (!node.textContent?.trim() || parent.closest('button')) continue
          if (parent.closest('[class*="visually-hidden"]')) continue
          // Строки текста — блок без полей: межстрочный интервал входит в строку, как в раскладке.
          const rect = parent.getBoundingClientRect()
          const style = getComputedStyle(parent)
          if (rect.height > 0)
            blocks.push({
              top: rect.top + parseFloat(style.paddingTop),
              bottom: rect.bottom - parseFloat(style.paddingBottom),
            })
        }
        for (const button of pop.querySelectorAll('button'))
          blocks.push(button.getBoundingClientRect())
        const lines = [...pop.querySelectorAll<HTMLElement>('*')]
          .filter(el => {
            const line = getComputedStyle(el, '::before')
            return (
              line.content !== 'none' && parseFloat(line.borderTopWidth) > 0
            )
          })
          .map(el => el.getBoundingClientRect().top)
        const gaps = [
          Math.min(...blocks.map(block => block.top)) - box.top,
          box.bottom - Math.max(...blocks.map(block => block.bottom)),
        ]
        for (const y of lines) {
          gaps.push(
            y -
              Math.max(
                ...blocks.filter(b => b.bottom <= y + 0.5).map(b => b.bottom),
              ),
            Math.min(...blocks.filter(b => b.top >= y - 0.5).map(b => b.top)) -
              y,
          )
        }
        return gaps.map(Math.round)
      }
      /** Каждый отступ — двойное поле поповера (на пиксель — округление раскладки). */
      const expectEven = (gaps: number[], field: number, name: string) => {
        for (const gap of gaps) {
          expect(gap, `${name}: ${gaps.join(', ')}`).toBeGreaterThanOrEqual(
            field * 2,
          )
          expect(gap, `${name}: ${gaps.join(', ')}`).toBeLessThanOrEqual(
            field * 2 + 1,
          )
        }
      }

      /** Края содержимого: заголовок, записи и подвал от края поповера. */
      const edges = (pop: HTMLElement) => {
        const box = pop.getBoundingClientRect()
        const title = pop.querySelector<HTMLElement>('[class*="title"]')!
        const contentLeft = (el: HTMLElement) =>
          Math.round(
            el.getBoundingClientRect().left +
              parseFloat(getComputedStyle(el).paddingLeft) -
              box.left,
          )
        const contentRight = (el: HTMLElement) =>
          Math.round(
            box.right -
              (el.getBoundingClientRect().right -
                parseFloat(getComputedStyle(el).paddingRight)),
          )
        const entries = [
          ...pop.querySelectorAll<HTMLElement>(
            '[class*="scroller"] [class*="entry"]',
          ),
        ]
        const buttons = [...pop.querySelectorAll<HTMLElement>('button')]
        const footer = buttons.at(-1)!
        // Разделители: линии `::before` записей и подвала — их концы от края поповера.
        const lines = [...entries, footer.parentElement!].map(el => {
          const line = getComputedStyle(el, '::before')
          const rect = el.getBoundingClientRect()
          return [
            Math.round(rect.left + parseFloat(line.left) - box.left),
            Math.round(box.right - rect.right + parseFloat(line.right)),
          ]
        })
        const row = footer.parentElement!
        return {
          lines: [...new Set(lines.map(line => line.join()))],
          gap: Math.round(
            footer.getBoundingClientRect().top -
              row.getBoundingClientRect().top,
          ),
          field: parseFloat(getComputedStyle(pop).paddingLeft),
          title: contentLeft(title),
          entriesLeft: [...new Set(entries.map(contentLeft))],
          entriesRight: [...new Set(entries.map(contentRight))],
          footerRight: Math.round(
            box.right - footer.getBoundingClientRect().right,
          ),
        }
      }
      const check = async (button: () => HTMLElement, name: string) => {
        const pop = await openList(button)
        const at = edges(pop)
        expect(at.entriesLeft, `${name} слева`).toEqual([at.title])
        expect(at.entriesRight, `${name} справа`).toEqual([at.footerRight])
        expect(at.lines, `${name} разделители`).toEqual([
          `${at.title},${at.footerRight}`,
        ])
        expect(at.gap, `${name} отступ до кнопок`).toBe(at.field * 2)
        if (name.endsWith('без полосы'))
          expectEven(verticalGaps(pop), at.field, name)
        await userEvent.keyboard('{Escape}')
        await expect.poll(dialog).toBeNull()
      }

      // Без полосы прокрутки: одна запись в каждом списке.
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
      await check(pultButton, 'пульт без полосы')
      await check(logButton, 'журнал без полосы')

      // Поповер отметки ячейки: те же отступы вокруг линии над кнопками.
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

      // С полосой прокрутки: длинные списки.
      await seed()
      await check(pultButton, 'пульт с полосой')
      await check(logButton, 'журнал с полосой')
    } finally {
      await screen.unmount()
    }
  })
})
