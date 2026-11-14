import { Meta, StoryObj } from '@storybook/react'

import { infiniteScrollLabels } from '../plugins/infiniteScroll/labels'
import { LoadMoreError } from '../ui/LoadMoreError/LoadMoreError'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Строка ошибки загрузки строк (ADR 0081, ADR 0138): в конце ленты или на месте отказавшего
 * блока серверной модели — значок, причина и повтор по центру видимой ширины. Тот же блок без
 * строки — в списке вариантов поповера (история Checklist «Loading, empty and error»). Подписи и причина — в
 * панели.
 */
interface LoadMoreErrorStoryArgs {
  /** Пусто — заголовок отказа ленты из словаря таблицы. */
  title?: string
  reason: string
  /** Пусто — подпись повтора из словаря таблицы. */
  retryLabel?: string
}

const meta = {
  title: 'Tessera/UI/LoadMoreError',
  args: {
    reason: 'The server did not answer in 30 seconds.',
  },
  argTypes: {
    title: { control: 'text', description: 'Error title' },
    reason: {
      control: 'text',
      description: 'Reason; empty means no reason',
    },
    retryLabel: { control: 'text', description: 'Retry label' },
  },
  render: function Render({ title, reason, retryLabel }) {
    const labels = useStoryLabels()
    return (
      <UiCanvas>
        <div
          role="table"
          aria-label="Rows"
          style={{
            width: 520,
            overflow: 'hidden',
            border:
              'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
            borderRadius: 'var(--tsr-comp-frame-radius)',
            background: 'var(--tsr-comp-row-bg)',
            fontSize: 'var(--tsr-comp-cell-font-size)',
          }}
        >
          <div role="rowgroup">
            <LoadMoreError
              title={title || infiniteScrollLabels(labels).loadMoreFailed}
              reason={reason || undefined}
              retryLabel={retryLabel || labels.loadMoreRetry}
              onRetry={() => {}}
              navigable={false}
            />
          </div>
        </div>
      </UiCanvas>
    )
  },
} satisfies Meta<LoadMoreErrorStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const LoadMoreErrorPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('title', 'reason', 'retryLabel'),
}

/** Причина длиннее строки: обрезается многоточием, полный текст — в подсказке. */
export const LoadMoreErrorLongReason: Story = {
  name: 'Long reason',
  parameters: noControls(),
  args: {
    reason:
      'The server refused the request: the session expired while the rows were loading, sign in again and retry.',
  },
}
