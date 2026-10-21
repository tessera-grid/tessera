import { Fragment } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { Button } from '../ui/Button'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { playAsyncAction, useAsyncAction } from './__mocks__/asyncAction'

/**
 * Кнопка с подписью (ADR 0097): `outline` — на поверхности грида, `ghost` — в
 * поповерах. Иконка, ожидание, вспышка ошибки и выключение — из контролов.
 */
const ButtonDemo = ({
  withIcon,
  ...props
}: Omit<Parameters<typeof Button>[0], 'icon'> & { withIcon: boolean }) => {
  const { retry: RetryIcon } = useIcons()
  return (
    <UiCanvas>
      <Button
        {...props}
        icon={
          withIcon ? (
            <RetryIcon width={16} height={16} aria-hidden="true" />
          ) : undefined
        }
      />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Button',
  component: ButtonDemo,
  argTypes: {
    errorFlash: { table: { disable: true } },
    variant: { control: 'inline-radio', options: ['outline', 'ghost'] },
  },
  args: {
    children: 'Retry',
    variant: 'outline',
    withIcon: true,
    disabled: false,
    pending: false,
    onClick: fn(),
  },
} satisfies Meta<typeof ButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ButtonOutline: Story = { name: 'Outline' }

export const ButtonGhost: Story = {
  name: 'Ghost',
  args: { variant: 'ghost', withIcon: false, children: 'Reset' },
}

export const ButtonPending: Story = {
  name: 'Pending',
  args: { pending: true },
}

export const ButtonDisabled: Story = {
  name: 'Disabled',
  args: { disabled: true },
}

/**
 * Все варианты и состояния в единственном размере кита (ADR 0098) — база для производных
 * кнопок. Ожидание и вспышку ошибки по нажатию показывает история «Async action».
 */
export const ButtonVariants: Story = {
  name: 'Variants',
  render: function Render() {
    const { retry: RetryIcon } = useIcons()
    const icon = <RetryIcon width={16} height={16} aria-hidden="true" />
    return (
      <UiCanvas>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, auto)',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {(['outline', 'ghost'] as const).map(variant => (
            <Fragment key={variant}>
              <Button variant={variant}>Rest</Button>
              <Button variant={variant} icon={icon}>
                Icon
              </Button>
              <Button variant={variant} icon={icon} pending>
                Pending
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </Fragment>
          ))}
        </div>
      </UiCanvas>
    )
  },
}

/**
 * Асинхронное действие: нажатие — ожидание (дуга, `aria-busy`, нажатия не доходят),
 * через полторы секунды — ответ. Столбцы — исход: отказ со вспышкой ошибки или успех,
 * когда дуга просто гаснет; строки — варианты и формы. Нажмите снова — повтор.
 */
export const ButtonAsyncAction: Story = {
  name: 'Async action',
  parameters: { requirements: ['UB9'] },
  render: function Render() {
    const { retry: RetryIcon } = useIcons()
    const icon = <RetryIcon width={16} height={16} aria-hidden="true" />
    const outlineFails = useAsyncAction('fail')
    const outlineSucceeds = useAsyncAction('succeed')
    const ghostFails = useAsyncAction('fail')
    const ghostSucceeds = useAsyncAction('succeed')
    return (
      <UiCanvas>
        <AsyncActionTable
          rows={[
            {
              label: 'Outline',
              fails: (
                <Button {...outlineFails} icon={icon}>
                  Retry
                </Button>
              ),
              succeeds: (
                <Button {...outlineSucceeds} icon={icon}>
                  Retry
                </Button>
              ),
            },
            {
              label: 'Ghost',
              fails: (
                <Button {...ghostFails} variant="ghost">
                  Save
                </Button>
              ),
              succeeds: (
                <Button {...ghostSucceeds} variant="ghost">
                  Save
                </Button>
              ),
            },
          ]}
        />
      </UiCanvas>
    )
  },
  play: ({ canvasElement }) => playAsyncAction(canvasElement),
}
