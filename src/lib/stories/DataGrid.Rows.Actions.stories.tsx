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
  watchFlash,
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
    title: { ru: 'Действия строки в меню', en: 'Row actions in a menu' },
    hint: {
      ru: 'У строк больше действий, чем помещается в колонку. Таблица собирает их в меню строки, у каждой строки — кнопка меню.',
      en: 'Rows have more actions than fit in the column. The table gathers them into a row menu, and each row has a menu button.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл меню строки',
      en: 'The user opened the row menu',
    },
    hint: {
      ru: 'Пользователь нажал кнопку меню строки. Меню показывает действия этой строки.',
      en: "The user pressed the row's menu button. The menu shows the actions of this row.",
    },
    states: ['overlay.menu'],
    enter: stepAction((root, { signal }) => openRowMenu(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь выбрал действие',
      en: 'The user chose an action',
    },
    hint: {
      ru: 'Пользователь выбрал действие в меню. Меню закрылось, приложение выполнило действие строки.',
      en: "The user chose an action in the menu. The menu closed, and the app ran the row's action.",
    },
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
      title={{
        ru: 'Действие из меню строки',
        en: 'An action from the row menu',
      }}
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
    await step(ACTION_MENU[0]!.title.ru, async () => {
      await waitForRows(canvas)
      // Кнопки меню строк приходят с модулем меню — позже строк.
      await until(() =>
        expect(orderedRows(canvas).every(row => rowKebab(row))).toBe(true),
      )
      await expect(openMenu()).toBeNull()
    })
    await step(ACTION_MENU[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(
        openMenu()!.querySelectorAll('[role="menuitem"][data-action-id]'),
      ).toHaveLength(3)
      await settle()
    })
    await step(ACTION_MENU[2]!.title.ru, async () => {
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
    title: { ru: 'Меню строки закрыто', en: 'The row menu is closed' },
    hint: {
      ru: 'У каждой строки — меню действий. Пункты с разделами меняют значения записи.',
      en: "Each row has an actions menu. Items with sections change the record's values.",
    },
  },
  {
    title: {
      ru: 'Пользователь открыл меню строки',
      en: 'The user opened the row menu',
    },
    hint: {
      ru: 'Пункты с разделами показывают текущее значение записи и стрелку перехода в раздел.',
      en: "Items with sections show the record's current value and an arrow that leads into the section.",
    },
    states: ['overlay.menu'],
    enter: stepAction((root, { signal }) => openRowMenu(root, signal)),
  },
  {
    title: {
      ru: 'Пользователь открыл раздел статуса',
      en: 'The user opened the status section',
    },
    hint: {
      ru: 'Меню сменило содержимое на месте: варианты статуса, текущий отмечен, сверху — возврат назад.',
      en: 'The menu replaced its content in place: the status options, with the current one checked and a way back at the top.',
    },
    states: ['overlay.submenu'],
    enter: stepAction((root, { signal }) =>
      inSection(root, 'demoStatus', inStatusSection, signal),
    ),
  },
  {
    title: {
      ru: 'Пользователь сменил статус',
      en: 'The user changed the status',
    },
    hint: {
      ru: 'Пользователь выбрал новый статус. Меню закрылось, у записи новый статус.',
      en: 'The user chose a new status. The menu closed, and the record has the new status.',
    },
    enter: stepAction(async (root, { signal }) => {
      await inSection(root, 'demoStatus', inStatusSection, signal)
      await choose(`status:${STATUS}`, () => !openMenu(), signal)
    }),
  },
  {
    title: { ru: 'Метки не загрузились', en: 'Labels failed to load' },
    hint: {
      ru: 'Пользователь открыл раздел меток, но сервер не ответил. Раздел показывает ошибку и возможность повторить загрузку.',
      en: 'The user opened the labels section, but the server did not respond. The section shows an error and a way to retry loading.',
    },
    states: ['overlay.submenu'],
    enter: stepAction((root, { signal }) => {
      labelsDown = true
      return inSection(root, 'demoLabel', labelsFailed, signal)
    }),
  },
  {
    title: { ru: 'Пользователь отмечает метки', en: 'The user checks labels' },
    hint: {
      ru: 'Повторная загрузка удалась. Пользователь отметил метку, и меню не закрылось — можно отметить ещё одну.',
      en: 'The retry succeeded. The user checked a label, and the menu stayed open, so another one can be checked.',
    },
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
      title={{ ru: 'Разделы меню строки', en: 'Row menu sections' }}
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
    await step(NESTED[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(NESTED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await stepDone(canvas)
      const status = itemOf('demoStatus')!
      await expect(status).toHaveAttribute('aria-haspopup', 'menu')
      await expect(status.textContent).toMatch(/Active|Paused|Archived/)
      await expect(marked(status)).toBe(true)
      await settle()
    })
    await step(NESTED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()!.querySelector('[data-menu-back]')).not.toBeNull()
      await expect(
        STATUSES.filter(id => marked(itemOf(`status:${id}`)!)),
      ).toHaveLength(1)
      await settle()
    })
    await step(NESTED[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).toBeNull()
      await until(() => expect(consoleText()).toContain(`status:${STATUS}`))
      // Пункт раздела назван своей подписью, а не id (ADR 0182, AN23).
      await expect(consoleText()).toContain(`«${STATUS}»`)
    })
    await step(NESTED[4]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(labelsFailed()).toBe(true)
      await expect(itemOf('demoStatus')).toBeNull()
      await settle()
    })
    await step(NESTED[5]!.title.ru, async () => {
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
  // Итог — на строке (ADR 0152): отказ вспыхивает на ней, пока ждёт — строка занята.
  target: ctx => ({ row: ctx.row.id }),
}

const archiveDemo: TesseraFeatureEntry = {
  id: 'rowArchiveGuide',
  slotActions: [archiveAction],
}

/** Действие строки ждёт: заняты ячейки строки, а не кебаб (ADR 0177, §1). */
const rowBusy = (root: ParentNode) =>
  !!root.querySelector(
    `.data-grid__body-row[data-row-id="${MENU_ROW}"] [data-column-id][aria-busy="true"]`,
  )
/** Отказ действия строки — вспышка отката на ней. */
const rowRefused = (root: ParentNode) =>
  root
    .querySelector(`.data-grid__body-row[data-row-id="${MENU_ROW}"]`)
    ?.getAttribute('data-flash') === 'reverted'

/** Пользователь выбирает архивирование в меню строки, пока не выполнится `done`. */
const archive = (root: HTMLElement, done: () => boolean, signal: AbortSignal) =>
  repeat(
    done,
    () => {
      if (rowBusy(root)) return
      if (!openMenu()) {
        if (!document.querySelector('[role="menu"]')) kebabOf(root)?.click()
      } else itemOf(archiveAction.id)?.click()
    },
    signal,
  )

const ASYNC_ACTION: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Действие строки на сервере',
      en: 'A row action on the server',
    },
    hint: {
      ru: 'Приложение добавило в меню строки действие, которое выполняет сервер. У каждой строки — кнопка меню.',
      en: 'The app added an action to the row menu that the server performs. Each row has a menu button.',
    },
  },
  {
    title: { ru: 'Действие выполняется', en: 'The action is running' },
    hint: {
      ru: 'Пользователь выбрал архивирование в меню строки. Меню закрылось; пока сервер выполняет действие, ячейки строки чуть темнеют и по ним проходит светлый блик.',
      en: "The user chose archiving in the row menu. The menu closed; while the server performs the action, the row's cells darken slightly and a light shimmer runs across them.",
    },
    states: ['body.pending'],
    enter: stepAction((root, { signal }) => {
      archiveRefused = false
      ARCHIVE_SERVER.runs.hold()
      return archive(root, () => rowBusy(root) && !openMenu(), signal)
    }),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер не выполнил действие. Ожидание со строки снято, строка коротко вспыхивает тоном отказа, подсказка кнопки меню строки называет невыполненное действие.',
      en: "The server did not perform the action. The row is no longer waiting; it briefly flashes in the refusal tone, and the tooltip of the row's menu button names the action that failed.",
    },
    states: ['body.error'],
    enter: stepAction(async (root, { signal }) => {
      archiveRefused = true
      ARCHIVE_SERVER.runs.release()
      await archive(
        root,
        () => rowRefused(root) && !rowBusy(root) && !openMenu(),
        signal,
      )
    }),
  },
]

/** ADR 0078, S3: действие меню строки выполняет сервер — ожидание и отказ на строке. */
export const RowActionsAsync: StoryObj<StoryProps> = {
  name: 'Async action',
  parameters: {
    scenario: '0078/S3',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Действие строки на сервере',
        en: 'A row action on the server',
      }}
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
    await step(ASYNC_ACTION[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(kebabOf(canvas)).not.toBeNull())
      await expect(rowBusy(canvas)).toBe(false)
    })
    const rowCells = () =>
      canvas.querySelectorAll<HTMLElement>(
        `.data-grid__body-row[data-row-id="${MENU_ROW}"] [data-column-id]`,
      )
    await step(ASYNC_ACTION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(openMenu()).toBeNull()
      const cells = [...rowCells()]
      await expect(cells.length).toBeGreaterThan(0)
      for (const cell of cells) {
        await expect(cell).toHaveAttribute('aria-busy', 'true')
      }
      // Ожидание — волной на строке, на кебабе дуги нет (ADR 0177, §1).
      await expect(canvas.querySelector('[data-pending-wave]')).not.toBeNull()
      await expect(
        kebabOf(canvas)?.querySelector('svg[data-pending-arc]'),
      ).toBeNull()
    })
    await step(ASYNC_ACTION[2]!.title.ru, async () => {
      const flash = watchFlash(
        canvas,
        `.data-grid__body-row[data-row-id="${MENU_ROW}"]`,
        'reverted',
      )
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(flash.seen()).toBe(true))
      flash.stop()
      for (const cell of rowCells()) {
        await expect(cell).not.toHaveAttribute('aria-busy')
      }
      await expect(
        kebabOf(canvas)?.querySelector('[data-failure-indicator]'),
      ).toBeNull()
      await expect(kebabOf(canvas)?.getAttribute('aria-label')).toContain(
        labels.actionsFailed('Archive'),
      )
      await settle()
    })
  },
}

// --- ADR 0153 S1 ---------------------------------------------------------------------

const CANCEL_SERVER = createDemoServer()

const cancelAction: RowAction = {
  id: 'cancelArchive',
  slot: 'actionRowSlot',
  placement: 'menu',
  icon: () => <Archive width={16} height={16} />,
  label: () => 'Archive',
  // Запрос учитывает `signal`: отмена прерывает его (ADR 0153, §1).
  onSelect: (_ctx, _event, context) =>
    CANCEL_SERVER.runs.answer(context?.signal),
  target: ctx => ({ row: ctx.row.id }),
}

const cancelDemo: TesseraFeatureEntry = {
  id: 'rowCancelGuide',
  slotActions: [cancelAction],
}

const cancelItem = () => itemOf(cancelAction.id)
const cancelItemPending = () => !!cancelItem()?.hasAttribute('data-pending')

/** Архивирование ждёт ответа: запускается, если ещё не идёт. */
const archiveHeld = async (root: HTMLElement, signal: AbortSignal) => {
  CANCEL_SERVER.runs.hold()
  await repeat(
    () => rowBusy(root) && !openMenu(),
    () => {
      if (rowBusy(root)) return
      if (!openMenu()) {
        if (!document.querySelector('[role="menu"]')) kebabOf(root)?.click()
      } else itemOf(cancelAction.id)?.click()
    },
    signal,
  )
}

/** Меню строки открыто, ждущий пункт предлагает отмену. */
const cancelItemShown = async (root: HTMLElement, signal: AbortSignal) => {
  await archiveHeld(root, signal)
  await repeat(
    cancelItemPending,
    () => {
      if (!document.querySelector('[role="menu"]')) kebabOf(root)?.click()
    },
    signal,
  )
}

const CANCEL_ACTION: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Долгое действие строки', en: 'A long row action' },
    hint: {
      ru: 'Приложение добавило в меню строки действие, которое сервер выполняет долго. У каждой строки есть кнопка меню.',
      en: 'The app added an action to the row menu that takes the server a long time. Each row has a menu button.',
    },
  },
  {
    title: { ru: 'Действие выполняется', en: 'The action is running' },
    hint: {
      ru: 'Пользователь выбрал архивирование в меню строки. Пока сервер работает, ячейки строки чуть темнеют и по ним проходит светлый блик.',
      en: "The user chose archiving in the row menu. While the server works, the row's cells darken slightly and a light shimmer runs across them.",
    },
    states: ['body.pending'],
    enter: stepAction((root, { signal }) => archiveHeld(root, signal)),
  },
  {
    title: { ru: 'Пункт предлагает отмену', en: 'The item offers to cancel' },
    hint: {
      ru: 'Пользователь снова открыл меню строки. Ждущий пункт доступен: подпись предлагает отменить архивирование, у правого края крутится спиннер.',
      en: 'The user opened the row menu again. The waiting item is available: its label offers to cancel archiving, and a spinner spins at its right edge.',
    },
    states: ['overlay.menu', 'body.pending'],
    enter: stepAction((root, { signal }) => cancelItemShown(root, signal)),
  },
  {
    title: { ru: 'Действие отменено', en: 'The action was canceled' },
    hint: {
      ru: 'Пользователь выбрал этот пункт. Таблица прервала запрос: меню закрылось, ожидание снято, нет ни отметки ошибки, ни вспышки, строка такая же, как до действия.',
      en: 'The user chose that item. The table aborted the request: the menu closed, the waiting state is cleared, there is no error mark or flash, and the row looks the same as before the action.',
    },
    enter: stepAction(async (root, { signal }) => {
      // Меню с ждущим пунктом осталось с прошлого шага — нажать его сразу.
      if (!cancelItemPending()) await cancelItemShown(root, signal)
      cancelItem()!.click()
      await pollUntil(() => !rowBusy(root) && !openMenu(), signal)
    }),
  },
]

/** ADR 0153, S1: действие строки идёт долго — человек отменяет его в меню строки. */
export const RowActionsCancel: StoryObj<StoryProps> = {
  name: 'Cancel an action',
  parameters: {
    scenario: '0153/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Отмена действия строки', en: 'Canceling a row action' }}
      steps={CANCEL_ACTION}
      args={guideArgs(
        {
          enableRowActions: true,
          enableRowActionMenu: true,
          actionsDemo: 'none',
          extraPlugins: [cancelDemo],
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
    const rowCells = () =>
      canvas.querySelectorAll<HTMLElement>(
        `.data-grid__body-row[data-row-id="${MENU_ROW}"] [data-column-id]`,
      )
    await step(CANCEL_ACTION[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(kebabOf(canvas)).not.toBeNull())
      await expect(rowBusy(canvas)).toBe(false)
    })
    await step(CANCEL_ACTION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(canvas.querySelector('[data-pending-wave]')).not.toBeNull()
      for (const cell of rowCells()) {
        await expect(cell).toHaveAttribute('aria-busy', 'true')
      }
    })
    await step(CANCEL_ACTION[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const item = cancelItem()!
      await expect(item).not.toHaveAttribute('data-disabled')
      await expect(item.textContent).toContain(labels.cancelAction('Archive'))
      // У кебаба «стопа» нет: он открывает меню (ADR 0153, §2).
      await expect(kebabOf(canvas)).not.toHaveAttribute('data-cancel-armed')
    })
    await step(CANCEL_ACTION[3]!.title.ru, async () => {
      const flash = watchFlash(
        canvas,
        `.data-grid__body-row[data-row-id="${MENU_ROW}"]`,
        'reverted',
      )
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(rowBusy(canvas)).toBe(false)
      await expect(
        kebabOf(canvas)?.querySelector('[data-failure-indicator]'),
      ).toBeNull()
      for (const cell of rowCells()) {
        await expect(cell).not.toHaveAttribute('aria-busy')
      }
      await settle()
      await expect(flash.seen()).toBe(false)
      flash.stop()
      await until(() =>
        expect(
          canvas.querySelector('[role="status"][aria-live]')?.textContent,
        ).toBe(labels.announceActionCancelled('Archive')),
      )
    })
  },
}
