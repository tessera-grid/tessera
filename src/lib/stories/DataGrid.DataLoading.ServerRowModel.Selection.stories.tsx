import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { TesseraFeatureEntry } from '../core/features'
import type { ExportRequest } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import {
  layout,
  release,
  bodyRows,
  hasRow,
  server,
  serverReset,
  serverProps,
  refreshing,
  skeletonRows,
  TREE_CHILDREN,
  treeProps,
  groupServer,
  groupProps,
  groupButton,
  groupRows,
  groupRowOf,
  parisItems,
} from './__mocks__/serverRowModelGuide'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'
import { rowSelectionModelLabels } from '../plugins/rowSelectionModel/labels'

/**
 * Выбор строк в серверной модели (ADR 0138, ADR 0148): `Playground` — десять тысяч строк с
 * флажками, группировка и число строк групп — контролами; S6 ADR 0138 — выбрать всё, кроме
 * нескольких строк, и выгрузить; S1–S3 ADR 0148 — выбор группы целиком, сброс сменой
 * группировки, счётчик без размеров групп; S1 ADR 0162 — выбор ветки дерева целиком; S1–S3
 * ADR 0188 — выбор страницы, её догрузка и отказ.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Selection',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface SelectionPlaygroundArgs extends StoryProps {
  groupBy: 'none' | 'city'
  groupCounts: boolean
}

export const ServerSelectionPlayground: StoryObj<SelectionPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['groupBy', 'groupCounts'], {
    dataCount: 'строки подаёт «сервер» демо',
    columnCount: 'колонки задаёт демо',
  }),
  // Список без группировки: флажки строк и «выбрать всё» в шапке.
  args: { ...layout, groupBy: 'none', groupCounts: true },
  argTypes: {
    groupBy: {
      description: 'Колонка, по которой список сгруппирован при открытии',
      control: 'select',
      options: ['none', 'city'],
    },
    groupCounts: {
      description: 'Сервер присылает число строк каждой группы',
      control: 'boolean',
    },
  },
  render: ({ groupBy, groupCounts, ...args }) => (
    <StoryComponent
      key={groupBy}
      {...normalizeArgs(args)}
      {...groupSelectProps({ counts: groupCounts })!(AT_REST)}
      rowGroupingInitialGrouping={groupBy === 'none' ? [] : [groupBy]}
    />
  ),
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(bodyRows(canvas).length).toBeGreaterThan(0))
    await settle()
  },
}

// --- ADR 0138 S6 ---------------------------------------------------------------------

const SELECT_TOTAL = 10_000
const SELECT_BLOCK = 50
/** Строки, с которых пользователь снимает выбор. */
const UNCHECKED = [1, 3]

/** Запрос серверной выгрузки и его завершение — у «сервера» гайда. */
const selectExport = {
  request: undefined as ExportRequest | undefined,
  finish: undefined as (() => void) | undefined,
}

const exportReset: TesseraFeatureEntry = {
  id: 'serverRowModelExportReset',
  setup: () => {
    selectExport.request = undefined
    selectExport.finish?.()
    selectExport.finish = undefined
  },
}

const rowCheckbox = (root: HTMLElement, index: number) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"] .row-select-checkbox`,
  )
const headCheckbox = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__head-cell .row-select-checkbox')
const isChecked = (element: Element | null) =>
  !!element?.hasAttribute('data-checked')
const exportButton = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="export-button"]')
const selectedCount = (root: HTMLElement) =>
  root
    .querySelector('[data-testid="selected-rows-count"]')
    ?.textContent?.trim() ?? ''

/** Пользователь выбирает весь список флажком в шапке. */
const selectAll = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!rowCheckbox(root, 0), signal)
  if (!isChecked(rowCheckbox(root, 0))) headCheckbox(root)!.click()
  await pollUntil(() => isChecked(rowCheckbox(root, 0)), signal)
}

/** Пользователь снимает флажки нескольких строк. */
const uncheckSome = async (root: HTMLElement, signal: AbortSignal) => {
  await selectAll(root, signal)
  for (const index of UNCHECKED) {
    if (isChecked(rowCheckbox(root, index))) rowCheckbox(root, index)!.click()
    await pollUntil(() => !isChecked(rowCheckbox(root, index)), signal)
  }
}

const SELECT_ALL_EXCEPT: readonly GuideStoryStep[] = [
  {
    title: 'Список с флажками',
    hint: 'Сервер отдаёт строки блоками, у каждой строки — флажок выбора. Пока ничего не выбрано.',
    props: ({ app, ...context }) => ({
      ...serverProps({
        total: SELECT_TOTAL,
        knownTotal: true,
        blockSize: SELECT_BLOCK,
      })!({ app, ...context }),
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
      enableDataExport: true,
      dataMode: { export: 'server' },
      // Одна комбинация: кнопка выгружает выбранное сразу, без панели.
      dataExportAllow: { rows: ['selected'], columns: ['visible'] },
      onExport: (request: ExportRequest) =>
        new Promise<void>(resolve => {
          selectExport.request = request
          selectExport.finish = resolve
        }),
      extraPlugins: [serverReset, exportReset],
    }),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowCheckbox(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь выбрал всё',
    hint: 'Флажок в шапке выбрал весь список — десять тысяч строк, хотя загружена лишь малая их часть. Нижняя панель считает весь итог, новых запросов к серверу нет.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectAll(root, signal)
    }),
  },
  {
    title: 'Пользователь снял две строки',
    hint: 'Снятые строки стали исключениями: остальные по-прежнему выбраны, флажок в шапке показывает частичный выбор, счётчик уменьшился на две.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await uncheckSome(root, signal)
    }),
  },
  {
    title: 'Пользователь выгрузил выбранное',
    hint: 'Файл собирает сервер: приложение получило запрос «все строки, кроме двух снятых» вместе с текущей выборкой. Пока сервер готовит файл, кнопка выгрузки ждёт.',
    enter: stepAction(async (root, { signal }) => {
      await uncheckSome(root, signal)
      await pollUntil(() => !!exportButton(root), signal)
      if (!selectExport.request) exportButton(root)!.click()
      await pollUntil(
        () =>
          !!selectExport.request &&
          exportButton(root)!.getAttribute('aria-busy') === 'true',
        signal,
      )
    }),
  },
]

/** ADR 0138, S6: пользователь выбирает всё, кроме нескольких строк, и выгружает выбранное. */
export const ServerRowModelSelectAllExcept: StoryObj<StoryProps> = {
  name: 'Select all except',
  parameters: { scenario: '0138/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбрать всё, кроме"
      steps={SELECT_ALL_EXCEPT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(SELECT_ALL_EXCEPT[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(rowCheckbox(canvas, 0))).toBe(false)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(SELECT_ALL_EXCEPT[1]!.title, async () => {
      const before = server.starts.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(headCheckbox(canvas))).toBe(true)
      await expect(isChecked(rowCheckbox(canvas, 2))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(SELECT_TOTAL),
        ),
      )
      await expect(server.starts.length).toBe(before)
    })
    await step(SELECT_ALL_EXCEPT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(headCheckbox(canvas)).toHaveAttribute('data-indeterminate')
      for (const index of UNCHECKED) {
        await expect(isChecked(rowCheckbox(canvas, index))).toBe(false)
      }
      await expect(isChecked(rowCheckbox(canvas, 2))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(
            SELECT_TOTAL - UNCHECKED.length,
          ),
        ),
      )
    })
    await step(SELECT_ALL_EXCEPT[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectExport.request?.selection).toEqual({
        all: true,
        except: UNCHECKED.map(index => `item-id-${index}`),
      })
      await expect(selectExport.request?.query).toEqual({
        sorting: [],
        columnFilters: [],
        globalFilter: '',
        grouping: [],
        aggregations: {},
      })
      await expect(exportButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
  },
}

// --- ADR 0148: выбор группы целиком ------------------------------------------------

/** Группировка по городу с флажками выбора; `counts` — сервер присылает число строк групп. */
const groupSelectProps =
  ({ counts = true, exported = false } = {}): GuideStoryStep['props'] =>
  context => ({
    ...groupProps({ grouping: ['city'], counts })!(context),
    enableFooter: false,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    ...(exported && {
      enableDataExport: true,
      dataMode: { export: 'server' },
      // Одна комбинация: кнопка выгружает выбранное сразу, без панели.
      dataExportAllow: { rows: ['selected'], columns: ['visible'] },
      onExport: (request: ExportRequest) =>
        new Promise<void>(resolve => {
          selectExport.request = request
          selectExport.finish = resolve
        }),
    }),
    extraPlugins: [serverReset, exportReset],
  })

const groupCheckbox = (root: HTMLElement, city: string) =>
  groupRowOf(root, city)?.querySelector<HTMLElement>('.row-select-checkbox') ??
  null
const isPartial = (element: Element | null) =>
  !!element?.hasAttribute('data-indeterminate')
/** Первая строка данных на экране — строка единственной раскрытой группы. */
const firstDataRow = (root: HTMLElement) =>
  bodyRows(root).find(
    row =>
      row.dataset.groupRow !== 'true' &&
      !!row.dataset.rowId &&
      !row.dataset.rowId.startsWith('group:'),
  )
const dataRowCheckbox = (root: HTMLElement) =>
  firstDataRow(root)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null

/** Пользователь отметил флажок города. */
const selectCity = async (
  root: HTMLElement,
  signal: AbortSignal,
  city = 'Paris',
) => {
  await pollUntil(() => !!groupCheckbox(root, city), signal)
  if (!isChecked(groupCheckbox(root, city))) groupCheckbox(root, city)!.click()
  await pollUntil(() => isChecked(groupCheckbox(root, city)), signal)
}

/** Пользователь раскрыл город и дождался его строк. */
const openCity = async (
  root: HTMLElement,
  signal: AbortSignal,
  city: string,
) => {
  await pollUntil(() => !!groupRowOf(root, city), signal)
  const toggle = groupRowOf(root, city)!.querySelector<HTMLElement>(
    '.row-expand-button',
  )!
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  await pollUntil(() => !!dataRowCheckbox(root), signal)
}

/** Пользователь снял флажок первой строки раскрытого города. */
const uncheckFirstRow = async (root: HTMLElement, signal: AbortSignal) => {
  await selectCity(root, signal)
  await openCity(root, signal, 'Paris')
  if (isChecked(dataRowCheckbox(root))) dataRowCheckbox(root)!.click()
  await pollUntil(() => isPartial(groupCheckbox(root, 'Paris')), signal)
}

const GROUP_SELECTION: readonly GuideStoryStep[] = [
  {
    title: 'Список сгруппирован по городу',
    hint: 'Каждая строка — город с числом строк в нём. Самих строк городов таблица не загружала, у каждого города — свой флажок.',
    props: groupSelectProps({ exported: true }),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Флажок города выбрал все его строки, хотя ни одна не загружена: запросов к серверу не было. Нижняя панель считает строки города по числу, которое прислал сервер.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь снял одну строку',
    hint: 'Строки города пришли уже выбранными. Снятая строка стала исключением внутри города, поэтому флажок города показывает частичный выбор, а счётчик уменьшился на одну.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await uncheckFirstRow(root, signal)
    }),
  },
  {
    title: 'Пользователь выгрузил выбранное',
    hint: 'Файл собирает сервер: приложение получило запрос «весь город, кроме одной строки» вместе с текущей выборкой. Пока сервер готовит файл, кнопка выгрузки ждёт.',
    enter: stepAction(async (root, { signal }) => {
      await uncheckFirstRow(root, signal)
      await pollUntil(() => !!exportButton(root), signal)
      if (!selectExport.request) exportButton(root)!.click()
      await pollUntil(
        () =>
          !!selectExport.request &&
          exportButton(root)!.getAttribute('aria-busy') === 'true',
        signal,
      )
    }),
  },
]

/** ADR 0148, S1: выбрать город целиком, снять одну строку и выгрузить выбранное. */
export const ServerGroupSelection: StoryObj<StoryProps> = {
  name: 'Select a group',
  parameters: { scenario: '0148/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор группы целиком"
      steps={GROUP_SELECTION}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const paris = parisItems().length
    await step(GROUP_SELECTION[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(false)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(GROUP_SELECTION[1]!.title, async () => {
      const parents = server.parents.length
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(paris),
        ),
      )
      await expect(server.parents.length).toBe(parents)
    })
    await step(GROUP_SELECTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isPartial(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await expect(isChecked(dataRowCheckbox(canvas))).toBe(false)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(paris - 1),
        ),
      )
    })
    await step(GROUP_SELECTION[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectExport.request?.selection).toEqual({
        all: false,
        except: [],
        groups: [
          {
            keys: ['Paris'],
            all: true,
            except: [firstDataRow(canvas)!.dataset.rowId],
          },
        ],
      })
      await expect(selectExport.request?.query?.grouping).toEqual(['city'])
      await expect(exportButton(canvas)).toHaveAttribute('aria-busy', 'true')
    })
  },
}

/** Пользователь снял группировку по городу и дождался ответа. */
const ungroup = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!groupButton(root), signal)
  if (groupRows(root).length > 0) groupButton(root)!.click()
  await pollUntil(
    () => groupRows(root).length === 0 && hasRow(root, 0) && !refreshing(root),
    signal,
  )
}

const GROUP_SELECT_RESET: readonly GuideStoryStep[] = [
  {
    title: 'Список сгруппирован по городу',
    hint: 'Каждая строка — город с числом строк в нём и своим флажком. Пока ничего не выбрано.',
    props: groupSelectProps(),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Флажок города выбрал все его строки, а нижняя панель их посчитала.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь убрал группировку',
    hint: 'Без группировки городов в списке нет, и выбор, сделанный по городам, потерял смысл — таблица его сняла. Сервер прислал строки без групп, ни одна не выбрана.',
    enter: stepAction(async (root, { signal }) => {
      await ungroup(root, signal)
    }),
  },
]

/** ADR 0148, S2: смена группировки снимает выбор. */
export const ServerGroupSelectReset: StoryObj<StoryProps> = {
  name: 'Regrouping clears the selection',
  parameters: { scenario: '0148/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор и смена группировки"
      steps={GROUP_SELECT_RESET}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_SELECT_RESET[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(false)
    })
    await step(GROUP_SELECT_RESET[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(groupCheckbox(canvas, 'Paris'))).toBe(true)
      await until(() => expect(selectedCount(canvas)).not.toBe(''))
    })
    await step(GROUP_SELECT_RESET[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(groupRows(canvas)).toHaveLength(0)
      await expect(isChecked(rowCheckbox(canvas, 0))).toBe(false)
      await until(() => expect(selectedCount(canvas)).toBe(''))
      await settle()
    })
  },
}

const GROUP_SELECT_COUNT: readonly GuideStoryStep[] = [
  {
    title: 'Сервер не знает размер групп',
    hint: 'Каждая строка — город, но числа строк в городах сервер не прислал. Флажки у городов есть и так.',
    props: groupSelectProps({ counts: false }),
    enter: stepAction(async (root, { signal }) => {
      groupServer.refuse = false
      await pollUntil(() => !!groupCheckbox(root, 'Paris'), signal)
    }),
  },
  {
    title: 'Пользователь выбрал город',
    hint: 'Сколько строк в городе, таблица не знает, поэтому нижняя панель считает выбранные города, а не строки.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
    }),
  },
  {
    title: 'Пользователь выбрал строку другого города',
    hint: 'Отдельно выбранная строка считается сама по себе: нижняя панель показывает и строки, и города.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectCity(root, signal)
      await openCity(root, signal, 'Berlin')
      if (!isChecked(dataRowCheckbox(root))) dataRowCheckbox(root)!.click()
      await pollUntil(() => isPartial(groupCheckbox(root, 'Berlin')), signal)
    }),
  },
]

/** ADR 0148, S3: без числа строк групп счётчик называет строки и группы. */
export const ServerGroupSelectCount: StoryObj<StoryProps> = {
  name: 'Count without group sizes',
  parameters: { scenario: '0148/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Счётчик без размера групп"
      steps={GROUP_SELECT_COUNT}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(GROUP_SELECT_COUNT[0]!.title, async () => {
      await stepDone(canvas)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(GROUP_SELECT_COUNT[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionModelLabels(labels).selectedRowsAndGroups(
            0,
            rowSelectionModelLabels(labels).selectedGroupsCount(1),
          ),
        ),
      )
    })
    await step(GROUP_SELECT_COUNT[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionModelLabels(labels).selectedRowsAndGroups(
            1,
            rowSelectionModelLabels(labels).selectedGroupsCount(1),
          ),
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0162: выбор ветки дерева целиком -------------------------------------------

/** Строка со вложенными строками, которую выбирает пользователь. */
const BRANCH_PARENT = 'item-id-1'
/** Вложенная строка, с которой пользователь снимает выбор. */
const BRANCH_UNCHECKED = `${BRANCH_PARENT}.2`

/** Дерево «сервера» с флажками у всех строк и выбором ветки целиком. */
const branchSelectProps: GuideStoryStep['props'] = context => ({
  ...treeProps!(context),
  enableRowSelection: true,
  rowSelectionSubRows: true,
  rowSelectionSelectedCount: true,
})

const treeRow = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const treeCheckbox = (root: HTMLElement, id: string) =>
  treeRow(root, id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
const treeToggle = (root: HTMLElement, id: string) =>
  treeRow(root, id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const branchShown = (root: HTMLElement) =>
  !!treeRow(root, `${BRANCH_PARENT}.0`) && skeletonRows(root) === 0

/** Пользователь отметил флажок строки со вложенными строками. */
const selectBranch = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!treeCheckbox(root, BRANCH_PARENT), signal)
  if (
    !isChecked(treeCheckbox(root, BRANCH_PARENT)) &&
    !isPartial(treeCheckbox(root, BRANCH_PARENT))
  ) {
    treeCheckbox(root, BRANCH_PARENT)!.click()
  }
  await pollUntil(
    () =>
      isChecked(treeCheckbox(root, BRANCH_PARENT)) ||
      isPartial(treeCheckbox(root, BRANCH_PARENT)),
    signal,
  )
}

/** Пользователь раскрыл выбранную строку, «сервер» держит ответ. */
const openBranch = async (root: HTMLElement, signal: AbortSignal) => {
  await selectBranch(root, signal)
  if (branchShown(root) || server.held.length > 0) return
  server.hold = true
  if (treeToggle(root, BRANCH_PARENT)!.getAttribute('aria-expanded') !== 'true')
    treeToggle(root, BRANCH_PARENT)!.click()
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

/** Вложенные строки пришли. */
const branchArrived = async (root: HTMLElement, signal: AbortSignal) => {
  await openBranch(root, signal)
  server.hold = false
  release()
  await pollUntil(() => branchShown(root), signal)
}

const BRANCH_SELECTION: readonly GuideStoryStep[] = [
  {
    title: 'Дерево с флажками',
    hint: 'Сервер отдаёт верхний уровень списка блоками, у каждой строки — флажок. Вложенных строк таблица ещё не загружала, ничего не выбрано.',
    props: branchSelectProps,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!treeCheckbox(root, BRANCH_PARENT), signal)
    }),
  },
  {
    title: 'Пользователь выбрал строку со вложенными',
    hint: 'Флажок выбрал строку вместе со всеми вложенными, хотя ни одна из них не загружена: запросов к серверу не было. Сколько их, таблица не знает, поэтому нижняя панель считает строки и ветки по отдельности.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectBranch(root, signal)
    }),
  },
  {
    title: 'Пользователь раскрыл строку',
    hint: 'Таблица попросила у сервера вложенные строки. Пока ответ в пути, под строкой — блок строк-скелетов.',
    states: ['body.selection', 'body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      await openBranch(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Вложенные строки пришли уже выбранными. Теперь размер ветки известен, и нижняя панель считает выбранные строки точно.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await branchArrived(root, signal)
    }),
  },
  {
    title: 'Пользователь снял одну вложенную строку',
    hint: 'Снятая строка стала исключением внутри ветки: флажок родителя показывает частичный выбор, счётчик уменьшился на одну.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await branchArrived(root, signal)
      if (isChecked(treeCheckbox(root, BRANCH_UNCHECKED)))
        treeCheckbox(root, BRANCH_UNCHECKED)!.click()
      await pollUntil(
        () => isPartial(treeCheckbox(root, BRANCH_PARENT)),
        signal,
      )
    }),
  },
]

/** ADR 0162, S1: выбрать ветку серверного дерева целиком — вложенные, пришедшие позже, выбраны. */
export const ServerTreeSelectBranch: StoryObj<StoryProps> = {
  name: 'Select a tree branch',
  parameters: {
    scenario: '0162/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Выбор ветки дерева"
      steps={BRANCH_SELECTION}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(BRANCH_SELECTION[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(treeCheckbox(canvas, BRANCH_PARENT))).toBe(false)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(BRANCH_SELECTION[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isChecked(treeCheckbox(canvas, BRANCH_PARENT))).toBe(true)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionModelLabels(labels).selectedRowsAndGroups(
            1,
            rowSelectionModelLabels(labels).selectedBranchesCount(1),
          ),
        ),
      )
      await expect(server.parents).not.toContain(BRANCH_PARENT)
    })
    await step(BRANCH_SELECTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(server.parents).toContain(BRANCH_PARENT)
    })
    await step(BRANCH_SELECTION[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      for (let k = 0; k < TREE_CHILDREN; k++) {
        const id = `${BRANCH_PARENT}.${k}`
        await expect(isChecked(treeCheckbox(canvas, id))).toBe(true)
        await expect(treeRow(canvas, id)).toHaveAttribute(
          'data-selected',
          'true',
        )
      }
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(1 + TREE_CHILDREN),
        ),
      )
    })
    await step(BRANCH_SELECTION[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(isPartial(treeCheckbox(canvas, BRANCH_PARENT))).toBe(true)
      await expect(isChecked(treeCheckbox(canvas, BRANCH_UNCHECKED))).toBe(
        false,
      )
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(TREE_CHILDREN),
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0188: выбор страницы --------------------------------------------------------

const PAGE_TOTAL = 10_000
const PAGE_SIZE = 25
/** Страница длиннее блока: окно таблицы загружает только её начало. */
const LONG_PAGE = 60
const SHORT_BLOCK = 10
/** Блок страницы, который окно таблицы не просит. */
const FAILED_BLOCK = 50

const pageProps =
  (
    pageSize: number,
    blockSize: number,
    failBlock?: number,
  ): GuideStoryStep['props'] =>
  context => ({
    ...serverProps({
      total: PAGE_TOTAL,
      knownTotal: true,
      blockSize,
      failBlock,
    })!(context),
    enablePagination: true,
    paginationInitialPageSize: pageSize,
    enableRowSelection: true,
    rowSelectionSelectedCount: true,
    rowSelectionSelectAll: 'currentPage',
  })

const nextPage = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('[data-page-action="next"]')
const headWaits = (root: HTMLElement) =>
  headCheckbox(root)?.getAttribute('aria-busy') === 'true'

/** Пользователь отметил флажок шапки, строки страницы уже у таблицы. */
const selectPage = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!rowCheckbox(root, 0), signal)
  if (!isChecked(headCheckbox(root))) headCheckbox(root)!.click()
  await pollUntil(() => isChecked(headCheckbox(root)), signal)
}

/** Первая страница выбрана, пользователь перешёл на вторую. */
const toSecondPage = async (root: HTMLElement, signal: AbortSignal) => {
  if (!hasRow(root, PAGE_SIZE)) {
    await selectPage(root, signal)
    nextPage(root)!.click()
  }
  await pollUntil(() => hasRow(root, PAGE_SIZE), signal)
}

const SELECT_PAGE: readonly GuideStoryStep[] = [
  {
    title: 'Список страницами',
    hint: 'Сервер отдаёт строки страницами, у каждой строки есть флажок. Флажок в шапке относится к текущей странице.',
    props: pageProps(PAGE_SIZE, PAGE_SIZE),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowCheckbox(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь выбрал страницу',
    hint: 'Флажок в шапке выбрал строки этой страницы. Нижняя панель считает только их.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await selectPage(root, signal)
    }),
  },
  {
    title: 'Пользователь перешёл на вторую страницу',
    hint: 'Здесь ничего не выбрано, флажок в шапке пуст, счётчик прежний.',
    enter: stepAction(async (root, { signal }) => {
      await toSecondPage(root, signal)
    }),
  },
  {
    title: 'Пользователь выбрал вторую страницу',
    hint: 'Выбор прибавился к первой, счётчик показывает строки двух страниц.',
    enter: stepAction(async (root, { signal }) => {
      await toSecondPage(root, signal)
      await selectPage(root, signal)
    }),
  },
]

/** ADR 0188, S1: пользователь выбирает строки страницы, другие страницы не затронуты. */
export const ServerPageSelectAll: StoryObj<StoryProps> = {
  name: 'Select the page',
  parameters: { scenario: '0188/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Выбор страницы"
      steps={SELECT_PAGE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const counted = (rows: number) =>
      until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(rows),
        ),
      )
    await step(SELECT_PAGE[0]!.title, async () => {
      await stepDone(canvas)
      await expect(isChecked(headCheckbox(canvas))).toBe(false)
    })
    await step(SELECT_PAGE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await counted(PAGE_SIZE)
    })
    await step(SELECT_PAGE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(isChecked(headCheckbox(canvas))).toBe(false))
      await counted(PAGE_SIZE)
    })
    await step(SELECT_PAGE[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await counted(PAGE_SIZE * 2)
      await settle()
    })
  },
}

/** Пользователь нажал флажок шапки, «сервер» держит недостающие строки. */
const pressWaitingHead = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!rowCheckbox(root, 0), signal)
  if (headWaits(root)) return
  server.hold = true
  headCheckbox(root)!.click()
  await pollUntil(() => headWaits(root), signal)
}

const WAITS: readonly GuideStoryStep[] = [
  {
    title: 'Часть страницы загружена',
    hint: 'Страница длиннее блока, остальные строки сервер ещё не присылал.',
    props: pageProps(LONG_PAGE, SHORT_BLOCK),
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!rowCheckbox(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь нажал флажок',
    hint: 'Незагруженные строки выбрать нельзя, поэтому таблица запросила их. Флажок ждёт, выбор пока не изменился.',
    enter: stepAction(async (root, { signal }) => {
      await pressWaitingHead(root, signal)
    }),
  },
  {
    title: 'Строки пришли',
    hint: 'Сервер ответил, выбрана вся страница, и счётчик это показывает.',
    enter: stepAction(async (root, { signal }) => {
      await pressWaitingHead(root, signal)
      server.hold = false
      release()
      await pollUntil(() => isChecked(headCheckbox(root)), signal)
    }),
  },
]

/** ADR 0188, S2: страница ещё грузится — флажок ждёт, строки выбираются после ответа. */
export const ServerPageSelectAllWaits: StoryObj<StoryProps> = {
  name: 'Page still loading',
  parameters: { scenario: '0188/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Страница ещё грузится"
      steps={WAITS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(WAITS[0]!.title, async () => {
      await stepDone(canvas)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(WAITS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(headWaits(canvas)).toBe(true)
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(WAITS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(LONG_PAGE),
        ),
      )
      await settle()
    })
  },
}

const failureBanner = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')

/** Флажок ждал, «сервер» отказал в блоке страницы. */
const refusePage = async (root: HTMLElement, signal: AbortSignal) => {
  if (failureBanner(root)) return
  await pressWaitingHead(root, signal)
  server.hold = false
  release()
  await pollUntil(() => !!failureBanner(root), signal)
}

const PAGE_REFUSED: readonly GuideStoryStep[] = [
  {
    title: 'Часть страницы загружена',
    hint: 'Остальные строки сервер ещё не присылал.',
    props: pageProps(LONG_PAGE, SHORT_BLOCK, FAILED_BLOCK),
    enter: stepAction(async (root, { signal }) => {
      server.failed.delete(FAILED_BLOCK)
      await pollUntil(() => !!rowCheckbox(root, 0), signal)
    }),
  },
  {
    title: 'Пользователь нажал флажок',
    hint: 'Таблица запросила недостающие строки, флажок ждёт.',
    enter: stepAction(async (root, { signal }) => {
      await pressWaitingHead(root, signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Выбор остался прежним, плашка называет причину и предлагает повторить.',
    enter: stepAction(async (root, { signal }) => {
      await refusePage(root, signal)
    }),
  },
  {
    title: 'Пользователь повторил',
    hint: 'Строки пришли, выбрана вся страница.',
    enter: stepAction(async (root, { signal }) => {
      await refusePage(root, signal)
      root
        .querySelector<HTMLElement>('[data-testid="load-error-retry"]')!
        .click()
      await pollUntil(() => isChecked(headCheckbox(root)), signal)
    }),
  },
]

/** ADR 0188, S3: сервер отказал в строках страницы, выбор прежний. */
export const ServerPageSelectAllRefused: StoryObj<StoryProps> = {
  name: 'Page refused',
  parameters: { scenario: '0188/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ в строках страницы"
      steps={PAGE_REFUSED}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(PAGE_REFUSED[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(PAGE_REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(headWaits(canvas)).toBe(true)
    })
    await step(PAGE_REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(failureBanner(canvas)).not.toBeNull()
      await expect(selectedCount(canvas)).toBe('')
    })
    await step(PAGE_REFUSED[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(selectedCount(canvas)).toBe(
          rowSelectionLabels(labels).selectedRows(LONG_PAGE),
        ),
      )
      await settle()
    })
  },
}
