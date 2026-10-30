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
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { StoryComponent } from './DataGridStory'
import { hasRow, layout } from './__mocks__/serverRowModelGuide'
import {
  answerMove,
  dragProps,
  dragServer,
  dropRow,
  indexOfRow,
  movePending,
} from './__mocks__/serverDraggingGuide'

/**
 * Перетаскивание строк в серверной модели (ADR 0159): `Playground` — строки с «сервера»
 * с ручным порядком, ответ «сервера» на перенос — контролами; S1 — перенос подтверждён,
 * S2 — отказ.
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
}

export const ServerDraggingPlayground: StoryObj<DraggingPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(['saveDelayMs', 'refuseMoves'], {
    dataCount: 'строки подаёт «сервер» демо',
    columnCount: 'колонки задаёт демо',
  }),
  args: { ...layout, saveDelayMs: 800, refuseMoves: false },
  argTypes: {
    saveDelayMs: {
      description: 'Время ответа «сервера» на перенос, мс',
      control: { type: 'range', min: 0, max: 3000, step: 100 },
    },
    refuseMoves: {
      description: '«Сервер» отклоняет переносы',
      control: 'boolean',
    },
  },
  render: ({ saveDelayMs, refuseMoves, ...args }) => {
    dragServer.auto = true
    dragServer.refuse = refuseMoves
    return (
      <StoryComponent
        {...normalizeArgs(args)}
        {...dragProps({ delayMs: saveDelayMs })!(AT_REST)}
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
  hint: 'Строка сразу встала на новое место, а сервер ещё сохраняет новый порядок: по ручке бежит дуга ожидания.',
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
    hint: 'Сервер сохранил новый порядок: дуга погасла, строка осталась на месте и коротко вспыхнула тоном успеха.',
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
    hint: 'Сервер не принял перенос: строка вернулась на прежнее место, ручка отмечена отказом, строка коротко вспыхнула тоном ошибки.',
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
