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
    // Кнопка «Колонки» в тулбаре: поиск, флажок всех колонок, дерево, счётчик и «Сбросить».
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
 * Шаг в меню «Колонки», как у пользователя: меню открыто — сразу, иначе сначала нажатие
 * на кнопку тулбара. `reach` делает одно нажатие к состоянию шага и возвращает `true`,
 * когда оно достигнуто: шаг приходит к своему состоянию из любого — после отката гайда
 * и при переходе нажатием на шаг (ADR 0117, SN24, SN33).
 */
const inColumnsMenu =
  (reach: () => boolean = () => true) =>
  (root: HTMLElement) => {
    let clicks = 0
    const run = () => {
      if (menuOf()?.hasAttribute('data-open')) {
        if (reach() || ++clicks > 10) return
      } else {
        const button = root.querySelector<HTMLElement>(
          '[data-testid="column-visibility-button"]',
        )
        if (button?.hasAttribute('data-base-ui-click-trigger') && !menuOf())
          button.click()
      }
      requestAnimationFrame(run)
    }
    requestAnimationFrame(run)
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
    title: 'Меню видимости колонок',
    hint: 'Над списком колонок — флажок всех колонок, колонки под ним сдвинуты на уровень. Внизу — сколько колонок выбрано.',
    states: ['overlay.columns'],
    enter: inColumnsMenu(),
  },
  {
    title: 'Пользователь скрыл все колонки',
    hint: 'Флажок всех колонок снят. В таблице отображается заглушка, выбрано ноль колонок.',
    enter: inColumnsMenu(clickUntil(rootBoxOf, 'false')),
  },
  {
    title: 'Пользователь вернул одну колонку',
    hint: 'Флажок всех колонок — в промежуточном состоянии, в таблице одна колонка.',
    enter: inColumnsMenu(onlyColumn('firstName')),
  },
  {
    title: 'Пользователь показал все колонки',
    hint: 'Нажатие на промежуточный флажок показывает все колонки: таблица снова целиком.',
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
      title="Все колонки одним флажком"
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
    await step(TOGGLE_ALL[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rootBoxOf()).not.toBeNull())
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true')
      await expect(count()).toBe(
        columnVisibilityLabels(labels).selectedColumns(5),
      )
      await settle()
    })
    await step(TOGGLE_ALL[1].title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(
          canvas.querySelector('[data-testid="columns-hidden-stub"]'),
        ).not.toBeNull(),
      )
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'false')
      await expect(count()).toBe(
        columnVisibilityLabels(labels).selectedColumns(0),
      )
      await settle()
    })
    await step(TOGGLE_ALL[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toEqual(['firstName']))
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'mixed')
      await settle()
    })
    await step(TOGGLE_ALL[3].title, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toHaveLength(5))
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true')
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
    title: 'Меню колонок в заголовках',
    hint: 'У заголовка — кнопка меню колонки, над таблицей — кнопка списка колонок.',
  },
  {
    title: 'Пользователь открыл меню колонки',
    hint: 'В меню — действие «скрыть колонку».',
    states: ['overlay.menu'],
    enter: untilDone(() => !!hideItem(), openColumnMenu),
  },
  {
    title: 'Пользователь скрыл колонку',
    hint: 'Колонка ушла из таблицы, соседние сдвинулись на её место.',
    enter: untilDone(root => !headCell(root, HIDDEN), hideFromMenu),
  },
  {
    title: 'Пользователь вернул колонку',
    hint: 'В списке колонок над таблицей пользователь снова отметил скрытую колонку — она вернулась на своё место.',
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
          root
            .querySelector<HTMLElement>(
              '[data-testid="column-visibility-button"]',
            )
            ?.click()
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
      title="Скрытие колонки из её меню"
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
    await step(HEADER_MENU[0]!.title, async () => {
      await waitForRows(canvas)
      initial = headIdsOf(canvas)
      await expect(initial).toContain(HIDDEN)
      await until(() => expect(kebabOf(canvas)).not.toBeNull())
    })
    await step(HEADER_MENU[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(hideItem()).not.toBeNull())
      await settle()
    })
    await step(HEADER_MENU[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(headIdsOf(canvas)).toEqual(initial.filter(id => id !== HIDDEN)),
      )
    })
    await step(HEADER_MENU[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toEqual(initial))
      await settle()
    })
  },
}

// --- ADR 0133 S2 ---------------------------------------------------------------------

const NESTED_TREE: readonly GuideStoryStep[] = [
  {
    title: 'Дерево колонок вложенной шапки',
    hint: 'Колонки в меню сгруппированы, как в шапке таблицы. Флажок всех колонок, группы и их колонки соединены линиями дерева.',
    enter: inColumnsMenu(),
  },
  {
    title: 'Пользователь скрыл группу',
    hint: 'Галочка группы скрывает все её колонки: группы больше нет в шапке, флажок всех колонок — в промежуточном состоянии.',
    enter: inColumnsMenu(onlyGroupHidden('name')),
  },
  {
    title: 'Пользователь показал все колонки',
    hint: 'Флажок всех колонок возвращает группу в шапку таблицы.',
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
      title="Группы колонок в меню"
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
    await step(NESTED_TREE[0].title, async () => {
      await waitForRows(canvas)
      await until(() => expect(rootBoxOf()).not.toBeNull())
      await expect(columnBoxOf('name')).not.toBeNull()
      await expect(elbows()).toBeGreaterThan(0)
      await settle()
    })
    await step(NESTED_TREE[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).not.toContain('firstName'))
      await expect(headIdsOf(canvas)).not.toContain('lastName')
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'mixed')
      await settle()
    })
    await step(NESTED_TREE[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(headIdsOf(canvas)).toContain('firstName'))
      await expect(rootBoxOf()).toHaveAttribute('aria-checked', 'true')
      await settle()
    })
  },
}
