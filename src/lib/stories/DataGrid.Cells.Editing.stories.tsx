import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  applyNotice as notice,
  applyNoticeEntered as noticeEntered,
} from './__mocks__/applyNotice'
import { createHeldServer, REFUSAL } from './__mocks__/heldServer'
import { untilDone } from './__mocks__/cellGestures'
import { getData } from './__mocks__/data'
import {
  consoleText,
  guideNext,
  pollUntil,
  pressEscape,
  settle,
  sleep,
  stepDone,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  type GuideApp,
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'
import type { Draft } from '../core/drafts/drafts'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import { typeInto, press } from './__mocks__/typeGuides'
import * as touch from './__mocks__/touchGuides'
import type {
  CellEditBatch,
  CellEditBatchResult,
} from '../plugins/cellEditing/types'

/** Правка ячеек (ADR 0040, ADR 0041): значение, сервер, черновик и конфликт. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Editing',
} satisfies Meta<StoryProps>

export default meta

export const CellEditingPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Правка возраста, числа визитов и пола: кнопка в ячейке по наведению, F2 и Enter с
  // клавиатуры; Enter и потеря фокуса сохраняют, Escape отменяет.
  args: {
    enableCellEditing: true,
    columnCount: 6,
    dataCount: 10,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls(['enableCellEditing', 'enableKeyboardNavigation']),
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- Действия шагов ------------------------------------------------------------------

const ageCellOf = (root: ParentNode, row: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="age"]`,
  )
const inputOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLInputElement>('input') ?? null
/** Значение в ячейке — без кнопки правки и её подписи отказа. */
const ageText = (root: ParentNode, row: string) => {
  const copy = ageCellOf(root, row)?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue], [data-cell-draft]')
    .forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const editButtonOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLElement>('.cell__button button') ??
  null
/** Ожидание и отказ сохранения — на ячейке: волна и отметка в углу (ADR 0177, §1, §5). */
const pending = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.getAttribute('aria-busy') === 'true'
const failed = (root: ParentNode, row: string) =>
  !!ageCellOf(root, row)?.querySelector('[data-cell-issue]')
const scrollerOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__container')

/** Ячейка вне видимой области таблицы: строка в правке остаётся смонтированной. */
const outOfView = (root: ParentNode, row: string) => {
  const cell = ageCellOf(root, row)
  const scroller = scrollerOf(root)
  if (!cell || !scroller) return true
  const box = cell.getBoundingClientRect()
  const frame = scroller.getBoundingClientRect()
  return box.bottom <= frame.top || box.top >= frame.bottom
}

/** Открыть правку возраста кнопкой ячейки и набрать черновик. */
const draft = (root: HTMLElement, row: string, value: string) => {
  const input = inputOf(root, row)
  if (!input) editButtonOf(root, row)?.click()
  else if (input.value !== value) typeInto(input, value)
}

const hasDraft = (root: HTMLElement, row: string, value: string) =>
  inputOf(root, row)?.value === value

/** Черновик набран — сохранить его клавишей Enter. */
const save = (root: HTMLElement, row: string, value: string) => {
  if (hasDraft(root, row, value)) press(inputOf(root, row)!, 'Enter')
  else draft(root, row, value)
}

// --- ADR 0040 S1 ---------------------------------------------------------------------

const VALUE_ROW = 'item-id-1'
const NEW_AGE = '77'

const EDIT_VALUE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Ячейки, которые можно править', en: 'Editable cells' },
    hint: {
      ru: 'Приложение разрешило править возраст, число визитов и пол. У таких ячеек при наведении появляется кнопка правки.',
      en: 'The app allowed editing the age, visit count, and gender. Hovering over such cells shows an edit button.',
    },
  },
  {
    title: { ru: 'Поле правки открыто', en: 'The edit field is open' },
    hint: {
      ru: 'Пользователь нажал кнопку правки в ячейке возраста и набрал новое число. Пока правка не сохранена, в ячейке поле с черновиком.',
      en: 'The user clicked the edit button in an age cell and typed a new number. Until the edit is saved, the cell holds a field with the draft.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => hasDraft(root, VALUE_ROW, NEW_AGE),
      root => draft(root, VALUE_ROW, NEW_AGE),
    ),
  },
  {
    title: { ru: 'Значение сохранено', en: 'The value is saved' },
    hint: {
      ru: 'Пользователь нажал Enter. Поле закрылось, в ячейке новое значение.',
      en: 'The user pressed Enter. The field closed, and the cell shows the new value.',
    },
    enter: untilDone(
      root => !inputOf(root, VALUE_ROW) && ageText(root, VALUE_ROW) === NEW_AGE,
      root => save(root, VALUE_ROW, NEW_AGE),
    ),
  },
]

/** ADR 0040, S1: пользователь правит значение ячейки и сохраняет его. */
export const EditingValue: StoryObj<StoryProps> = {
  name: 'Edit a value',
  parameters: { scenario: '0040/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Правка значения', en: 'Editing a value' }}
      steps={EDIT_VALUE}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: 10,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_VALUE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(editButtonOf(canvas, VALUE_ROW)).not.toBeNull())
      await until(() =>
        expect(
          canvas.querySelector(
            `.data-grid__body-row[data-row-id="${VALUE_ROW}"] .data-grid__body-cell[data-column-id="firstName"] .cell__button`,
          ),
        ).toBeNull(),
      )
    })
    await step(EDIT_VALUE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, VALUE_ROW)?.value).toBe(NEW_AGE))
    })
    await step(EDIT_VALUE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, VALUE_ROW)).toBeNull())
      await until(() => expect(ageText(canvas, VALUE_ROW)).toBe(NEW_AGE))
      await settle()
    })
  },
}

// --- ADR 0041 S1 ---------------------------------------------------------------------

const EDIT_SERVER = createHeldServer()
const SERVER_ROW = 'item-id-1'
const SAVED_AGE = '77'
const REFUSED_AGE = '13'

const reachRefusal = (root: HTMLElement) => {
  EDIT_SERVER.answer(false)
  if (!pending(root, SERVER_ROW)) save(root, SERVER_ROW, REFUSED_AGE)
}

const EDIT_SERVER_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правок нет', en: 'No edits yet' },
    hint: {
      ru: 'Приложение сохраняет правку ячейки на сервере. Пользователь ещё ничего не правил.',
      en: "The app saves cell edits on the server. The user hasn't edited anything yet.",
    },
  },
  {
    title: {
      ru: 'Значение отправлено на сервер',
      en: 'The value was sent to the server',
    },
    hint: {
      ru: 'Пользователь сохранил новое значение, и приложение отправило его на сервер. Пока сервер не ответил, ячейка чуть темнеет и по ней проходит светлый блик, а соседние ячейки можно править.',
      en: 'The user saved a new value, and the app sent it to the server. Until the server responds, the cell darkens slightly and a light shimmer passes over it, while neighboring cells can still be edited.',
    },
    states: ['body.pending'],
    enter: untilDone(
      root => pending(root, SERVER_ROW),
      root => {
        EDIT_SERVER.hold()
        save(root, SERVER_ROW, SAVED_AGE)
      },
    ),
  },
  {
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Сервер принял значение. Ожидание снято, ячейка коротко вспыхивает тоном успеха.',
      en: 'The server accepted the value. The waiting state is cleared, and the cell flashes briefly in the success tone.',
    },
    immediate: true,
    enter: untilDone(
      root =>
        !pending(root, SERVER_ROW) && ageText(root, SERVER_ROW) === SAVED_AGE,
      root => {
        EDIT_SERVER.answer(true)
        if (!pending(root, SERVER_ROW)) save(root, SERVER_ROW, SAVED_AGE)
      },
    ),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Пользователь сохранил ещё одно значение, но сервер его отклонил. В ячейке снова значение из данных, ячейка коротко вспыхивает тоном ошибки, в её правом верхнем углу появилась отметка отказа.',
      en: 'The user saved another value, but the server rejected it. The cell shows the value from the data again and flashes briefly in the error tone, and a refusal mark appeared in its top-right corner.',
    },
    states: ['body.error'],
    enter: untilDone(root => failed(root, SERVER_ROW), reachRefusal),
  },
  {
    title: { ru: 'Повторная правка', en: 'Editing again' },
    hint: {
      ru: 'Пользователь снова открыл правку. В поле отклонённое значение, а рядом причина отказа от сервера.',
      en: "The user opened the edit again. The field holds the rejected value, and next to it is the server's reason for the refusal.",
    },
    states: ['body.editing'],
    enter: untilDone(
      // Причина отказа в поле: пустая область сообщений есть у любой открытой правки.
      root =>
        !!ageCellOf(root, SERVER_ROW)
          ?.querySelector('[role="alert"]')
          ?.textContent?.trim(),
      root => {
        if (!failed(root, SERVER_ROW)) reachRefusal(root)
        // Со свежей таблицы отказ только что пришёл: правка — после его вспышки.
        else if (!ageCellOf(root, SERVER_ROW)?.hasAttribute('data-flash'))
          editButtonOf(root, SERVER_ROW)?.click()
      },
    ),
  },
]

/** ADR 0041, S1: сохранение ждёт сервера — ожидание, успех, отказ и повторная правка. */
export const EditingServer: StoryObj<StoryProps> = {
  name: 'Server save',
  parameters: {
    scenario: '0041/S1',
    requirements: ['DS1'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Сохранение на сервере', en: 'Saving on the server' }}
      steps={EDIT_SERVER_STEPS}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: 10,
          onCellEdit: EDIT_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_SERVER_STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(EDIT_SERVER_STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(pending(canvas, SERVER_ROW)).toBe(true))
      // Ожидание и значение — разные срезы: React 18 коммитит их по одному.
      await until(() => expect(ageText(canvas, SERVER_ROW)).toBe(SAVED_AGE))
    })
    await step(EDIT_SERVER_STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(pending(canvas, SERVER_ROW)).toBe(false))
      await until(() => expect(ageText(canvas, SERVER_ROW)).toBe(SAVED_AGE))
      await until(() => expect(consoleText()).toContain('onCellEdit'))
      await until(() =>
        expect(ageCellOf(canvas, SERVER_ROW)).toHaveAttribute(
          'data-flash',
          'accepted',
        ),
      )
      // Значок кнопки возвращается из приглушённого цвета ожидания переходом.
      await settle()
    })
    await step(EDIT_SERVER_STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(ageCellOf(canvas, SERVER_ROW)).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      await until(() =>
        expect(
          ageCellOf(canvas, SERVER_ROW)!.querySelector('[data-cell-issue]'),
        ).not.toBeNull(),
      )
      // Значение из данных: после прошлого шага — сохранённое, со свежей таблицы — исходное.
      await until(() => expect(ageText(canvas, SERVER_ROW)).toMatch(/^\d+$/))
      expect(ageText(canvas, SERVER_ROW)).not.toBe(REFUSED_AGE)
    })
    await step(EDIT_SERVER_STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, SERVER_ROW)?.value).toBe(REFUSED_AGE),
      )
      await until(() =>
        expect(
          ageCellOf(canvas, SERVER_ROW)!.querySelector('[role="alert"]'),
        ).toHaveTextContent(REFUSAL),
      )
      await settle()
    })
  },
}

// --- ADR 0134 S1 ---------------------------------------------------------------------

const AWAY_SERVER = createHeldServer()
const AWAY_ROW = 'item-id-1'
const OTHER_ROW = 'item-id-3'
const AWAY_AGE = '77'
const OTHER_AGE = '5'

/** Первое значение ждёт сервера, а в другой строке открыта правка с черновиком. */
const reachAway = (root: HTMLElement) => {
  if (!pending(root, AWAY_ROW) && !failed(root, AWAY_ROW)) {
    AWAY_SERVER.hold()
    save(root, AWAY_ROW, AWAY_AGE)
  } else draft(root, OTHER_ROW, OTHER_AGE)
}

const AWAY: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правок нет', en: 'No edits yet' },
    hint: {
      ru: 'Приложение сохраняет правку ячейки на сервере. Пользователь ещё ничего не правил.',
      en: "The app saves cell edits on the server. The user hasn't edited anything yet.",
    },
  },
  {
    title: {
      ru: 'Значение отправлено на сервер',
      en: 'The value was sent to the server',
    },
    hint: {
      ru: 'Пользователь сохранил новый возраст, и приложение отправило его на сервер. Пока сервер не ответил, ячейка чуть темнеет и по ней проходит светлый блик.',
      en: 'The user saved a new age, and the app sent it to the server. Until the server responds, the cell darkens slightly and a light shimmer passes over it.',
    },
    states: ['body.pending'],
    enter: untilDone(
      root => pending(root, AWAY_ROW),
      root => {
        AWAY_SERVER.hold()
        save(root, AWAY_ROW, AWAY_AGE)
      },
    ),
  },
  {
    title: { ru: 'Правка другой ячейки', en: 'Editing another cell' },
    hint: {
      ru: 'Не дожидаясь ответа, пользователь открыл правку возраста в другой строке и набрал число.',
      en: 'Without waiting for the response, the user opened the age edit in another row and typed a number.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root => pending(root, AWAY_ROW) && hasDraft(root, OTHER_ROW, OTHER_AGE),
      reachAway,
    ),
  },
  {
    title: { ru: 'Сервер отказал', en: 'The server refused' },
    hint: {
      ru: 'Сервер отклонил первое значение. Его ячейка вернулась к значению из данных и коротко вспыхнула тоном ошибки, в её правом верхнем углу появилась отметка отказа, а правка в другой строке продолжается.',
      en: 'The server rejected the first value. Its cell went back to the value from the data and flashed briefly in the error tone, a refusal mark appeared in its top-right corner, and the edit in the other row continues.',
    },
    immediate: true,
    enter: untilDone(
      root => failed(root, AWAY_ROW) && hasDraft(root, OTHER_ROW, OTHER_AGE),
      root =>
        pending(root, AWAY_ROW) && hasDraft(root, OTHER_ROW, OTHER_AGE)
          ? AWAY_SERVER.answer(false)
          : reachAway(root),
    ),
  },
]

/** ADR 0134, S1: сервер отказал в сохранении, а пользователь уже правит другую ячейку. */
export const EditingRevertedWhileAway: StoryObj<StoryProps> = {
  name: 'Refused while editing another cell',
  parameters: { scenario: '0134/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Отказ, пока идёт другая правка',
        en: 'A refusal while another edit is in progress',
      }}
      steps={AWAY}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: 10,
          onCellEdit: AWAY_SERVER.save,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let original = ''
    await step(AWAY[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(AWAY[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(pending(canvas, AWAY_ROW)).toBe(true))
      expect(ageText(canvas, AWAY_ROW)).toBe(AWAY_AGE)
      original = String(getData(10).find(row => row.id === AWAY_ROW)?.age ?? '')
    })
    await step(AWAY[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, OTHER_ROW)?.value).toBe(OTHER_AGE),
      )
      expect(pending(canvas, AWAY_ROW)).toBe(true)
    })
    await step(AWAY[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(ageCellOf(canvas, AWAY_ROW)).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      expect(ageText(canvas, AWAY_ROW)).toBe(original)
      await until(() => expect(failed(canvas, AWAY_ROW)).toBe(true))
      expect(inputOf(canvas, OTHER_ROW)?.value).toBe(OTHER_AGE)
      await settle()
    })
  },
}

// --- ADR 0040 S2–S3 ------------------------------------------------------------------

const SESSION_ROW = 'item-id-0'
const SESSION_ROWS = 100
const DRAFT_AGE = '55'

/** Данные после изменения извне: возраст первой строки на год больше. */
const changedRows = () =>
  getData(SESSION_ROWS, 'flat').map(row =>
    row.id === SESSION_ROW ? { ...row, age: Number(row.age) + 1 } : row,
  )

const externalAge = () => String(changedRows()[0]!.age)

/**
 * Правка открыта с черновиком, затем приложение меняет данные извне — один раз за
 * открытие таблицы.
 */
const draftThenChange = (
  root: HTMLElement,
  app: GuideApp,
  changed: { done: boolean },
) => {
  const scroller = scrollerOf(root)
  if (scroller && scroller.scrollTop > 0) {
    scroller.scrollTop = 0
    return
  }
  if (!hasDraft(root, SESSION_ROW, DRAFT_AGE)) {
    draft(root, SESSION_ROW, DRAFT_AGE)
    return
  }
  if (!changed.done) {
    changed.done = true
    app.update(props =>
      props.dataOverride ? props : { dataOverride: changedRows() },
    )
  }
}

const EDIT_SESSION: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка не открыта', en: 'No edit is open' },
    hint: {
      ru: 'Возраст в ячейках можно править. Пользователь ещё не открывал правку.',
      en: "The age cells can be edited. The user hasn't opened an edit yet.",
    },
  },
  {
    title: { ru: 'Правка открыта', en: 'An edit is open' },
    hint: {
      ru: 'Пользователь открыл правку возраста в первой строке и набрал число, но ещё не сохранил.',
      en: "The user opened the age edit in the first row and typed a number but hasn't saved it yet.",
    },
    states: ['body.editing'],
    enter: untilDone(
      root => hasDraft(root, SESSION_ROW, DRAFT_AGE),
      root => draft(root, SESSION_ROW, DRAFT_AGE),
    ),
  },
  {
    title: { ru: 'Таблица прокручена', en: 'The table is scrolled' },
    hint: {
      ru: 'Пользователь прокрутил таблицу вниз, и строка с правкой ушла из вида.',
      en: 'The user scrolled the table down, and the row being edited went out of view.',
    },
    enter: untilDone(
      root =>
        hasDraft(root, SESSION_ROW, DRAFT_AGE) && outOfView(root, SESSION_ROW),
      root => {
        if (!hasDraft(root, SESSION_ROW, DRAFT_AGE))
          draft(root, SESSION_ROW, DRAFT_AGE)
        else scrollerOf(root)!.scrollTop = scrollerOf(root)!.scrollHeight
      },
    ),
  },
  {
    title: {
      ru: 'Данные изменились извне',
      en: 'The data changed from outside',
    },
    hint: {
      ru: 'Пользователь вернулся к строке, а приложение тем временем изменило её возраст. Поле осталось открытым, черновик в нём не тронут.',
      en: 'The user came back to the row, and meanwhile the app changed its age. The field stayed open, and the draft in it is untouched.',
    },
    states: ['body.editing'],
    enter: (root, app) => {
      const changed = { done: false }
      return untilDone(
        () => changed.done && hasDraft(root, SESSION_ROW, DRAFT_AGE),
        () => draftThenChange(root, app, changed),
      )(root, app)
    },
  },
  {
    title: { ru: 'Черновик сохранён', en: 'The draft is saved' },
    hint: {
      ru: 'Пользователь нажал Enter. В ячейке его значение, а в консоли видны и исходное, и изменённое извне.',
      en: "The user pressed Enter. The cell shows the user's value, and the console shows both the original value and the one changed from outside.",
    },
    enter: (root, app) => {
      const changed = { done: false }
      return untilDone(
        () =>
          !inputOf(root, SESSION_ROW) &&
          ageText(root, SESSION_ROW) === DRAFT_AGE,
        () => {
          if (changed.done && hasDraft(root, SESSION_ROW, DRAFT_AGE))
            press(inputOf(root, SESSION_ROW)!, 'Enter')
          else draftThenChange(root, app, changed)
        },
      )(root, app)
    },
  },
]

/** ADR 0040, S2: черновик правки переживает прокрутку и изменение данных извне. */
export const EditingSession: StoryObj<StoryProps> = {
  name: 'Draft survives',
  parameters: {
    scenario: '0040/S2',
    requirements: ['DS2'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Черновик правки', en: 'An edit draft' }}
      steps={EDIT_SESSION}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: SESSION_ROWS,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_SESSION[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(EDIT_SESSION[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
    })
    await step(EDIT_SESSION[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(outOfView(canvas, SESSION_ROW)).toBe(true))
    })
    await step(EDIT_SESSION[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
      await until(() => expect(consoleText()).toContain('dataOverride'))
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
    })
    await step(EDIT_SESSION[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, SESSION_ROW)).toBeNull())
      await until(() => expect(ageText(canvas, SESSION_ROW)).toBe(DRAFT_AGE))
      await until(() =>
        expect(consoleText()).toMatch(
          new RegExp(
            `value:${DRAFT_AGE},text:"${DRAFT_AGE}",original:\\d+,current:${externalAge()}`,
          ),
        ),
      )
      await settle()
    })
  },
}

const EDIT_CONFLICT: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка не открыта', en: 'No edit is open' },
    hint: {
      ru: 'Возраст в ячейках можно править, а приложение меняет данные и само. Пользователь ещё не открывал правку.',
      en: "The age cells can be edited, and the app also changes the data on its own. The user hasn't opened an edit yet.",
    },
  },
  {
    title: {
      ru: 'Данные изменились во время правки',
      en: 'The data changed during an edit',
    },
    hint: {
      ru: 'Пользователь правит возраст, а приложение в это время изменило ту же ячейку.',
      en: 'The user is editing an age, and meanwhile the app changed the same cell.',
    },
    states: ['body.editing'],
    enter: (root, app) => {
      const changed = { done: false }
      return untilDone(
        () => changed.done && hasDraft(root, SESSION_ROW, DRAFT_AGE),
        () => draftThenChange(root, app, changed),
      )(root, app)
    },
  },
  {
    title: { ru: 'Сохранение отклонено', en: 'The save was rejected' },
    hint: {
      ru: 'Пользователь нажал Enter. Правка закрылась без сохранения, в ячейке значение, пришедшее извне. Причина отмены видна в консоли.',
      en: 'The user pressed Enter. The edit closed without saving, and the cell shows the value that came from outside. The reason for the cancellation is in the console.',
    },
    enter: (root, app) => {
      const changed = { done: false }
      return untilDone(
        () =>
          !inputOf(root, SESSION_ROW) &&
          ageText(root, SESSION_ROW) === externalAge(),
        () => {
          if (changed.done && hasDraft(root, SESSION_ROW, DRAFT_AGE))
            press(inputOf(root, SESSION_ROW)!, 'Enter')
          else draftThenChange(root, app, changed)
        },
      )(root, app)
    },
  },
]

/** ADR 0040, S3: приложение не даёт сохранить правку поверх изменения извне. */
export const EditingConflict: StoryObj<StoryProps> = {
  name: 'Conflict blocks save',
  parameters: { scenario: '0040/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Конфликт правки', en: 'An edit conflict' }}
      steps={EDIT_CONFLICT}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: SESSION_ROWS,
          height: '360',
          onConflict: 'block',
          onEditCancel: () => undefined,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_CONFLICT[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(EDIT_CONFLICT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(consoleText()).toContain('dataOverride'))
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
    })
    await step(EDIT_CONFLICT[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, SESSION_ROW)).toBeNull())
      await until(() =>
        expect(ageText(canvas, SESSION_ROW)).toBe(externalAge()),
      )
      await until(() => expect(consoleText()).toContain('onEditCancel'))
      await until(() => expect(consoleText()).toContain('conflict'))
      await settle()
    })
  },
}

// --- ADR 0178 S5–S7 -----------------------------------------------------------------

/** «Сервер» пакета правок: придерживает ответ и отказывает одной строке, если задано. */
const batchServer = {
  held: false,
  refuseRow: undefined as string | undefined,
  waiting: [] as (() => void)[],
  reset: () => {
    batchServer.held = false
    batchServer.refuseRow = undefined
    batchServer.waiting = []
  },
  release: () => {
    batchServer.held = false
    batchServer.waiting.splice(0).forEach(answer => answer())
  },
  save: (batch: CellEditBatch) =>
    new Promise<CellEditBatchResult | void>(resolve => {
      const answer = () =>
        resolve(
          batchServer.refuseRow
            ? {
                refused: batch.cells
                  .filter(cell => cell.rowId === batchServer.refuseRow)
                  .map(cell => ({
                    rowId: cell.rowId,
                    columnId: cell.columnId,
                    reason: REFUSAL,
                  })),
              }
            : undefined,
        )
      if (batchServer.held) batchServer.waiting.push(answer)
      else answer()
    }),
}

const MANUAL_ARGS = {
  enableCellEditing: true,
  enableKeyboardNavigation: true,
  cellEditingSaveMode: 'manual',
  enableUnsavedChanges: true,
  enableToolbar: true,
  columnCount: 6,
  dataCount: 10,
  onCommitEdits: batchServer.save,
} satisfies Partial<StoryProps>

const MANUAL_EDITS = [
  ['item-id-1', '77'],
  ['item-id-2', '5'],
  ['item-id-3', '40'],
] as const

const draftMarked = (root: ParentNode, row: string) =>
  !!ageCellOf(root, row)?.querySelector('[data-cell-draft]')
const panelButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="unsaved-changes-button"]')
const panelCount = (root: ParentNode) => {
  const bubble = panelButton(root)?.querySelector('[data-active-indicator]')
  return bubble?.getAttribute('data-shown') === 'true'
    ? Number(bubble.textContent)
    : 0
}
const panelOpen = () =>
  !!document.querySelector('[data-testid="unsaved-changes"]')
/** Пульт открыт — нажать «Применить всё»; закрыт — открыть. */
const applyAll = (root: HTMLElement) => {
  if (!panelOpen()) panelButton(root)?.click()
  else document.querySelector<HTMLElement>('[data-action="apply-all"]')?.click()
}

/** Правки набраны и сохранены клавишей Enter: в ячейках черновики. */
const editsDrafted = (
  root: HTMLElement,
  edits: readonly (readonly [string, string])[],
) => {
  for (const [row, value] of edits) {
    if (draftMarked(root, row) && ageText(root, row) === value) continue
    save(root, row, value)
    return false
  }
  return true
}

const MANUAL_SAVE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сохранение по кнопке', en: 'Saving with a button' },
    hint: {
      ru: 'Приложение сохраняет правки не сразу, а пакетом — по кнопке пульта в тулбаре.',
      en: 'The app saves edits not right away but as a batch, using the unsaved changes panel button in the toolbar.',
    },
  },
  {
    title: { ru: 'Три правки', en: 'Three edits' },
    hint: {
      ru: 'Пользователь поправил возраст в трёх строках. Новые значения видны в ячейках, но ещё не сохранены: в углу каждой ячейки отметка несохранённого изменения, на кнопке пульта — число несохранённых изменений.',
      en: "The user edited the age in three rows. The new values show in the cells but aren't saved yet: each cell has an unsaved change mark in its corner, and the unsaved changes panel button shows the number of unsaved changes.",
    },
    states: ['body.cellDraft'],
    enter: untilDone(
      root => editsDrafted(root, MANUAL_EDITS) && !inputOf(root, 'item-id-3'),
      root => editsDrafted(root, MANUAL_EDITS),
    ),
  },
  {
    title: { ru: 'Пакет отправлен', en: 'The batch was sent' },
    hint: {
      ru: 'Пользователь открыл пульт и нажал «Применить всё». Все три правки ушли на сервер одним запросом; пока сервер не ответил, ячейки пакета ждут.',
      en: "The user opened the unsaved changes panel and clicked “Apply all”. All three edits went to the server in one request; until the server responds, the batch's cells are waiting.",
    },
    states: ['body.pending'],
    immediate: true,
    // Пакет ушёл, и пульт, закрывшись после «Применить всё», вернул фокус кнопке.
    enter: untilDone(
      root => MANUAL_EDITS.every(([row]) => pending(root, row)) && !panelOpen(),
      root => {
        batchServer.held = true
        if (MANUAL_EDITS.some(([row]) => !draftMarked(root, row)))
          editsDrafted(root, MANUAL_EDITS)
        else applyAll(root)
      },
    ),
  },
  {
    title: { ru: 'Сервер сохранил', en: 'The server saved' },
    hint: {
      ru: 'Сервер принял пакет. Ожидание снято, уголки исчезли, ячейки коротко вспыхивают тоном успеха; несохранённых изменений не осталось. Над таблицей плашка говорит, сколько изменений сохранено, и через несколько секунд уходит сама.',
      en: 'The server accepted the batch. The waiting state is cleared, the corner marks are gone, and the cells flash briefly in the success tone; no unsaved changes are left. A notice above the table says how many changes were saved and leaves on its own in a few seconds.',
    },
    states: ['body.applySaved'],
    immediate: true,
    enter: untilDone(
      root =>
        savedNotice(root) &&
        MANUAL_EDITS.every(
          ([row, value]) =>
            !pending(root, row) &&
            !draftMarked(root, row) &&
            ageText(root, row) === value,
        ),
      root => {
        if (MANUAL_EDITS.some(([row]) => pending(root, row)))
          batchServer.release()
        else if (MANUAL_EDITS.some(([row]) => !draftMarked(root, row)))
          editsDrafted(root, MANUAL_EDITS)
        else applyAll(root)
      },
    ),
  },
]

/** ADR 0178, S5: три правки, «Применить всё» — один запрос, ожидание и ответ сервера. */
export const ManualSaveCells: StoryObj<StoryProps> = {
  name: 'Save by button',
  parameters: { scenario: '0178/S5', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Сохранение по кнопке', en: 'Saving with a button' }}
      steps={MANUAL_SAVE}
      reset={() => batchServer.reset()}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MANUAL_SAVE[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(MANUAL_SAVE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(MANUAL_EDITS.every(([row]) => draftMarked(canvas, row))).toBe(
          true,
        ),
      )
      expect(panelCount(canvas)).toBe(3)
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(MANUAL_SAVE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(MANUAL_EDITS.every(([row]) => pending(canvas, row))).toBe(true),
      )
      await until(() => expect(panelOpen()).toBe(false))
      expect(consoleText()).toContain('onCommitEdits')
    })
    await step(MANUAL_SAVE[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(panelCount(canvas)).toBe(0))
      for (const [row, value] of MANUAL_EDITS) {
        expect(draftMarked(canvas, row)).toBe(false)
        await until(() => expect(ageText(canvas, row)).toBe(value))
      }
      await until(() => expect(savedNotice(canvas)).toBe(true))
      await noticeEntered(canvas)
    })
  },
}

const PARTIAL_EDITS = MANUAL_EDITS.slice(0, 2)
const REFUSED_ROW = 'item-id-2'

const PARTIAL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Сохранение по кнопке', en: 'Saving with a button' },
    hint: {
      ru: 'Приложение сохраняет правки пакетом по кнопке пульта. Сервер принимает пакет, но одну из строк сейчас отклоняет.',
      en: 'The app saves edits as a batch using the unsaved changes panel button. The server accepts the batch but currently rejects one of the rows.',
    },
  },
  {
    title: { ru: 'Две правки', en: 'Two edits' },
    hint: {
      ru: 'Пользователь поправил возраст в двух строках. В углу обеих ячеек отметка несохранённого изменения: значения ещё не сохранены.',
      en: "The user edited the age in two rows. Both cells have an unsaved change mark in the corner: the values aren't saved yet.",
    },
    states: ['body.cellDraft'],
    enter: untilDone(
      root =>
        editsDrafted(root, PARTIAL_EDITS) &&
        !inputOf(root, PARTIAL_EDITS[1]![0]),
      root => editsDrafted(root, PARTIAL_EDITS),
    ),
  },
  {
    title: {
      ru: 'Сервер отказал одной ячейке',
      en: 'The server refused one cell',
    },
    hint: {
      ru: 'Пользователь применил всё из пульта. Сервер сохранил одну правку и отклонил другую. Сохранённая ячейка вспыхнула тоном успеха; у отклонённой в углу отметка отказа с причиной, а несохранённое значение осталось в ячейке. Над таблицей плашка говорит, сколько изменений сохранено из общего числа; на ней кнопка показа журнала ошибок, сама она не уходит.',
      en: 'The user applied everything from the unsaved changes panel. The server saved one edit and rejected the other. The saved cell flashed in the success tone; the rejected one has a refusal mark with the reason in its corner, and its unsaved value stayed in the cell. Above the table, a notice says how many changes were saved out of the total, with a button that opens the error log; it does not leave on its own.',
    },
    states: ['body.error', 'body.applyPartly'],
    enter: untilDone(
      root =>
        failed(root, REFUSED_ROW) &&
        !draftMarked(root, 'item-id-1') &&
        failedNotice(root),
      root => {
        batchServer.refuseRow = REFUSED_ROW
        if (PARTIAL_EDITS.some(([row]) => !draftMarked(root, row)))
          editsDrafted(root, PARTIAL_EDITS)
        else applyAll(root)
      },
    ),
  },
]

/** ADR 0178, S6: сервер отказал одной ячейке пакета — отказ на ней, черновик остаётся. */
export const ManualSavePartialRefusal: StoryObj<StoryProps> = {
  name: 'Refused part of the batch',
  parameters: { scenario: '0178/S6', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Отказ части пакета', en: 'A partial batch refusal' }}
      steps={PARTIAL}
      reset={() => {
        batchServer.reset()
        batchServer.refuseRow = REFUSED_ROW
      }}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PARTIAL[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(PARTIAL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(panelCount(canvas)).toBe(2))
    })
    await step(PARTIAL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(failed(canvas, REFUSED_ROW)).toBe(true))
      expect(ageText(canvas, REFUSED_ROW)).toBe(PARTIAL_EDITS[1]![1])
      expect(draftMarked(canvas, 'item-id-1')).toBe(false)
      await until(() =>
        expect(ageText(canvas, 'item-id-1')).toBe(PARTIAL_EDITS[0]![1]),
      )
      expect(panelCount(canvas)).toBe(1)
      await until(() => expect(failedNotice(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(
        cellEditingLabels(storyLabels(args.locale)).applyPartly(1, 2),
      )
      await settle()
    })
  },
}

const ROLLBACK_ROW = 'item-id-1'
const ROLLBACK_AGE = '77'
const rollbackPopover = () =>
  document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')

const ROLLBACK: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правок нет', en: 'No edits yet' },
    hint: {
      ru: 'Приложение сохраняет правки по кнопке пульта. Пользователь ещё ничего не правил.',
      en: "The app saves edits using the unsaved changes panel button. The user hasn't edited anything yet.",
    },
  },
  {
    title: { ru: 'Несохранённое значение', en: 'An unsaved value' },
    hint: {
      ru: 'Приложение сохраняет правки по кнопке пульта. Пользователь поправил возраст: новое значение в ячейке, в её углу отметка несохранённого изменения.',
      en: 'The app saves edits using the unsaved changes panel button. The user edited an age: the new value is in the cell, with an unsaved change mark in its corner.',
    },
    states: ['body.cellDraft'],
    enter: untilDone(
      root => draftMarked(root, ROLLBACK_ROW) && !inputOf(root, ROLLBACK_ROW),
      root => save(root, ROLLBACK_ROW, ROLLBACK_AGE),
    ),
  },
  {
    title: { ru: 'Было и стало', en: 'Before and after' },
    hint: {
      ru: 'Пользователь нажал на уголок. В поповере — прежнее значение, новое и кнопка отката.',
      en: 'The user clicked the corner mark. The popover shows the previous value, the new one, and a revert button.',
    },
    states: ['overlay.cellIssue'],
    enter: untilDone(
      () => !!rollbackPopover(),
      root => {
        if (!draftMarked(root, ROLLBACK_ROW))
          save(root, ROLLBACK_ROW, ROLLBACK_AGE)
        else
          ageCellOf(root, ROLLBACK_ROW)
            ?.querySelector<HTMLElement>('[data-cell-draft]')
            ?.click()
      },
    ),
  },
  {
    title: { ru: 'Значение откачено', en: 'The value was reverted' },
    hint: {
      ru: 'Пользователь откатил правку. В ячейке снова значение из данных, уголка нет, несохранённых изменений не осталось.',
      en: 'The user reverted the edit. The cell shows the value from the data again, the corner mark is gone, and no unsaved changes are left.',
    },
    enter: untilDone(
      root => !draftMarked(root, ROLLBACK_ROW) && !rollbackPopover(),
      root => {
        const rollback = rollbackPopover()?.querySelector<HTMLElement>(
          '[data-action="rollback"]',
        )
        if (rollback) rollback.click()
        else if (!draftMarked(root, ROLLBACK_ROW))
          save(root, ROLLBACK_ROW, ROLLBACK_AGE)
        else
          ageCellOf(root, ROLLBACK_ROW)
            ?.querySelector<HTMLElement>('[data-cell-draft]')
            ?.click()
      },
    ),
  },
]

/** ADR 0178, S7: пользователь откатывает одну несохранённую правку из поповера уголка. */
export const CellDraftRollback: StoryObj<StoryProps> = {
  name: 'Roll back an edit',
  parameters: { scenario: '0178/S7', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Откат правки', en: 'Reverting an edit' }}
      steps={ROLLBACK}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let before = ''
    await step(ROLLBACK[0]!.title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(ROLLBACK[1]!.title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(draftMarked(canvas, ROLLBACK_ROW)).toBe(true))
      await until(() =>
        expect(ageText(canvas, ROLLBACK_ROW)).toBe(ROLLBACK_AGE),
      )
      before = String(getData(10).find(row => row.id === ROLLBACK_ROW)!.age)
    })
    await step(ROLLBACK[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rollbackPopover()).not.toBeNull())
      await until(() =>
        expect(rollbackPopover()!.textContent).toContain(before),
      )
      await until(() =>
        expect(rollbackPopover()!.textContent).toContain(ROLLBACK_AGE),
      )
    })
    await step(ROLLBACK[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(draftMarked(canvas, ROLLBACK_ROW)).toBe(false))
      await until(() => expect(ageText(canvas, ROLLBACK_ROW)).toBe(before))
      await until(() => expect(panelCount(canvas)).toBe(0))
      await settle()
    })
  },
}

// --- ADR 0227 S1, S3 -----------------------------------------------------------------

/** «Сервер» пакета: принимает всё или, когда недоступен, отклоняет запрос целиком. */
const APPLY_DOWN = 'The server is unavailable'
const applyServer = {
  down: false,
  save: (): Promise<CellEditBatchResult | void> =>
    applyServer.down
      ? Promise.reject(new Error(APPLY_DOWN))
      : Promise.resolve(),
}

/** Три правки возраста, набранные до начала сценария. */
const APPLY_DRAFTS: Draft[] = MANUAL_EDITS.map(([row, value]) => ({
  kind: 'cellValue',
  target: { cell: [row, 'age'] },
  value: { value: Number(value), text: value },
}))

const APPLY_ARGS = {
  ...MANUAL_ARGS,
  // Строки — с первой отрисовки: черновики строк, которых в данных нет, таблица снимает.
  dataOverride: getData(MANUAL_ARGS.dataCount),
  enableFailureLog: true,
  onCommitEdits: applyServer.save,
  initialDrafts: APPLY_DRAFTS,
} satisfies Partial<StoryProps>

const noticeAction = (root: ParentNode) =>
  notice(root)?.querySelector<HTMLElement>(
    '[data-testid="table-notice-action"]',
  ) ?? null
const noticeTitle = (root: ParentNode) =>
  notice(root)?.querySelector('[id]')?.textContent ?? ''
const savedNotice = (root: ParentNode) =>
  notice(root)?.getAttribute('data-tone') === 'success'
const failedNotice = (root: ParentNode) =>
  !!notice(root) && !savedNotice(root) && !!noticeAction(root)
const logButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="failure-log-button"]')
const log = () =>
  document.querySelector<HTMLElement>('[data-testid="failure-log"]')
const logEntries = () => [
  ...(log()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []),
]
/** Записей журнала по счётчику на его кнопке; без счётчика — ноль. */
const logCount = (root: ParentNode) => {
  const bubble = logButton(root)?.querySelector('[data-active-indicator]')
  return bubble?.getAttribute('data-shown') === 'true'
    ? Number(bubble.textContent)
    : 0
}

/** Правки сохранены: черновиков нет, в ячейках новые значения. */
const allSaved = (root: ParentNode) =>
  panelCount(root) === 0 &&
  MANUAL_EDITS.every(
    ([row, value]) => !draftMarked(root, row) && ageText(root, row) === value,
  )
/** Правки остались черновиками без отметки отказа. */
const draftsKept = (root: ParentNode) =>
  MANUAL_EDITS.every(([row]) => draftMarked(root, row) && !failed(root, row))

const APPLY_SAVED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правки ждут сохранения', en: 'Edits waiting to be saved' },
    hint: {
      ru: 'Приложение сохраняет правки пакетом по кнопке пульта в тулбаре. Пользователь уже поправил возраст в трёх строках: в углу каждой ячейки отметка несохранённого изменения.',
      en: 'The app saves edits as a batch using the unsaved changes panel button in the toolbar. The user has already edited the age in three rows: each cell has an unsaved change mark in its corner.',
    },
    states: ['body.cellDraft'],
  },
  {
    title: { ru: 'Всё сохранено', en: 'Everything is saved' },
    hint: {
      ru: 'Пользователь применил всё из пульта, и сервер принял все три правки. Отметки ушли, а над таблицей плашка в тоне успеха говорит, сколько изменений сохранено. Через несколько секунд она уйдёт сама.',
      en: 'The user applied everything from the unsaved changes panel, and the server accepted all three edits. The marks are gone, and a notice in the success tone above the table says how many changes were saved. In a few seconds it will leave on its own.',
    },
    states: ['body.applySaved'],
    immediate: true,
    // Пульт, закрывшись после применения, ушёл: шаг — плашка над таблицей.
    enter: untilDone(root => savedNotice(root) && !panelOpen(), applyAll),
  },
  {
    title: { ru: 'Плашка ушла сама', en: 'The notice left on its own' },
    hint: {
      ru: 'Пользователь ничего не нажимал, и через три секунды плашка ушла сама. В ячейках сохранённые значения, несохранённых изменений нет.',
      en: "The user didn't click anything, and after three seconds the notice left on its own. The cells show the saved values, and no unsaved changes are left.",
    },
    enter: stepAction(async (root, { signal }) => {
      let applied = false
      while (!allSaved(root)) {
        applied = true
        applyAll(root)
        await sleep(150)
        signal.throwIfAborted()
      }
      // Со свежей таблицы плашка сперва появляется; уходит она через три секунды.
      if (applied) await pollUntil(() => savedNotice(root), signal)
      await pollUntil(() => !notice(root), signal, 10_000)
    }),
  },
]

/** ADR 0227, S1: сервер принял все правки пакета — плашка подтверждает и уходит сама. */
export const CellsEditingApplySaved: StoryObj<StoryProps> = {
  name: 'Apply: all saved',
  parameters: { scenario: '0227/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Всё сохранено', en: 'Everything saved' }}
      steps={APPLY_SAVED}
      reset={() => {
        applyServer.down = false
      }}
      args={guideArgs(APPLY_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const own = cellEditingLabels(storyLabels(args.locale))
    await step(APPLY_SAVED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(MANUAL_EDITS.every(([row]) => draftMarked(canvas, row))).toBe(
          true,
        ),
      )
      expect(notice(canvas)).toBeNull()
    })
    await step(APPLY_SAVED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(savedNotice(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(own.applySaved(3))
      expect(noticeAction(canvas)).toBeNull()
      await until(() => expect(panelOpen()).toBe(false))
      await noticeEntered(canvas)
      await until(() => expect(allSaved(canvas)).toBe(true))
      // Текст старого счётчика живёт до конца перехода. Аудит этого шага
      // проверяет кнопку уже после исчезновения счётчика.
      await until(() =>
        expect(
          panelButton(canvas)?.querySelector(
            '[data-active-indicator][data-count]',
          ),
        ).toBeNull(),
      )
    })
    await step(APPLY_SAVED[2]!.title.ru, async () => {
      await guideNext(canvas)
      // Плашка уходит через три секунды — дольше ожидания проверки.
      await stepDone(canvas)
      expect(notice(canvas)).toBeNull()
      expect(allSaved(canvas)).toBe(true)
      await settle()
    })
  },
}

/** Запрос не прошёл: плашка с повтором, одна запись журнала, правки — черновики. */
const requestFailed = (root: ParentNode) =>
  failedNotice(root) && logCount(root) === 1 && draftsKept(root)
const reachRequestFailed = (root: HTMLElement) => {
  applyServer.down = true
  applyAll(root)
}

const APPLY_FAILED: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правки ждут сохранения', en: 'Edits waiting to be saved' },
    hint: {
      ru: 'Приложение сохраняет правки пакетом по кнопке пульта в тулбаре. Пользователь уже поправил возраст в трёх строках, но сервер сейчас недоступен.',
      en: 'The app saves edits as a batch using the unsaved changes panel button in the toolbar. The user has already edited the age in three rows, but the server is unavailable right now.',
    },
    states: ['body.cellDraft'],
  },
  {
    title: { ru: 'Запрос не прошёл', en: 'The request failed' },
    hint: {
      ru: 'Пользователь применил всё из пульта, но запрос до сервера не дошёл. Ни одну правку сервер не отклонил, поэтому на ячейках нет отметок отказа: правки остались несохранёнными. Над таблицей одна плашка с причиной и повтором, на кнопке журнала одна запись.',
      en: "The user applied everything from the unsaved changes panel, but the request didn't reach the server. The server rejected none of the edits, so the cells have no refusal marks: the edits stay unsaved. Above the table there is one notice with the reason and a retry, and the error log button shows one entry.",
    },
    states: ['body.loadError', 'panel.toolbar'],
    enter: untilDone(requestFailed, reachRequestFailed),
  },
  {
    title: { ru: 'Одна запись в журнале', en: 'One entry in the log' },
    hint: {
      ru: 'Пользователь открыл журнал ошибок. В нём одна запись о применении целиком — с причиной и временем, а не запись на каждую ячейку.',
      en: 'The user opened the error log. It has one entry about the whole apply, with the reason and the time, not one entry per cell.',
    },
    states: ['overlay.failureLog'],
    enter: untilDone(
      () => logEntries().length === 1,
      root => {
        if (!requestFailed(root)) reachRequestFailed(root)
        else if (!log()) logButton(root)?.click()
      },
    ),
  },
  {
    title: { ru: 'Повтор сохранил', en: 'The retry saved' },
    hint: {
      ru: 'Сервер снова доступен, и пользователь нажал повтор на плашке. Те же правки ушли одним пакетом и сохранились: плашка показывает итог в тоне успеха, а запись ушла из журнала — счётчика на его кнопке больше нет.',
      en: 'The server is available again, and the user clicked retry on the notice. The same edits went out as one batch and were saved: the notice shows the result in the success tone, and the entry left the error log, so its button has no counter anymore.',
    },
    states: ['body.applySaved'],
    immediate: true,
    enter: untilDone(
      root =>
        savedNotice(root) && allSaved(root) && logCount(root) === 0 && !log(),
      root => {
        // Нажатие на плашку мимо открытого журнала закрывает его.
        if (log()) return pressEscape()
        if (savedNotice(root)) return
        if (!failedNotice(root)) return reachRequestFailed(root)
        applyServer.down = false
        noticeAction(root)?.click()
      },
    ),
  },
]

/** ADR 0227, S3: запрос «Применить» не прошёл — одна плашка и одна запись, повтор сохраняет. */
export const CellsEditingApplyFailed: StoryObj<StoryProps> = {
  name: 'Apply: request failed',
  parameters: { scenario: '0227/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title={{ ru: 'Запрос не прошёл', en: 'The request failed' }}
      steps={APPLY_FAILED}
      reset={() => {
        applyServer.down = false
      }}
      args={guideArgs(APPLY_ARGS, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const own = cellEditingLabels(labels)
    await step(APPLY_FAILED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(draftsKept(canvas)).toBe(true))
      expect(logCount(canvas)).toBe(0)
    })
    await step(APPLY_FAILED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(requestFailed(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(own.applyFailed(APPLY_DOWN))
      expect(noticeAction(canvas)!.textContent).toBe(labels.loadRetry)
      expect(
        canvas.querySelectorAll('[data-testid="table-notice"]'),
      ).toHaveLength(1)
      await settle()
    })
    await step(APPLY_FAILED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(logEntries()).toHaveLength(1))
      expect(logEntries()[0]!.textContent).toContain(APPLY_DOWN)
      await until(() => {
        const popup = log()
        expect(popup && getComputedStyle(popup).opacity).toBe('1')
      })
      await settle()
    })
    await step(APPLY_FAILED[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(savedNotice(canvas)).toBe(true))
      expect(noticeTitle(canvas)).toBe(own.applySaved(3))
      await until(() => expect(allSaved(canvas)).toBe(true))
      await until(() => expect(logCount(canvas)).toBe(0))
      await until(() => expect(log()).toBeNull())
      await noticeEntered(canvas)
    })
  },
}

// --- «Готово» и «Отмена» пальцем (ADR 0231, S10) --------------------------------------

const TOUCH_EDIT_ROW = 'item-id-1'

const touchEditButton = (root: ParentNode, action: 'done' | 'cancel') =>
  ageCellOf(root, TOUCH_EDIT_ROW)?.querySelector<HTMLElement>(
    `[data-edit-action="${action}"]`,
  ) ?? null

/** Открыть правку возраста пальцем: касание ячейки, затем её кнопки. */
const openTouchEdit = async (root: HTMLElement, signal: AbortSignal) => {
  await pollUntil(() => !!ageCellOf(root, TOUCH_EDIT_ROW), signal)
  if (inputOf(root, TOUCH_EDIT_ROW)) return
  touch.tapTarget(ageCellOf(root, TOUCH_EDIT_ROW))
  await pollUntil(() => !!editButtonOf(root, TOUCH_EDIT_ROW), signal)
  touch.tapButton(editButtonOf(root, TOUCH_EDIT_ROW))
  await pollUntil(() => !!touchEditButton(root, 'done'), signal)
}

let touchEditOriginal: string | undefined

/** Набрать значение и коснуться кнопки поля. */
const finishTouchEdit = async (
  root: HTMLElement,
  signal: AbortSignal,
  value: string,
  action: 'done' | 'cancel',
) => {
  typeInto(inputOf(root, TOUCH_EDIT_ROW)!, value)
  touch.tapButton(touchEditButton(root, action))
  await pollUntil(() => !inputOf(root, TOUCH_EDIT_ROW), signal)
}

const DONE_CANCEL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Правка пальцем', en: 'Editing with a finger' },
    hint: {
      ru: 'На сенсорном экране правку открывает кнопка ячейки.',
      en: 'On a touch screen, the cell button opens editing.',
    },
  },
  {
    title: { ru: 'Поле правки', en: 'The edit field' },
    hint: {
      ru: 'Пользователь открыл правку — рядом с полем кнопки сохранить и отменить.',
      en: 'The user opened editing; buttons to save and to cancel sit next to the field.',
    },
    states: ['body.editing'],
    enter: stepAction(async (root, { signal }) => openTouchEdit(root, signal)),
  },
  {
    title: { ru: 'Отмена', en: 'Cancel' },
    hint: {
      ru: 'Пользователь набрал число и отменил правку — в ячейке прежнее значение.',
      en: 'The user typed a number and cancelled; the cell keeps its old value.',
    },
    enter: stepAction(async (root, { signal }) =>
      finishTouchEdit(root, signal, '77', 'cancel'),
    ),
  },
  {
    title: { ru: 'Сохранение', en: 'Saving' },
    hint: {
      ru: 'Пользователь набрал число и сохранил — значение в ячейке.',
      en: 'The user typed a number and saved; the value is in the cell.',
    },
    enter: stepAction(async (root, { signal }) => {
      if (ageText(root, TOUCH_EDIT_ROW) !== '42') {
        await openTouchEdit(root, signal)
        await finishTouchEdit(root, signal, '42', 'done')
      }
    }),
  },
]

/** ADR 0231, S10: правка пальцем — «Готово» сохраняет, «Отмена» возвращает прежнее значение. */
export const CellEditingDoneCancel: StoryObj<StoryProps> = {
  name: 'Done and cancel by touch',
  globals: touch.PHONE,
  parameters: { scenario: '0231/S10', ...guideControls() },
  render: args => (
    <GuideStory
      title={{
        ru: 'Сохранить и отменить пальцем',
        en: 'Save and cancel by touch',
      }}
      steps={DONE_CANCEL}
      atomicSteps
      args={guideArgs(
        {
          enableCellEditing: true,
          columnCount: 6,
          dataCount: 40,
          containerWidth: 360,
          height: '420',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DONE_CANCEL[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(ageCellOf(canvas, TOUCH_EDIT_ROW)).not.toBeNull(),
      )
      touchEditOriginal = ageText(canvas, TOUCH_EDIT_ROW)
    })
    await step(DONE_CANCEL[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(touchEditButton(canvas, 'done')).not.toBeNull()
      await expect(touchEditButton(canvas, 'cancel')).not.toBeNull()
      await settle()
    })
    await step(DONE_CANCEL[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await expect(ageText(canvas, TOUCH_EDIT_ROW)).toBe(touchEditOriginal)
    })
    await step(DONE_CANCEL[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(ageText(canvas, TOUCH_EDIT_ROW)).toBe('42'))
      await settle()
    })
  },
}
