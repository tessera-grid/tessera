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
import { DemoStory, type DemoStoryStep, guideArgs } from './demos/DemoStory'
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

const NOT_REFRESH = 'Does not affect data refresh'

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

const DATA_UPDATE: readonly DemoStoryStep[] = [
  {
    title: { ru: 'Данные загружены', en: 'Data loaded' },
    hint: {
      ru: 'Таблица отображает данные, полученные от сервера.',
      en: 'The table shows the data received from the server.',
    },
  },
  {
    title: { ru: 'Обновление данных', en: 'Data refresh' },
    hint: {
      ru: 'Приложение запросило данные заново. Таблица находится в состоянии обновления, но остаётся доступной для взаимодействия.',
      en: 'The app requested the data again. The table is refreshing but stays available for interaction.',
    },
    props: () => ({ loading: 'refresh' }),
    states: ['body.refreshing'],
  },
  {
    title: { ru: 'Данные обновлены', en: 'Data refreshed' },
    hint: {
      ru: 'Сервер вернул данные. Таблица выходит из состояния обновления и отображает полученные данные.',
      en: 'The server returned the data. The table leaves the refreshing state and shows the data it received.',
    },
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
    <DemoStory
      title={{ ru: 'Обновление данных', en: 'Data refresh' }}
      steps={DATA_UPDATE}
      args={guideArgs({ dataCount: 50, height: '400' }, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    let before: string | undefined
    await step(DATA_UPDATE[0]!.title.ru, async () => {
      await waitForRows(canvas)
      before = firstRowId(canvas)
      await expect(refreshing(canvas)).toBe(false)
    })
    await step(DATA_UPDATE[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(true))
      await settle()
    })
    await step(DATA_UPDATE[2]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(false))
      await until(() => expect(firstRowId(canvas)).not.toBe(before))
      await settle()
    })
  },
}
