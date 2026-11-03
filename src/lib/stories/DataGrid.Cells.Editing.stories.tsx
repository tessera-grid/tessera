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
    title: 'Сохранение по кнопке',
    hint: 'Приложение сохраняет правки не сразу, а пакетом — по кнопке пульта в тулбаре.',
    enter: () => batchServer.reset(),
  },
  {
    title: 'Три правки',
    hint: 'Пользователь поправил возраст в трёх строках. Новые значения видны в ячейках, но ещё не сохранены: в углу каждой ячейки отметка несохранённого изменения, на кнопке пульта — число несохранённых изменений.',
    states: ['body.cellDraft'],
    enter: untilDone(
      root => editsDrafted(root, MANUAL_EDITS) && !inputOf(root, 'item-id-3'),
      root => editsDrafted(root, MANUAL_EDITS),
    ),
  },
  {
    title: 'Пакет отправлен',
    hint: 'Пользователь открыл пульт и нажал «Применить всё». Все три правки ушли на сервер одним запросом; пока сервер не ответил, ячейки пакета ждут.',
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
    title: 'Сервер сохранил',
    hint: 'Сервер принял пакет. Ожидание снято, уголки исчезли, ячейки коротко вспыхивают тоном успеха; несохранённых изменений не осталось.',
    enter: untilDone(
      root =>
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
      title="Сохранение по кнопке"
      steps={MANUAL_SAVE}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(MANUAL_SAVE[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(MANUAL_SAVE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(MANUAL_EDITS.every(([row]) => draftMarked(canvas, row))).toBe(
          true,
        ),
      )
      expect(panelCount(canvas)).toBe(3)
      expect(consoleText()).not.toContain('onCommitEdits')
    })
    await step(MANUAL_SAVE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(MANUAL_EDITS.every(([row]) => pending(canvas, row))).toBe(true),
      )
      await until(() => expect(panelOpen()).toBe(false))
      expect(consoleText()).toContain('onCommitEdits')
    })
    await step(MANUAL_SAVE[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(panelCount(canvas)).toBe(0))
      for (const [row, value] of MANUAL_EDITS) {
        expect(draftMarked(canvas, row)).toBe(false)
        expect(ageText(canvas, row)).toBe(value)
      }
      await settle()
    })
  },
}

const PARTIAL_EDITS = MANUAL_EDITS.slice(0, 2)
const REFUSED_ROW = 'item-id-2'

const PARTIAL: readonly GuideStoryStep[] = [
  {
    title: 'Сохранение по кнопке',
    hint: 'Приложение сохраняет правки пакетом по кнопке пульта. Сервер принимает пакет, но одну из строк сейчас отклоняет.',
    enter: () => {
      batchServer.reset()
      batchServer.refuseRow = REFUSED_ROW
    },
  },
  {
    title: 'Две правки',
    hint: 'Пользователь поправил возраст в двух строках. В углу обеих ячеек отметка несохранённого изменения: значения ещё не сохранены.',
    states: ['body.cellDraft'],
    enter: untilDone(
      root =>
        editsDrafted(root, PARTIAL_EDITS) &&
        !inputOf(root, PARTIAL_EDITS[1]![0]),
      root => editsDrafted(root, PARTIAL_EDITS),
    ),
  },
  {
    title: 'Сервер отказал одной ячейке',
    hint: 'Пользователь применил всё из пульта. Сервер сохранил одну правку и отклонил другую. Сохранённая ячейка вспыхнула тоном успеха; у отклонённой в углу отметка отказа с причиной, а несохранённое значение осталось в ячейке.',
    states: ['body.error'],
    enter: untilDone(
      root => failed(root, REFUSED_ROW) && !draftMarked(root, 'item-id-1'),
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
      title="Отказ части пакета"
      steps={PARTIAL}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(PARTIAL[0]!.title, async () => {
      await waitForRows(canvas)
    })
    await step(PARTIAL[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(panelCount(canvas)).toBe(2))
    })
    await step(PARTIAL[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(failed(canvas, REFUSED_ROW)).toBe(true))
      expect(ageText(canvas, REFUSED_ROW)).toBe(PARTIAL_EDITS[1]![1])
      expect(draftMarked(canvas, 'item-id-1')).toBe(false)
      expect(ageText(canvas, 'item-id-1')).toBe(PARTIAL_EDITS[0]![1])
      expect(panelCount(canvas)).toBe(1)
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
    title: 'Несохранённое значение',
    hint: 'Приложение сохраняет правки по кнопке пульта. Пользователь поправил возраст: новое значение в ячейке, в её углу отметка несохранённого изменения.',
    states: ['body.cellDraft'],
    enter: untilDone(
      root => draftMarked(root, ROLLBACK_ROW) && !inputOf(root, ROLLBACK_ROW),
      root => save(root, ROLLBACK_ROW, ROLLBACK_AGE),
    ),
  },
  {
    title: 'Было и стало',
    hint: 'Пользователь нажал на уголок. В поповере — прежнее значение, новое и кнопка отката.',
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
    title: 'Значение откачено',
    hint: 'Пользователь откатил правку. В ячейке снова значение из данных, уголка нет, несохранённых изменений не осталось.',
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
      title="Откат правки"
      steps={ROLLBACK}
      args={guideArgs(MANUAL_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let before = ''
    await step(ROLLBACK[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(draftMarked(canvas, ROLLBACK_ROW)).toBe(true))
      expect(ageText(canvas, ROLLBACK_ROW)).toBe(ROLLBACK_AGE)
      before = String(getData(10).find(row => row.id === ROLLBACK_ROW)!.age)
    })
    await step(ROLLBACK[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(rollbackPopover()).not.toBeNull())
      expect(rollbackPopover()!.textContent).toContain(before)
      expect(rollbackPopover()!.textContent).toContain(ROLLBACK_AGE)
    })
    await step(ROLLBACK[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(draftMarked(canvas, ROLLBACK_ROW)).toBe(false))
      expect(ageText(canvas, ROLLBACK_ROW)).toBe(before)
      expect(panelCount(canvas)).toBe(0)
      await settle()
    })
  },
}
