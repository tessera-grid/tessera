import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSkeletonRows } from '../ui/Popup/PopupSkeletonRows'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Строки-скелеты поповера (ADR 0183): пока грузятся пункты меню, панель раздела или список
 * вариантов — строки высотой пункта с полоской на поле пункта.
 */
interface SkeletonRowsStoryArgs {
  count: number
  /** Полоски короче от строки к строке — список вариантов. */
  shortening: boolean
}

const shorter = (index: number) => `${70 - index * 10}%`

const SkeletonRowsStory = ({ count, shortening }: SkeletonRowsStoryArgs) => (
  <PopupCanvas height={240}>
    <Popover.Portal>
      <PopupSurface
        positioner={<Popover.Positioner side="bottom" align="start" />}
        popup={
          <Popover.Popup
            initialFocus={false}
            aria-label="Loading"
            style={{ width: 280 }}
          />
        }
      >
        <PopupPanel>
          <PopupSkeletonRows
            count={count}
            width={shortening ? shorter : undefined}
            height={shortening ? 10 : undefined}
          />
        </PopupPanel>
      </PopupSurface>
    </Popover.Portal>
  </PopupCanvas>
)

const meta = {
  title: 'Tessera/UI/Popup/SkeletonRows',
  args: { count: 3, shortening: false },
  argTypes: {
    count: {
      control: { type: 'number', min: 1, max: 6 },
      description: 'Строк',
    },
    shortening: {
      control: 'boolean',
      description: 'Полоски короче от строки к строке',
    },
  },
  render: args => <SkeletonRowsStory {...args} />,
} satisfies Meta<SkeletonRowsStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupSkeletonRowsPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('count', 'shortening'),
}

export const PopupSkeletonRowsShortening: Story = {
  name: 'Shortening rows',
  parameters: noControls(),
  args: { count: 4, shortening: true },
}
