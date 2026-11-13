import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { clientTxSeed, transact } from './__mocks__/clientTransactionsGuide'
import { press, typeInto } from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  arrowOf,
  cellOf,
  dataRowId,
  dataValue,
  flashOf,
  HIGHLIGHTED_ROW,
  highlightSeed,
  push,
  rowData,
  valueStream,
} from './__mocks__/valueChangeFlashGuide'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Вспышка при смене значения извне (ADR 0221): ячейка мигает, когда её значение пришло новыми
 * данными приложения, а не записью человека. `Playground` — поток обновлений контролом.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Cells/Value change flash',
} satisfies Meta<StoryProps>

export default meta

/** Приложение принимает следующий `data`: обвязка истории кладёт его в свои данные. */
const keepData = () => {}

/** Высота — в окне снимка матрицы контраста (900×720, ADR 0089). */
const layout: Partial<StoryProps> = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
  columnCount: 6,
  dataCount: 20,
}

interface FlashPlaygroundArgs extends StoryProps {
  liveUpdates: boolean
  liveIntervalMs: number
}

export const ValueChangeFlashPlayground: StoryObj<FlashPlaygroundArgs> = {
  name: 'Playground',
  // Поток обновлений приложения: у трёх строк меняется число визитов. Вид колонок без своего
  // поля — контролом; с направлением рост и падение видны тоном и стрелкой.
  parameters: showControls([
    'enableValueChangeFlash',
    'valueChangeFlashColumnDefault',
    'liveUpdates',
    'liveIntervalMs',
  ]),
  args: {
    ...layout,
    enableValueChangeFlash: true,
    valueChangeFlashColumnDefault: 'direction',
    liveUpdates: false,
    liveIntervalMs: 1000,
  },
  argTypes: {
    liveUpdates: {
      description:
        'Приложение шлёт поток обновлений: у трёх строк меняется число визитов',
      control: 'boolean',
    },
    liveIntervalMs: {
      description: 'Период обновлений приложения, мс',
      control: { type: 'range', min: 100, max: 3000, step: 100 },
      if: { arg: 'liveUpdates' },
    },
  },
  render: ({ liveUpdates, liveIntervalMs, ...args }) => (
    <StoryComponent
      {...normalizeArgs(args)}
      onDataChange={keepData}
      extraPlugins={[
        clientTxSeed,
        ...(liveUpdates ? [valueStream(liveIntervalMs)] : []),
      ]}
    />
  ),
  // Снимок — в покое: поток выключен.
  play: async ({ canvasElement: canvas, globals }) => {
    if (globals.catalog !== true) return
    await waitForRows(canvas)
    await settle()
  },
}

/** Шаг ждёт строки данных приложения. */
const rowsReady = (root: HTMLElement, signal: AbortSignal) =>
  pollUntil(
    () => dataRowId(4) !== undefined && !!cellOf(root, dataRowId(4)!, 'visits'),
    signal,
  )

const seedProps = () => ({
  extraPlugins: [clientTxSeed],
  onDataChange: keepData,
})

// --- S1: обновление с сервера ----------------------------------------------------------

const PUSHED_VISITS = 999

const UPDATE: readonly GuideStoryStep[] = [
  {
    title: 'Данные приложения',
    hint: 'Приложение держит данные у себя и получает обновления с сервера: новые значения отдельных строк.',
    props: seedProps,
    enter: stepAction(async (root, { signal }) => rowsReady(root, signal)),
  },
  {
    title: 'Пришло обновление',
    hint: 'Сервер прислал новое число визитов у двух строк, приложение положило его в таблицу. Ячейки с новым значением коротко вспыхнули, остальные ячейки этих строк — нет: их значения прежние.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({
        [dataRowId(1)!]: { visits: PUSHED_VISITS },
        [dataRowId(3)!]: { visits: PUSHED_VISITS },
      })
      await pollUntil(
        () =>
          cellOf(root, dataRowId(3)!, 'visits')?.textContent?.includes(
            `${PUSHED_VISITS}`,
          ) === true,
        signal,
      )
    }),
  },
]

/** ADR 0221, S1: сокет обновил значения — изменённые ячейки вспыхнули, остальные нет. */
export const ValueChangeFlashUpdate: StoryObj<StoryProps> = {
  name: 'Update from the server',
  parameters: { scenario: '0221/S1', ...guideControls() },
  render: args => (
    <GuideStory
      title="Обновление с сервера"
      steps={UPDATE}
      args={guideArgs({ ...layout, enableValueChangeFlash: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UPDATE[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(3)).toBeDefined())
    })
    await step(UPDATE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(flashOf(canvas, dataRowId(1)!, 'visits')).toBe('changed'),
      )
      expect(flashOf(canvas, dataRowId(1)!, 'firstName')).toBeNull()
      expect(flashOf(canvas, dataRowId(2)!, 'visits')).toBeNull()
      await settle()
    })
  },
}

// --- S2: рост и падение ----------------------------------------------------------------

const DIRECTION: readonly GuideStoryStep[] = [
  {
    title: 'Котировки',
    hint: 'Таблица показывает числа, которые часто меняются. У числовых колонок вспышка показывает и направление смены.',
    props: seedProps,
    enter: stepAction(async (root, { signal }) => rowsReady(root, signal)),
  },
  {
    title: 'Одно выросло, другое упало',
    hint: 'Пришло обновление: у одной строки визитов стало больше, у другой — меньше. Ячейки вспыхнули тоном роста и падения, у начала ячейки — стрелка вверх или вниз: направление видно и без цвета.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      const up = dataRowId(1)!
      const down = dataRowId(2)!
      push({
        [up]: { visits: 5000 },
        [down]: { visits: 0 },
      })
      await pollUntil(() => dataValue(down, 'visits') === 0, signal)
    }),
  },
]

/** ADR 0221, S2: котировки выросли и упали — тон и стрелка направления. */
export const ValueChangeFlashDirection: StoryObj<StoryProps> = {
  name: 'Rise and fall',
  parameters: { scenario: '0221/S2', ...guideControls() },
  render: args => (
    <GuideStory
      title="Рост и падение"
      steps={DIRECTION}
      args={guideArgs(
        {
          ...layout,
          enableValueChangeFlash: true,
          valueChangeFlashColumnDefault: 'direction',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(DIRECTION[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(2)).toBeDefined())
    })
    await step(DIRECTION[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(arrowOf(canvas, dataRowId(1)!, 'visits')).toBe('up'),
      )
      expect(flashOf(canvas, dataRowId(1)!, 'visits')).toBe('up')
      await until(() =>
        expect(flashOf(canvas, dataRowId(2)!, 'visits')).toBe('down'),
      )
      await settle()
    })
  },
}

// --- S3: своя правка и правка коллеги --------------------------------------------------

const OWN_AGE = '44'
const COLLEAGUE_VISITS = 321

const ageInputOf = (root: ParentNode) =>
  cellOf(root, dataRowId(1)!, 'age')?.querySelector<HTMLInputElement>(
    'input',
  ) ?? null
const ageEditButton = (root: ParentNode) =>
  cellOf(root, dataRowId(1)!, 'age')?.querySelector<HTMLElement>(
    '.cell__button button',
  ) ?? null
const ageText = (root: ParentNode) => {
  const copy = cellOf(root, dataRowId(1)!, 'age')?.cloneNode(true) as
    HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
/** Открыть правку возраста, набрать и сохранить — по такту на действие. */
const saveAge = (root: HTMLElement) => {
  const input = ageInputOf(root)
  if (!input) ageEditButton(root)?.click()
  else if (input.value !== OWN_AGE) typeInto(input, OWN_AGE)
  else press(input, 'Enter')
}

const OWN_EDIT: readonly GuideStoryStep[] = [
  {
    title: 'Общая таблица',
    hint: 'С таблицей работают несколько человек. Приложение кладёт в неё и свои сохранения, и правки коллег, которые приходят с сервера.',
    props: seedProps,
    enter: stepAction(async (root, { signal }) => rowsReady(root, signal)),
  },
  {
    title: 'Своя правка',
    hint: 'Пользователь изменил возраст во второй строке и нажал Enter. Сервер принял значение, приложение положило его в таблицу. Ячейка не вспыхнула как смена извне: это значение записал сам пользователь.',
    enter: untilDone(
      root => !ageInputOf(root) && ageText(root) === OWN_AGE,
      saveAge,
    ),
  },
  {
    title: 'Правка коллеги',
    hint: 'Коллега изменил число визитов в той же строке. Значение пришло с сервера — ячейка вспыхнула.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [dataRowId(1)!]: { visits: COLLEAGUE_VISITS } })
      await pollUntil(
        () => dataValue(dataRowId(1)!, 'visits') === COLLEAGUE_VISITS,
        signal,
      )
    }),
  },
]

/** ADR 0221, S3: своя сохранённая правка не мигает, правка коллеги — мигает. */
export const ValueChangeFlashOwnEdit: StoryObj<StoryProps> = {
  name: 'Own edit and a colleague',
  parameters: { scenario: '0221/S3', ...guideControls() },
  render: args => (
    <GuideStory
      title="Своя правка и правка коллеги"
      steps={OWN_EDIT}
      args={guideArgs(
        {
          ...layout,
          enableValueChangeFlash: true,
          enableCellEditing: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OWN_EDIT[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(1)).toBeDefined())
    })
    await step(OWN_EDIT[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(ageText(canvas)).toBe(OWN_AGE))
      expect(flashOf(canvas, dataRowId(1)!, 'age')).not.toBe('changed')
      await settle()
    })
    await step(OWN_EDIT[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(flashOf(canvas, dataRowId(1)!, 'visits')).toBe('changed'),
      )
      await settle()
    })
  },
}

// --- S4: вспышка на подсвеченной строке ------------------------------------------------

const HIGHLIGHTED = HIGHLIGHTED_ROW
const OVER_VISITS = 777

const OVER_FILL: readonly GuideStoryStep[] = [
  {
    title: 'Подсвеченная строка',
    hint: 'Приложение подсветило третью строку: она требует внимания.',
    props: () => ({
      ...seedProps(),
      extraPlugins: [clientTxSeed, highlightSeed],
    }),
    states: ['body.highlight'],
    enter: stepAction(async (root, { signal }) => rowsReady(root, signal)),
  },
  {
    title: 'Смена на подсвеченной строке',
    hint: 'Пришло новое число визитов третьей строки. Ячейка вспыхнула своим тоном поверх подсветки, не смешиваясь с ней; когда вспышка погасла, подсветка видна как прежде.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      const row = dataRowId(HIGHLIGHTED)!
      push({ [row]: { visits: OVER_VISITS } })
      await pollUntil(() => dataValue(row, 'visits') === OVER_VISITS, signal)
    }),
  },
]

/** ADR 0221, S4: вспышка на подсвеченной строке — тон итога поверх, после угасания — подсветка. */
export const ValueChangeFlashOverFill: StoryObj<StoryProps> = {
  name: 'Flash over a highlight',
  parameters: { scenario: '0221/S4', ...guideControls() },
  render: args => (
    <GuideStory
      title="Вспышка на подсвеченной строке"
      steps={OVER_FILL}
      args={guideArgs({ ...layout, enableValueChangeFlash: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVER_FILL[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() =>
        expect(
          canvas
            .querySelector(
              `.data-grid__body-row[data-row-id="${dataRowId(HIGHLIGHTED)}"]`,
            )
            ?.hasAttribute('data-highlight'),
        ).toBe(true),
      )
    })
    await step(OVER_FILL[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(flashOf(canvas, dataRowId(HIGHLIGHTED)!, 'visits')).toBe(
          'changed',
        ),
      )
      // Вспышка гаснет — подсветка строки остаётся.
      await until(() =>
        expect(flashOf(canvas, dataRowId(HIGHLIGHTED)!, 'visits')).toBeNull(),
      )
      expect(
        canvas
          .querySelector(
            `.data-grid__body-row[data-row-id="${dataRowId(HIGHLIGHTED)}"]`,
          )
          ?.hasAttribute('data-highlight'),
      ).toBe(true)
      await settle()
    })
  },
}

// --- S5: все тоны вспышек ----------------------------------------------------------------

/** Строки шагов — по `id` данных: новая строка последнего шага сдвигает места. */
const COLOR_ROWS = {
  changed: 'item-id-1',
  up: 'item-id-2',
  down: 'item-id-3',
  accepted: 'item-id-4',
  reverted: 'item-id-5',
} as const
const ACCEPTED_AGE = '77'
const REFUSED_AGE = '13'

/** «Сервер» правки: отвечает через 300 мс, значение 13 отклоняет. */
const colorsSave = (commit: { value: unknown }) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(
      () =>
        String(commit.value) === REFUSED_AGE
          ? reject(new Error('The server refused the value'))
          : resolve(),
      300,
    ),
  )

const ageCell = (root: ParentNode, rowId: string) => cellOf(root, rowId, 'age')
const ageInput = (root: ParentNode, rowId: string) =>
  ageCell(root, rowId)?.querySelector<HTMLInputElement>('input') ?? null
const ageValue = (root: ParentNode, rowId: string) => {
  const copy = ageCell(root, rowId)?.cloneNode(true) as HTMLElement | undefined
  copy
    ?.querySelectorAll('.cell__button, [data-cell-issue]')
    .forEach(node => node.remove())
  return copy?.textContent?.trim()
}
const ageBusy = (root: ParentNode, rowId: string) =>
  ageCell(root, rowId)?.getAttribute('aria-busy') === 'true'
const ageRefused = (root: ParentNode, rowId: string) =>
  !!ageCell(root, rowId)?.querySelector('[data-cell-issue]')

/** Открыть правку возраста, набрать и сохранить — по такту на действие. */
const saveAgeOf = (root: HTMLElement, rowId: string, value: string) => {
  if (ageBusy(root, rowId)) return
  const input = ageInput(root, rowId)
  if (!input)
    ageCell(root, rowId)
      ?.querySelector<HTMLElement>('.cell__button button')
      ?.click()
  else if (input.value !== value) typeInto(input, value)
  else press(input, 'Enter')
}

/** Новая строка последнего шага. */
const ADDED_ROW = 'flash-colors-new'
const addedRowOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${ADDED_ROW}"]`,
  )

const COLORS: readonly GuideStoryStep[] = [
  {
    title: 'Тоны вспышек',
    hint: 'Ячейка или строка коротко вспыхивает, когда в ней что-то произошло. У каждого события свой тон: по нему видно, что именно случилось. Шаги ниже показывают все тоны по очереди.',
    props: () => ({ ...seedProps(), onCellEdit: colorsSave as never }),
    enter: stepAction(async (root, { signal }) => rowsReady(root, signal)),
  },
  {
    title: 'Значение сменилось извне',
    hint: 'Сервер прислал новое имя во второй строке. Ячейка вспыхнула тоном смены: значение изменилось не по действию пользователя.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [COLOR_ROWS.changed]: { firstName: 'Updated' } })
      await pollUntil(
        () => dataValue(COLOR_ROWS.changed, 'firstName') === 'Updated',
        signal,
      )
    }),
  },
  {
    title: 'Значение выросло',
    hint: 'Число визитов в третьей строке выросло. Ячейка вспыхнула тоном роста, у начала ячейки — стрелка вверх.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [COLOR_ROWS.up]: { visits: 5000 } })
      await pollUntil(() => dataValue(COLOR_ROWS.up, 'visits') === 5000, signal)
    }),
  },
  {
    title: 'Значение упало',
    hint: 'Число визитов в четвёртой строке упало. Ячейка вспыхнула тоном падения, у начала ячейки — стрелка вниз.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [COLOR_ROWS.down]: { visits: 0 } })
      await pollUntil(() => dataValue(COLOR_ROWS.down, 'visits') === 0, signal)
    }),
  },
  {
    title: 'Сервер принял правку',
    hint: 'Пользователь изменил возраст в пятой строке и нажал Enter. Сервер принял значение — ячейка вспыхнула тоном успеха.',
    immediate: true,
    enter: untilDone(
      root =>
        !ageBusy(root, COLOR_ROWS.accepted) &&
        !ageInput(root, COLOR_ROWS.accepted) &&
        ageValue(root, COLOR_ROWS.accepted) === ACCEPTED_AGE,
      root => saveAgeOf(root, COLOR_ROWS.accepted, ACCEPTED_AGE),
    ),
  },
  {
    title: 'Сервер отклонил правку',
    hint: 'Пользователь изменил возраст в шестой строке, но сервер отклонил значение. В ячейке снова прежнее значение, она вспыхнула тоном ошибки, а в её углу — отметка отказа.',
    immediate: true,
    enter: untilDone(
      root => ageRefused(root, COLOR_ROWS.reverted),
      root => saveAgeOf(root, COLOR_ROWS.reverted, REFUSED_AGE),
    ),
  },
  {
    title: 'Пришла новая строка',
    hint: 'Приложение добавило строку в начало таблицы. Вся строка вспыхнула тоном прихода: здесь появилось новое.',
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      if (dataValue(ADDED_ROW, 'id') === undefined) {
        const first = dataRowId(0)
        transact({
          add: [{ ...rowData(first), id: ADDED_ROW, firstName: 'New' }],
          index: 0,
        })
      }
      await pollUntil(() => !!addedRowOf(root), signal)
    }),
  },
]

/** ADR 0221, S5: все тоны вспышек на одной таблице — у каждого цвета своя цель. */
export const ValueChangeFlashColors: StoryObj<StoryProps> = {
  name: 'Flash colors',
  parameters: {
    scenario: '0221/S5',
    requirements: ['VC20'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Тоны вспышек"
      steps={COLORS}
      args={guideArgs(
        {
          ...layout,
          enableValueChangeFlash: true,
          valueChangeFlashColumnDefault: 'direction',
          enableCellEditing: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const flashed = (rowId: string, column: string, outcome: string) =>
      until(() => expect(flashOf(canvas, rowId, column)).toBe(outcome))
    await step(COLORS[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(5)).toBeDefined())
    })
    await step(COLORS[1]!.title, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.changed, 'firstName', 'changed')
    })
    await step(COLORS[2]!.title, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.up, 'visits', 'up')
      expect(arrowOf(canvas, COLOR_ROWS.up, 'visits')).toBe('up')
    })
    await step(COLORS[3]!.title, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.down, 'visits', 'down')
      expect(arrowOf(canvas, COLOR_ROWS.down, 'visits')).toBe('down')
    })
    await step(COLORS[4]!.title, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.accepted, 'age', 'accepted')
      expect(ageValue(canvas, COLOR_ROWS.accepted)).toBe(ACCEPTED_AGE)
    })
    await step(COLORS[5]!.title, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.reverted, 'age', 'reverted')
      await until(() =>
        expect(ageRefused(canvas, COLOR_ROWS.reverted)).toBe(true),
      )
    })
    await step(COLORS[6]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(addedRowOf(canvas)?.getAttribute('data-flash')).toBe('arrived'),
      )
      await settle()
    })
  },
}
