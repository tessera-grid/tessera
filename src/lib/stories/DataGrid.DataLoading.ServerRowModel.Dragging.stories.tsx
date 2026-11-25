import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  waitForRows,
  guideNext,
  pollUntil,
  repeat,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  DemoStory,
  type DemoStoryStep,
  type StepRun,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { StoryComponent } from './DataGridStory'
import { hasRow, layout, skeletonRows } from './__mocks__/serverRowModelGuide'
import {
  answerMove,
  dragProps,
  dragServer,
  resetDragServer,
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
import { DRAG_FILL, HANDLE, OVERLAY } from './rowDragging.dnd'

/**
 * Перетаскивание строк в серверной модели (ADR 0159): `Playground` — строки с «сервера»
 * с ручным порядком, ответ «сервера» на перенос и ветки — контролами; S1 — перенос
 * подтверждён, S2 — отказ, S3 — перенос в ветку, S4 — перенос в другую серверную группу.
 * ADR 0189, без перетаскивания: S1 — вложить, S2 — вынести, S3 — ветка не загрузилась, S4 —
 * соседняя группа.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Dragging',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<DemoStoryStep['props']>>[0]

interface DraggingPlaygroundArgs extends StoryProps {
  saveDelayMs: number
  refuseMoves: boolean
  rowShape: 'list' | 'branches' | 'groups'
}

export const ServerDraggingPlayground: StoryObj<DraggingPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['saveDelayMs', 'refuseMoves', 'rowShape'], {
    dataCount: 'the demo server provides the rows',
    columnCount: 'the demo sets the columns',
  }),
  args: { ...layout, saveDelayMs: 800, refuseMoves: false, rowShape: 'list' },
  argTypes: {
    saveDelayMs: {
      description: 'Server response time for a move, ms',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    refuseMoves: {
      description: 'The server rejects moves',
      control: 'boolean',
    },
    rowShape: {
      description:
        'Server rows: a list, child rows under some rows, or groups by city',
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

const atRest: DemoStoryStep = {
  title: { ru: 'Строки с сервера', en: 'Rows from the server' },
  hint: {
    ru: 'Сервер отдаёт строки блоками, порядок строк ручной: строку переносят за ручку.',
    en: 'The server sends rows in blocks, and the row order is manual: a row is moved by its drag handle.',
  },
  props: dragProps(),
}

/** «Сервер» гайдов переноса: подтверждает переносы шагами гайда, а не сам. */
const manualServer = () => {
  resetDragServer()
  dragServer.auto = false
}

/** Пользователь перенёс строку: она на новом месте, «сервер» сохраняет порядок. */
const moveRow = stepAction(async (root, run) => {
  if (indexOfRow(root, MOVED) !== MOVED_TO) {
    await dropRow(root, MOVED, TARGET, run)
  }
  await pollUntil(() => movePending(root, MOVED), run.signal)
})

const moved: DemoStoryStep = {
  title: { ru: 'Пользователь перенёс строку', en: 'The user moved a row' },
  hint: {
    ru: 'Строка сразу встала на новое место, а сервер ещё сохраняет новый порядок: ячейки строки чуть темнеют и по ним проходит светлый блик.',
    en: 'The row took its new place right away, while the server is still saving the new order: the row cells darken slightly, and a light shimmer runs across them.',
  },
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

const MOVE: readonly DemoStoryStep[] = [
  atRest,
  moved,
  {
    title: { ru: 'Сервер подтвердил', en: 'The server confirmed' },
    hint: {
      ru: 'Сервер сохранил новый порядок: ожидание снято, строка осталась на месте и коротко вспыхнула тоном успеха.',
      en: 'The server saved the new order: the pending state is cleared, and the row stayed in place and flashed briefly in the success tone.',
    },
    enter: answer(true),
  },
]

/** ADR 0159, S1: строка сразу на новом месте, сервер подтверждает. */
export const ServerDragMove: StoryObj<StoryProps> = {
  name: 'Move a row',
  parameters: { scenario: '0159/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Перенос на сервере', en: 'Moving on the server' }}
      steps={MOVE}
      reset={manualServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MOVE[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(MOVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO))
      await expect(movePending(canvas, MOVED)).toBe(true)
    })
    await step(MOVE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO))
      await settle()
    })
  },
}

const REFUSED: readonly DemoStoryStep[] = [
  atRest,
  moved,
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не принял перенос: строка вернулась на прежнее место и коротко вспыхнула тоном ошибки.',
      en: 'The server did not accept the move: the row returned to its previous place and flashed briefly in the error tone.',
    },
    states: ['drag.rejected'],
    enter: answer(false),
  },
]

/** ADR 0159, S2: сервер отказал в переносе — строка возвращается со вспышкой. */
export const ServerDragRefused: StoryObj<StoryProps> = {
  name: 'Move refused',
  parameters: { scenario: '0159/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Отказ в переносе', en: 'Move refused' }}
      steps={REFUSED}
      reset={manualServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFUSED[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(indexOfRow(canvas, MOVED)).toBe(MOVED_TO))
    })
    await step(REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(indexOfRow(canvas, MOVED)).toBe(1))
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
    if (tries === 12) throw new Error(`Slot is not under row ${BRANCH}`)
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

const TREE: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Строки с вложенными записями',
      en: 'Rows with child records',
    },
    hint: {
      ru: 'Сервер отдаёт строки блоками. У части строк — кнопка раскрытия: их вложенные строки таблица ещё не загружала.',
      en: 'The server sends rows in blocks. Some rows have an expand button: the table has not loaded their child rows yet.',
    },
    props: dragProps({ tree: true }),
  },
  {
    title: {
      ru: 'Пауза над свёрнутой строкой',
      en: 'A pause over a collapsed row',
    },
    hint: {
      ru: 'Пользователь задержал строку над свёрнутой строкой на уровне её вложенных: пауза раскрыла её, и таблица запросила вложенные строки. Пока они в пути, под строкой — скелеты, а место броска недоступно: облако в тоне ошибки.',
      en: 'The user held the row over a collapsed row at the level of its children: the pause expanded it, and the table requested the child rows. While they are on the way, skeletons sit under the row, and the drop position is unavailable: the drag preview is in the error tone.',
    },
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
    title: { ru: 'Вложенные строки пришли', en: 'The child rows arrived' },
    hint: {
      ru: 'Сервер прислал вложенные строки: место броска стало доступно, слот встал первой вложенной строкой, будущий родитель обведён.',
      en: 'The server sent the child rows: the drop position became available, the slot took the first child position, and the future parent is outlined.',
    },
    states: ['drag.groupParent'],
    enter: stepAction(async (root, run) => {
      await holdInOpenBranch(root, run)
    }),
  },
  {
    title: {
      ru: 'Пользователь отпустил строку',
      en: 'The user dropped the row',
    },
    hint: {
      ru: 'Строка встала первой вложенной строкой, а сервер ещё сохраняет перенос: ячейки строки чуть темнеют и по ним проходит светлый блик.',
      en: 'The row became the first child row, while the server is still saving the move: the row cells darken slightly, and a light shimmer runs across them.',
    },
    states: ['drag.pending'],
    enter: stepAction(async (root, run) => {
      await dropIntoBranch(root, run)
      await pollUntil(() => movePending(root, LEAF), run.signal)
    }),
  },
  {
    title: { ru: 'Сервер подтвердил', en: 'The server confirmed' },
    hint: {
      ru: 'Сервер сохранил перенос: ожидание снято, строка осталась в ветке и коротко вспыхнула тоном успеха.',
      en: 'The server saved the move: the pending state is cleared, and the row stayed in the branch and flashed briefly in the success tone.',
    },
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
    <DemoStory
      title={{ ru: 'Перенос в ветку', en: 'Moving into a branch' }}
      steps={TREE}
      reset={() => {
        manualServer()
        releaseChildren()
      }}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(TREE[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(branchOpen(canvas)).toBe(false))
    })
    await step(TREE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(branchOpen(canvas)).toBe(true)
      await expect(placeInvalid(canvas)).toBe(true)
    })
    await step(TREE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(placeInvalid(canvas)).toBe(false)
      await expect(rowOf(canvas, BRANCH)).toHaveAttribute(
        'data-row-drop-parent',
      )
    })
    await step(TREE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inBranch(canvas)).toBe(true)
      await expect(indexOfRow(canvas, LEAF)).toBe(
        indexOfRow(canvas, BRANCH) + 1,
      )
    })
    await step(TREE[4]!.title.ru, async () => {
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
    if (tries === 12) throw new Error(`Slot is not under group ${TO_GROUP}`)
    y += slot.top < group.top ? 6 : -6
    await held.moveTo({ x: held.xAt(1), y }, 2)
  }
  await held.release()
}

const GROUPS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Строки по городам', en: 'Rows by city' },
    hint: {
      ru: 'Сервер отдаёт строки, сгруппированные по городу; у каждой группы — число строк в ней. Группы свёрнуты.',
      en: 'The server sends rows grouped by city; each group shows how many rows it has. The groups are collapsed.',
    },
    props: dragProps({ groups: true }),
  },
  {
    title: {
      ru: 'Пользователь раскрыл две группы',
      en: 'The user expanded two groups',
    },
    hint: {
      ru: 'Пользователь раскрыл две группы: их строки видны в таблице.',
      en: 'The user expanded two groups: their rows are visible in the table.',
    },
    enter: stepAction(async (root, { signal }) => {
      dragServer.auto = false
      await openGroups(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь перенёс строку в другой город',
      en: 'The user moved a row to another city',
    },
    hint: {
      ru: 'Строка встала первой в другой группе, а сервер ещё сохраняет перенос: ячейки строки чуть темнеют и по ним проходит светлый блик. Город в строке и числа строк групп пока прежние — их меняет приложение, когда сервер ответит.',
      en: 'The row became the first row in the other group, while the server is still saving the move: the row cells darken slightly, and a light shimmer runs across them. The city in the row and the group row counts are unchanged for now: the app will update them when the server responds.',
    },
    states: ['drag.pending'],
    enter: stepAction(async (root, run) => {
      await dropIntoLima(root, run)
      await pollUntil(() => movePending(root, GROUPED_LEAF), run.signal)
    }),
  },
  {
    title: { ru: 'Сервер подтвердил', en: 'The server confirmed' },
    hint: {
      ru: 'Сервер сохранил перенос и сменил город строки. Приложение передало таблице новые данные строки и обеих групп: в строке — новый город, у групп — новые числа строк и итоги. Строка коротко вспыхнула тоном успеха.',
      en: 'The server saved the move and changed the city of the row. The app passed the table new data for the row and both groups: the row has the new city, and the groups have new row counts and totals. The row flashed briefly in the success tone.',
    },
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
    <DemoStory
      title={{ ru: 'Перенос в другую группу', en: 'Moving to another group' }}
      steps={GROUPS}
      reset={manualServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(GROUPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(GROUPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(cityOf(canvas, GROUPED_LEAF)).toBe('Berlin')
    })
    await step(GROUPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(document.querySelector(OVERLAY)).toBeNull())
      await expect(inLima(canvas)).toBe(true)
      await expect(cityOf(canvas, GROUPED_LEAF)).toBe('Berlin')
      await expect(cityOf(canvas, FROM_GROUP)).toBe('Berlin (3)')
      await expect(cityOf(canvas, TO_GROUP)).toBe('Lima (3)')
    })
    await step(GROUPS[3]!.title.ru, async () => {
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

// --- ADR 0189: перенос без перетаскивания ---------------------------------------------

/** Строка под свёрнутой веткой `BRANCH`. */
const NEXT_TO_BRANCH = 'item-id-4'
const CHILD = `${BRANCH}.1`
const BRANCH_BLOCK = 4

const openMenuOf = () => document.querySelector('[role="menu"]')
const menuItem = (id: string) =>
  document.querySelector<HTMLElement>(
    `[role="menuitem"][data-action-id="${id}"]`,
  )
const nested = (root: HTMLElement, id: string) =>
  rowIndent(root, id, 'name') > rowIndent(root, BRANCH, 'name')

/** Пользователь открыл меню ручки строки. */
const openHandleMenu = async (
  root: HTMLElement,
  id: string,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!rowOf(root, id), signal)
  await repeat(
    () => !!openMenuOf(),
    () => rowOf(root, id)!.querySelector<HTMLElement>(HANDLE)!.click(),
    signal,
  )
}

/** Пользователь выбрал вложение: ветка раскрылась, строка ждёт её строк. */
const indentRow = async (root: HTMLElement, signal: AbortSignal) => {
  if (branchOpen(root)) return
  // Придержать только ветку: строки верхнего уровня открытой заново таблицы — сперва.
  await pollUntil(() => !!rowOf(root, NEXT_TO_BRANCH), signal)
  dragServer.holdChildren = true
  await openHandleMenu(root, NEXT_TO_BRANCH, signal)
  menuItem('indent')!.click()
  await pollUntil(
    () => branchOpen(root) && movePending(root, NEXT_TO_BRANCH),
    signal,
  )
}

const collapsedBranch: DemoStoryStep = {
  title: {
    ru: 'Дерево со свёрнутыми ветками',
    en: 'A tree with collapsed branches',
  },
  hint: {
    ru: 'Рядом со строкой свёрнутая ветка, её строки сервер ещё не присылал.',
    en: 'Next to the row is a collapsed branch whose rows the server has not sent yet.',
  },
  // Блок короче экрана: скелеты ветки не уводят строку из виду.
  props: dragProps({ tree: true, blockSize: BRANCH_BLOCK }),
}

/** «Сервер» гайдов вложения: сам подтверждает переносы и отдаёт вложенные строки. */
const autoServer = () => {
  resetDragServer()
  dragServer.auto = true
}

const INDENT: readonly DemoStoryStep[] = [
  collapsedBranch,
  {
    title: {
      ru: 'Пользователь открыл меню ручки',
      en: 'The user opened the drag handle menu',
    },
    hint: {
      ru: 'Перенос доступен и без перетаскивания: меню предлагает вложить строку в ветку выше.',
      en: 'Moving works without dragging too: the menu offers to nest the row into the branch above.',
    },
    enter: stepAction(async (root, { signal }) => {
      await openHandleMenu(root, NEXT_TO_BRANCH, signal)
    }),
  },
  {
    title: { ru: 'Строка ждёт ветку', en: 'The row waits for the branch' },
    hint: {
      ru: 'Таблица раскрыла ветку и запросила её строки. Пока они идут, строка занята.',
      en: 'The table expanded the branch and requested its rows. While they are on the way, the row is busy.',
    },
    states: ['drag.pending'],
    enter: stepAction(async (root, { signal }) => {
      await indentRow(root, signal)
    }),
  },
  {
    title: { ru: 'Строка вложена', en: 'The row is nested' },
    hint: {
      ru: 'Сервер прислал ветку, строка встала в ней последней и коротко вспыхнула.',
      en: 'The server sent the branch, and the row took the last place in it and flashed briefly.',
    },
    enter: stepAction(async (root, { signal }) => {
      await indentRow(root, signal)
      releaseChildren()
      await pollUntil(
        () =>
          nested(root, NEXT_TO_BRANCH) && !movePending(root, NEXT_TO_BRANCH),
        signal,
      )
    }),
  },
]

/** ADR 0189, S1: строка вкладывается без перетаскивания, свёрнутая ветка раскрывается. */
export const ServerRowIndent: StoryObj<StoryProps> = {
  name: 'Indent a row',
  parameters: { scenario: '0189/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Вложить строку', en: 'Nest a row' }}
      steps={INDENT}
      reset={autoServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(INDENT[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await until(() => expect(branchOpen(canvas)).toBe(false))
    })
    await step(INDENT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(menuItem('indent')).not.toBeNull())
      await until(() =>
        expect(menuItem('outdent')).toHaveAttribute('aria-disabled', 'true'),
      )
    })
    await step(INDENT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(branchOpen(canvas)).toBe(true))
      await until(() => expect(movePending(canvas, NEXT_TO_BRANCH)).toBe(true))
    })
    await step(INDENT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(nested(canvas, NEXT_TO_BRANCH)).toBe(true))
      await settle()
    })
  },
}

/** Пользователь раскрывает ветку, в которой лежит строка. */
const openChildBranch = async (root: HTMLElement, signal: AbortSignal) => {
  dragServer.auto = true
  releaseChildren()
  await pollUntil(() => !!toggleOf(root, BRANCH), signal)
  if (!branchOpen(root)) toggleOf(root, BRANCH)!.click()
  await pollUntil(() => !!rowOf(root, CHILD), signal)
}

const OUTDENT: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Ветки свёрнуты', en: 'Branches are collapsed' },
    hint: {
      ru: 'Сервер отдаёт строки блоками. У части строк — свёрнутые ветки с вложенными строками.',
      en: 'The server sends rows in blocks. Some rows have collapsed branches with child rows.',
    },
    props: dragProps({ tree: true }),
  },
  {
    title: {
      ru: 'Пользователь раскрыл ветку',
      en: 'The user expanded a branch',
    },
    hint: {
      ru: 'Пользователь раскрыл ветку: строка лежит внутри неё.',
      en: 'The user expanded a branch: the row is inside it.',
    },
    enter: stepAction((root, { signal }) => openChildBranch(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь открыл меню ручки',
      en: 'The user opened the drag handle menu',
    },
    hint: {
      ru: 'У вложенной строки меню предлагает вынести её.',
      en: 'For a child row, the menu offers to move it out.',
    },
    enter: stepAction(async (root, { signal }) => {
      await openChildBranch(root, signal)
      await openHandleMenu(root, CHILD, signal)
    }),
  },
  {
    title: { ru: 'Строка вынесена', en: 'The row was moved out' },
    hint: {
      ru: 'Строка встала сразу за прежней веткой, на её уровень.',
      en: 'The row moved right after its former branch, to the same level as the branch.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!rowOf(root, CHILD)) await openChildBranch(root, signal)
      if (nested(root, CHILD)) {
        await openHandleMenu(root, CHILD, signal)
        menuItem('outdent')!.click()
      }
      await pollUntil(
        () => !nested(root, CHILD) && !movePending(root, CHILD),
        signal,
      )
    }),
  },
]

/** ADR 0189, S2: строка выносится на уровень выше без перетаскивания. */
export const ServerRowOutdent: StoryObj<StoryProps> = {
  name: 'Outdent a row',
  parameters: { scenario: '0189/S2', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Вынести строку', en: 'Move a row out' }}
      steps={OUTDENT}
      reset={autoServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OUTDENT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(OUTDENT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(nested(canvas, CHILD)).toBe(true))
    })
    await step(OUTDENT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(menuItem('outdent')).not.toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      )
    })
    await step(OUTDENT[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(nested(canvas, CHILD)).toBe(false))
      await settle()
    })
  },
}

const INDENT_REFUSED: readonly DemoStoryStep[] = [
  collapsedBranch,
  {
    title: { ru: 'Строка ждёт ветку', en: 'The row waits for the branch' },
    hint: {
      ru: 'Таблица раскрыла ветку и запросила её строки.',
      en: 'The table expanded the branch and requested its rows.',
    },
    states: ['drag.pending'],
    enter: stepAction(async (root, { signal }) => {
      await indentRow(root, signal)
    }),
  },
  {
    title: { ru: 'Ветка не загрузилась', en: 'The branch did not load' },
    hint: {
      ru: 'Сервер не отдал строки. Перенос отменён, строка на месте, вспышка и объявление говорят об отказе.',
      en: 'The server did not return the rows. The move is cancelled, the row stays in place, and a flash and an announcement report the refusal.',
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await indentRow(root, signal)
      dragServer.failChildren = true
      releaseChildren()
      await pollUntil(() => !movePending(root, NEXT_TO_BRANCH), signal)
    }),
  },
]

/** ADR 0189, S3: ветка не загрузилась, строка осталась на месте. */
export const ServerRowIndentRefused: StoryObj<StoryProps> = {
  name: 'Branch refused',
  parameters: { scenario: '0189/S3', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'Ветка не загрузилась', en: 'The branch did not load' }}
      steps={INDENT_REFUSED}
      reset={autoServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(INDENT_REFUSED[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(INDENT_REFUSED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(movePending(canvas, NEXT_TO_BRANCH)).toBe(true))
    })
    await step(INDENT_REFUSED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(movePending(canvas, NEXT_TO_BRANCH)).toBe(false))
      await until(() => expect(nested(canvas, NEXT_TO_BRANCH)).toBe(false))
      await settle()
    })
  },
}

const openFromGroup = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!toggleOf(root, FROM_GROUP), signal)
  if (toggleOf(root, FROM_GROUP)!.getAttribute('aria-expanded') !== 'true') {
    toggleOf(root, FROM_GROUP)!.click()
  }
  await pollUntil(() => !!rowOf(root, GROUPED_LEAF), signal)
}

const NEXT_GROUP: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Группы свёрнуты', en: 'Groups are collapsed' },
    hint: {
      ru: 'Сервер отдаёт строки, сгруппированные по городу.',
      en: 'The server sends rows grouped by city.',
    },
    props: dragProps({ groups: true }),
  },
  {
    title: {
      ru: 'Пользователь раскрыл группу',
      en: 'The user expanded a group',
    },
    hint: {
      ru: 'Пользователь раскрыл группу: строка лежит в ней, рядом другая группа того же уровня.',
      en: 'The user expanded a group: the row is in it, and another group at the same level is next to it.',
    },
    enter: stepAction(async (root, { signal }) => {
      dragServer.auto = true
      await openFromGroup(root, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь открыл меню ручки',
      en: 'The user opened the drag handle menu',
    },
    hint: {
      ru: 'Лист можно перенести в соседнюю группу без перетаскивания.',
      en: 'A leaf row can be moved to the adjacent group without dragging.',
    },
    enter: stepAction(async (root, { signal }) => {
      await openFromGroup(root, signal)
      await openHandleMenu(root, GROUPED_LEAF, signal)
    }),
  },
  {
    title: {
      ru: 'Строка в соседней группе',
      en: 'The row is in the adjacent group',
    },
    hint: {
      ru: 'Группа раскрылась, строка встала в неё, приложение получило значения обеих групп.',
      en: 'The group expanded, the row moved into it, and the app received the values of both groups.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (!rowOf(root, GROUPED_LEAF)) await openFromGroup(root, signal)
      if (cityOf(root, GROUPED_LEAF) !== 'Lima') {
        await openHandleMenu(root, GROUPED_LEAF, signal)
        menuItem('moveToNextGroup')!.click()
      }
      await pollUntil(
        () =>
          cityOf(root, GROUPED_LEAF) === 'Lima' &&
          !movePending(root, GROUPED_LEAF),
        signal,
      )
    }),
  },
]

/** ADR 0189, S4: лист переносится в соседнюю группу из меню ручки. */
export const ServerRowNextGroup: StoryObj<StoryProps> = {
  name: 'Move to the next group',
  parameters: { scenario: '0189/S4', ...guideControls() },
  render: args => (
    <DemoStory
      title={{ ru: 'В соседнюю группу', en: 'To the adjacent group' }}
      steps={NEXT_GROUP}
      reset={autoServer}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NEXT_GROUP[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(NEXT_GROUP[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(cityOf(canvas, GROUPED_LEAF)).toBe('Berlin'))
    })
    await step(NEXT_GROUP[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(menuItem('moveToNextGroup')).not.toBeNull())
      await until(() =>
        expect(menuItem('moveToPreviousGroup')).toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      )
    })
    await step(NEXT_GROUP[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(cityOf(canvas, GROUPED_LEAF)).toBe('Lima'))
      await settle()
    })
  },
}
