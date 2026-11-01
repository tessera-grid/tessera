import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { untilDone } from './__mocks__/cellGestures'
import { getData } from './__mocks__/data'
import {
  consoleText,
  guideNext,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  type GuideApp,
  GuideStory,
  type GuideStoryStep,
  guideArgs,
} from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'
import {
  EDIT_COLUMNS,
  EDIT_ROWS,
  EDIT_TYPES,
  PRIORITY_COLUMNS,
  PRIORITY_ROWS,
  PRIORITY_TYPES,
  priorityLabel,
} from './__mocks__/editingData'
import { storyLabels } from './__mocks__/storyLabels'

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
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const editButtonOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLElement>('.cell__button button') ??
  null
const pending = (root: ParentNode, row: string) =>
  editButtonOf(root, row)?.getAttribute('aria-busy') === 'true'
const failed = (root: ParentNode, row: string) =>
  !!ageCellOf(root, row)?.querySelector('[data-failure-indicator]')
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

/** Набрать значение в поле — как ввод с клавиатуры. */
const typeInto = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const press = (input: HTMLInputElement, key: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

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
    title: 'Ячейки, которые можно править',
    hint: 'Приложение разрешило править возраст, число визитов и пол. У таких ячеек при наведении появляется кнопка правки.',
  },
  {
    title: 'Поле правки открыто',
    hint: 'Пользователь нажал кнопку правки в ячейке возраста и набрал новое число. Пока правка не сохранена, в ячейке поле с черновиком.',
    states: ['body.editing'],
    enter: untilDone(
      root => hasDraft(root, VALUE_ROW, NEW_AGE),
      root => draft(root, VALUE_ROW, NEW_AGE),
    ),
  },
  {
    title: 'Значение сохранено',
    hint: 'Пользователь нажал Enter. Поле закрылось, в ячейке новое значение.',
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
      title="Правка значения"
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
    await step(EDIT_VALUE[0]!.title, async () => {
      await waitForRows(canvas)
      expect(editButtonOf(canvas, VALUE_ROW)).not.toBeNull()
      expect(
        canvas.querySelector(
          `.data-grid__body-row[data-row-id="${VALUE_ROW}"] .data-grid__body-cell[data-column-id="firstName"] .cell__button`,
        ),
      ).toBeNull()
    })
    await step(EDIT_VALUE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, VALUE_ROW)?.value).toBe(NEW_AGE))
    })
    await step(EDIT_VALUE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, VALUE_ROW)).toBeNull())
      expect(ageText(canvas, VALUE_ROW)).toBe(NEW_AGE)
      await settle()
    })
  },
}

// --- ADR 0041 S1 ---------------------------------------------------------------------

const REFUSAL = 'The server refused the value'

/** «Сервер» гайда: придерживает ответ, пока шаг ожидания на виду. */
const createEditServer = () => {
  let held = true
  let refuse = false
  const waiting = new Set<{
    resolve: () => void
    reject: (reason: Error) => void
  }>()
  const answer = (entry: {
    resolve: () => void
    reject: (reason: Error) => void
  }) => (refuse ? entry.reject(new Error(REFUSAL)) : entry.resolve())
  return {
    hold: () => {
      held = true
    },
    answer: (ok: boolean) => {
      held = false
      refuse = !ok
      waiting.forEach(answer)
      waiting.clear()
    },
    save: () =>
      new Promise<void>((resolve, reject) => {
        const entry = { resolve, reject }
        if (held) waiting.add(entry)
        else answer(entry)
      }),
  }
}

const EDIT_SERVER = createEditServer()
const SERVER_ROW = 'item-id-1'
const SAVED_AGE = '77'
const REFUSED_AGE = '13'

const reachRefusal = (root: HTMLElement) => {
  EDIT_SERVER.answer(false)
  if (!pending(root, SERVER_ROW)) save(root, SERVER_ROW, REFUSED_AGE)
}

const EDIT_SERVER_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Значение отправлено на сервер',
    hint: 'Пользователь сохранил новое значение, и приложение отправило его на сервер. Пока сервер не ответил, кнопка правки показывает ожидание, а соседние ячейки можно править.',
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
    title: 'Сервер сохранил',
    hint: 'Сервер принял значение. Ожидание снято, ячейка коротко вспыхивает тоном успеха.',
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
    title: 'Сервер отказал',
    hint: 'Пользователь сохранил ещё одно значение, но сервер его отклонил. В ячейке снова значение из данных, ячейка коротко вспыхивает тоном ошибки, кнопка правки отмечена отказом.',
    states: ['body.error'],
    enter: untilDone(root => failed(root, SERVER_ROW), reachRefusal),
  },
  {
    title: 'Повторная правка',
    hint: 'Пользователь снова открыл правку. В поле отклонённое значение, а рядом причина отказа от сервера.',
    states: ['body.editing'],
    enter: untilDone(
      root => !!ageCellOf(root, SERVER_ROW)?.querySelector('[role="alert"]'),
      root =>
        failed(root, SERVER_ROW)
          ? editButtonOf(root, SERVER_ROW)?.click()
          : reachRefusal(root),
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
      title="Сохранение на сервере"
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
    await step(EDIT_SERVER_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(pending(canvas, SERVER_ROW)).toBe(true))
      // Ожидание и значение — разные срезы: React 18 коммитит их по одному.
      await until(() => expect(ageText(canvas, SERVER_ROW)).toBe(SAVED_AGE))
    })
    await step(EDIT_SERVER_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(pending(canvas, SERVER_ROW)).toBe(false))
      await until(() => expect(ageText(canvas, SERVER_ROW)).toBe(SAVED_AGE))
      expect(consoleText()).toContain('onCellEdit')
      await until(() =>
        expect(ageCellOf(canvas, SERVER_ROW)).toHaveAttribute(
          'data-flash',
          'accepted',
        ),
      )
      // Значок кнопки возвращается из приглушённого цвета ожидания переходом.
      await settle()
    })
    await step(EDIT_SERVER_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(ageCellOf(canvas, SERVER_ROW)).toHaveAttribute(
          'data-flash',
          'reverted',
        ),
      )
      // Отметка отказа проявляется после вспышки.
      await until(() =>
        expect(
          ageCellOf(canvas, SERVER_ROW)!.querySelector(
            '[data-failure-indicator][data-shown="true"]',
          ),
        ).not.toBeNull(),
      )
      expect(ageText(canvas, SERVER_ROW)).toBe(SAVED_AGE)
    })
    await step(EDIT_SERVER_STEPS[3]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, SERVER_ROW)?.value).toBe(REFUSED_AGE),
      )
      expect(
        ageCellOf(canvas, SERVER_ROW)!.querySelector('[role="alert"]'),
      ).toHaveTextContent(REFUSAL)
      await settle()
    })
  },
}

// --- ADR 0134 S1 ---------------------------------------------------------------------

const AWAY_SERVER = createEditServer()
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
    title: 'Значение отправлено на сервер',
    hint: 'Пользователь сохранил новый возраст, и приложение отправило его на сервер. Пока сервер не ответил, кнопка правки показывает ожидание.',
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
    title: 'Правка другой ячейки',
    hint: 'Не дожидаясь ответа, пользователь открыл правку возраста в другой строке и набрал число.',
    states: ['body.editing'],
    enter: untilDone(
      root => pending(root, AWAY_ROW) && hasDraft(root, OTHER_ROW, OTHER_AGE),
      reachAway,
    ),
  },
  {
    title: 'Сервер отказал',
    hint: 'Сервер отклонил первое значение. Его ячейка вернулась к значению из данных и коротко вспыхнула тоном ошибки, кнопка правки отмечена отказом, а правка в другой строке продолжается.',
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
      title="Отказ, пока идёт другая правка"
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
    await step(AWAY[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(pending(canvas, AWAY_ROW)).toBe(true))
      expect(ageText(canvas, AWAY_ROW)).toBe(AWAY_AGE)
      original = String(getData(10).find(row => row.id === AWAY_ROW)?.age ?? '')
    })
    await step(AWAY[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, OTHER_ROW)?.value).toBe(OTHER_AGE),
      )
      expect(pending(canvas, AWAY_ROW)).toBe(true)
    })
    await step(AWAY[2]!.title, async () => {
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
    title: 'Правка открыта',
    hint: 'Пользователь открыл правку возраста в первой строке и набрал число, но ещё не сохранил.',
    states: ['body.editing'],
    enter: untilDone(
      root => hasDraft(root, SESSION_ROW, DRAFT_AGE),
      root => draft(root, SESSION_ROW, DRAFT_AGE),
    ),
  },
  {
    title: 'Таблица прокручена',
    hint: 'Пользователь прокрутил таблицу вниз, и строка с правкой ушла из вида.',
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
    title: 'Данные изменились извне',
    hint: 'Пользователь вернулся к строке, а приложение тем временем изменило её возраст. Поле осталось открытым, черновик в нём не тронут.',
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
    title: 'Черновик сохранён',
    hint: 'Пользователь нажал Enter. В ячейке его значение, а в консоли видны и исходное, и изменённое извне.',
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
      title="Черновик правки"
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
    await step(EDIT_SESSION[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
    })
    await step(EDIT_SESSION[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(outOfView(canvas, SESSION_ROW)).toBe(true))
    })
    await step(EDIT_SESSION[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE),
      )
      await until(() => expect(consoleText()).toContain('dataOverride'))
      expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE)
    })
    await step(EDIT_SESSION[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, SESSION_ROW)).toBeNull())
      expect(ageText(canvas, SESSION_ROW)).toBe(DRAFT_AGE)
      expect(consoleText()).toMatch(
        new RegExp(
          `value:${DRAFT_AGE},text:"${DRAFT_AGE}",original:\\d+,current:${externalAge()}`,
        ),
      )
      await settle()
    })
  },
}

const EDIT_CONFLICT: readonly GuideStoryStep[] = [
  {
    title: 'Данные изменились во время правки',
    hint: 'Пользователь правит возраст, а приложение в это время изменило ту же ячейку.',
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
    title: 'Сохранение отклонено',
    hint: 'Пользователь нажал Enter. Правка закрылась без сохранения, в ячейке значение, пришедшее извне. Причина отмены видна в консоли.',
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
      title="Конфликт правки"
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
    await step(EDIT_CONFLICT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(consoleText()).toContain('dataOverride'))
      expect(inputOf(canvas, SESSION_ROW)?.value).toBe(DRAFT_AGE)
    })
    await step(EDIT_CONFLICT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, SESSION_ROW)).toBeNull())
      expect(ageText(canvas, SESSION_ROW)).toBe(externalAge())
      await until(() => expect(consoleText()).toContain('onEditCancel'))
      expect(consoleText()).toContain('conflict')
      await settle()
    })
  },
}

// --- ADR 0175: редакторы по типу -----------------------------------------------------

const PRODUCT_ROW = 'product-1'

const productCellOf = (root: ParentNode, column: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )
const productInput = (root: ParentNode, column: string) =>
  productCellOf(root, column)?.querySelector<HTMLInputElement>('input') ?? null
const productEditButton = (root: ParentNode, column: string) =>
  productCellOf(root, column)?.querySelector<HTMLElement>(
    '.cell__button button',
  ) ?? null
/** Значение ячейки без кнопки правки. */
const productText = (root: ParentNode, column: string) => {
  const copy = productCellOf(root, column)?.cloneNode(true) as
    HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const fieldError = (root: ParentNode, column: string) =>
  productCellOf(root, column)?.querySelector('[role="alert"]')?.textContent ??
  ''

/** Открыть правку ячейки, набрать текст и сохранить его Enter — по шагу за раз. */
const typeAndSave = (root: HTMLElement, column: string, value: string) => {
  const input = productInput(root, column)
  if (!input) productEditButton(root, column)?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

const localeOf = (args: { locale?: string }) =>
  args.locale === 'ru' ? 'ru-RU' : 'en-US'
const dollars = (locale: string, value: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    value,
  )

const NOT_A_NUMBER = 'abc'
const NEW_PRICE = '1250'

const EDIT_NUMBER: readonly GuideStoryStep[] = [
  {
    title: 'Цены на языке таблицы',
    hint: 'Цена — число в формате денег на языке таблицы. Её можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Поле правки числа',
    hint: 'Пользователь нажал кнопку правки цены. В поле то же число с десятичным знаком языка таблицы, без знака валюты и разрядов.',
    states: ['body.editing'],
    enter: untilDone(
      root => !!productInput(root, 'price'),
      root => productEditButton(root, 'price')?.click(),
    ),
  },
  {
    title: 'Не число',
    hint: 'Пользователь набрал буквы и нажал Enter. Значение не сохранено: поле осталось открытым, под ним текст ошибки.',
    states: ['body.editing'],
    enter: untilDone(
      root => fieldError(root, 'price') !== '',
      root => typeAndSave(root, 'price', NOT_A_NUMBER),
    ),
  },
  {
    title: 'Число сохранено',
    hint: 'Пользователь набрал число и нажал Enter. Поле закрылось, в ячейке новая цена в формате денег.',
    enter: untilDone(
      root =>
        !productInput(root, 'price') &&
        productText(root, 'price')?.replace(/\D/g, '').startsWith(NEW_PRICE) ===
          true,
      root => typeAndSave(root, 'price', NEW_PRICE),
    ),
  },
]

const productArgs = {
  enableCellEditing: true,
  enableKeyboardNavigation: true,
  columnsOverride: EDIT_COLUMNS,
  dataOverride: EDIT_ROWS,
  dataTypes: EDIT_TYPES,
  editableColumns: ['price', 'inStock'],
  height: '360',
} satisfies Partial<StoryProps>

/** ADR 0175, S1: пользователь правит число на языке таблицы и видит ошибку при вводе не числа. */
export const EditingNumber: StoryObj<StoryProps> = {
  name: 'Edit a number',
  parameters: {
    scenario: '0175/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Правка числа"
      steps={EDIT_NUMBER}
      args={guideArgs(productArgs, args)}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const locale = localeOf(args)
    const labels = storyLabels(args.locale)
    const original = EDIT_ROWS[0]!.price
    await step(EDIT_NUMBER[0]!.title, async () => {
      await waitForRows(canvas)
      expect(productText(canvas, 'price')).toBe(dollars(locale, original))
      expect(productEditButton(canvas, 'price')).not.toBeNull()
    })
    await step(EDIT_NUMBER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).not.toBeNull())
      expect(productInput(canvas, 'price')!.value).toBe(
        new Intl.NumberFormat(locale, { useGrouping: false }).format(original),
      )
    })
    await step(EDIT_NUMBER[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(fieldError(canvas, 'price')).toBe(labels.editInvalidNumber),
      )
      expect(productInput(canvas, 'price')!.value).toBe(NOT_A_NUMBER)
      expect(productInput(canvas, 'price')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(consoleText()).not.toContain('onCellEdit')
    })
    await step(EDIT_NUMBER[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(productInput(canvas, 'price')).toBeNull())
      expect(productText(canvas, 'price')).toBe(
        dollars(locale, Number(NEW_PRICE)),
      )
      expect(consoleText()).toMatch(
        new RegExp(`value:${NEW_PRICE},text:"${NEW_PRICE}"`),
      )
      await settle()
    })
  },
}

const checkedIn = (root: ParentNode) =>
  !!productCellOf(root, 'inStock')?.querySelector('.check-mark[data-checked]')

/** Активная ячейка наличия — пробел с клавиатуры. */
const pressSpaceOnStock = (root: HTMLElement) => {
  const cell = productCellOf(root, 'inStock')
  cell?.focus({ preventScroll: true })
  cell?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
}

const EDIT_BOOLEAN: readonly GuideStoryStep[] = [
  {
    title: 'Флажки наличия',
    hint: 'Наличие на складе — флажок. Его можно править: при наведении на ячейку появляется кнопка правки.',
  },
  {
    title: 'Флажок переключён',
    hint: 'Пользователь нажал кнопку правки. Значение сразу переключилось и сохранилось — без поля правки.',
    enter: untilDone(
      root => checkedIn(root),
      root => productEditButton(root, 'inStock')?.click(),
    ),
  },
  {
    title: 'Пробел с клавиатуры',
    hint: 'Пользователь перешёл на ячейку клавиатурой и нажал пробел. Значение переключилось обратно и тоже сохранилось.',
    enter: untilDone(
      root => !checkedIn(root),
      root =>
        checkedIn(root)
          ? pressSpaceOnStock(root)
          : productEditButton(root, 'inStock')?.click(),
    ),
  },
]

/** ADR 0175, S2: пользователь переключает булево одним нажатием. */
export const EditingBoolean: StoryObj<StoryProps> = {
  name: 'Toggle a boolean',
  parameters: {
    scenario: '0175/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Правка флажка"
      steps={EDIT_BOOLEAN}
      args={guideArgs(productArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_BOOLEAN[0]!.title, async () => {
      await waitForRows(canvas)
      expect(checkedIn(canvas)).toBe(false)
    })
    await step(EDIT_BOOLEAN[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(checkedIn(canvas)).toBe(true))
      expect(productInput(canvas, 'inStock')).toBeNull()
      expect(consoleText()).toMatch(/value:true/)
    })
    await step(EDIT_BOOLEAN[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(checkedIn(canvas)).toBe(false))
      expect(consoleText()).toMatch(/value:false/)
      await settle()
    })
  },
}

const priorityCell = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${PRODUCT_ROW}"] .data-grid__body-cell[data-column-id="priority"]`,
  )
const priorityEditor = (root: ParentNode) =>
  priorityCell(root)?.querySelector<HTMLElement>('[data-priority-editor]') ??
  null
const priorityText = (root: ParentNode) => {
  const copy = priorityCell(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}

const HIGH = 3

const EDIT_TYPE_EDITOR: readonly GuideStoryStep[] = [
  {
    title: 'Приоритет — свой тип',
    hint: 'Приоритет — тип из реестра типов таблицы: в данных число, в ячейке — слово. Тип задаёт и свой редактор.',
  },
  {
    title: 'Редактор типа',
    hint: 'Пользователь нажал кнопку правки приоритета. Вместо поля ввода — переключатель из трёх вариантов: его задал тип колонки.',
    states: ['body.editing'],
    enter: untilDone(
      root => !!priorityEditor(root),
      root =>
        priorityCell(root)
          ?.querySelector<HTMLElement>('.cell__button button')
          ?.click(),
    ),
  },
  {
    title: 'Вариант сохранён',
    hint: 'Пользователь выбрал высокий приоритет. Правка закрылась, в ячейке новая подпись, в данных — число.',
    enter: untilDone(
      root =>
        !priorityEditor(root) && priorityText(root) === priorityLabel(HIGH),
      root => {
        const editor = priorityEditor(root)
        if (!editor)
          priorityCell(root)
            ?.querySelector<HTMLElement>('.cell__button button')
            ?.click()
        else
          editor.querySelector<HTMLElement>(`[data-value="${HIGH}"]`)?.click()
      },
    ),
  },
]

/** ADR 0175, S7: разработчик задаёт свой редактор типа в реестре `dataTypes`. */
export const EditingTypeEditor: StoryObj<StoryProps> = {
  name: 'Editor of a data type',
  parameters: {
    scenario: '0175/S7',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Свой редактор типа"
      steps={EDIT_TYPE_EDITOR}
      args={guideArgs(
        {
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnsOverride: PRIORITY_COLUMNS,
          dataOverride: PRIORITY_ROWS,
          dataTypes: PRIORITY_TYPES,
          editableColumns: ['priority'],
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(EDIT_TYPE_EDITOR[0]!.title, async () => {
      await waitForRows(canvas)
      expect(priorityText(canvas)).toBe(
        priorityLabel(PRIORITY_ROWS[0]!.priority),
      )
    })
    await step(EDIT_TYPE_EDITOR[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priorityEditor(canvas)).not.toBeNull())
      expect(
        priorityCell(canvas)!.querySelector('input:not([type="radio"])'),
      ).toBeNull()
      expect(
        priorityEditor(canvas)!.querySelector('[role="radiogroup"]'),
      ).not.toBeNull()
    })
    await step(EDIT_TYPE_EDITOR[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(priorityEditor(canvas)).toBeNull())
      expect(priorityText(canvas)).toBe(priorityLabel(HIGH))
      expect(consoleText()).toMatch(new RegExp(`value:${HIGH}`))
      await settle()
    })
  },
}
