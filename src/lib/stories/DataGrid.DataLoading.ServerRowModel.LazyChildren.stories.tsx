import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { ServerRowsRequest, ServerRowsResponse } from '../plugins'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  type FilteringItem,
  filteringColumns,
  filteringItemAt,
} from './__mocks__/filteringData'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { serverAnswer } from './demos/serverRowModelDemos'
import { StoryComponent } from './DataGridStory'
import {
  layout,
  bodyRows,
  skeletonRows,
  hasRow,
  SERVER_DELAY_MS,
  server,
  release,
  serverReset,
  TREE_CHILDREN,
  TREE_TOTAL,
  treeProps,
} from './__mocks__/serverRowModelGuide'

/**
 * Вложенные строки с сервера (ADR 0138, S7): `Playground` — тысяча строк, у каждой — вложенные
 * записи на «сервере», размер блока и память блоков — контролами; S7 — раскрытие строки;
 * S4 ADR 0160 — липкие ветки.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Lazy children',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface LazyChildrenPlaygroundArgs extends StoryProps {
  blockSize: number
  maxBlocks: number
}

export const ServerLazyChildrenPlayground: StoryObj<LazyChildrenPlaygroundArgs> =
  {
    name: 'Playground',
    parameters: showControls(['blockSize', 'maxBlocks'], {
      dataCount: 'строки подаёт «сервер» демо',
      columnCount: 'колонки задаёт демо',
    }),
    // Строки свёрнуты: вложенные записи «сервер» отдаёт при раскрытии.
    args: { ...layout, blockSize: 50, maxBlocks: 100 },
    argTypes: {
      blockSize: {
        description:
          'Строк в одном запросе к серверу — и для корней, и для ветки',
        control: { type: 'range', min: 10, max: 500, step: 10 },
      },
      maxBlocks: {
        description:
          'Сколько блоков таблица держит в памяти; свёрнутые ветки уходят первыми',
        control: { type: 'range', min: 2, max: 200, step: 1 },
      },
    },
    render: ({ blockSize, maxBlocks, ...args }) => (
      <StoryComponent
        {...normalizeArgs(args)}
        {...treeProps!(AT_REST)}
        serverRowModelBlockSize={blockSize}
        serverRowModelMaxBlocks={maxBlocks}
      />
    ),
    // Снимок — в покое: первое окно пришло.
    play: async ({ canvasElement: canvas, globals }) => {
      if (globals.catalog !== true) return
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await settle()
    },
  }

// --- ADR 0138 S7 ---------------------------------------------------------------------

const TREE_PARENT = 'item-id-1'

const toggleOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"] .row-expand-button`,
  )
const childShown = (root: HTMLElement) =>
  !!root.querySelector(`.data-grid__body-row[data-row-id="${TREE_PARENT}.0"]`)
const childRequests = () => server.parents.filter(id => id === TREE_PARENT)

/** Пользователь раскрыл строку, «сервер» держит ответ с вложенными строками. */
const expandParent = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!toggleOf(root, TREE_PARENT), signal)
  server.hold = true
  if (toggleOf(root, TREE_PARENT)!.getAttribute('aria-expanded') !== 'true') {
    toggleOf(root, TREE_PARENT)!.click()
  }
  await pollUntil(
    () => server.held.length > 0 && skeletonRows(root) > 0,
    signal,
  )
}

const LAZY_CHILDREN: readonly GuideStoryStep[] = [
  {
    title: 'Строки со вложенными записями',
    hint: 'Сервер отдаёт верхний уровень списка блоками. У строк со вложенными записями — кнопка раскрытия; самих вложенных строк таблица ещё не загружала.',
    props: treeProps,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!toggleOf(root, TREE_PARENT), signal)
    }),
  },
  {
    title: 'Пользователь раскрыл строку',
    hint: 'Таблица попросила у сервера вложенные строки только этой строки. Пока ответ в пути, под ней — блок строк-скелетов.',
    states: ['body.skeleton'],
    enter: stepAction(async (root, { signal }) => {
      if (childShown(root) || server.held.length > 0) return
      await expandParent(root, signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Вложенные строки встали под родителем с отступом уровня. Их столько, сколько сообщил сервер, — строки ниже подтянулись вплотную.',
    enter: stepAction(async (root, { signal }) => {
      if (server.held.length === 0 && !childShown(root)) {
        await expandParent(root, signal)
      }
      server.hold = false
      release()
      await pollUntil(
        () => childShown(root) && skeletonRows(root) === 0,
        signal,
      )
    }),
  },
]

/** ADR 0138, S7: пользователь раскрывает строку, вложенные строки приходят с сервера. */
export const ServerRowModelLazyChildren: StoryObj<StoryProps> = {
  name: 'Lazy children',
  parameters: { scenario: '0138/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вложенные строки с сервера"
      steps={LAZY_CHILDREN}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LAZY_CHILDREN[0]!.title, async () => {
      await stepDone(canvas)
      await expect(childRequests()).toEqual([])
    })
    await step(LAZY_CHILDREN[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(childRequests()).toHaveLength(1)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
      await expect(childShown(canvas)).toBe(false)
    })
    await step(LAZY_CHILDREN[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const rows = bodyRows(canvas)
      const parent = rows.findIndex(row => row.dataset.rowId === TREE_PARENT)
      await expect(
        rows
          .slice(parent + 1, parent + 1 + TREE_CHILDREN)
          .map(row => row.dataset.rowId),
      ).toEqual(
        Array.from({ length: TREE_CHILDREN }, (_, k) => `${TREE_PARENT}.${k}`),
      )
      await expect(rows[parent + 1 + TREE_CHILDREN]?.dataset.rowId).toBe(
        'item-id-2',
      )
      await settle()
    })
  },
}

// --- ADR 0160, S4: липкие ветки дерева SSRM --------------------------------------------

const STICKY_PARENT = 'item-id-0'
const stickyTreeProps: GuideStoryStep['props'] = context => ({
  ...treeProps!(context),
  rowExpandingStickyRows: true,
})
const stickyIds = (root: HTMLElement) =>
  [
    ...root.querySelectorAll<HTMLElement>('[data-sticky-rows] [data-row-id]'),
  ].map(row => row.dataset.rowId)
const branchRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${STICKY_PARENT}"]:not([data-sticky-copy])`,
  )
const branchOpen = (root: HTMLElement) =>
  branchRow(root)?.dataset.expanded === 'true' &&
  !!root.querySelector(`.data-grid__body-row[data-row-id="${STICKY_PARENT}.0"]`)

/** Пользователь раскрыл первую строку, её вложенные строки пришли. */
const openBranch = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!branchRow(root), signal)
  if (branchRow(root)!.dataset.expanded !== 'true') {
    branchRow(root)!.querySelector<HTMLElement>('.row-expand-button')!.click()
  }
  await pollUntil(() => branchOpen(root), signal)
}

const STICKY_BRANCHES: readonly GuideStoryStep[] = [
  {
    title: 'Строка раскрыта',
    hint: 'Сервер отдал вложенные строки первой строки — они под ней с отступом уровня.',
    props: stickyTreeProps,
    enter: stepAction(async (root, { signal }) => {
      server.hold = false
      await openBranch(root, signal)
      root.querySelector<HTMLElement>('.data-grid__container')!.scrollTop = 0
    }),
  },
  {
    title: 'Пользователь прокрутил ветку',
    hint: 'Строка ушла вверх, но держится под шапкой, пока видны её вложенные строки: видно, чья это ветка. Линия отделяет её от строк ниже.',
    enter: stepAction(async (root, { signal }) => {
      await openBranch(root, signal)
      const scroller = root.querySelector<HTMLElement>('.data-grid__container')!
      scroller.scrollTop = branchRow(root)!.offsetHeight * 2
      await pollUntil(() => stickyIds(root).length === 1, signal)
    }),
  },
]

// --- ADR 0161, S1: линии дерева серверной модели ---------------------------------------

const LINES_PARENT = 'item-id-0'
const LINES_BLOCK = 10
/** Вложенных строк у ветки: сервер их число не сообщает, последний блок короче. */
const LINES_CHILDREN = 25

const linesProps: GuideStoryStep['props'] = context => ({
  ...treeProps!(context),
  serverRowModelBlockSize: LINES_BLOCK,
  serverRowModelGetRows: ({
    start,
    end,
    parentId,
    signal,
  }: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<FilteringItem>>(resolve => {
      const answer = () => {
        if (signal.aborted) return
        if (!parentId) {
          resolve(serverAnswer({ start, end }, TREE_TOTAL, true))
          return
        }
        // Итога нет: размер ветки таблица узнаёт по короткому блоку.
        const first = TREE_TOTAL + Number(parentId.split('-').at(-1)) * 100
        resolve({
          rows: Array.from(
            { length: Math.max(0, Math.min(end, LINES_CHILDREN) - start) },
            (_, k) => ({
              ...filteringItemAt(first + start + k),
              id: `${parentId}.${start + k}`,
            }),
          ),
        })
      }
      // Первый блок ветки — сразу, следующие держит шаг гайда.
      if (parentId && start > 0 && server.hold) server.held.push(answer)
      else setTimeout(answer, SERVER_DELAY_MS)
    }),
})
const childRow = (root: HTMLElement, k: number) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${LINES_PARENT}.${k}"]`,
  )
/** У строки линия поворачивает и кончается: она последняя в ветке. */
const endsBranch = (row: HTMLElement | null) =>
  !!row?.querySelector(
    '[data-tree-depth] [aria-hidden] > [data-tree-elbow="plain"]',
  )
const linesScroller = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__container')!
/** Вложенная строка `k` — в середине области: видно и её, и строки за ней. */
const showChild = (root: HTMLElement, k: number) => {
  const row = childRow(root, k)
  if (!row) return
  const scroller = linesScroller(root)
  scroller.scrollTop = row.offsetTop - scroller.clientHeight / 2
}

/** Ветка раскрыта, первый блок пришёл, следующий держит «сервер». */
const openLines = async (root: HTMLElement, signal: AbortSignal) => {
  server.hold = true
  await pollUntil(() => !!toggleOf(root, LINES_PARENT), signal)
  if (toggleOf(root, LINES_PARENT)!.getAttribute('aria-expanded') !== 'true') {
    toggleOf(root, LINES_PARENT)!.click()
  }
  await pollUntil(
    () => !!childRow(root, LINES_BLOCK - 1) && server.held.length > 0,
    signal,
  )
}

/** Второй блок ветки пришёл, конец его — в середине области; третий держит «сервер». */
const secondBlock = async (root: HTMLElement, signal: AbortSignal) => {
  if (!childRow(root, LINES_BLOCK)) {
    await openLines(root, signal)
    release()
  }
  await pollUntil(() => !!childRow(root, LINES_BLOCK), signal)
  const first = childRow(root, LINES_BLOCK)!
  const scroller = linesScroller(root)
  scroller.scrollTop =
    first.offsetTop +
    first.offsetHeight * LINES_BLOCK -
    scroller.clientHeight / 2
  await pollUntil(() => !!childRow(root, LINES_BLOCK * 2 - 1), signal)
}

const TREE_LINES: readonly GuideStoryStep[] = [
  {
    title: 'Ветка раскрыта',
    hint: 'Пользователь раскрыл строку, и сервер отдал первый блок её вложенных строк, не сообщив, сколько их всего. Линии ведут от строки к вложенным строкам, а у последней пришедшей линия идёт дальше вниз — к строкам-скелетам, которые ещё грузятся.',
    states: ['body.skeleton'],
    props: linesProps,
    enter: stepAction(async (root, { signal }) => {
      linesScroller(root).scrollTop = 0
      await openLines(root, signal)
      showChild(root, LINES_BLOCK - 1)
    }),
  },
  {
    title: 'Пришёл следующий блок',
    hint: 'Сервер ответил на следующий блок. Скелеты сменились строками на тех же местах — линии не сдвинулись и по-прежнему ведут вниз: за этим блоком могут быть ещё строки.',
    enter: stepAction(async (root, { signal }) => {
      await secondBlock(root, signal)
      showChild(root, LINES_BLOCK * 2 - 1)
    }),
  },
  {
    title: 'Ветка кончилась',
    hint: 'Последний блок пришёл короче остальных — строк в ветке больше нет. У последней вложенной строки линия поворачивает и кончается, ниже идёт следующая строка верхнего уровня.',
    enter: stepAction(async (root, { signal }) => {
      if (!childRow(root, LINES_BLOCK * 2 - 1)) await secondBlock(root, signal)
      server.hold = false
      release()
      showChild(root, LINES_BLOCK * 2 - 1)
      await pollUntil(
        () => endsBranch(childRow(root, LINES_CHILDREN - 1)),
        signal,
      )
      showChild(root, LINES_CHILDREN - 1)
    }),
  },
]

/** ADR 0161, S1: линии дерева ведут к вложенным строкам серверной модели блок за блоком. */
export const ServerTreeLines: StoryObj<StoryProps> = {
  name: 'Tree lines',
  parameters: { scenario: '0161/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Линии дерева"
      steps={TREE_LINES}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE_LINES[0]!.title, async () => {
      await stepDone(canvas)
      await expect(endsBranch(childRow(canvas, LINES_BLOCK - 1))).toBe(false)
      await expect(skeletonRows(canvas)).toBeGreaterThan(0)
    })
    await step(TREE_LINES[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(endsBranch(childRow(canvas, LINES_BLOCK * 2 - 1))).toBe(
        false,
      )
    })
    await step(TREE_LINES[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(endsBranch(childRow(canvas, LINES_CHILDREN - 1))).toBe(true)
      await settle()
    })
  },
}

/** ADR 0160, S4: липкая строка ветки дерева серверной модели при прокрутке. */
export const ServerStickyBranches: StoryObj<StoryProps> = {
  name: 'Sticky branches',
  parameters: { scenario: '0160/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Липкие ветки"
      steps={STICKY_BRANCHES}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(STICKY_BRANCHES[0]!.title, async () => {
      await stepDone(canvas)
      await expect(branchOpen(canvas)).toBe(true)
      await expect(stickyIds(canvas)).toEqual([])
    })
    await step(STICKY_BRANCHES[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(stickyIds(canvas)).toEqual([STICKY_PARENT])
      await settle()
    })
  },
}
