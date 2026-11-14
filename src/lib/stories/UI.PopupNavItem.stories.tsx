import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { useIcons } from '../ui/icons'
import { PopupNavItem } from '../ui/Popup/PopupNavItem'
import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Пункт перехода (ADR 0215, §3): строка на другой уровень поповера — значок, подпись, короткое
 * значение справа и шеврон. Длинное значение — многоточием с тултипом; без перехода — без шеврона.
 */
interface NavItemStoryArgs {
  label: string
  value: string
  disabled: boolean
}

const NavItemStory = ({ label, value, disabled }: NavItemStoryArgs) => {
  const { filter: FilterIcon, columns: ColumnsIcon } = useIcons()
  return (
    <PopupCanvas height={200}>
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="start" />}
          popup={
            <Popover.Popup
              initialFocus={false}
              aria-label="Settings"
              style={{ width: 280 }}
            />
          }
        >
          <PopupPanel title="Settings">
            <PopupNavItem
              icon={<FilterIcon width={16} height={16} />}
              label={label}
              value={value || undefined}
              disabled={disabled}
            />
            <PopupNavItem
              icon={<ColumnsIcon width={16} height={16} />}
              label="Columns"
              value="all visible"
            />
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/NavItem',
  args: { label: 'Filter', value: '2 active', disabled: false },
  argTypes: {
    label: { control: 'text', description: 'Label' },
    value: {
      control: 'text',
      description: 'Short value; empty for none',
    },
    disabled: { control: 'boolean', description: 'No navigation' },
  },
  render: args => <NavItemStory {...args} />,
} satisfies Meta<NavItemStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupNavItemPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('label', 'value', 'disabled'),
}

export const PopupNavItemLongValue: Story = {
  name: 'Long value',
  parameters: noControls(),
  args: { value: '12 active, 3 drafts, 1 refused by the server' },
}

export const PopupNavItemDisabled: Story = {
  name: 'Without transition',
  parameters: noControls(),
  args: { value: 'none', disabled: true },
}
