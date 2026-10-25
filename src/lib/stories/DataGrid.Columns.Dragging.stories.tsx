import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  type HeldDrag,
  type Point,
  centerOf,
  dragHold,
  guideNext,
  headCell,
  pollUntil,
  releaseFocus,
  settle,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Перенос колонок (ADR 0006, ADR 0130, ADR 0114, ADR 0052): мышью за ручку, с сервером,
 * под вложенной шапкой; без перетаскивания — меню ручки. `Playground` — песочница,
 * остальное — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Dragging',
  tags: ['done'],
} satisfies Meta<StoryProps>

export default meta

const NOT_COLUMNS = 'На перенос колонок не влияет'

/** Колонки с ручкой переноса в заголовке в покое (ADR 0130, §7). */
export const ColumnDraggingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(
    [
      'enableColumnDragging',
      'enableColumnAnimation',
      'enableKeyboardNavigation',
      'headerNesting',
      'enableColumnPinning',
    ],
    { rowHeight: NOT_COLUMNS, headerHeight: NOT_COLUMNS },
  ),
  args: {
    enableColumnDragging: true,
    dataCount: 30,
    containerHeight: '400',
    height: '300',
    maxHeight: '300',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Общее для шагов ------------------------------------------------------------------

const HEAD = '.data-grid__head-cell[data-column-id]'

const rect = (element: Element) => element.getBoundingClientRect()

/** Действие шага — после отрисовки строк: ждёт таймером, а не кадрами. */
const afterRows =
  (action: (root: HTMLElement) => void) => (root: HTMLElement) => {
    const run = () =>
      root.querySelector('.data-grid__body-row')
        ? action(root)
        : setTimeout(run, 50)
    setTimeout(run, 0)
  }

const HANDLE = '.drag__handler--column'
/** Отметка отказа на ручке (ADR 0136). */
const FAILURE = '[data-failure-indicator]'
const COLUMN_CLOUD = '.data-grid-head__cell--overlay'

/** Колонки шапки слева направо, как их видит человек. */
const headOrder = (canvas: ParentNode) =>
  [...canvas.querySelectorAll<HTMLElement>(HEAD)]
    .sort((a, b) => rect(a).left - rect(b).left)
    .map(cell => cell.dataset.columnId)

/**
 * Номер запуска действия шага: новый запуск останавливает прежний. В StrictMode эффект
 * выполняется дважды, и два цикла нажимали бы одну ручку — второе нажатие отменяет
 * открытие ленивого меню.
 */
let stepRun = 0

const handleOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`${HEAD}[data-column-id="${id}"] ${HANDLE}`)

/**
 * Один такт переноса, как у пользователя без перетаскивания (WCAG 2.5.7): открыть меню
 * ручки колонки или группы и выбрать в нём перенос. Меню другой ручки закрывается.
 */
const moveByMenu = (
  root: ParentNode,
  id: string,
  item: 'moveLeft' | 'moveRight',
) => {
  const menu = document.querySelector<HTMLElement>('[role="menu"][data-open]')
  const handle = handleOf(root, id)
  if (menu) {
    if (handle?.getAttribute('aria-expanded') === 'true')
      menu.querySelector<HTMLElement>(`[data-item-id="${item}"]`)?.click()
    else
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
  } else if (!document.querySelector('[role="menu"]')) handle?.click()
}

// --- ADR 0130 S4: перенос колонки мышью -----------------------------------------------

/** Колонка, которую держит шаг: следующий шаг её отпускает. */
/** Вторая колонка до шагов — её гайд переставляет в начало. */
const INITIAL_SECOND = 'firstName'

let heldColumn: { held: HeldDrag; target: Point } | null = null

/** Первое настоящее нажатие на странице отпускает колонку — снимается после броска. */
let stopPressRelease = () => {}

const dropHeldColumn = () => {
  stopPressRelease()
  heldColumn?.held.cancel()
  heldColumn = null
}

/**
 * Отпустить удерживаемую колонку у начала таблицы. Указатель сперва возвращается к месту
 * вставки: человек мог увести облако мышью, а «Далее» — над панелью гайда.
 */
const dropHeldAtStart = async () => {
  stopPressRelease()
  const hold = heldColumn
  heldColumn = null
  if (!hold) return
  await hold.held.moveTo(hold.target, 1)
  hold.held.release()
}

/**
 * Берёт вторую колонку за ручку и держит у начала первой: место считается от левой
 * десятой ячейки-цели, а прокрутка в нуле — автопрокрутке ехать некуда (ADR 0130, §4).
 */
const holdSecondColumn = async (root: HTMLElement, signal?: AbortSignal) => {
  const container = root.querySelector('.data-grid__container')!
  container.scrollIntoView({ block: 'nearest' })
  const id = headOrder(root)[1]!
  const handle = root.querySelector<HTMLElement>(
    `${HEAD}[data-column-id="${id}"] ${HANDLE}`,
  )!
  // Облако ложится ровно на место вставки: ручка — на том же смещении от края
  // первой колонки, что и от края своей.
  const grip = centerOf(handle)
  const cellLeft = (column: string) =>
    rect(root.querySelector(`${HEAD}[data-column-id="${column}"]`)!).left
  const target = {
    x: cellLeft(headOrder(root)[0]!) + (grip.x - cellLeft(id)),
    y: grip.y,
  }
  const held = await dragHold(handle, target, undefined, signal)
  return { held, target }
}

/**
 * Нажатие человека (например, «Далее») отпускает колонку раньше, чем дойдёт до клика:
 * клик сразу после броска перетаскивание проглотило бы, и гайд не перешёл бы к шагу.
 */
const releaseOnPress = () => {
  const onPress = (event: PointerEvent) => {
    if (!event.isTrusted) return
    void dropHeldAtStart()
    // Перетаскивание гасит клики ещё 50 мс после броска: клик этого нажатия
    // повторяется, когда перехват снят.
    const onClick = (click: MouseEvent) => {
      window.removeEventListener('click', onClick, true)
      if (!click.isTrusted) return
      click.stopPropagation()
      click.preventDefault()
      const target = click.target as HTMLElement
      setTimeout(() => target.click(), 80)
    }
    window.addEventListener('click', onClick, true)
    setTimeout(() => window.removeEventListener('click', onClick, true), 1000)
  }
  // Колонку держит шаг: движения настоящей мыши облако не уводят.
  const onMove = (event: PointerEvent) => {
    if (event.isTrusted) event.stopPropagation()
  }
  document.addEventListener('pointerdown', onPress, true)
  window.addEventListener('pointermove', onMove, true)
  stopPressRelease = () => {
    document.removeEventListener('pointerdown', onPress, true)
    window.removeEventListener('pointermove', onMove, true)
    stopPressRelease = () => {}
  }
}

const COLUMN_MOVE: readonly GuideStoryStep[] = [
  {
    title: 'Ручка колонки',
    hint: 'У заголовка колонки есть ручка переноса: за неё колонку берут, чтобы переставить. Ручка появляется при наведении на заголовок.',
    enter: dropHeldColumn,
  },
  {
    title: 'Пользователь ведёт колонку',
    hint: 'Пользователь взял вторую колонку за ручку и ведёт её к началу таблицы. Заголовок колонки следует за указателем, а на месте вставки колонки расступаются.',
    // Ручка видна и в облаке заголовка: наведение шапки в forced-colors контура не даёт.
    states: ['drag.columnHandle', 'drag.column'],
    // Шаг готов, когда колонка удержана и нажатие её отпускает: клик посреди движения
    // проглотило бы перетаскивание (`stepDone` в `play`).
    enter: stepAction(async (root, step) => {
      dropHeldColumn()
      await pollUntil(
        () => !!root.querySelector('.data-grid__body-row'),
        step.signal,
      )
      heldColumn = await holdSecondColumn(root, step.signal)
      releaseOnPress()
    }),
  },
  {
    title: 'Колонка переставлена',
    hint: 'Пользователь отпустил колонку. Она встаёт на новое место, соседние колонки сдвигаются.',
    enter: afterRows(async root => {
      if (heldColumn) return dropHeldAtStart()
      // Переход сразу к шагу: колонку берут и отпускают у начала таблицы.
      const moved = root.querySelector(
        `${HEAD}[data-column-id="${INITIAL_SECOND}"]`,
      )
      if (moved && headOrder(root)[0] !== INITIAL_SECOND) {
        heldColumn = await holdSecondColumn(root)
        await dropHeldAtStart()
      }
    }),
  },
]

const COLUMN_MOVE_ARGS = {
  enableColumnDragging: true,
  dataCount: 30,
  height: '300',
} satisfies Partial<StoryProps>

/** ADR 0130, S4: колонку берут за ручку, ведут к началу таблицы и отпускают. */
export const ColumnDraggingMove: StoryObj<StoryProps> = {
  name: 'Move',
  parameters: {
    scenario: '0130/S4',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Перенос колонки мышью"
      steps={COLUMN_MOVE}
      args={guideArgs(COLUMN_MOVE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    /** Место вставки: исходная ячейка скрыта, соседи сдвинуты. */
    const place = () => {
      const cells = [...canvas.querySelectorAll<HTMLElement>(HEAD)]
      return (
        cells.some(cell => getComputedStyle(cell).opacity === '0') &&
        cells.some(
          cell =>
            getComputedStyle(cell).opacity !== '0' &&
            Math.abs(new DOMMatrix(getComputedStyle(cell).transform).m41) > 0.5,
        )
      )
    }
    let second: string | undefined
    await step(COLUMN_MOVE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(canvas.querySelector(`${HEAD} ${HANDLE}`)).not.toBeNull(),
      )
      second = headOrder(canvas)[1]
    })
    await step(COLUMN_MOVE[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() =>
        expect(document.querySelector(COLUMN_CLOUD)).not.toBeNull(),
      )
      await until(() => expect(place()).toBe(true))
    })
    await step(COLUMN_MOVE[2]!.title, async () => {
      // Нажатие «Далее» отпустило бы колонку над панелью: шаг отпускает её у начала.
      await dropHeldAtStart()
      await guideNext(canvas)
      await until(() => expect(document.querySelector(COLUMN_CLOUD)).toBeNull())
      await until(() => expect(headOrder(canvas)[0]).toBe(second))
    })
    await settle()
  },
}

// --- ADR 0130 S5: перенос колонки с сервером ------------------------------------------

/** Сохранения порядка, ждущие ответа «сервера»: шаг гайда принимает или отклоняет их. */
const pendingColumnSaves: {
  resolve: () => void
  reject: (error: Error) => void
}[] = []

const saveColumnOrder = () =>
  new Promise<void>((resolve, reject) =>
    pendingColumnSaves.push({ resolve, reject }),
  )

/** Ответ «сервера» на все ждущие сохранения. */
const answerColumnSaves = (ok: boolean) => {
  for (const save of pendingColumnSaves.splice(0)) {
    if (ok) save.resolve()
    else save.reject(new Error('Server rejected the column order'))
  }
}

/**
 * Держит вспышку отказа на время шага (ADR 0130, DG6): матрица контраста и снимок
 * застают сам отказ, а не угасание красного контура.
 */
const busyHandle = (root: ParentNode, id: string) =>
  root
    .querySelector(`${HEAD}[data-column-id="${id}"] ${HANDLE}`)
    ?.getAttribute('aria-busy') === 'true'

/** Порядок колонок до шагов гайда — по нему шаг решает, что уже переставлено. */
const INITIAL = ['country', 'firstName', 'lastName', 'age']
/** Место колонки по `aria-colindex`: посреди переезда положение на экране врёт. */
const indexOf = (root: ParentNode, id: string) =>
  Number(
    root
      .querySelector(`${HEAD}[data-column-id="${id}"]`)
      ?.getAttribute('aria-colindex') ?? 0,
  ) - 1

const anyBusy = (root: ParentNode) =>
  !!root.querySelector(`${HEAD} ${HANDLE}[aria-busy="true"]`)

/** Колонка `id` правее, чем в начале: переставить, если ещё не там. */
const movedRight = (root: ParentNode, id: string) =>
  indexOf(root, id) > INITIAL.indexOf(id)

/** Сервер отказал в переносе колонки: вспышка отказа или отметка на ручке. */
const rejected = (root: ParentNode, id: string) => {
  const head = root.querySelector(`${HEAD}[data-column-id="${id}"]`)
  return (
    head?.getAttribute('data-column-flash') === 'reverted' ||
    !!head?.querySelector(`${HANDLE} [data-failure-indicator]`)
  )
}

/**
 * Довести таблицу до состояния шага: колонки `saved` переставлены и сохранены; колонка
 * `waiting` переставлена и ждёт ответа; колонку `refused` переставили, и сервер отказал.
 */
const serverStep =
  ({
    saved = [],
    waiting,
    refused,
  }: {
    saved?: string[]
    waiting?: string
    refused?: string
  }) =>
  (root: HTMLElement) => {
    let tries = 0
    const run_ = ++stepRun
    // Одно действие за такт: пока ждёт перенос, другие колонки не переставить.
    const run = () => {
      if (run_ !== stepRun || ++tries > 80) return
      const later = () => setTimeout(run, 150)
      const unsaved = saved.find(id => !movedRight(root, id))
      if (unsaved) {
        if (anyBusy(root)) answerColumnSaves(true)
        else moveByMenu(root, unsaved, 'moveRight')
        return later()
      }
      if (saved.some(id => busyHandle(root, id))) {
        answerColumnSaves(true)
        return later()
      }
      if (waiting && !busyHandle(root, waiting)) {
        if (!anyBusy(root)) moveByMenu(root, waiting, 'moveRight')
        return later()
      }
      if (refused && !rejected(root, refused)) {
        if (busyHandle(root, refused)) answerColumnSaves(false)
        else if (!anyBusy(root)) moveByMenu(root, refused, 'moveRight')
        return later()
      }
    }
    setTimeout(run, 0)
  }

const COLUMN_SERVER: readonly GuideStoryStep[] = [
  {
    title: 'Порядок колонок хранит сервер',
    hint: 'Приложение сохраняет порядок колонок на сервере: каждый перенос колонки ждёт его ответа.',
    enter: () => {
      pendingColumnSaves.length = 0
    },
  },
  {
    title: 'Перенос ждёт сервера',
    hint: 'Пользователь переставил колонку. Пока сервер не ответил, ручка колонки показывает ожидание, а повторно перенести колонку нельзя.',
    states: ['drag.pending'],
    enter: afterRows(serverStep({ waiting: 'country' })),
  },
  {
    title: 'Сервер сохранил',
    hint: 'Сервер ответил. Ожидание закончилось, колонка осталась на новом месте и коротко вспыхнула тоном успеха.',
    enter: afterRows(serverStep({ saved: ['country'] })),
  },
  {
    title: 'Отказ сервера',
    hint: 'Пользователь переставил другую колонку, но сервер отказал. Колонка вернулась к прежним соседям, ручка отмечена ошибкой, а сама колонка коротко вспыхнула тоном ошибки.',
    states: ['drag.rejected'],
    enter: afterRows(serverStep({ saved: ['country'], refused: 'lastName' })),
  },
  {
    title: 'Отказ без отката',
    hint: 'Приложение не возвращает колонку при отказе. Отклонённая колонка остаётся там, куда её переставили, с отметкой ошибки, и коротко вспыхивает тоном ошибки.',
    props: () => ({ columnDraggingRevertOnReject: false }),
    enter: afterRows(serverStep({ saved: ['country'], refused: 'age' })),
  },
]

const COLUMN_SERVER_ARGS = {
  enableColumnDragging: true,
  enableColumnSorting: true,
  enableKeyboardNavigation: true,
  dataCount: 30,
  height: '300',
  onColumnDragEnd: saveColumnOrder,
} satisfies Partial<StoryProps>

/**
 * ADR 0130, S5: порядок колонок хранит сервер — ручка ждёт его ответа, отказ возвращает
 * колонку к прежним соседям; без отката колонка остаётся на новом месте.
 */
export const ColumnDraggingServer: StoryObj<StoryProps> = {
  name: 'Dragging — Server',
  parameters: {
    scenario: '0130/S5',
    requirements: ['CO12', 'CO17'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Перенос колонки с сервером"
      steps={COLUMN_SERVER}
      args={guideArgs(COLUMN_SERVER_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const head = (id: string) =>
      canvas.querySelector<HTMLElement>(`${HEAD}[data-column-id="${id}"]`)!
    const handle = (id: string) => head(id).querySelector<HTMLElement>(HANDLE)!
    const slow = { timeout: 5000 }
    await step(COLUMN_SERVER[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(head('country')).not.toBeNull())
    })
    await step(COLUMN_SERVER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(movedRight(canvas, 'country')).toBe(true))
      await until(() =>
        expect(handle('country')).toHaveAttribute('aria-busy', 'true'),
      )
      await releaseFocus()
    })
    await step(COLUMN_SERVER[2]!.title, async () => {
      const placed = headOrder(canvas)
      await guideNext(canvas)
      await until(() =>
        expect(handle('country')).not.toHaveAttribute('aria-busy'),
      )
      await expect(headOrder(canvas)).toEqual(placed)
      await expect(head('country')).toHaveAttribute(
        'data-column-flash',
        'accepted',
      )
    })
    await step(COLUMN_SERVER[3]!.title, async () => {
      const before = headOrder(canvas)
      await guideNext(canvas)
      await until(() =>
        expect(handle('lastName').querySelector(FAILURE)).not.toBeNull(),
      )
      await waitFor(() => expect(headOrder(canvas)).toEqual(before), slow)
      await expect(head('lastName')).toHaveAttribute(
        'data-column-flash',
        'reverted',
      )
      await releaseFocus()
    })
    await step(COLUMN_SERVER[4]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(head('age')).toHaveAttribute('data-column-flash', 'reverted'),
      )
      await expect(movedRight(canvas, 'age')).toBe(true)
      await waitFor(
        () => expect(handle('age').querySelector(FAILURE)).not.toBeNull(),
        slow,
      )
      await releaseFocus()
    })
    await settle()
  },
}

// --- ADR 0052 S1: перенос под вложенной шапкой ----------------------------------------

/** Порядок колонок группы и групп верхнего уровня — по шапке слева направо. */
const before = (root: ParentNode, a: string, b: string) =>
  indexOf(root, a) < indexOf(root, b)

interface NestedMove {
  id: string
  /** Пункт меню ручки: перенести влево или вправо. */
  item: 'moveLeft' | 'moveRight'
  done: (root: ParentNode) => boolean
}

/**
 * Довести до шага, как пользователь без перетаскивания: меню ручки колонки или группы,
 * в нём — перенос (WCAG 2.5.7). Уже выполненные переносы не повторяются.
 */
const nestedStep = (moves: NestedMove[]) => (root: HTMLElement) => {
  let tries = 0
  const run_ = ++stepRun
  const run = () => {
    const next = moves.find(move => !move.done(root))
    if (run_ !== stepRun || !next || ++tries > 60) return
    moveByMenu(root, next.id, next.item)
    setTimeout(run, 150)
  }
  setTimeout(run, 0)
}

const LEAF_SWAPPED: NestedMove = {
  id: 'lastName',
  item: 'moveLeft',
  done: root => before(root, 'lastName', 'firstName'),
}
const GROUP_MOVED: NestedMove = {
  id: 'name',
  item: 'moveRight',
  done: root => before(root, 'info', 'name'),
}

const NESTED_MOVE: readonly GuideStoryStep[] = [
  {
    title: 'Группы колонок',
    hint: 'Колонки сгруппированы. Колонку можно переставить только среди соседей её группы, а группу — среди групп того же уровня.',
  },
  {
    title: 'Колонка переставлена в группе',
    hint: 'Пользователь переставил колонку внутри группы. Порядок колонок группы изменился, заголовок группы остался над ними.',
    enter: afterRows(nestedStep([LEAF_SWAPPED])),
  },
  {
    title: 'Группа переставлена',
    hint: 'Пользователь переставил группу. Все её колонки переехали вместе с ней одним блоком.',
    enter: afterRows(nestedStep([LEAF_SWAPPED, GROUP_MOVED])),
  },
]

/** ADR 0052, S1: перенос под вложенной шапкой — колонка в группе, затем группа целиком. */
export const DraggingNested: StoryObj<StoryProps> = {
  name: 'Header groups',
  parameters: {
    scenario: '0052/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Перенос под вложенной шапкой"
      steps={NESTED_MOVE}
      args={guideArgs(
        {
          headerNesting: 'nested',
          enableColumnDragging: true,
          enableKeyboardNavigation: true,
          dataCount: 30,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const nameGroup = () =>
      canvas.querySelector<HTMLElement>(`${HEAD}[data-column-id="name"]`)!
    await step(NESTED_MOVE[0]!.title, async () => {
      await waitForRows(canvas)
      await expect(before(canvas, 'firstName', 'lastName')).toBe(true)
    })
    await step(NESTED_MOVE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(before(canvas, 'lastName', 'firstName')).toBe(true),
      )
      // Заголовок группы — над обеими колонками.
      const group = rect(nameGroup())
      for (const id of ['firstName', 'lastName']) {
        const leaf = rect(headCell(canvas, id))
        await expect(leaf.left).toBeGreaterThanOrEqual(group.left - 1)
        await expect(leaf.right).toBeLessThanOrEqual(group.right + 1)
      }
      await releaseFocus()
      await settle()
    })
    await step(NESTED_MOVE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(before(canvas, 'info', 'name')).toBe(true))
      // Колонки группы — рядом, блоком.
      await expect(
        Math.abs(indexOf(canvas, 'firstName') - indexOf(canvas, 'lastName')),
      ).toBe(1)
      await releaseFocus()
      await settle()
    })
  },
}
