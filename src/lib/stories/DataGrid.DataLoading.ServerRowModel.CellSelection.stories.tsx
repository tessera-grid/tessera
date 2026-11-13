import { Meta, StoryObj } from '@storybook/react'
import { expect, spyOn } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  waitForRows,
  consoleText,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  clickByMouse,
  copyFrom,
  dragCells,
  isSelected,
  pasteInto,
  pressCell,
} from './__mocks__/cellGestures'
import { storyLabels } from './__mocks__/storyLabels'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { SERVER_FAILURE } from './demos/serverRowModelDemos'
import { StoryComponent } from './DataGridStory'
import type { TesseraFeatureEntry } from '../core/features'
import type { CellSelectionRangeView } from '../plugins/cellSelectionModel/indexSelection'
import type { ConsoleLog } from './demos/consoleLog'
import type { CellEditBatch } from '../plugins/cellEditing/types'
import {
  layout,
  bodyRows,
  scroller,
  skeletonRows,
  hasRow,
  server,
  release,
  serverProps,
  scrollTo,
  layerOf,
  nextFrame,
  press,
} from './__mocks__/serverRowModelGuide'
import { cellSelectionLabels } from '../plugins/cellSelection/labels'

/**
 * Выделение и копирование в серверной модели (ADR 0146): `Playground` — строки с «сервера»
 * с выделением ячеек, объём и предел копирования — контролами; S1 — диапазон через
 * незагруженные строки, S2 — копирование с догрузкой, S3 — сверх предела, S4 — отказ сервера;
 * чтение выделения приложением одной формой — S1 ADR 0180; вставка с догрузкой — S13 ADR 0219.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Cell selection',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface CellSelectionPlaygroundArgs extends StoryProps {
  serverTotal: number
  maxCopyRows: number
}

export const ServerCellSelectionPlayground: StoryObj<CellSelectionPlaygroundArgs> =
  {
    name: 'Playground',
    parameters: showControls(['serverTotal', 'maxCopyRows'], {
      dataCount: 'строки подаёт «сервер» демо',
      columnCount: 'колонки задаёт демо',
    }),
    // Сто тысяч строк: копирование большого диапазона догружает строки с сервера.
    args: { ...layout, serverTotal: 100_000, maxCopyRows: 10_000 },
    argTypes: {
      serverTotal: {
        description: 'Строк на «сервере»',
        control: 'select',
        options: [2000, 100_000, 1_000_000],
      },
      maxCopyRows: {
        description:
          'Сколько строк можно скопировать; больше — таблица отказывает без запросов',
        control: 'select',
        options: [1000, 10_000, 100_000],
      },
    },
    render: ({ serverTotal, maxCopyRows, ...args }) => (
      <StoryComponent
        key={serverTotal}
        {...normalizeArgs(args)}
        {...serverProps({
          total: serverTotal,
          knownTotal: true,
          blockSize: 100,
          selection: true,
        })!(AT_REST)}
        cellSelectionMaxCopyRows={maxCopyRows}
      />
    ),
    // Снимок — в покое: первое окно пришло.
    play: async ({ canvasElement: canvas, globals }) => {
      if (globals.catalog !== true) return
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await settle()
    },
  }

// --- ADR 0146: выделение и копирование ----------------------------------------------

const SELECTION_BLOCK = 100
const SMALL_TOTAL = 2000
const RANGE_TOTAL = 100_000
const LIMIT_TOTAL = 50_000
const RANGE_PAGES = 3
/** Мелкие блоки: три экрана вниз — уже за загруженными строками. */
const RANGE_BLOCK = 10
/** Блок середины списка: окно его не просит, первая попытка копирования падает. */
const REFUSED_BLOCK = 1000

/** Ячейка тела по месту строки в списке и колонке. */
const cellAt = (root: HTMLElement, index: number, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const selectedCellCount = (root: HTMLElement) =>
  root.querySelectorAll('[data-cell-selected="true"]').length
/** Выделенные ячейки незагруженных строк — скелеты внутри диапазона. */
const selectedPending = (root: HTMLElement) =>
  root.querySelectorAll('[data-pending-row] [data-cell-selected="true"]').length
const banner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

/** Пользователь щёлкнул ячейку первой строки. */
const pressFirstCell = async (root: HTMLElement, signal: AbortSignal) => {
  if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
  await pollUntil(() => !!cellAt(root, 0, 'name'), signal)
  await nextFrame()
  pressCell(cellAt(root, 0, 'name')!)
  await pollUntil(() => isSelected(cellAt(root, 0, 'name')), signal)
}

/**
 * Пользователь выделил всё: щёлкнул первую ячейку, прокрутил в конец и щёлкнул последнюю
 * с Shift. Мышью — шаг идёт и в окне без фокуса, где клавиши до таблицы не доходят.
 */
const selectToEnd = async (
  root: HTMLElement,
  signal: AbortSignal,
  total = SMALL_TOTAL,
) => {
  await pressFirstCell(root, signal)
  scrollTo(root, 1)
  await pollUntil(() => !!cellAt(root, total - 1, 'visits'), signal)
  await nextFrame()
  pressCell(cellAt(root, total - 1, 'visits')!, { shiftKey: true })
  await pollUntil(() => isSelected(cellAt(root, total - 1, 'visits')), signal)
}

/** Копирование с клавиатуры — событие `copy` от строки тела, как Ctrl+C. */
const copyNow = (root: HTMLElement) => copyFrom(bodyRows(root)[0]!)

/**
 * Записи в буфер обмена — в тестах каталога: окно тестов писать в буфер не вправе, запись
 * подменяется, текст и таблица сохраняются для проверки.
 */
const clipboardWrites = () => {
  const written: { text: string; html?: string }[] = []
  spyOn(navigator.clipboard, 'write').mockImplementation(async items => {
    for (const item of items) {
      const text = await (await item.getType('text/plain')).text()
      const html = item.types.includes('text/html')
        ? await (await item.getType('text/html')).text()
        : undefined
      written.push({ text, html })
    }
  })
  spyOn(navigator.clipboard, 'writeText').mockImplementation(async text => {
    written.push({ text })
  })
  return written
}

/** Диапазон 3×3 растёт на три экрана вниз через строки, которые ещё в пути. */
const growRange = async (root: HTMLElement, signal: AbortSignal) => {
  if (selectedPending(root) > 0) return
  if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
  await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
  await nextFrame()
  if (selectedCellCount(root) !== 9) {
    dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
  }
  server.hold = true
  cellAt(root, 0, 'name')!.focus({ preventScroll: true })
  for (let page = 0; page < RANGE_PAGES; page++) {
    press(document.activeElement as HTMLElement, 'PageDown', {
      shiftKey: true,
    })
  }
  await pollUntil(() => selectedPending(root) > 0, signal)
}

const RANGE_SELECTION: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Строки приходят с сервера блоками. Пользователь ещё ничего не выделял.',
    props: serverProps({
      total: RANGE_TOTAL,
      knownTotal: true,
      blockSize: RANGE_BLOCK,
      selection: true,
    }),
  },
  {
    title: 'Ячейка выделена',
    hint: 'Пользователь щёлкнул ячейку в начале списка. Она выделена и стала активной.',
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await pressFirstCell(root, signal)
    }),
  },
  {
    title: 'Диапазон протяжкой',
    hint: 'Пользователь протянул выделение мышью на три строки и три колонки. Диапазон залит, у него общий контур, начальная ячейка не залита.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
      await nextFrame()
      dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
      await pollUntil(() => selectedCellCount(root) === 9, signal)
    }),
  },
  {
    title: 'Диапазон на экраны вниз',
    keyboard: true,
    hint: 'Пользователь трижды нажал Shift+PageDown. Диапазон вырос на три экрана, и таблица прокрутилась к его краю. Строки, которые теперь на экране, ещё в пути с сервера: их скелеты внутри диапазона залиты так же.',
    states: ['body.skeleton', 'body.cellRange'],
    enter: stepAction((root, { signal }) => growRange(root, signal)),
  },
  {
    title: 'Строки пришли',
    hint: 'Сервер ответил: строки встали на место скелетов, диапазон остался прежним.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      // Со свежей таблицы диапазона ещё нет: сперва он, как на прошлом шаге.
      if (selectedCellCount(root) <= 9) await growRange(root, signal)
      server.hold = false
      release()
      await pollUntil(
        () => skeletonRows(root) === 0 && selectedCellCount(root) > 9,
        signal,
      )
    }),
  },
]

/** ADR 0146, S1: диапазон мышью и клавишами через незагруженные строки. */
export const ServerRangeSelection: StoryObj<StoryProps> = {
  name: 'Select a range',
  parameters: { scenario: '0146/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Диапазон через незагруженные строки"
      steps={RANGE_SELECTION}
      reset={() => {
        server.hold = false
        release()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(RANGE_SELECTION[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(RANGE_SELECTION[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(isSelected(cellAt(canvas, 0, 'name'))).toBe(true),
      )
    })
    await step(RANGE_SELECTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(selectedCellCount(canvas)).toBe(9))
      // Начальная ячейка — активная, без заливки.
      await until(() =>
        expect(
          cellAt(canvas, 0, 'name')!.getAttribute('data-cell-focused'),
        ).toBe('true'),
      )
    })
    await step(RANGE_SELECTION[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(skeletonRows(canvas)).toBeGreaterThan(0))
      await until(() => expect(selectedPending(canvas)).toBeGreaterThan(0))
    })
    await step(RANGE_SELECTION[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(skeletonRows(canvas)).toBe(0))
      await until(() => expect(selectedCellCount(canvas)).toBeGreaterThan(9))
      await settle()
    })
  },
}

/** Выделена вся таблица; копирование ещё не начато — догрузка ждёт ответа. */
const copyHeld = async (root: HTMLElement, signal: AbortSignal) => {
  if (!hasRow(root, SMALL_TOTAL - 1)) await selectToEnd(root, signal)
  server.hold = true
  copyNow(root)
  await pollUntil(() => server.held.length > 0, signal)
}

const COPY_LOADS: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Строки приходят с сервера блоками, загружены только строки у начала. Пользователь ещё ничего не выделял.',
    props: serverProps({
      total: SMALL_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      selection: true,
    }),
  },
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделено всё, а загружены только строки начала и конца списка.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await selectToEnd(root, signal)
    }),
  },
  {
    title: 'Копирование ждёт строк',
    hint: 'Пользователь нажал Ctrl+C. Таблица запросила у сервера строки выделения, которых у неё нет, и ждёт ответа. В консоли — запись о начале копирования.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await copyHeld(root, signal)
    }),
  },
  {
    title: 'Выделение скопировано',
    hint: 'Сервер ответил. В буфер попали все две тысячи строк — таблицей и текстом через табуляцию, а в консоли появилась запись об успешном копировании.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0) await copyHeld(root, signal)
      server.hold = false
      release()
      await pollUntil(() => consoleText().includes('copyResolved'), signal)
    }),
  },
]

/** ADR 0146, S2: копирование диапазона с незагруженными строками — догрузка и буфер. */
export const ServerCopyLoadsRows: StoryObj<StoryProps> = {
  name: 'Copy loads the rows',
  parameters: { scenario: '0146/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Копирование с догрузкой"
      steps={COPY_LOADS}
      reset={() => {
        server.hold = false
        release()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const written = clipboardWrites()
    await step(COPY_LOADS[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(COPY_LOADS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
      // Загружены только начало и конец списка.
      await expect(
        server.starts.filter(start => start > 0 && start < SMALL_TOTAL - 100),
      ).toEqual([])
    })
    await step(COPY_LOADS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(server.held.length).toBeGreaterThan(0)
      await expect(consoleText()).toContain('copy')
      await expect(written).toEqual([])
    })
    await step(COPY_LOADS[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(written).toHaveLength(1))
      await expect(written[0]!.text.split('\n')).toHaveLength(SMALL_TOTAL)
      await expect(written[0]!.text).toContain('\t')
      await expect(written[0]!.html).toContain('<table')
      await expect(consoleText()).toContain('copyResolved')
      await settle()
    })
  },
}

/** Пользователь выделил всю таблицу мышью. */
const selectAllCells = (root: HTMLElement, signal: AbortSignal) =>
  selectToEnd(root, signal, LIMIT_TOTAL)

const COPY_OVER_LIMIT: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'В выборке пятьдесят тысяч строк, они приходят с сервера блоками. Пользователь ещё ничего не выделял.',
    props: serverProps({
      total: LIMIT_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      selection: true,
    }),
  },
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделены все пятьдесят тысяч строк.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      await selectAllCells(root, signal)
    }),
  },
  {
    title: 'Строк слишком много',
    hint: 'Пользователь нажал Ctrl+C. Строк больше, чем таблица кладёт в буфер, поэтому копирование не выполнено, а сервер запросов не получил. Плашка над таблицей называет предел и советует выгрузку.',
    states: ['body.cellRange', 'body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (banner(root)) return
      if (selectedCellCount(root) <= 1) await selectAllCells(root, signal)
      copyNow(root)
      await pollUntil(() => !!banner(root), signal)
    }),
  },
]

/** ADR 0146, S3: копирование больше предела строк — отказ с подсказкой о выгрузке. */
export const ServerCopyOverLimit: StoryObj<StoryProps> = {
  name: 'Copy over the limit',
  parameters: { scenario: '0146/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Копирование больше предела"
      steps={COPY_OVER_LIMIT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(COPY_OVER_LIMIT[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(COPY_OVER_LIMIT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, LIMIT_TOTAL - 1, 'visits'))).toBe(
        true,
      )
    })
    await step(COPY_OVER_LIMIT[2]!.title, async () => {
      const asked = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      const text = banner(canvas)!.textContent
      await expect(text).toContain(labels.serverActionFailedCopy)
      await expect(text).toContain(
        cellSelectionLabels(labels).copyTooManyRows(LIMIT_TOTAL, 10_000),
      )
      await expect(server.starts.length).toBe(asked)
      await settle()
    })
  },
}

/** Копирование отказало: блок середины не пришёл. */
const copyRefused = async (root: HTMLElement, signal: AbortSignal) => {
  server.failed.clear()
  if (!hasRow(root, SMALL_TOTAL - 1)) await selectToEnd(root, signal)
  copyNow(root)
  await pollUntil(() => !!banner(root), signal)
}

const COPY_REFUSED: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Строки приходят с сервера блоками, загружены только строки у начала. Пользователь ещё ничего не выделял.',
    props: serverProps({
      total: SMALL_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      failBlock: REFUSED_BLOCK,
      selection: true,
    }),
  },
  {
    title: 'Выделена вся таблица',
    hint: 'Пользователь щёлкнул первую ячейку, прокрутил таблицу в конец и щёлкнул последнюю ячейку с зажатым Shift. Выделено всё, а загружены только строки начала и конца списка.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.failed.clear()
      await selectToEnd(root, signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь нажал Ctrl+C, а сервер не отдал часть недостающих строк. Буфер не изменился, плашка над таблицей называет причину и предлагает повторить.',
    states: ['body.cellRange', 'body.loadError'],
    enter: stepAction(async (root, { signal }) => {
      if (banner(root)) return
      await copyRefused(root, signal)
    }),
  },
  {
    title: 'Повтор удался',
    hint: 'Пользователь нажал кнопку повтора на плашке. Сервер ответил, выделение скопировано, плашка закрылась, а в консоли появилась запись об успешном копировании.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (!banner(root)) {
        if (consoleText().includes('copyResolved')) return
        await copyRefused(root, signal)
      }
      clickByMouse(
        root.querySelector<HTMLElement>('[data-testid="load-error-retry"]')!,
      )
      await pollUntil(
        () => !banner(root) && consoleText().includes('copyResolved'),
        signal,
      )
    }),
  },
]

/** ADR 0146, S4: сервер отказал при догрузке строк для копирования — плашка и повтор. */
export const ServerCopyRefused: StoryObj<StoryProps> = {
  name: 'Copy refused by the server',
  parameters: { scenario: '0146/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ сервера при копировании"
      steps={COPY_REFUSED}
      reset={() => server.failed.clear()}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const written = clipboardWrites()
    await step(COPY_REFUSED[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(COPY_REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
    })
    await step(COPY_REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const text = banner(canvas)!.textContent
      await expect(text).toContain(labels.serverActionFailedCopy)
      await expect(text).toContain(SERVER_FAILURE)
      await expect(written).toEqual([])
    })
    await step(COPY_REFUSED[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(banner(canvas)).toBeNull()
      await until(() => expect(written).toHaveLength(1))
      await expect(written[0]!.text.split('\n')).toHaveLength(SMALL_TOTAL)
      await expect(consoleText()).toContain('copyResolved')
      await settle()
    })
  },
}

// --- ADR 0153 S10 --------------------------------------------------------------------

const pendingBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="pending-action-banner"]')

/** Копирование ждёт строк дольше секунды: под шапкой — плашка ожидания. */
const copyHinted = async (root: HTMLElement, signal: AbortSignal) => {
  if (server.held.length === 0) await copyHeld(root, signal)
  await pollUntil(() => !!pendingBanner(root), signal)
}

const CANCEL_COPY: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Строки приходят с сервера блоками, загружены только строки у начала. Пользователь ещё ничего не выделял.',
    props: serverProps({
      total: SMALL_TOTAL,
      knownTotal: true,
      blockSize: SELECTION_BLOCK,
      selection: true,
    }),
  },
  {
    title: 'Выделение шире загруженного',
    hint: 'Пользователь выделил строки, которых ещё нет в браузере.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      await selectToEnd(root, signal)
    }),
  },
  {
    title: 'Копирование ждёт строк',
    hint: 'Пользователь скопировал выделение, таблица догружает строки.',
    states: ['body.cellRange'],
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await copyHeld(root, signal)
    }),
  },
  {
    title: 'Копирование идёт долго',
    hint: 'Под шапкой появилась плашка о копировании с кнопкой отмены.',
    states: ['body.cellRange'],
    enter: stepAction((root, { signal }) => copyHinted(root, signal)),
  },
  {
    title: 'Копирование отменено',
    hint: 'Пользователь нажал Escape. Плашка ушла, буфер обмена не изменился, выделение на месте.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      await copyHinted(root, signal)
      press(bodyRows(root)[0]!, 'Escape')
      await pollUntil(() => !pendingBanner(root), signal)
      // Ответ, пришедший после отмены, в буфер не попадает.
      server.hold = false
      release()
    }),
  },
]

/** ADR 0153, S10: копирование ждёт строк — человек отменяет его Escape. */
export const ServerCopyCancel: StoryObj<StoryProps> = {
  name: 'Cancel copying',
  parameters: { scenario: '0153/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отмена копирования"
      steps={CANCEL_COPY}
      reset={() => {
        server.hold = false
        release()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const written = clipboardWrites()
    await step(CANCEL_COPY[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(CANCEL_COPY[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
    })
    await step(CANCEL_COPY[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(server.held.length).toBeGreaterThan(0)
      await expect(pendingBanner(canvas)).toBeNull()
    })
    await step(CANCEL_COPY[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBanner(canvas)).toHaveTextContent(labels.pendingCopy)
      await settle()
    })
    await step(CANCEL_COPY[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await settle()
      await expect(pendingBanner(canvas)).toBeNull()
      await expect(banner(canvas)).toBeNull()
      await expect(written).toEqual([])
      await expect(isSelected(cellAt(canvas, SMALL_TOTAL - 1, 'visits'))).toBe(
        true,
      )
      await expect(consoleText()).toContain('cancel')
    })
  },
}

// --- ADR 0180, S1 --------------------------------------------------------------------

/** Диапазон для консоли: места строк с единицы, колонки, строки-углы; неизвестный угол — «—». */
const describeRange = (range: CellSelectionRangeView) =>
  `rows ${range.minRowIndex + 1}–${range.maxRowIndex + 1} · ${range.columnIds[0]}…${range.columnIds.at(-1)} · corners ${range.anchorRowId ?? '—'} → ${range.focusRowId ?? '—'}`

/**
 * Приложение читает выделение одной функцией таблицы и пишет его в консоль — при смене
 * выделения и при приходе строк: строка угла, пришедшая с сервера, получает свой id.
 */
const rangeReader = (log: ConsoleLog): TesseraFeatureEntry => ({
  id: 'appRangeReader',
  setup: table => {
    const t = table as unknown as {
      store: {
        get: () => { cellSelection?: unknown }
        subscribe: (listener: () => void) => { unsubscribe: () => void }
      }
      getCellSelectionRanges: () => CellSelectionRangeView[]
    }
    let seen = ''
    const subscription = t.store.subscribe(() => {
      const ranges = t.getCellSelectionRanges()
      const text = ranges.map(describeRange).join('; ')
      if (!ranges.length || text === seen) return
      seen = text
      log.log('app', text)
    })
    return () => subscription.unsubscribe()
  },
})

const READ_BLOCK = 10

const READ_RANGES: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Таблица показывает строки с сервера. Приложение читает выделение одной функцией таблицы — той же, что в клиентском режиме, — и пишет его в консоль.',
    props: context => {
      const props = serverProps({
        total: RANGE_TOTAL,
        knownTotal: true,
        blockSize: READ_BLOCK,
        selection: true,
      })!(context)
      return {
        ...props,
        extraPlugins: [...(props.extraPlugins ?? []), rangeReader(context.log)],
      }
    },
  },
  {
    title: 'Пользователь выделил диапазон',
    hint: 'Пользователь протянул выделение на три строки и три колонки. Консоль показывает места строк, колонки и строки-углы.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      release()
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
      await nextFrame()
      dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
      await pollUntil(() => selectedCellCount(root) === 9, signal)
    }),
  },
  {
    title: 'Угол ушёл в незагруженные строки',
    keyboard: true,
    hint: 'Пользователь трижды нажал Shift+PageDown. Второй угол диапазона — на строке, которая ещё в пути с сервера: её место известно, а сама строка — ещё нет, и консоль второй угол не называет.',
    states: ['body.skeleton', 'body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (selectedPending(root) > 0) return
      await cornerPending(root, signal)
    }),
  },
  {
    title: 'Строки пришли',
    hint: 'Сервер прислал строки. Диапазон тот же, но теперь приложение знает и строку второго угла: тот же вызов вернул её id, и консоль называет оба угла.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (selectedPending(root) === 0 && !secondCornerKnown())
        await cornerPending(root, signal)
      server.hold = false
      release()
      await pollUntil(
        () => selectedPending(root) === 0 && secondCornerKnown(),
        signal,
      )
    }),
  },
]

/** Консоль после прочерка назвала второй угол строкой с id. */
const secondCornerKnown = () => {
  const text = consoleText()
  const unknown = text.lastIndexOf('→ —')
  return unknown >= 0 && /→ item-id-\d+/.test(text.slice(unknown))
}

/** Диапазон протяжкой и три экрана вниз: второй угол — на строке в пути с сервера. */
const cornerPending = async (root: HTMLElement, signal: AbortSignal) => {
  if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
  await pollUntil(() => !!cellAt(root, 2, 'age'), signal)
  await nextFrame()
  if (selectedCellCount(root) !== 9) {
    dragCells(cellAt(root, 0, 'name')!, cellAt(root, 2, 'age')!)
  }
  server.hold = true
  cellAt(root, 0, 'name')!.focus({ preventScroll: true })
  for (let page = 0; page < RANGE_PAGES; page++) {
    press(document.activeElement as HTMLElement, 'PageDown', {
      shiftKey: true,
    })
  }
  await pollUntil(() => selectedPending(root) > 0, signal)
}

/** ADR 0180, S1: приложение читает выделенный диапазон одной функцией в серверной модели. */
export const CellSelectionRangesAnyMode: StoryObj<StoryProps> = {
  name: 'Read the selection',
  parameters: { scenario: '0180/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Чтение выделения приложением"
      steps={READ_RANGES}
      reset={() => {
        server.hold = false
        release()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(READ_RANGES[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(READ_RANGES[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(consoleText()).toContain(
          'rows 1–3 · name…age · corners item-id-0 → item-id-2',
        ),
      )
    })
    await step(READ_RANGES[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(consoleText()).toMatch(/corners item-id-0 → —/))
    })
    await step(READ_RANGES[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectedPending(canvas)).toBe(0)
      await expect(secondCornerKnown()).toBe(true)
      await settle()
    })
  },
}

// --- ADR 0219: вставка через незагруженные строки -------------------------------------

/** Значения, которые «сервер» принял: `id строки:колонка` — значение. */
const savedCells = new Map<string, unknown>()
type SavedRow = { id: string } & Record<string, unknown>
const withSaved = (row: SavedRow) => {
  let next = row
  for (const [key, value] of savedCells) {
    const [rowId, columnId] = key.split(':') as [string, string]
    if (rowId === row.id) next = { ...next, [columnId]: value }
  }
  return next
}

/** Мелкие блоки: сорок строк вставки — за пределами загруженного окна. */
const PASTE_BLOCK = 10
const PASTE_TOTAL = 2000
const PASTE_ROWS = 40
const PASTED = Array.from({ length: PASTE_ROWS }, (_, i) => String(100 + i))
const ageText = (root: HTMLElement, index: number) =>
  cellAt(root, index, 'age')?.textContent?.trim()
const pasteWritten = (root: HTMLElement) =>
  !pendingBanner(root) &&
  ageText(root, 0) === PASTED[0] &&
  ageText(root, 1) === PASTED[1]

/** Ячейка возраста первой строки выбрана, вставка ждёт строк с сервера. */
const pasteHeld = async (root: HTMLElement, signal: AbortSignal) => {
  if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
  await pollUntil(() => !!cellAt(root, 0, 'age'), signal)
  if (!isSelected(cellAt(root, 0, 'age'))) pressCell(cellAt(root, 0, 'age')!)
  await pollUntil(() => isSelected(cellAt(root, 0, 'age')), signal)
  server.hold = true
  pasteInto(cellAt(root, 0, 'age')!, PASTED.join('\n'))
  await pollUntil(() => server.held.length > 0 && !!pendingBanner(root), signal)
}

const PASTE_LOADS: readonly GuideStoryStep[] = [
  {
    title: 'Строки с сервера',
    hint: 'Строки приходят с сервера блоками по десять. Приложение разрешило править возраст и число визитов.',
    props: context => {
      const props = serverProps({
        total: PASTE_TOTAL,
        knownTotal: true,
        blockSize: PASTE_BLOCK,
        selection: true,
      })!(context)
      const getRows = props.serverRowModelGetRows!
      return {
        ...props,
        enableCellEditing: true,
        // «Сервер» помнит принятое: строки, запрошенные после сохранения, приходят с ним.
        onCommitEdits: (batch: CellEditBatch) => {
          for (const cell of batch.cells)
            savedCells.set(`${cell.rowId}:${cell.columnId}`, cell.value)
          return Promise.resolve()
        },
        serverRowModelGetRows: request =>
          Promise.resolve(getRows(request)).then(response => ({
            ...response,
            rows: response.rows.map((row: SavedRow) => withSaved(row)),
          })),
      }
    },
  },
  {
    title: 'Ячейка выбрана',
    hint: 'Пользователь щёлкнул ячейку возраста в первой строке.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      savedCells.clear()
      server.hold = false
      release()
      if (layerOf(root).top() > 0) layerOf(root).scrollTo({ top: 0 })
      await pollUntil(() => !!cellAt(root, 0, 'age'), signal)
      await nextFrame()
      pressCell(cellAt(root, 0, 'age')!)
      await pollUntil(() => isSelected(cellAt(root, 0, 'age')), signal)
    }),
  },
  {
    title: 'Вставка ждёт строк',
    hint: 'Пользователь вставил из буфера столбец из сорока значений. Они лягут в возраст сорока строк подряд, начиная с выбранной ячейки, а строк дальше экрана у таблицы нет: она запросила их у сервера и ждёт. Над таблицей плашка ожидания вставки с кнопкой отмены; данные пока не изменились.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length > 0) return
      await pasteHeld(root, signal)
    }),
  },
  {
    title: 'Значения вставлены',
    hint: 'Сервер прислал строки. Значения легли в возраст сорока строк подряд от выбранной ячейки одним запросом сохранения, плашка ушла, вставленный блок выделен.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (pasteWritten(root)) return
      if (server.held.length === 0) await pasteHeld(root, signal)
      server.hold = false
      release()
      await pollUntil(() => pasteWritten(root), signal)
    }),
  },
  {
    title: 'Конец вставленного блока',
    hint: 'Пользователь прокрутил таблицу вниз. Выделенный блок кончается на сороковой строке: вставка заняла столько строк, сколько значений было в буфере, а возраст ниже остался прежним.',
    states: ['body.cellRange'],
    enter: stepAction(async (root, { signal }) => {
      if (!pasteWritten(root) && !blockEndShown(root)) {
        if (server.held.length === 0) await pasteHeld(root, signal)
        server.hold = false
        release()
        await pollUntil(() => pasteWritten(root), signal)
      }
      const height = Number.parseFloat(
        getComputedStyle(scroller(root)!).getPropertyValue(
          '--tsr-comp-row-height',
        ),
      )
      layerOf(root).scrollTo({ top: (PASTE_ROWS - 8) * height })
      await pollUntil(() => blockEndShown(root), signal)
    }),
  },
]

/** Последняя вставленная строка и следующая за ней — на экране. */
const blockEndShown = (root: HTMLElement) =>
  ageText(root, PASTE_ROWS - 1) === PASTED.at(-1) &&
  isSelected(cellAt(root, PASTE_ROWS - 1, 'age')) &&
  !!cellAt(root, PASTE_ROWS, 'age') &&
  !isSelected(cellAt(root, PASTE_ROWS, 'age')) &&
  ageText(root, PASTE_ROWS) !== String(100 + PASTE_ROWS)

/** ADR 0219, S13: вставка в SSRM через незагруженные строки — ожидание, догрузка, запись. */
export const ServerPasteLoadsRows: StoryObj<StoryProps> = {
  name: 'Paste loads the rows',
  parameters: { scenario: '0219/S13', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вставка с догрузкой"
      steps={PASTE_LOADS}
      reset={() => {
        savedCells.clear()
        server.hold = false
        release()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step, args }) => {
    if (globals.catalog !== true) return
    await step(PASTE_LOADS[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(PASTE_LOADS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isSelected(cellAt(canvas, 0, 'age'))).toBe(true)
    })
    await step(PASTE_LOADS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(pendingBanner(canvas)!.textContent).toContain(
        storyLabels(args.locale).pendingPaste,
      )
      await expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(PASTE_LOADS[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ageText(canvas, 0)).toBe(PASTED[0])
      await expect(consoleText()).toContain('onCommitEdits')
    })
    await step(PASTE_LOADS[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(blockEndShown(canvas)).toBe(true)
      await settle()
    })
  },
}
