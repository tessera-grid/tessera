import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  ServerPaginationDemo,
  type ServerPaginationDemoProps,
} from './demos/panelsDemos'
import { expect, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  byTestId,
  consoleText,
  firstRowText,
  guideNext,
  headCell,
  orderedRows,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { showControls } from './__mocks__/utils/dataGridControls'
import { getData } from './__mocks__/data'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/** Пагинация (ADR 0038): на клиенте и серверная с сортировкой; свой пейджер приложения (ADR 0120). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Panels/Pagination',
} satisfies Meta<StoryProps>

export default meta

export const Pagination: StoryObj<StoryProps> = {
  name: 'Basic',
  parameters: {
    ...vrStates('panel.pagination'),
    ...showControls([
      'enablePagination',
      'paginationInitialPageSize',
      'paginationPageSizes',
      'paginationRevertOnReject',
    ]),
  },
  args: {
    // Пагинация в нижней панели: размер страницы, диапазон и кнопки. Включите
    // enableColumnSorting — смена сортировки вернёт на первую страницу.
    enablePagination: true,
    dataCount: 1000,
  },
}

export const PaginationServer: StoryObj<ServerPaginationDemoProps> = {
  name: 'Server',
  args: {
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
    serverDelayMs: 400,
    // Грид не режет и не сортирует строки: страница и сортировка уходят в
    // onPageChange / onToggleColumnSort (журнал справа), «сервер» отвечает страницей
    // с задержкой, итог страниц — из paginationRowCount.
  },
  argTypes: {
    serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  },
  render: args => <ServerPaginationDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0042, DS6): страница и сортировка приходят с сервера, итог —
  // из paginationRowCount.
  parameters: {
    requirements: ['DS6'],
    ...showControls(['serverDelayMs'], {
      dataCount: 'данные подаёт демо',
      columnCount: 'колонки задаёт демо',
    }),
  },
  play: async ({ canvasElement }) => {
    const firstName = () => firstRowText(canvasElement, 'name')
    const range = () => byTestId('pagination-range')?.textContent
    await waitForRows(canvasElement)
    await until(() => expect(range()).toBe('1–25 of 230'))
    expect(firstName()).toBe('Alice 0')

    await userEvent.click(
      canvasElement.querySelector<HTMLElement>('[data-page-action="next"]')!,
    )
    await until(() => expect(firstName()).toMatch(/ 25$/))
    expect(range()).toBe('26–50 of 230')
    expect(consoleText()).toContain('onPageChange')
    expect(consoleText()).toContain('page 2 of 10')

    await userEvent.click(
      headCell(canvasElement, 'name').querySelector<HTMLElement>(
        '.column-sort__button',
      )!,
    )
    await until(() =>
      expect(consoleText()).toMatch(/page 2 of 10 by name (asc|desc)/),
    )
    expect(consoleText()).toContain('onToggleColumnSort')
    const sign = /by name desc/.test(consoleText()) ? -1 : 1
    const sorted = () => {
      const names = orderedRows(canvasElement).map(row =>
        row.querySelector('[data-column-id="name"]')!.textContent!.trim(),
      )
      return names.every(
        (name, i) =>
          i === 0 ||
          sign *
            names[i - 1]!.localeCompare(name, undefined, { numeric: true }) <=
            0,
      )
    }
    await until(() => expect(sorted()).toBe(true))
    expect(range()).toBe('26–50 of 230')
    await settle()
  },
}

// --- ADR 0120, S2 --------------------------------------------------------------------

const OWN_PAGER_ROWS = 50
const ownPagerData = getData(OWN_PAGER_ROWS)
const statusBarOf = (root: ParentNode) =>
  root.querySelector('[data-testid="data-grid-status-bar"]')

const OWN_PAGER: readonly GuideStoryStep[] = [
  {
    title: 'Первая страница',
    hint: 'Плагин paginationModel без pagination: строки — первой страницы по 10, нижней панели с пейджером нет.',
    props: () => ({
      enablePaginationModel: true,
      paginationModelPagination: { pageIndex: 0, pageSize: 10 },
    }),
  },
  {
    title: 'Приложение листает дальше',
    hint: 'Свой пейджер приложения задаёт срез pagination аргументом модели — грид показывает вторую страницу.',
    props: () => ({
      paginationModelPagination: { pageIndex: 1, pageSize: 10 },
    }),
  },
  {
    title: 'Страница по 5',
    hint: 'Приложение меняет размер страницы — строк становится пять.',
    props: () => ({
      paginationModelPagination: { pageIndex: 0, pageSize: 5 },
    }),
  },
]

/** ADR 0120, S2: приложение листает страницы своим пейджером — модель без нижней панели. */
export const PaginationOwnPager: StoryObj<StoryProps> = {
  name: 'Own pager',
  parameters: {
    scenario: '0120/S2',
    ...showControls(['enablePaginationModel']),
  },
  args: {
    dataCount: OWN_PAGER_ROWS,
    containerHeight: '600',
    height: '560',
    maxHeight: '560',
  },
  render: args => (
    <GuideStory
      title="Свой пейджер приложения"
      steps={OWN_PAGER}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(OWN_PAGER[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(orderedRows(canvas)).toHaveLength(10))
      expect(firstRowText(canvas, 'firstName')).toBe(ownPagerData[0]!.firstName)
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(firstRowText(canvas, 'firstName')).toBe(
          ownPagerData[10]!.firstName,
        ),
      )
      expect(statusBarOf(canvas)).toBeNull()
    })
    await step(OWN_PAGER[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(orderedRows(canvas)).toHaveLength(5))
    })
    await settle()
  },
}
