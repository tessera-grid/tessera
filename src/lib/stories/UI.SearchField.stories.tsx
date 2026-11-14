import { useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { Info, Search } from 'lucide-react'

import { quickSearchLabels } from '../plugins/quickSearch/labels'
import { optionsLabels } from '../shared/options/labels'
import { Field, SearchField } from '../ui/Field/Field'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Поле поиска кита (ADR 0183, PK12): лупа слева, крестик очистки, пока есть текст, и кнопка-
 * подсказка. Лупа, подсказка и начальный текст — в панели.
 */
interface SearchFieldStoryArgs {
  value: string
  icon: boolean
  hint: boolean
}

const SearchFieldStory = ({ value, icon, hint }: SearchFieldStoryArgs) => {
  const [text, setText] = useState(value)
  const labels = useStoryLabels()
  const search = quickSearchLabels(labels)
  return (
    <UiCanvas>
      <div style={{ width: 260 }}>
        <SearchField
          icon={icon ? <Search width={16} height={16} /> : undefined}
          hint={
            hint
              ? {
                  label: search.searchColumnsHint(['Name', 'City', 'Status']),
                  icon: <Info width={14} height={14} />,
                }
              : undefined
          }
          clear={
            text === ''
              ? undefined
              : {
                  label: optionsLabels(labels).clearSearch,
                  onClick: () => setText(''),
                }
          }
        >
          <Field
            type="search"
            aria-label={search.search}
            placeholder={search.search}
            value={text}
            onChange={event => setText(event.target.value)}
          />
        </SearchField>
      </div>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/SearchField',
  args: { value: 'Paris', icon: true, hint: true },
  argTypes: {
    value: { control: 'text', description: 'Initial text' },
    icon: { control: 'boolean', description: 'Magnifying glass on the left' },
    hint: { control: 'boolean', description: 'Hint button' },
  },
  render: args => <SearchFieldStory key={args.value} {...args} />,
} satisfies Meta<SearchFieldStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const SearchFieldPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('value', 'icon', 'hint'),
}

export const SearchFieldEmpty: Story = {
  name: 'Empty',
  parameters: noControls(),
  args: { value: '' },
}

export const SearchFieldPlain: Story = {
  name: 'Without icon and hint',
  parameters: noControls(),
  args: { icon: false, hint: false },
}
