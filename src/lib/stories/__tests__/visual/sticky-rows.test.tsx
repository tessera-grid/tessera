import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, server as browser, userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { definePlugin } from '../../../core/definePlugin'
import { neverInert } from '../../../core/pluginDiagnostics'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnPinning,
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { settleRowMotion } from '../helpers'
import { AXE_OPTIONS, inBothThemes, toRgba } from './a11y-helpers'

// Липкие строки групп и веток (ADR 0160, этап 2): стопка под шапкой, выталкивание,
// горизонтальная прокрутка и закреплённые колонки, серверная модель (EA6); шеврон копии,
// клавиатура и скринридер (EA7); сворачивание с места строки после плавной прокрутки (EA12);
// axe, контраст, токен линии и высокая контрастность (EA9).
// EA8 — модульный stickyRows, EA10 — перф в scroll.

const fc = commands as unknown as {
  forcedColors: (active: boolean) => Promise<void>
}

interface Item {
  id: string
  team: string
  city: string
  name: string
  [column: string]: string
}

/** Две команды по 60 строк, в каждой три города по 20: группы двух уровней. */
const DATA: Item[] = Array.from({ length: 120 }, (_, i) => ({
  id: `r${i}`,
  team: `T${Math.floor(i / 60)}`,
  city: `C${Math.floor((i % 60) / 20)}`,
  name: `N${i}`,
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, k) => [`c${k}`, `${i}-${k}`]),
  ),
}))
const COLUMNS = [
  { id: 'team', accessorKey: 'team', header: 'Team', size: 140 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 140 },
  { id: 'name', accessorKey: 'name', header: 'Name', size: 140 },
  ...Array.from({ length: 10 }, (_, k) => ({
    id: `c${k}`,
    accessorKey: `c${k}`,
    header: `C${k}`,
    size: 140,
  })),
]

/**
 * Места строк: T0 — 0, T0/C0 — 1, её строки — 2…21, T0/C1 — 22, …, T0/C2 — 43, T1 — 64.
 */
const Grouped = ({ keyboard = false }: { keyboard?: boolean }) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    state: { columnPinning: { start: ['name'], end: [] } },
    plugins: [
      rowGrouping({ initialGrouping: ['team', 'city'], stickyRows: true }),
      rowExpanding({ initialExpanded: true }),
      columnPinning(),
    ] as never,
  } as never)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Свой плагин: строки групп липнут по факту ядра, а не по аргументу `rowGrouping`. */
const ownStickyGroups = definePlugin<{ enabled?: boolean }>()({
  id: 'ownStickyGroups',
  diagnose: neverInert,
  options: o => ({ stickyGroupRows: o.enabled !== false }),
})

const OwnSticky = ({ own }: { own: boolean }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      rowGrouping({ initialGrouping: ['team', 'city'] }),
      rowExpanding({ initialExpanded: true }),
      ownStickyGroups({ enabled: own }),
    ] as never,
  } as never)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Ветвь r3 серверной модели — 40 вложенных строк, блоками по 20. */
const CHILDREN = 40
const getRows = ({ start, end, parentId }: ServerRowsRequest) =>
  Promise.resolve<ServerRowsResponse<Item>>({
    rows: Array.from(
      {
        length: Math.max(0, Math.min(end, parentId ? CHILDREN : 200) - start),
      },
      (_, k) => {
        const id = parentId ? `${parentId}.${start + k}` : `r${start + k}`
        return { id, team: '', city: '', name: id }
      },
    ),
    rowCount: parentId ? CHILDREN : 200,
  })

const Server = () => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: [] as Item[],
    getRowId: (row: Item) => row.id,
    state: { columnPinning: { start: ['name'], end: ['c9'] } },
    plugins: [
      columnPinning(),
      serverRowModel({ getRows, blockSize: 20 }),
      rowExpanding({
        hasChildren: (row: { id: string; depth: number }) =>
          row.depth === 0 && row.id === 'r3',
        stickyRows: true,
      } as never),
    ] as never,
  })
  return (
    <div style={{ width: 400, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)
const container = () => q('.data-grid__container')!
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(container()).getPropertyValue('--tsr-comp-row-height'),
  )
const headBottom = () => q('.data-grid__head')!.getBoundingClientRect().bottom
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Липкие копии сверху вниз по стопке: мелкий уровень — первым. */
const copies = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[data-sticky-rows] [data-row-id]',
    ),
  ].reverse()
const copyIds = () => copies().map(copy => copy.dataset.rowId)
/** Верх копий от низа шапки, px. */
const copyTops = () =>
  copies().map(copy =>
    Math.round(copy.getBoundingClientRect().top - headBottom()),
  )
const realRow = (id: string) =>
  q(
    `.data-grid__body-row[data-row-id="${CSS.escape(id)}"]:not([data-sticky-copy])`,
  )
const cellOf = (row: HTMLElement, column: string) =>
  row.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
/** Строки-группы: команда и её города. */
const t0 = 'team:T0'
const t0c0 = 'team:T0>city:C0'
const t0c1 = 'team:T0>city:C1'
const t0c2 = 'team:T0>city:C2'

const scrollTo = async (top: number, left?: number) => {
  container().scrollTop = top
  if (left !== undefined) container().scrollLeft = left
  await nextFrame()
  await nextFrame()
}

describe('липкие строки групп и веток (ADR 0160)', () => {
  test('EA6: строка группы держится под шапкой, пока видны её строки; уровни — стопкой; следующая группа выталкивает прежнюю; копии идут с горизонтальной прокруткой и закреплёнными колонками; так и в серверной модели', async () => {
    const screen = await render(<Grouped />)
    try {
      await expect.poll(() => realRow('r3')).not.toBeNull()
      const h = rowHeight()
      expect(copies()).toEqual([])

      // Внутри T0/C0: группа и подгруппа стопкой.
      await scrollTo(5 * h)
      await expect.poll(copyIds).toEqual([t0, t0c0])
      expect(copyTops()).toEqual([0, h])

      // Подгруппа T0/C1 выталкивает T0/C0, T0 стоит; линия — у T0.
      await scrollTo(20.5 * h)
      await expect.poll(copyTops).toEqual([0, h / 2])
      const [team, city] = copies()
      expect(city!.hasAttribute('data-sticky-pushed')).toBe(true)
      expect(team!.hasAttribute('data-sticky-pushed')).toBe(false)
      expect(team!.hasAttribute('data-sticky-last')).toBe(true)

      // Группа T1 выталкивает T0; подгруппа ушла под неё, пока T1 подходила.
      await scrollTo(63.5 * h)
      await expect.poll(copyIds).toEqual([t0])
      expect(copyTops()).toEqual([-h / 2])

      // Горизонтальная прокрутка за начало окна колонок: ячейки копий над ячейками
      // строк, закреплённая стоит.
      await scrollTo(5 * h)
      await expect.poll(copyIds).toEqual([t0, t0c0])
      const leftOf = (row: HTMLElement, column: string) =>
        cellOf(row, column).getBoundingClientRect().left
      const pinnedAt = leftOf(copies()[1]!, 'name')
      await scrollTo(5 * h, 900)
      const real = realRow('r8')!
      for (const copy of copies()) {
        expect(leftOf(copy, 'name')).toBe(leftOf(real, 'name'))
        expect(leftOf(copy, 'name')).toBe(pinnedAt)
        expect(leftOf(copy, 'c6')).toBe(leftOf(real, 'c6'))
      }
    } finally {
      await screen.unmount()
    }

    // Серверная модель: ветвь r3 держится под шапкой, r4 её выталкивает.
    const server = await render(<Server />)
    try {
      await expect.poll(() => realRow('r3')).not.toBeNull()
      await userEvent.click(
        realRow('r3')!.querySelector<HTMLElement>('.row-expand-button')!,
      )
      await expect.poll(() => realRow('r3.0')).not.toBeNull()
      const h = rowHeight()
      await scrollTo(10 * h)
      await expect.poll(copyIds).toEqual(['r3'])
      expect(copyTops()).toEqual([0])
      const position = (row: HTMLElement, id: string) =>
        cellOf(row, id).getBoundingClientRect().left
      const pinnedLeft = position(copies()[0]!, 'name')
      const pinnedRight = position(copies()[0]!, 'c9')
      await scrollTo(10 * h, 900)
      expect(container().scrollLeft).toBe(900)
      const real = realRow('r3.6')!
      const copy = copies()[0]!
      expect(position(copy, 'name')).toBe(pinnedLeft)
      expect(position(copy, 'c9')).toBe(pinnedRight)
      for (const id of ['name', 'c4', 'c9'])
        expect(position(copy, id)).toBe(position(real, id))
      // r4 — сразу за 40 вложенными строками: на месте 44.
      await scrollTo(43.5 * h)
      // После прыжка блок ветки просят, когда быстрая прокрутка кончится (ADR 0138, SD6).
      await expect
        .poll(() => realRow('r3.39'), { timeout: 5000 })
        .not.toBeNull()
      await expect.poll(copyTops).toEqual([-h / 2])
    } finally {
      await server.unmount()
    }
  })

  test('EA7: шеврон липкой строки сворачивает группу, и строка встаёт под копиями предков; копии скрыты от скринридера и вне табуляции, клавиши ходят по настоящим строкам — с клавиатурной навигацией и без', async () => {
    for (const keyboard of [true, false]) {
      const screen = await render(<Grouped keyboard={keyboard} />)
      try {
        await expect.poll(() => realRow('r3')).not.toBeNull()
        const h = rowHeight()
        // Внутри T0/C1: стопка T0 и T0/C1.
        await scrollTo(25 * h)
        await expect.poll(copyIds).toEqual([t0, t0c1])

        // Копии скрыты от скринридера, их кнопки — вне табуляции.
        const block = q('[data-sticky-rows]')!
        expect(block.getAttribute('aria-hidden')).toBe('true')
        const focusables =
          block.querySelectorAll<HTMLElement>('button, [tabindex]')
        expect(focusables.length).toBeGreaterThan(0)
        for (const node of focusables) expect(node.tabIndex).toBe(-1)

        if (keyboard) {
          // Строка T0/C1 вверху, под копиями: клавиши ставят фокус на её ячейку и на неё
          // саму (treegrid), а не на её копию.
          await scrollTo(22 * h)
          await expect.poll(copyIds).toEqual([t0, t0c1])
          await userEvent.click(cellOf(realRow('r26')!, 'c0'))
          // r26 — на месте 29, строка T0/C1 — на 22.
          for (let step = 0; step < 7; step++) {
            await userEvent.keyboard('{ArrowUp}')
          }
          const focused = () => document.activeElement as HTMLElement
          expect(focused().closest('[data-sticky-rows]')).toBe(null)
          expect(
            focused().closest<HTMLElement>('.data-grid__body-row')?.dataset
              .rowId,
          ).toBe(t0c1)
          await userEvent.keyboard('{Home}{ArrowLeft}')
          expect(focused().closest('[data-sticky-rows]')).toBe(null)
          expect(focused()).toBe(realRow(t0c1))
          await scrollTo(25 * h)
          await expect.poll(copyIds).toEqual([t0, t0c1])
        }

        // Шеврон копии T0/C1: группа свёрнута, её строка — сразу под копией T0.
        const copyToggle = () =>
          copies()[1]?.querySelector<HTMLElement>('.row-expand-button') ?? null
        await expect.poll(copyToggle).not.toBeNull()
        await userEvent.click(copyToggle()!)
        await expect.poll(() => realRow(t0c1)?.dataset.expanded).toBe('false')
        await expect.poll(copyIds).toEqual([t0])
        await expect
          .poll(() =>
            Math.round(
              realRow(t0c1)!.getBoundingClientRect().top - headBottom(),
            ),
          )
          .toBe(h)
        // Строки ниже доезжают движением сворачивания (EA12).
        await settleRowMotion()

        // Клавиши: фокус ходит по настоящим строкам, в копии не заходит.
        if (keyboard) {
          // Вверх до строки T0 — у неё есть копия в стопке.
          await userEvent.click(cellOf(realRow('r42')!, 'c0'))
          const focusedRow = () =>
            document.activeElement?.closest<HTMLElement>('.data-grid__body-row')
          for (
            let step = 0;
            step < 30 && focusedRow()?.dataset.rowId !== t0;
            step++
          ) {
            await userEvent.keyboard('{ArrowUp}')
            expect(document.activeElement?.closest('[data-sticky-rows]')).toBe(
              null,
            )
            expect(focusedRow()).toBeTruthy()
          }
          expect(focusedRow()?.dataset.rowId).toBe(t0)
        } else {
          // После прыжка ячейки — скелеты, пока быстрая прокрутка не кончится.
          const toggle = () =>
            realRow(t0c2)?.querySelector<HTMLElement>('.row-expand-button')
          await expect.poll(toggle, { timeout: 5000 }).not.toBeNull()
          toggle()!.focus()
          for (let step = 0; step < 6; step++) {
            await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
            expect(document.activeElement?.closest('[data-sticky-rows]')).toBe(
              null,
            )
          }
        }
      } finally {
        await screen.unmount()
      }
    }
  })

  test('EA12: шеврон липкой строки сначала плавно прокручивает к строке группы, затем сворачивает её на месте — прокрутка после сворачивания его не обрывает; при уменьшенном движении прокрутка сразу', async () => {
    const motion = commands as unknown as {
      reducedMotion: (reduce: boolean) => Promise<void>
    }
    /** Кадры от нажатия шеврона копии T0/C1: прокрутка и раскрыта ли группа. */
    const collapseFromCopy = async (animated: boolean) => {
      const h = rowHeight()
      await scrollTo(40 * h)
      await expect.poll(copyIds).toEqual([t0, t0c1])
      const frames: { top: number; expanded: string | undefined }[] = []
      await userEvent.click(
        copies()[1]!.querySelector<HTMLElement>('.row-expand-button')!,
      )
      for (let i = 0; i < 180; i++) {
        frames.push({
          top: container().scrollTop,
          expanded: realRow(t0c1)?.dataset.expanded,
        })
        if (frames.at(-1)!.expanded === 'false') break
        // eslint-disable-next-line no-await-in-loop
        await nextFrame()
      }
      const collapsedAt = frames.findIndex(f => f.expanded === 'false')
      expect(collapsedAt, 'группа свёрнута').toBeGreaterThan(0)
      const scrolling = frames.slice(0, collapsedAt)
      // Сворачивание идёт движением строк: прокрутка его не оборвала. При уменьшенном
      // движении его нет.
      await nextFrame()
      const animations = document
        .querySelector('.data-grid__body')!
        .getAnimations({ subtree: true }).length
      if (animated)
        expect(animations, 'движение сворачивания').toBeGreaterThan(0)
      await settleRowMotion()
      // Свёрнута на месте: под копией предка, без прокрутки после сворачивания. Плавная
      // прокрутка Firefox встаёт на дробный `scrollTop` — допуск в пиксель.
      await expect
        .poll(() =>
          Math.abs(
            realRow(t0c1)!.getBoundingClientRect().top - headBottom() - h,
          ),
        )
        .toBeLessThanOrEqual(1)
      expect(container().scrollTop).toBe(frames[collapsedAt]!.top)
      return new Set(scrolling.map(f => Math.round(f.top))).size
    }

    const screen = await render(<Grouped />)
    try {
      await expect.poll(() => realRow('r3')).not.toBeNull()
      // Плавно: до сворачивания прокрутка проходит промежуточные положения.
      expect(await collapseFromCopy(true), 'плавная прокрутка').toBeGreaterThan(
        3,
      )
    } finally {
      await screen.unmount()
    }

    await motion.reducedMotion(true)
    const reduced = await render(<Grouped />)
    try {
      await expect.poll(() => realRow('r3')).not.toBeNull()
      expect(
        await collapseFromCopy(false),
        'уменьшенное движение',
      ).toBeLessThanOrEqual(2)
    } finally {
      await motion.reducedMotion(false)
      await reduced.unmount()
    }
  })

  test('EA9: axe с color-contrast липких строк в обеих темах; линия под стопкой — токен темы; в высокой контрастности — линия цвета разделителя', async () => {
    const screen = await render(<Grouped />)
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    try {
      await expect.poll(() => realRow('r3')).not.toBeNull()
      await scrollTo(5 * rowHeight())
      await expect.poll(() => copies().length).toBe(2)
      await inBothThemes(async () => {
        expect(
          (await axe.run(q('.data-grid-theme')!, options)).violations,
        ).toEqual([])
      })

      // Линия под нижней копией — токен темы.
      const last = q('[data-sticky-rows] [data-sticky-last]')!
      const token = getComputedStyle(last).getPropertyValue(
        '--tsr-comp-sticky-row-border-color',
      )
      const probe = document.createElement('span')
      probe.style.color = token
      last.append(probe)
      const want = getComputedStyle(probe).color
      probe.remove()
      expect(getComputedStyle(last).boxShadow).toContain(want)

      if (browser.browser !== 'webkit') {
        await fc.forcedColors(true)
        try {
          const line = getComputedStyle(last, '::before')
          expect(line.height).toBe('1px')
          const divider = document.createElement('span')
          divider.style.color = 'var(--tsr-comp-cell-divider-color)'
          last.append(divider)
          const color = getComputedStyle(divider).color
          divider.remove()
          expect(toRgba(line.backgroundColor)).toEqual(toRgba(color))
          expect(
            (await axe.run(q('.data-grid-theme')!, options)).violations,
          ).toEqual([])
        } finally {
          await fc.forcedColors(false)
        }
      }
    } finally {
      await screen.unmount()
    }
  })

  test('CH3: свой плагин, объявивший липкие строки фактом ядра, получает их копии под шапкой, как встроенные', async () => {
    for (const own of [false, true]) {
      const screen = await render(<OwnSticky own={own} />)
      try {
        await expect.poll(() => realRow('r3')).not.toBeNull()
        const h = rowHeight()
        await scrollTo(5 * h)
        await expect.poll(copyIds).toEqual(own ? [t0, t0c0] : [])
        if (own) expect(copyTops()).toEqual([0, h])
      } finally {
        await screen.unmount()
      }
    }
  })
})
