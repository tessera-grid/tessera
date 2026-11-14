import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import {
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

/**
 * Дерево (ADR 0119): модель `rowExpandingModel` показывает подстроки по `expanded` приложения,
 * `rowExpanding` добавляет переключатель, `treeLines` — линии. По истории на клиентский
 * сценарий S1–S2; шаги — панелью над гридом, в тестах их проходит `play` (ADR 0117, §6).
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Rows/Tree data',
} satisfies Meta<StoryProps>

export default meta

const FIXED_HEIGHT = {
  containerHeight: '600',
  height: '500',
  maxHeight: '500',
} as const

// Мок: у `item-id-0` двое детей, у первого — свой ребёнок.
const ROOT = 'item-id-0'
const CHILD = 'item-id-0-0'
const GRANDCHILD = 'item-id-0-0-0'

const rowOf = (canvas: HTMLElement, id: string) =>
  canvas.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const expandColumn = (canvas: HTMLElement) =>
  canvas.querySelector('.data-grid__head-cell[data-column-id*="rowExpanding"]')
/** Левый край текста первой ячейки строки: отступ уровня его сдвигает. */
const textLeft = (row: HTMLElement) => {
  const walker = document.createTreeWalker(
    row.querySelector('[role="gridcell"], [role="cell"]')!,
    NodeFilter.SHOW_TEXT,
    { acceptNode: node => (node.textContent?.trim() ? 1 : 2) },
  )
  const range = document.createRange()
  range.selectNodeContents(walker.nextNode()!)
  return range.getBoundingClientRect().left
}
const lines = (canvas: HTMLElement) =>
  canvas.querySelectorAll('[data-tree-depth]').length

/** Дерево с переключателем и линиями; `expandAll` раскрывает все уровни, `rowExpandingMaxDepth` ограничивает глубину. */
export const TreeDataPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls([
    'dataNesting',
    'enableRowExpanding',
    'rowExpandingMaxDepth',
    'expandAll',
    'enableTreeLines',
    'enableKeyboardNavigation',
  ]),
  args: {
    ...FIXED_HEIGHT,
    dataNesting: 'nested',
    enableRowExpanding: true,
    enableTreeLines: true,
  },
}

// --- S1 ------------------------------------------------------------------------------

const READ_ONLY = [
  {
    title: { ru: 'Корни дерева', en: 'Tree roots' },
    hint: {
      ru: 'Таблица получила иерархические данные, раскрытием управляет приложение. Пока ничего не раскрыто, видны только строки верхнего уровня.',
      en: 'The table received hierarchical data, and the app controls expansion. Nothing is expanded yet, so only top-level rows are visible.',
    },
    props: () => ({ expandAll: false }),
  },
  {
    title: {
      ru: 'Приложение раскрывает всё',
      en: 'The app expands everything',
    },
    hint: {
      ru: 'Приложение раскрыло все уровни. Таблица показывает подстроки с отступом по глубине. Кнопок раскрытия нет: раскрытие задаёт приложение, а не пользователь.',
      en: 'The app expanded every level. The table shows child rows indented by depth. There are no expand buttons: expansion is set by the app, not the user.',
    },
    props: () => ({ expandAll: true }),
  },
  {
    title: {
      ru: 'Приложение включает линии дерева',
      en: 'The app turns on tree lines',
    },
    hint: {
      ru: 'Ветки связаны линиями: поворот к подстроке, продолжение к следующей строке того же уровня, отросток у строки с подстроками.',
      en: 'Lines connect the branches: a turn to each child row, a continuation to the next row at the same level, and a stub under a row with child rows.',
    },
    props: () => ({ enableTreeLines: true }),
  },
] as const satisfies readonly GuideStoryStep[]

/**
 * S1: иерархия развёрнута приложением, без переключателя — справочник или структура,
 * где раскрытие не меняют. Включите `enableKeyboardNavigation` — роль `treegrid`.
 */
export const TreeDataReadOnly: StoryObj<StoryProps> = {
  name: 'Read only',
  parameters: {
    scenario: '0119/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Дерево без переключателя', en: 'A tree without a toggle' }}
      steps={READ_ONLY}
      args={guideArgs(
        {
          ...FIXED_HEIGHT,
          dataNesting: 'nested',
          enableRowExpandingModel: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(READ_ONLY[0].title.ru, async () => {
      await until(() => expect(rowOf(canvas, ROOT)).not.toBeNull())
      await expect(rowOf(canvas, GRANDCHILD)).toBeNull()
      await expect(expandColumn(canvas)).toBeNull()
    })
    await step(READ_ONLY[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(rowOf(canvas, GRANDCHILD)).not.toBeNull())
      await expect(textLeft(rowOf(canvas, GRANDCHILD)!)).toBeGreaterThan(
        textLeft(rowOf(canvas, CHILD)!),
      )
      await expect(textLeft(rowOf(canvas, CHILD)!)).toBeGreaterThan(
        textLeft(rowOf(canvas, ROOT)!),
      )
      await expect(expandColumn(canvas)).toBeNull()
      await expect(lines(canvas)).toBe(0)
    })
    await step(READ_ONLY[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(lines(canvas)).toBeGreaterThan(0))
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

const toggleOf = (root: HTMLElement, id: string) =>
  rowOf(root, id)?.querySelector<HTMLButtonElement>(
    '[data-column-id*="rowExpanding"] button',
  )

/** Пользователь нажимает переключатель строки `id`, пока она не станет `expanded`. */
const expandRow = async (
  root: HTMLElement,
  id: string,
  expanded: boolean,
  signal: AbortSignal,
) => {
  await pollUntil(() => !!toggleOf(root, id), signal)
  if (
    (toggleOf(root, id)!.getAttribute('aria-expanded') === 'true') !==
    expanded
  )
    toggleOf(root, id)!.click()
  await pollUntil(
    () =>
      (toggleOf(root, id)?.getAttribute('aria-expanded') === 'true') ===
      expanded,
    signal,
  )
}

const WITH_TOGGLE = [
  {
    title: { ru: 'Дерево с переключателем', en: 'A tree with a toggle' },
    hint: {
      ru: 'Ветки раскрывает сам пользователь: у строк с подстроками есть кнопка раскрытия. Пока ветки свёрнуты, линий нет.',
      en: 'The user expands branches: rows with child rows have an expand button. While the branches are collapsed, there are no lines.',
    },
  },
  {
    title: {
      ru: 'Пользователь раскрывает ветку',
      en: 'The user expands a branch',
    },
    states: ['body.treeLines'],
    hint: {
      ru: 'Пользователь нажал кнопку раскрытия первой строки. Подстроки встают под ней, линии связывают их с родителем.',
      en: "The user pressed the first row's expand button. Its child rows appear below it, and lines connect them to the parent.",
    },
    enter: stepAction(async (root, { signal }) => {
      await expandRow(root, ROOT, true, signal)
      await expandRow(root, CHILD, false, signal)
    }),
  },
  {
    title: {
      ru: 'Пользователь раскрывает вложенную ветку',
      en: 'The user expands a nested branch',
    },
    states: ['body.treeLines'],
    hint: {
      ru: 'Пользователь раскрыл подстроку первой строки. Под ней встаёт следующий уровень, линии продолжаются вглубь.',
      en: 'The user expanded a child row of the first row. The next level appears below it, and the lines continue deeper.',
    },
    enter: stepAction(async (root, { signal }) => {
      await expandRow(root, ROOT, true, signal)
      await expandRow(root, CHILD, true, signal)
    }),
  },
] as const satisfies readonly GuideStoryStep[]

/**
 * S2: дерево с переключателем и линиями — пользователь раскрывает ветку и вложенную
 * ветку, линии следуют. Раскрываются два уровня (`rowExpandingMaxDepth: 2`).
 */
export const TreeDataWithToggle: StoryObj<StoryProps> = {
  name: 'With toggle',
  parameters: {
    scenario: '0119/S2',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Дерево с переключателем', en: 'A tree with a toggle' }}
      steps={WITH_TOGGLE}
      args={guideArgs(
        {
          ...FIXED_HEIGHT,
          dataNesting: 'nested',
          enableRowExpanding: true,
          rowExpandingMaxDepth: 2,
          enableTreeLines: true,
        },
        args,
      )}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WITH_TOGGLE[0].title.ru, async () => {
      await until(() => expect(expandColumn(canvas)).not.toBeNull())
      await expect(lines(canvas)).toBe(0)
    })
    await step(WITH_TOGGLE[1].title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(lines(canvas)).toBeGreaterThan(0))
      await expect(rowOf(canvas, CHILD)).not.toBeNull()
      await expect(rowOf(canvas, GRANDCHILD)).toBeNull()
    })
    await step(WITH_TOGGLE[2].title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      await until(() => expect(rowOf(canvas, GRANDCHILD)).not.toBeNull())
      await expect(
        rowOf(canvas, GRANDCHILD)!.querySelector('[data-tree-depth]'),
      ).not.toBeNull()
    })
    await settle()
  },
}
