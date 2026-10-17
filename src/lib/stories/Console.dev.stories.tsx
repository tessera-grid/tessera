import type { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { consoleText, guideNext, settle, until } from './__mocks__/catalogPlay'
import { BASE_CONTROLS, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

/**
 * Песочница консоли историй (ADR 0124): по истории на сценарий S1–S3. Файл
 * `*.dev.stories.tsx` — только в `storybook dev` и тестах, в сборку Storybook не
 * попадает (ADR 0117, SN13).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Dev/Console',
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

const FILTER: readonly GuideStoryStep[] = [
  {
    title: 'Таблица с выбором и сортировкой',
    hint: 'Выбор строк и сортировка включены.',
    props: () => ({ enableRowSelection: true, enableColumnSorting: true }),
  },
  {
    title: 'Выбор и сортировка',
    hint: 'Выбрана строка и отсортирована колонка — в консоли колбэки, срезы и записи цикла.',
    enter: root => {
      rows(root)[0]?.querySelector<HTMLElement>('.row-select-checkbox')?.click()
      root.querySelector<HTMLElement>('.column-sort__button')?.click()
    },
  },
  {
    title: 'Только колбэки',
    hint: 'В консоли выключены «Состояние», «Жизненный цикл» и «Действия» — видны только колбэки.',
    // Поповер «Фильтры» открывается после нажатия: строки — в следующем кадре.
    enter: root => {
      const panel = consoleOf(root)
      const toggle = panel.querySelector<HTMLElement>(
        '[data-testid="story-console-toggle"]',
      )!
      if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
      filtersButton(root).click()
      const pick = () => {
        const rows = HIDDEN_KINDS.map(filterRow)
        if (rows.some(row => !row)) return requestAnimationFrame(pick)
        for (const row of rows) row!.click()
        filtersButton(root).click()
      }
      requestAnimationFrame(pick)
    },
  },
  {
    title: 'Журнал очищен',
    hint: '«Очистить» — в консоли пусто.',
    enter: root =>
      consoleOf(root)
        .querySelector<HTMLElement>('[data-testid="story-console-clear"]')
        ?.click(),
  },
]

/** S3: разработчик оставляет только колбэки и очищает журнал. */
export const ConsoleFilter: StoryObj<StoryProps> = {
  name: 'Filter and clear',
  parameters: {
    scenario: '0124/S3',
    requirements: ['CL8'],
    ...NO_CONTROLS,
  },
  render: guide('Фильтр и очистка', FILTER),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    const items = () => [
      ...consoleOf(canvas).querySelectorAll<HTMLElement>(
        '[data-testid="story-console-log"] [data-console-kind]',
      ),
    ]
    const kinds = () => new Set(items().map(item => item.dataset.consoleKind))
    await step(FILTER[0]!.title, async () => {
      await until(() => expect(rows(canvas).length).toBeGreaterThan(0))
    })
    await step(FILTER[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(kinds().has('callback')).toBe(true)
        expect(kinds().has('state')).toBe(true)
        expect(kinds().has('lifecycle')).toBe(true)
      })
    })
    await step(FILTER[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect([...kinds()]).toEqual(['callback']))
      await until(() => expect(filterRow('state')).toBeNull())
      // Записи скрыты, а не удалены: вид снова включён — записи вернулись.
      filtersButton(canvas).click()
      await until(() => expect(filterRow('state')).not.toBeNull())
      filterRow('state')!.click()
      await until(() => expect(kinds().has('state')).toBe(true))
      filterRow('state')!.click()
      await until(() => expect([...kinds()]).toEqual(['callback']))
      // «Показать все» возвращает все виды; снова оставляем только колбэки.
      const showAll = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="story-console-filters-menu"] button',
        ),
      ].find(button => button.textContent === 'Показать все')!
      showAll.click()
      await until(() => {
        expect(kinds().has('state')).toBe(true)
        expect(kinds().has('lifecycle')).toBe(true)
      })
      for (const kind of HIDDEN_KINDS) filterRow(kind)!.click()
      await until(() => expect([...kinds()]).toEqual(['callback']))
      filtersButton(canvas).click()
      await until(() => expect(filterRow('state')).toBeNull())
    })
    await step(FILTER[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => {
        expect(items()).toHaveLength(0)
        expect(consoleText()).toContain('Событий пока нет')
      })
    })
    await settle()
  },
}
