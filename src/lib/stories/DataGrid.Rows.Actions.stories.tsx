import { Meta, StoryObj } from '@storybook/react'
import { Archive } from 'lucide-react'
import { expect } from 'storybook/test'

import type { RowAction } from '../core/headerActions'

import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  orderedRows,
  pollUntil,
  rowKebab,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { createDemoServer } from './__mocks__/plugins/asyncActionsDemo/asyncActionsDemo'
import { nestedRowActions } from './__mocks__/plugins/nestedActionsDemo/nestedActionsDemo'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Действия строки (ADR 0025): `Playground` — колонка действий и набор действий строки;
 * S1 — действие из меню строки, S1 ADR 0079 — вложенные разделы меню строки, S3 ADR
 * 0078 — действие строки выполняет сервер.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Actions',
} satisfies Meta<StoryProps>

export default meta

/** Колонка действий; набор действий строки — контролом, без действий колонки нет. */
export const RowActionsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableRowActions',
    'rowActionsWidth',
    'rowActionsCollapsedWidth',
    'rowActionsColumn',
    'actionsDemo',
    'enableRowActionMenu',
    'rowActionMenuMode',
    'rowActionMenuThreshold',
    'enableContextMenu',
  ]),
  args: {
    enableRowActions: true,
  },
}

/** Строка, у которой гайды открывают меню. */
const MENU_ROW = 'item-id-1'

const openMenu = () =>
  document.querySelector<HTMLElement>('[role="menu"][data-open]')
const kebabOf = (root: ParentNode) =>
  rowKebab(
    root.querySelector(`.data-grid__body-row[data-row-id="${MENU_ROW}"]`) ??
      undefined,
  )
const itemOf = (id: string) =>
  openMenu()?.querySelector<HTMLElement>(
    `[data-action-id="${CSS.escape(id)}"]`,
  ) ?? null

/** Повторяет `act`, пока не выполнится `done`: кнопки и меню готовы не сразу. */
const repeat = async (
  done: () => boolean,
  act: () => void,
  signal: AbortSignal,
) => {
  await pollUntil(() => {
    if (done()) return true
    act()
    return false
  }, signal)
  // Нажатие доходит не сразу: следующее — после паузы, а не каждые 16 мс.
  await sleep(0)
}

/** Пользователь открывает меню строки нажатием на её кнопку. */
const openRowMenu = (root: HTMLElement, signal: AbortSignal) =>
  repeat(
    () => !!openMenu(),
    () => {
      if (!document.querySelector('[role="menu"]')) kebabOf(root)?.click()
    },
    signal,
  )

/** Пользователь выбирает пункт `id`, пока не выполнится `done`. */
const choose = (id: string, done: () => boolean, signal: AbortSignal) =>
  repeat(done, () => itemOf(id)?.click(), signal)

// --- ADR 0025 S1 ---------------------------------------------------------------------

const ACTION = 'duplicate'

const ACTION_MENU: readonly GuideStoryStep[] = [
  {
    title: 'Действия строки в меню',
    hint: 'У строк больше действий, чем помещается в колонку. Таблица собирает их в меню строки, у каждой строки — кнопка меню.',
  },
  {
    title: 'Пользователь открыл меню строки',
    hint: 'Пользователь нажал кнопку меню строки. Меню показывает действия этой строки.',
    states: ['overlay.menu'],
    enter: stepAction((root, { signal }) => openRowMenu(root, signal)),
  },
  {
    title: 'Пользователь выбрал действие',
    hint: 'Пользователь выбрал действие в меню. Меню закрылось, приложение выполнило действие строки.',
    enter: stepAction(async (root, { signal }) => {
      await openRowMenu(root, signal)
      await choose(ACTION, () => !openMenu(), signal)
    }),
  },
]

/** ADR 0025, S1: пользователь выполняет действие строки из её меню. */
export const RowActionMenu: StoryObj<StoryProps> = {
  name: 'Action menu',
  parameters: {
    scenario: '0025/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Действие из меню строки"
      steps={ACTION_MENU}
      args={guideArgs(
        {
          enableRowActions: true,
          enableRowActionMenu: true,
          dataCount: 20,
          containerHeight: '460',
          height: '360',
          maxHeight: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(ACTION_MENU[0]!.title, async () => {
      await waitForRows(canvas)
      // Кнопки меню строк приходят с модулем меню — позже строк.
      await until(() =>
        expect(orderedRows(canvas).every(row => rowKebab(row))).toBe(true),
      )
      await expect(openMenu()).toBeNull()
    })
    await step(ACTION_MENU[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(
        openMenu()!.querySelectorAll('[role="menuitem"][data-action-id]'),
      ).toHaveLength(3)
      await settle()
    })
    await step(ACTION_MENU[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).toBeNull()
      await until(() => expect(consoleText()).toContain(ACTION))
      await settle()
    })
  },
}

// --- ADR 0079 S1 ---------------------------------------------------------------------

/** «Сервер» меток гайда: шаг решает, упадёт ли их загрузка. */
let labelsDown = false

const nestedDemo: TesseraFeatureEntry = {
  id: 'nestedSectionsGuide',
  slotActions: nestedRowActions({ labelsDown: () => labelsDown }),
}

const STATUSES = ['Active', 'Paused', 'Archived']
const STATUS = 'Paused'
const LABEL = 'VIP'

/** Значок у правого края пункта: стрелка раздела или отметка текущего значения. */
const marked = (item: HTMLElement) =>
  !!item.lastElementChild?.querySelector('svg')

const inStatusSection = () => !!itemOf(`status:${STATUS}`)
const labelsFailed = () => !!openMenu()?.querySelector('[data-section-failed]')
const labelItem = () => itemOf(`label:${LABEL}`)

/** Пользователь открывает меню строки и раздел `section`, пока не выполнится `done`. */
const inSection = async (
  root: HTMLElement,
  section: string,
  done: () => boolean,
  signal: AbortSignal,
) => {
  await openRowMenu(root, signal)
  await choose(section, done, signal)
}

const NESTED: readonly GuideStoryStep[] = [
  {
    title: 'Пользователь открыл меню строки',
    hint: 'Пункты с разделами показывают текущее значение записи и стрелку перехода в раздел.',
    states: ['overlay.menu'],
    enter: stepAction((root, { signal }) => openRowMenu(root, signal)),
  },
  {
    title: 'Пользователь открыл раздел статуса',
    hint: 'Меню сменило содержимое на месте: варианты статуса, текущий отмечен, сверху — возврат назад.',
    states: ['overlay.submenu'],
    enter: stepAction((root, { signal }) =>
      inSection(root, 'demoStatus', inStatusSection, signal),
    ),
  },
  {
    title: 'Пользователь сменил статус',
    hint: 'Пользователь выбрал новый статус. Меню закрылось, у записи новый статус.',
    enter: stepAction(async (root, { signal }) => {
      await inSection(root, 'demoStatus', inStatusSection, signal)
      await choose(`status:${STATUS}`, () => !openMenu(), signal)
    }),
  },
  {
    title: 'Метки не загрузились',
    hint: 'Пользователь открыл раздел меток, но сервер не ответил. Раздел показывает ошибку и возможность повторить загрузку.',
    states: ['overlay.submenu'],
    enter: stepAction((root, { signal }) => {
      labelsDown = true
      return inSection(root, 'demoLabel', labelsFailed, signal)
    }),
  },
  {
    title: 'Пользователь отмечает метки',
    hint: 'Повторная загрузка удалась. Пользователь отметил метку, и меню не закрылось — можно отметить ещё одну.',
    states: ['overlay.submenu'],
    enter: stepAction(async (root, { signal }) => {
      labelsDown = false
      await inSection(
        root,
        'demoLabel',
        () => labelsFailed() || !!labelItem(),
        signal,
      )
      await repeat(
        () => !!labelItem(),
        () =>
          openMenu()
            ?.querySelector<HTMLElement>('[data-section-failed]')
            ?.click(),
        signal,
      )
      await repeat(
        () => labelItem()?.getAttribute('aria-checked') === 'true',
        () => labelItem()?.click(),
        signal,
      )
    }),
  },
]

/** ADR 0079, S1: пользователь меняет запись во вложенных разделах меню строки. */
export const RowActionsNested: StoryObj<StoryProps> = {
  name: 'Nested sections',
  parameters: {
    scenario: '0079/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Разделы меню строки"
      steps={NESTED}
      args={guideArgs(
        {
          enableRowActions: true,
          enableRowActionMenu: true,
          actionsDemo: 'none',
          extraPlugins: [nestedDemo],
          dataCount: 20,
          containerHeight: '460',
          height: '360',
          maxHeight: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(NESTED[0]!.title, async () => {
      await waitForRows(canvas)
      await stepDone(canvas)
      const status = itemOf('demoStatus')!
      await expect(status).toHaveAttribute('aria-haspopup', 'menu')
      await expect(status.textContent).toMatch(/Active|Paused|Archived/)
      await expect(marked(status)).toBe(true)
      await settle()
    })
    await step(NESTED[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()!.querySelector('[data-menu-back]')).not.toBeNull()
      await expect(
        STATUSES.filter(id => marked(itemOf(`status:${id}`)!)),
      ).toHaveLength(1)
      await settle()
    })
    await step(NESTED[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).toBeNull()
      await until(() => expect(consoleText()).toContain(`status:${STATUS}`))
    })
    await step(NESTED[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(labelsFailed()).toBe(true)
      await expect(itemOf('demoStatus')).toBeNull()
      await settle()
    })
    await step(NESTED[4]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(labelItem()).toHaveAttribute('aria-checked', 'true')
      await expect(openMenu()).not.toBeNull()
      await settle()
    })
  },
}

// --- ADR 0078 S3 ---------------------------------------------------------------------

/** «Сервер» гайда: придерживает ответ, пока шаг ожидания на виду; отказывает по команде. */
const ARCHIVE_SERVER = createDemoServer()
let archiveRefused = false
const ARCHIVE_REFUSAL = 'Row is locked by another user'

const archiveAction: RowAction = {
  id: 'serverArchive',
  slot: 'actionRowSlot',
  placement: 'menu',
  icon: () => <Archive width={16} height={16} />,
  label: () => 'Archive',
  onSelect: async () => {
    await ARCHIVE_SERVER.runs.answer()
    if (archiveRefused) throw new Error(ARCHIVE_REFUSAL)
  },
}

const archiveDemo: TesseraFeatureEntry = {
  id: 'rowArchiveGuide',
  slotActions: [archiveAction],
}

const kebabBusy = (root: ParentNode) =>
  kebabOf(root)?.getAttribute('aria-busy') === 'true'
const kebabFailed = (root: ParentNode) =>
  !!kebabOf(root)?.querySelector('[data-error-indicator][data-shown="true"]')

/** Пользователь выбирает архивирование в меню строки, пока не выполнится `done`. */
const archive = (root: HTMLElement, done: () => boolean, signal: AbortSignal) =>
  repeat(
    done,
    () => {
      if (kebabBusy(root)) return
      if (!openMenu()) {
        if (!document.querySelector('[role="menu"]')) kebabOf(root)?.click()
      } else itemOf(archiveAction.id)?.click()
    },
    signal,
  )

const ASYNC_ACTION: readonly GuideStoryStep[] = [
  {
    title: 'Действие строки на сервере',
    hint: 'Приложение добавило в меню строки действие, которое выполняет сервер. У каждой строки — кнопка меню.',
  },
  {
    title: 'Действие выполняется',
    hint: 'Пользователь выбрал архивирование в меню строки. Меню закрылось, а кнопка меню строки показывает ожидание, пока сервер выполняет действие.',
    states: ['body.pending'],
    enter: stepAction((root, { signal }) => {
      archiveRefused = false
      ARCHIVE_SERVER.runs.hold()
      return archive(root, () => kebabBusy(root) && !openMenu(), signal)
    }),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер не выполнил действие. На кнопке меню строки появляется отметка ошибки, она видна без наведения; подсказка кнопки называет невыполненное действие.',
    states: ['body.error'],
    enter: stepAction(async (root, { signal }) => {
      archiveRefused = true
      ARCHIVE_SERVER.runs.release()
      await archive(
        root,
        () => kebabFailed(root) && !kebabBusy(root) && !openMenu(),
        signal,
      )
    }),
  },
]

/** ADR 0078, S3: действие меню строки выполняет сервер — ожидание и отказ на кнопке меню строки. */
export const RowActionsAsync: StoryObj<StoryProps> = {
  name: 'Async action',
  parameters: {
    scenario: '0078/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Действие строки на сервере"
      steps={ASYNC_ACTION}
      args={guideArgs(
        {
          enableRowActions: true,
          enableRowActionMenu: true,
          actionsDemo: 'none',
          extraPlugins: [archiveDemo],
          dataCount: 20,
          containerHeight: '460',
          height: '360',
          maxHeight: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(ASYNC_ACTION[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(kebabOf(canvas)).not.toBeNull())
      await expect(kebabBusy(canvas)).toBe(false)
    })
    await step(ASYNC_ACTION[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(kebabBusy(canvas)).toBe(true)
      await expect(openMenu()).toBeNull()
    })
    await step(ASYNC_ACTION[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(kebabFailed(canvas)).toBe(true)
      await expect(kebabBusy(canvas)).toBe(false)
      await expect(kebabOf(canvas)?.getAttribute('aria-label')).toContain(
        labels.actionsFailed('Archive'),
      )
      await settle()
    })
  },
}
