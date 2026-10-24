import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { useArgs } from 'storybook/preview-api'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  RowExpandingLazyChildrenDemo,
  RowExpandingLazyDemo,
  type ServerFailMode,
} from './demos/sessionDemos'
import { expect, userEvent } from 'storybook/test'
import { vrStates } from './__mocks__/catalog'
import {
  bodyRow,
  consoleText,
  guideNext,
  rowAt,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { untilDone } from './__mocks__/cellGestures'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/** Раскрытие строк (ADR 0015, ADR 0054, ADR 0058): дерево, линии, плоские данные, ленивые дети. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Expanding',
} satisfies Meta<StoryProps>

export default meta

// Дерево в 4 уровня для линий дерева: по уровню на шаг отступа.
const treeLinesData = makeData({
  shape: 'tree',
  count: 6,
  depth: 4,
  breadth: 2,
})

// Данные для истории Rows/Expanding — Playground (генератор, а не захардкоженные строки).
// Дерево из 3 уровней: корни (depth 0) и их дети (depth 1) — узлы `isGroup`, у
// внуков (depth 2) детей нет. Три уровня специально: при `maxExpandingDepth = 1`
// раскрывать можно только корни, а группы глубже (depth 1) тоггла не получают
// (RE8). Плюс несколько плоских листовых корней (без subRows) — раскрываемости у
// них нет, тоггла нет (RE7).
const rowExpandingData = [
  ...makeData({ shape: 'tree', count: 3, depth: 3, breadth: 2 }),
  ...makeData({ shape: 'flat', count: 2 }),
]

/** Аргументы демо-историй: задержка и отказ «сервера», предустановки на лету. */
interface SessionsArgs extends StoryProps {
  serverDelayMs?: number
  serverFailMode?: ServerFailMode
  conflictMode?: 'commit' | 'block'
  loadDelayMs?: number
  loadFailMode?: ServerFailMode
  /** ADR 0039: предел мультисортировки на лету. */
  multiSortMax?: number
  /** ADR 0039: разрешить правку на лету. */
  allowEditing?: boolean
  /** ADR 0039: набор размеров страницы на лету. */
  pageSizesPreset?: 'default' | 'small' | 'hidden'
}

const GRID = {
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

const failModeControl = {
  control: 'inline-radio',
  options: ['never', 'always'],
} as const

export const RowExpandingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    // Реальные данные из генератора (см. rowExpandingData) — раскрытие видно на
    // настоящих subRows, а не на захардкоженных строках.
    dataOverride: rowExpandingData,
    enableRowExpanding: true,
    // Стартуем свёрнутыми: тесты сами раскрывают строки и сверяют появление
    // детей и контракт data-expanded / aria-expanded.
    initialExpanded: {},

    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  parameters: showControls([
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
  ]),
}

/**
 * Линии дерева (ADR 0102): ветки со скруглёнными поворотами, как в ветках комментариев,
 * в отступе первой колонки. Дерево в 4 уровня раскрыто целиком; выключите `enableTreeLines`,
 * чтобы сравнить с одним отступом.
 */
export const RowExpandingTreeLines: StoryObj<StoryProps> = {
  name: 'Tree lines',
  args: {
    dataOverride: treeLinesData,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 4,
    enableTreeLines: true,
    initialExpanded: true,
    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  parameters: {
    ...vrStates('body.treeLines'),
    ...showControls([
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
    ]),
  },
}

/**
 * Раскрытие на плоских данных: раскрывать нечего — колонки раскрытия нет (ADR 0050).
 * Включите `rowExpandingColumn: 'always'`, чтобы держать колонку (серверный режим).
 */
export const RowExpandingFlatData: StoryObj<StoryProps> = {
  name: 'Flat data',
  args: {
    dataOverride: makeData({ shape: 'flat', count: 12 }),
    enableRowExpanding: true,
    enableRowSelection: true,
  },
  parameters: showControls([
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
  ]),
}

/** Колонка раскрытия в режиме `'always'`: есть и без раскрываемых строк (ADR 0050). */
export const RowExpandingColumnAlways: StoryObj<StoryProps> = {
  name: 'Column always',
  args: {
    dataOverride: makeData({ shape: 'flat', count: 12 }),
    enableRowExpanding: true,
    rowExpandingColumn: 'always',
  },
  parameters: showControls([
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'rowExpandingColumn',
    'enableTreeLines',
  ]),
}

export const RowExpandingLazy: StoryObj<SessionsArgs> = {
  name: 'Lazy load (async)',
  args: {
    ...GRID,
    // Раскрытие с промисом (ADR 0041): строка раскрывается сразу, кнопка и строка
    // ждут «подгрузки» (aria-busy), повторное нажатие игнорируется; отказ
    // сворачивает строку обратно. Потомки уже в данных — задержка имитирует сеть.
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 1200,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  // Дымовой сценарий (ADR 0042, DS4): раскрытие ждёт подгрузки, затем строка раскрыта.
  parameters: {
    requirements: ['DS4'],
    ...showControls(
      [
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'enableTreeLines',
        'loadDelayMs',
        'loadFailMode',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const row = () => rowAt(canvasElement, 0)
    await userEvent.click(row().querySelector('.row-expand-button')!)
    await until(() => expect(row()).toHaveAttribute('aria-busy', 'true'))
    await until(() => expect(row()).not.toHaveAttribute('aria-busy'))
    expect(row()).toHaveAttribute('data-expanded', 'true')
    expect(consoleText()).toContain('onExpandRow')
    expect(consoleText()).toContain('loaded')
    await settle()
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyDemo {...normalizeArgs(args)} updateArgs={updateArgs} />
    )
  },
}

/**
 * Ленивые дети (ADR 0054): у корней нет `subRows`, `hasChildren` читает `childCount`,
 * `loadChildren` на каждое раскрытие получает детей с «сервера». Повторное раскрытие
 * сразу показывает прошлый ответ и обновляет его; `node-3` сервер вернёт пустым — строка
 * станет листом; «Fail next load» и `loadFailMode` — вспышка тоггла и объявление.
 * Новые дети ответа подсвечены и объявлены (ADR 0056).
 */
export const RowExpandingLazyChildren: StoryObj<SessionsArgs> = {
  name: 'Lazy children (server)',
  args: {
    ...GRID,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 2,
    loadDelayMs: 900,
    loadFailMode: 'never',
  },
  argTypes: {
    loadDelayMs: { control: { type: 'range', min: 0, max: 5000, step: 250 } },
    loadFailMode: failModeControl,
  },
  // Сценарий истории (ADR 0054, RE40): приход детей, обновление при повторном
  // раскрытии, пустой ответ делает строку листом, отказ — вспышка тоггла; всё в журнале.
  parameters: {
    requirements: ['RE40'],
    ...showControls(
      [
        'enableRowExpanding',
        'rowExpandingMaxDepth',
        'rowExpandingColumn',
        'enableTreeLines',
        'loadDelayMs',
        'loadFailMode',
      ],
      { dataCount: 'данные подаёт демо' },
    ),
  },
  play: async ({ canvasElement }) => {
    const log = () => canvasElement.ownerDocument.body.textContent ?? ''
    const row = (id: string) => bodyRow(canvasElement, id)
    const toggle = (id: string) =>
      row(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
    await until(() => expect(row('node-0')).not.toBeNull())

    await userEvent.click(toggle('node-0')!)
    await until(() => expect(row('node-0-0')).not.toBeNull())
    await until(() => expect(log()).toContain('children of node-0: 3'))
    await userEvent.click(toggle('node-0')!)
    await userEvent.click(toggle('node-0')!)
    expect(row('node-0-0')).not.toBeNull()
    await until(() =>
      expect(log().split('loadChildren').length - 1).toBeGreaterThanOrEqual(2),
    )

    await userEvent.click(toggle('node-3')!)
    await until(() => expect(toggle('node-3')).toBeNull())
    await until(() => expect(log()).toContain('children of node-3: 0'))

    await userEvent.click(
      [...canvasElement.ownerDocument.querySelectorAll('button')].find(
        button => button.textContent === 'Fail next load',
      )!,
    )
    await userEvent.click(toggle('node-1')!)
    await until(() =>
      expect(
        toggle('node-1')!.querySelector('[data-failure-indicator]'),
      ).not.toBeNull(),
    )
    await until(() =>
      expect(log()).toContain('children of node-1 failed to load'),
    )
    await settle()
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()
    return (
      <RowExpandingLazyChildrenDemo
        {...normalizeArgs(args)}
        updateArgs={updateArgs}
      />
    )
  },
}

// --- ADR 0134 S3 ---------------------------------------------------------------------

/** «Сервер» раскрытия: держит ответ, пока шаг ожидания на виду, затем отказывает. */
const createExpandServer = () => {
  let held = true
  const waiting = new Set<(reason: Error) => void>()
  const refusal = () => new Error('The server refused')
  return {
    hold: () => {
      held = true
    },
    refuse: () => {
      held = false
      waiting.forEach(reject => reject(refusal()))
      waiting.clear()
    },
    onExpandRow: (_row: unknown, expanding: boolean) =>
      expanding
        ? new Promise<void>((_, reject) => {
            if (held) waiting.add(reject)
            else reject(refusal())
          })
        : undefined,
  }
}

const EXPAND_SERVER = createExpandServer()

/** Первая строка с кнопкой раскрытия. */
const expandableOf = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')]
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .find(row => row.querySelector('.row-expand-button')) ?? null
const toggleOf = (root: ParentNode) =>
  expandableOf(root)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const expandPending = (root: ParentNode) =>
  expandableOf(root)?.getAttribute('aria-busy') === 'true'

const EXPAND_REJECTED: readonly GuideStoryStep[] = [
  {
    title: 'Раскрытие подтверждает сервер',
    hint: 'Приложение подтверждает каждое раскрытие строки на сервере. Строки с детьми раскрываются кнопкой раскрытия.',
  },
  {
    title: 'Раскрытие ждёт сервера',
    hint: 'Пользователь раскрыл строку. Строка сразу раскрыта, а кнопка раскрытия показывает ожидание ответа сервера.',
    states: ['body.pending'],
    enter: untilDone(expandPending, root => {
      EXPAND_SERVER.hold()
      toggleOf(root)?.click()
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер отклонил раскрытие. Строка свёрнута обратно и коротко вспыхивает тоном ошибки, кнопка раскрытия отмечена отказом.',
    immediate: true,
    enter: untilDone(
      root => expandableOf(root)?.getAttribute('data-flash') === 'reverted',
      root => {
        if (expandPending(root)) EXPAND_SERVER.refuse()
        else {
          EXPAND_SERVER.hold()
          toggleOf(root)?.click()
        }
      },
    ),
  },
]

/** ADR 0134, S3: раскрытие с промисом отклонено — строка свёрнута обратно и вспыхивает. */
export const ExpandingRejected: StoryObj<StoryProps> = {
  name: 'Expand refused by the server',
  parameters: { scenario: '0134/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ в раскрытии"
      steps={EXPAND_REJECTED}
      args={guideArgs(
        {
          enableRowExpanding: true,
          dataNesting: 'nested',
          columnCount: 6,
          dataCount: 20,
          containerHeight: '560',
          height: '460',
          maxHeight: '460',
          onExpandRow: EXPAND_SERVER.onExpandRow as never,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EXPAND_REJECTED[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggleOf(canvas)).not.toBeNull())
      expect(expandableOf(canvas)).not.toHaveAttribute('data-expanded', 'true')
    })
    await step(EXPAND_REJECTED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(expandPending(canvas)).toBe(true))
      expect(expandableOf(canvas)).toHaveAttribute('data-expanded', 'true')
      expect(toggleOf(canvas)).toHaveAttribute('aria-busy', 'true')
    })
    await step(EXPAND_REJECTED[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(expandableOf(canvas)).toHaveAttribute('data-flash', 'reverted'),
      )
      expect(expandableOf(canvas)).not.toHaveAttribute('data-expanded', 'true')
      expect(
        toggleOf(canvas)!.querySelector('[data-failure-indicator]'),
      ).not.toBeNull()
      await settle()
    })
  },
}
