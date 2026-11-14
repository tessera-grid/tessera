import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import { scrollLayer } from '../core/scrollStretch'
import type { ServerRowsRequest, ServerRowsResponse } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  afterRows,
  gridDrawn,
  guideNext,
  headCell,
  pointAt,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { dragGripTo, separatorOf } from './__mocks__/columnGrip'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Перенос текста и высота строк по содержимому (ADR 0218): `wrapText` переносит текст в
 * высоте строки, `autoHeight` растит строку по содержимому, `wrapHeaderText` и
 * `autoHeaderHeight` — то же для шапки. Включите плагин и смените колонки в контролах.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Text wrap',
} satisfies Meta<StoryProps>

export default meta

// --- Данные --------------------------------------------------------------------------

const NOTES = [
  'Call back on Monday.',
  'Asked for a discount on the annual plan and a demo for the new team.',
  'Renewal is due next month. The client wants the same price, more seats and a named contact for support questions.',
  'Sent the contract.',
  'Long thread about the integration: the client uses an old version of the API, needs help with the migration and asks whether we can keep the old endpoints for another quarter while their team rewrites the export jobs.',
  'No answer yet.',
]

interface NoteRow {
  id: string
  name: string
  note: string
  city: string
}

const CITIES = ['Berlin', 'Lisbon', 'Oslo', 'Prague', 'Vienna']

const noteAt = (index: number): NoteRow => ({
  id: String(index),
  name: `Client ${index + 1}`,
  note: NOTES[(index * 7) % NOTES.length]!,
  city: CITIES[index % CITIES.length]!,
})

const notes = (count: number) =>
  Array.from({ length: count }, (_, i) => noteAt(i))

type NoteFields = {
  wrapText?: boolean
  autoHeight?: boolean | { maxLines?: number }
  wrapHeaderText?: boolean
  autoHeaderHeight?: boolean
}

const noteColumns = (note: NoteFields = {}, header?: string) => [
  { id: 'name', accessorKey: 'name', header: 'Client', size: 140 },
  {
    id: 'note',
    accessorKey: 'note',
    header: header ?? 'Note',
    size: 280,
    ...note,
  },
  { id: 'city', accessorKey: 'city', header: 'City', size: 120 },
]

const PLAIN = noteColumns()
const CLAMP = noteColumns({ wrapText: true })
const AUTO_COLUMNS = noteColumns({ autoHeight: true })

const GRID: Partial<StoryProps> = {
  enableTextWrap: true,
  height: '420',
  containerHeight: '480',
}

export const TextWrapPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableTextWrap',
      'textWrapEstimatedRowHeight',
      'textWrapMaxLines',
      'textWrapHeaderMaxLines',
      'rowHeight',
      'headerHeight',
    ],
    {
      dataCount: 'the story provides rows with notes',
      columnCount: 'the story provides the columns',
    },
  ),
  args: {
    ...GRID,
    columnsOverride: noteColumns(
      { autoHeight: true, autoHeaderHeight: true },
      'Note about the last contact with the client',
    ) as never,
    dataOverride: notes(200),
  },
  render: args => <StoryComponent {...normalizeArgs(args)} />,
}

// --- Общее ---------------------------------------------------------------------------

type GuideTable = {
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  scrollToRow: (id: string, options?: object) => Promise<boolean>
}

let guideTable: GuideTable | null = null

/** Отдаёт таблицу шагам истории: сортировка и прокрутка к записи — как у приложения. */
const tableHost = definePlugin<{ enabled?: boolean }>()({
  id: 'textWrapGuideHost',
  setup: () => table => {
    guideTable = table as unknown as GuideTable
    return () => {
      guideTable = null
    }
  },
})

const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')!

const rowOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]:not([data-sticky-copy])`,
  )

const heightOf = (element: Element | null | undefined) =>
  element ? Math.round(element.getBoundingClientRect().height) : 0

/** Подпись заметки в строке. */
const noteTitle = (root: ParentNode, id: string) =>
  rowOf(root, id)?.querySelector<HTMLElement>(
    '[data-column-id="note"] .data-grid__cell-wrapper-title',
  ) ?? null

/** Строки тела разной высоты. */
const variedRows = (root: ParentNode) =>
  new Set(
    [...root.querySelectorAll('.data-grid__body-row[data-row-id]')].map(
      heightOf,
    ),
  ).size > 1

// --- S1: перенос в высоте строки --------------------------------------------------------

const CLAMPED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Длинный текст обрезан', en: 'Long text is truncated' },
    hint: {
      ru: 'Заметка не помещается в одну строку: видно начало, конец скрыт за многоточием.',
      en: 'The note does not fit on one line: the beginning is visible, and the end is hidden behind an ellipsis.',
    },
    props: () => ({ columnsOverride: PLAIN as never }),
  },
  {
    title: { ru: 'Текст переносится', en: 'Text wraps' },
    hint: {
      ru: 'Колонка заметок переносит текст: в строку помещается три строки текста, последняя кончается многоточием. Высота строк прежняя.',
      en: 'The notes column wraps text: a row fits three lines of text, and the last one ends with an ellipsis. The row height is unchanged.',
    },
    props: () => ({
      columnsOverride: CLAMP as never,
    }),
  },
  {
    title: {
      ru: 'Полный текст — в подсказке',
      en: 'The full text is in the tooltip',
    },
    hint: {
      ru: 'Пользователь навёл указатель на обрезанную заметку — подсказка показывает её целиком.',
      en: 'The user hovered over a truncated note, and the tooltip shows it in full.',
    },
    pseudo: {
      hover: '.data-grid__body-row[data-row-id="4"] [data-column-id="note"]',
    },
    props: () => ({
      columnsOverride: CLAMP as never,
    }),
    enter: stepAction(async (root, { signal, onLeave }) => {
      await pollUntil(() => !!noteTitle(root, '4'), signal)
      onLeave(pointAt(noteTitle(root, '4')!))
    }),
  },
]

/** ADR 0218, S1: длинный текст в фиксированной высоте — перенос, многоточие и подсказка. */
export const TextWrapClamped: StoryObj<StoryProps> = {
  name: 'Wrap within the row',
  parameters: { scenario: '0218/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Перенос в высоте строки',
        en: 'Wrapping within the row height',
      }}
      steps={CLAMPED}
      args={guideArgs(
        { ...GRID, rowHeight: 72, dataOverride: notes(40) },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CLAMPED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(getComputedStyle(noteTitle(canvas, '4')!).whiteSpace).toBe(
        'nowrap',
      )
    })
    await step(CLAMPED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(getComputedStyle(noteTitle(canvas, '4')!).whiteSpace).toBe(
          'normal',
        ),
      )
      await expect(heightOf(rowOf(canvas, '4'))).toBe(72)
      await settle()
    })
    await step(CLAMPED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await settle()
    })
  },
}

// --- S2: высота по содержимому -----------------------------------------------------------

const AUTO: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Строки растут по содержимому',
      en: 'Rows grow with their content',
    },
    hint: {
      ru: 'Колонка заметок задаёт высоту строки: короткая заметка — строка обычной высоты, длинная — строка выше, текст виден целиком.',
      en: 'The notes column sets the row height: a short note keeps the row at its usual height, a long one makes the row taller, and the text is visible in full.',
    },
    props: () => ({
      columnsOverride: AUTO_COLUMNS as never,
      textWrapMaxLines: 10,
    }),
  },
  {
    title: {
      ru: 'Длинная заметка упирается в предел',
      en: 'A long note hits the limit',
    },
    hint: {
      ru: 'Предел — четыре строки текста: самая длинная заметка обрезана многоточием, строка выше не становится. Полный текст — в подсказке.',
      en: 'The limit is four lines of text: the longest note is truncated with an ellipsis, and the row grows no taller. The full text is in the tooltip.',
    },
    props: () => ({
      columnsOverride: AUTO_COLUMNS as never,
      textWrapMaxLines: 4,
    }),
  },
]

/** ADR 0218, S2: строки растут по содержимому, длинная запись упирается в предел строк. */
export const TextWrapAutoHeight: StoryObj<StoryProps> = {
  name: 'Rows grow with content',
  parameters: { scenario: '0218/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Высота строк по содержимому', en: 'Row height by content' }}
      steps={AUTO}
      args={guideArgs({ ...GRID, dataOverride: notes(40) }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let tall = 0
    await step(AUTO[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(variedRows(canvas)).toBe(true))
      tall = heightOf(rowOf(canvas, '4'))
    })
    await step(AUTO[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(heightOf(rowOf(canvas, '4'))).toBeLessThan(tall))
      await settle()
    })
  },
}

// --- S3: сужение колонки ------------------------------------------------------------------

const NARROW = 160

const RESIZE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Колонка заметок широкая', en: 'The notes column is wide' },
    hint: {
      ru: 'Колонка заметок широкая: короткие заметки — в одну строку, длинные — в несколько, заголовок — в одну.',
      en: 'The notes column is wide: short notes take one line, long ones take several, and the header takes one.',
    },
  },
  {
    title: {
      ru: 'Пользователь сузил колонку',
      en: 'The user narrowed a column',
    },
    hint: {
      ru: 'Пользователь протянул край колонки влево. Текст переносится на больше строк: строки и шапка стали выше, пока край ещё ехал.',
      en: 'The user dragged the column edge to the left. The text wraps onto more lines: the rows and the header grew taller while the edge was still moving.',
    },
    enter: stepAction(async (root, step) => {
      await pollUntil(
        () => gridDrawn(root) && !!separatorOf(root, 'note'),
        step.signal,
      )
      if (
        heightOf(headCell(root, 'note')) &&
        headCell(root, 'note').getBoundingClientRect().width <= NARROW + 1
      )
        return
      const leave = pointAt(headCell(root, 'note'))
      try {
        await dragGripTo(root, step, 'note', NARROW)
      } finally {
        leave()
      }
    }),
  },
]

/** ADR 0218, S3: пользователь сужает колонку — строки и шапка растут по ходу протяжки. */
export const TextWrapResizeColumn: StoryObj<StoryProps> = {
  name: 'Narrow a column',
  parameters: { scenario: '0218/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сужение колонки', en: 'Narrowing a column' }}
      steps={RESIZE}
      args={guideArgs(
        {
          ...GRID,
          enableColumnSizing: true,
          containerWidth: 700,
          columnsOverride: noteColumns(
            { autoHeight: true, autoHeaderHeight: true },
            'Note about the last contact with the client and what was agreed',
          ) as never,
          dataOverride: notes(40),
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let head = 0
    let row = 0
    await step(RESIZE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await settle()
      head = heightOf(canvas.querySelector('.data-grid__head'))
      row = heightOf(rowOf(canvas, '4'))
    })
    await step(RESIZE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(
          heightOf(canvas.querySelector('.data-grid__head')),
        ).toBeGreaterThan(head),
      )
      await until(() =>
        expect(heightOf(rowOf(canvas, '4'))).toBeGreaterThan(row),
      )
      await settle()
    })
  },
}

// --- S4: длинные заголовки во вложенной шапке ---------------------------------------------

const nestedColumns = (fields: NoteFields) => [
  {
    id: 'contact',
    header:
      'Last contact with the client: the date, the channel, what was discussed and the outcome',
    ...fields,
    columns: [
      {
        id: 'note',
        accessorKey: 'note',
        header:
          'What the client asked for during the last call with the account manager',
        size: 160,
        ...fields,
      },
      {
        id: 'city',
        accessorKey: 'city',
        header: 'City',
        size: 110,
        ...fields,
      },
    ],
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Client who owns the account and pays the invoices',
    size: 120,
    ...fields,
  },
]

const NESTED_PLAIN = nestedColumns({})
const NESTED_AUTO = nestedColumns({ autoHeaderHeight: true })

const HEADER: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Заголовки обрезаны', en: 'Headers are truncated' },
    hint: {
      ru: 'Длинные заголовки не помещаются: видно начало, конец скрыт за многоточием.',
      en: 'Long headers do not fit: the beginning is visible, and the end is hidden behind an ellipsis.',
    },
    props: () => ({ columnsOverride: NESTED_PLAIN as never }),
  },
  {
    title: { ru: 'Заголовки переносятся', en: 'Headers wrap' },
    hint: {
      ru: 'Заголовки переносятся — не больше трёх строк, дальше многоточие и подсказка. Каждый уровень шапки вырос до своего самого высокого заголовка, колонка клиента занимает оба уровня.',
      en: 'Headers wrap onto at most three lines; beyond that come an ellipsis and a tooltip. Each header level grew to fit its tallest header, and the client column spans both levels.',
    },
    props: () => ({
      columnsOverride: NESTED_AUTO as never,
    }),
  },
]

/** ADR 0218, S4: длинные заголовки во вложенной шапке — у каждого уровня своя высота. */
export const TextWrapHeader: StoryObj<StoryProps> = {
  name: 'Long headers',
  parameters: { scenario: '0218/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Длинные заголовки', en: 'Long headers' }}
      steps={HEADER}
      args={guideArgs({ ...GRID, dataOverride: notes(20) }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let head = 0
    await step(HEADER[0]!.title.ru, async () => {
      await waitForRows(canvas)
      head = heightOf(canvas.querySelector('.data-grid__head'))
    })
    await step(HEADER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          heightOf(canvas.querySelector('.data-grid__head')),
        ).toBeGreaterThan(head),
      )
      await settle()
    })
  },
}

// --- S5: клавиатура и прокрутка к записи ---------------------------------------------------

const TARGET = '120'

const KEYBOARD: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки разной высоты', en: 'Rows of different heights' },
    hint: {
      ru: 'У строк своя высота по заметке. Таблица в начале.',
      en: 'Each row has its own height based on its note. The table is scrolled to the top.',
    },
  },
  {
    title: {
      ru: 'Пользователь нажал PageDown',
      en: 'The user pressed PageDown',
    },
    hint: {
      ru: 'Пользователь встал на первую ячейку и нажал PageDown. Активной стала строка на высоту экрана ниже: таблица отсчитала её по высотам строк, а не по их числу, и прокрутилась, чтобы её показать.',
      en: 'The user focused the first cell and pressed PageDown. The row one screen height below became active: the table measured the distance by row heights rather than by the number of rows, and scrolled to show that row.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => gridDrawn(root), signal)
      const active =
        root.querySelector<HTMLElement>('[data-kn-active="true"]') ??
        root.querySelector<HTMLElement>(
          '.data-grid__body-row[data-row-id="0"] [data-column-id="name"]',
        )
      active?.focus()
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }),
      )
      await pollUntil(() => scrollerOf(root).scrollTop > 0, signal)
    }),
  },
  {
    title: { ru: 'Приложение открыло запись', en: 'The app opened a record' },
    hint: {
      ru: 'Приложение прокрутило таблицу к записи далеко внизу: строка встала к верху таблицы, хотя высоты строк до неё таблица ещё не знала.',
      en: 'The app scrolled the table to a record far below: the row landed at the top of the table, even though the table did not yet know the heights of the rows before it.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => gridDrawn(root) && !!guideTable, signal)
      await guideTable!.scrollToRow(TARGET, { align: 'start' })
      await pollUntil(() => !!rowOf(root, TARGET), signal)
    }),
  },
]

/** ADR 0218, S5: клавиатура и прокрутка к записи по строкам разной высоты. */
export const TextWrapKeyboard: StoryObj<StoryProps> = {
  name: 'Keyboard and scroll to a record',
  parameters: { scenario: '0218/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Клавиатура и прокрутка к записи',
        en: 'Keyboard and scrolling to a record',
      }}
      steps={KEYBOARD}
      args={guideArgs(
        {
          ...GRID,
          enableKeyboardNavigation: true,
          extraPlugins: [tableHost()],
          columnsOverride: AUTO_COLUMNS as never,
          dataOverride: notes(300),
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(KEYBOARD[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(KEYBOARD[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(scrollerOf(canvas).scrollTop).toBeGreaterThan(0))
      await settle()
    })
    await step(KEYBOARD[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(rowOf(canvas, TARGET)).not.toBeNull())
      await settle()
    })
  },
}

// --- S6: серверная модель --------------------------------------------------------------

const MILLION = 1_000_000
const SERVER_DELAY_MS = 300

const serverRows = ({ start, end, signal }: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<NoteRow>>(resolve => {
    setTimeout(() => {
      if (signal.aborted) return
      resolve({
        rows: Array.from({ length: end - start }, (_, k) => noteAt(start + k)),
        rowCount: MILLION,
      })
    }, SERVER_DELAY_MS)
  })

const layerOf = (root: HTMLElement) => scrollLayer(scrollerOf(root))

const SERVER: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Миллион строк с заметками', en: 'A million rows with notes' },
    hint: {
      ru: 'Строки приходят с сервера блоками и растут по заметкам. Пока блок в пути, его строки — скелеты высотой оценки.',
      en: 'Rows come from the server in blocks and grow with their notes. While a block is on its way, its rows are skeletons of the estimated height.',
    },
  },
  {
    title: {
      ru: 'Пользователь перешёл в середину',
      en: 'The user went to the middle',
    },
    hint: {
      ru: 'Пользователь протянул ползунок к середине списка. Сервер прислал строки, они выросли по заметкам — видимые строки при этом не сдвинулись.',
      en: 'The user dragged the scrollbar thumb to the middle of the list. The server sent the rows, and they grew with their notes; the visible rows did not shift.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => gridDrawn(root), signal)
      const layer = layerOf(root)
      layer.scrollTo({ top: layer.maxTop() / 2 })
      await pollUntil(
        () =>
          !root.querySelector('[data-pending-row]') &&
          !!root.querySelector('.data-grid__body-row[data-row-id]'),
        signal,
      )
    }),
  },
]

/** ADR 0218, S6: серверная модель — миллион строк с переносом. */
export const TextWrapServer: StoryObj<StoryProps> = {
  name: 'Server rows',
  parameters: { scenario: '0218/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Серверные строки', en: 'Server rows' }}
      steps={SERVER}
      args={guideArgs(
        {
          ...GRID,
          textWrapEstimatedRowHeight: 64,
          columnsOverride: AUTO_COLUMNS as never,
          dataOverride: [],
          enableServerRowModel: true,
          serverRowModelBlockSize: 100,
          rowCount: MILLION,
          serverRowModelGetRows: serverRows,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(SERVER[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(SERVER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(variedRows(canvas)).toBe(true))
      await settle()
    })
  },
}

// --- S7: сортировка строк разной высоты ------------------------------------------------------

const MOTION: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Строки разной высоты', en: 'Rows of different heights' },
    hint: {
      ru: 'Строки идут по клиентам, у каждой своя высота по заметке.',
      en: 'Rows are ordered by client, and each has its own height based on its note.',
    },
  },
  {
    title: {
      ru: 'Пользователь отсортировал по городу',
      en: 'The user sorted by city',
    },
    hint: {
      ru: 'Строки переехали на новые места и сохранили свою высоту: каждая едет со своего прежнего места.',
      en: 'The rows moved to their new places and kept their heights: each one moves from its previous place.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => gridDrawn(root) && !!guideTable, signal)
      guideTable!.setSorting([{ id: 'city', desc: true }])
      await pollUntil(
        () =>
          root
            .querySelector('.data-grid__body')
            ?.getAnimations({ subtree: true }).length === 0,
        signal,
      )
    }),
  },
]

/** ADR 0218, S7: сортировка строк разной высоты — строки едут к своим местам. */
export const TextWrapMotion: StoryObj<StoryProps> = {
  name: 'Sort rows of different heights',
  parameters: { scenario: '0218/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Сортировка строк разной высоты',
        en: 'Sorting rows of different heights',
      }}
      steps={MOTION}
      args={guideArgs(
        {
          ...GRID,
          enableColumnSorting: true,
          extraPlugins: [tableHost()],
          columnsOverride: AUTO_COLUMNS as never,
          dataOverride: notes(30),
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let first = ''
    await step(MOTION[0]!.title.ru, async () => {
      await waitForRows(canvas)
      first = canvas.querySelector<HTMLElement>(
        '.data-grid__body-row[data-index="0"]',
      )!.dataset.rowId!
    })
    await step(MOTION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(
          canvas.querySelector<HTMLElement>(
            '.data-grid__body-row[data-index="0"]',
          )!.dataset.rowId,
        ).not.toBe(first),
      )
      await settle()
    })
  },
}
