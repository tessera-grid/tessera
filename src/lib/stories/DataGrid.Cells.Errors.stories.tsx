import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { untilDone } from './__mocks__/cellGestures'
import { columns as mockColumns } from './__mocks__/columns'
import { getData } from './__mocks__/data'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/** Ошибка в ячейке (ADR 0150): точка у ячейки с ошибкой данных и отказ сохранения. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Errors',
} satisfies Meta<StoryProps>

export default meta

export const CellErrorsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Ошибки данных: больше 15 визитов — точка у ячейки Visits. С правкой ячеек точка встаёт на
  // кнопку правки.
  args: {
    enableCellErrors: true,
    columnCount: 6,
    dataCount: 10,
    containerHeight: '560',
    height: '460',
    maxHeight: '460',
  },
  parameters: showControls([
    'enableCellErrors',
    'enableCellEditing',
    'enableKeyboardNavigation',
  ]),
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

const DATA_COUNT = 10
/** Текст демо-ошибки: больше 15 визитов (DataGridStory). */
const DATA_ERROR = 'More than 15 visits'
/** Строка с ошибкой в данных историй. */
const ERROR_ROW = getData(DATA_COUNT).find(row => row.visits > 15)!.id as string
const FIXED_VISITS = '10'
const REFUSAL = 'The server refused the value'

const visitsCellOf = (root: ParentNode, row = ERROR_ROW) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="visits"]`,
  )
const inputOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLInputElement>('input') ?? null
/** Кнопка с точкой ошибки: кнопка правки или одиночная точка. */
const markOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLElement>(
    '.cell__button:has([data-failure-indicator]) button',
  ) ?? null
const descriptionOf = (button: HTMLElement | null) =>
  button
    ?.getAttribute('aria-describedby')
    ?.split(' ')
    .map(id => document.getElementById(id)?.textContent)
    .join(' ')
const visitsText = (root: ParentNode) => {
  const copy = visitsCellOf(root)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const editButtonOf = (root: ParentNode) =>
  visitsCellOf(root)?.querySelector<HTMLElement>('.cell__button button') ?? null

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

/** Открыть правку визитов, набрать значение и сохранить — по такту на действие. */
const saveVisits = (root: HTMLElement, value: string) => {
  const input = inputOf(root)
  if (!input) editButtonOf(root)?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

// --- ADR 0150 S1 ---------------------------------------------------------------------

const FIX_VALUES: readonly GuideStoryStep[] = [
  {
    title: 'Ошибки в данных',
    hint: 'Приложение проверило данные: больше 15 визитов — ошибка. Кнопка правки таких ячеек отмечена ошибкой и видна без наведения, её подсказка — текст ошибки.',
    states: ['body.error'],
  },
  {
    title: 'Значение исправлено',
    hint: 'Пользователь открыл правку числа визитов и сохранил 10. Ошибки больше нет — отметка с кнопки правки ушла.',
    enter: untilDone(
      root => !inputOf(root) && visitsText(root) === FIXED_VISITS,
      root => saveVisits(root, FIXED_VISITS),
    ),
  },
]

/** ADR 0150, S1: приложение отмечает ошибки данных, пользователь исправляет значение. */
export const CellErrorsFixValues: StoryObj<StoryProps> = {
  name: 'Fix invalid values',
  parameters: { scenario: '0150/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Исправление ошибки"
      steps={FIX_VALUES}
      args={guideArgs(
        {
          enableCellErrors: true,
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FIX_VALUES[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(markOf(canvas)).toBe(editButtonOf(canvas)))
      expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR)
      await settle()
    })
    await step(FIX_VALUES[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(visitsText(canvas)).toBe(FIXED_VISITS))
      await until(() => expect(markOf(canvas)).toBeNull())
      await settle()
    })
  },
}

// --- ADR 0150 S2 ---------------------------------------------------------------------

const READ_ONLY_COLUMNS = mockColumns.filter(column =>
  ['firstName', 'lastName', 'visits', 'total'].includes(column.id as string),
)

/** Указатель на элемент — один раз: повтор перезапускал бы задержку подсказки. */
const hovered = new WeakSet<Element>()
const hoverOnce = (element: HTMLElement | null) => {
  if (!element || hovered.has(element)) return
  hovered.add(element)
  element.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
  )
}

const READ_ONLY: readonly GuideStoryStep[] = [
  {
    title: 'Ошибки в таблице только для чтения',
    hint: 'Таблицу нельзя править, но приложение проверило данные: больше 15 визитов — ошибка. В таких ячейках справа стоит отметка ошибки.',
    states: ['body.cellError'],
  },
  {
    title: 'Текст ошибки',
    hint: 'Пользователь навёл указатель на отметку. Подсказка показывает текст ошибки.',
    states: ['overlay.tooltip'],
    enter: untilDone(
      root =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === DATA_ERROR,
        ),
      root => hoverOnce(markOf(root)),
    ),
  },
]

/** ADR 0150, S2: таблица только для чтения с ошибками данных. */
export const CellErrorsReadOnly: StoryObj<StoryProps> = {
  name: 'Read-only table',
  parameters: { scenario: '0150/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Ошибки без правки"
      steps={READ_ONLY}
      args={guideArgs(
        {
          enableCellErrors: true,
          // Колонка визитов — не у правого края: подсказка точки остаётся в окне.
          columnsOverride: READ_ONLY_COLUMNS,
          dataCount: DATA_COUNT,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(READ_ONLY[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(markOf(canvas)?.getAttribute('aria-label')).toBe(
          labels.cellError,
        ),
      )
      expect(markOf(canvas)!.querySelector('svg')).toBeNull()
      expect(visitsCellOf(canvas)).toHaveAttribute('aria-invalid', 'true')
      await settle()
    })
    await step(READ_ONLY[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          [...document.querySelectorAll('[data-side]')].some(
            el => el.textContent?.trim() === DATA_ERROR,
          ),
        ).toBe(true),
      )
      await settle()
    })
  },
}

// --- ADR 0150 S3 ---------------------------------------------------------------------

/** «Сервер» гайда: отказывает каждому сохранению. */
const refuse = () => Promise.reject(new Error(REFUSAL))

const REFUSAL_STEPS: readonly GuideStoryStep[] = [
  {
    title: 'Ошибка в данных',
    hint: 'Приложение отметило ошибку: больше 15 визитов. Кнопка правки ячейки отмечена ошибкой, её подсказка — текст ошибки.',
    states: ['body.error'],
  },
  {
    title: 'Сервер отказал',
    hint: 'Пользователь сохранил новое число визитов, но сервер его отклонил. В ячейке снова значение из данных, подсказка кнопки правки — причина отказа: она важнее ошибки в данных, пока отказ не снят.',
    states: ['body.error'],
    enter: untilDone(
      root => descriptionOf(markOf(root))?.includes(REFUSAL) ?? false,
      root => saveVisits(root, '12'),
    ),
  },
  {
    title: 'Правка отменена',
    hint: 'Пользователь снова открыл правку и отменил её. Отказ снят — подсказка кнопки правки снова показывает ошибку в данных.',
    states: ['body.error'],
    enter: untilDone(
      root => !inputOf(root) && descriptionOf(markOf(root)) === DATA_ERROR,
      root => {
        const input = inputOf(root)
        if (input) press(input, 'Escape')
        else editButtonOf(root)?.click()
      },
    ),
  },
]

/** ADR 0150, S3: сервер отказал в сохранении ячейки с ошибкой данных. */
export const CellErrorsRefusal: StoryObj<StoryProps> = {
  name: 'Refusal and data error',
  parameters: { scenario: '0150/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Отказ и ошибка данных"
      steps={REFUSAL_STEPS}
      args={guideArgs(
        {
          enableCellErrors: true,
          enableCellEditing: true,
          enableKeyboardNavigation: true,
          columnCount: 6,
          dataCount: DATA_COUNT,
          onCellEdit: refuse,
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    await step(REFUSAL_STEPS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR))
      await settle()
    })
    await step(REFUSAL_STEPS[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(descriptionOf(markOf(canvas))).toBe(
          labels.actionFailedRetry(REFUSAL),
        ),
      )
      expect(Number(visitsText(canvas))).toBeGreaterThan(15)
      await settle()
    })
    await step(REFUSAL_STEPS[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(descriptionOf(markOf(canvas))).toBe(DATA_ERROR))
      expect(inputOf(canvas)).toBeNull()
      await settle()
    })
  },
}
