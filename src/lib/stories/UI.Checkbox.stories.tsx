import { useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { Checkbox } from '../ui/Checkbox/Checkbox'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Флажок кита (ADR 0183, PK15, PK18) — один на всю таблицу: выбор строк и колонок, список
 * вариантов, правка булевой ячейки. В режиме «только значение» — значение булевой ячейки: тот же
 * вид, но не нажимается и не в порядке фокуса. Состояния и режим — в панели.
 */
interface CheckboxStoryArgs {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  pending: boolean
  invalid: boolean
  readOnly: boolean
}

const CheckboxStory = (args: CheckboxStoryArgs) => {
  const [checked, setChecked] = useState(args.checked)
  const labels = useStoryLabels()
  return (
    <UiCanvas>
      <Checkbox
        {...args}
        checked={checked}
        label={
          args.readOnly
            ? checked
              ? labels.booleanTrue
              : labels.booleanFalse
            : 'Agree'
        }
        onCheckedChange={setChecked}
      />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Checkbox',
  args: {
    checked: true,
    indeterminate: false,
    disabled: false,
    pending: false,
    invalid: false,
    readOnly: false,
  },
  argTypes: {
    checked: { control: 'boolean', description: 'Отмечен' },
    indeterminate: { control: 'boolean', description: 'Отмечен частично' },
    disabled: { control: 'boolean', description: 'Выключен' },
    pending: { control: 'boolean', description: 'Ждёт сохранения' },
    invalid: { control: 'boolean', description: 'Значение не принято' },
    readOnly: {
      control: 'boolean',
      description: 'Только значение: не нажимается и не в порядке фокуса',
    },
  },
  render: args => <CheckboxStory key={String(args.checked)} {...args} />,
} satisfies Meta<CheckboxStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const CheckboxPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'checked',
    'indeterminate',
    'disabled',
    'pending',
    'invalid',
    'readOnly',
  ),
}

/** Все состояния рядом: пустой, отмечен, частично, выключен, ожидание, ошибка. */
export const CheckboxStates: Story = {
  name: 'States',
  parameters: noControls(),
  render: () => (
    <UiCanvas>
      <Checkbox checked={false} label="Empty" onCheckedChange={() => {}} />
      <Checkbox checked label="Checked" onCheckedChange={() => {}} />
      <Checkbox
        checked={false}
        indeterminate
        label="Partly"
        onCheckedChange={() => {}}
      />
      <Checkbox checked disabled label="Disabled" onCheckedChange={() => {}} />
      <Checkbox checked pending label="Saving" onCheckedChange={() => {}} />
      <Checkbox
        checked={false}
        invalid
        label="Not accepted"
        onCheckedChange={() => {}}
      />
    </UiCanvas>
  ),
}

/** Значение булевой ячейки, которую не правят: «Да» и «Нет» — тот же флажок без нажатия. */
export const CheckboxReadOnly: Story = {
  name: 'Read only',
  parameters: noControls(),
  render: function Render() {
    const labels = useStoryLabels()
    return (
      <UiCanvas>
        <Checkbox readOnly checked label={labels.booleanTrue} />
        <Checkbox readOnly checked={false} label={labels.booleanFalse} />
      </UiCanvas>
    )
  },
}
