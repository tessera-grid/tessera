import { Meta, StoryObj } from '@storybook/react'

import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { CellButton } from '../ui/CellButton/CellButton'
import { useIcons } from '../ui/icons'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  ACTIVE_ARGS,
  ACTIVE_ARG_TYPES,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка в ячейке для своих слотов (ADR 0128): скрыта до наведения на ячейку — наведите
 * на неё; `revealOnHover`, `active`, ожидание, отказ и выключение — из контролов.
 */
const CellButtonDemo = ({
  label,
  ...props
}: Omit<Parameters<typeof CellButton>[0], 'icon' | 'label'> & {
  /** Пусто — подпись из словаря таблицы. */
  label?: string
}) => {
  const { edit: Edit } = useIcons()
  const editCell = cellEditingLabels(useStoryLabels()).editCell
  return (
    <UiCanvas host="cell" column="Age" caption="42" width={200}>
      <CellButton
        {...props}
        label={label || editCell}
        icon={<Edit width={16} height={16} />}
      />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/CellButton',
  component: CellButtonDemo,
  argTypes: { ...DERIVED_BUTTON_ARG_TYPES, ...ACTIVE_ARG_TYPES },
  args: {
    ...DERIVED_BUTTON_ARGS,
    revealOnHover: true,
    ...ACTIVE_ARGS,
  },
} satisfies Meta<typeof CellButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const CellButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'label',
    'revealOnHover',
    'active',
    'count',
    'indicator',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

// Включённое действие: цвет и точка, видна без наведения.
export const CellButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true },
}

export const CellButtonAlwaysVisible: Story = {
  name: 'Always visible',
  parameters: noControls(),
  args: { revealOnHover: false },
}

/**
 * Ожидание на самой кнопке — только для действия без цели в данных: открыть внешнюю систему,
 * отправить письмо, выгрузить ячейки в файл. Действие над данными ячейки ждёт на самих данных —
 * волной на цели (ADR 0155; `table.trackCellAction`, ADR 0176), а не на кнопке.
 */
export const CellButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const CellButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { ...DISABLED_ARGS, revealOnHover: false },
}
