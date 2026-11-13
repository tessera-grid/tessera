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
import { layout, hasRow, refreshing } from './__mocks__/serverRowModelGuide'
import {
  childrenOf,
  indexOfRow,
  liveStream,
  liveTick,
  newItem,
  rowById,
  transact,
  txProps,
  txRelease,
  txServer,
  wait,
} from './__mocks__/serverTransactionsGuide'

/**
 * Транзакции строк серверной модели (ADR 0157): `Playground` — строки с «сервера», поток
 * его изменений и их период — контролами; S1–S4 — вставка на место, удаление выбранных,
 * поток изменений, вставка без места.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Server row model/Transactions',
} satisfies Meta<StoryProps>

export default meta

/** Контекст шага гайда, которого у `Playground` нет: фабрики «сервера» его не читают. */
const AT_REST = {} as Parameters<NonNullable<GuideStoryStep['props']>>[0]

interface TransactionsPlaygroundArgs extends StoryProps {
  liveUpdates: boolean
  liveIntervalMs: number
}

export const ServerTransactionsPlayground: StoryObj<TransactionsPlaygroundArgs> =
  {
    name: 'Playground',
    parameters: showControls(['liveUpdates', 'liveIntervalMs'], {
      dataCount: 'строки подаёт «сервер» демо',
      columnCount: 'колонки задаёт демо',
    }),
    args: { ...layout, liveUpdates: false, liveIntervalMs: 1000 },
    argTypes: {
      liveUpdates: {
        description:
          'Сервер шлёт поток изменений: новые, изменённые и удалённые записи',
        control: 'boolean',
      },
      liveIntervalMs: {
        description: 'Период изменений «сервера», мс',
        control: { type: 'range', min: 200, max: 3000, step: 100 },
        if: { arg: 'liveUpdates' },
      },
    },
    render: ({ liveUpdates, liveIntervalMs, ...args }) => (
      <StoryComponent
        {...normalizeArgs(args)}
        {...txProps(liveUpdates ? [liveStream(liveIntervalMs)] : [])!(AT_REST)}
      />
    ),
    // Снимок — в покое: первое окно пришло, поток выключен.
    play: async ({ canvasElement: canvas, globals }) => {
      if (globals.catalog !== true) return
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
      await settle()
    },
  }

/** Первый шаг каждого гайда: окно пришло с «сервера». */
const atRest = (hint: string, props = txProps()): GuideStoryStep => ({
  title: 'Строки с сервера',
  hint,
  props,
})

// --- S1: вставка на место ------------------------------------------------------------

const ADD_AT = 3
const ADDED = 'item-new-1'
/** Строка, чью ветку раскрывает пользователь, и место новой записи в ветке. */
const BRANCH = 'item-id-1'
const CHILD_AT = 1
const CHILD = 'item-new-2'

/** Пользователь добавил запись: сервер сохранил её и вернул место в списке. */
const addRecord = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => hasRow(root, 0), signal)
  if (!txServer.items.some(item => item.id === ADDED)) {
    const item = newItem()
    txServer.items.splice(ADD_AT, 0, item)
    transact({ add: [item], index: ADD_AT })
  }
  // Раскрытая выше ветка сдвигает запись: место проверяет `play` шага.
  await pollUntil(() => !!rowById(root, ADDED), signal)
}

const toggleOf = (root: HTMLElement, id: string) =>
  rowById(root, id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const branchShown = (root: HTMLElement) => !!rowById(root, `${BRANCH}.0`)

/** Пользователь раскрыл строку: вложенные строки пришли с «сервера». */
const expandBranch = async (root: HTMLElement, signal: AbortSignal) => {
  await addRecord(root, signal)
  if (toggleOf(root, BRANCH)?.getAttribute('aria-expanded') !== 'true') {
    toggleOf(root, BRANCH)!.click()
  }
  await pollUntil(() => branchShown(root), signal)
}

/** Пользователь добавил запись в раскрытую ветку: сервер вернул её место в ветке. */
const addChild = async (root: HTMLElement, signal: AbortSignal) => {
  await expandBranch(root, signal)
  const children = childrenOf(BRANCH)
  if (!children.some(item => item.id === CHILD)) {
    const item = newItem()
    children.splice(CHILD_AT, 0, item)
    transact({ add: [item], index: CHILD_AT, parentId: BRANCH })
  }
  await pollUntil(
    () => indexOfRow(root, CHILD) === indexOfRow(root, BRANCH) + 1 + CHILD_AT,
    signal,
  )
}

const ADD: readonly GuideStoryStep[] = [
  atRest(
    'Сервер отдаёт строки блоками. Когда пользователь добавляет запись, сервер сохраняет её и сообщает приложению её место в списке.',
    txProps([], true),
  ),
  {
    title: 'Пользователь добавил запись',
    hint: 'Сервер сохранил запись и вернул её место — четвёртая строка. Таблица вставила её туда без нового запроса: строки ниже съехали на одну, новая строка коротко вспыхнула.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await addRecord(root, signal)
    }),
  },
  {
    title: 'Пользователь раскрыл строку',
    hint: 'Вложенные строки пришли с сервера и встали под родителем с отступом уровня.',
    enter: stepAction(async (root, { signal }) => {
      await expandBranch(root, signal)
    }),
  },
  {
    title: 'Запись в раскрытой ветке',
    hint: 'Пользователь добавил вложенную запись. Сервер вернул её место внутри ветки — вторая. Таблица вставила её туда без нового запроса: строки ниже съехали, новая строка вспыхнула.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await addChild(root, signal)
    }),
  },
]

/** ADR 0157, S1: запись встаёт на место, которое вернул сервер, — и в раскрытой ветке. */
export const ServerTransactionAdd: StoryObj<StoryProps> = {
  name: 'Add a row',
  parameters: { scenario: '0157/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Новая запись"
      steps={ADD}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ADD[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(ADD[1]!.title, async () => {
      const requests = txServer.requests
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, ADDED)).toBe(ADD_AT)
      await expect(indexOfRow(canvas, 'item-id-3')).toBe(ADD_AT + 1)
      await expect(txServer.requests).toBe(requests)
      await settle()
    })
    await step(ADD[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, `${BRANCH}.0`)).toBe(
        indexOfRow(canvas, BRANCH) + 1,
      )
      await settle()
    })
    await step(ADD[3]!.title, async () => {
      const requests = txServer.requests
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, `${BRANCH}.1`)).toBe(
        indexOfRow(canvas, CHILD) + 1,
      )
      await expect(txServer.requests).toBe(requests)
      await settle()
    })
  },
}

// --- S2: удаление выбранных ----------------------------------------------------------

/** Строки, которые выбирает и удаляет пользователь. */
const DOOMED = ['item-id-1', 'item-id-2', 'item-id-4']

const checkboxOf = (root: HTMLElement, id: string) =>
  rowById(root, id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
const isChecked = (element: Element | null) =>
  !!element?.hasAttribute('data-checked')
const selectedCount = (root: HTMLElement) =>
  root
    .querySelector('[data-testid="selected-rows-count"]')
    ?.textContent?.trim() ?? ''

/** Пользователь отмечает строки флажками. */
const checkDoomed = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!checkboxOf(root, DOOMED[0]!), signal)
  for (const id of DOOMED) {
    if (!isChecked(checkboxOf(root, id))) checkboxOf(root, id)!.click()
    await pollUntil(() => isChecked(checkboxOf(root, id)), signal)
  }
}

const REMOVE: readonly GuideStoryStep[] = [
  atRest(
    'Сервер отдаёт строки блоками, у каждой строки — флажок выбора. Пока ничего не выбрано.',
    context => ({
      ...txProps()!(context),
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
    }),
  ),
  {
    title: 'Пользователь выбрал строки',
    hint: 'Пользователь отметил три строки, нижняя панель считает выбранные.',
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await checkDoomed(root, signal)
    }),
  },
  {
    title: 'Сервер удалил строки',
    hint: 'Пользователь удалил выбранные строки, сервер подтвердил. Таблица убрала их без нового запроса: удалённые строки погасли на своих местах, затем строки ниже поднялись и закрыли промежутки. Выбор снят, итог уменьшился на три.',
    enter: stepAction(async (root, { signal }) => {
      if (txServer.items.some(item => item.id === DOOMED[0])) {
        await checkDoomed(root, signal)
        txServer.items = txServer.items.filter(
          item => !DOOMED.includes(item.id),
        )
        transact({ remove: DOOMED })
      }
      await pollUntil(
        () => DOOMED.every(id => !rowById(root, id)) && !selectedCount(root),
        signal,
      )
    }),
  },
]

/** ADR 0157, S2: выбранные строки уходят, выбор и итог пересчитаны. */
export const ServerTransactionRemove: StoryObj<StoryProps> = {
  name: 'Remove selected rows',
  parameters: { scenario: '0157/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Удаление строк"
      steps={REMOVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REMOVE[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(REMOVE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectedCount(canvas)).toContain('3')
    })
    await step(REMOVE[2]!.title, async () => {
      const requests = txServer.requests
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, 'item-id-3')).toBe(1)
      await expect(indexOfRow(canvas, 'item-id-5')).toBe(2)
      await expect(txServer.requests).toBe(requests)
      await settle()
    })
  },
}

// --- S3: поток изменений -------------------------------------------------------------

const LIVE_TICKS = 4
const LIVE_TICK_MS = 800

const LIVE: readonly GuideStoryStep[] = [
  atRest(
    'Сервер отдаёт строки блоками. Данные на сервере меняют и другие пользователи, сервер сообщает о каждом изменении.',
  ),
  {
    title: 'Сервер шлёт изменения',
    hint: 'Сервер сообщает о новых, изменённых и удалённых записях, приложение передаёт их таблице по мере прихода. Новые строки встают на свои места и вспыхивают, изменённые обновляются на месте, удалённые уходят. Изменения одного кадра таблица применяет вместе, перезапросов нет.',
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
      for (let tick = txServer.created + 1; tick <= LIVE_TICKS; tick++) {
        await wait(LIVE_TICK_MS, signal)
        liveTick(tick)
      }
      await pollUntil(() => !!rowById(root, `item-new-${LIVE_TICKS}`), signal)
    }),
  },
]

/** ADR 0157, S3: поток изменений — строки появляются, меняются и уходят. */
export const ServerTransactionLive: StoryObj<StoryProps> = {
  name: 'Live updates',
  parameters: { scenario: '0157/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Живые данные"
      steps={LIVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LIVE[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(LIVE[1]!.title, async () => {
      const requests = txServer.requests
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, `item-new-${LIVE_TICKS}`)).toBe(1)
      await expect(rowById(canvas, 'item-new-1')).toBeNull()
      await expect(txServer.requests).toBe(requests)
      await settle()
    })
  },
}

// --- S4: вставка без места -----------------------------------------------------------

/** Место, куда «сервер» ставит запись по своему порядку. */
const SERVER_PLACE = 2
const REFETCHED = 'item-new-1'

/** Приложение передаёт запись без места: таблица перезапрашивает окно. */
const addWithoutPlace = () => {
  if (txServer.items.some(item => item.id === REFETCHED)) return
  const item = newItem()
  txServer.items.splice(SERVER_PLACE, 0, item)
  transact({ add: [item] })
}

const REFETCH: readonly GuideStoryStep[] = [
  atRest(
    'Сервер отдаёт строки блоками и сам решает порядок списка: где окажется новая запись, приложение не знает.',
  ),
  {
    title: 'Приложение добавило запись без места',
    hint: 'Приложение передало новую запись, но её место знает только сервер. Таблица тихо перезапросила видимые строки: прежние остаются на экране под свечением обновления.',
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
      txServer.hold = true
      addWithoutPlace()
      await pollUntil(() => refreshing(root), signal)
    }),
  },
  {
    title: 'Сервер ответил',
    hint: 'Ответ пришёл: новая запись встала на своё место в списке и коротко вспыхнула, итог вырос на одну.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
      txServer.hold = false
      addWithoutPlace()
      txRelease()
      await pollUntil(
        () => indexOfRow(root, REFETCHED) === SERVER_PLACE && !refreshing(root),
        signal,
      )
    }),
  },
]

/** ADR 0157, S4: запись без места — тихий перезапрос окна. */
export const ServerTransactionRefetch: StoryObj<StoryProps> = {
  name: 'Add a row without a place',
  parameters: { scenario: '0157/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Запись без места"
      steps={REFETCH}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFETCH[0]!.title, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(REFETCH[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, 2)).toBe(true)
    })
    await step(REFETCH[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, 'item-id-2')).toBe(SERVER_PLACE + 1)
      await settle()
    })
  },
}
