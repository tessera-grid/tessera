import { useMemo, useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Ошибка загрузки данных (ADR 0096): при данных — сообщение под шапкой и индикатор
 * ошибки, без данных — заглушка ошибки; повтор — `onRetry`. `Playground` — песочница,
 * S1–S2 — сценарии.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data loading/Load error',
  argTypes: {
    ...dataGridMeta.argTypes,
    loadError: { control: false },
    onRetry: { control: false },
    stubs: { control: false },
  },
} satisfies Meta<StoryProps>

export default meta

const banner = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const stub = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-testid="load-error-stub"]')
const dataRows = (root: ParentNode) =>
  root.querySelectorAll(
    '.data-grid__body-row:not(.data-grid__body-row--skeleton)',
  )
const refreshing = (root: ParentNode) =>
  !!root.querySelector('.data-grid-theme[data-refreshing]')

const SERVER_ERROR = new Error('Server responded 503 Service Unavailable')
const NOT_LOAD_ERROR = 'На ошибку загрузки не влияет'

/** Повтор приложения: ответ на него ведёт «сервер» обвязки (`retrySucceeds`). */
const retry = () => {}

interface LoadErrorPlaygroundArgs extends StoryProps {
  /** Причина ошибки загрузки; пусто — ошибки нет. */
  errorReason?: string
  /** Данных нет. */
  firstLoad?: boolean
  /** Повтор загрузки: без него у сообщения и заглушки нет кнопки повтора. */
  retryable?: boolean
}

/** Ошибка при данных и без них, с повтором и без; повтор «сервер» проводит успешно. */
export const LoadErrorPlayground: StoryObj<LoadErrorPlaygroundArgs> = {
  name: 'Playground',
  parameters: showControls(
    ['errorReason', 'firstLoad', 'retryable', 'loading', 'enableFooter'],
    {
      columnCount: NOT_LOAD_ERROR,
      dataCount: NOT_LOAD_ERROR,
      containerHeight: NOT_LOAD_ERROR,
      maxHeight: NOT_LOAD_ERROR,
      rowHeight: NOT_LOAD_ERROR,
      headerHeight: NOT_LOAD_ERROR,
      defaultColumn: NOT_LOAD_ERROR,
    },
  ),
  args: {
    errorReason: SERVER_ERROR.message,
    firstLoad: false,
    retryable: true,
  },
  argTypes: {
    errorReason: {
      control: 'text',
      description: 'Причина ошибки загрузки, пусто — ошибки нет',
    },
    firstLoad: { control: 'boolean', description: 'Данных нет' },
    retryable: { control: 'boolean', description: 'Повтор загрузки' },
  },
  render: function Render({ errorReason, firstLoad, retryable, ...args }) {
    const [consoleLog] = useState(createConsoleLog)
    // Одна ошибка на причину: новая ошибка — новое значение `loadError` (LE6).
    const loadError = useMemo(
      () => (errorReason ? new Error(errorReason) : undefined),
      [errorReason],
    )
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent
          {...normalizeArgs(args)}
          {...(firstLoad ? { dataOverride: [] } : {})}
          loadError={loadError}
          onRetry={retryable ? retry : undefined}
          retrySucceeds
        />
      </WithConsole>
    )
  },
}

/**
 * Нажать кнопку повтора, как пользователь, когда она появилась. Ждёт таймером, а не
 * кадрами: в фоновой вкладке кадров нет. Уход с шага ожидание прерывает.
 */
const pressRetry = (root: HTMLElement) => {
  let left = false
  const run = () => {
    if (left) return
    const button = root.querySelector<HTMLElement>(
      '[data-testid="load-error-retry"]',
    )
    if (button) button.click()
    else setTimeout(run, 50)
  }
  setTimeout(run, 0)
  return () => {
    left = true
  }
}

/** Таблица сценариев: «сервер» обвязки отвечает на повтор. */
const SCENARIO_ARGS = {
  dataCount: 50,
  height: '400',
  onRetry: retry,
  retrySucceeds: true,
} satisfies Partial<StoryProps>

// --- S1 ------------------------------------------------------------------------------

const REFRESH_ERROR: readonly GuideStoryStep[] = [
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
    title: 'Ошибка обновления',
    hint: 'Сервер не смог вернуть данные. Таблица показывает индикатор ошибки и сообщение с причиной и возможностью повторить запрос; ранее загруженные данные остаются доступны.',
    props: () => ({ loading: false, loadError: SERVER_ERROR }),
    states: ['body.loadError'],
  },
  {
    title: 'Повторный запрос',
    hint: 'Пользователь повторил запрос. Данные обновлены, сообщение об ошибке скрыто.',
    enter: pressRetry,
  },
]

/** S1: обновление данных упало, пользователь повторяет запрос. */
export const LoadErrorRefresh: StoryObj<StoryProps> = {
  name: 'Refresh error',
  parameters: {
    scenario: '0096/S1',
    requirements: ['LE16'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ошибка обновления"
      steps={REFRESH_ERROR}
      args={guideArgs(SCENARIO_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(REFRESH_ERROR[0]!.title, async () => {
      await waitForRows(canvas)
      await until(() => expect(banner(canvas)).toBeNull())
    })
    await step(REFRESH_ERROR[1]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(refreshing(canvas)).toBe(true))
      await until(() => expect(dataRows(canvas).length).toBeGreaterThan(0))
      await settle()
    })
    await step(REFRESH_ERROR[2]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(banner(canvas)).toHaveTextContent('Server responded 503'),
      )
      await until(() => expect(dataRows(canvas).length).toBeGreaterThan(0))
      // Индикатор ошибки догорает — состояние в покое.
      await until(() =>
        expect(canvas.querySelector('[data-error-flash]')).toBeNull(),
      )
      await settle()
    })
    await step(REFRESH_ERROR[3]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(banner(canvas)).toBeNull())
      await until(() => expect(refreshing(canvas)).toBe(false))
      await until(() => expect(dataRows(canvas).length).toBeGreaterThan(0))
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

const FIRST_LOAD_ERROR: readonly GuideStoryStep[] = [
  {
    title: 'Ожидание данных от сервера',
    hint: 'Данных ещё нет. Тело таблицы находится в состоянии загрузки.',
    props: () => ({ loading: 'initial', dataOverride: [] }),
  },
  {
    title: 'Ошибка загрузки',
    hint: 'Сервер не смог вернуть данные. Вместо строк отображается заглушка с причиной ошибки и возможностью повторить запрос.',
    props: () => ({ loading: false, loadError: SERVER_ERROR }),
    states: ['body.loadFailed'],
  },
  {
    title: 'Повторный запрос',
    hint: 'Пользователь повторил запрос. Данные получены и отображаются на месте заглушки.',
    enter: pressRetry,
  },
]

/** S2: первая загрузка упала, пользователь повторяет запрос. */
export const LoadErrorFirstLoad: StoryObj<StoryProps> = {
  name: 'First load error',
  parameters: {
    scenario: '0096/S2',
    requirements: ['LE21'],
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title="Ошибка первой загрузки"
      steps={FIRST_LOAD_ERROR}
      args={guideArgs(SCENARIO_ARGS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    await step(FIRST_LOAD_ERROR[0]!.title, async () => {
      await until(() =>
        expect(
          canvas.querySelector('.data-grid__body-row--skeleton'),
        ).not.toBeNull(),
      )
      await expect(stub(canvas)).toBeNull()
    })
    await step(FIRST_LOAD_ERROR[1]!.title, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(stub(canvas)).toHaveTextContent('Server responded 503'),
      )
      await expect(dataRows(canvas)).toHaveLength(0)
      await settle()
    })
    await step(FIRST_LOAD_ERROR[2]!.title, async () => {
      await guideNext(canvas)
      await until(() => expect(dataRows(canvas).length).toBeGreaterThan(0))
      await expect(stub(canvas)).toBeNull()
      await settle()
    })
  },
}
