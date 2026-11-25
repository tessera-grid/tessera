import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { Row } from '../types'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  bodyRow,
  consoleText,
  guideNext,
  pointAt,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { makeData } from './__mocks__/data'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { rowExpandingLabels } from '../plugins/rowExpanding/labels'

/**
 * Раскрытие строк (ADR 0015): `Playground` — дерево, глубина и колонка раскрытия;
 * S2 ADR 0041 — раскрытие ждёт сервера, S1 ADR 0054 — ленивые дети, S3 ADR 0134 —
 * отказ в раскрытии, S2 ADR 0160 — «раскрыть всё» кнопкой в шапке.
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
    'rowExpandingExpandAll',
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

const CONFIRMED: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Раскрытие подтверждает сервер',
      en: 'The server confirms expanding',
    },
    hint: {
      ru: 'Приложение подтверждает каждое раскрытие на сервере. Строки с детьми раскрываются кнопкой раскрытия.',
      en: 'The app confirms every expand on the server. Rows with child rows expand with the expand button.',
    },
  },
  {
    title: {
      ru: 'Раскрытие ждёт сервера',
      en: 'Expanding waits for the server',
    },
    hint: {
      ru: 'Пользователь раскрыл строку. Строка сразу раскрыта, а пока сервер не ответил, ячейки строки чуть темнеют и по ним проходит светлый блик.',
      en: 'The user expanded a row. The row is expanded right away, and until the server responds, its cells darken slightly and a light shimmer runs across them.',
    },
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
    title: { ru: 'Сервер подтвердил', en: 'The server confirmed' },
    hint: {
      ru: 'Сервер ответил. Ожидание со строки снято, строка остаётся раскрытой.',
      en: 'The server responded. The row is no longer waiting and stays expanded.',
    },
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
    <DemoStory
      title={{
        ru: 'Раскрытие ждёт сервера',
        en: 'Expanding waits for the server',
      }}
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
    await step(CONFIRMED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggleIn(confirmRow(canvas))).not.toBeNull())
      await until(() => expect(isExpanded(confirmRow(canvas))).toBe(false))
    })
    await step(CONFIRMED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(isPending(confirmRow(canvas))).toBe(true))
      await until(() => expect(isExpanded(confirmRow(canvas))).toBe(true))
      // Ожидание — волной на строке, на кнопке раскрытия дуги нет (ADR 0177, §1).
      await until(() =>
        expect(
          confirmRow(canvas)!.querySelector('[data-pending-wave]'),
        ).not.toBeNull(),
      )
      await until(() =>
        expect(toggleIn(confirmRow(canvas))).not.toHaveAttribute('aria-busy'),
      )
    })
    await step(CONFIRMED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(isPending(confirmRow(canvas))).toBe(false))
      await until(() => expect(isExpanded(confirmRow(canvas))).toBe(true))
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
  const waiting = new Map<string, () => void>()
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
    /** Ответить на запрос одной строки; прочие ответы по-прежнему держатся. */
    answer: (id: string) => {
      waiting.get(id)?.()
      waiting.delete(id)
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
        if (held) waiting.set(row.id, answer)
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
/** Отказ раскрытия — вспышка отката на строке, отметки на кнопке нет (ADR 0177, §2). */
const failedShown = (root: HTMLElement) => {
  const row = rowOf(root, CHILDREN.failed)
  return (
    row?.getAttribute('data-flash') === 'reverted' &&
    !toggleIn(row)?.querySelector('[data-failure-indicator]')
  )
}

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

const LAZY_CHILDREN: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Дети на сервере', en: 'Child rows on the server' },
    hint: {
      ru: 'У строк есть дети, но в данных их ещё нет. У таких строк — кнопка раскрытия.',
      en: 'The rows have child rows, but they are not in the data yet. Such rows have an expand button.',
    },
  },
  {
    title: { ru: 'Дети загружаются', en: 'Child rows are loading' },
    hint: {
      ru: 'Пользователь раскрыл строку. Кнопка раскрытия показывает ожидание ответа сервера, под строкой — скелет будущих детей.',
      en: 'The user expanded a row. The expand button shows it is waiting for the server, and a skeleton of the future child rows appears under the row.',
    },
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
    title: { ru: 'Дети пришли', en: 'Child rows arrived' },
    hint: {
      ru: 'Сервер вернул детей. Они встали под строкой и коротко подсвечены как новые.',
      en: 'The server returned the child rows. They appeared under the row and are briefly highlighted as new.',
    },
    immediate: true,
    enter: untilDone(childrenArrived, bringChildren),
  },
  {
    title: { ru: 'Детей нет', en: 'No child rows' },
    hint: {
      ru: 'Пользователь раскрыл другую строку, и сервер вернул пустой ответ. Строка стала обычной, кнопки раскрытия у неё нет.',
      en: 'The user expanded another row, and the server returned an empty response. The row became a regular one with no expand button.',
    },
    enter: untilDone(
      root => childrenArrived(root) && emptyIsLeaf(root),
      root => {
        bringChildren(root)
        expandRow(root, CHILDREN.empty)
      },
    ),
  },
  {
    title: { ru: 'Загрузка не удалась', en: 'Loading failed' },
    hint: {
      ru: 'Сервер не ответил на раскрытие третьей строки. Строка свёрнута и коротко вспыхнула тоном ошибки.',
      en: 'The server did not respond to expanding the third row. The row is collapsed, and it briefly flashed in the error tone.',
    },
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
    <DemoStory
      title={{ ru: 'Дети с сервера', en: 'Child rows from the server' }}
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
    await step(LAZY_CHILDREN[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(toggleIn(rowOf(canvas, CHILDREN.first))).not.toBeNull(),
      )
      await expect(hasChildRows(canvas)).toBe(false)
    })
    await step(LAZY_CHILDREN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(isPending(rowOf(canvas, CHILDREN.first))).toBe(true),
      )
      await expect(hasChildRows(canvas)).toBe(false)
      // Скелет будущих детей — сразу под строкой (ADR 0155, §3).
      await until(() =>
        expect(
          canvas.querySelector(
            `[data-pending-row][data-index="${Number(rowOf(canvas, CHILDREN.first)?.dataset.index) + 1}"]`,
          ),
        ).not.toBeNull(),
      )
    })
    await step(LAZY_CHILDREN[2]!.title.ru, async () => {
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
    await step(LAZY_CHILDREN[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(emptyIsLeaf(canvas)).toBe(true))
    })
    await step(LAZY_CHILDREN[4]!.title.ru, async () => {
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

const EXPAND_REJECTED: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Раскрытие подтверждает сервер',
      en: 'The server confirms expanding',
    },
    hint: {
      ru: 'Приложение подтверждает каждое раскрытие строки на сервере. Строки с детьми раскрываются кнопкой раскрытия.',
      en: 'The app confirms every row expand on the server. Rows with child rows expand with the expand button.',
    },
  },
  {
    title: {
      ru: 'Раскрытие ждёт сервера',
      en: 'Expanding waits for the server',
    },
    hint: {
      ru: 'Пользователь раскрыл строку. Строка сразу раскрыта, а пока сервер не ответил, ячейки строки чуть темнеют и по ним проходит светлый блик.',
      en: 'The user expanded a row. The row is expanded right away, and until the server responds, its cells darken slightly and a light shimmer runs across them.',
    },
    states: ['body.pending'],
    enter: untilDone(expandPending, root => {
      EXPAND_SERVER.hold()
      toggleOf(root)?.click()
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер отклонил раскрытие. Строка свёрнута обратно и коротко вспыхивает тоном ошибки.',
      en: 'The server rejected the expand. The row is collapsed again and briefly flashes in the error tone.',
    },
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
    <DemoStory
      title={{ ru: 'Отказ в раскрытии', en: 'Expand refused' }}
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
    await step(EXPAND_REJECTED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(toggleOf(canvas)).not.toBeNull())
      expect(expandableOf(canvas)).not.toHaveAttribute('data-expanded', 'true')
    })
    await step(EXPAND_REJECTED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(expandPending(canvas)).toBe(true))
      expect(expandableOf(canvas)).toHaveAttribute('data-expanded', 'true')
      expect(
        expandableOf(canvas)!.querySelector('[data-pending-wave]'),
      ).not.toBeNull()
      expect(toggleOf(canvas)).not.toHaveAttribute('aria-busy')
    })
    await step(EXPAND_REJECTED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(expandableOf(canvas)).toHaveAttribute('data-flash', 'reverted'),
      )
      expect(expandableOf(canvas)).not.toHaveAttribute('data-expanded', 'true')
      expect(
        toggleOf(canvas)!.querySelector('[data-failure-indicator]'),
      ).toBeNull()
      await settle()
    })
  },
}

// --- ADR 0153 S9 ---------------------------------------------------------------------

/** Дети с сервера, которые не приходят, пока раскрытие не отменят; запрос учитывает `signal`. */
const heldChildren = (_row: Row<any, any>, context?: { signal: AbortSignal }) =>
  new Promise<never>((_resolve, reject) => {
    context?.signal.addEventListener(
      'abort',
      () => reject(context.signal.reason),
      { once: true },
    )
  })

const CANCEL_TOGGLE = `.data-grid__body-row[data-row-id="${CHILDREN.first}"] .row-expand-button`
const cancelToggle = (root: HTMLElement) =>
  toggleIn(rowOf(root, CHILDREN.first))
const childrenWait = (root: HTMLElement) =>
  cancelToggle(root)?.getAttribute('aria-busy') === 'true'
const toggleArmed = (root: HTMLElement) =>
  !!cancelToggle(root)?.hasAttribute('data-cancel-armed')
const firstExpanded = (root: HTMLElement) =>
  rowOf(root, CHILDREN.first)?.getAttribute('data-expanded') === 'true'

/** Раскрытие первой строки ждёт детей: нажатие, если ещё не ждёт. */
const expandHeld = (root: HTMLElement) => {
  if (!childrenWait(root)) cancelToggle(root)?.click()
}

let toggleCancelled = false

const CANCEL_EXPAND: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Дети с сервера', en: 'Child rows from the server' },
    hint: {
      ru: 'Дети строки приходят с сервера при раскрытии.',
      en: "A row's child rows come from the server when it expands.",
    },
  },
  {
    title: { ru: 'Дети грузятся', en: 'Child rows are on their way' },
    hint: {
      ru: 'Пользователь раскрыл строку. Кнопка раскрытия показывает ожидание, под строкой — скелет будущих детей.',
      en: 'The user expanded a row. The expand button shows it is waiting, and a skeleton of the future child rows appears under the row.',
    },
    states: ['body.pending'],
    enter: untilDone(childrenWait, expandHeld),
  },
  {
    title: {
      ru: 'Кнопка предлагает отмену',
      en: 'The button offers to cancel',
    },
    hint: {
      ru: 'Пользователь навёл указатель на кнопку раскрытия. Появился знак остановки, подсказка предлагает отменить раскрытие.',
      en: 'The user hovered over the expand button. A stop sign appeared, and a tooltip offers to cancel the expand.',
    },
    states: ['body.pending'],
    pseudo: { hover: CANCEL_TOGGLE },
    enter: stepAction(async (root, { signal, onLeave }) => {
      await pollUntil(() => {
        expandHeld(root)
        return toggleArmed(root)
      }, signal)
      onLeave(pointAt(cancelToggle(root)!))
    }),
  },
  {
    title: { ru: 'Раскрытие отменено', en: 'The expand is canceled' },
    hint: {
      ru: 'Пользователь нажал на кнопку. Строка свернулась обратно, без вспышки и отметки ошибки.',
      en: 'The user pressed the button. The row collapsed back, with no flash and no error mark.',
    },
    enter: (root: HTMLElement) => {
      toggleCancelled = false
      return untilDone(
        root => toggleCancelled && !childrenWait(root) && !firstExpanded(root),
        root => {
          if (toggleCancelled) return
          if (toggleArmed(root)) {
            cancelToggle(root)!.click()
            toggleCancelled = true
          } else expandHeld(root)
        },
      )(root, undefined)
    },
  },
]

/** ADR 0153, S9: ленивые дети грузятся — человек отменяет раскрытие кнопкой раскрытия. */
export const ExpandingCancel: StoryObj<StoryProps> = {
  name: 'Cancel loading children',
  parameters: { scenario: '0153/S9', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отмена раскрытия', en: 'Canceling an expand' }}
      steps={CANCEL_EXPAND}
      args={guideArgs(
        {
          ...GRID,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 2,
          dataOverride: CHILDREN.roots,
          rowExpandingHasChildren: CHILDREN.hasChildren,
          rowExpandingLoadChildren: heldChildren,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(CANCEL_EXPAND[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(cancelToggle(canvas)).not.toBeNull())
      await until(() => expect(firstExpanded(canvas)).toBe(false))
    })
    await step(CANCEL_EXPAND[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(childrenWait(canvas)).toBe(true))
      // Скелет будущих детей — сразу под строкой (ADR 0155, §3).
      await until(() =>
        expect(
          canvas.querySelector(
            `[data-pending-row][data-index="${Number(rowOf(canvas, CHILDREN.first)?.dataset.index) + 1}"]`,
          ),
        ).not.toBeNull(),
      )
    })
    await step(CANCEL_EXPAND[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(toggleArmed(canvas)).toBe(true))
      await until(() =>
        expect(cancelToggle(canvas)).toHaveAttribute(
          'aria-label',
          labels.cancelAction(rowExpandingLabels(labels).expandRow),
        ),
      )
    })
    await step(CANCEL_EXPAND[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(firstExpanded(canvas)).toBe(false))
      await until(() => expect(childrenWait(canvas)).toBe(false))
      await settle()
      await until(() =>
        expect(rowOf(canvas, CHILDREN.first)).not.toHaveAttribute('data-flash'),
      )
      await until(() =>
        expect(
          cancelToggle(canvas)!.querySelector('[data-failure-indicator]'),
        ).toBeNull(),
      )
    })
  },
}

// --- ADR 0160 S2: «Раскрыть всё / Свернуть всё» кнопкой в шапке ----------------------

const expandAllButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.row-expand-all-button')
/** Раскрыты все строки с детьми, которые видны. */
const allShownExpanded = (root: ParentNode) =>
  rowsInOrder(root)
    .filter(row => toggleIn(row))
    .every(row => isExpanded(row))
const noneExpanded = (root: ParentNode) =>
  rowsInOrder(root).every(row => !isExpanded(row))

const EXPAND_ALL_ARGS = {
  ...GRID,
  dataOverride: rowExpandingData,
  enableRowExpanding: true,
  rowExpandingMaxDepth: 3,
  initialExpanded: {},
} satisfies Partial<StoryProps>

const EXPAND_ALL: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Дерево свёрнуто', en: 'The tree is collapsed' },
    hint: {
      ru: 'Строки с детьми свёрнуты. В шапке колонки с кнопками раскрытия — кнопка, которая раскрывает все строки сразу.',
      en: 'Rows with child rows are collapsed. The header of the column with the expand buttons has a button that expands all rows at once.',
    },
  },
  {
    title: {
      ru: 'Пользователь раскрыл всё',
      en: 'The user expanded everything',
    },
    hint: {
      ru: 'Раскрыты все строки с детьми на всех уровнях. Кнопка в шапке теперь сворачивает всё — её имя и подсказка сменились.',
      en: 'All rows with child rows are expanded at every level. The header button now collapses everything, and its name and tooltip changed.',
    },
    enter: untilDone(
      root => allShownExpanded(root) && rowsInOrder(root).length > 10,
      root => {
        if (noneExpanded(root)) expandAllButton(root)?.click()
      },
    ),
  },
  {
    title: {
      ru: 'Пользователь свернул всё',
      en: 'The user collapsed everything',
    },
    hint: {
      ru: 'Все строки свёрнуты разом, видны только корни. Кнопка в шапке снова раскрывает всё.',
      en: 'All rows collapsed at once, and only the root rows are visible. The header button expands everything again.',
    },
    enter: untilDone(noneExpanded, root => {
      if (!noneExpanded(root)) expandAllButton(root)?.click()
    }),
  },
]

/** ADR 0160, S2: пользователь раскрывает и сворачивает всё дерево кнопкой в шапке. */
export const ExpandingExpandAll: StoryObj<StoryProps> = {
  name: 'Expand all',
  parameters: { scenario: '0160/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Раскрыть всё', en: 'Expand all' }}
      steps={EXPAND_ALL}
      args={guideArgs(EXPAND_ALL_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(EXPAND_ALL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(expandAllButton(canvas)).not.toBeNull())
      await until(() => expect(noneExpanded(canvas)).toBe(true))
      await until(() =>
        expect(expandAllButton(canvas)).toHaveAccessibleName(
          rowExpandingLabels(labels).expandAll,
        ),
      )
    })
    await step(EXPAND_ALL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          allShownExpanded(canvas) && rowsInOrder(canvas).length > 10,
        ).toBe(true),
      )
      await until(() =>
        expect(expandAllButton(canvas)).toHaveAccessibleName(
          rowExpandingLabels(labels).collapseAll,
        ),
      )
    })
    await step(EXPAND_ALL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(noneExpanded(canvas)).toBe(true))
      await until(() =>
        expect(expandAllButton(canvas)).toHaveAccessibleName(
          rowExpandingLabels(labels).expandAll,
        ),
      )
      await settle()
    })
  },
}

// --- ADR 0054 S2 ---------------------------------------------------------------------

/** «Сервер» держит ответы, пока шаг не отпустит: строки открываются в ожидании. */
const RESTORED = (() => {
  const server = createChildrenServer()
  server.hold()
  return server
})()

/** Кнопка раскрытия вышла из ожидания: цвет занятой кнопки и дуга угасли. */
const toggleSettled = (root: HTMLElement, id: string) => {
  const toggle = rowOf(root, id)?.querySelector('.row-expand-button')
  return (
    !!toggle &&
    toggle.getAttribute('aria-busy') !== 'true' &&
    !toggle.hasAttribute('data-pending-leaving') &&
    toggle.getAnimations().length === 0
  )
}
const restoredChildren = (root: HTMLElement) =>
  rowsInOrder(root).some(row =>
    row.dataset.rowId?.startsWith(`${RESTORED.first}-`),
  ) && toggleSettled(root, RESTORED.first)
/** Отказ — строка свернулась и больше не ждёт. */
const restoredRefused = (root: HTMLElement) => {
  const row = rowOf(root, RESTORED.failed)
  return (
    !!row &&
    !isPending(row) &&
    !isExpanded(row) &&
    toggleSettled(root, RESTORED.failed)
  )
}

const LAZY_RESTORED: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Таблица открылась с раскрытыми строками',
      en: 'The table opened with expanded rows',
    },
    hint: {
      ru: 'Приложение вернуло раскрытие, сохранённое в прошлый раз. Детей этих строк в данных нет, и таблица сама запросила их у сервера: кнопки раскрытия заняты, под строками стоят скелеты.',
      en: "The app restored the expanded rows saved last time. These rows' child rows are not in the data, so the table requested them from the server itself: the expand buttons are busy, and skeletons sit under the rows.",
    },
    states: ['body.pending'],
    remount: true,
  },
  {
    title: { ru: 'Дети пришли', en: 'Child rows arrived' },
    hint: {
      ru: 'Сервер вернул детей первой строки. Они встали под строкой и коротко вспыхнули.',
      en: "The server returned the first row's child rows. They appeared under the row and flashed briefly.",
    },
    enter: untilDone(restoredChildren, () => RESTORED.answer(RESTORED.first)),
  },
  {
    title: { ru: 'Загрузка не удалась', en: 'Loading failed' },
    hint: {
      ru: 'Сервер не ответил на запрос другой строки. Она свернулась и коротко вспыхнула; повторить запрос можно кнопкой раскрытия.',
      en: 'The server did not respond to the request for another row. It collapsed and flashed briefly; the request can be retried with the expand button.',
    },
    enter: untilDone(
      root => restoredChildren(root) && restoredRefused(root),
      () => {
        RESTORED.answer(RESTORED.first)
        RESTORED.answer(RESTORED.failed)
      },
    ),
  },
]

/** ADR 0054, S2: приложение открывает таблицу с раскрытыми строками — дети приходят сами. */
export const ExpandingLazyRestored: StoryObj<StoryProps> = {
  name: 'Expanded on open',
  parameters: {
    scenario: '0054/S2',
    ...guideControls(),
  },
  render: args => (
    <DemoStory
      title={{
        ru: 'Раскрытые строки при открытии',
        en: 'Expanded rows on open',
      }}
      steps={LAZY_RESTORED}
      args={guideArgs(
        {
          ...GRID,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 2,
          dataOverride: RESTORED.roots,
          rowExpandingHasChildren: RESTORED.hasChildren,
          rowExpandingLoadChildren: RESTORED.loadChildren,
          initialExpanded: { [RESTORED.first]: true, [RESTORED.failed]: true },
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LAZY_RESTORED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(isPending(rowOf(canvas, RESTORED.first))).toBe(true),
      )
      await until(() =>
        expect(isPending(rowOf(canvas, RESTORED.failed))).toBe(true),
      )
    })
    await step(LAZY_RESTORED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(restoredChildren(canvas)).toBe(true))
    })
    await step(LAZY_RESTORED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(restoredRefused(canvas)).toBe(true))
      await expect(isExpanded(rowOf(canvas, RESTORED.failed))).toBe(false)
    })
  },
}
