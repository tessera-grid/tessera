import type { ReactNode } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { rowDraggingLabels } from '../plugins/rowDragging/labels'
import { DragCloud } from '../ui/DragCloud/DragCloud'
import { DragHandle } from '../ui/DragHandle/DragHandle'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Облачко перетаскивания (ADR 0183, PK21) — то, что едет под указателем, когда тянут строку или
 * колонку: ручка и первая ячейка строки, заголовок колонки; у строки с вложенными — бабл со
 * счётчиком; над местом, куда бросить нельзя, — тон ошибки (ADR 0137). Вид, счётчик и отказ —
 * в панели.
 */
interface DragCloudStoryArgs {
  kind: 'row' | 'column'
  text: string
  count: number
  invalid: boolean
}

/** Содержимое как в таблице: ручка и текст первой ячейки или заголовок. */
/** Ручка строки в облачке — с подписью из словаря таблицы. */
const RowHandle = () => (
  <DragHandle
    kind="row"
    label={rowDraggingLabels(useStoryLabels()).moveRow}
    tabIndex={-1}
  />
)

const Content = ({ kind, text }: { kind: 'row' | 'column'; text: string }) => (
  <span
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      width: '100%',
      padding: '0 var(--tsr-comp-cell-content-padding-x)',
      fontSize: 'var(--tsr-comp-cell-font-size)',
      fontWeight: kind === 'column' ? 600 : undefined,
    }}
  >
    {kind === 'row' && <RowHandle />}
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
  </span>
)

const Cloud = ({
  kind,
  text,
  count,
  invalid,
}: DragCloudStoryArgs): ReactNode => (
  <DragCloud
    kind={kind}
    count={kind === 'row' && count > 0 ? count : undefined}
    invalid={invalid}
    style={
      kind === 'column'
        ? { width: 160, height: 'var(--tsr-comp-head-row-height)' }
        : undefined
    }
  >
    <Content kind={kind} text={text} />
  </DragCloud>
)

const meta = {
  title: 'Tessera/UI/DragCloud',
  args: { kind: 'row', text: 'Alice Smith', count: 3, invalid: false },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['row', 'column'],
      description: 'Что тянут: строку или колонку',
    },
    text: { control: 'text', description: 'Текст первой ячейки или заголовка' },
    count: {
      control: { type: 'number', min: 0, max: 999 },
      description: 'Вложенных строк — бабл; 0 — без бабла',
    },
    invalid: {
      control: 'boolean',
      description: 'Над местом, куда бросить нельзя',
    },
  },
  render: args => (
    <UiCanvas>
      <div style={{ padding: 12 }}>
        <Cloud {...args} />
      </div>
    </UiCanvas>
  ),
} satisfies Meta<DragCloudStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const DragCloudPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('kind', 'text', 'count', 'invalid'),
}

const VARIANTS: [string, DragCloudStoryArgs][] = [
  ['Row', { kind: 'row', text: 'Alice Smith', count: 0, invalid: false }],
  [
    'Row with nested rows',
    { kind: 'row', text: 'Engineering', count: 12, invalid: false },
  ],
  [
    'Row over a refused place',
    { kind: 'row', text: 'Alice Smith', count: 0, invalid: true },
  ],
  ['Column', { kind: 'column', text: 'First name', count: 0, invalid: false }],
]

/** Облачко строки, строки с вложенными, строки над запретным местом и колонки. */
export const DragCloudVariants: Story = {
  name: 'Variants',
  parameters: noControls(),
  render: () => (
    <UiCanvas>
      <div style={{ display: 'grid', gap: 20, padding: 12 }}>
        {VARIANTS.map(([label, args]) => (
          <div key={label} style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12 }}>{label}</span>
            <Cloud {...args} />
          </div>
        ))}
      </div>
    </UiCanvas>
  ),
}
