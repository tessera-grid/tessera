import type { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  consoleText,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { BASE_CONTROLS, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { rowSelectionLabels } from '../plugins/rowSelection/labels'
import { storyLabels } from './__mocks__/storyLabels'
import type { StoryText } from './__mocks__/storyText'
import { DemoStory, type DemoStoryStep, stepAction } from './demos/DemoStory'
import { shellText, type StoryShellKey } from './demos/storyShell'

/**
 * Песочница консоли историй (ADR 0124): по истории на сценарий S1–S3. Файл
 * `*.dev.stories.tsx` — только в `storybook dev` и тестах, в сборку Storybook не
 * попадает (ADR 0117, SN13).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Common/Console',
} satisfies Meta<StoryProps>

export default meta

/** Набор функций задаёт гайд: базовые контролы скрыты. */
const NO_CONTROLS = showControls(
  [],
  Object.fromEntries(
    BASE_CONTROLS.map(name => [
      name,
      'The console scenario guide sets up the table step by step',
    ]),
  ),
)

/** Одна ссылка на пустые данные: шаги не пишут лишних записей «Данные». */
const NO_ROWS: never[] = []

const guide = (title: StoryText, steps: readonly DemoStoryStep[]) =>
  function Render(args: StoryProps) {
    return (
      <DemoStory
        title={title}
        steps={steps}
        // Аргументы Storybook, оставшиеся в URL, функции не включают.
        args={normalizeArgs({
          ...meta.args,
          colorMode: args.colorMode,
          locale: args.locale,
        })}
      />
    )
  }

/** Текст оболочки на языке истории. */
const shell =
  (locale: string | undefined) =>
  (key: StoryShellKey, params?: Record<string, unknown>) =>
    shellText(locale, key, params)

const rows = (canvas: HTMLElement) =>
  [...canvas.querySelectorAll<HTMLElement>('.data-grid__body-row')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )

/** Виды, которые сценарий S3 выключает: остаются только колбэки. */
const HIDDEN_KINDS = ['state', 'lifecycle', 'action']

const filtersButton = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="story-console-filters"]')!

/** Строка вида в поповере «Фильтры» — в портале, вне холста истории. */
const filterRow = (kind: string) =>
  document.querySelector<HTMLElement>(`[data-console-filter="${kind}"]`)

const consoleOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="story-console"]')!

// --- S1 ------------------------------------------------------------------------------

const GUIDE_EVENTS: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Таблица открыта', en: 'The table is open' },
    hint: {
      ru: 'В консоли — «Грид смонтирован»: загрузка, число строк и колонок, включённые плагины.',
      en: 'The console shows “Grid mounted”: loading, the row and column counts, and the enabled plugins.',
    },
    props: () => ({ loading: 'initial', dataOverride: NO_ROWS }),
  },
  {
    title: { ru: 'Включена сортировка', en: 'Sorting is enabled' },
    hint: {
      ru: 'Набор плагинов сменился: «Плагины +columnSorting».',
      en: 'The set of plugins changed: “Plugins +columnSorting”.',
    },
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: { ru: 'Данные получены', en: 'Data received' },
    hint: {
      ru: 'Загрузка сменилась на off, пришли строки.',
      en: 'Loading switched to off, and the rows arrived.',
    },
    props: ({ rows: answer }) => ({ loading: false, dataOverride: answer }),
  },
  {
    title: { ru: 'Колонки сменились', en: 'The columns changed' },
    hint: {
      ru: 'Новый набор колонок — запись «Колонки».',
      en: 'A new set of columns adds a “Columns” record.',
    },
    props: () => ({ columnCount: 5 }),
  },
  {
    title: { ru: 'Грид открыт заново', en: 'The grid is opened again' },
    hint: {
      ru: 'Шаг пересоздаёт грид — «Грид пересоздан».',
      en: 'The step recreates the grid: “Grid recreated”.',
    },
    remount: true,
  },
]

/** S1: разработчик проходит гайд и видит события каждого шага в консоли. */
export const ConsoleGuideEvents: StoryObj<StoryProps> = {
  name: 'Demo events',
  parameters: {
    scenario: '0124/S1',
    requirements: ['CL5'],
    ...NO_CONTROLS,
  },
  render: guide({ ru: 'События Демо', en: 'Demo events' }, GUIDE_EVENTS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const text = shell(globals.locale)
    const expected = [
      [
        text('lifecycleMounted'),
        text('lifecycleMountDetail', {
          loading: 'initial',
          rows: text('lifecycleRows', { count: 0 }),
        }).split(', {columns}')[0]!,
      ],
      [`${text('lifecyclePlugins')} +columnSorting`],
      [
        `${text('lifecycleLoading')} initial → off`,
        `${text('lifecycleData')} ${text('lifecycleRows', { count: 10 })}`,
      ],
      [
        `${text('lifecycleColumns')} ${text('lifecycleColumnCount', { count: 5 })}`,
      ],
      [text('lifecycleRecreated')],
    ]
    for (const [index, item] of GUIDE_EVENTS.entries()) {
      await step(item.title.ru, async () => {
        if (index > 0) await guideNext(canvas)
        for (const text of expected[index]!) {
          await until(() => expect(consoleText()).toContain(text))
        }
      })
    }
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

/** Шагов протяжки: каждый — свой кадр, как движение мыши. */
const DRAG_STEPS = 5

const COALESCING: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Таблица с шириной колонок',
      en: 'A table with column widths',
    },
    hint: {
      ru: 'Ширину колонки можно протянуть за грип на границе шапки.',
      en: 'A column can be resized by dragging the resize grip on the header border.',
    },
    props: () => ({ enableColumnSizing: true }),
  },
  {
    title: { ru: 'Протяжка ширины', en: 'Resizing a column' },
    hint: {
      ru: 'Один жест: начало и конец протяжки, а срезы ширины между ними — в группе жеста со счётчиком «×N», а не потоком строк.',
      en: 'One gesture: the start and end of the resize, with the width slice updates between them grouped under the gesture with a “×N” counter instead of a stream of rows.',
    },
    // Протяжка грипа мышью: нажатие, движение по кадрам, отпускание.
    enter: root => {
      const grip = root.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="country"] .resize__handler--column',
      )
      if (!grip) return
      const { right, top } = grip.getBoundingClientRect()
      const at = (x: number) => ({
        bubbles: true,
        clientX: x,
        clientY: top + 4,
      })
      grip.dispatchEvent(new MouseEvent('mousedown', at(right)))
      const move = (index: number) => {
        if (index > DRAG_STEPS) {
          document.dispatchEvent(
            new MouseEvent('mouseup', at(right + DRAG_STEPS * 10)),
          )
          return
        }
        document.dispatchEvent(
          new MouseEvent('mousemove', at(right + index * 10)),
        )
        requestAnimationFrame(() => move(index + 1))
      }
      requestAnimationFrame(() => move(1))
    },
  },
]

/** S2: протяжка ширины — один жест, его срезы склеены в группе. */
export const ConsoleCoalescing: StoryObj<StoryProps> = {
  name: 'Coalescing',
  parameters: { scenario: '0124/S2', ...NO_CONTROLS },
  render: guide({ ru: 'Склейка событий', en: 'Coalescing events' }, COALESCING),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const logRows = () => [
      ...consoleOf(canvas).querySelectorAll<HTMLElement>(
        '[data-testid="story-console-log"] [data-console-kind]',
      ),
    ]
    await step(COALESCING[0]!.title.ru, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
    })
    await step(COALESCING[1]!.title.ru, async () => {
      await guideNext(canvas)
      // Начало жеста — строка действия, конец — запись его группы.
      await until(() => {
        const start = logRows().findIndex(
          row =>
            row.dataset.consoleKind === 'action' &&
            row.dataset.consoleChild === undefined &&
            row.textContent!.includes('columnSizing · resize'),
        )
        expect(start).toBeGreaterThan(-1)
        const group = logRows().slice(start + 1)
        const end = group.findIndex(row =>
          row.textContent!.includes('columnSizing · resize'),
        )
        expect(end).toBeGreaterThan(-1)
        const inGesture = group.slice(0, end + 1)
        expect(
          inGesture.every(row => row.dataset.consoleChild !== undefined),
        ).toBe(true)
        // Срез ширины — одной строкой со счётчиком.
        expect(
          inGesture.some(row =>
            /columnSizing[^×]*×[2-9]/.test(row.textContent!),
          ),
        ).toBe(true)
      })
    })
    await settle()
  },
}

// --- S3 ------------------------------------------------------------------------------

const logItems = (root: ParentNode) =>
  consoleOf(root).querySelectorAll<HTMLElement>(
    '[data-testid="story-console-log"] [data-console-kind]',
  )

const clearButton = (root: ParentNode) =>
  consoleOf(root).querySelector<HTMLElement>(
    '[data-testid="story-console-clear"]',
  )

/** Вид отмечен в поповере «Фильтры». */
const shownKind = (kind: string) =>
  filterRow(kind)
    ?.querySelector('[aria-checked]')
    ?.getAttribute('aria-checked') === 'true'

/** Строка выбрана флажком, первая колонка отсортирована. */
const selectAndSort = async (root: HTMLElement, signal: AbortSignal) => {
  const checkbox = () =>
    rows(root)[0]?.querySelector<HTMLElement>('.row-select-checkbox')
  const sort = () => root.querySelector<HTMLElement>('.column-sort__button')
  // Сортировка уводит выбранную строку с первого места.
  const selected = () =>
    !!root.querySelector('.data-grid__body-row[data-selected="true"]')
  const sorted = () =>
    /^(ascending|descending)$/.test(
      sort()?.closest('[aria-sort]')?.getAttribute('aria-sort') ?? '',
    )
  await pollUntil(() => !!checkbox() && !!sort(), signal)
  if (!selected()) checkbox()!.click()
  if (!sorted()) sort()!.click()
  await pollUntil(() => selected() && sorted(), signal)
}

/** Поповером «Фильтры» оставляет видами консоли те, что отбирает `shown`. */
const setFilters = async (
  root: HTMLElement,
  shown: (kind: string) => boolean,
  signal: AbortSignal,
) => {
  const kinds = () =>
    [...document.querySelectorAll<HTMLElement>('[data-console-filter]')].map(
      row => row.dataset.consoleFilter!,
    )
  const wrong = () => kinds().filter(kind => shownKind(kind) !== shown(kind))
  if (!filterRow('state')) filtersButton(root).click()
  // Строки поповера — в следующем кадре после нажатия.
  await pollUntil(() => !!filterRow('state'), signal)
  for (const kind of wrong()) filterRow(kind)!.click()
  await pollUntil(() => wrong().length === 0, signal)
  if (kinds().every(shown)) filtered.delete(consoleOf(root))
  else filtered.add(consoleOf(root))
  filtersButton(root).click()
  await pollUntil(() => !filterRow('state'), signal)
}

/** Консоли, у которых шаг скрыл виды: поповер закрыт, и узнать это иначе нельзя. */
const filtered = new WeakSet<Element>()

const FILTER: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Таблица с выбором и сортировкой',
      en: 'A table with selection and sorting',
    },
    hint: {
      ru: 'Выбор строк и сортировка включены.',
      en: 'Row selection and sorting are enabled.',
    },
    props: () => ({ enableRowSelection: true, enableColumnSorting: true }),
  },
  {
    title: { ru: 'Выбор и сортировка', en: 'Selection and sorting' },
    hint: {
      ru: 'Выбрана строка и отсортирована колонка — в консоли колбэки, срезы и записи цикла.',
      en: 'A row is selected and a column is sorted: the console shows callbacks, state slices, and lifecycle records.',
    },
    // Фильтры консоли переживают новое открытие грида: шаг возвращает все виды.
    enter: stepAction(async (root, { signal }) => {
      await selectAndSort(root, signal)
      if (filtered.has(consoleOf(root)))
        await setFilters(root, () => true, signal)
    }),
  },
  {
    title: { ru: 'Только колбэки', en: 'Callbacks only' },
    hint: {
      ru: 'В консоли выключены «Состояние», «Жизненный цикл» и «Действия» — видны только колбэки.',
      en: '“State”, “Lifecycle”, and “Actions” are turned off in the console, so only callbacks are shown.',
    },
    enter: stepAction(async (root, { signal }) => {
      await selectAndSort(root, signal)
      const toggle = consoleOf(root).querySelector<HTMLElement>(
        '[data-testid="story-console-toggle"]',
      )!
      if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
      await setFilters(root, kind => !HIDDEN_KINDS.includes(kind), signal)
    }),
  },
  {
    title: { ru: 'Журнал очищен', en: 'The log is cleared' },
    hint: {
      ru: '«Очистить» — в консоли пусто.',
      en: 'After “Clear”, the console is empty.',
    },
    enter: stepAction(async (root, { signal }) => {
      await pollUntil(() => !!clearButton(root), signal)
      clearButton(root)!.click()
      await pollUntil(() => logItems(root).length === 0, signal)
    }),
  },
]

/** S3: разработчик оставляет только колбэки и очищает журнал. */
export const ConsoleFilter: StoryObj<StoryProps> = {
  name: 'Filter and clear',
  parameters: {
    scenario: '0124/S3',
    ...NO_CONTROLS,
  },
  render: guide({ ru: 'Фильтр и очистка', en: 'Filter and clear' }, FILTER),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const kinds = () =>
      new Set([...logItems(canvas)].map(item => item.dataset.consoleKind))
    await step(FILTER[0]!.title.ru, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
    })
    await step(FILTER[1]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => {
        expect(kinds().has('callback')).toBe(true)
        expect(kinds().has('state')).toBe(true)
        expect(kinds().has('lifecycle')).toBe(true)
      })
    })
    await step(FILTER[2]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect([...kinds()]).toEqual(['callback'])
      expect(filterRow('state')).toBeNull()
    })
    await step(FILTER[3]!.title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(logItems(canvas)).toHaveLength(0)
      expect(consoleText()).toContain(shellText(globals.locale, 'consoleEmpty'))
    })
    await settle()
  },
}

// --- ADR 0225, S1 --------------------------------------------------------------------

const LANGUAGE_TITLE: StoryText = {
  ru: 'Язык Демо и консоли',
  en: 'Demo and console language',
}

const LANGUAGE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Демо на английском', en: 'The Demo in English' },
    hint: {
      ru: 'Язык истории — английский. Панель Демо, тексты шагов, консоль и таблица — на английском.',
      en: 'The story language is English. The Demo panel, the step texts, the console, and the table are in English.',
    },
    props: () => ({ locale: 'en', enableRowSelection: true }),
  },
  {
    title: { ru: 'Посетитель выбрал русский', en: 'The visitor chose Russian' },
    hint: {
      ru: 'Посетитель выбрал русский язык. Демо, консоль с прежними записями и таблица перешли на русский; шаг и журнал остались на месте.',
      en: 'The visitor chose Russian. The Demo, the console with its earlier records, and the table switched to Russian; the step and the log stayed in place.',
    },
    props: () => ({ locale: 'ru' }),
  },
  {
    title: {
      ru: 'Посетитель вернул английский',
      en: 'The visitor switched back to English',
    },
    hint: {
      ru: 'Посетитель вернул английский язык. Демо, консоль и таблица снова на английском.',
      en: 'The visitor switched back to English. The Demo, the console, and the table are in English again.',
    },
    props: () => ({ locale: 'en' }),
  },
]

/** Демо, консоль и таблица на языке шага: как сменил бы его тулбар Language. */
const inLanguage = (canvas: HTMLElement, locale: 'en' | 'ru') => {
  const text = shell(locale)
  const toggle = canvas.querySelector('[data-testid="guide-toggle"]')
  const steps = canvas.querySelector('[data-testid="guide-steps"]')
  const selectAll = rowSelectionLabels(storyLabels(locale)).selectAll
  expect(toggle?.textContent).toContain(
    text('guideTitle', { title: LANGUAGE_TITLE[locale] }),
  )
  expect(steps?.textContent).toContain(LANGUAGE[0]!.title[locale])
  expect(steps?.textContent).toContain(LANGUAGE[2]!.hint[locale])
  expect(consoleOf(canvas).getAttribute('aria-label')).toBe(
    text('consoleTitle'),
  )
  // Запись первого шага переведена вместе с консолью.
  expect(consoleText()).toContain(text('lifecycleMounted'))
  expect(canvas.querySelector(`[aria-label="${selectAll}"]`)).not.toBeNull()
}

/** ADR 0225, S1: посетитель переключает язык — гайд и консоль переходят на него. */
export const GuideLanguage: StoryObj<StoryProps> = {
  name: 'Switch language',
  parameters: {
    scenario: '0225/S1',
    requirements: ['GT10'],
    ...NO_CONTROLS,
  },
  render: guide(LANGUAGE_TITLE, LANGUAGE),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(LANGUAGE[0]!.title.ru, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
      await until(() => inLanguage(canvas, 'en'))
    })
    await step(LANGUAGE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => inLanguage(canvas, 'ru'))
    })
    await step(LANGUAGE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => inLanguage(canvas, 'en'))
    })
    await settle()
  },
}
