import { useMemo, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { Button } from '../ui/Button'
import { Tooltip, type TooltipSide } from '../ui/Tooltip'
import TooltipPopup from '../ui/Tooltip/TooltipImpl'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Подсказка кита (ADR 0017; ADR 0083; ADR 0100): появляется при наведении и при фокусе с
 * клавиатуры; у обрезанного текста — только когда текст не помещается, и тогда на неё можно
 * навести указатель. Текст и сторона — в панели; наведите на кнопку.
 */
interface TooltipStoryArgs {
  /** Пусто — «По возрастанию» из словаря таблицы. */
  title?: string
  side: TooltipSide
}

const SIDES: TooltipSide[] = ['top', 'right', 'bottom', 'left']

const meta = {
  title: 'Tessera/UI/Tooltip',
  args: { side: 'top' },
  argTypes: {
    title: { control: 'text', description: 'Текст подсказки' },
    side: {
      control: 'inline-radio',
      options: SIDES,
      description: 'Сторона появления',
    },
  },
  render: function Render({ title, side }) {
    const sortAscending = columnSortingLabels(useStoryLabels()).sortAscending
    return (
      <UiCanvas>
        <div style={{ padding: 48 }}>
          <Tooltip title={title || sortAscending} side={side}>
            <Button variant="outline">Hover me</Button>
          </Tooltip>
        </div>
      </UiCanvas>
    )
  },
} satisfies Meta<TooltipStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const TooltipPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('title', 'side'),
}

/** Открытая подсказка — как при наведении. */
const OpenTooltip = () => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const ref = useMemo(() => ({ current: anchor }), [anchor])
  return (
    <UiCanvas>
      <div style={{ padding: 48 }}>
        <Button ref={setAnchor} variant="outline">
          Export
        </Button>
        {anchor && (
          <TooltipPopup
            open
            onOpenChange={() => {}}
            anchor={ref}
            side="top"
            title="Download the visible rows as CSV"
          />
        )}
      </div>
    </UiCanvas>
  )
}

export const TooltipOpen: Story = {
  name: 'Open',
  parameters: noControls(),
  render: () => <OpenTooltip />,
}

/** Обрезанный текст: подсказка — только пока текст не помещается; наведите на подпись. */
export const TooltipOverflow: Story = {
  name: 'Truncated text',
  parameters: noControls(),
  render: () => (
    <UiCanvas>
      <div style={{ display: 'grid', gap: 8, width: 160 }}>
        {['Short', 'A long label that does not fit into the column width'].map(
          text => (
            <Tooltip key={text} title={text} overflowOnly>
              <span
                tabIndex={0}
                style={{
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {text}
              </span>
            </Tooltip>
          ),
        )}
      </div>
    </UiCanvas>
  ),
}
