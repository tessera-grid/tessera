import { Meta, StoryObj } from '@storybook/react'

import { filteringLabels } from '../shared/filtering/labels'
import { StatusBarCount } from '../ui/StatusBarCount/StatusBarCount'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Счётчик нижней панели (ADR 0083, TX6–TX7): в полном виде панели — полная форма, в
 * компактном — короткая; вспомогательные технологии всегда читают полную. Формы и вид панели —
 * в панели.
 */
interface StatusBarCountStoryArgs {
  /** Пусто — «показано 12 из 1000» из словаря таблицы. */
  full?: string
  /** Пусто — короткая форма из словаря таблицы. */
  short?: string
  layout: 'full' | 'compact'
}

const meta = {
  title: 'Tessera/UI/StatusBarCount',
  args: {
    layout: 'full',
  },
  argTypes: {
    full: { control: 'text', description: 'Полная форма' },
    short: { control: 'text', description: 'Короткая форма' },
    layout: {
      control: 'inline-radio',
      options: ['full', 'compact'],
      description: 'Вид нижней панели: полный или компактный (узкая таблица)',
    },
  },
  render: function Render({ full, short, layout }) {
    const filtering = filteringLabels(useStoryLabels())
    return (
      <UiCanvas>
        {/* Нижняя панель грида: высота, поля, кегль и фон — её токены. */}
        <div
          data-status-bar-layout={layout}
          style={{
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            width: layout === 'full' ? 480 : 240,
            height: 'var(--tsr-comp-status-bar-height)',
            padding: '0 var(--tsr-comp-status-bar-padding-x)',
            gap: 'var(--tsr-comp-status-bar-gap)',
            fontSize: 'var(--tsr-comp-status-bar-font-size)',
            background: 'var(--tsr-comp-status-bar-bg)',
            border:
              'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
            borderRadius: 'var(--tsr-comp-frame-radius)',
          }}
        >
          <StatusBarCount
            full={full || filtering.filteredRows(12, 1000)}
            short={short || filtering.filteredRowsShort(12, 1000)}
          />
        </div>
      </UiCanvas>
    )
  },
} satisfies Meta<StatusBarCountStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const StatusBarCountPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('full', 'short', 'layout'),
}

/** Узкая таблица: панель компактна, счётчик — короткой формой. */
export const StatusBarCountCompact: Story = {
  name: 'Compact',
  parameters: noControls(),
  args: { layout: 'compact' },
}
