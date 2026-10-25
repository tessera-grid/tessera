import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { Row } from '../types'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  bodyRow,
  consoleText,
  guideNext,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { makeData } from './__mocks__/data'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/**
 * Раскрытие строк (ADR 0015): `Playground` — дерево, глубина и колонка раскрытия;
 * S2 ADR 0041 — раскрытие ждёт сервера, S1 ADR 0054 — ленивые дети, S3 ADR 0134 —
 * отказ в раскрытии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Expanding',
} satisfies Meta<StoryProps>

export default meta

// Дерево из 3 уровней: корни и их дети — узлы с детьми, у внуков детей нет, плюс
// плоские листовые корни. При `rowExpandingMaxDepth: 1` раскрываются только корни
// (RE8), у листьев кнопки нет (RE7).
const rowExpandingData = [
  ...makeData({ shape: 'tree', count: 3, depth: 3, breadth: 2 }),
  ...makeData({ shape: 'flat', count: 2 }),
]

const GRID = {
  columnCount: 6,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
} satisfies Partial<StoryProps>

/** Дерево свёрнуто; глубина, колонка раскрытия и линии — контролами. */
export const RowExpandingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args: {
    dataOverride: rowExpandingData,
    enableRowExpanding: true,
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

const rowsInOrder = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__body-row')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )
const toggleIn = (row: Element | null | undefined) =>
  row?.querySelector<HTMLElement>('.row-expand-button') ?? null
const isExpanded = (row: Element | null | undefined) =>
  row?.getAttribute('data-expanded') === 'true'
const isPending = (row: Element | null | undefined) =>
  row?.getAttribute('aria-busy') === 'true'

// --- ADR 0041 S2 ---------------------------------------------------------------------

/** «Сервер» подтверждения: держит ответ, пока шаг ожидания на виду. */
const createConfirmServer = () => {
  let held = true
  const waiting = new Set<() => void>()
  return {
    hold: () => {
      held = true
    },
    release: () => {
      held = false
      waiting.forEach(resolve => resolve())
      waiting.clear()
    },
    onExpandRow: (_row: unknown, expanding: boolean) =>
      expanding
        ? new Promise<void>(resolve => {
            if (held) waiting.add(resolve)
            else resolve()
          })
        : undefined,
  }
}

const CONFIRM_SERVER = createConfirmServer()

/** Первая строка с кнопкой раскрытия. */
const confirmRow = (root: ParentNode) =>
  rowsInOrder(root).find(row => toggleIn(row)) ?? null

const CONFIRMED: readonly GuideStoryStep[] = [
  {
    title: 'Раскрытие подтверждает сервер',
    hint: 'Приложение подтверждает каждое раскрытие на сервере. Строки с детьми раскрываются кнопкой раскрытия.',
  },
  {
    title: 'Раскрытие ждёт сервера',
    hint: 'Пользователь раскрыл строку. Строка сразу раскрыта, а кнопка раскрытия показывает ожидание ответа сервера.',
    states: ['body.pending'],
    enter: untilDone(
      root => isPending(confirmRow(root)),
      root => {
        CONFIRM_SERVER.hold()
        if (!isExpanded(confirmRow(root))) toggleIn(confirmRow(root))?.click()
      },
    ),
  },
  {
    title: 'Сервер подтвердил',
    hint: 'Сервер ответил. Ожидание на кнопке погасло, строка остаётся раскрытой.',
    enter: untilDone(
      root => isExpanded(confirmRow(root)) && !isPending(confirmRow(root)),
      root => {
        CONFIRM_SERVER.release()
        if (!isExpanded(confirmRow(root))) toggleIn(confirmRow(root))?.click()
      },
    ),
  },
]

/** ADR 0041, S2: раскрытие строки ждёт сервера и подтверждается. */
export const ExpandingConfirmed: StoryObj<StoryProps> = {
  name: 'Expand confirmed by the server',
  parameters: {
    scenario: '0041/S2',
    requirements: ['DS4'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Раскрытие ждёт сервера"
      steps={CONFIRMED}
      args={guideArgs(
        {
          ...GRID,
          enableRowExpanding: true,
          dataNesting: 'nested',
          dataCount: 20,
          onExpandRow: CONFIRM_SERVER.onExpandRow as never,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(CONFIRMED[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggleIn(confirmRow(canvas))).not.toBeNull())
      await expect(isExpanded(confirmRow(canvas))).toBe(false)
    })
    await step(CONFIRMED[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isPending(confirmRow(canvas))).toBe(true))
      await expect(isExpanded(confirmRow(canvas))).toBe(true)
      await expect(toggleIn(confirmRow(canvas))).toHaveAttribute(
        'aria-busy',
        'true',
      )
    })
    await step(CONFIRMED[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(isPending(confirmRow(canvas))).toBe(false))
      await expect(isExpanded(confirmRow(canvas))).toBe(true)
      await until(() => expect(consoleText()).toContain('onExpandRow'))
      await settle()
    })
  },
}

// --- ADR 0054 S1 ---------------------------------------------------------------------

type ServerNode = Record<string, unknown> & {
  id: string
  childCount?: number
  subRows?: ServerNode[]
}

/**
 * «Сервер» ленивых детей: полное дерево; клиенту уходят узлы без детей, но с
 * `childCount`. Шаг решает, держать ли ответ, а строки `EMPTY` и `FAILED` отвечают
 * пустым списком и отказом.
 */
const createChildrenServer = () => {
  const children = new Map<string, ServerNode[]>()
  const strip = (nodes: ServerNode[]): ServerNode[] =>
    nodes.map(({ subRows, ...node }) => {
      if (subRows) children.set(node.id, subRows)
      return { ...node, childCount: subRows?.length ?? 0 }
    })
  const roots = strip(
    makeData({
      shape: 'tree',
      count: 12,
      depth: 3,
      breadth: 3,
    }) as ServerNode[],
  )
  let held = false
  const waiting = new Set<() => void>()
  const empty = roots[3]!.id
  const failed = roots[2]!.id
  return {
    roots,
    first: roots[0]!.id,
    empty,
    failed,
    hold: () => {
      held = true
    },
    release: () => {
      held = false
      waiting.forEach(answer => answer())
      waiting.clear()
    },
    hasChildren: (row: Row<any, any>) =>
      ((row.original as ServerNode).childCount ?? 0) > 0,
    loadChildren: (row: Row<any, any>) =>
      new Promise<ServerNode[]>((resolve, reject) => {
        const answer = () => {
          if (row.id === failed) reject(new Error('Server unavailable'))
          else
            resolve(row.id === empty ? [] : strip(children.get(row.id) ?? []))
        }
        if (held) waiting.add(answer)
        else answer()
      }),
  }
}

const CHILDREN = createChildrenServer()

const rowOf = (root: HTMLElement, id: string) => bodyRow(root, id) ?? null
const hasChildRows = (root: HTMLElement) =>
  rowsInOrder(root).some(row =>
    row.dataset.rowId?.startsWith(`${CHILDREN.first}-`),
  )
const failedShown = (root: HTMLElement) =>
  !!toggleIn(rowOf(root, CHILDREN.failed))?.querySelector(
    '[data-failure-indicator]',
  )

/** Пользователь раскрывает строку `id`, если она ещё не раскрыта и не ждёт ответа. */
const expandRow = (root: HTMLElement, id: string) => {
  const row = rowOf(root, id)
  if (row && !isExpanded(row) && !isPending(row)) toggleIn(row)?.click()
}

/** Дети первой строки пришли: раскрыть её, отпустить ответ. */
const childrenArrived = (root: HTMLElement) => hasChildRows(root)
const bringChildren = (root: HTMLElement) => {
  CHILDREN.release()
  expandRow(root, CHILDREN.first)
}
const emptyIsLeaf = (root: HTMLElement) =>
  !!rowOf(root, CHILDREN.empty) && !toggleIn(rowOf(root, CHILDREN.empty))

const LAZY_CHILDREN: readonly GuideStoryStep[] = [
  {
    title: 'Дети на сервере',
    hint: 'У строк есть дети, но в данных их ещё нет. У таких строк — кнопка раскрытия.',
  },
  {
    title: 'Дети загружаются',
    hint: 'Пользователь раскрыл строку. Кнопка раскрытия показывает ожидание ответа сервера.',
    states: ['body.pending'],
    enter: untilDone(
      root => isPending(rowOf(root, CHILDREN.first)),
      root => {
        CHILDREN.hold()
        expandRow(root, CHILDREN.first)
      },
    ),
  },
  {
    title: 'Дети пришли',
    hint: 'Сервер вернул детей. Они встали под строкой и коротко подсвечены как новые.',
    immediate: true,
    enter: untilDone(childrenArrived, bringChildren),
  },
  {
    title: 'Детей нет',
    hint: 'Пользователь раскрыл другую строку, и сервер вернул пустой ответ. Строка стала обычной, кнопки раскрытия у неё нет.',
    enter: untilDone(
      root => childrenArrived(root) && emptyIsLeaf(root),
      root => {
        bringChildren(root)
        expandRow(root, CHILDREN.empty)
      },
    ),
  },
  {
    title: 'Загрузка не удалась',
    hint: 'Сервер не ответил на раскрытие третьей строки. Строка свёрнута, кнопка раскрытия отмечена отказом.',
    immediate: true,
    enter: untilDone(
      root => childrenArrived(root) && emptyIsLeaf(root) && failedShown(root),
      root => {
        bringChildren(root)
        expandRow(root, CHILDREN.empty)
        expandRow(root, CHILDREN.failed)
      },
    ),
  },
]

/** ADR 0054, S1: дети строки приходят с сервера — ожидание, приход, пустой ответ, отказ. */
export const ExpandingLazyChildren: StoryObj<StoryProps> = {
  name: 'Lazy children (server)',
  parameters: {
    scenario: '0054/S1',
    requirements: ['RE40'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Дети с сервера"
      steps={LAZY_CHILDREN}
      args={guideArgs(
        {
          ...GRID,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 2,
          dataOverride: CHILDREN.roots,
          rowExpandingHasChildren: CHILDREN.hasChildren,
          rowExpandingLoadChildren: CHILDREN.loadChildren,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LAZY_CHILDREN[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(toggleIn(rowOf(canvas, CHILDREN.first))).not.toBeNull(),
      )
      await expect(hasChildRows(canvas)).toBe(false)
    })
    await step(LAZY_CHILDREN[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(isPending(rowOf(canvas, CHILDREN.first))).toBe(true),
      )
      await expect(hasChildRows(canvas)).toBe(false)
    })
    await step(LAZY_CHILDREN[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(hasChildRows(canvas)).toBe(true))
      await expect(
        canvas.querySelector('.data-grid__body-row[data-flash="arrived"]'),
      ).not.toBeNull()
      // Ожидание на кнопке раскрытия погасло: матрица снимает итог шага, а не переход.
      await until(() =>
        expect(
          toggleIn(rowOf(canvas, CHILDREN.first))?.querySelector(
            '[data-pending-arc]',
          ),
        ).toBeNull(),
      )
    })
    await step(LAZY_CHILDREN[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(emptyIsLeaf(canvas)).toBe(true))
    })
    await step(LAZY_CHILDREN[4]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(failedShown(canvas)).toBe(true))
      await expect(isExpanded(rowOf(canvas, CHILDREN.failed))).toBe(false)
      await settle()
    })
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
