import { useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { useIcons } from '../ui/icons'
import {
  PopupLevelBack,
  PopupLevels,
  usePopupLevels,
} from '../ui/Popup/PopupLevels'
import { PopupNavItem } from '../ui/Popup/PopupNavItem'
import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Уровни поповера-панели (ADR 0215, §3): строка перехода сдвигает уровень вбок, строка «назад» —
 * обратно; у первого уровня — заголовок, у вложенного — «назад» тем же видом.
 */
interface LevelsStoryArgs {
  /** Уровень при открытии. */
  level: 'first' | 'nested'
}

const SECTIONS = ['Filter', 'Sorting', 'Grouping']

const LevelsStory = ({ level }: LevelsStoryArgs) => {
  const { viewSettings: SettingsIcon } = useIcons()
  const levels = usePopupLevels()
  const [section, setSection] = useState<string | undefined>(
    level === 'nested' ? SECTIONS[0] : undefined,
  )
  return (
    <PopupCanvas height={240}>
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
          <PopupLevels levels={levels} levelKey={section ?? 'first'}>
            {section ? (
              <PopupPanel>
                <PopupLevelBack
                  label={section}
                  ariaLabel={`Back, ${section}`}
                  onClick={() => {
                    levels.go('back')
                    setSection(undefined)
                  }}
                />
                <p
                  style={{
                    margin: 0,
                    padding: '0 var(--tsr-comp-popup-item-padding-x)',
                  }}
                >
                  Nothing is set in this section.
                </p>
              </PopupPanel>
            ) : (
              <PopupPanel title="Settings">
                {SECTIONS.map(name => (
                  <PopupNavItem
                    key={name}
                    icon={<SettingsIcon width={16} height={16} />}
                    label={name}
                    value="none"
                    onClick={() => {
                      levels.go('forward')
                      setSection(name)
                    }}
                  />
                ))}
              </PopupPanel>
            )}
          </PopupLevels>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/Levels',
  args: { level: 'first' },
  argTypes: {
    level: {
      control: 'inline-radio',
      options: ['first', 'nested'],
      description: 'Уровень при открытии',
    },
  },
  render: args => <LevelsStory key={args.level} {...args} />,
} satisfies Meta<LevelsStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupLevelsPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('level'),
}

export const PopupLevelsNested: Story = {
  name: 'Nested level',
  parameters: noControls(),
  args: { level: 'nested' },
}
