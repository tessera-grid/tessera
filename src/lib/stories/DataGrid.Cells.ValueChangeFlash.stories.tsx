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
        'The app streams updates: three rows change their visit count',
      control: 'boolean',
    },
    liveIntervalMs: {
      description: 'Interval between app updates, ms',
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
    title: { ru: 'Данные приложения', en: "The app's data" },
    hint: {
      ru: 'Приложение держит данные у себя и получает обновления с сервера: новые значения отдельных строк.',
      en: 'The app keeps the data itself and receives updates from the server: new values for individual rows.',
    },
    props: seedProps,
  },
  {
    title: { ru: 'Пришло обновление', en: 'An update arrived' },
    hint: {
      ru: 'Сервер прислал новое число визитов у двух строк, приложение положило его в таблицу. Ячейки с новым значением коротко вспыхнули, остальные ячейки этих строк — нет: их значения прежние.',
      en: 'The server sent a new visit count for two rows, and the app put it into the table. The cells with a new value flashed briefly; the other cells of those rows did not, since their values are unchanged.',
    },
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
      title={{ ru: 'Обновление с сервера', en: 'An update from the server' }}
      steps={UPDATE}
      args={guideArgs({ ...layout, enableValueChangeFlash: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(UPDATE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(3)).toBeDefined())
    })
    await step(UPDATE[1]!.title.ru, async () => {
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
    title: { ru: 'Котировки', en: 'Quotes' },
    hint: {
      ru: 'Таблица показывает числа, которые часто меняются. У числовых колонок вспышка показывает и направление смены.',
      en: 'The table shows numbers that change often. In number columns, the flash also shows the direction of the change.',
    },
    props: seedProps,
  },
  {
    title: {
      ru: 'Одно выросло, другое упало',
      en: 'One went up, another went down',
    },
    hint: {
      ru: 'Пришло обновление: у одной строки визитов стало больше, у другой — меньше. Ячейки вспыхнули тоном роста и падения, у начала ячейки — стрелка вверх или вниз: направление видно и без цвета.',
      en: 'An update arrived: one row has more visits, another has fewer. The cells flashed in the rise and fall tones, with an up or down arrow at the start of the cell, so the direction is visible even without color.',
    },
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
      title={{ ru: 'Рост и падение', en: 'Rise and fall' }}
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
    await step(DIRECTION[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(2)).toBeDefined())
    })
    await step(DIRECTION[1]!.title.ru, async () => {
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
    title: { ru: 'Общая таблица', en: 'A shared table' },
    hint: {
      ru: 'С таблицей работают несколько человек. Приложение кладёт в неё и свои сохранения, и правки коллег, которые приходят с сервера.',
      en: "Several people work with the table. The app puts into it both its own saves and colleagues' edits that come from the server.",
    },
    props: seedProps,
  },
  {
    title: { ru: 'Своя правка', en: 'Your own edit' },
    hint: {
      ru: 'Пользователь изменил возраст во второй строке и нажал Enter. Сервер принял значение, приложение положило его в таблицу. Ячейка не вспыхнула как смена извне: это значение записал сам пользователь.',
      en: 'The user changed the age in the second row and pressed Enter. The server accepted the value, and the app put it into the table. The cell did not flash as an outside change, because the user wrote this value.',
    },
    enter: untilDone(
      root => !ageInputOf(root) && ageText(root) === OWN_AGE,
      saveAge,
    ),
  },
  {
    title: { ru: 'Правка коллеги', en: "A colleague's edit" },
    hint: {
      ru: 'Коллега изменил число визитов в той же строке. Значение пришло с сервера — ячейка вспыхнула.',
      en: 'A colleague changed the visit count in the same row. The value came from the server, so the cell flashed.',
    },
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
      title={{
        ru: 'Своя правка и правка коллеги',
        en: "Your edit and a colleague's edit",
      }}
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
    await step(OWN_EDIT[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(1)).toBeDefined())
    })
    await step(OWN_EDIT[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ageText(canvas)).toBe(OWN_AGE))
      expect(flashOf(canvas, dataRowId(1)!, 'age')).not.toBe('changed')
      await settle()
    })
    await step(OWN_EDIT[2]!.title.ru, async () => {
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
    title: { ru: 'Подсвеченная строка', en: 'A highlighted row' },
    hint: {
      ru: 'Приложение подсветило третью строку: она требует внимания.',
      en: 'The app highlighted the third row because it needs attention.',
    },
    props: () => ({
      ...seedProps(),
      extraPlugins: [clientTxSeed, highlightSeed],
    }),
    states: ['body.highlight'],
  },
  {
    title: {
      ru: 'Смена на подсвеченной строке',
      en: 'A change on a highlighted row',
    },
    hint: {
      ru: 'Пришло новое число визитов третьей строки. Ячейка вспыхнула своим тоном поверх подсветки, не смешиваясь с ней; когда вспышка погасла, подсветка видна как прежде.',
      en: 'A new visit count arrived for the third row. The cell flashed in its own tone on top of the highlight without blending with it; after the flash faded, the highlight is visible as before.',
    },
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
      title={{
        ru: 'Вспышка на подсвеченной строке',
        en: 'A flash on a highlighted row',
      }}
      steps={OVER_FILL}
      args={guideArgs({ ...layout, enableValueChangeFlash: true }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(OVER_FILL[0]!.title.ru, async () => {
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
    await step(OVER_FILL[1]!.title.ru, async () => {
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
    title: { ru: 'Тоны вспышек', en: 'Flash tones' },
    hint: {
      ru: 'Ячейка или строка коротко вспыхивает, когда в ней что-то произошло. У каждого события свой тон: по нему видно, что именно случилось. Шаги ниже показывают все тоны по очереди.',
      en: 'A cell or row flashes briefly when something happens in it. Each event has its own tone, which shows what exactly happened. The steps below show all the tones one by one.',
    },
    props: () => ({ ...seedProps(), onCellEdit: colorsSave as never }),
  },
  {
    title: {
      ru: 'Значение сменилось извне',
      en: 'The value changed from outside',
    },
    hint: {
      ru: 'Сервер прислал новое имя во второй строке. Ячейка вспыхнула тоном смены: значение изменилось не по действию пользователя.',
      en: 'The server sent a new name for the second row. The cell flashed in the change tone: the value changed without any action by the user.',
    },
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
    title: { ru: 'Значение выросло', en: 'The value went up' },
    hint: {
      ru: 'Число визитов в третьей строке выросло. Ячейка вспыхнула тоном роста, у начала ячейки — стрелка вверх.',
      en: 'The visit count in the third row went up. The cell flashed in the rise tone, with an up arrow at the start of the cell.',
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [COLOR_ROWS.up]: { visits: 5000 } })
      await pollUntil(() => dataValue(COLOR_ROWS.up, 'visits') === 5000, signal)
    }),
  },
  {
    title: { ru: 'Значение упало', en: 'The value went down' },
    hint: {
      ru: 'Число визитов в четвёртой строке упало. Ячейка вспыхнула тоном падения, у начала ячейки — стрелка вниз.',
      en: 'The visit count in the fourth row went down. The cell flashed in the fall tone, with a down arrow at the start of the cell.',
    },
    immediate: true,
    enter: stepAction(async (root, { signal }) => {
      await rowsReady(root, signal)
      push({ [COLOR_ROWS.down]: { visits: 0 } })
      await pollUntil(() => dataValue(COLOR_ROWS.down, 'visits') === 0, signal)
    }),
  },
  {
    title: { ru: 'Сервер принял правку', en: 'The server accepted the edit' },
    hint: {
      ru: 'Пользователь изменил возраст в пятой строке и нажал Enter. Сервер принял значение — ячейка вспыхнула тоном успеха.',
      en: 'The user changed the age in the fifth row and pressed Enter. The server accepted the value, and the cell flashed in the success tone.',
    },
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
    title: { ru: 'Сервер отклонил правку', en: 'The server rejected the edit' },
    hint: {
      ru: 'Пользователь изменил возраст в шестой строке, но сервер отклонил значение. В ячейке снова прежнее значение, она вспыхнула тоном ошибки, а в её углу — отметка отказа.',
      en: 'The user changed the age in the sixth row, but the server rejected the value. The cell shows the previous value again and flashed in the error tone, and its corner has a refusal mark.',
    },
    immediate: true,
    enter: untilDone(
      root => ageRefused(root, COLOR_ROWS.reverted),
      root => saveAgeOf(root, COLOR_ROWS.reverted, REFUSED_AGE),
    ),
  },
  {
    title: { ru: 'Пришла новая строка', en: 'A new row arrived' },
    hint: {
      ru: 'Приложение добавило строку в начало таблицы. Вся строка вспыхнула тоном прихода: здесь появилось новое.',
      en: 'The app added a row at the top of the table. The whole row flashed in the arrival tone: something new appeared here.',
    },
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
      title={{ ru: 'Тоны вспышек', en: 'Flash tones' }}
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
    await step(COLORS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(dataRowId(5)).toBeDefined())
    })
    await step(COLORS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.changed, 'firstName', 'changed')
    })
    await step(COLORS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.up, 'visits', 'up')
      expect(arrowOf(canvas, COLOR_ROWS.up, 'visits')).toBe('up')
    })
    await step(COLORS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.down, 'visits', 'down')
      expect(arrowOf(canvas, COLOR_ROWS.down, 'visits')).toBe('down')
    })
    await step(COLORS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.accepted, 'age', 'accepted')
      expect(ageValue(canvas, COLOR_ROWS.accepted)).toBe(ACCEPTED_AGE)
    })
    await step(COLORS[5]!.title.ru, async () => {
      await guideNext(canvas)
      await flashed(COLOR_ROWS.reverted, 'age', 'reverted')
      await until(() =>
        expect(ageRefused(canvas, COLOR_ROWS.reverted)).toBe(true),
      )
    })
    await step(COLORS[6]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(addedRowOf(canvas)?.getAttribute('data-flash')).toBe('arrived'),
      )
      await settle()
    })
  },
}
