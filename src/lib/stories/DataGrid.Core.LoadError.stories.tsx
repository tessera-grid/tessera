import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent } from 'storybook/test'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { settle, until, waitForRows } from './__mocks__/catalogPlay'
import { vrStates } from './__mocks__/catalog'

/**
 * Ошибка загрузки данных (ADR 0096): `loadError` при данных — плашка под шапкой и
 * красный свет, без данных — заглушка ошибки. «Retry» вызывает `onRetry`.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core/Load error',
  argTypes: {
    ...dataGridMeta.argTypes,
    loadError: { control: false },
    onRetry: { control: false },
    errorStub: { control: false },
  },
} satisfies Meta<StoryProps>

export default meta

const banner = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const stub = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>('[data-testid="load-error-stub"]')

const SERVER_ERROR = new Error('Server responded 503 Service Unavailable')

/** Обновление упало: старые строки на месте и рабочие, плашка с причиной и «Retry». */
export const LoadErrorRefresh: StoryObj<StoryProps> = {
  name: 'Refresh error',
  parameters: vrStates('body.loadError'),
  args: {
    loadError: SERVER_ERROR,
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    await until(() =>
      expect(banner(canvasElement)).toHaveTextContent('Server responded 503'),
    )
    await settle()
  },
}

/** Длинная причина: плашка не шире `--tsr-comp-load-error-banner-max-width`, причина — с `…` и тултипом. */
export const LoadErrorLongReason: StoryObj<StoryProps> = {
  name: 'Refresh error — long reason',
  args: {
    loadError: new Error(
      'Gateway timeout: the reporting service did not answer within 30 seconds while aggregating orders for the selected period; try a shorter period or retry later',
    ),
    onRetry: fn(),
  },
}

/** Первая загрузка упала: данных нет — заглушка ошибки вместо скелета. */
export const LoadErrorFirstLoad: StoryObj<StoryProps> = {
  name: 'First load error',
  parameters: vrStates('body.loadFailed'),
  args: {
    dataOverride: [],
    loadError: SERVER_ERROR,
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    await until(() =>
      expect(stub(canvasElement)).toHaveTextContent("Couldn't load the data"),
    )
    await settle()
  },
}

/** Своя заглушка: `errorStub` получает ошибку и повтор. */
export const LoadErrorCustomStub: StoryObj<StoryProps> = {
  name: 'Custom error stub',
  args: {
    dataOverride: [],
    loadError: SERVER_ERROR,
    onRetry: fn(),
    errorStub: ({ error, retry }) => (
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        <strong>Reports are unavailable</strong>
        <span>{(error as Error).message}</span>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    await until(() =>
      expect(stub(canvasElement)).toHaveTextContent('Reports are unavailable'),
    )
    await settle()
  },
}

/** Сервер на кнопках: обновление идёт 1,5 с и падает или проходит; «Retry» — успешно. */
const ServerDemo = (args: StoryProps) => {
  const [state, setState] = useState<{ loading: boolean; error: Error | null }>(
    { loading: false, error: null },
  )
  const refresh = (fail: boolean) => {
    setState(current => ({ ...current, loading: true }))
    setTimeout(
      () =>
        setState({
          loading: false,
          error: fail
            ? new Error('Server responded 503 Service Unavailable')
            : null,
        }),
      1500,
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 0' }}>
        <button type="button" onClick={() => refresh(true)}>
          Refresh — fail
        </button>
        <button type="button" onClick={() => refresh(false)}>
          Refresh — succeed
        </button>
      </div>
      <StoryComponent
        {...args}
        enableLoading={state.loading}
        loadError={state.error}
        onRetry={() => refresh(false)}
      />
    </div>
  )
}

/** Синее свечение обновления перерастает в красное при отказе; «Retry» — повтор. */
export const LoadErrorServer: StoryObj<StoryProps> = {
  name: 'Refresh error — server',
  render: args => <ServerDemo {...normalizeArgs(args)} />,
  // Дымовой сценарий (ADR 0096, LE16): отказ обновления — плашка с причиной; «Retry»
  // убирает её, повтор успешен — плашки нет.
  parameters: { requirements: ['LE16'] },
  play: async ({ canvasElement }) => {
    await waitForRows(canvasElement)
    const button = (text: string) =>
      [...canvasElement.querySelectorAll<HTMLButtonElement>('button')].find(
        el => el.textContent === text,
      )!
    await userEvent.click(button('Refresh — fail'))
    await until(() =>
      expect(banner(canvasElement)).toHaveTextContent('Server responded 503'),
    )
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        '[data-testid="load-error-retry"]',
      )!,
    )
    await until(() => expect(banner(canvasElement)).toBeNull())
    await until(() =>
      expect(
        canvasElement
          .querySelector('.data-grid-theme')!
          .hasAttribute('data-refreshing'),
      ).toBe(false),
    )
    expect(banner(canvasElement)).toBeNull()
    await settle()
  },
}
