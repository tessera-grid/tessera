import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import { typeInto, press } from './__mocks__/typeGuides'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
import {
  indexOfRow,
  rowById,
  rowIdAt,
} from './__mocks__/clientTransactionsGuide'
import { getData } from './__mocks__/data'
import { definePlugin } from '../core/definePlugin'

/**
 * Клиентская модель строк (ADR 0200): `Playground` — сортировка, фильтр и группировка строк
 * в памяти; S1 — сто тысяч строк: сортировка, фильтр, группировка и правка без сервера.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Client row model',
} satisfies Meta<StoryProps>

export default meta

/** Высота — в окне снимка матрицы контраста (900×720, ADR 0089). */
const size: Partial<StoryProps> = {
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const FEATURES: Partial<StoryProps> = {
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableRowGrouping: true,
}

export const ClientRowModelPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableColumnSorting',
    'enableColumnFiltering',
    'enableRowGrouping',
    'enableQuickSearch',
  ]),
  args: {
    ...size,
    ...FEATURES,
    columnCount: 6,
    dataCount: 1000,
  },
}

// --- S1: сто тысяч строк в памяти -------------------------------------------------------

const BIG_COUNT = 100_000
let bigData: ReturnType<typeof getData> | undefined
/**
 * Сто тысяч строк — копии тысячи строк мока со своими `id` (генератор на всё — секунды);
 * возраст в каждой тысяче сдвинут, чтобы по возрасту рядом не стояли одинаковые строки.
 */
const bigRows = () =>
  (bigData ??= (() => {
    const base = getData(1000)
    return Array.from({ length: BIG_COUNT }, (_, i) => {
      const row = base[i % base.length]
      const block = Math.floor(i / base.length)
      return {
        ...row,
        id: `item-id-${i}`,
        age: 18 + ((row.age - 18 + block) % 28),
      }
    })
  })())

interface StateApi {
  store: unknown
  setSorting: (value: { id: string; desc: boolean }[]) => void
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  setGrouping: (value: string[]) => void
  setExpanded: (value: true | Record<string, boolean>) => void
}

const host = {
  table: undefined as StateApi | undefined,
  /** Состояние, которое шаг уже задал этой таблице. */
  applied: undefined as { store: unknown; level: number } | undefined,
}

/** Отдаёт таблицу шагам истории: они делают то, что пользователь кнопками заголовков. */
const stateHost = definePlugin<{ enabled?: boolean }>()({
  id: 'clientRowModelGuide',
  setup: () => table => {
    host.table = table as unknown as StateApi
    return () => {
      host.table = undefined
    }
  },
})

const BY_AGE = [{ id: 'age', desc: false }]
const BY_COUNTRY = [
  { id: 'country', value: { operator: 'contains', value: 'land' } },
]

/**
 * Состояние шага целиком: 0 — без действий, 1 — сортировка, 2 — и фильтр, 3 — и группировка.
 * Шаг приходит к нему из любого другого.
 */
const applyLevel = (level: number) => {
  const table = host.table
  if (!table) return false
  const { applied } = host
  if (applied && applied.store === table.store && applied.level === level)
    return true
  table.setSorting(level >= 1 ? BY_AGE : [])
  table.setColumnFilters(level >= 2 ? BY_COUNTRY : [])
  table.setGrouping(level >= 3 ? ['gender'] : [])
  table.setExpanded(level >= 3 ? true : {})
  host.applied = { store: table.store, level }
  return true
}

const isGroup = (id: string | undefined) => !!id?.startsWith('gender:')
const ageCellOf = (root: ParentNode, row: string) =>
  rowById(root, row)?.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="age"]',
  ) ?? null
const inputOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLInputElement>('input') ?? null
const editButtonOf = (root: ParentNode, row: string) =>
  ageCellOf(root, row)?.querySelector<HTMLElement>('.cell__button button') ??
  null
/** Возраст в ячейке — без кнопки правки. */
const ageText = (root: ParentNode, row: string) => {
  const copy = ageCellOf(root, row)?.cloneNode(true) as HTMLElement | undefined
  copy?.querySelectorAll('.cell__button').forEach(button => button.remove())
  return copy?.textContent?.trim()
}
const countryText = (root: ParentNode, row: string) =>
  rowById(root, row)
    ?.querySelector('.data-grid__body-cell[data-column-id="country"]')
    ?.textContent?.trim() ?? ''

/** Пятая строка первой группы; данные мока с зерном — строка всегда одна и та же. */
const EDITED_AT = 5
const NEW_AGE = '17'
const large = { edited: undefined as string | undefined }

/** Шаг ждёт, пока таблица покажет состояние: строки с первой — отсортированы по возрасту. */
const levelShown = (root: HTMLElement, level: number) => {
  const first = rowIdAt(root, 0)
  if (!first) return false
  if (level >= 3) return isGroup(first) && !isGroup(rowIdAt(root, 1))
  if (isGroup(first)) return false
  if (level >= 2) return countryText(root, first).includes('land')
  return true
}

const showLevel = (level: number) =>
  untilDone(
    root => host.applied?.level === level && levelShown(root, level),
    () => applyLevel(level),
  )

/** Открыть правку возраста пятой строки первой группы и набрать новый возраст. */
const draftAge = (root: HTMLElement) => {
  if (!applyLevel(3) || !levelShown(root, 3)) return
  large.edited ??= rowIdAt(root, EDITED_AT)
  const row = large.edited!
  const input = inputOf(root, row)
  if (!input) editButtonOf(root, row)?.click()
  else if (input.value !== NEW_AGE) typeInto(input, NEW_AGE)
}

const LARGE_ARGS: Partial<StoryProps> = {
  ...size,
  ...FEATURES,
  columnCount: 6,
  dataCount: BIG_COUNT,
  enableCellEditing: true,
}

const STEPS: readonly DemoStoryStep[] = [
  {
    title: {
      ru: 'Сто тысяч строк в памяти',
      en: 'A hundred thousand rows in memory',
    },
    hint: {
      ru: 'Приложение передало таблице сто тысяч строк. Все они в памяти: таблица сама сортирует, фильтрует и группирует их, без сервера.',
      en: 'The app passed a hundred thousand rows to the table. They are all in memory: the table sorts, filters, and groups them itself, without a server.',
    },
    props: () => ({ dataOverride: bigRows(), extraPlugins: [stateHost()] }),
  },
  {
    title: {
      ru: 'Строки отсортированы по возрасту',
      en: 'Rows are sorted by age',
    },
    hint: {
      ru: 'Пользователь отсортировал колонку возраста. Таблица упорядочила все сто тысяч строк и показывает младших сверху.',
      en: 'The user sorted the age column. The table ordered all hundred thousand rows and shows the youngest at the top.',
    },
    enter: showLevel(1),
  },
  {
    title: {
      ru: 'Строки отфильтрованы по стране',
      en: 'Rows are filtered by country',
    },
    hint: {
      ru: 'Пользователь оставил строки, в названии страны которых есть сочетание land. Таблица показывает только их, по-прежнему по возрасту.',
      en: 'The user kept only the rows whose country name contains the letters land. The table shows just those, still ordered by age.',
    },
    enter: showLevel(2),
  },
  {
    title: {
      ru: 'Строки сгруппированы по полу',
      en: 'Rows are grouped by gender',
    },
    hint: {
      ru: 'Пользователь сгруппировал строки по полу. Таблица показывает группы раскрытыми, рядом со значением группы — число её строк; внутри группы строки идут по возрасту.',
      en: "The user grouped the rows by gender. The table shows the groups expanded, with each group's row count next to its value; within a group, rows are ordered by age.",
    },
    states: ['body.groups'],
    enter: showLevel(3),
  },
  {
    title: { ru: 'Поле правки открыто', en: 'The edit field is open' },
    hint: {
      ru: 'Пользователь нажал кнопку правки в ячейке возраста пятой строки первой группы и набрал возраст младше всех.',
      en: 'The user pressed the edit button in the age cell of the fifth row of the first group and typed an age lower than all the others.',
    },
    states: ['body.editing'],
    enter: untilDone(
      root =>
        large.edited !== undefined &&
        inputOf(root, large.edited)?.value === NEW_AGE,
      draftAge,
    ),
  },
  {
    title: {
      ru: 'Строка поднялась наверх группы',
      en: 'The row moved to the top of its group',
    },
    hint: {
      ru: 'Пользователь нажал Enter. Приложение заменило в данных одну строку, таблица пересобрала только её: строка поднялась наверх своей группы, строки над её прежним местом сдвинулись вниз.',
      en: 'The user pressed Enter. The app replaced one row in the data, and the table rebuilt only that row: it moved to the top of its group, and the rows above its old position shifted down.',
    },
    enter: untilDone(
      root =>
        large.edited !== undefined &&
        !inputOf(root, large.edited) &&
        isGroup(rowIdAt(root, indexOfRow(root, large.edited) - 1)),
      root => {
        const input = large.edited ? inputOf(root, large.edited) : null
        if (input?.value === NEW_AGE) press(input!, 'Enter')
        else draftAge(root)
      },
    ),
  },
]

/** ADR 0200, S1: сортировка, фильтр, группировка и правка на ста тысячах строк в памяти. */
export const ClientRowModelLargeTable: StoryObj<StoryProps> = {
  name: 'Sort, filter, group and edit a large table',
  parameters: { scenario: '0200/S1', ...guideControls() },
  render: args => (
    <DemoStory
      title={{
        ru: 'Сто тысяч строк в памяти',
        en: 'A hundred thousand rows in memory',
      }}
      steps={STEPS}
      args={guideArgs(LARGE_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(STEPS[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(rowIdAt(canvas, 0)).toBe('item-id-0'))
    })
    await step(STEPS[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(host.applied?.level).toBe(1))
      await until(() =>
        expect(
          Number(ageText(canvas, rowIdAt(canvas, 0)!)),
        ).toBeLessThanOrEqual(Number(ageText(canvas, rowIdAt(canvas, 3)!))),
      )
    })
    await step(STEPS[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(levelShown(canvas, 2)).toBe(true))
      for (const i of [0, 1, 2, 3])
        await expect(countryText(canvas, rowIdAt(canvas, i)!)).toContain('land')
    })
    await step(STEPS[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(levelShown(canvas, 3)).toBe(true))
      await settle()
    })
    await step(STEPS[4]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(inputOf(canvas, large.edited!)?.value).toBe(NEW_AGE),
      )
      await expect(indexOfRow(canvas, large.edited!)).toBe(EDITED_AT)
    })
    await step(STEPS[5]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(inputOf(canvas, large.edited!)).toBeNull())
      await until(() =>
        expect(
          isGroup(rowIdAt(canvas, indexOfRow(canvas, large.edited!) - 1)),
        ).toBe(true),
      )
      await expect(ageText(canvas, large.edited!)).toBe(NEW_AGE)
      await settle()
    })
  },
}
