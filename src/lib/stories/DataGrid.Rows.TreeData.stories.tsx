import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until } from './__mocks__/catalogPlay'
import { expandAllType } from './__mocks__/utils/argTypes'
import { showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep } from './demos/GuideStory'

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

/**
 * `expandAll` без переключателя: условие меты прячет контрол без `rowExpanding`, а
 * аргумент под ложным условием до истории не доходит; снимает его только `null`.
 */
const EXPAND_ALL_CONTROL = {
  expandAll: { ...expandAllType, if: null as unknown as undefined },
}

// Мок: у `item-id-0` двое детей, у первого — свой ребёнок.
const ROOT = 'item-id-0'
const GRANDCHILD = 'item-id-0-0-0'

const rowOf = (canvas: HTMLElement, id: string) =>
  canvas.querySelector<HTMLElement>(`.data-grid__body-row[data-row-id="${id}"]`)
const expandColumn = (canvas: HTMLElement) =>
  canvas.querySelector('.data-grid__head-cell[data-column-id*="rowExpanding"]')
const lines = (canvas: HTMLElement) =>
  canvas.querySelectorAll('[data-tree-depth]').length

// --- S1 ------------------------------------------------------------------------------

const READ_ONLY = [
  {
    title: 'Данные — дерево',
    hint: 'Плагин rowExpandingModel: подстроки видны по состоянию expanded приложения. Пока оно пустое — одни корни.',
    props: () => ({ expandAll: false }),
  },
  {
    title: 'Приложение раскрывает всё',
    hint: 'expanded: true — видны все уровни с отступом. Переключателя нет: раскрытие задаёт приложение, а не пользователь.',
    props: () => ({ expandAll: true }),
  },
  {
    title: 'Линии дерева',
    hint: 'Плагин treeLines — ветки видны линиями: поворот к подстроке, продолжение к сестре, отросток у строки с подстроками.',
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
    ...showControls([
      'dataNesting',
      'enableRowExpandingModel',
      'enableTreeLines',
      'expandAll',
      'enableKeyboardNavigation',
    ]),
  },
  args: {
    ...FIXED_HEIGHT,
    dataNesting: 'nested',
    enableRowExpandingModel: true,
  },
  argTypes: EXPAND_ALL_CONTROL,
  render: args => (
    <GuideStory
      title="Дерево без переключателя"
      steps={READ_ONLY}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(READ_ONLY[0].title, async () => {
      await until(() => expect(rowOf(canvas, ROOT)).not.toBeNull())
      await expect(rowOf(canvas, GRANDCHILD)).toBeNull()
      await expect(expandColumn(canvas)).toBeNull()
    })
    await step(READ_ONLY[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(rowOf(canvas, GRANDCHILD)).not.toBeNull())
      await expect(expandColumn(canvas)).toBeNull()
      await expect(lines(canvas)).toBe(0)
    })
    await step(READ_ONLY[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(lines(canvas)).toBeGreaterThan(0))
    })
    await settle()
  },
}

// --- S2 ------------------------------------------------------------------------------

/** Нажимает переключатель строки, как пользователь. */
const toggleRoot = (root: HTMLElement) =>
  rowOf(root, ROOT)
    ?.querySelector<HTMLButtonElement>(
      '[data-column-id*="rowExpanding"] button',
    )
    ?.click()

const WITH_TOGGLE = [
  {
    title: 'Дерево с переключателем',
    hint: 'Плагин rowExpanding — колонка с кнопками раскрытия у строк с подстроками; treeLines рисует линии у раскрытых веток.',
  },
  {
    title: 'Пользователь раскрывает ветку',
    hint: 'Нажата кнопка первой строки: подстроки встают под ней, линии связывают их с родителем.',
    enter: toggleRoot,
  },
  {
    title: 'Пользователь сворачивает ветку',
    hint: 'Повторное нажатие сворачивает ветку: подстроки и их линии уходят, отросток у строки пропадает.',
    enter: toggleRoot,
  },
] as const satisfies readonly GuideStoryStep[]

/**
 * S2: дерево с переключателем и линиями — пользователь раскрывает и сворачивает ветки,
 * линии следуют. `rowExpandingMaxDepth` ограничивает раскрываемую глубину.
 */
export const TreeDataWithToggle: StoryObj<StoryProps> = {
  name: 'With toggle',
  parameters: {
    scenario: '0119/S2',
    ...showControls([
      'dataNesting',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'enableTreeLines',
      'enableKeyboardNavigation',
    ]),
  },
  args: {
    ...FIXED_HEIGHT,
    dataNesting: 'nested',
    enableRowExpanding: true,
    enableTreeLines: true,
  },
  render: args => (
    <GuideStory
      title="Дерево с переключателем"
      steps={WITH_TOGGLE}
      args={normalizeArgs(args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(WITH_TOGGLE[0].title, async () => {
      await until(() => expect(expandColumn(canvas)).not.toBeNull())
      await expect(lines(canvas)).toBe(0)
    })
    await step(WITH_TOGGLE[1].title, async () => {
      await guideNext(canvas)
      await until(() => expect(lines(canvas)).toBeGreaterThan(0))
    })
    await step(WITH_TOGGLE[2].title, async () => {
      await guideNext(canvas)
      await until(() => expect(lines(canvas)).toBe(0))
    })
    await settle()
  },
}
