import { type ReactNode, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { Checklist, ChecklistStatus } from '../ui/Checklist/Checklist'
import { Popover } from '@base-ui/react/popover'

import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Список вариантов с флажками (ADR 0183, PK6) — в поповере, как в таблице: панель фильтра колонки
 * с вариантами (Filtering — Select & multiselect) и редактор нескольких вариантов (Columns/Data
 * types/Multi select). Виртуализирован, стрелки ходят по всему списку, у фильтра — счётчики
 * строк. Число вариантов и счётчики — в панели.
 */
interface ChecklistStoryArgs {
  count: number
  counts: boolean
}

/** Подписи загрузки, пустого списка и отказа — как у панели фильтра вариантов. */
const useStatusLabels = () => {
  const filtering = columnFilteringLabels(useStoryLabels())
  return {
    loading: filtering.filterLoadingOptions,
    empty: filtering.filterNoOptions,
    error: filtering.filterOptionsError,
    retry: filtering.filterRetry,
  }
}

const optionsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    value: `option-${index}`,
    label:
      index === 2
        ? 'A very long option label that does not fit'
        : `Option ${index + 1}`,
  }))

/** Список — в поповере шириной меню колонки, как в панели фильтра. */
const InPopover = ({ children }: { children: ReactNode }) => (
  <PopupCanvas>
    <Popover.Portal>
      <PopupSurface
        positioner={<Popover.Positioner side="bottom" align="start" />}
        popup={
          <Popover.Popup
            aria-label="Options"
            initialFocus={false}
            style={{ width: 'var(--tsr-comp-column-menu-width)' }}
          />
        }
      >
        {children}
      </PopupSurface>
    </Popover.Portal>
  </PopupCanvas>
)

const ChecklistStory = ({ count, counts }: ChecklistStoryArgs) => {
  const options = optionsOf(count)
  const [selected, setSelected] = useState<string[]>(['option-0'])
  return (
    <InPopover>
      <Checklist
        id="story-checklist"
        options={options}
        isSelected={value => selected.includes(value)}
        onToggle={(value, checked) =>
          setSelected(current =>
            checked
              ? [...current, value]
              : current.filter(item => item !== value),
          )
        }
        label="Status"
        counts={
          counts
            ? new Map(options.map((option, index) => [option.value, index * 7]))
            : undefined
        }
        testId="story-checklist"
      />
    </InPopover>
  )
}

const meta = {
  title: 'Tessera/UI/Checklist',
  args: { count: 12, counts: true },
  argTypes: {
    count: {
      control: { type: 'number', min: 0, max: 1000 },
      description: 'Вариантов',
    },
    counts: { control: 'boolean', description: 'Счётчики строк' },
  },
  render: args => <ChecklistStory {...args} />,
} satisfies Meta<ChecklistStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const ChecklistPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('count', 'counts'),
}

/** Загрузка, пусто и отказ — вместо списка. */
export const ChecklistStates: Story = {
  name: 'Loading, empty and error',
  parameters: noControls(),
  render: function Render() {
    const statusLabels = useStatusLabels()
    return (
      <InPopover>
        {(['loading', 'empty', 'error'] as const).map(status => (
          <div key={status}>
            <ChecklistStatus
              status={status}
              labels={statusLabels}
              reason={status === 'error' ? 'Server responded 503' : undefined}
              retryTestId={`story-retry-${status}`}
            />
          </div>
        ))}
      </InPopover>
    )
  },
}
