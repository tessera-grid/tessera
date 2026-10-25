import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import { definePlugin } from '../core/definePlugin'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  headCell,
  headKebab,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Ширина колонок (ADR 0013, ADR 0111): протяжка ручки на границе заголовков, кнопки
 * заголовка уходят в меню узкой колонки; ширина по умолчанию от приложения (ADR 0077).
 * `Playground` — песочница, остальное — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Resizing',
} satisfies Meta<StoryProps>

export default meta

const NOT_COLUMNS = 'На ширину колонок не влияет'

/** Колонки с ручкой ширины на границе заголовков в покое. */
export const ColumnResizingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    ['enableColumnSizing', 'enableColumnSorting', 'enableHeaderActionMenu'],
    { rowHeight: NOT_COLUMNS, headerHeight: NOT_COLUMNS },
  ),
  args: {
    enableColumnSizing: true,
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
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

// --- Общее для шагов ------------------------------------------------------------------

const HEAD = '.data-grid__head-cell[data-column-id]'

const rect = (element: Element) => element.getBoundingClientRect()

/** Действие шага — после отрисовки строк: ждёт таймером, а не кадрами. */
const afterRows =
  (action: (root: HTMLElement) => void) => (root: HTMLElement) => {
    const run = () =>
      root.querySelector('.data-grid__body-row')
        ? action(root)
        : setTimeout(run, 50)
    setTimeout(run, 0)
  }

interface SizingApi {
  setColumnSizing: (sizing: Record<string, number>) => void
}

let sizingApi: SizingApi | null = null

/** Отдаёт таблицу шагам истории — ширину меняют, как протяжкой ручки. */
const columnSizingHost = definePlugin<{ enabled?: boolean }>()({
  id: 'resizingColumnSizingHost',
  setup: () => table => {
    sizingApi = table as unknown as SizingApi
    return () => {
      sizingApi = null
    }
  },
})

/** Ширина колонок шага: таблица отдаёт её, когда готова. */
const withWidths = (sizing: Record<string, number>) =>
  afterRows(() => {
    let tries = 0
    const run = () => {
      if (sizingApi) sizingApi.setColumnSizing(sizing)
      else if (++tries < 40) setTimeout(run, 50)
    }
    run()
  })

// --- ADR 0013 S1: ширина колонки ------------------------------------------------------

const RESIZED = 'firstName'
/** Шире — кнопки заголовка помещаются; уже — минимальная ширина колонки. */
const START = 310
const WIDE = 420
const NARROW = 150

const RESIZE: readonly GuideStoryStep[] = [
  {
    title: 'Колонки в таблице',
    hint: 'Таблица отображает колонки с ручкой изменения ширины на границе заголовков. Ручка появляется при наведении на заголовок.',
    enter: withWidths({ [RESIZED]: START }),
  },
  {
    title: 'Пользователь растянул колонку',
    hint: 'Пользователь потянул ручку на границе колонок. Колонка стала шире, а колонки правее сдвинулись вслед за её краем.',
    enter: withWidths({ [RESIZED]: WIDE }),
  },
  {
    title: 'Пользователь сузил колонку',
    hint: 'Колонка стала уже, и кнопкам заголовка не хватает места: они уходят в меню колонки.',
    enter: withWidths({ [RESIZED]: NARROW }),
  },
]

/** ADR 0013, S1: пользователь меняет ширину колонки — соседи сдвигаются, кнопки уходят в меню. */
export const ResizingColumns: StoryObj<StoryProps> = {
  name: 'Resize columns',
  parameters: {
    scenario: '0013/S1',
    requirements: ['GB9'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ширина колонки"
      steps={RESIZE}
      args={guideArgs(
        {
          enableColumnSizing: true,
          enableColumnSorting: true,
          enableColumnFiltering: true,
          enableColumnPinning: true,
          enableHeaderActionMenu: true,
          headerActionMenuThreshold: 10,
          extraPlugins: [columnSizingHost()],
          columnCount: 4,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const width = () => Math.round(rect(headCell(canvas, RESIZED)).width)
    const kebab = () => headKebab(canvas, RESIZED)
    let neighbour = 0
    await step(RESIZE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(
          headCell(canvas, RESIZED).querySelector('.resize__handler--column'),
        ).not.toBeNull(),
      )
      await until(() => expect(width()).toBe(START))
      await until(() => expect(kebab()).toBeNull())
      neighbour = rect(headCell(canvas, 'lastName')).left
    })
    await step(RESIZE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width()).toBe(WIDE))
      await expect(rect(headCell(canvas, 'lastName')).left).toBeGreaterThan(
        neighbour,
      )
      await settle()
    })
    await step(RESIZE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(width()).toBe(NARROW))
      await until(() => expect(kebab()).not.toBeNull())
      await settle()
    })
  },
}

// --- ADR 0077 S3: ширина колонок по умолчанию -----------------------------------------

const STRETCHED = 320

const COLUMNS: readonly GuideStoryStep[] = [
  {
    title: 'Ширина по умолчанию',
    hint: 'Приложение задало ширину колонок по умолчанию. Колонки без своей ширины получили её, а колонка со своей шириной осталась прежней.',
  },
  {
    title: 'Пользователь растянул колонку',
    hint: 'Пользователь растянул одну из колонок шире остальных.',
    enter: withWidths({ name: STRETCHED }),
  },
  {
    title: 'Новая ширина по умолчанию',
    hint: 'Приложение уменьшило ширину по умолчанию. Сузилась только колонка без своей ширины: растянутая пользователем и колонка со своей шириной не изменились.',
    props: () => ({ defaultColumn: { size: 140 } }),
    enter: withWidths({ name: STRETCHED }),
  },
]

const DEFAULT_COLUMN_WIDTH_ARGS = {
  defaultColumn: { size: 220 },
  columnsOverride: [
    { id: 'name', accessorKey: 'name', header: 'Name' },
    { id: 'company', accessorKey: 'company', header: 'Company' },
    { id: 'city', accessorKey: 'city', header: 'City', size: 100 },
  ],
  dataOverride: [
    { id: '1', name: 'Ann', company: 'Acme', city: 'Oslo' },
    { id: '2', name: 'Bob', company: 'Globex', city: 'Rome' },
  ],
  enableColumnSizing: true,
  extraPlugins: [columnSizingHost()],
} satisfies Partial<StoryProps>

/** ADR 0077, S3: ширина колонок по умолчанию и её смена — растянутые остаются. */
export const ResizingDefaultColumnWidth: StoryObj<StoryProps> = {
  name: 'Default column width',
  parameters: {
    scenario: '0077/S3',
    requirements: ['CW3'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ширина колонок по умолчанию"
      steps={COLUMNS}
      args={guideArgs(DEFAULT_COLUMN_WIDTH_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const widths = () =>
      ['name', 'company', 'city'].map(id =>
        Math.round(rect(headCell(canvas, id)).width),
      )
    await step(COLUMNS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(sizingApi).not.toBeNull())
      await until(() => expect(widths()).toEqual([220, 220, 100]))
    })
    await step(COLUMNS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toEqual([STRETCHED, 220, 100]))
    })
    await step(COLUMNS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(widths()).toEqual([STRETCHED, 140, 100]))
    })
    await settle()
  },
}
