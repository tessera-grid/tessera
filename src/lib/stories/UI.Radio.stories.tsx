import { Popover } from '@base-ui/react/popover'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Meta, StoryObj } from '@storybook/react'

import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { PopupItem } from '../ui/Popup/PopupItem'
import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { Radio } from '../ui/Radio/Radio'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Радио кита (ADR 0183, PK14) — как в таблице: строки поповера панели фильтра колонки «да/нет»
 * (Filtering — Boolean) и пресеты фильтра дат. Строку с подписью собирает `PopupItem`, наведение
 * подсвечивает её. Выбор и выключенный вариант — в панели.
 */
interface RadioStoryArgs {
  value: 'all' | 'yes' | 'no' | 'empty'
  disabledNo: boolean
}

/** Варианты булевого фильтра — подписи из словаря таблицы. */
const useChoices = () => {
  const filtering = columnFilteringLabels(useStoryLabels())
  return {
    filter: filtering.filter,
    value: filtering.filterValue,
    choices: [
      ['all', filtering.filterAll],
      ['yes', filtering.filterYes],
      ['no', filtering.filterNo],
      ['empty', filtering.filterEmpty],
    ] as const,
  }
}

const meta = {
  title: 'Tessera/UI/Radio',
  args: { value: 'yes', disabledNo: false },
  argTypes: {
    value: {
      control: 'inline-radio',
      options: ['all', 'yes', 'no', 'empty'],
      description: 'Выбранный вариант',
    },
    disabledNo: { control: 'boolean', description: 'Вариант «No» выключен' },
  },
  render: function Render({ value, disabledNo }) {
    const texts = useChoices()
    return (
      <PopupCanvas height={220}>
        <Popover.Portal>
          <PopupSurface
            positioner={<Popover.Positioner side="bottom" align="start" />}
            popup={
              <Popover.Popup
                aria-label={texts.filter}
                initialFocus={false}
                // Ширина и поле — как у панели фильтра колонки.
                style={{ minWidth: 'var(--tsr-comp-popup-min-width)' }}
              />
            }
          >
            <PopupPanel>
              <RadioGroup
                key={value}
                defaultValue={value}
                aria-label={texts.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 'var(--tsr-comp-popup-padding)',
                }}
              >
                {texts.choices.map(([id, label]) => (
                  <PopupItem key={id} render={<label />}>
                    <Radio value={id} disabled={disabledNo && id === 'no'} />
                    <span>{label}</span>
                  </PopupItem>
                ))}
              </RadioGroup>
            </PopupPanel>
          </PopupSurface>
        </Popover.Portal>
      </PopupCanvas>
    )
  },
} satisfies Meta<RadioStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const RadioPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('value', 'disabledNo'),
}

export const RadioDisabled: Story = {
  name: 'Disabled option',
  parameters: noControls(),
  args: { value: 'all', disabledNo: true },
}
