import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { Button } from '../ui/Button'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { VariantGrid } from './__mocks__/VariantGrid'
import { playAsyncAction, useAsyncAction } from './__mocks__/asyncAction'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка с подписью (ADR 0097): `outline` — на поверхности грида, `ghost` — в
 * поповерах. Иконка, ожидание, вспышка ошибки и выключение — из контролов.
 */
type ButtonDemoProps = Omit<Parameters<typeof Button>[0], 'icon'> & {
  withIcon: boolean
}

const DemoButton = ({ withIcon, ...props }: ButtonDemoProps) => {
  const { retry: RetryIcon } = useIcons()
  return (
    <Button
      {...props}
      icon={
        withIcon ? (
          <RetryIcon width={16} height={16} aria-hidden="true" />
        ) : undefined
      }
    />
  )
}

const ButtonDemo = (props: ButtonDemoProps) => (
  <UiCanvas>
    <DemoButton {...props} />
  </UiCanvas>
)

const VARIANTS = ['outline', 'ghost'] as const
const VARIANT_LABELS = { outline: 'Outline', ghost: 'Ghost' }

/** Состояние в обоих вариантах рядом: контрол варианта в такой истории не нужен. */
const inBothVariants: Pick<Story, 'render' | 'argTypes'> = {
  render: args => (
    <UiCanvas>
      <VariantGrid
        columns={VARIANTS.map(variant => VARIANT_LABELS[variant])}
        rows={[
          {
            cells: VARIANTS.map(variant => (
              <DemoButton key={variant} {...args} variant={variant} />
            )),
          },
        ]}
      />
    </UiCanvas>
  ),
  argTypes: { variant: { table: { disable: true } } },
}

const meta = {
  title: 'Tessera/UI/Button',
  component: ButtonDemo,
  argTypes: {
    variant: { control: 'inline-radio', options: ['outline', 'ghost'] },
    tooltip: { control: 'text' },
    failure: { control: 'text' },
    tooltipWhenDisabled: { if: { arg: 'disabled' } },
  },
  args: {
    children: 'Retry',
    variant: 'outline',
    withIcon: true,
    disabled: false,
    tooltipWhenDisabled: false,
    pending: false,
    onClick: fn(),
  },
} satisfies Meta<typeof ButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ButtonPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'children',
    'variant',
    'withIcon',
    'tooltip',
    'pending',
    'failure',
    'disabled',
    'tooltipWhenDisabled',
  ),
}

export const ButtonGhost: Story = {
  name: 'Ghost',
  parameters: noControls(),
  args: { variant: 'ghost', withIcon: false, children: 'Reset' },
}

export const ButtonPending: Story = {
  name: 'Pending',
  parameters: noControls(),
  args: { pending: true },
  ...inBothVariants,
}

export const ButtonDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { disabled: true },
  ...inBothVariants,
}

/**
 * Все варианты и состояния в единственном размере кита (ADR 0098) — база для производных
 * кнопок. Ожидание и вспышку ошибки по нажатию показывает история «Async action».
 */
export const ButtonVariants: Story = {
  name: 'Variants',
  parameters: noControls(),
  render: function Render() {
    const { retry: RetryIcon } = useIcons()
    const icon = <RetryIcon width={16} height={16} aria-hidden="true" />
    return (
      <UiCanvas>
        <VariantGrid
          columns={['Rest', 'With icon', 'Pending', 'Disabled']}
          rows={(['outline', 'ghost'] as const).map(variant => ({
            label: VARIANT_LABELS[variant],
            cells: [
              <Button variant={variant}>Reset</Button>,
              <Button variant={variant} icon={icon}>
                Retry
              </Button>,
              <Button variant={variant} icon={icon} pending>
                Retry
              </Button>,
              <Button variant={variant} disabled>
                Reset
              </Button>,
            ],
          }))}
        />
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
  parameters: { ...noControls(), requirements: ['UB9'] },
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
