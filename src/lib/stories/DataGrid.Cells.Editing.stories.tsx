import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { type StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { createHeldServer, REFUSAL } from './__mocks__/heldServer'
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
import { typeInto, press } from './__mocks__/typeGuides'

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
    ?.querySelectorAll('.cell__button, [data-cell-issue]')
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
    title: 'Значение отправлено на сервер',
    hint: 'Пользователь сохранил новое значение, и приложение отправило его на сервер. Пока сервер не ответил, ячейка чуть темнеет и по ней проходит светлый блик, а соседние ячейки можно править.',
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
    hint: 'Пользователь сохранил ещё одно значение, но сервер его отклонил. В ячейке снова значение из данных, ячейка коротко вспыхивает тоном ошибки, в её правом верхнем углу появилась отметка отказа.',
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
      await until(() =>
        expect(
          ageCellOf(canvas, SERVER_ROW)!.querySelector('[data-cell-issue]'),
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
    title: 'Значение отправлено на сервер',
    hint: 'Пользователь сохранил новый возраст, и приложение отправило его на сервер. Пока сервер не ответил, ячейка чуть темнеет и по ней проходит светлый блик.',
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
    hint: 'Сервер отклонил первое значение. Его ячейка вернулась к значению из данных и коротко вспыхнула тоном ошибки, в её правом верхнем углу появилась отметка отказа, а правка в другой строке продолжается.',
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
