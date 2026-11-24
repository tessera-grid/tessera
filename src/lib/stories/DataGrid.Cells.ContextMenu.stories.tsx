import { useState } from 'react'
import { ArrowDownToLine, Calculator, Trash2 } from 'lucide-react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import type { TesseraFeatureEntry } from '../core/features'
import type { ContextMenuAction } from '../core/headerActions'
import { createDemoServer } from './__mocks__/plugins/asyncActionsDemo/asyncActionsDemo'
import { PENDING_WAVE_ANIMATION as PENDING_WAVE } from '../grid/useSkeletonWave'
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
  watchFlash,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import * as touch from './__mocks__/touchGuides'
import * as touchPlay from './__mocks__/catalogPlay'

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
    title: { ru: 'Меню ещё не открыто', en: 'The menu is not open yet' },
    hint: {
      ru: 'Приложение включило контекстное меню таблицы. Пользователь ещё не нажимал по ячейкам.',
      en: "The app turned on the table's context menu. The user has not clicked any cells yet.",
    },
  },
  {
    title: { ru: 'Меню у курсора', en: 'The menu at the pointer' },
    hint: {
      ru: 'Пользователь нажал правой кнопкой по ячейке. Ячейка выделилась, а у курсора открылось меню таблицы вместо меню браузера.',
      en: "The user right-clicked a cell. The cell was selected, and the table's menu opened at the pointer instead of the browser's menu.",
    },
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
    title: { ru: 'Ячейка скопирована', en: 'The cell is copied' },
    hint: {
      ru: 'Пользователь выбрал копирование. Меню закрылось, значение ячейки попало в буфер, в консоли запись о копировании.',
      en: "The user chose to copy. The menu closed, the cell's value went to the clipboard, and the console shows a copy entry.",
    },
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
    title: { ru: 'Меню внутри диапазона', en: 'The menu inside a range' },
    hint: {
      ru: 'Пользователь выделил несколько ячеек и открыл меню на одной из них. Выделение осталось, копирование возьмёт весь диапазон.',
      en: 'The user selected several cells and opened the menu on one of them. The selection stayed, and copying will take the whole range.',
    },
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
    title: { ru: 'Диапазон скопирован', en: 'The range is copied' },
    hint: {
      ru: 'Пользователь выбрал копирование. Меню закрылось, а в буфер попал весь диапазон, а не одна ячейка: три строки по три значения, как в таблице. Вставка в электронную таблицу разложит их по ячейкам, в текстовый редактор — строками со значениями через табуляцию.',
      en: 'The user chose to copy. The menu closed, and the whole range went to the clipboard, not just one cell: three rows of three values, as in the table. Pasting into a spreadsheet spreads them across cells; pasting into a text editor gives lines with tab-separated values.',
    },
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
      title={{ ru: 'Контекстное меню ячейки', en: 'Cell context menu' }}
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
    await step(MENU[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(MENU[1]!.title.ru, async () => {
      await guideNext(canvas)
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
    await step(MENU[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openMenu()).toBeNull())
      await until(() => expect(consoleText()).toContain('cellSelection:copy'))
    })
    await step(MENU[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(openMenu()).not.toBeNull())
      expect(selectedCells(canvas)).toBe(RANGE_CELLS)
      expect(openMenu()!.querySelector(COPY)).not.toBeNull()
      await settle()
    })
    await step(MENU[4]!.title.ru, async () => {
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

// --- ADR 0078 S2 ---------------------------------------------------------------------

/** Строка, где пересчёт демо-сервер отклоняет (каждая третья, ADR 0078). */
const ASYNC_TARGET = { row: 'item-id-3', column: 'firstName' }
const RECALCULATE = '[data-action-id$="asyncRecalculate"]'
const recalculate = () =>
  openMenu()?.querySelector<HTMLElement>(RECALCULATE) ?? null
const recalculatePending = () => !!recalculate()?.hasAttribute('data-pending')
const recalculateFailed = () =>
  !!recalculate()?.querySelector('[data-action-failed]')
const expectAsyncMenuInCanvas = (canvas: HTMLElement) =>
  until(() => {
    const menu = openMenu()
    expect(menu).not.toBeNull()
    expectPopupInCanvas(canvas, menu!)
  })
/**
 * Знак ожидания у `count` ячеек (ADR 0152, §3): волна у каждой или неподвижный свет —
 * при уменьшенном движении, как в тестах каталога.
 */
const pendingShown = (count: number) =>
  document.querySelector('[data-pending-wave-still]') !== null ||
  document.getAnimations().filter(animation => animation.id === PENDING_WAVE)
    .length === count
const busyCell = (root: ParentNode) =>
  at(root, ASYNC_TARGET).getAttribute('aria-busy') === 'true'
const flashedCell = (root: ParentNode) =>
  at(root, ASYNC_TARGET).getAttribute('data-flash') === 'reverted'
/** Вспышка держится на время снимка шага (ADR 0130, DG6): токен — до отказа шага. */
const holdFlash = (canvas: HTMLElement) =>
  canvas
    .querySelectorAll<HTMLElement>('.data-grid-theme')
    .forEach(theme =>
      theme.style.setProperty('--tsr-comp-flash-duration', '600000ms'),
    )
/** Таблица гайда «Async items»: шаг после вспышки снимает её удержание. */
const flashHold: { table?: { setFlashes: (flashes: object) => void } } = {}
const flashHoldSeed: TesseraFeatureEntry = {
  id: 'asyncItemsFlashHold',
  setup: table => {
    flashHold.table = table as unknown as typeof flashHold.table
  },
}
/** Удержание снято: следующий шаг — без вспышки, как у человека (ADR 0089, CX19). */
const releaseFlash = (canvas: HTMLElement) => {
  canvas
    .querySelectorAll<HTMLElement>('.data-grid-theme')
    .forEach(theme => theme.style.removeProperty('--tsr-comp-flash-duration'))
  flashHold.table?.setFlashes({})
}
/** Ход гайда: пересчёт запущен, меню после него открыто заново. */
const run = { started: false, reopened: false }

/** Пользователь выбирает пересчёт в открытом меню ячейки. */
const startRecalculate = (root: HTMLElement) => {
  const item = recalculate()
  if (item) {
    item.click()
    run.started = true
  } else openAt(at(root, ASYNC_TARGET))
}

const ASYNC_ITEMS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Меню ещё не открыто', en: 'The menu is not open yet' },
    hint: {
      ru: 'Приложение добавило в меню ячейки действие, которое выполняет сервер. Пользователь ещё не открывал меню.',
      en: 'The app added to the cell menu an action that the server runs. The user has not opened the menu yet.',
    },
  },
  {
    title: {
      ru: 'Меню с действием сервера',
      en: 'A menu with a server action',
    },
    hint: {
      ru: 'Приложение добавило в меню ячейки действие, которое выполняет сервер. Пользователь открыл меню правой кнопкой по ячейке.',
      en: 'The app added to the cell menu an action that the server runs. The user opened the menu by right-clicking a cell.',
    },
    states: ['overlay.contextMenu'],
    enter: root => {
      run.started = false
      run.reopened = false
      const still = steady()
      return untilDone(
        root =>
          still(at(root, ASYNC_TARGET)) &&
          menuAt(at(root, ASYNC_TARGET)) &&
          !!recalculate() &&
          // Проверка доступности пунктов кончилась: вид меню больше не изменится.
          !openMenu()?.querySelector('[data-pending]'),
        root => openAt(at(root, ASYNC_TARGET)),
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Действие выполняется', en: 'The action is running' },
    hint: {
      ru: 'Пользователь выбрал пересчёт и, пока сервер отвечает, снова открыл меню. Ячейка чуть темнеет и по ней проходит светлый блик — она занята, а пункт ждёт ответа: его подпись предлагает отменить пересчёт.',
      en: 'The user chose to recalculate and, while the server was responding, opened the menu again. The cell darkens slightly and a light sheen runs across it: it is busy, and the item is waiting for a response, with its label offering to cancel the recalculation.',
    },
    states: ['overlay.contextMenu'],
    immediate: true,
    enter: untilDone(
      () => run.started && recalculatePending(),
      root => {
        if (!run.started) startRecalculate(root)
        else if (!openMenu()) openAt(at(root, ASYNC_TARGET))
      },
    ),
  },
  {
    title: { ru: 'Отказ на ячейке', en: 'Refusal on the cell' },
    hint: {
      ru: 'Сервер не выполнил пересчёт. Меню закрыто, и ячейка, где его запускали, коротко вспыхивает тоном отказа — отказ виден там, где начато действие.',
      en: 'The server did not run the recalculation. The menu is closed, and the cell where it was started flashes briefly in the refusal tone: the refusal shows where the action began.',
    },
    immediate: true,
    enter: root => {
      // Вспышка — от запуска, который шаг видел занятым, а не прежняя.
      let sawBusy = false
      return untilDone(
        root => sawBusy && flashedCell(root),
        root => {
          if (busyCell(root)) {
            sawBusy = true
            if (openMenu()) closeMenu()
          } else if (sawBusy || flashedCell(root)) return
          else if (openMenu() && !recalculatePending()) startRecalculate(root)
          else if (openMenu()) closeMenu()
          else startRecalculate(root)
        },
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'При следующем открытии меню у пункта значок ошибки, его подсказка — причина; отказ объявлен.',
      en: 'The next time the menu opens, the item has an error icon, and its tooltip gives the reason; the refusal is announced.',
    },
    states: ['overlay.contextMenu'],
    enter: root => {
      run.reopened = false
      const still = steady()
      return untilDone(
        root =>
          run.reopened &&
          recalculateFailed() &&
          still(at(root, ASYNC_TARGET)) &&
          menuAt(at(root, ASYNC_TARGET)),
        root => {
          if (!run.started) startRecalculate(root)
          else if (openMenu() && recalculatePending()) return
          else if (openMenu() && !run.reopened) closeMenu()
          else if (!openMenu()) {
            openAt(at(root, ASYNC_TARGET))
            run.reopened = true
          }
        },
      )(root, undefined)
    },
  },
]

/** ADR 0078, S2: действие контекстного меню ждёт сервер и отказывает. */
export const ContextMenuAsyncItems: StoryObj<StoryProps> = {
  name: 'Async items',
  parameters: { scenario: '0078/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Действие сервера в меню',
        en: 'A server action in the menu',
      }}
      steps={ASYNC_ITEMS}
      reset={() => {
        run.started = false
        run.reopened = false
      }}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          actionsDemo: 'async',
          extraPlugins: [flashHoldSeed],
          columnCount: 8,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ASYNC_ITEMS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ASYNC_ITEMS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(recalculate()).not.toBeNull())
      await settle()
      await expectAsyncMenuInCanvas(canvas)
    })
    await step(ASYNC_ITEMS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(recalculatePending()).toBe(true))
      // Ждущий пункт доступен и предлагает отмену (ADR 0153, §3).
      await until(() =>
        expect(recalculate()).not.toHaveAttribute('data-disabled'),
      )
      await until(() =>
        expect(recalculate()!.textContent).toContain(
          storyLabels(args.locale).cancelAction('Recalculate'),
        ),
      )
      await until(() => expect(busyCell(canvas)).toBe(true))
      await until(() => expect(pendingShown(1)).toBe(true))
    })
    await step(ASYNC_ITEMS[3]!.title.ru, async () => {
      const flash = watchFlash(
        canvas,
        `.data-grid__body-row[data-row-id="${ASYNC_TARGET.row}"] [data-column-id="${ASYNC_TARGET.column}"]`,
        'reverted',
      )
      holdFlash(canvas)
      await guideNext(canvas)
      await until(() => expect(flash.seen()).toBe(true))
      flash.stop()
      await until(() => expect(openMenu()).toBeNull())
      await until(() => expect(busyCell(canvas)).toBe(false))
    })
    await step(ASYNC_ITEMS[4]!.title.ru, async () => {
      releaseFlash(canvas)
      await until(() => expect(flashedCell(canvas)).toBe(false))
      await guideNext(canvas)
      await until(() => expect(recalculateFailed()).toBe(true))
      const item = recalculate()!
      const id = item.getAttribute('aria-describedby')
      await until(() =>
        expect(id && document.getElementById(id)?.textContent).toBe(
          'Formula service timed out',
        ),
      )
      await settle()
      await expectAsyncMenuInCanvas(canvas)
    })
  },
}

// --- ADR 0152 S1 ---------------------------------------------------------------------

/** Выделение 3 × 2: от `FROM` до `TO`, меню открывается на `ON`. */
const FROM = { row: 'item-id-2', column: 'firstName' }
const TO = { row: 'item-id-4', column: 'lastName' }
const ON = { row: 'item-id-3', column: 'lastName' }
const SELECTION_CELLS = 6
const FILL = '[data-action-id$="selectionFill"]'
const SELECTION_REFUSAL = 'Cells are locked by another user'

/** «Сервер» гайда: придерживает ответ, пока шаг ожидания на виду, затем отказывает. */
const FILL_SERVER = createDemoServer()

const fillAction: ContextMenuAction = {
  id: 'selectionFill',
  icon: () => <ArrowDownToLine width={16} height={16} />,
  label: () => 'Fill down',
  onSelect: async () => {
    await FILL_SERVER.runs.answer()
    throw new Error(SELECTION_REFUSAL)
  },
}

const fillDemo: TesseraFeatureEntry = {
  id: 'selectionFillGuide',
  contextMenuActions: [fillAction],
}

const fillItem = () => openMenu()?.querySelector<HTMLElement>(FILL) ?? null
const selectionCells = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>(
    '.data-grid__body-cell[data-cell-selected="true"]',
  ),
]
const allBusy = (root: ParentNode) => {
  const cells = selectionCells(root)
  return (
    cells.length === SELECTION_CELLS &&
    cells.every(cell => cell.getAttribute('aria-busy') === 'true')
  )
}
const allFlashed = (root: ParentNode) => {
  const cells = selectionCells(root)
  return (
    cells.length === SELECTION_CELLS &&
    cells.every(cell => cell.getAttribute('data-flash') === 'reverted')
  )
}

/** Выделить 3 × 2 и открыть меню внутри — по одному жесту за попытку. */
const selectAndOpen = (root: HTMLElement) => {
  if (selectedCells(root) !== SELECTION_CELLS) {
    if (openMenu()) closeMenu()
    else if (!isSelected(at(root, FROM))) pressCell(at(root, FROM))
    else pressCell(at(root, TO), { shiftKey: true })
  } else openAt(at(root, ON))
}

const REFUSED_ON_SELECTION: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'В контекстном меню есть заполнение выделения, его выполняет сервер. Пользователь ещё не выделял ячейки.',
      en: 'The context menu has an action that fills the selection, and the server runs it. The user has not selected any cells yet.',
    },
  },
  {
    title: { ru: 'Меню на выделении', en: 'The menu on a selection' },
    hint: {
      ru: 'Пользователь выделил шесть ячеек и открыл меню на одной из них. Заполнение применяется ко всему выделению, его выполняет сервер.',
      en: 'The user selected six cells and opened the menu on one of them. The fill applies to the whole selection, and the server runs it.',
    },
    states: ['overlay.contextMenu'],
    enter: root => {
      const still = steady()
      return untilDone(
        root =>
          selectedCells(root) === SELECTION_CELLS &&
          still(at(root, ON)) &&
          menuAt(at(root, ON)) &&
          !!fillItem(),
        selectAndOpen,
      )(root, undefined)
    },
  },
  {
    title: {
      ru: 'Выделение ждёт ответа',
      en: 'The selection waits for a response',
    },
    hint: {
      ru: 'Пользователь выбрал заполнение. Меню закрылось; пока сервер отвечает, всё выделение чуть темнеет и по нему проходит светлый блик — оно занято.',
      en: 'The user chose to fill. The menu closed; while the server responds, the whole selection darkens slightly and a light sheen runs across it: it is busy.',
    },
    states: ['body.menuPending'],
    enter: root => {
      FILL_SERVER.runs.hold()
      return untilDone(
        root => allBusy(root) && !openMenu(),
        root => {
          if (allBusy(root)) {
            if (openMenu()) closeMenu()
          } else if (selectedCells(root) === SELECTION_CELLS && fillItem()) {
            fillItem()!.click()
          } else selectAndOpen(root)
        },
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Отказ на выделении', en: 'Refusal on the selection' },
    hint: {
      ru: 'Сервер отказал. Всё выделение коротко вспыхивает тоном отказа — там, где применялось действие; отказ объявлен.',
      en: 'The server refused. The whole selection flashes briefly in the refusal tone, where the action was applied; the refusal is announced.',
    },
    immediate: true,
    enter: root => {
      FILL_SERVER.runs.release()
      return untilDone(
        root => allFlashed(root),
        root => {
          if (allBusy(root)) return
          if (openMenu() && fillItem()) fillItem()!.click()
          else selectAndOpen(root)
        },
      )(root, undefined)
    },
  },
]

/** ADR 0152, S1: действие над выделением отказано — вспыхивает всё выделение. */
export const ContextMenuRefusedOnSelection: StoryObj<StoryProps> = {
  name: 'Refused on a selection',
  parameters: { scenario: '0152/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отказ действия над выделением',
        en: 'An action on a selection refused',
      }}
      steps={REFUSED_ON_SELECTION}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          actionsDemo: 'none',
          extraPlugins: [fillDemo],
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
    await step(REFUSED_ON_SELECTION[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(REFUSED_ON_SELECTION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(fillItem()).not.toBeNull())
      expect(selectedCells(canvas)).toBe(SELECTION_CELLS)
      await settle()
      expectPopupInCanvas(canvas, openMenu()!)
    })
    await step(REFUSED_ON_SELECTION[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(allBusy(canvas)).toBe(true))
      await until(() => expect(pendingShown(SELECTION_CELLS)).toBe(true))
      expect(openMenu()).toBeNull()
      expect(
        at(canvas, { row: 'item-id-1', column: 'firstName' }),
      ).not.toHaveAttribute('aria-busy')
    })
    await step(REFUSED_ON_SELECTION[3]!.title.ru, async () => {
      const flash = watchFlash(canvas, '.data-grid__body-cell', 'reverted')
      holdFlash(canvas)
      await guideNext(canvas)
      await until(() => expect(flash.most()).toBe(SELECTION_CELLS))
      flash.stop()
      expect(allBusy(canvas)).toBe(false)
    })
  },
}

// --- ADR 0153 S2 ---------------------------------------------------------------------

const RECALC = '[data-action-id$="selectionRecalculate"]'

/** «Сервер» гайда: придерживает ответ; запрос учитывает `signal` (ADR 0153, §1). */
const RECALC_SERVER = createDemoServer()

const recalcAction: ContextMenuAction = {
  id: 'selectionRecalculate',
  icon: () => <Calculator width={16} height={16} />,
  label: () => 'Recalculate',
  onSelect: (_ctx, _event, context) =>
    RECALC_SERVER.runs.answer(context?.signal),
}

const recalcDemo: TesseraFeatureEntry = {
  id: 'selectionRecalculateGuide',
  contextMenuActions: [recalcAction],
}

const recalcItem = () => openMenu()?.querySelector<HTMLElement>(RECALC) ?? null
const selectionIdle = (root: ParentNode) =>
  selectionCells(root).length === SELECTION_CELLS &&
  selectionCells(root).every(cell => !cell.hasAttribute('aria-busy'))

/** Выделить 3 × 2 — по одному жесту за попытку. */
const selectRange = (root: HTMLElement) => {
  if (openMenu()) closeMenu()
  else if (!isSelected(at(root, FROM))) pressCell(at(root, FROM))
  else pressCell(at(root, TO), { shiftKey: true })
}

/** Пересчёт выделения ждёт ответа: запускается, если ещё не идёт. */
const recalcPending = (root: HTMLElement) => {
  if (allBusy(root)) {
    if (openMenu()) closeMenu()
  } else if (selectedCells(root) === SELECTION_CELLS && recalcItem()) {
    recalcItem()!.click()
  } else if (selectedCells(root) === SELECTION_CELLS) openAt(at(root, ON))
  else selectRange(root)
}

/** Ждущий пункт в открытом меню выделения — после запуска пересчёта. */
const cancelItemShown = (root: HTMLElement) => {
  if (!allBusy(root)) recalcPending(root)
  else openAt(at(root, ON))
}

const CANCEL_FROM_MENU: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выделено', en: 'Nothing is selected' },
    hint: {
      ru: 'В контекстном меню есть действие, которое сервер выполняет долго. Пользователь ещё не выделял ячейки.',
      en: 'The context menu has an action that takes the server a long time. The user has not selected any cells yet.',
    },
  },
  {
    title: { ru: 'Выделен диапазон', en: 'A range is selected' },
    hint: {
      ru: 'Пользователь выделил несколько ячеек. В контекстном меню есть действие, которое сервер выполняет долго.',
      en: 'The user selected several cells. The context menu has an action that takes the server a long time.',
    },
    enter: untilDone(
      root => selectedCells(root) === SELECTION_CELLS && !openMenu(),
      selectRange,
    ),
  },
  {
    title: {
      ru: 'Действие над выделением ждёт',
      en: 'The action on the selection is waiting',
    },
    hint: {
      ru: 'Пользователь выбрал пересчёт. Меню закрылось, ячейки выделения под подложкой ожидания с бликом.',
      en: 'The user chose to recalculate. The menu closed, and the selected cells are under the waiting overlay with a sheen.',
    },
    states: ['body.menuPending'],
    enter: root => {
      RECALC_SERVER.runs.hold()
      return untilDone(root => allBusy(root) && !openMenu(), recalcPending)(
        root,
        undefined,
      )
    },
  },
  {
    title: { ru: 'Пункт предлагает отмену', en: 'The item offers to cancel' },
    hint: {
      ru: 'Пользователь снова открыл меню на выделении. Ждущий пункт доступен: подпись предлагает отменить пересчёт, у правого края крутится спиннер.',
      en: 'The user opened the menu on the selection again. The waiting item is available: its label offers to cancel the recalculation, and a spinner rotates at its right edge.',
    },
    states: ['overlay.contextMenu', 'body.menuPending'],
    enter: root => {
      RECALC_SERVER.runs.hold()
      const still = steady()
      return untilDone(
        root =>
          allBusy(root) &&
          still(at(root, ON)) &&
          menuAt(at(root, ON)) &&
          !!recalcItem()?.hasAttribute('data-pending'),
        cancelItemShown,
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Действие отменено', en: 'The action was canceled' },
    hint: {
      ru: 'Пользователь выбрал этот пункт. Меню закрылось, подложка и блик сняты, отметки ошибки нет.',
      en: 'The user chose this item. The menu closed, the overlay and sheen are gone, and there is no error mark.',
    },
    enter: root => {
      RECALC_SERVER.runs.hold()
      let cancelled = false
      return untilDone(
        root => cancelled && selectionIdle(root) && !openMenu(),
        root => {
          if (cancelled) {
            if (openMenu()) closeMenu()
          } else if (
            allBusy(root) &&
            recalcItem()?.hasAttribute('data-pending')
          ) {
            recalcItem()!.click()
            cancelled = true
          } else cancelItemShown(root)
        },
      )(root, undefined)
    },
  },
]

/** ADR 0153, S2: действие над выделением ждёт — человек отменяет его из контекстного меню. */
export const ContextMenuCancelFromMenu: StoryObj<StoryProps> = {
  name: 'Cancel from the menu',
  parameters: { scenario: '0153/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отмена действия из меню',
        en: 'Canceling an action from the menu',
      }}
      steps={CANCEL_FROM_MENU}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          actionsDemo: 'none',
          extraPlugins: [recalcDemo],
          columnCount: 8,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(CANCEL_FROM_MENU[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(CANCEL_FROM_MENU[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(selectedCells(canvas)).toBe(SELECTION_CELLS))
      expect(openMenu()).toBeNull()
    })
    await step(CANCEL_FROM_MENU[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(allBusy(canvas)).toBe(true))
      await until(() => expect(openMenu()).toBeNull())
    })
    await step(CANCEL_FROM_MENU[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(recalcItem()?.hasAttribute('data-pending')).toBe(true),
      )
      const item = recalcItem()!
      expect(item).not.toHaveAttribute('data-disabled')
      expect(item.textContent).toContain(labels.cancelAction('Recalculate'))
      await settle()
      expectPopupInCanvas(canvas, openMenu()!)
    })
    await step(CANCEL_FROM_MENU[4]!.title.ru, async () => {
      const flash = watchFlash(canvas, '.data-grid__body-cell', 'reverted')
      await guideNext(canvas)
      await until(() => expect(selectionIdle(canvas)).toBe(true))
      await until(() => expect(openMenu()).toBeNull())
      await settle()
      expect(flash.most()).toBe(0)
      flash.stop()
      expect(
        canvas.querySelector(
          '[data-flash], [data-error-indicator][data-shown="true"]',
        ),
      ).toBeNull()
    })
  },
}

// --- ADR 0155 S1 ---------------------------------------------------------------------

const TABLE_ITEM = '[data-action-id$="tableRecalculate"]'
const TABLE_CELL = { row: 'item-id-2', column: 'firstName' }
const TABLE_REFUSAL = 'The server is busy, try again later'

/** «Сервер» гайда: придерживает ответ, пока шаг ожидания на виду; отказывает по режиму. */
const TABLE_SERVER = createDemoServer()
const tableRun = {
  refuse: true,
  inFlight: false,
  succeeded: false,
  table: undefined as unknown,
}

const tableAction: ContextMenuAction = {
  id: 'tableRecalculate',
  icon: () => <Calculator width={16} height={16} />,
  label: () => 'Recalculate table',
  target: () => 'table',
  onSelect: async (_ctx, _event, context) => {
    tableRun.inFlight = true
    try {
      await TABLE_SERVER.runs.answer(context?.signal)
      if (tableRun.refuse) throw new Error(TABLE_REFUSAL)
      tableRun.succeeded = true
    } finally {
      tableRun.inFlight = false
    }
  },
}

/** Новая таблица гайда — новый «сервер»: шаг открывает таблицу заново. */
const tableDemo: TesseraFeatureEntry = {
  id: 'tableRecalculateGuide',
  contextMenuActions: [tableAction],
  setup: table => {
    const store = (table as { store: unknown }).store
    if (tableRun.table === store) return
    TABLE_SERVER.runs.release()
    Object.assign(tableRun, {
      refuse: true,
      inFlight: false,
      succeeded: false,
      table: store,
    })
  },
}

const tableItem = () =>
  openMenu()?.querySelector<HTMLElement>(TABLE_ITEM) ?? null
const refreshing = (root: ParentNode) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')
const banner = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const retryButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-retry"]')

/** Запустить пересчёт из меню на ячейке — по одному жесту за попытку. */
const startTableRun = (root: HTMLElement, refuse: boolean) => {
  const item = tableItem()
  if (item) {
    tableRun.refuse = refuse
    item.click()
  } else openAt(at(root, TABLE_CELL))
}

/** Пересчёт ждёт ответа: запускается, если ещё не идёт. */
const tableWaits = (root: HTMLElement) => {
  if (tableRun.inFlight) {
    if (openMenu()) closeMenu()
  } else startTableRun(root, true)
}

/** Сервер отказал: ждущий пересчёт отпускается, иначе запускается заново. */
const tableRefused = (root: HTMLElement) => {
  if (banner(root)) return
  if (tableRun.inFlight) TABLE_SERVER.runs.release()
  else {
    TABLE_SERVER.runs.hold()
    startTableRun(root, true)
  }
}

const WHOLE_TABLE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Меню ещё не открыто', en: 'The menu is not open yet' },
    hint: {
      ru: 'В контекстном меню есть действие, которое пересчитывает всю таблицу на сервере. Пользователь ещё не открывал меню.',
      en: 'The context menu has an action that recalculates the whole table on the server. The user has not opened the menu yet.',
    },
  },
  {
    title: {
      ru: 'Действие над всей таблицей',
      en: 'An action on the whole table',
    },
    hint: {
      ru: 'В контекстном меню есть действие, которое пересчитывает всю таблицу на сервере.',
      en: 'The context menu has an action that recalculates the whole table on the server.',
    },
    states: ['overlay.contextMenu'],
    enter: root => {
      const still = steady()
      return untilDone(
        root =>
          still(at(root, TABLE_CELL)) &&
          menuAt(at(root, TABLE_CELL)) &&
          !!tableItem(),
        root => openAt(at(root, TABLE_CELL)),
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Таблица ждёт', en: 'The table is waiting' },
    hint: {
      ru: 'Пользователь выбрал пересчёт. Под шапкой светится полоса обновления, строки приглушены — меняется вся таблица.',
      en: 'The user chose to recalculate. A refresh bar glows under the header and the rows are dimmed: the whole table is changing.',
    },
    states: ['body.refreshing'],
    enter: root => {
      TABLE_SERVER.runs.hold()
      return untilDone(
        root => tableRun.inFlight && refreshing(root) && !openMenu(),
        tableWaits,
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не пересчитал таблицу. Под шапкой — сообщение с причиной и повтором.',
      en: 'The server did not recalculate the table. Under the header, a message shows the reason and offers a retry.',
    },
    states: ['body.loadError'],
    enter: untilDone(
      root => !!banner(root) && !refreshing(root) && !openMenu(),
      tableRefused,
    ),
  },
  {
    title: { ru: 'Повтор удался', en: 'The retry succeeded' },
    hint: {
      ru: 'Пользователь повторил действие из сообщения, сервер ответил. Свечение и сообщение ушли.',
      en: 'The user retried the action from the message, and the server responded. The glow and the message are gone.',
    },
    enter: untilDone(
      root =>
        tableRun.succeeded && !banner(root) && !refreshing(root) && !openMenu(),
      root => {
        if (tableRun.succeeded || (tableRun.inFlight && !tableRun.refuse))
          return
        if (banner(root)) {
          TABLE_SERVER.runs.release()
          tableRun.refuse = false
          retryButton(root)?.click()
        } else tableRefused(root)
      },
    ),
  },
]

/** ADR 0155, S1: действие меню над всей таблицей — свечение под шапкой, отказ — плашка. */
export const ContextMenuWholeTable: StoryObj<StoryProps> = {
  name: 'Whole table',
  parameters: { scenario: '0155/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Действие над всей таблицей',
        en: 'An action on the whole table',
      }}
      steps={WHOLE_TABLE}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          actionsDemo: 'none',
          extraPlugins: [tableDemo],
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
    await step(WHOLE_TABLE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(WHOLE_TABLE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(tableItem()).not.toBeNull())
      await settle()
      expectPopupInCanvas(canvas, openMenu()!)
    })
    await step(WHOLE_TABLE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(true))
      expect(openMenu()).toBeNull()
      expect(banner(canvas)).toBeNull()
      expect(canvas.querySelector('[data-pending-wave]')).toBeNull()
    })
    await step(WHOLE_TABLE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(banner(canvas)).not.toBeNull())
      await until(() => expect(refreshing(canvas)).toBe(false))
      expect(banner(canvas)!.textContent).toContain(TABLE_REFUSAL)
      expect(retryButton(canvas)).not.toBeNull()
    })
    await step(WHOLE_TABLE[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(tableRun.succeeded).toBe(true))
      await until(() => expect(banner(canvas)).toBeNull())
      await until(() => expect(refreshing(canvas)).toBe(false))
    })
  },
}

// --- ADR 0153 S11 --------------------------------------------------------------------

const pendingBanner = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')
const pendingCancel = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-cancel"]')

const WHOLE_TABLE_CANCEL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Таблица в покое', en: 'The table at rest' },
    hint: {
      ru: 'В контекстном меню есть пересчёт всей таблицы на сервере. Пользователь ещё не открывал меню.',
      en: 'The context menu has an action that recalculates the whole table on the server. The user has not opened the menu yet.',
    },
  },
  {
    title: { ru: 'Таблица ждёт', en: 'The table is waiting' },
    hint: {
      ru: 'Пользователь выбрал пересчёт всей таблицы. Под шапкой светится полоса обновления, строки приглушены.',
      en: 'The user chose to recalculate the whole table. A refresh bar glows under the header, and the rows are dimmed.',
    },
    states: ['body.refreshing'],
    enter: root => {
      TABLE_SERVER.runs.hold()
      return untilDone(
        root =>
          tableRun.inFlight &&
          refreshing(root) &&
          !pendingBanner(root) &&
          !openMenu(),
        tableWaits,
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Ожидание затянулось', en: 'The wait dragged on' },
    hint: {
      ru: 'Ответа нет дольше секунды. Под шапкой появилось сообщение с именем действия и кнопкой отмены.',
      en: "There has been no response for more than a second. A message with the action's name and a cancel button appeared under the header.",
    },
    enter: root => {
      TABLE_SERVER.runs.hold()
      return untilDone(
        root => tableRun.inFlight && !!pendingBanner(root) && !openMenu(),
        tableWaits,
      )(root, undefined)
    },
  },
  {
    title: { ru: 'Действие отменено', en: 'The action was canceled' },
    hint: {
      ru: 'Пользователь отменил пересчёт. Свечение и сообщение ушли, таблица осталась прежней, ошибки нет.',
      en: 'The user canceled the recalculation. The glow and the message are gone, the table stayed as it was, and there is no error.',
    },
    enter: root => {
      TABLE_SERVER.runs.hold()
      let cancelled = false
      return untilDone(
        root =>
          cancelled &&
          !tableRun.inFlight &&
          !pendingBanner(root) &&
          !refreshing(root),
        root => {
          if (cancelled) return
          const cancel = pendingCancel(root)
          if (cancel) {
            cancel.click()
            cancelled = true
          } else tableWaits(root)
        },
      )(root, undefined)
    },
  },
]

/** ADR 0153, S11: действие над всей таблицей затянулось — человек отменяет его в плашке. */
export const ContextMenuWholeTableCancel: StoryObj<StoryProps> = {
  name: 'Whole table — Cancel',
  parameters: { scenario: '0153/S11', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отмена действия над всей таблицей',
        en: 'Canceling an action on the whole table',
      }}
      steps={WHOLE_TABLE_CANCEL}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellSelection: true,
          actionsDemo: 'none',
          extraPlugins: [tableDemo],
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
    await step(WHOLE_TABLE_CANCEL[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(WHOLE_TABLE_CANCEL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(refreshing(canvas)).toBe(true))
      expect(openMenu()).toBeNull()
    })
    await step(WHOLE_TABLE_CANCEL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pendingBanner(canvas)).not.toBeNull())
      expect(pendingCancel(canvas)).not.toBeNull()
      expect(banner(canvas)).toBeNull()
    })
    await step(WHOLE_TABLE_CANCEL[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pendingBanner(canvas)).toBeNull())
      await until(() => expect(refreshing(canvas)).toBe(false))
      await settle()
      expect(banner(canvas)).toBeNull()
    })
  },
}

// --- ADR 0206 S2 ---------------------------------------------------------------------

const DOOMED = { row: 'item-id-2', column: 'lastName' }
const DELETE_ITEM = '[data-action-id="deleteRowFromMenu"]'

/** Действие приложения: удалить строку до сохранения — с тоном опасного действия. */
const deleteRowAction: ContextMenuAction = {
  id: 'deleteRowFromMenu',
  icon: () => <Trash2 width={16} height={16} />,
  label: () => 'Delete row',
  tone: 'danger',
  visible: ctx =>
    !(ctx.table as unknown as { getDrafts: () => { target: object }[] })
      .getDrafts()
      .some(draft => 'row' in draft.target),
  onSelect: ctx =>
    (ctx.table as unknown as { removeRow: (id: string) => void }).removeRow(
      ctx.row.id,
    ),
}

const deleteRowDemo: TesseraFeatureEntry = {
  id: 'deleteRowGuide',
  contextMenuActions: [deleteRowAction],
}

const deleteItem = () =>
  openMenu()?.querySelector<HTMLElement>(DELETE_ITEM) ?? null
const doomedRow = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${DOOMED.row}"]`,
  )
const rowDeleted = (root: ParentNode) =>
  doomedRow(root)?.getAttribute('data-row-draft') === 'deleted'

const DANGER_ITEM: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Меню ещё не открыто', en: 'The menu is not open yet' },
    hint: {
      ru: 'Приложение добавило в меню ячейки своё действие удаления строки и пометило его как опасное. Пользователь ещё не открывал меню.',
      en: 'The app added its own row delete action to the cell menu and marked it as dangerous. The user has not opened the menu yet.',
    },
  },
  {
    title: { ru: 'Опасный пункт в меню', en: 'A dangerous item in the menu' },
    hint: {
      ru: 'Приложение добавило в меню ячейки своё действие удаления строки и пометило его как опасное. Пользователь открыл меню: этот пункт выделен тоном опасного действия сразу, без наведения, остальные — обычные.',
      en: 'The app added its own row delete action to the cell menu and marked it as dangerous. The user opened the menu: this item is highlighted in the danger tone right away, without hovering, and the rest are ordinary.',
    },
    states: ['overlay.contextMenu'],
    enter: root => {
      const still = steady()
      return untilDone(
        root =>
          still(at(root, DOOMED)) && menuAt(at(root, DOOMED)) && !!deleteItem(),
        root => openAt(at(root, DOOMED)),
      )(root, undefined)
    },
  },
  {
    title: {
      ru: 'Строка помечена удалённой',
      en: 'The row is marked as deleted',
    },
    hint: {
      ru: 'Пользователь выбрал удаление. Меню закрылось, строка осталась на месте до сохранения: текст приглушён, на кнопке пульта — одно несохранённое изменение.',
      en: 'The user chose to delete it. The menu closed, and the row stayed in place until saved: its text is dimmed, and the unsaved changes panel button shows one unsaved change.',
    },
    states: ['body.rowDraft'],
    enter: untilDone(
      root => rowDeleted(root) && !openMenu(),
      root => {
        if (rowDeleted(root)) closeMenu()
        else if (deleteItem()) deleteItem()!.click()
        else openAt(at(root, DOOMED))
      },
    ),
  },
]

/** ADR 0206, S2: своё опасное действие приложения в контекстном меню — тоном `danger`. */
export const ContextMenuDangerAction: StoryObj<StoryProps> = {
  name: 'Own dangerous action',
  parameters: { scenario: '0206/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Опасное действие в меню',
        en: 'A dangerous action in the menu',
      }}
      steps={DANGER_ITEM}
      args={guideArgs(
        {
          enableContextMenu: true,
          enableCellEditing: true,
          cellEditingSaveMode: 'manual',
          enableUnsavedChanges: true,
          enableToolbar: true,
          onCommitEdits: () => Promise.resolve(),
          actionsDemo: 'none',
          extraPlugins: [deleteRowDemo],
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
    await step(DANGER_ITEM[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(DANGER_ITEM[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(deleteItem()).not.toBeNull())
      await settle()
      expectPopupInCanvas(canvas, openMenu()!)
    })
    await step(DANGER_ITEM[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowDeleted(canvas)).toBe(true))
      expect(openMenu()).toBeNull()
      await settle()
    })
  },
}

// --- Долгое нажатие пальцем (ADR 0231, S7) --------------------------------------------

const touchCellOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    '.data-grid__body-row[data-index="2"] .data-grid__body-cell[data-column-id="firstName"]',
  )

const holdTouchCell = async (
  root: HTMLElement,
  signal: AbortSignal,
  move = 0,
) => {
  touchPlay.pressEscape()
  await touchPlay.pollUntil(
    () => !touch.openMenu() && !!touchCellOf(root),
    signal,
  )
  await touch.holdTarget(touchCellOf(root)!, signal, move)
}

const LONG_PRESS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Меню закрыто', en: 'The menu is closed' },
    hint: {
      ru: 'Контекстное меню ячейки открывается долгим нажатием.',
      en: 'The cell context menu opens with a long press.',
    },
  },
  {
    title: { ru: 'Долгое нажатие', en: 'A long press' },
    hint: {
      ru: 'Пользователь задержал палец на ячейке — в точке касания открылось меню.',
      en: 'The user held a finger on a cell; the menu opened at the touch point.',
    },
    states: ['overlay.contextMenu'],
    enter: stepAction(async (root, { signal }) => holdTouchCell(root, signal)),
  },
  {
    title: { ru: 'Палец сдвинулся', en: 'The finger moved' },
    hint: {
      ru: 'Пользователь сдвинул палец раньше срока — меню не открылось.',
      en: 'The user moved the finger before the time was up; the menu did not open.',
    },
    enter: stepAction(async (root, { signal }) =>
      holdTouchCell(root, signal, 30),
    ),
  },
]

/** ADR 0231, S7: долгое нажатие открывает контекстное меню, сдвиг пальца его отменяет. */
export const ContextMenuLongPress: StoryObj<StoryProps> = {
  name: 'Long press',
  globals: touch.PHONE,
  parameters: { scenario: '0231/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Меню долгим нажатием', en: 'A menu on a long press' }}
      steps={LONG_PRESS}
      args={guideArgs(touch.TOUCH_ARGS, args)}
      atomicSteps
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LONG_PRESS[0]!.title.ru, async () => {
      await touchPlay.waitForRows(canvas)
      await expect(touch.openMenu()).toBeNull()
    })
    await step(LONG_PRESS[1]!.title.ru, async () => {
      await touchPlay.guideNext(canvas)
      await touchPlay.stepDone(canvas)
      await touchPlay.until(() => expect(touch.openMenu()).not.toBeNull())
      await touchPlay.settle()
    })
    await step(LONG_PRESS[2]!.title.ru, async () => {
      await touchPlay.guideNext(canvas)
      await touchPlay.stepDone(canvas)
      await expect(touch.openMenu()).toBeNull()
      await touchPlay.settle()
    })
  },
}
