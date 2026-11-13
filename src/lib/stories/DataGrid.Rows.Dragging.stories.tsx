import { Meta, StoryObj } from '@storybook/react'
import { useMemo } from 'react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import type { RowDragEnd } from '../plugins'
import type { Row } from '../types'
import { expect, waitFor } from 'storybook/test'
import {
  waitForRows,
  type HeldDrag,
  guideNext,
  pollUntil,
  settle,
  sleep,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import {
  DRAG_FILL,
  HANDLE,
  OVERLAY,
  ROW,
  beginDrag,
  firePointer,
  nextFrame,
} from './rowDragging.dnd'
import {
  type HeldRow,
  centerInWindow,
  holdRowAtLevel,
  indentOf,
  layoutStill,
  rowIndent,
  rowOf,
} from './__mocks__/rowDragHold'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/** Перетаскивание строк (ADR 0006). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Dragging',
} satisfies Meta<StoryProps>

export default meta

/**
 * Перетаскивание строк в покое: тяните строку за ручку; таблица выше окна по обеим осям —
 * у края включается автопрокрутка. Перестановку по шагам показывает гайд «Move».
 */
export const RowDraggingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
  ]),
  args: {
    enableRowDragging: true,
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
}

// Группы с детьми и плоские корни: строку есть куда вложить и откуда вынести
// (перестановка — в пределах двух уровней, ADR 0006).
const treeData = [
  ...makeData({ shape: 'flat', count: 2 }),
  ...makeData({ shape: 'tree', count: 4, depth: 2, breadth: 3 }),
]

/**
 * Перетаскивание по дереву с линиями (ADR 0108): слот — скелет строки на уровне броска,
 * линии окна — как после броска. Сдвиньте указатель вправо или влево — уровень слота
 * меняется; на недопустимом уровне облако строки в тоне ошибки.
 */
export const RowDraggingTreeLines: StoryObj<StoryProps> = {
  name: 'Tree lines',
  args: {
    dataOverride: treeData,
    enableRowDragging: true,
    enableRowExpanding: true,
    rowExpandingMaxDepth: 1,
    enableTreeLines: true,
    initialExpanded: true,
    containerHeight: '640',
    height: '540',
    maxHeight: '540',
  },
  parameters: {
    requirements: ['PV9'],
    ...showControls([
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
      'enableRowDragging',
      'rowDraggingExpandDelay',
      'rowDraggingRevertOnReject',
    ]),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = canvasElement
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(`${ROW}[data-row-id="${id}"]`)
    const indentOf = (id: string) =>
      parseFloat(
        getComputedStyle(row(id)!.querySelector('[data-column-id="country"]')!)
          .paddingLeft,
      )
    await waitFor(() => expect(row('node-1-1')).not.toBeNull())

    await step(
      'drag a root row into a group: skeleton slot on the nested level, then drop',
      async () => {
        const levelIndent = indentOf('node-1-0')
        const source = row('row-0')!
        const indentCell = source
          .querySelector('[data-column-id="country"]')!
          .getBoundingClientRect()
        const levelStep =
          indentCell.left - source.getBoundingClientRect().left + levelIndent
        const { hx } = await beginDrag(
          source.querySelector<HTMLElement>(HANDLE)!,
        )
        const target = row('node-1-1')!.getBoundingClientRect()
        const ty = target.top + target.height / 2
        firePointer('pointermove', document, hx + levelStep, ty)
        await nextFrame()
        await nextFrame()
        firePointer('pointermove', document, hx + levelStep, ty + 1)
        await waitFor(() => {
          const slot = canvas.querySelector<HTMLElement>(DRAG_FILL)!
          expect(slot.querySelector('[data-skeleton]')).not.toBeNull()
          expect(
            parseFloat(
              getComputedStyle(
                slot.querySelector('[data-column-id="country"]')!,
              ).paddingLeft,
            ),
          ).toBe(levelIndent)
        })
        firePointer('pointerup', document, hx + levelStep, ty + 1)
        await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
        await waitFor(() => expect(indentOf('row-0')).toBe(levelIndent))
      },
    )
  },
}

// --- ADR 0130, S1: перенос строки мышью ----------------------------------------------

const ROW_MOVE: readonly GuideStoryStep[] = [
  {
    title: 'Ручка строки',
    hint: 'Наведите строку — слева появляется ручка: за неё строку берут, чтобы перенести.',
    states: ['drag.rowHandle'],
    pseudo: { hover: `${ROW}[data-row-id="row-0"]` },
  },
  {
    title: 'Строку взяли за ручку',
    hint: 'Возьмите строку за ручку и ведите над группой. Облако со строкой идёт за указателем, на месте броска — слот-скелет на уровне будущего родителя, линии дерева — как после броска.',
    states: ['drag.row'],
    enter: stepAction((root, run) =>
      holdRowAtLevel(root, 'row-0', 'node-0-0', 1, run),
    ),
  },
  {
    title: 'Группа не вкладывается',
    hint: 'Ведите группу с детьми вправо под последнюю строку другой группы: дерево не глубже двух уровней, поэтому слот остаётся на верхнем уровне. Бросок положит группу туда, где стоит слот.',
    enter: stepAction((root, run) =>
      holdRowAtLevel(root, 'node-0', 'node-1-1', 1, run),
    ),
  },
  {
    title: 'Недопустимое место',
    hint: 'Ведите группу с детьми между строками другой группы: здесь есть место только на уровне детей, а группу внутрь не вкладывают. Строка под указателем в тоне ошибки — бросок здесь не сработает; слот показывает, куда она встала бы.',
    states: ['drag.rowInvalid'],
    enter: stepAction((root, run) =>
      holdRowAtLevel(root, 'node-0', 'node-1', 1, run),
    ),
  },
  {
    title: 'Бросок',
    hint: 'Отпустите строку на допустимом месте: облако пропадает, строка встаёт на место и коротко вспыхивает.',
    states: ['drag.landed'],
    immediate: true,
    enter: stepAction(async (root, run) => {
      const held = await holdRowAtLevel(root, 'row-0', 'node-0-0', 1, run)
      run.signal.throwIfAborted()
      held.release()
    }),
  },
]

// Один плоский корень и группы по два ребёнка: все цели — в верхней части окна грида.
const rowMoveData = [
  ...makeData({ shape: 'flat', count: 1 }),
  ...makeData({ shape: 'tree', count: 3, depth: 2, breadth: 2 }),
]

const ROW_MOVE_ARGS = {
  dataOverride: rowMoveData,
  enableRowDragging: true,
  enableRowExpanding: true,
  rowExpandingMaxDepth: 1,
  enableTreeLines: true,
  initialExpanded: true,
  containerHeight: '640',
  height: '540',
  maxHeight: '540',
} satisfies Partial<StoryProps>

/** S1: строку берут за ручку и переносят в группу; группа не вкладывается, недопустимое место и бросок. */
export const RowDraggingMove: StoryObj<StoryProps> = {
  name: 'Move',
  parameters: {
    scenario: '0130/S1',
    requirements: ['DG6'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Перенос строки мышью"
      steps={ROW_MOVE}
      args={guideArgs(ROW_MOVE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const invalid = () =>
      canvas
        .querySelector('.data-grid__container')!
        .hasAttribute('data-row-drop-invalid')
    await step(ROW_MOVE[0].title, async () => {
      await until(() => expect(rowOf(canvas, 'node-0-1')).not.toBeNull())
      await until(() =>
        expect(rowOf(canvas, 'row-0')!.querySelector(HANDLE)).not.toBeNull(),
      )
    })
    await step(ROW_MOVE[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(
          canvas.querySelector(`${DRAG_FILL} [data-skeleton]`),
        ).not.toBeNull(),
      )
      // Слот — на уровне детей группы, отступом глубже корня.
      await until(() =>
        expect(indentOf(canvas, DRAG_FILL)).toBe(rowIndent(canvas, 'node-0-0')),
      )
      await until(() => expect(invalid()).toBe(false))
    })
    await step(ROW_MOVE[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      // Слот группы — на верхнем уровне, хотя указатель на уровне детей.
      await until(() =>
        expect(indentOf(canvas, DRAG_FILL)).toBe(rowIndent(canvas, 'node-1')),
      )
      await until(() => expect(invalid()).toBe(false))
    })
    await step(ROW_MOVE[3].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(invalid()).toBe(true))
      // Слот — на уровне детей: там, куда строка встала бы.
      await until(() =>
        expect(indentOf(canvas, DRAG_FILL)).toBe(rowIndent(canvas, 'node-1-0')),
      )
    })
    await step(ROW_MOVE[4].title, async () => {
      // Вспышка держится на время снимка (ADR 0130, DG6): токен — до броска шага.
      canvas
        .querySelector<HTMLElement>('.data-grid-theme')!
        .style.setProperty('--tsr-comp-flash-duration', '600000ms')
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await until(() =>
        expect(rowOf(canvas, 'row-0')).toHaveAttribute('data-flash', 'arrived'),
      )
    })
    await settle()
  },
}

/**
 * Держит строку над корневой группой на уровне её детей, пока пауза её не раскроет
 * (ADR 0109).
 */
const pauseOver = async (
  root: HTMLElement,
  held: HeldRow,
  groupId: string,
  signal: AbortSignal,
) => {
  // Движение во время паузы сбросило бы её таймер: цель — когда раскладка встала.
  await layoutStill(rowOf(root, groupId)!)
  await centerInWindow(rowOf(root, groupId)!)
  signal.throwIfAborted()
  const target = rowOf(root, groupId)!.getBoundingClientRect()
  let y = target.top + target.height / 2 + 1
  // Корневая группа: её дети — на первом уровне.
  await held.moveTo({ x: held.xAt(1), y }, 4)
  // Слот переезжает за указателем, и место броска может уйти к соседней группе:
  // указатель доводится к своей, пока пауза соседней не сработала.
  for (let tries = 0; ; tries++) {
    await sleep(80)
    signal.throwIfAborted()
    const parent = root.querySelector<HTMLElement>('[data-row-drop-parent]')
    if (parent?.dataset.rowId === groupId) break
    if (tries === 12) throw new Error(`Место броска не в группе ${groupId}`)
    const box = rowOf(root, groupId)!.getBoundingClientRect()
    const below = !parent || parent.getBoundingClientRect().top < box.top
    y = Math.min(Math.max(y + (below ? 6 : -6), box.top + 2), box.bottom - 2)
    await held.moveTo({ x: held.xAt(1), y }, 2)
  }
  await pollUntil(() => !!rowOf(root, `${groupId}-0`), signal)
  await pollUntil(
    () => !!rowOf(root, groupId)?.hasAttribute('data-row-drop-parent'),
    signal,
  )
  signal.throwIfAborted()
}

/**
 * Свёрнутые группы (ADR 0109): задержите строку над группой на уровне её детей —
 * через паузу `rowDraggingExpandDelay` группа раскроется, будущий родитель подсвечен.
 * Группы, раскрытые паузой, после броска сворачиваются, кроме группы броска.
 */
const COLLAPSED_GROUPS: readonly GuideStoryStep[] = [
  {
    title: 'Группы свёрнуты',
    hint: 'Строки двух уровней: группы свёрнуты, их дети не видны.',
  },
  {
    title: 'Пауза над группой',
    hint: 'Возьмите строку за ручку и задержите над свёрнутой группой на уровне её детей: через паузу группа раскрывается, будущий родитель обведён.',
    states: ['drag.groupParent'],
    enter: stepAction(async (root, run) => {
      // Сначала на корневом уровне: там пауза ничего не раскрывает.
      const held = await holdRowAtLevel(root, 'row-0', 'row-1', 0, run)
      await pauseOver(root, held, 'node-1', run.signal)
    }),
  },
  {
    title: 'Бросок в другую группу',
    hint: 'Задержите строку над второй группой и отпустите: строка ложится в неё, а первая группа, раскрытая паузой, снова свёрнута.',
    enter: stepAction(async (root, run) => {
      const held = await holdRowAtLevel(root, 'row-0', 'row-1', 0, run)
      await pauseOver(root, held, 'node-1', run.signal)
      // Строки ниже доезжают после раскрытия (ADR 0107) — цель меряется на месте.
      await sleep(400)
      await pauseOver(root, held, 'node-2', run.signal)
      await held.release()
    }),
  },
]

const COLLAPSED_GROUPS_ARGS = {
  dataOverride: treeData,
  enableRowDragging: true,
  enableRowExpanding: true,
  rowExpandingMaxDepth: 1,
  enableTreeLines: true,
  containerHeight: '640',
  height: '540',
  maxHeight: '540',
} satisfies Partial<StoryProps>

/** S2: пауза над свёрнутой группой раскрывает её; бросок — в другую группу. */
export const RowDraggingCollapsedGroups: StoryObj<StoryProps> = {
  name: 'Collapsed groups',
  parameters: {
    scenario: '0130/S2',
    requirements: ['NX9'],
    ...guideControls(),
  },
  render: function Render(args) {
    // Те же аргументы между перерисовками: новый набор перестроил бы плагины, и пауза
    // над группой сбросилась бы.
    const { colorMode } = args
    const gridArgs = useMemo(
      () => guideArgs(COLLAPSED_GROUPS_ARGS, { colorMode }),
      [colorMode],
    )
    return (
      <GuideStory
        title="Бросок в свёрнутую группу"
        steps={COLLAPSED_GROUPS}
        args={gridArgs}
      />
    )
  },
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(COLLAPSED_GROUPS[0].title, async () => {
      await until(() => expect(rowOf(canvas, 'node-2')).not.toBeNull())
      expect(rowOf(canvas, 'node-1-0')).toBeNull()
    })
    await step(COLLAPSED_GROUPS[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(rowOf(canvas, 'node-1-0')).not.toBeNull()
      expect(rowOf(canvas, 'node-1')).toHaveAttribute('data-row-drop-parent')
    })
    await step(COLLAPSED_GROUPS[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await until(() => expect(rowOf(canvas, 'node-1-0')).toBeNull())
      expect(rowOf(canvas, 'node-2-0')).not.toBeNull()
      await until(() =>
        expect(rowIndent(canvas, 'row-0')).toBe(rowIndent(canvas, 'node-2-0')),
      )
    })
    await settle()
  },
}

// --- ADR 0130, S3: перенос в ленивом дереве с сервером --------------------------------

type LazyNode = {
  id: string
  childCount?: number
  subRows?: LazyNode[]
} & Record<string, unknown>

/**
 * «Сервер» ленивого дерева (ADR 0112): дерево целиком; клиенту — корни и дети по
 * запросу. Перенос ждёт ответа шага гайда: он принимает или отклоняет сохранение.
 */
const createLazyTreeServer = () => {
  const nodes = new Map<string, LazyNode>()
  const children = new Map<string, string[]>()
  const walk = (list: LazyNode[], parentId: string) => {
    children.set(
      parentId,
      list.map(({ subRows, ...node }) => {
        nodes.set(node.id, node)
        if (subRows) walk(subRows, node.id)
        return node.id
      }),
    )
  }
  walk(
    makeData({ shape: 'tree', count: 12, depth: 3, breadth: 3 }) as LazyNode[],
    '',
  )
  const listOf = (parentId: string) =>
    (children.get(parentId) ?? []).map(id => ({
      ...nodes.get(id)!,
      childCount: children.get(id)?.length ?? 0,
    }))
  const moves: {
    end: RowDragEnd
    resolve: () => void
    reject: (error: Error) => void
  }[] = []
  return {
    roots: listOf(''),
    listOf,
    moves,
    answer: (ok: boolean) => {
      const move = moves.shift()
      if (!move) return
      if (!ok) {
        move.reject(new Error('Server rejected the move'))
        return
      }
      const { rowId, parentId, previousParentId, index } = move.end
      const from = children.get(previousParentId ?? '') ?? []
      from.splice(from.indexOf(rowId), 1)
      const to = children.get(parentId ?? '') ?? []
      to.splice(index, 0, rowId)
      children.set(parentId ?? '', to)
      move.resolve()
    },
  }
}

type LazyTreeServer = ReturnType<typeof createLazyTreeServer>

let lazyTreeServer = createLazyTreeServer()

/** Ход сценария на смонтированном гриде: свой «сервер» и число пройденных стадий. */
interface LazyTreeSession {
  server: LazyTreeServer
  done: number
}

/** Новое открытие грида («Сначала», шаг назад) — новый «сервер» и ход с начала. */
const lazyTreeSessions = new WeakMap<Element, LazyTreeSession>()

const lazyTreeSession = (root: HTMLElement) => {
  const grid = root.querySelector('.data-grid__container')!
  let session = lazyTreeSessions.get(grid)
  if (!session) {
    lazyTreeServer = createLazyTreeServer()
    session = { server: lazyTreeServer, done: 0 }
    lazyTreeSessions.set(grid, session)
  }
  return session
}

type LazyTreeStage = (
  root: HTMLElement,
  run: StepRun,
  server: LazyTreeServer,
) => Promise<void>

/** Раскрывает группу её переключателем; дети придут с «сервера». */
const expandGroup =
  (id: string): LazyTreeStage =>
  async (root, { signal }) => {
    await pollUntil(() => !!rowOf(root, id), signal)
    rowOf(root, id)!.querySelector<HTMLElement>('.row-expand-button')!.click()
  }

/**
 * Держит лист над свёрнутой корневой группой на уровне её детей, пока дети не придут, и
 * отпускает.
 */
const dropIntoGroup =
  (id: string, groupId: string): LazyTreeStage =>
  async (root, run) => {
    await pollUntil(() => !!rowOf(root, id), run.signal)
    const held = await holdRowAtLevel(root, id, groupId, 1, run)
    // Указатель не двигается: слот переезжает к группе, и она смещается на строку.
    await pollUntil(() => !!rowOf(root, `${groupId}-0`), run.signal)
    await pollUntil(
      () => !!rowOf(root, groupId)?.hasAttribute('data-row-drop-parent'),
      run.signal,
    )
    await held.release()
  }

/** «Сервер» отвечает на перенос, который ждёт. */
const answerMove =
  (ok: boolean): LazyTreeStage =>
  async (_root, { signal }, server) => {
    await pollUntil(() => server.moves.length > 0, signal)
    signal.throwIfAborted()
    server.answer(ok)
  }

/**
 * Стадии сценария по порядку; шаг гайда проходит их до своего состояния — с того места,
 * где грид стоит: переход вперёд добавляет стадии, новое открытие грида начинает с первой.
 */
const LAZY_TREE_STAGES: readonly LazyTreeStage[] = [
  expandGroup('node-0'),
  expandGroup('node-0-0'),
  dropIntoGroup('node-0-0-0', 'node-1'),
  answerMove(true),
  dropIntoGroup('node-0-0-1', 'node-1'),
  answerMove(false),
  dropIntoGroup('node-0-0-2', 'node-1'),
  answerMove(false),
]

/** Действие шага: проходит стадии до `count`-й. */
const lazyTreeUpTo = (count: number) =>
  stepAction(async (root, run) => {
    const session = lazyTreeSession(root)
    while (session.done < count) {
      await LAZY_TREE_STAGES[session.done]!(root, run, session.server)
      // Запуск, прерванный уходом с шага, стадию не засчитывает.
      run.signal.throwIfAborted()
      session.done++
    }
  })

const LAZY_TREE: readonly GuideStoryStep[] = [
  {
    title: 'Ленивое дерево',
    hint: 'Дети групп приходят с сервера при раскрытии. Группы свёрнуты.',
  },
  {
    title: 'Пользователь раскрыл группы',
    hint: 'Первая группа и её первая подгруппа раскрыты — их дети пришли с сервера.',
    enter: lazyTreeUpTo(2),
  },
  {
    title: 'Перенос ждёт сервера',
    hint: 'Строку бросили в свёрнутую группу: пауза загрузила её детей, перенос сохраняется на сервере — ячейки строки чуть темнеют и по ним проходит светлый блик.',
    states: ['drag.pending'],
    enter: lazyTreeUpTo(3),
  },
  {
    title: 'Сервер сохранил',
    hint: 'Ответ пришёл: ожидание снято, строка осталась в новой группе и коротко вспыхнула тоном успеха.',
    enter: lazyTreeUpTo(4),
  },
  {
    title: 'Отказ сервера',
    hint: 'Следующий перенос сервер отклонил: строка вернулась на прежнее место и коротко вспыхнула тоном ошибки.',
    states: ['drag.rejected'],
    enter: lazyTreeUpTo(6),
  },
  {
    title: 'Отказ без отката',
    hint: 'С `revertOnReject: false` отклонённая строка остаётся там, куда её бросили, и коротко вспыхивает тоном ошибки.',
    props: () => ({ rowDraggingRevertOnReject: false }),
    enter: lazyTreeUpTo(8),
  },
]

const LAZY_TREE_ARGS = {
  enableRowDragging: true,
  enableRowExpanding: true,
  rowExpandingMaxDepth: 3,
  enableTreeLines: true,
  containerHeight: '640',
  height: '540',
  maxHeight: '540',
  dataOverride: lazyTreeServer.roots,
  rowExpandingHasChildren: (row: Row<any, any>) =>
    ((row.original as LazyNode).childCount ?? 0) > 0,
  rowExpandingLoadChildren: (row: Row<any, any>) =>
    new Promise<LazyNode[]>(resolve =>
      setTimeout(() => resolve(lazyTreeServer.listOf(row.id)), 300),
    ),
  onRowDragEnd: (end: RowDragEnd) =>
    new Promise<void>((resolve, reject) =>
      lazyTreeServer.moves.push({ end, resolve, reject }),
    ),
} satisfies Partial<StoryProps>

/**
 * S3: дети групп приходят с «сервера», перенос сохраняется промисом `onRowDragEnd` —
 * ручка ждёт, отказ возвращает строку на место; без отката строка остаётся там, куда
 * её бросили.
 */
export const RowDraggingLazyTree: StoryObj<StoryProps> = {
  name: 'Lazy tree (server)',
  parameters: {
    scenario: '0130/S3',
    requirements: ['LT14', 'CO19'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Перенос в ленивом дереве"
      steps={LAZY_TREE}
      args={guideArgs(LAZY_TREE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const handleOf = (id: string) => rowOf(canvas, id)!.querySelector(HANDLE)!
    const order = () =>
      [...canvas.querySelectorAll<HTMLElement>(`${ROW}:not([data-row-ghost])`)]
        .sort((a, b) => a.offsetTop - b.offsetTop)
        .map(item => item.dataset.rowId)
    const slow = { timeout: 10_000 }

    await step(LAZY_TREE[0].title, async () => {
      await waitForRows(canvas)
    })
    await step(LAZY_TREE[1].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(rowOf(canvas, 'node-0-0-2')).not.toBeNull())
    })
    await step(LAZY_TREE[2].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(rowOf(canvas, 'node-0-0-0')).toHaveAttribute(
          'aria-busy',
          'true',
        ),
      )
      // Ожидание — волной на строке, на ручке дуги нет (ADR 0177, §1).
      await until(() =>
        expect(
          rowOf(canvas, 'node-0-0-0')!.querySelector('[data-pending-wave]'),
        ).not.toBeNull(),
      )
      expect(
        handleOf('node-0-0-0').querySelector('svg[data-pending-arc]'),
      ).toBeNull()
    })
    await step(LAZY_TREE[3].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(rowOf(canvas, 'node-0-0-0')).not.toHaveAttribute('aria-busy'),
      )
      const placed = order()
      expect(placed.indexOf('node-0-0-0')).toBe(placed.indexOf('node-1') + 1)
      expect(rowOf(canvas, 'node-0-0-0')).toHaveAttribute(
        'data-flash',
        'accepted',
      )
    })
    await step(LAZY_TREE[4].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await waitFor(() => {
        const back = order()
        expect(back.indexOf('node-0-0-1')).toBe(back.indexOf('node-0-0') + 1)
      }, slow)
      await until(() =>
        expect(rowOf(canvas, 'node-0-0-1')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      // Ручку ищем заново: после отката строка может смонтироваться новым узлом.
      expect(
        handleOf('node-0-0-1').querySelector('[data-failure-indicator]'),
      ).toBeNull()
    })
    await step(LAZY_TREE[5].title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(rowOf(canvas, 'node-0-0-2')).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      const kept = order()
      expect(kept.indexOf('node-0-0-2')).toBe(kept.indexOf('node-1') + 1)
      expect(
        handleOf('node-0-0-2').querySelector('[data-failure-indicator]'),
      ).toBeNull()
    })
    await settle()
  },
}

// --- ADR 0186, S1–S2: перенос между клиентскими группами ------------------------------

interface GroupItem {
  id: string
  team: string
  name: string
}

const GROUP_ITEMS: GroupItem[] = ['Alpha', 'Beta'].flatMap((team, t) =>
  Array.from({ length: 3 }, (_, i) => ({
    id: `task-${t * 3 + i}`,
    team,
    name: `Task ${t * 3 + i + 1}`,
  })),
)
const GROUP_COLUMNS = [
  { id: 'team', accessorKey: 'team', header: 'Team', enableGrouping: true },
  { id: 'name', accessorKey: 'name', header: 'Name' },
]
const GROUP_LEAF = 'task-1'
const FROM_GROUP = 'team:Alpha'
const TO_GROUP = 'team:Beta'

/** «Сервер» отвечает на перенос, когда шаг отпустит ответ. */
const groupServer = {
  move: undefined as
    { resolve: () => void; reject: (reason: Error) => void } | undefined,
  onRowDragEnd: (_end: RowDragEnd) =>
    new Promise<void>((resolve, reject) => {
      groupServer.move = { resolve, reject }
    }),
}

const GROUP_GRID = {
  columnsOverride: GROUP_COLUMNS,
  dataOverride: GROUP_ITEMS,
  enableRowGrouping: true,
  initialGrouping: ['team'],
  enableRowExpanding: true,
  initialExpanded: true,
  enableRowDragging: true,
  onRowDragEnd: groupServer.onRowDragEnd,
  containerHeight: '520',
  height: '420',
  maxHeight: '420',
} satisfies Partial<StoryProps>

const positionOf = (root: HTMLElement, id: string) =>
  Number(rowOf(root, id)?.dataset.index ?? -1)
const inOtherGroup = (root: HTMLElement) =>
  positionOf(root, GROUP_LEAF) > positionOf(root, TO_GROUP)
const waitingOnServer = (root: HTMLElement) =>
  rowOf(root, GROUP_LEAF)?.getAttribute('aria-busy') === 'true'
const refusedInGroup = (root: HTMLElement) =>
  !inOtherGroup(root) &&
  rowOf(root, GROUP_LEAF)?.getAttribute('data-flash') === 'reverted'

/** Пользователь переносит строку первой в другую группу: уровень строки, слот под группой. */
const dropInOtherGroup = async (root: HTMLElement, run: StepRun) => {
  if (inOtherGroup(root)) return
  groupServer.move = undefined
  const held: HeldRow = await holdRowAtLevel(
    root,
    GROUP_LEAF,
    TO_GROUP,
    1,
    run,
    'name',
  )
  let y = rowOf(root, TO_GROUP)!.getBoundingClientRect().bottom
  for (let tries = 0; ; tries++) {
    await layoutStill(rowOf(root, TO_GROUP)!)
    run.signal.throwIfAborted()
    const slot = root.querySelector(DRAG_FILL)!.getBoundingClientRect()
    const group = rowOf(root, TO_GROUP)!.getBoundingClientRect()
    if (Math.abs(slot.top - group.bottom) < 2) break
    if (tries === 12) throw new Error(`Слот не под группой ${TO_GROUP}`)
    y += slot.top < group.top ? 6 : -6
    await held.moveTo({ x: held.xAt(1), y }, 2)
  }
  await held.release()
}

const GROUP_INTRO: GuideStoryStep = {
  title: 'Строки по командам',
  hint: 'Строки сгруппированы по команде. Чтобы сменить команду, строку переносят в другую группу.',
}
const GROUP_DROPPED: GuideStoryStep = {
  title: 'Пользователь перенёс строку в другую группу',
  hint: 'Строка встала в другой группе, а сервер ещё сохраняет перенос: строка занята.',
  states: ['drag.pending'],
  enter: stepAction(async (root, run) => {
    await dropInOtherGroup(root, run)
    await pollUntil(() => waitingOnServer(root), run.signal)
  }),
}

const GROUP_MOVE: readonly GuideStoryStep[] = [
  GROUP_INTRO,
  GROUP_DROPPED,
  {
    title: 'Сервер подтвердил',
    hint: 'Сервер сохранил перенос, и приложение записало новую команду в свои данные. Строка осталась в новой группе.',
    enter: stepAction(async (root, run, app) => {
      await dropInOtherGroup(root, run)
      await pollUntil(() => !!groupServer.move, run.signal)
      app.update(props => ({
        ...props,
        dataOverride: GROUP_ITEMS.map(item =>
          item.id === GROUP_LEAF ? { ...item, team: 'Beta' } : item,
        ),
      }))
      groupServer.move?.resolve()
      await pollUntil(
        () => !waitingOnServer(root) && inOtherGroup(root),
        run.signal,
      )
    }),
  },
]

/** ADR 0186, S1: строка переносится в другую группу, сервер подтверждает. */
export const GroupDragMove: StoryObj<StoryProps> = {
  name: 'Move to another group',
  parameters: { scenario: '0186/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Перенос в другую группу"
      steps={GROUP_MOVE}
      args={guideArgs(GROUP_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_MOVE[0]!.title, async () => {
      await until(() => expect(rowOf(canvas, TO_GROUP)).toBeTruthy())
      await expect(inOtherGroup(canvas)).toBe(false)
    })
    await step(GROUP_MOVE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inOtherGroup(canvas)).toBe(true)
      await expect(waitingOnServer(canvas)).toBe(true)
    })
    await step(GROUP_MOVE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(inOtherGroup(canvas)).toBe(true)
      await expect(waitingOnServer(canvas)).toBe(false)
      await settle()
    })
  },
}

const GROUP_REFUSED: readonly GuideStoryStep[] = [
  GROUP_INTRO,
  GROUP_DROPPED,
  {
    title: 'Сервер отказал',
    hint: 'Сервер не принял перенос. Данные приложения не менялись, поэтому строка вернулась в свою группу и коротко вспыхнула.',
    immediate: true,
    enter: stepAction(async (root, run) => {
      await dropInOtherGroup(root, run)
      await pollUntil(() => !!groupServer.move, run.signal)
      groupServer.move?.reject(new Error('Server unavailable'))
      await pollUntil(() => refusedInGroup(root), run.signal)
    }),
  },
]

/** ADR 0186, S2: сервер отказал — строка возвращается в свою группу. */
export const GroupDragRefused: StoryObj<StoryProps> = {
  name: 'Move refused by the server',
  parameters: { scenario: '0186/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ в переносе"
      steps={GROUP_REFUSED}
      args={guideArgs(GROUP_GRID, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUP_REFUSED[0]!.title, async () => {
      await until(() => expect(rowOf(canvas, TO_GROUP)).toBeTruthy())
    })
    await step(GROUP_REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inOtherGroup(canvas)).toBe(true)
    })
    await step(GROUP_REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(inOtherGroup(canvas)).toBe(false)
      await until(() =>
        expect(rowOf(canvas, FROM_GROUP)?.getAttribute('aria-busy')).not.toBe(
          'true',
        ),
      )
      await settle()
    })
  },
}
