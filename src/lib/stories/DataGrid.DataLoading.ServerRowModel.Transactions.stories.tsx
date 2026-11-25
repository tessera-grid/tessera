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
  DemoStory,
  type DemoStoryStep,
  guideArgs,
  stepAction,
} from './demos/DemoStory'
import { StoryComponent } from './DataGridStory'
import type { StoryText } from './__mocks__/storyText'
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
const AT_REST = {} as Parameters<NonNullable<DemoStoryStep['props']>>[0]

interface TransactionsPlaygroundArgs extends StoryProps {
  liveUpdates: boolean
  liveIntervalMs: number
}

export const ServerTransactionsPlayground: StoryObj<TransactionsPlaygroundArgs> =
  {
    name: 'Playground',
    parameters: showControls(['liveUpdates', 'liveIntervalMs'], {
      dataCount: 'the demo server supplies the rows',
      columnCount: 'the demo sets the columns',
    }),
    args: { ...layout, liveUpdates: false, liveIntervalMs: 1000 },
    argTypes: {
      liveUpdates: {
        description:
          'The server streams changes: new, changed and deleted records',
        control: 'boolean',
      },
      liveIntervalMs: {
        description: 'Interval between server changes, ms',
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
const atRest = (hint: StoryText, props = txProps()): DemoStoryStep => ({
  title: { ru: 'Строки с сервера', en: 'Rows from the server' },
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

const ADD: readonly DemoStoryStep[] = [
  atRest(
    {
      ru: 'Сервер отдаёт строки блоками. Когда пользователь добавляет запись, сервер сохраняет её и сообщает приложению её место в списке.',
      en: 'The server returns rows in blocks. When the user adds a record, the server saves it and tells the app where it goes in the list.',
    },
    txProps([], true),
  ),
  {
    title: { ru: 'Пользователь добавил запись', en: 'The user added a record' },
    hint: {
      ru: 'Сервер сохранил запись и вернул её место — четвёртая строка. Таблица вставила её туда без нового запроса: строки ниже съехали на одну, новая строка коротко вспыхнула.',
      en: 'The server saved the record and returned its position: the fourth row. The table inserted it there without a new request: the rows below moved down by one, and the new row flashed briefly.',
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await addRecord(root, signal)
    }),
  },
  {
    title: { ru: 'Пользователь раскрыл строку', en: 'The user expanded a row' },
    hint: {
      ru: 'Вложенные строки пришли с сервера и встали под родителем с отступом уровня.',
      en: 'The child rows arrived from the server and appeared under the parent, indented one level.',
    },
    enter: stepAction(async (root, { signal }) => {
      await expandBranch(root, signal)
    }),
  },
  {
    title: {
      ru: 'Запись в раскрытой ветке',
      en: 'A record in an expanded branch',
    },
    hint: {
      ru: 'Пользователь добавил вложенную запись. Сервер вернул её место внутри ветки — вторая. Таблица вставила её туда без нового запроса: строки ниже съехали, новая строка вспыхнула.',
      en: 'The user added a nested record. The server returned its position inside the branch: the second row. The table inserted it there without a new request: the rows below moved down, and the new row flashed.',
    },
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
    <DemoStory
      title={{ ru: 'Новая запись', en: 'A new record' }}
      steps={ADD}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ADD[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(ADD[1]!.title.ru, async () => {
      const requests = txServer.requests
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, ADDED)).toBe(ADD_AT)
      await expect(indexOfRow(canvas, 'item-id-3')).toBe(ADD_AT + 1)
      await expect(txServer.requests).toBe(requests)
      await settle()
    })
    await step(ADD[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, `${BRANCH}.0`)).toBe(
        indexOfRow(canvas, BRANCH) + 1,
      )
      await settle()
    })
    await step(ADD[3]!.title.ru, async () => {
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

const REMOVE: readonly DemoStoryStep[] = [
  atRest(
    {
      ru: 'Сервер отдаёт строки блоками, у каждой строки — флажок выбора. Пока ничего не выбрано.',
      en: 'The server returns rows in blocks, and each row has a selection checkbox. Nothing is selected yet.',
    },
    context => ({
      ...txProps()!(context),
      enableRowSelection: true,
      rowSelectionSelectedCount: true,
    }),
  ),
  {
    title: { ru: 'Пользователь выбрал строки', en: 'The user selected rows' },
    hint: {
      ru: 'Пользователь отметил три строки, нижняя панель считает выбранные.',
      en: 'The user checked three rows, and the status bar counts the selected ones.',
    },
    states: ['body.selection'],
    enter: stepAction(async (root, { signal }) => {
      await checkDoomed(root, signal)
    }),
  },
  {
    title: { ru: 'Сервер удалил строки', en: 'The server deleted the rows' },
    hint: {
      ru: 'Пользователь удалил выбранные строки, сервер подтвердил. Таблица убрала их без нового запроса: удалённые строки погасли на своих местах, затем строки ниже поднялись и закрыли промежутки. Выбор снят, итог уменьшился на три.',
      en: 'The user deleted the selected rows, and the server confirmed the deletion. The table removed them without a new request: the deleted rows faded out in place, then the rows below moved up to close the gaps. The selection is cleared, and the total dropped by three.',
    },
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
    <DemoStory
      title={{ ru: 'Удаление строк', en: 'Deleting rows' }}
      steps={REMOVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REMOVE[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(REMOVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(selectedCount(canvas)).toContain('3')
    })
    await step(REMOVE[2]!.title.ru, async () => {
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

const LIVE: readonly DemoStoryStep[] = [
  atRest({
    ru: 'Сервер отдаёт строки блоками. Данные на сервере меняют и другие пользователи, сервер сообщает о каждом изменении.',
    en: 'The server returns rows in blocks. Other users also change the data on the server, and the server reports every change.',
  }),
  {
    title: { ru: 'Сервер шлёт изменения', en: 'The server sends changes' },
    hint: {
      ru: 'Сервер сообщает о новых, изменённых и удалённых записях, приложение передаёт их таблице по мере прихода. Новые строки встают на свои места и вспыхивают, изменённые обновляются на месте, удалённые уходят. Изменения одного кадра таблица применяет вместе, перезапросов нет.',
      en: 'The server reports new, changed and deleted records, and the app passes them to the table as they arrive. New rows take their places and flash, changed rows update in place, and deleted rows go away. The table applies changes that arrive in the same frame together, without re-requesting rows.',
    },
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
    <DemoStory
      title={{ ru: 'Живые данные', en: 'Live data' }}
      steps={LIVE}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LIVE[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(LIVE[1]!.title.ru, async () => {
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

const REFETCH: readonly DemoStoryStep[] = [
  atRest({
    ru: 'Сервер отдаёт строки блоками и сам решает порядок списка: где окажется новая запись, приложение не знает.',
    en: 'The server returns rows in blocks and decides the list order itself: the app does not know where a new record will end up.',
  }),
  {
    title: {
      ru: 'Приложение добавило запись без места',
      en: 'The app added a record without a position',
    },
    hint: {
      ru: 'Приложение передало новую запись, но её место знает только сервер. Таблица тихо перезапросила видимые строки: прежние остаются на экране под свечением обновления.',
      en: 'The app passed a new record, but only the server knows its position. The table quietly re-requested the visible rows: the previous ones stay on screen under the refresh glow.',
    },
    states: ['body.refreshing'],
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => hasRow(root, 0), signal)
      txServer.hold = true
      addWithoutPlace()
      await pollUntil(() => refreshing(root), signal)
    }),
  },
  {
    title: { ru: 'Сервер ответил', en: 'The server responded' },
    hint: {
      ru: 'Ответ пришёл: новая запись встала на своё место в списке и коротко вспыхнула, итог вырос на одну.',
      en: 'The response arrived: the new record took its place in the list and flashed briefly, and the total grew by one.',
    },
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
    <DemoStory
      title={{ ru: 'Запись без места', en: 'A record without a position' }}
      steps={REFETCH}
      args={guideArgs(layout, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(REFETCH[0]!.title.ru, async () => {
      await until(() => expect(hasRow(canvas, 0)).toBe(true))
    })
    await step(REFETCH[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(hasRow(canvas, 2)).toBe(true)
    })
    await step(REFETCH[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(indexOfRow(canvas, 'item-id-2')).toBe(SERVER_PLACE + 1)
      await settle()
    })
  },
}
