import { Meta, StoryObj } from '@storybook/react'
import { useMemo } from 'react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { makeData } from './__mocks__/data'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import type { RowDragEnd } from '../plugins'
import type { Row } from '../types'
import { expect, userEvent, waitFor } from 'storybook/test'
import {
  type HeldDrag,
  centerOf,
  dragHold,
  guideNext,
  releaseFocus,
  settle,
  until,
  updateArgs,
} from './__mocks__/catalogPlay'
import {
  DRAG_FILL,
  HANDLE,
  OVERLAY,
  ROW,
  USER_CELL,
  beginDrag,
  firePointer,
  nextFrame,
  rowSignatures,
  sortedRows,
} from './rowDragging.dnd'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'

/** Перетаскивание строк (ADR 0006). */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Dragging',
} satisfies Meta<StoryProps>

export default meta

/**
 * Демо одной перестановки для панели Interactions. Требования (ручка, облако, ширина,
 * автопрокрутка) — именованные тесты `__tests__/row-dragging.test.tsx`; хореография
 * указателя у демо и тестов общая — `rowDragging.dnd.ts`.
 */
const rowDraggingPlay: NonNullable<StoryObj<StoryProps>['play']> = async ({
  args,
  canvasElement,
  globals,
  step,
}) => {
  if (globals.catalog !== true) return
  // Во время скелета первой загрузки строк данных нет — тянуть нечего.
  if (!args.enableRowDragging || args.loading === 'initial') return

  const canvas = canvasElement

  await waitFor(() =>
    expect(canvas.querySelectorAll(ROW).length).toBeGreaterThan(3),
  )

  await step('drag the first row onto a lower row and drop', async () => {
    const before = rowSignatures(canvas)
    const rows = sortedRows(canvas)
    const handle = rows[0].querySelector<HTMLElement>(HANDLE)!
    const target = rows[3]

    // Keep x fixed (no horizontal drift) so nesting depth stays 0 on flat data.
    const { hx } = await beginDrag(handle)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty) // over the target row
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1) // settle collision/over
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // Sanity for the demo: the drop reordered the rows.
    await waitFor(() =>
      expect(rowSignatures(canvas).join('¦')).not.toBe(before.join('¦')),
    )
    // История заканчивается в покое: облако долетело, слот строки снова обычный —
    // по нему каталог проверяет axe и снимает снимок (ADR 0093).
    await waitFor(() => expect(canvas.querySelector(OVERLAY)).toBeNull())
  })
}

export const RowDraggingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableRowDragging',
    'rowDraggingExpandDelay',
    'rowDraggingRevertOnReject',
  ]),
  args: {
    enableRowDragging: true,
    // Sized to overflow on both axes so the play's auto-scroll steps (D12–D14)
    // have real vertical + horizontal scroll to exercise.
    dataCount: 60,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  play: rowDraggingPlay,
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
 * меняется; на недопустимом уровне полоски красные.
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
          expect(slot.querySelector('[class*="skeleton"]')).not.toBeNull()
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

const CLOUD_TITLE = `${OVERLAY} .data-grid__cell-wrapper-title`
const LEVEL_CELL = '[data-column-id="country"]'

const tokenPx = (root: Element, name: string) => {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;display:block;width:var(${name})`
  root.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return value
}

/**
 * Ждёт, пока узел 15 кадров подряд стоит на месте: после «Далее» панель гайда сначала
 * заливает полоску и лишь затем меняет шаг и свою высоту — грид под ней сдвигается.
 */
const layoutStill = async (el: Element) => {
  let last = NaN
  for (let still = 0, frame = 0; still < 15 && frame < 300; frame++) {
    await nextFrame()
    const top = el.getBoundingClientRect().top
    still = top === last ? still + 1 : 0
    last = top
  }
}

/**
 * Берёт строку `id` за ручку и держит над строкой `overId` так, чтобы текст облака
 * встал на уровень `depth` (ADR 0108): слот — на этом уровне. Цели — в верхней части
 * окна грида, вдали от автопрокрутки (ADR 0130, §4).
 */
const holdRowAtLevel = async (
  canvas: HTMLElement,
  id: string,
  overId: string,
  depth: number,
) => {
  // Грид — к верху окна: у нижнего края окна dnd-kit прокручивал бы страницу.
  const container = canvas.querySelector('.data-grid__container')!
  container.scrollIntoView({ block: 'start' })
  await layoutStill(container)
  // Тема самого грида: у других узлов темы на холсте шаг без линий дерева.
  const theme = container.closest('.data-grid-theme')!
  const step = tokenPx(theme, '--tsr-comp-row-nesting-indent')
  const rowOf = (rowId: string) =>
    canvas.querySelector<HTMLElement>(
      `${ROW}[data-row-id="${rowId}"]:not([data-row-ghost])`,
    )!
  const source = rowOf(id)
  const cell = source.querySelector<HTMLElement>(
    `${USER_CELL} > .data-grid__cell-wrapper-content`,
  )!
  const sourceDepth = Math.round(
    parseFloat(
      getComputedStyle(source.querySelector(LEVEL_CELL)!).paddingLeft,
    ) / step,
  )
  const levelZero =
    cell.getBoundingClientRect().left +
    parseFloat(getComputedStyle(cell).paddingLeft) -
    sourceDepth * step
  const handle = source.querySelector<HTMLElement>(HANDLE)!
  const from = centerOf(handle)
  const over = rowOf(overId).getBoundingClientRect()
  const y = over.top + over.height / 2 + (over.top > from.y ? 6 : -6)
  const held = await dragHold(handle, { x: from.x, y })
  await until(() => expect(document.querySelector(CLOUD_TITLE)).not.toBeNull())
  // Облако встаёт под указатель кадром позже своего появления.
  await nextFrame()
  await nextFrame()
  const cloud = document.querySelector(CLOUD_TITLE)!.getBoundingClientRect()
  await held.moveTo({ x: from.x + levelZero + depth * step - cloud.left, y }, 4)
  return held
}

/** Отменяет удержание и ждёт, пока грид его закончит. */
const cancelHold = async (canvas: HTMLElement, held: HeldDrag) => {
  held.cancel()
  await until(() =>
    expect(canvas.querySelector('[data-row-dragging]')).toBeNull(),
  )
  await settle()
}

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
  },
  {
    title: 'Недопустимое место',
    hint: 'Ведите группу с детьми внутрь другой группы: дерево не глубже двух уровней. Полоски слота красные, бросок здесь не сработает.',
    states: ['drag.rowInvalid'],
  },
  {
    title: 'Бросок',
    hint: 'Отпустите строку на допустимом месте: облако пропадает, строка встаёт на место и коротко вспыхивает.',
    states: ['drag.landed'],
    immediate: true,
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

/** S1: строку берут за ручку и переносят в группу; недопустимое место и бросок. */
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
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(
        `${ROW}[data-row-id="${id}"]:not([data-row-ghost])`,
      )
    const invalid = () =>
      canvas
        .querySelector('.data-grid__container')!
        .hasAttribute('data-row-drop-invalid')
    let held: HeldDrag | undefined
    await step(ROW_MOVE[0].title, async () => {
      await until(() => expect(row('node-0-1')).not.toBeNull())
      expect(row('row-0')!.querySelector(HANDLE)).not.toBeNull()
    })
    await step(ROW_MOVE[1].title, async () => {
      await guideNext(canvas)
      await settle()
      held = await holdRowAtLevel(canvas, 'row-0', 'node-0-0', 1)
      await until(() =>
        expect(
          canvas.querySelector(`${DRAG_FILL} [class*="skeleton"]`),
        ).not.toBeNull(),
      )
      // Слот — на уровне детей группы, отступом глубже корня.
      const indent = (selector: string) =>
        parseFloat(
          getComputedStyle(canvas.querySelector(`${selector} ${LEVEL_CELL}`)!)
            .paddingLeft,
        )
      await until(() =>
        expect(indent(DRAG_FILL)).toBe(
          indent(`${ROW}[data-row-id="node-0-0"]`),
        ),
      )
      expect(invalid()).toBe(false)
    })
    await step(ROW_MOVE[2].title, async () => {
      // Клик «Далее» отпустил бы строку: удержание снимается до него.
      await cancelHold(canvas, held!)
      await guideNext(canvas)
      await settle()
      held = await holdRowAtLevel(canvas, 'node-0', 'node-1-0', 1)
      await until(() => expect(invalid()).toBe(true))
    })
    await step(ROW_MOVE[3].title, async () => {
      await cancelHold(canvas, held!)
      await guideNext(canvas)
      await settle()
      // Вспышка держится на время снимка (ADR 0130, DG6).
      canvas
        .querySelector<HTMLElement>('.data-grid-theme')!
        .style.setProperty('--tsr-comp-row-arrival-duration', '600000ms')
      held = await holdRowAtLevel(canvas, 'row-0', 'node-0-0', 1)
      held.release()
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await until(() =>
        expect(row('row-0')!.hasAttribute('data-arrived')).toBe(true),
      )
    })
    await settle()
  },
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
  },
  {
    title: 'Бросок в другую группу',
    hint: 'Задержите строку над второй группой и отпустите: строка ложится в неё, а первая группа, раскрытая паузой, снова свёрнута.',
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
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(
        `${ROW}[data-row-id="${id}"]:not([data-row-ghost])`,
      )
    const indentOf = (id: string) =>
      parseFloat(
        getComputedStyle(row(id)!.querySelector(LEVEL_CELL)!).paddingLeft,
      )
    const slow = { timeout: 5000 }
    /** Держит строку над группой на уровне её детей, пока пауза её не раскроет. */
    const pauseOver = async (held: HeldDrag, groupId: string) => {
      // Движение во время паузы сбросило бы её таймер: цель — когда раскладка встала.
      await layoutStill(row(groupId)!)
      const target = row(groupId)!.getBoundingClientRect()
      await held.moveTo(
        { x: held.point().x, y: target.top + target.height / 2 + 1 },
        4,
      )
      await waitFor(() => expect(row(`${groupId}-0`)).not.toBeNull(), slow)
      await until(() =>
        expect(row(groupId)!.hasAttribute('data-row-drop-parent')).toBe(true),
      )
    }
    let held: HeldDrag | undefined
    await step(COLLAPSED_GROUPS[0].title, async () => {
      await until(() => expect(row('node-2')).not.toBeNull())
      expect(row('node-1-0')).toBeNull()
    })
    await step(COLLAPSED_GROUPS[1].title, async () => {
      await guideNext(canvas)
      await settle()
      // Сначала над листом: пауза над ним ничего не раскрывает.
      held = await holdRowAtLevel(canvas, 'row-0', 'row-1', 1)
      await pauseOver(held, 'node-1')
    })
    await step(COLLAPSED_GROUPS[2].title, async () => {
      // Клик «Далее» отпустил бы строку: удержание снимается до него.
      await cancelHold(canvas, held!)
      await guideNext(canvas)
      await settle()
      // Сначала над листом: пауза над ним ничего не раскрывает.
      held = await holdRowAtLevel(canvas, 'row-0', 'row-1', 1)
      await pauseOver(held, 'node-1')
      // Строки ниже доезжают после раскрытия (ADR 0107) — цель меряется на месте.
      await new Promise(resolve => setTimeout(resolve, 400))
      await pauseOver(held, 'node-2')
      held.release()
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await until(() => expect(row('node-1-0')).toBeNull())
      expect(row('node-2-0')).not.toBeNull()
      await until(() => expect(indentOf('row-0')).toBe(indentOf('node-2-0')))
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

let lazyTreeServer = createLazyTreeServer()

/**
 * Держит вспышку отказа на время шага (ADR 0130, DG6): матрица контраста и снимок
 * застают сам отказ, а не угасание красного контура.
 */
const holdErrorFlash = (canvas: HTMLElement, hold: boolean) => {
  const theme = canvas
    .querySelector('.data-grid__container')!
    .closest<HTMLElement>('.data-grid-theme')!
  if (hold)
    theme.style.setProperty('--tsr-comp-error-flash-duration', '600000ms')
  else theme.style.removeProperty('--tsr-comp-error-flash-duration')
}

const LAZY_TREE: readonly GuideStoryStep[] = [
  {
    title: 'Ленивое дерево',
    hint: 'Дети групп приходят с сервера при раскрытии. Группы «Node 0» и её первая подгруппа раскрыты.',
  },
  {
    title: 'Перенос ждёт сервера',
    hint: 'Строку бросили в свёрнутую группу: пауза загрузила её детей, перенос сохраняется на сервере — по ручке строки бежит дуга ожидания.',
    states: ['drag.pending'],
  },
  {
    title: 'Сервер сохранил',
    hint: 'Ответ пришёл: дуга погасла, строка осталась в новой группе.',
  },
  {
    title: 'Отказ сервера',
    hint: 'Следующий перенос сервер отклонил: строка вернулась на прежнее место, ручка залилась красным и несёт отметку отказа, строка подсвечена тоном ошибки.',
    states: ['drag.rejected'],
  },
  {
    title: 'Отказ без отката',
    hint: 'С `revertOnReject: false` отклонённая строка остаётся там, куда её бросили, — с подсветкой ошибки.',
    props: () => ({ rowDraggingRevertOnReject: false }),
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
    const row = (id: string) =>
      canvas.querySelector<HTMLElement>(
        `${ROW}[data-row-id="${id}"]:not([data-row-ghost])`,
      )
    const toggle = (id: string) =>
      row(id)!.querySelector<HTMLElement>('.row-expand-button')!
    const handleOf = (id: string) => row(id)!.querySelector(HANDLE)!
    const order = () =>
      [...canvas.querySelectorAll<HTMLElement>(`${ROW}:not([data-row-ghost])`)]
        .sort((a, b) => a.offsetTop - b.offsetTop)
        .map(item => item.dataset.rowId)
    const slow = { timeout: 5000 }

    /** Держит лист над свёрнутой группой на уровне её детей, пока дети не придут, и отпускает. */
    const dropInto = async (id: string, groupId: string) => {
      // Грид — к верху окна, цель меряется, когда раскладка встала (ADR 0130, §4).
      canvas
        .querySelector('.data-grid__container')!
        .scrollIntoView({ block: 'start' })
      await layoutStill(row(groupId)!)
      const source = row(id)!
      const levelStep =
        2 *
        (source.querySelector(LEVEL_CELL)!.getBoundingClientRect().left -
          source.getBoundingClientRect().left)
      const { hx } = await beginDrag(source.querySelector<HTMLElement>(HANDLE)!)
      const target = row(groupId)!.getBoundingClientRect()
      const ty = target.top + target.height / 2
      firePointer('pointermove', document, hx + levelStep, ty)
      await nextFrame()
      firePointer('pointermove', document, hx + levelStep, ty + 1)
      await waitFor(() => expect(row(`${groupId}-0`)).not.toBeNull(), slow)
      // Бросок — когда dnd-kit отметил группу родителем места, а не по кадрам.
      await until(() =>
        expect(row(groupId)).toHaveAttribute('data-row-drop-parent'),
      )
      firePointer('pointerup', document, hx + levelStep, ty + 1)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
    }

    await step(LAZY_TREE[0].title, async () => {
      lazyTreeServer = createLazyTreeServer()
      await until(() => expect(row('node-1')).not.toBeNull())
      await userEvent.click(toggle('node-0'))
      await waitFor(() => expect(row('node-0-0')).not.toBeNull(), slow)
      await userEvent.click(toggle('node-0-0'))
      await waitFor(() => expect(row('node-0-0-2')).not.toBeNull(), slow)
      await releaseFocus()
    })
    await step(LAZY_TREE[1].title, async () => {
      await guideNext(canvas)
      await settle()
      await dropInto('node-0-0-0', 'node-1')
      await until(() =>
        expect(row('node-0-0-0')).toHaveAttribute('aria-busy', 'true'),
      )
    })
    await step(LAZY_TREE[2].title, async () => {
      await guideNext(canvas)
      lazyTreeServer.answer(true)
      await until(() =>
        expect(row('node-0-0-0')).not.toHaveAttribute('aria-busy'),
      )
      const placed = order()
      expect(placed.indexOf('node-0-0-0')).toBe(placed.indexOf('node-1') + 1)
    })
    await step(LAZY_TREE[3].title, async () => {
      await guideNext(canvas)
      await settle()
      holdErrorFlash(canvas, true)
      await dropInto('node-0-0-1', 'node-1')
      lazyTreeServer.answer(false)
      await waitFor(() => {
        const back = order()
        expect(back.indexOf('node-0-0-1')).toBe(back.indexOf('node-0-0') + 1)
      }, slow)
      // Ручку ищем заново: после отката строка может смонтироваться новым узлом.
      await until(() =>
        expect(handleOf('node-0-0-1')).toHaveAttribute(
          'data-error-flash',
          'on',
        ),
      )
      expect(row('node-0-0-1')).toHaveAttribute('data-highlight', 'danger')
    })
    await step(LAZY_TREE[4].title, async () => {
      await guideNext(canvas)
      await settle()
      holdErrorFlash(canvas, false)
      await dropInto('node-0-0-2', 'node-1')
      lazyTreeServer.answer(false)
      await until(() =>
        expect(row('node-0-0-2')).toHaveAttribute('data-highlight', 'danger'),
      )
      const kept = order()
      expect(kept.indexOf('node-0-0-2')).toBe(kept.indexOf('node-1') + 1)
      await waitFor(
        () =>
          expect(handleOf('node-0-0-2')).not.toHaveAttribute(
            'data-error-flash',
            'on',
          ),
        slow,
      )
    })
    await settle()
  },
}
