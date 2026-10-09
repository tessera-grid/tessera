import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import {
  InfiniteScrollDemo,
  type InfiniteScrollDemoProps,
} from './demos/infiniteScrollDemos'

/**
 * Бесконечная прокрутка — лента (ADR 0081): у края грид просит блок, «сервер» с
 * задержкой отвечает, строки дописываются в конец. Сценарии — в панели «Демо».
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Data/Infinite scroll',
} satisfies Meta<StoryProps>

export default meta

const delayControl = {
  serverDelayMs: { control: { type: 'range', min: 0, max: 3000, step: 100 } },
  blockSize: { control: { type: 'range', min: 5, max: 200, step: 5 } },
} as const

const layout = { containerHeight: 600, height: 480, maxHeight: 480 }

export const InfiniteScroll: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Basic',
  // Известный итог: счётчик «Loaded N of M», aria-rowcount — итог сервера.
  args: { ...layout, serverDelayMs: 700, blockSize: 50 },
  argTypes: delayControl,
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}

export const InfiniteScrollUnknownTotal: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Unknown total',
  // Сервер говорит только «есть ещё»: счётчик без итога, aria-rowcount = -1.
  args: { ...layout, serverDelayMs: 700, blockSize: 50, knownTotal: false },
  argTypes: delayControl,
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}

export const InfiniteScrollErrors: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Errors',
  // Первая попытка каждого блока падает: строка ошибки, «Retry» повторяет.
  args: {
    ...layout,
    serverDelayMs: 500,
    blockSize: 50,
    failFirstAttempt: true,
  },
  argTypes: delayControl,
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}

export const InfiniteScrollServerQuery: StoryObj<InfiniteScrollDemoProps> = {
  name: 'Server sort & filter',
  // Сортировка, фильтры и поиск на сервере: смена условия — в начало, блок отменён.
  args: { ...layout, serverDelayMs: 700, blockSize: 50, serverQuery: true },
  argTypes: delayControl,
  render: args => <InfiniteScrollDemo {...normalizeArgs(args)} />,
}
