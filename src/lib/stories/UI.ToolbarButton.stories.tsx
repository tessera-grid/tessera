import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'

import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'
import {
  DERIVED_BUTTON_ARGS,
  DERIVED_BUTTON_ARG_TYPES,
  DERIVED_BUTTON_CONTROLS,
  ACTIVE_ARG_TYPES,
  DISABLED_ARGS,
} from './__mocks__/derivedButton'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка верхнего тулбара (ADR 0035, ADR 0128): иконка с тултипом внутри `Toolbar.Root`;
 * включённая — бабл: точка или число `count` (ADR 0129); ожидание, отказ и выключение — из контролов.
 */
const ToolbarButtonDemo = ({
  label,
  ...props
}: Omit<Parameters<typeof ToolbarButton>[0], 'icon' | 'label'> & {
  /** Пусто — подпись «Колонки» из словаря таблицы, с числом скрытых при `count`. */
  label?: string
}) => {
  const { columns: Columns } = useIcons()
  const texts = columnVisibilityLabels(useStoryLabels())
  const count = props.active ? (props.count ?? 0) : 0
  return (
    <UiCanvas>
      <Toolbar.Root>
        <ToolbarButton
          {...props}
          label={
            label ||
            (count > 0
              ? `${texts.columns}, ${texts.columnsHiddenShort(count)}`
              : texts.columns)
          }
          icon={<Columns width={16} height={16} />}
        />
      </Toolbar.Root>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/ToolbarButton',
  component: ToolbarButtonDemo,
  argTypes: { ...DERIVED_BUTTON_ARG_TYPES, ...ACTIVE_ARG_TYPES },
  args: { ...DERIVED_BUTTON_ARGS, active: false, count: 0 },
} satisfies Meta<typeof ToolbarButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ToolbarButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'label',
    'active',
    'count',
    ...DERIVED_BUTTON_CONTROLS,
  ),
}

/** Включена без числа — бабл-точка (ADR 0129). */
export const ToolbarButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true, count: 0 },
}

/** Включена с числом — бабл со счётчиком (ADR 0129). */
export const ToolbarButtonActiveCount: Story = {
  name: 'Active — count',
  parameters: noControls(),
  args: { active: true, count: 2 },
}

export const ToolbarButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
}

export const ToolbarButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: DISABLED_ARGS,
}
