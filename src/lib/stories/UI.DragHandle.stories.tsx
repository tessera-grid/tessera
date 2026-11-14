import { Meta, StoryObj } from '@storybook/react'

import { columnDraggingLabels } from '../plugins/columnDragging/labels'
import { rowDraggingLabels } from '../plugins/rowDragging/labels'
import { DragHandle } from '../ui/DragHandle/DragHandle'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Ручка перетаскивания (ADR 0168, §1): компактная квадратная кнопка со значком. У строки — в
 * начале строки, проявляется наведением на строку; у колонки — в заголовке, раскрывается по
 * ширине наведением на заголовок и сдвигает подпись. Что тянут и выключение — в панели.
 */
interface DragHandleStoryArgs {
  kind: 'row' | 'column'
  disabled: boolean
}

const meta = {
  title: 'Tessera/UI/DragHandle',
  args: { kind: 'row', disabled: false },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['row', 'column'],
      description: 'Row or column handle',
    },
    disabled: { control: 'boolean', description: 'Moving is not allowed' },
  },
  render: function Render({ kind, disabled }) {
    const labels = useStoryLabels()
    return kind === 'row' ? (
      <UiCanvas host="row" column="Name" caption="Alice Smith" width={240}>
        <span style={{ order: -1, display: 'flex' }}>
          <DragHandle
            kind="row"
            label={rowDraggingLabels(labels).moveRow}
            disabled={disabled}
          />
        </span>
      </UiCanvas>
    ) : (
      <UiCanvas host="head" caption="First name" width={200}>
        <span style={{ order: -1, display: 'flex' }}>
          <DragHandle
            kind="column"
            label={columnDraggingLabels(labels).moveColumn}
            disabled={disabled}
          />
        </span>
      </UiCanvas>
    )
  },
} satisfies Meta<DragHandleStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const DragHandlePlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('kind', 'disabled'),
}

/** Ручка колонки: наведите на заголовок — ручка раскрывается и сдвигает подпись. */
export const DragHandleColumn: Story = {
  name: 'Column',
  parameters: noControls(),
  args: { kind: 'column' },
}
