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
import { GuideStory, type GuideStoryStep, stepAction } from './demos/GuideStory'

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
      'Таблицу по шагам задаёт гайд сценария консоли',
    ]),
  ),
)

/** Одна ссылка на пустые данные: шаги не пишут лишних записей «Данные». */
const NO_ROWS: never[] = []

const guide = (title: string, steps: readonly GuideStoryStep[]) =>
  function Render(args: StoryProps) {
    return (
      <GuideStory
        title={title}
        steps={steps}
        // Аргументы Storybook, оставшиеся в URL, функции не включают.
        args={normalizeArgs({ ...meta.args, colorMode: args.colorMode })}
      />
    )
  }

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

const GUIDE_EVENTS: readonly GuideStoryStep[] = [
  {
    title: 'Таблица открыта',
    hint: 'В консоли — «Грид смонтирован»: загрузка, число строк и колонок, включённые плагины.',
    props: () => ({ loading: 'initial', dataOverride: NO_ROWS }),
  },
  {
    title: 'Включена сортировка',
    hint: 'Набор плагинов сменился: «Плагины +columnSorting».',
    props: () => ({ enableColumnSorting: true }),
  },
  {
    title: 'Данные получены',
    hint: 'Загрузка сменилась на off, пришли строки.',
    props: ({ rows: answer }) => ({ loading: false, dataOverride: answer }),
  },
  {
    title: 'Колонки сменились',
    hint: 'Новый набор колонок — запись «Колонки».',
    props: () => ({ columnCount: 5 }),
  },
  {
    title: 'Грид открыт заново',
    hint: 'Шаг пересоздаёт грид — «Грид пересоздан».',
    remount: true,
  },
]

/** S1: разработчик проходит гайд и видит события каждого шага в консоли. */
export const ConsoleGuideEvents: StoryObj<StoryProps> = {
  name: 'Guide events',
  parameters: {
    scenario: '0124/S1',
    requirements: ['CL5'],
    ...NO_CONTROLS,
  },
  render: guide('События гайда', GUIDE_EVENTS),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const expected = [
      ['Грид смонтирован', 'загрузка initial, 0 строк'],
      ['Плагины +columnSorting'],
      ['Загрузка initial → off', 'Данные 10 строк'],
      ['Колонки 5 колонок'],
      ['Грид пересоздан'],
    ]
    for (const [index, item] of GUIDE_EVENTS.entries()) {
      await step(item.title, async () => {
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

const COALESCING: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с шириной колонок',
    hint: 'Ширину колонки можно протянуть за грип на границе шапки.',
    props: () => ({ enableColumnSizing: true }),
  },
  {
    title: 'Протяжка ширины',
    hint: 'Один жест: начало и конец протяжки, а срезы ширины между ними — в группе жеста со счётчиком «×N», а не потоком строк.',
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
  render: guide('Склейка событий', COALESCING),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const logRows = () => [
      ...consoleOf(canvas).querySelectorAll<HTMLElement>(
        '[data-testid="story-console-log"] [data-console-kind]',
      ),
    ]
    await step(COALESCING[0]!.title, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
    })
    await step(COALESCING[1]!.title, async () => {
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

const FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с выбором и сортировкой',
    hint: 'Выбор строк и сортировка включены.',
    props: () => ({ enableRowSelection: true, enableColumnSorting: true }),
  },
  {
    title: 'Выбор и сортировка',
    hint: 'Выбрана строка и отсортирована колонка — в консоли колбэки, срезы и записи цикла.',
    // Фильтры консоли переживают новое открытие грида: шаг возвращает все виды.
    enter: stepAction(async (root, { signal }) => {
      await selectAndSort(root, signal)
      if (filtered.has(consoleOf(root)))
        await setFilters(root, () => true, signal)
    }),
  },
  {
    title: 'Только колбэки',
    hint: 'В консоли выключены «Состояние», «Жизненный цикл» и «Действия» — видны только колбэки.',
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
    title: 'Журнал очищен',
    hint: '«Очистить» — в консоли пусто.',
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
  render: guide('Фильтр и очистка', FILTER),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const kinds = () =>
      new Set([...logItems(canvas)].map(item => item.dataset.consoleKind))
    await step(FILTER[0]!.title, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
    })
    await step(FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => {
        expect(kinds().has('callback')).toBe(true)
        expect(kinds().has('state')).toBe(true)
        expect(kinds().has('lifecycle')).toBe(true)
      })
    })
    await step(FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect([...kinds()]).toEqual(['callback'])
      expect(filterRow('state')).toBeNull()
    })
    await step(FILTER[3]!.title, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      expect(logItems(canvas)).toHaveLength(0)
      expect(consoleText()).toContain('Событий пока нет')
    })
    await settle()
  },
}
