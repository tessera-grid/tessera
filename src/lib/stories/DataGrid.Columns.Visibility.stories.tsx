import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  headCell,
  settle,
  until,
  waitForRows,
} from './__mocks__/catalogPlay'
import { untilDone } from './__mocks__/cellGestures'
import {
  closeViewSettings,
  openViewSettingsSection,
} from './__mocks__/viewSettings'
import { storyLabels } from './__mocks__/storyLabels'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'

/**
 * Видимость колонок (ADR 0035, ADR 0133): `Playground` — кнопка списка колонок; S1 ADR 0133 —
 * все колонки одним флажком, S2 — дерево вложенной шапки; S1 ADR 0035 — скрытие из меню колонки.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Columns/Visibility',
} satisfies Meta<StoryProps>

export default meta

export const ColumnVisibilityPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'enableColumnVisibility',
    'enableRowSelection',
    'rowSelectionSubRows',
    'rowSelectionSelectedCount',
  ]),
  args: {
    // Раздел «Колонки» «Настроек вида»: поиск, флажок всех колонок, дерево, счётчик и «Сбросить».
    // headerNesting: nested — меню покажет группы вложенной шапки.
    enableColumnVisibility: true,
    enableRowSelection: true,
  },
}

// --- ADR 0133 S1 ---------------------------------------------------------------------

const menuOf = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')
const rootBoxOf = () =>
  menuOf()?.querySelector<HTMLElement>(
    '[data-testid="column-visibility-all"] [role="checkbox"]',
  ) ?? null
const columnBoxOf = (id: string) =>
  menuOf()?.querySelector<HTMLElement>(
    `[data-column-id="${id}"] [role="checkbox"]`,
  ) ?? null
const headIdsOf = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.data-grid__head-cell')]
    .map(cell => cell.dataset.columnId ?? '')
    .filter(id => id && !id.startsWith('actionColumn'))

/**
 * Шаг в меню «Колонки», как у пользователя: меню открыто — сразу, иначе сначала «Настройки вида» и его
 * раздел «Колонки» (ADR 0215). `reach` делает одно нажатие к состоянию шага и возвращает `true`,
 * когда оно достигнуто: шаг приходит к своему состоянию из любого — после отката гайда
 * и при переходе нажатием на шаг (ADR 0117, SN24, SN33). Уход с шага останавливает нажатия:
 * иначе они дошли бы до таблицы, открытой заново.
 */
const inColumnsMenu =
  (reach: () => boolean = () => true) =>
  (root: HTMLElement) => {
    let clicks = 0
    let frame = 0
    const run = () => {
      if (menuOf()?.hasAttribute('data-open')) {
        if (reach() || ++clicks > 10) return
      } else openViewSettingsSection(root, 'columns')
      frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }

const checkedOf = (box: HTMLElement | null) => box?.getAttribute('aria-checked')

/** Нажать флажок, если он не в нужном состоянии; `true` — состояние достигнуто. */
const clickUntil = (box: () => HTMLElement | null, state: string) => () => {
  if (checkedOf(box()) === state) return true
  box()?.click()
  return false
}

/** Видна одна колонка `id`: сначала скрыть все, затем показать её. */
const onlyColumn = (id: string) => () => {
  if (
    checkedOf(rootBoxOf()) === 'mixed' &&
    checkedOf(columnBoxOf(id)) === 'true' &&
    menuOf()?.querySelectorAll('[data-column-id] [aria-checked="true"]')
      .length === 1
  )
    return true
  if (checkedOf(rootBoxOf()) !== 'false') rootBoxOf()?.click()
  else columnBoxOf(id)?.click()
  return false
}

/** Скрыта группа `id`, остальные колонки видны: сначала показать все, затем снять группу. */
const onlyGroupHidden = (id: string) => () => {
  if (checkedOf(columnBoxOf(id)) === 'false') return true
  if (checkedOf(rootBoxOf()) !== 'true') rootBoxOf()?.click()
  else columnBoxOf(id)?.click()
  return false
}

const TOGGLE_ALL: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Все колонки видны', en: 'All columns are visible' },
    hint: {
      ru: 'Пользователь ещё не открывал меню видимости колонок, все колонки на месте.',
      en: 'The user has not opened the column visibility menu yet; all columns are in place.',
    },
  },
  {
    title: { ru: 'Меню видимости колонок', en: 'The column visibility menu' },
    hint: {
      ru: 'Над списком колонок — флажок всех колонок, колонки под ним сдвинуты на уровень. Внизу — сколько колонок выбрано.',
      en: 'Above the column list is a checkbox for all columns, with the columns indented one level below it. At the bottom, the menu shows how many columns are selected.',
    },
    states: ['overlay.columns'],
    enter: inColumnsMenu(),
  },
  {
    title: {
      ru: 'Пользователь скрыл все колонки',
      en: 'The user hid all columns',
    },
    hint: {
      ru: 'Флажок всех колонок снят. В таблице отображается заглушка, выбрано ноль колонок.',
      en: 'The checkbox for all columns is cleared. The table shows a placeholder, and zero columns are selected.',
    },
    enter: inColumnsMenu(clickUntil(rootBoxOf, 'false')),
  },
  {
    title: {
      ru: 'Пользователь вернул одну колонку',
      en: 'The user brought back one column',
    },
    hint: {
      ru: 'Флажок всех колонок — в промежуточном состоянии, в таблице одна колонка.',
      en: 'The checkbox for all columns is in the mixed state, and the table has one column.',
    },
    enter: inColumnsMenu(onlyColumn('firstName')),
  },
  {
    title: {
      ru: 'Пользователь показал все колонки',
      en: 'The user showed all columns',
    },
    hint: {
      ru: 'Нажатие на промежуточный флажок показывает все колонки: таблица снова целиком.',
      en: 'Clicking the mixed checkbox shows all columns: the whole table is back.',
    },
    enter: inColumnsMenu(clickUntil(rootBoxOf, 'true')),
  },
]

/** ADR 0133, S1: пользователь скрывает и показывает все колонки флажком над списком. */
export const ColumnVisibilityToggleAll: StoryObj<StoryProps> = {
  name: 'Toggle all',
  parameters: {
    scenario: '0133/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Все колонки одним флажком',
        en: 'All columns with one checkbox',
      }}
      steps={TOGGLE_ALL}
      args={guideArgs(
        {
          enableColumnVisibility: true,
          columnCount: 5,
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ args, canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const labels = storyLabels(args.locale)
    const count = () =>
      menuOf()?.querySelector('[data-testid="column-visibility-count"]')
        ?.textContent
    await step(TOGGLE_ALL[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(TOGGLE_ALL[1].title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(rootBoxOf()).not.toBeNull())
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true'),
      )
      await until(() =>
        expect(count()).toBe(columnVisibilityLabels(labels).selectedColumns(5)),
      )
      await settle()
    })
    await step(TOGGLE_ALL[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="columns-hidden-stub"]'),
        ).not.toBeNull(),
      )
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'false'),
      )
      await until(() =>
        expect(count()).toBe(columnVisibilityLabels(labels).selectedColumns(0)),
      )
      await settle()
    })
    await step(TOGGLE_ALL[3].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toEqual(['firstName']))
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'mixed'),
      )
      await settle()
    })
    await step(TOGGLE_ALL[4].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toHaveLength(5))
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true'),
      )
      await settle()
    })
  },
}

// --- ADR 0035 S1 ---------------------------------------------------------------------

const HIDDEN = 'lastName'
const hideItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menu"] [data-action-id="columnVisibility.hide"]',
  )
const kebabOf = (root: HTMLElement) =>
  headCell(root, HIDDEN)?.querySelector<HTMLElement>('[data-action-menu]') ??
  null

/** Пользователь открывает меню колонки кнопкой в её заголовке. */
const openColumnMenu = (root: HTMLElement) => {
  if (!hideItem()) kebabOf(root)?.click()
}
/** Пользователь скрывает колонку пунктом её меню. */
const hideFromMenu = (root: HTMLElement) => {
  if (!headCell(root, HIDDEN)) return
  if (hideItem()) hideItem()!.click()
  else openColumnMenu(root)
}

const HEADER_MENU: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Меню колонок в заголовках',
      en: 'Column menus in the headers',
    },
    hint: {
      ru: 'У заголовка — кнопка меню колонки, над таблицей — кнопка списка колонок.',
      en: 'Each header has a column menu button, and above the table is a button for the column list.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл меню колонки',
      en: 'The user opened the column menu',
    },
    hint: {
      ru: 'В меню — действие «скрыть колонку».',
      en: 'The menu has a “hide column” action.',
    },
    states: ['overlay.menu'],
    enter: untilDone(() => !!hideItem(), openColumnMenu),
  },
  {
    title: { ru: 'Пользователь скрыл колонку', en: 'The user hid a column' },
    hint: {
      ru: 'Колонка ушла из таблицы, соседние сдвинулись на её место.',
      en: 'The column left the table, and its neighbors moved into its place.',
    },
    enter: untilDone(root => !headCell(root, HIDDEN), hideFromMenu),
  },
  {
    title: {
      ru: 'Пользователь вернул колонку',
      en: 'The user brought the column back',
    },
    hint: {
      ru: 'В списке колонок над таблицей пользователь снова отметил скрытую колонку — она вернулась на своё место.',
      en: 'In the column list above the table, the user checked the hidden column again, and it returned to its place.',
    },
    // Сначала колонку скрывают (шаг открыт нажатием на него), затем возвращают списком.
    enter: (root: HTMLElement) => {
      let hidden = false
      let left = false
      const run = () => {
        if (left) return
        if (!hidden) {
          if (!headCell(root, HIDDEN)) hidden = true
          else hideFromMenu(root)
        } else if (headCell(root, HIDDEN)) return
        else if (!menuOf()?.hasAttribute('data-open'))
          openViewSettingsSection(root, 'columns')
        else if (checkedOf(columnBoxOf(HIDDEN)) !== 'true')
          columnBoxOf(HIDDEN)?.click()
        setTimeout(run, 150)
      }
      setTimeout(run, 0)
      return () => {
        left = true
      }
    },
  },
]

/** ADR 0035, S1: пользователь скрывает колонку из её меню и возвращает списком колонок. */
export const ColumnVisibilityWithHeaderMenu: StoryObj<StoryProps> = {
  name: 'With header menu',
  parameters: {
    scenario: '0035/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Скрытие колонки из её меню',
        en: 'Hiding a column from its menu',
      }}
      steps={HEADER_MENU}
      args={guideArgs(
        {
          enableColumnVisibility: true,
          enableHeaderActionMenu: true,
          enableColumnPinning: true,
          columnCount: 5,
          dataCount: 20,
          containerHeight: '460',
          height: '360',
          maxHeight: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let initial: string[] = []
    await step(HEADER_MENU[0]!.title.ru, async () => {
      await waitForRows(canvas)
      initial = headIdsOf(canvas)
      await expect(initial).toContain(HIDDEN)
      await until(() => expect(kebabOf(canvas)).not.toBeNull())
    })
    await step(HEADER_MENU[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(hideItem()).not.toBeNull())
      await settle()
    })
    await step(HEADER_MENU[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(headIdsOf(canvas)).toEqual(initial.filter(id => id !== HIDDEN)),
      )
    })
    await step(HEADER_MENU[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toEqual(initial))
      await settle()
    })
  },
}

// --- ADR 0204 S1–S2 ------------------------------------------------------------------

/** Колонка с сортировкой по убыванию и фильтром «содержит a». */
const TRANSFORMED = 'lastName'
const transformedArgs: Partial<StoryProps> = {
  enableColumnVisibility: true,
  enableHeaderActionMenu: true,
  enableColumnSorting: true,
  enableColumnFiltering: true,
  columnSortingInitialSorting: [{ id: TRANSFORMED, desc: true }],
  columnFilteringInitialColumnFilters: [
    { id: TRANSFORMED, value: { operator: 'contains', value: 'a' } },
  ],
  columnCount: 5,
  dataCount: 40,
  containerHeight: '460',
  height: '360',
  maxHeight: '360',
}

const transformedHideItem = () =>
  document.querySelector<HTMLElement>(
    '[role="menu"] [data-action-id="columnVisibility.hide"]',
  )
const captionOf = (item: HTMLElement | null) =>
  item?.querySelector('[data-popup-item-caption]')?.textContent ?? null
const rowOf = (id: string) =>
  menuOf()?.querySelector<HTMLElement>(`[data-column-id="${id}"]`) ?? null
const keptOf = (id: string) =>
  rowOf(id)?.querySelector('[data-transforms-kept]')?.textContent ?? null
/** Что держит скрытая колонка — по кнопке-ластику у её пункта. */
const iconsOf = (id: string) =>
  rowOf(id)
    ?.querySelector<HTMLElement>(
      '[data-testid="column-visibility-clear-transforms"]',
    )
    ?.dataset.transforms?.split(' ') ?? []
const clearOf = (id: string) =>
  rowOf(id)?.querySelector<HTMLElement>(
    '[data-testid="column-visibility-clear-transforms"]',
  ) ?? null
/** Нажатие к разделу «Колонки» «Настроек вида» (ADR 0215): открыть «Настройки вида», затем раздел. */
const columnsButtonOf = (root: HTMLElement) => ({
  click: () => openViewSettingsSection(root, 'columns'),
})
/** Закрыть «Настройки вида» с разделом «Колонки». */
const closeColumns = (root: HTMLElement) => closeViewSettings(root)
const transformedKebabOf = (root: HTMLElement) =>
  headCell(root, TRANSFORMED)?.querySelector<HTMLElement>(
    '[data-action-menu]',
  ) ?? null
const sortedBy = (root: HTMLElement) =>
  !!root.querySelector(`[data-column-id="${TRANSFORMED}"][aria-sort]`)

const HIDE_SORTED: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Колонка отсортирована и отфильтрована',
      en: 'The column is sorted and filtered',
    },
    hint: {
      ru: 'Строки идут по фамилии в обратном порядке, и в таблице только фамилии с буквой «a».',
      en: 'Rows are sorted by last name in reverse order, and the table shows only last names with the letter “a”.',
    },
  },
  {
    title: {
      ru: 'Пользователь открыл меню колонки',
      en: 'The user opened the column menu',
    },
    hint: {
      ru: 'Пользователь открыл меню отсортированной колонки. Под пунктом скрытия — подсказка: сортировка и фильтр останутся и после скрытия.',
      en: 'The user opened the menu of the sorted column. Below the hide item, a note says that sorting and the filter will remain after hiding.',
    },
    states: ['overlay.menu'],
    enter: untilDone(
      () => !!captionOf(transformedHideItem()),
      root => {
        if (!transformedHideItem()) transformedKebabOf(root)?.click()
      },
    ),
  },
  {
    title: { ru: 'Пользователь скрыл колонку', en: 'The user hid a column' },
    hint: {
      ru: 'Колонки нет в таблице, а строки по-прежнему отсортированы по фамилии и отфильтрованы.',
      en: 'The column is gone from the table, but the rows are still sorted by last name and filtered.',
    },
    enter: untilDone(
      root => !headCell(root, TRANSFORMED),
      root => {
        if (!headCell(root, TRANSFORMED)) return
        if (transformedHideItem()) transformedHideItem()!.click()
        else transformedKebabOf(root)?.click()
      },
    ),
  },
]

/** ADR 0204, S1: скрытие отсортированной колонки кебабом — подсказка, что сортировка останется. */
export const VisibilityHideSortedColumn: StoryObj<StoryProps> = {
  name: 'Hide a sorted column',
  parameters: {
    scenario: '0204/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Скрытие отсортированной колонки',
        en: 'Hiding a sorted column',
      }}
      steps={HIDE_SORTED}
      args={guideArgs(transformedArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(HIDE_SORTED[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(sortedBy(canvas)).toBe(true))
      await until(() => expect(transformedKebabOf(canvas)).not.toBeNull())
    })
    await step(HIDE_SORTED[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(captionOf(transformedHideItem())).toBeTruthy())
      await settle()
    })
    await step(HIDE_SORTED[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headCell(canvas, TRANSFORMED)).toBeNull())
      await settle()
    })
  },
}

/**
 * Скрыть колонку в списке колонок, если она видна; `true` — скрыта и меню открыто. Подсказка
 * «остаются» — у колонки, скрытой в этом открытии меню.
 */
const hiddenInMenu = (root: HTMLElement) => () => {
  if (
    !headCell(root, TRANSFORMED) &&
    checkedOf(columnBoxOf(TRANSFORMED)) === 'false'
  )
    return true
  if (checkedOf(columnBoxOf(TRANSFORMED)) === 'true')
    columnBoxOf(TRANSFORMED)?.click()
  return false
}

/** Список колонок открыт заново: колонка скрыта, у неё кнопка-ластик без подсказки. */
const reopenedWithIcons = (root: HTMLElement) => {
  let closed = false
  let left = false
  const run = () => {
    if (left) return
    if (headCell(root, TRANSFORMED)) {
      if (menuOf()?.hasAttribute('data-open')) {
        if (checkedOf(columnBoxOf(TRANSFORMED)) === 'true')
          columnBoxOf(TRANSFORMED)?.click()
      } else columnsButtonOf(root)?.click()
    } else if (!closed) {
      if (menuOf()?.hasAttribute('data-open')) closeColumns(root)
      else closed = true
    } else if (!menuOf()?.hasAttribute('data-open'))
      columnsButtonOf(root)?.click()
    else if (iconsOf(TRANSFORMED).length > 0 && !keptOf(TRANSFORMED)) return
    setTimeout(run, 150)
  }
  setTimeout(run, 0)
  return () => {
    left = true
  }
}

const CLEAR_HIDDEN: readonly GuideStoryStep[] = [
  {
    title: {
      ru: 'Колонка отсортирована и отфильтрована',
      en: 'The column is sorted and filtered',
    },
    hint: {
      ru: 'Строки идут по фамилии в обратном порядке, и в таблице только фамилии с буквой «a».',
      en: 'Rows are sorted by last name in reverse order, and the table shows only last names with the letter “a”.',
    },
  },
  {
    title: {
      ru: 'Пользователь скрыл колонку в списке',
      en: 'The user hid a column in the list',
    },
    hint: {
      ru: 'Колонки нет в таблице. У неё в списке — подсказка: сортировка и фильтр остаются.',
      en: 'The column is gone from the table. Its entry in the list has a note: sorting and the filter remain.',
    },
    states: ['overlay.columns'],
    enter: root => inColumnsMenu(hiddenInMenu(root))(root),
  },
  {
    title: {
      ru: 'Пользователь снова открыл список',
      en: 'The user opened the list again',
    },
    hint: {
      ru: 'У скрытой колонки — кнопка-ластик: она видна, пока колонка меняет строки, а её подсказка называет сортировку и фильтр.',
      en: 'The hidden column has an eraser button: it is shown while the column affects the rows, and its tooltip names the sorting and the filter.',
    },
    states: ['overlay.columns'],
    enter: reopenedWithIcons,
  },
  {
    title: {
      ru: 'Пользователь снял сортировку и фильтр',
      en: 'The user removed sorting and the filter',
    },
    hint: {
      ru: 'Ластиком у скрытой колонки пользователь снял её сортировку и фильтр: кнопки больше нет, в таблице снова все строки в исходном порядке.',
      en: 'With the eraser on the hidden column, the user removed its sorting and filter: the button is gone, and the table again shows all rows in their original order.',
    },
    states: ['overlay.columns'],
    enter: untilDone(
      () =>
        !!menuOf() &&
        iconsOf(TRANSFORMED).length === 0 &&
        !clearOf(TRANSFORMED),
      root => {
        if (clearOf(TRANSFORMED)) clearOf(TRANSFORMED)!.click()
        else if (!menuOf()?.hasAttribute('data-open'))
          columnsButtonOf(root)?.click()
        else if (checkedOf(columnBoxOf(TRANSFORMED)) === 'true')
          columnBoxOf(TRANSFORMED)?.click()
      },
    ),
  },
]

/** ADR 0204, S2: скрытая колонка в списке колонок — кнопка-ластик снимает её сортировку и фильтр. */
export const VisibilityClearHiddenTransforms: StoryObj<StoryProps> = {
  name: 'Clear a hidden column sorting',
  parameters: {
    scenario: '0204/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{
        ru: 'Сортировка и фильтр скрытой колонки',
        en: 'Sorting and filter of a hidden column',
      }}
      steps={CLEAR_HIDDEN}
      args={guideArgs(transformedArgs, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let filtered = 0
    await step(CLEAR_HIDDEN[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await until(() => expect(sortedBy(canvas)).toBe(true))
      filtered = canvas.querySelectorAll('.data-grid__body-row').length
    })
    await step(CLEAR_HIDDEN[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(keptOf(TRANSFORMED)).toBeTruthy())
      await expect(headCell(canvas, TRANSFORMED)).toBeNull()
      await settle()
    })
    await step(CLEAR_HIDDEN[2]!.title.ru, async () => {
      await guideNext(canvas)
      // Ластик стоит у колонки и в прошлом шаге: шаг пройден, когда подсказка ушла с повторным открытием.
      await until(() => {
        expect(keptOf(TRANSFORMED)).toBeNull()
        expect(iconsOf(TRANSFORMED)).toEqual(['sort', 'filter'])
      })
      await settle()
    })
    await step(CLEAR_HIDDEN[3]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(iconsOf(TRANSFORMED)).toEqual([]))
      await until(() =>
        expect(
          canvas.querySelectorAll('.data-grid__body-row').length,
        ).toBeGreaterThanOrEqual(filtered),
      )
      await settle()
    })
  },
}

// --- ADR 0133 S2 ---------------------------------------------------------------------

const NESTED_TREE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Все колонки видны', en: 'All columns are visible' },
    hint: {
      ru: 'Колонки сгруппированы во вложенной шапке. Пользователь ещё не открывал меню видимости колонок.',
      en: 'The columns are grouped in a nested header. The user has not opened the column visibility menu yet.',
    },
  },
  {
    title: {
      ru: 'Дерево колонок вложенной шапки',
      en: 'The column tree of a nested header',
    },
    hint: {
      ru: 'Колонки в меню сгруппированы, как в шапке таблицы. Флажок всех колонок, группы и их колонки соединены линиями дерева.',
      en: 'The columns in the menu are grouped as in the table header. Tree lines connect the checkbox for all columns, the groups, and their columns.',
    },
    enter: inColumnsMenu(),
  },
  {
    title: { ru: 'Пользователь скрыл группу', en: 'The user hid a group' },
    hint: {
      ru: 'Галочка группы скрывает все её колонки: группы больше нет в шапке, флажок всех колонок — в промежуточном состоянии.',
      en: "The group's checkbox hides all its columns: the group is gone from the header, and the checkbox for all columns is in the mixed state.",
    },
    enter: inColumnsMenu(onlyGroupHidden('name')),
  },
  {
    title: {
      ru: 'Пользователь показал все колонки',
      en: 'The user showed all columns',
    },
    hint: {
      ru: 'Флажок всех колонок возвращает группу в шапку таблицы.',
      en: 'The checkbox for all columns brings the group back into the table header.',
    },
    enter: inColumnsMenu(clickUntil(rootBoxOf, 'true')),
  },
]

/** ADR 0133, S2: дерево меню под вложенной шапкой — группа и флажок всех колонок. */
export const ColumnVisibilityNestedTree: StoryObj<StoryProps> = {
  name: 'Nested headers',
  parameters: {
    scenario: '0133/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Группы колонок в меню', en: 'Column groups in the menu' }}
      steps={NESTED_TREE}
      args={guideArgs(
        {
          enableColumnVisibility: true,
          headerNesting: 'nested',
          dataCount: 20,
          height: '360',
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    const elbows = () =>
      menuOf()!.querySelectorAll('[data-column-id] [data-tree-elbow]').length
    await step(NESTED_TREE[0].title.ru, async () => {
      await waitForRows(canvas)
    })
    await step(NESTED_TREE[1].title.ru, async () => {
      await guideNext(canvas)
      await waitForRows(canvas)
      await until(() => expect(rootBoxOf()).not.toBeNull())
      await until(() => expect(columnBoxOf('name')).not.toBeNull())
      await until(() => expect(elbows()).toBeGreaterThan(0))
      await settle()
    })
    await step(NESTED_TREE[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).not.toContain('firstName'))
      await until(() => expect(headIdsOf(canvas)).not.toContain('lastName'))
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'mixed'),
      )
      await settle()
    })
    await step(NESTED_TREE[3].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toContain('firstName'))
      await until(() =>
        expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true'),
      )
      await settle()
    })
  },
}
