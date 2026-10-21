import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { IconButton } from '../ui/IconButton'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { VariantGrid } from './__mocks__/VariantGrid'
import { playAsyncAction, useAsyncAction } from './__mocks__/asyncAction'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка-иконка кита (ADR 0098): база кнопок шапки, ячейки, строки, тулбара и панелей.
 * Размер один; форма `circle` или `square`; `ghost` — прозрачная, `overlay` — чип поверх
 * контента (действия строки); `label` — имя и тултип. Включённая — цвет и бабл: точка,
 * число `count` или свой значок (ADR 0129).
 */
const IconButtonDemo = ({
  withActiveIcon,
  ...props
}: Omit<Parameters<typeof IconButton>[0], 'children' | 'activeIcon'> & {
  /** Свой значок включённой кнопки — `activeIcon`. */
  withActiveIcon?: boolean
}) => {
  const { pin: PinIcon, actionBlocked: LockIcon } = useIcons()
  return (
    <UiCanvas>
      <IconButton
        {...props}
        activeIcon={
          withActiveIcon ? <LockIcon width={16} height={16} /> : undefined
        }
      >
        <PinIcon width={16} height={16} />
      </IconButton>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/IconButton',
  tags: ['done'],
  component: IconButtonDemo,
  argTypes: {
    errorFlash: { table: { disable: true } },
    variant: { control: 'inline-radio', options: ['ghost', 'overlay'] },
    shape: { control: 'inline-radio', options: ['circle', 'square'] },
    size: { control: 'inline-radio', options: ['default', 'compact'] },
    count: { control: { type: 'number', min: 0 }, if: { arg: 'active' } },
    withActiveIcon: { if: { arg: 'active' } },
    indicator: { if: { arg: 'active' } },
    tooltipWhenDisabled: { if: { arg: 'disabled' } },
  },
  args: {
    label: 'Pin column',
    shape: 'circle',
    size: 'default',
    variant: 'ghost',
    active: false,
    count: 0,
    withActiveIcon: false,
    indicator: true,
    disabled: false,
    tooltipWhenDisabled: false,
    pending: false,
    onClick: fn(),
  },
} satisfies Meta<typeof IconButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const IconButtonDefault: Story = {
  name: 'Default',
  parameters: defaultControls(
    'label',
    'variant',
    'shape',
    'size',
    'active',
    'count',
    'withActiveIcon',
    'indicator',
    'pending',
    'failure',
    'disabled',
    'tooltipWhenDisabled',
  ),
}

export const IconButtonActive: Story = {
  name: 'Active',
  parameters: noControls(),
  args: { active: true },
}

// Число вместо точки: бабл растёт и встаёт на угол кнопки.
export const IconButtonActiveCount: Story = {
  name: 'Active — count',
  parameters: noControls(),
  args: { active: true, count: 3, label: 'Pin column, 3 pinned' },
}

// Свой значок включённой кнопки; бабл остаётся.
export const IconButtonActiveIcon: Story = {
  name: 'Active — icon',
  parameters: noControls(),
  args: { active: true, withActiveIcon: true },
}

export const IconButtonOverlay: Story = {
  name: 'Overlay',
  parameters: noControls(),
  args: { variant: 'overlay' },
}

/**
 * Все варианты, формы (`circle`, `square`) и состояния в единственном размере кита —
 * база для производных кнопок.
 * Ожидание и вспышку ошибки по нажатию показывает история «Async action».
 */
export const IconButtonVariants: Story = {
  name: 'Variants',
  parameters: noControls(),
  render: function Render() {
    const { pin: PinIcon } = useIcons()
    const icon = <PinIcon width={16} height={16} />
    return (
      <UiCanvas>
        <VariantGrid
          columns={['Rest', 'Active', 'Pending', 'Disabled']}
          rows={(
            [
              ['ghost', 'circle', 'default', 'Ghost · circle'],
              ['ghost', 'square', 'default', 'Ghost · square'],
              ['overlay', 'circle', 'default', 'Overlay · circle'],
              ['ghost', 'square', 'compact', 'Ghost · square · compact'],
            ] as const
          ).map(([variant, shape, size, label]) => ({
            label,
            cells: (['rest', 'active', 'pending', 'disabled'] as const).map(
              state => (
                <IconButton
                  key={state}
                  variant={variant}
                  shape={shape}
                  size={size}
                  active={state === 'active'}
                  pending={state === 'pending'}
                  disabled={state === 'disabled'}
                  label={`${variant} ${shape} ${size} ${state}`}
                >
                  {icon}
                </IconButton>
              ),
            ),
          }))}
        />
      </UiCanvas>
    )
  },
}

/**
 * Асинхронное действие: нажатие — ожидание (дуга, `aria-busy`, нажатия не доходят),
 * через полторы секунды — ответ. Столбцы — исход: отказ со вспышкой и отметкой или успех,
 * когда дуга просто гаснет; строки — варианты и формы. Нажмите снова — повтор.
 */
export const IconButtonAsyncAction: Story = {
  name: 'Async action',
  parameters: { ...noControls(), requirements: ['UB10', 'IR12'] },
  render: function Render() {
    const { pin: PinIcon } = useIcons()
    const icon = <PinIcon width={16} height={16} />
    const circleFails = useAsyncAction('fail')
    const circleSucceeds = useAsyncAction('succeed')
    const squareFails = useAsyncAction('fail')
    const squareSucceeds = useAsyncAction('succeed')
    const overlayFails = useAsyncAction('fail')
    const overlaySucceeds = useAsyncAction('succeed')
    return (
      <UiCanvas>
        <AsyncActionTable
          rows={[
            {
              label: 'Circle',
              fails: (
                <IconButton {...circleFails} label="Pin column">
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton {...circleSucceeds} label="Pin column">
                  {icon}
                </IconButton>
              ),
            },
            {
              label: 'Square',
              fails: (
                <IconButton {...squareFails} shape="square" label="Pin column">
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton
                  {...squareSucceeds}
                  shape="square"
                  label="Pin column"
                >
                  {icon}
                </IconButton>
              ),
            },
            {
              label: 'Overlay',
              fails: (
                <IconButton
                  {...overlayFails}
                  variant="overlay"
                  label="Pin column"
                >
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton
                  {...overlaySucceeds}
                  variant="overlay"
                  label="Pin column"
                >
                  {icon}
                </IconButton>
              ),
            },
          ]}
        />
      </UiCanvas>
    )
  },
  play: ({ canvasElement }) => playAsyncAction(canvasElement),
}
