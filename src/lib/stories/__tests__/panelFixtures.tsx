// Открытые панели фильтра и выгрузки как фикстуры тестов: `Playground` своего раздела и
// `play`, который открывает панель, как пользователь. Истории-состояния ушли в шаги гайдов
// (ADR 0117), а тестам кнопок нужен грид с уже открытой панелью.

import { openColumnsMenu } from './viewSettings'
import {
  dateFilteringColumns,
  dateFilteringData,
  optionFilteringColumns,
  optionFilteringData,
} from '../__mocks__/filteringData'
import { headCell, openPopup, waitForRows } from '../__mocks__/catalogPlay'
import { revealCellButtons } from './helpers'
import { composed } from './stories'

type Play = (context: { canvasElement: HTMLElement }) => Promise<void>
type Props = Parameters<typeof composed.FilteringPlayground>[0]

/** Фикстура: грид с аргументами и `play`, который открывает панель. */
const fixture = (
  Story: typeof composed.FilteringPlayground,
  args: Props,
  play: Play,
) => Object.assign((props: Props) => <Story {...args} {...props} />, { play })

const openFilter =
  (column: string): Play =>
  async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await revealCellButtons(headCell(canvasElement, column), true)
    await openPopup(() =>
      headCell(canvasElement, column).querySelector<HTMLElement>(
        '.column-filter__button',
      ),
    )
  }

/** Открытая панель текстового фильтра. */
export const FilterTextPanel = fixture(
  composed.FilteringPlayground,
  {},
  openFilter('name'),
)

/** Открытая панель фильтра даты с календарём. */
export const FilterDatePanel = fixture(
  composed.FilteringPlayground,
  {
    columnsOverride: dateFilteringColumns,
    dataOverride: dateFilteringData,
    timeZone: 'UTC',
  },
  openFilter('createdAt'),
)

/** Открытая панель фильтра вариантов. */
export const FilterOptionsPanel = fixture(
  composed.FilteringPlayground,
  {
    columnsOverride: optionFilteringColumns,
    dataOverride: optionFilteringData,
  },
  openFilter('status'),
)

/** Открытая панель выгрузки. */
export const ExportPanel = fixture(
  composed.ExportPlayground,
  { dataCount: 20 },
  async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const panel = await openPopup(() =>
      canvasElement.querySelector<HTMLElement>('[data-testid="export-button"]'),
    )
    // Фокус — на панели, как после открытия мышью: без кольца фокуса первого пункта.
    panel.focus()
  },
)

/** Открытый раздел «Колонки» «Настроек вида». */
export const ColumnsPanel = fixture(
  composed.ColumnVisibilityPlayground,
  {
    enableRowSelection: false,
    dataCount: 20,
    containerHeight: '460',
    height: '360',
    maxHeight: '360',
  },
  async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await openColumnsMenu({ root: canvasElement })
  },
)
