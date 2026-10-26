import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { TesseraFeatureEntry } from '../core/features'
import type { FlashOutcome } from '../core/flashes/flashFeature'
import type { HighlightTarget } from '../core/highlights/highlightFeature'
import type { ScrollToRowOptions } from '../core/scrollToRow/scrollToRowFeature'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  bodyRow,
  guideNext,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { getData } from './__mocks__/data'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Прокрутка к строке (ADR 0104): `table.scrollToRow` с выравниванием, колонкой и
 * раскрытием предков. `Playground` — дерево с футером; S1 — приложение показывает
 * нужную строку.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Scroll to row',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  enableRowExpanding: true,
  rowExpandingMaxDepth: 3,
  enableFooter: true,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
} satisfies Partial<StoryProps>

/** Дерево в 300 строк с футером: к строке прокручивает приложение — см. гайд. */
export const ScrollToRowPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: { ...GRID, dataNesting: 'nested', dataCount: 300 },
  parameters: showControls([
    'dataNesting',
    'enableFooter',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
  ]),
}

interface ScrollApi {
  scrollToRow: (rowId: string, options?: ScrollToRowOptions) => Promise<boolean>
  flashOutcome: (target: HighlightTarget, outcome: FlashOutcome) => void
}

let scrollTable: ScrollApi | null = null

/** Отдаёт таблицу шагам: прокручивает приложение. */
const scrollHost: TesseraFeatureEntry = {
  id: 'scrollToRowHost',
  setup: table => {
    scrollTable = table as unknown as ScrollApi
    return () => {
      scrollTable = null
    }
  },
}

const rows = getData(300, 'nested')
const FAR = 'item-id-250'
const DEEP = 'item-id-90-0-0'
const DEEP_PARENTS = ['item-id-90', 'item-id-90-0']

/** Приложение просит таблицу показать строку и отмечает её вспышкой «появилось». */
const showRow = (id: string) =>
  stepAction(async (root, { signal }) => {
    while (!scrollTable || !root.querySelector('.data-grid__body-row')) {
      await new Promise(resolve => setTimeout(resolve, 50))
      signal.throwIfAborted()
    }
    const shown = await scrollTable.scrollToRow(id, {
      align: 'center',
      expandParents: true,
    })
    signal.throwIfAborted()
    if (shown) scrollTable.flashOutcome({ row: id }, 'arrived')
  })

const flashed = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-flash') === 'arrived'

const SCROLL: readonly GuideStoryStep[] = [
  {
    title: 'Начало таблицы',
    hint: 'Таблица открыта в начале, нужная строка далеко внизу.',
  },
  {
    title: 'Приложение показало строку',
    hint: 'Приложение попросило таблицу показать строку. Таблица прокрутилась к ней, строка коротко вспыхнула.',
    enter: showRow(FAR),
    immediate: true,
  },
  {
    title: 'Строка внутри свёрнутой ветки',
    hint: 'Приложение попросило показать строку из свёрнутой ветки. Таблица раскрыла её родителей и прокрутилась к ней, строка коротко вспыхнула.',
    enter: showRow(DEEP),
    immediate: true,
  },
]

/** ADR 0104, S1: приложение прокручивает таблицу к нужной строке. */
export const ScrollToRowShow: StoryObj<StoryProps> = {
  name: 'Show a row',
  parameters: {
    scenario: '0104/S1',
    requirements: ['SV12'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Прокрутка к строке"
      steps={SCROLL}
      args={guideArgs(
        { ...GRID, dataOverride: rows, extraPlugins: [scrollHost] },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const expanded = (id: string) =>
      bodyRow(canvas, id)?.getAttribute('data-expanded') === 'true'
    await step(SCROLL[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(bodyRow(canvas, FAR)).toBeFalsy()
    })
    await step(SCROLL[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(flashed(canvas, FAR)).toBe(true))
    })
    await step(SCROLL[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(flashed(canvas, DEEP)).toBe(true))
      for (const parent of DEEP_PARENTS)
        await expect(expanded(parent)).toBe(true)
      await settle()
    })
  },
}
