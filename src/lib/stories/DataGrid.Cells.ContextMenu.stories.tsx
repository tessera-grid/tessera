import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  cellOf,
  closeMenu,
  isSelected,
  openMenu,
  pressCell,
  rightClickCell,
  selectedCells,
  untilDone,
} from './__mocks__/cellGestures'
import {
  consoleText,
  expectPopupInCanvas,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/** Контекстное меню (ADR 0030). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Context menu',
} satisfies Meta<StoryProps>

export default meta

export const ContextMenuPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableContextMenu',
    'enableCellSelection',
    'enableKeyboardNavigation',
  ]),
  args: {
    // Правый клик по ячейке открывает меню таблицы; выделение ячеек даёт пункт
    // копирования, с клавиатурой меню открывает Shift+F10.
    enableContextMenu: true,
    enableCellSelection: true,
    columnCount: 8,
    dataCount: 40,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
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

// --- ADR 0030 S1 ---------------------------------------------------------------------

const TARGET = { row: 'item-id-1', column: 'firstName' }
const RANGE_END = { row: 'item-id-3', column: 'age' }
const INSIDE = { row: 'item-id-2', column: 'lastName' }
/** Прямоугольник 3 × 3. */
const RANGE_CELLS = 9
const COPY = '[data-action-id="cellSelection:copy"]'

const at = (root: ParentNode, cell: { row: string; column: string }) =>
  cellOf(root, cell.row, cell.column)!

const openOnTarget = (root: HTMLElement) => {
  if (!openMenu()) rightClickCell(at(root, TARGET))
}

/** Угол меню у центра ячейки — там, где пользователь нажал правой кнопкой. */
const menuAt = (cell: HTMLElement) => {
  const menu = openMenu()
  if (!menu) return false
  const box = cell.getBoundingClientRect()
  const { left, top } = menu.getBoundingClientRect()
  return (
    Math.abs(left - (box.left + box.width / 2)) +
      Math.abs(top - (box.top + box.height / 2)) <
    24
  )
}

/**
 * Меню у ячейки. Оно стоит в точке нажатия и за таблицей не едет: таблица сдвинулась
 * (раскрылась панель гайда) — меню открывается заново у ячейки.
 */
const openAt = (cell: HTMLElement) => {
  if (!openMenu()) rightClickCell(cell)
  else if (!menuAt(cell)) closeMenu()
}

/** Ячейка стоит на месте с прошлой проверки: раскрытие панели гайда закончилось. */
const steady = () => {
  let last: number | undefined
  return (cell: HTMLElement) => {
    const top = cell.getBoundingClientRect().top
    const same = top === last
    last = top
    return same
  }
}

const MENU: readonly GuideStoryStep[] = [
  {
    title: 'Меню у курсора',
    hint: 'Пользователь нажал правой кнопкой по ячейке. Ячейка выделилась, а у курсора открылось меню таблицы вместо меню браузера.',
    states: ['overlay.contextMenu'],
    enter: root => {
      const still = steady()
      return untilDone(
        root => still(at(root, TARGET)) && menuAt(at(root, TARGET)),
        root => openAt(at(root, TARGET)),
      )(root, undefined)
    },
  },
  {
    title: 'Ячейка скопирована',
    hint: 'Пользователь выбрал копирование. Меню закрылось, значение ячейки попало в буфер, в консоли запись о копировании.',
    enter: root => {
      const chosen = { done: false }
      return untilDone(
        () => chosen.done && !openMenu(),
        () => {
          const item = openMenu()?.querySelector<HTMLElement>(COPY)
          if (item) {
            item.click()
            chosen.done = true
          } else openOnTarget(root)
        },
      )(root, undefined)
    },
  },
  {
    title: 'Меню внутри диапазона',
    hint: 'Пользователь выделил несколько ячеек и открыл меню на одной из них. Выделение осталось, копирование возьмёт весь диапазон.',
    states: ['overlay.contextMenu'],
    enter: root => {
      const still = steady()
      return untilDone(
        root =>
          selectedCells(root) === RANGE_CELLS &&
          still(at(root, INSIDE)) &&
          menuAt(at(root, INSIDE)),
        root => {
          if (selectedCells(root) !== RANGE_CELLS) {
            if (openMenu()) closeMenu()
            else if (!isSelected(at(root, TARGET))) pressCell(at(root, TARGET))
            else pressCell(at(root, RANGE_END), { shiftKey: true })
          } else openAt(at(root, INSIDE))
        },
      )(root, undefined)
    },
  },
  {
    title: 'Диапазон скопирован',
    hint: 'Пользователь выбрал копирование. Меню закрылось, а в буфер попал весь диапазон, а не одна ячейка: три строки по три значения, как в таблице. Вставка в электронную таблицу разложит их по ячейкам, в текстовый редактор — строками со значениями через табуляцию.',
    states: ['body.cellRange'],
    enter: root => {
      const chosen = { done: false }
      return untilDone(
        () => chosen.done && !openMenu(),
        root => {
          const item = openMenu()?.querySelector<HTMLElement>(COPY)
          if (selectedCells(root) !== RANGE_CELLS) {
            if (openMenu()) closeMenu()
            else if (!isSelected(at(root, TARGET))) pressCell(at(root, TARGET))
            else pressCell(at(root, RANGE_END), { shiftKey: true })
          } else if (!item) rightClickCell(at(root, INSIDE))
          else {
            item.click()
            chosen.done = true
          }
        },
      )(root, undefined)
    },
  },
]

/** Строки диапазона, как их видит пользователь: значения ячеек через табуляцию. */
const rangeText = (root: ParentNode) =>
  ['item-id-1', 'item-id-2', 'item-id-3']
    .map(row =>
      ['firstName', 'lastName', 'age']
        .map(column => cellOf(root, row, column)!.textContent!.trim())
        .join('\t'),
    )
    .join('\n')

/** ADR 0030, S1: меню таблицы у ячейки — копирование одной ячейки и диапазона. */
export const ContextMenuCell: StoryObj<StoryProps> = {
  name: 'Menu on a cell',
  parameters: { scenario: '0030/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Контекстное меню ячейки"
      steps={MENU}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          columnCount: 8,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MENU[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      expect(isSelected(at(canvas, TARGET))).toBe(true)
      expect(openMenu()!.querySelector(COPY)).not.toBeNull()
      await settle()
      expectPopupInCanvas(canvas, openMenu()!)
      const cell = at(canvas, TARGET).getBoundingClientRect()
      const menu = openMenu()!.getBoundingClientRect()
      expect(
        Math.abs(menu.left - (cell.left + cell.width / 2)) +
          Math.abs(menu.top - (cell.top + cell.height / 2)),
      ).toBeLessThan(24)
    })
    await step(MENU[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(openMenu()).toBeNull())
      await until(() => expect(consoleText()).toContain('cellSelection:copy'))
    })
    await step(MENU[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      expect(selectedCells(canvas)).toBe(RANGE_CELLS)
      expect(openMenu()!.querySelector(COPY)).not.toBeNull()
      await settle()
    })
    await step(MENU[3]!.title, async () => {
      // Что меню кладёт в буфер — перехватом записи: буфер страницы тест не читает.
      const clipboard = navigator.clipboard
      const write = clipboard.write
      const written: { text: string; html: string }[] = []
      clipboard.write = async items => {
        for (const item of items)
          written.push({
            text: await (await item.getType('text/plain')).text(),
            html: await (await item.getType('text/html')).text(),
          })
      }
      try {
        await guideNext(canvas)
        await until(() => expect(written).toHaveLength(1))
        expect(written[0]!.text).toBe(rangeText(canvas))
        expect(written[0]!.html.match(/<tr>/g)).toHaveLength(3)
        expect(openMenu()).toBeNull()
        expect(selectedCells(canvas)).toBe(RANGE_CELLS)
      } finally {
        clipboard.write = write
      }
      await settle()
    })
  },
}
