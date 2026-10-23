import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { vrModes, vrStates } from './__mocks__/catalog'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Обновление данных (ADR 0094): пока приложение запрашивает данные заново, таблица в
 * состоянии обновления и остаётся рабочей. `Playground` — песочница, S1 — сценарий.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Refresh',
} satisfies Meta<StoryProps>

export default meta

const NOT_REFRESH = 'На обновление данных не влияет'

const refreshing = (root: ParentNode) =>
  !!root.querySelector('[data-refreshing] .data-grid__loader')

/** Таблица в состоянии обновления; режимы осей — в снимках каталога. */
export const RefreshPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  tags: ['vr-modes'],
  parameters: {
    ...vrModes(vrStates('body.refreshing')),
    ...showControls(['loading', 'refreshOptions', 'enableFooter'], {
      columnCount: NOT_REFRESH,
      dataCount: NOT_REFRESH,
      containerHeight: NOT_REFRESH,
      height: NOT_REFRESH,
      maxHeight: NOT_REFRESH,
      rowHeight: NOT_REFRESH,
      headerHeight: NOT_REFRESH,
      defaultColumn: NOT_REFRESH,
    }),
  },
  args: { loading: 'refresh' },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    await waitForRows(canvasElement)
    await until(() => expect(refreshing(canvasElement)).toBe(true))
    await settle()
  },
}

// --- S1 ------------------------------------------------------------------------------

const firstRowId = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.data-grid__body-row')?.dataset.rowId

const DATA_UPDATE: readonly GuideStoryStep[] = [
  {
    title: 'Данные загружены',
    hint: 'Таблица отображает данные, полученные от сервера.',
  },
  {
    title: 'Обновление данных',
    hint: 'Приложение запросило данные заново. Таблица находится в состоянии обновления, но остаётся доступной для взаимодействия.',
    props: () => ({ loading: 'refresh' }),
    states: ['body.refreshing'],
  },
  {
    title: 'Данные обновлены',
    hint: 'Сервер вернул данные. Таблица выходит из состояния обновления и отображает полученные данные.',
    props: ({ rows }) => ({
      loading: false,
      dataOverride: [...rows].reverse(),
    }),
  },
]

/** S1: приложение обновляет данные, таблица остаётся рабочей и показывает ответ. */
export const RefreshDataUpdate: StoryObj<StoryProps> = {
  name: 'Data update',
  parameters: {
    scenario: '0094/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Обновление данных"
      steps={DATA_UPDATE}
      args={guideArgs({ dataCount: 50, height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    let before: string | undefined
    await step(DATA_UPDATE[0]!.title, async () => {
      await waitForRows(canvas)
      before = firstRowId(canvas)
      await expect(refreshing(canvas)).toBe(false)
    })
    await step(DATA_UPDATE[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(true))
      await settle()
    })
    await step(DATA_UPDATE[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(false))
      await until(() => expect(firstRowId(canvas)).not.toBe(before))
      await settle()
    })
  },
}
