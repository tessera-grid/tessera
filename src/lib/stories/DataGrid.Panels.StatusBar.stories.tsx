import { Meta, StoryObj } from '@storybook/react'
import { statusBarDemoPlugins } from './statusBarDemo'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  bodyRow,
  byTestId,
  guideNext,
  orderedRows,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { seed } from './__mocks__/seed'
import { storyLabels } from './__mocks__/storyLabels'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'

/**
 * Нижняя панель (ADR 0038): `Playground` — слоты панели в покое; S2 — счётчик выбранных
 * строк, S3 — узкая таблица.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Status bar',
} satisfies Meta<StoryProps>

export default meta

const GRID = {
  columnCount: 8,
  dataCount: 120,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

export const StatusBarPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: {
    ...vrStates('panel.statusBar'),
    ...showControls([
      'enableStatusBar',
      'enableFooter',
      'enableRowSelection',
      'rowSelectionSelectedCount',
      'enablePagination',
      'paginationInitialPageSize',
      'paginationPageSizes',
    ]),
  },
  args: {
    // Демо-слоты нижней панели: один слева, два справа (порядок по `order`).
    // Включите enableFooter — панель встанет под футером одной линией.
    extraPlugins: statusBarDemoPlugins,
  },
}

const counterText = () => byTestId('selected-rows-count')?.textContent ?? ''
const statusBar = () => byTestId('data-grid-status-bar')
const checkboxOf = (row: Element | null | undefined) =>
  row?.querySelector<HTMLElement>('[role="checkbox"]') ?? null
const isSelected = (root: HTMLElement, id: string) =>
  bodyRow(root, id)?.getAttribute('data-selected') === 'true'
const rangeText = () => byTestId('pagination-range')?.textContent ?? ''

// --- ADR 0038 S2 ---------------------------------------------------------------------

const PAGE = 10
const FIRST_PAGE = ['item-id-1', 'item-id-2']
const SECOND_PAGE = 'item-id-12'

/** Пользователь отмечает флажки строк, пока они не выбраны. */
const selectRows = (root: HTMLElement, ids: readonly string[]) => {
  const next = ids.find(id => !isSelected(root, id))
  if (next) checkboxOf(bodyRow(root, next))?.click()
}
const onSecondPage = () => rangeText().startsWith(`${PAGE + 1}–`)

const COUNT_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ничего не выбрано', en: 'No selection yet' },
    hint: {
      ru: 'Нижняя панель на месте: слева пусто, справа пейджер.',
      en: 'The status bar is in place: empty on the left, the pager on the right.',
    },
  },
  {
    title: {
      ru: 'Пользователь выбрал две строки',
      en: 'The user selected two rows',
    },
    hint: {
      ru: 'Слева в нижней панели появилось число выбранных строк.',
      en: 'The number of selected rows appeared on the left of the status bar.',
    },
    states: ['body.selection'],
    enter: untilDone(
      root => FIRST_PAGE.every(id => isSelected(root, id)),
      root => selectRows(root, FIRST_PAGE),
    ),
  },
  {
    title: {
      ru: 'Пользователь выбрал строку на другой странице',
      en: 'The user selected a row on another page',
    },
    hint: {
      ru: 'Строки первой страницы не видны, но учтены: счётчик показывает выбор со всех страниц.',
      en: 'The rows from the first page are out of view but still counted: the counter shows the selection across all pages.',
    },
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => {
        if (FIRST_PAGE.every(id => isSelected(root, id))) return true
        selectRows(root, FIRST_PAGE)
        return false
      }, signal)
      await pollUntil(() => {
        if (onSecondPage()) return true
        root
          .querySelector<HTMLElement>(
            '[data-testid="pagination"] [data-page-action="next"]',
          )
          ?.click()
        return false
      }, signal)
      await pollUntil(() => {
        if (isSelected(root, SECOND_PAGE)) return true
        selectRows(root, [SECOND_PAGE])
        return false
      }, signal)
    }),
  },
]

/** ADR 0038, S2: счётчик выбранных строк в нижней панели — выбор со всех страниц. */
export const SelectedCount: StoryObj<StoryProps> = {
  name: 'Selected count',
  parameters: { scenario: '0038/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Счётчик выбранных строк', en: 'Selected rows counter' }}
      steps={COUNT_STEPS}
      args={guideArgs(
        {
          ...GRID,
          enableRowSelection: true,
          rowSelectionSelectedCount: true,
          enablePagination: true,
          paginationInitialPageSize: PAGE,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(COUNT_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(statusBar()).not.toBeNull()
      await expect(counterText()).toBe('')
    })
    await step(COUNT_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(counterText()).toBe(rowSelectionLabels(labels).selectedRows(2)),
      )
    })
    await step(COUNT_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(onSecondPage()).toBe(true)
      await expect(FIRST_PAGE.some(id => bodyRow(canvas, id))).toBe(false)
      await expect(counterText()).toBe(
        rowSelectionLabels(labels).selectedRows(3),
      )
      await settle()
    })
  },
}

// --- ADR 0038 S3 ---------------------------------------------------------------------

const layout = () => statusBar()?.getAttribute('data-status-bar-layout')
/** Кнопки панели внутри рамки таблицы. */
const inFrame = () => {
  const bar = statusBar()!
  const box = bar.parentElement!.getBoundingClientRect()
  return [...bar.querySelectorAll('button')].every(button => {
    // Скрытый вид пейджера не считается: номера страниц в узкой панели не видны.
    if (button.getClientRects().length === 0) return true
    const own = button.getBoundingClientRect()
    return (
      own.left >= box.left - 1 &&
      own.right <= box.right + 1 &&
      own.bottom <= box.bottom + 1
    )
  })
}

const NARROW_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Широкая таблица', en: 'A wide table' },
    hint: {
      ru: 'Нижняя панель в одну строку: счётчик слева, пейджер справа.',
      en: 'The status bar fits on one line: the counter on the left, the pager on the right.',
    },
    props: () => ({ containerWidth: 760 }),
  },
  {
    title: { ru: 'Таблица сузилась', en: 'The table got narrower' },
    hint: {
      ru: 'Панель не помещается и переходит в компактный вид: подпись размера страницы скрыта, но список назван ею для скринридера.',
      en: 'The bar no longer fits and switches to a compact layout: the page size label is hidden, but it still names the list for screen readers.',
    },
    props: () => ({ containerWidth: 460 }),
  },
  {
    title: { ru: 'Таблица стала ещё уже', en: 'The table got even narrower' },
    hint: {
      ru: 'Панель в две строки: счётчик сверху, пейджер снизу. Все кнопки внутри рамки, последняя строка таблицы не уходит под панель.',
      en: 'The bar takes two lines: the counter on top, the pager below. All buttons stay inside the frame, and the last row of the table is not hidden under the bar.',
    },
    states: ['panel.narrow'],
    props: () => ({ containerWidth: 300 }),
  },
]

/** ADR 0038, S3: таблица в узкой колонке — нижняя панель компактная, затем в две строки. */
export const PanelsNarrowStatusBar: StoryObj<StoryProps> = {
  name: 'Narrow',
  parameters: { scenario: '0038/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Узкая таблица', en: 'A narrow table' }}
      steps={NARROW_STEPS}
      args={guideArgs(
        {
          ...GRID,
          extraPlugins: [
            seed(
              'narrowSelection',
              (table: {
                setRowSelection?: (value: Record<string, boolean>) => void
              }) =>
                table.setRowSelection?.({
                  'item-id-1': true,
                  'item-id-2': true,
                }),
            ),
          ],
          enableRowSelection: true,
          rowSelectionSelectedCount: true,
          enableColumnFiltering: true,
          enablePagination: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NARROW_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(layout()).toBe('full'))
      await until(() => expect(counterText()).not.toBe(''))
    })
    await step(NARROW_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(layout()).toBe('compact'))
    })
    await step(NARROW_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(layout()).toBe('stacked'))
      await until(() => expect(inFrame()).toBe(true))
      await until(() => expect(orderedRows(canvas).length).toBeGreaterThan(0))
      // Область прокрутки кончается над панелью: последняя строка не уходит под неё.
      const scroller = canvas.querySelector('.data-grid__container')!
      await until(() =>
        expect(scroller.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          statusBar()!.getBoundingClientRect().top + 0.5,
        ),
      )
      await settle()
    })
  },
}
