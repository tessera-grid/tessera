import { type CSSProperties, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { Button } from '../ui/Button'
import { LinearProgress } from '../ui/LinearProgress'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Линейный прогресс грида (ADR 0094, ADR 0096): свечение под шапкой, пока обновляются данные;
 * отказ загрузки — ровный красный свет, он держится и гаснет. Обновление — в панели, отказ —
 * кнопкой в истории «Load failed».
 */
interface LinearProgressStoryArgs {
  active: boolean
}

const HEAD_HEIGHT = 40

/** Кусок грида: шапка и тело; полоса сама сдвигается на высоту шапки, как в гриде. */
const GridHead = ({
  active,
  errorFlash,
}: {
  active: boolean
  errorFlash?: number
}) => (
  <div
    style={
      {
        '--tsr-comp-head-height': `${HEAD_HEIGHT}px`,
        '--tsr-comp-scrollbar-actual-width': '0px',
        position: 'relative',
        width: 480,
        height: 120,
        overflow: 'hidden',
        border:
          'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
        borderRadius: 'var(--tsr-comp-frame-radius)',
        background: 'var(--tsr-comp-row-bg)',
      } as CSSProperties
    }
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: HEAD_HEIGHT,
        padding: '0 var(--tsr-comp-cell-content-padding-x)',
        background: 'var(--tsr-comp-head-bg)',
        fontWeight: 600,
        fontSize: 'var(--tsr-comp-cell-font-size)',
      }}
    >
      Country · First name · Last name
    </div>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <LinearProgress
        label={useStoryLabels().loading}
        active={active}
        errorFlash={errorFlash}
      />
    </div>
  </div>
)

const meta = {
  title: 'Tessera/UI/LinearProgress',
  args: { active: true },
  argTypes: {
    active: { control: 'boolean', description: 'Данные обновляются' },
  },
  render: ({ active }) => (
    <UiCanvas>
      <GridHead active={active} />
    </UiCanvas>
  ),
} satisfies Meta<LinearProgressStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const LinearProgressPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('active'),
}

/** Отказ загрузки: кнопка зажигает красный свет — он держится и гаснет. */
const LoadFailed = () => {
  const [failures, setFailures] = useState<number>()
  return (
    <UiCanvas>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
        <GridHead active={false} errorFlash={failures} />
        <Button
          variant="outline"
          onClick={() => setFailures(count => (count ?? 0) + 1)}
        >
          Fail the load
        </Button>
      </div>
    </UiCanvas>
  )
}

export const LinearProgressFailed: Story = {
  name: 'Load failed',
  parameters: noControls(),
  render: () => <LoadFailed />,
}
