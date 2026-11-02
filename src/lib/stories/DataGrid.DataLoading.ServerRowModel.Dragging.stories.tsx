import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import { hasRow, layout, skeletonRows } from './__mocks__/serverRowModelGuide'
import {
  answerMove,
  dragProps,
  dragServer,
  dropRow,
  indexOfRow,
  movePending,
  releaseChildren,
} from './__mocks__/serverDraggingGuide'
import {
  type HeldRow,
  holdRowAtLevel,
  layoutStill,
  rowIndent,
  rowOf,
} from './__mocks__/rowDragHold'
import { DRAG_FILL, OVERLAY } from './rowDragging.dnd'

/**
 * Перетаскивание строк в серверной модели (ADR 0159): `Playground` — строки с «сервера»
 * с ручным порядком, ответ «сервера» на перенос и ветки — контролами; S1 — перенос
 * подтверждён, S2 — отказ, S3 — перенос в ветку, S4 — перенос в другую серверную группу.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Dragging',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface DraggingPlaygroundArgs extends StoryProps {
  saveDelayMs: number
  refuseMoves: boolean
  rowShape: 'list' | 'branches' | 'groups'
}

export const ServerDraggingPlayground: StoryObj<DraggingPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['saveDelayMs', 'refuseMoves', 'rowShape'], {
    dataCount: 'строки подаёт «сервер» демо',
    columnCount: 'колонки задаёт демо',
  }),
  args: { ...layout, saveDelayMs: 800, refuseMoves: false, rowShape: 'list' },
  argTypes: {
    saveDelayMs: {
      description: 'Время ответа «сервера» на перенос, мс',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    refuseMoves: {
      description: '«Сервер» отклоняет переносы',
      control: 'boolean',
    },
    rowShape: {
      description:
        'Строки «сервера»: список, у части строк — вложенные строки или группы по городу',
      control: 'select',
      options: ['list', 'branches', 'groups'],
    },
  },
  render: ({ saveDelayMs, refuseMoves, rowShape, ...args }) => {
    dragServer.auto = true
    dragServer.refuse = refuseMoves
    return (
      <StoryComponent
        key={rowShape}
        {...normalizeArgs(args)}
        {...dragProps({
          delayMs: saveDelayMs,
          tree: rowShape === 'branches',
          groups: rowShape === 'groups',
        })!(AT_REST)}
      />
    )
  },
  // Снимок — в покое: первое окно пришло.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await until(() => expect(hasRow(canvas, 0)).toBe(true))
    await settle()
  },
}

// --- S1, S2: перенос и ответ «сервера» -----------------------------------------------

const MOVED = 'item-id-1'
const TARGET = 'item-id-4'
/** Место строки после переноса. */
const MOVED_TO = 4

const atRest: GuideStoryStep = {
  title: 'Строки с сервера',
  hint: 'Сервер отдаёт строки блоками, порядок строк ручной: строку переносят за ручку.',
  props: dragProps(),
  enter: stepAction(async (root, { signal }) => {
    dragServer.auto = false
    await pollUntil(() => hasRow(root, 0), signal)
  }),
}

/** Пользователь перенёс строку: она на новом месте, «сервер» сохраняет порядок. */
const moveRow = stepAction(async (root, run) => {
  if (indexOfRow(root, MOVED) !== MOVED_TO) {
    await dropRow(root, MOVED, TARGET, run)
  }
  await pollUntil(() => movePending(root, MOVED), run.signal)
})

const moved: GuideStoryStep = {
  title: 'Пользователь перенёс строку',
  hint: 'Строка сразу встала на новое место, а сервер ещё сохраняет новый порядок: ячейки строки чуть темнеют и по ним проходит светлый блик.',
  states: ['drag.pending'],
  enter: moveRow,
}

/** «Сервер» отвечает на перенос: строка на месте, ожидания нет. */
const answer = (ok: boolean) =>
  stepAction(async (root, run) => {
    if (indexOfRow(root, MOVED) !== MOVED_TO && !movePending(root, MOVED)) {
      await dropRow(root, MOVED, TARGET, run)
    }
    await pollUntil(() => dragServer.moves.length > 0, run.signal)
    answerMove(ok)
    await pollUntil(() => !movePending(root, MOVED), run.signal)
  })

const MOVE: readonly GuideStoryStep[] = [
  atRest,
  moved,
  {
    title: 'Сервер подтвердил',
    hint: 'Сервер сохранил новый порядок: ожидание снято, строка осталась на месте и коротко вспыхнула тоном успеха.',
    enter: answer(true),
  },
]

/** ADR 0159, S1: строка сразу на новом месте, сервер подтверждает. */
export const ServerDragMove: StoryObj<StoryProps> = {
  name: 'Move a row',
  parameters: { scenario: '0159/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Перенос на сервере"
      steps={MOVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MOVE[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(MOVE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO)
      await expect(movePending(canvas, MOVED)).toBe(true)
    })
    await step(MOVE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO)
      await settle()
    })
  },
}

const REFUSED: readonly GuideStoryStep[] = [
  atRest,
  moved,
  {
    title: 'Сервер отказал',
    hint: 'Сервер не принял перенос: строка вернулась на прежнее место и коротко вспыхнула тоном ошибки.',
    states: ['drag.rejected'],
    enter: answer(false),
  },
]

/** ADR 0159, S2: сервер отказал в переносе — строка возвращается со вспышкой. */
export const ServerDragRefused: StoryObj<StoryProps> = {
  name: 'Move refused',
  parameters: { scenario: '0159/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ в переносе"
      steps={REFUSED}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title, async () => {
      await stepDone(canvas)
    })
    await step(REFUSED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO)
    })
    await step(REFUSED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, MOVED)).toBe(1)
      await settle()
    })
  },
}

// --- S3: перенос в ветку --------------------------------------------------------------

const LEAF = 'item-id-1'
const BRANCH = 'item-id-3'

const toggleOf = (root: HTMLElement, id: string) =>
  rowOf(root, id)?.querySelector<HTMLElement>('.row-expand-button')
const branchOpen = (root: HTMLElement) =>
  toggleOf(root, BRANCH)?.getAttribute('aria-expanded') === 'true'
const placeInvalid = (root: HTMLElement) =>
  !!root
    .querySelector('.data-grid__container')
    ?.hasAttribute('data-row-drop-invalid')
/** Строка — первая вложенная строка раскрытой ветки. */
const inBranch = (root: HTMLElement) =>
  branchOpen(root) &&
  indexOfRow(root, LEAF) === indexOfRow(root, BRANCH) + 1 &&
  rowIndent(root, LEAF, 'name') > rowIndent(root, BRANCH, 'name')

/**
 * Пользователь держит строку над свёрнутой веткой на уровне её вложенных строк, пока пауза
 * её не раскроет (ADR 0109).
 */
const pauseOverBranch = async (root: HTMLElement, run: StepRun) => {
  const held: HeldRow = await holdRowAtLevel(root, LEAF, BRANCH, 1, run, 'name')
  // Слот переезжает за указателем: указатель доводится, пока слот не встал под веткой.
  let y = rowOf(root, BRANCH)!.getBoundingClientRect().bottom
  for (let tries = 0; ; tries++) {
    await layoutStill(rowOf(root, BRANCH)!)
    run.signal.throwIfAborted()
    const slot = root.querySelector(DRAG_FILL)!.getBoundingClientRect()
    const branch = rowOf(root, BRANCH)!.getBoundingClientRect()
    if (Math.abs(slot.top - branch.bottom) < 2) break
    if (tries === 12) throw new Error(`Слот не под строкой ${BRANCH}`)
    y += slot.top < branch.top ? 6 : -6
    await held.moveTo({ x: held.xAt(1), y }, 2)
  }
  await pollUntil(() => branchOpen(root), run.signal)
  return held
}

/** Пауза раскрыла ветку, вложенные строки пришли: место доступно. */
const holdInOpenBranch = async (root: HTMLElement, run: StepRun) => {
  releaseChildren()
  const held = await pauseOverBranch(root, run)
  await pollUntil(
    () => skeletonRows(root) === 0 && !placeInvalid(root),
    run.signal,
  )
  return held
}

/** Строка уже в ветке, иначе пользователь переносит её туда. */
const dropIntoBranch = async (root: HTMLElement, run: StepRun) => {
  if (inBranch(root)) return
  const held = await holdInOpenBranch(root, run)
  await held.release()
}

const TREE: readonly GuideStoryStep[] = [
  {
    title: 'Строки с вложенными записями',
    hint: 'Сервер отдаёт строки блоками. У части строк — кнопка раскрытия: их вложенные строки таблица ещё не загружала.',
    props: dragProps({ tree: true }),
    enter: stepAction(async (root, { signal }) => {
      dragServer.auto = false
      releaseChildren()
      await pollUntil(() => !!toggleOf(root, BRANCH), signal)
    }),
  },
  {
    title: 'Пауза над свёрнутой строкой',
    hint: 'Пользователь задержал строку над свёрнутой строкой на уровне её вложенных: пауза раскрыла её, и таблица запросила вложенные строки. Пока они в пути, под строкой — скелеты, а место броска недоступно: облако в тоне ошибки.',
    states: ['drag.rowInvalid', 'body.skeleton'],
    enter: stepAction(async (root, run) => {
      releaseChildren()
      dragServer.holdChildren = true
      await pauseOverBranch(root, run)
      await pollUntil(
        () => skeletonRows(root) > 0 && placeInvalid(root),
        run.signal,
      )
    }),
  },
  {
    title: 'Вложенные строки пришли',
    hint: 'Сервер прислал вложенные строки: место броска стало доступно, слот встал первой вложенной строкой, будущий родитель обведён.',
    states: ['drag.groupParent'],
    enter: stepAction(async (root, run) => {
      await holdInOpenBranch(root, run)
    }),
  },
  {
    title: 'Пользователь отпустил строку',
    hint: 'Строка встала первой вложенной строкой, а сервер ещё сохраняет перенос: ячейки строки чуть темнеют и по ним проходит светлый блик.',
    states: ['drag.pending'],
    enter: stepAction(async (root, run) => {
      await dropIntoBranch(root, run)
      await pollUntil(() => movePending(root, LEAF), run.signal)
    }),
  },
  {
    title: 'Сервер подтвердил',
    hint: 'Сервер сохранил перенос: ожидание снято, строка осталась в ветке и коротко вспыхнула тоном успеха.',
    enter: stepAction(async (root, run) => {
      await dropIntoBranch(root, run)
      await pollUntil(() => dragServer.moves.length > 0, run.signal)
      answerMove(true)
      await pollUntil(() => !movePending(root, LEAF), run.signal)
    }),
  },
]

/** ADR 0159, S3: пауза раскрывает свёрнутую ветку, бросок — после прихода её строк. */
export const ServerDragTree: StoryObj<StoryProps> = {
  name: 'Move into a branch',
  parameters: { scenario: '0159/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Перенос в ветку"
      steps={TREE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0]!.title, async () => {
      await stepDone(canvas)
      await expect(branchOpen(canvas)).toBe(false)
    })
    await step(TREE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(branchOpen(canvas)).toBe(true)
      await expect(placeInvalid(canvas)).toBe(true)
    })
    await step(TREE[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(placeInvalid(canvas)).toBe(false)
      await expect(rowOf(canvas, BRANCH)).toHaveAttribute(
        'data-row-drop-parent',
      )
    })
    await step(TREE[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inBranch(canvas)).toBe(true)
      await expect(indexOfRow(canvas, LEAF)).toBe(
        indexOfRow(canvas, BRANCH) + 1,
      )
    })
    await step(TREE[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(inBranch(canvas)).toBe(true)
      await expect(movePending(canvas, LEAF)).toBe(false)
      await settle()
    })
  },
}

// --- S4: перенос в другую серверную группу -----------------------------------------------

const GROUPED_LEAF = 'item-id-1'
const groupIdOf = (city: string) => `group:${JSON.stringify([city])}`
const FROM_GROUP = groupIdOf('Berlin')
const TO_GROUP = groupIdOf('Lima')

const cityOf = (root: HTMLElement, id: string) =>
  rowOf(root, id)?.querySelector('[data-column-id="city"]')?.textContent ?? ''
const visitsOf = (root: HTMLElement, id: string) =>
  rowOf(root, id)?.querySelector('[data-column-id="visits"]')?.textContent ?? ''
/** Строка — первая в группе Lima. */
const inLima = (root: HTMLElement) =>
  indexOfRow(root, GROUPED_LEAF) === indexOfRow(root, TO_GROUP) + 1

/** Обе группы раскрыты, их строки пришли. */
const openGroups = async (root: HTMLElement, signal: AbortSignal) => {
  for (const id of [FROM_GROUP, TO_GROUP]) {
    await pollUntil(() => !!toggleOf(root, id), signal)
    if (toggleOf(root, id)!.getAttribute('aria-expanded') !== 'true') {
      toggleOf(root, id)!.click()
    }
  }
  await pollUntil(
    () => !!rowOf(root, GROUPED_LEAF) && !!rowOf(root, 'item-id-4'),
    signal,
  )
}

/** Пользователь переносит строку из группы Berlin первой в группу Lima. */
const dropIntoLima = async (root: HTMLElement, run: StepRun) => {
  if (inLima(root)) return
  await openGroups(root, run.signal)
  const held: HeldRow = await holdRowAtLevel(
    root,
    GROUPED_LEAF,
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
    if (Math.abs(slot.top - group.bottom) < 2 && !placeInvalid(root)) break
    if (tries === 12) throw new Error(`Слот не под группой ${TO_GROUP}`)
    y += slot.top < group.top ? 6 : -6
    await held.moveTo({ x: held.xAt(1), y }, 2)
  }
  await held.release()
}

const GROUPS: readonly GuideStoryStep[] = [
  {
    title: 'Строки по городам',
    hint: 'Сервер отдаёт строки, сгруппированные по городу; у каждой группы — число строк в ней. Две группы раскрыты.',
    props: dragProps({ groups: true }),
    enter: stepAction(async (root, { signal }) => {
      dragServer.auto = false
      await openGroups(root, signal)
    }),
  },
  {
    title: 'Пользователь перенёс строку в другой город',
    hint: 'Строка встала первой в другой группе, а сервер ещё сохраняет перенос: ячейки строки чуть темнеют и по ним проходит светлый блик. Город в строке и числа строк групп пока прежние — их меняет приложение, когда сервер ответит.',
    states: ['drag.pending'],
    enter: stepAction(async (root, run) => {
      await dropIntoLima(root, run)
      await pollUntil(() => movePending(root, GROUPED_LEAF), run.signal)
    }),
  },
  {
    title: 'Сервер подтвердил',
    hint: 'Сервер сохранил перенос и сменил город строки. Приложение передало таблице новые данные строки и обеих групп: в строке — новый город, у групп — новые числа строк и итоги. Строка коротко вспыхнула тоном успеха.',
    enter: stepAction(async (root, run) => {
      await dropIntoLima(root, run)
      await pollUntil(() => dragServer.moves.length > 0, run.signal)
      answerMove(true)
      await pollUntil(
        () =>
          !movePending(root, GROUPED_LEAF) &&
          cityOf(root, GROUPED_LEAF) === 'Lima',
        run.signal,
      )
    }),
  },
]

/** ADR 0159, S4: строка переносится в другую серверную группу, приложение меняет группу. */
export const ServerDragGroups: StoryObj<StoryProps> = {
  name: 'Move to another group',
  parameters: { scenario: '0159/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Перенос в другую группу"
      steps={GROUPS}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPS[0]!.title, async () => {
      await stepDone(canvas)
      await expect(cityOf(canvas, GROUPED_LEAF)).toBe('Berlin')
    })
    await step(GROUPS[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inLima(canvas)).toBe(true)
      await expect(cityOf(canvas, GROUPED_LEAF)).toBe('Berlin')
      await expect(cityOf(canvas, FROM_GROUP)).toBe('Berlin (3)')
      await expect(cityOf(canvas, TO_GROUP)).toBe('Lima (3)')
    })
    await step(GROUPS[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(inLima(canvas)).toBe(true)
      await expect(cityOf(canvas, GROUPED_LEAF)).toBe('Lima')
      await expect(cityOf(canvas, FROM_GROUP)).toBe('Berlin (2)')
      await expect(cityOf(canvas, TO_GROUP)).toBe('Lima (4)')
      await expect(visitsOf(canvas, FROM_GROUP)).toBe('17')
      await expect(visitsOf(canvas, TO_GROUP)).toBe('28')
      await expect(movePending(canvas, GROUPED_LEAF)).toBe(false)
      await settle()
    })
  },
}
