import { useState } from 'react'

import { Select } from '@base-ui/react/select'
import { Meta, StoryObj } from '@storybook/react'

import { paginationLabels } from '../plugins/pagination/labels'
import { PopupItem, PopupItemMark } from '../ui/Popup/PopupItem'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { SelectTrigger } from '../ui/SelectTrigger/SelectTrigger'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка выпадающего списка (ADR 0183, PK13): значение и шеврон, ожидание дугой и отказ, «стоп»
 * отмены. В списке — триггер Base UI `Select` через `render`. Ожидание и отказ — в панели.
 */
interface SelectTriggerStoryArgs {
  pending: boolean
  failed: boolean
}

const SIZES = [25, 50, 100]

const SelectStory = ({ pending, failed }: SelectTriggerStoryArgs) => {
  const [size, setSize] = useState(25)
  return (
    <UiCanvas>
      <Select.Root
        value={size}
        onValueChange={next => next !== null && setSize(next)}
      >
        <Select.Trigger
          aria-label={paginationLabels(useStoryLabels()).rowsPerPage}
          render={<SelectTrigger pending={pending} failed={failed} />}
        >
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <PopupSurface
            positioner={
              <Select.Positioner
                side="bottom"
                align="start"
                alignItemWithTrigger={false}
              />
            }
            popup={<Select.Popup />}
          >
            <Select.List>
              {SIZES.map(value => (
                <PopupItem
                  key={value}
                  render={<Select.Item value={value} />}
                  label={
                    <Select.ItemText render={<span />}>{value}</Select.ItemText>
                  }
                  end={
                    <PopupItemMark
                      render={<Select.ItemIndicator />}
                      status="checked"
                    />
                  }
                />
              ))}
            </Select.List>
          </PopupSurface>
        </Select.Portal>
      </Select.Root>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/SelectTrigger',
  args: { pending: false, failed: false },
  argTypes: {
    pending: { control: 'boolean', description: 'Ждёт загрузки списка' },
    failed: { control: 'boolean', description: 'Загрузка отказала' },
  },
  render: args => <SelectStory {...args} />,
} satisfies Meta<SelectTriggerStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const SelectTriggerPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('pending', 'failed'),
}

/** Кнопка ждёт загрузки списка: дуга по контуру, нажатия игнорируются. */
export const SelectTriggerWaiting: Story = {
  name: 'Waiting for the list',
  parameters: noControls(),
  args: { pending: true },
}

/** Список не загрузился: дуга встаёт и гаснет, кнопка снова нажимается (ADR 0177, §2). */
export const SelectTriggerFailed: Story = {
  name: 'List failed to load',
  parameters: noControls(),
  args: { failed: true },
}
