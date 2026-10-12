import { Fragment } from 'react'

import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { IconButton } from '../ui/IconButton'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { playAsyncAction, useAsyncAction } from './__mocks__/asyncAction'

/**
 * Кнопка-иконка кита (ADR 0098): база кнопок шапки, ячейки, строки, тулбара и панелей.
 * Размер один; форма `circle` или `square`; `ghost` — прозрачная, `overlay` — чип поверх
 * контента (действия строки); `label` — имя и тултип.
 */
const IconButtonDemo = (
  props: Omit<Parameters<typeof IconButton>[0], 'children'>,
) => {
  const { pin: PinIcon } = useIcons()
  return (
    <UiCanvas>
      <IconButton {...props}>
        <PinIcon width={16} height={16} />
      </IconButton>
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/IconButton',
  component: IconButtonDemo,
  argTypes: {
    errorFlash: { table: { disable: true } },
    variant: { control: 'inline-radio', options: ['ghost', 'overlay'] },
    shape: { control: 'inline-radio', options: ['circle', 'square'] },
  },
  args: {
    label: 'Pin column',
    shape: 'circle',
    variant: 'ghost',
    active: false,
    disabled: false,
    pending: false,
    onClick: fn(),
  },
} satisfies Meta<typeof IconButtonDemo>

export default meta

type Story = StoryObj<typeof meta>

export const IconButtonBasic: Story = { name: 'Basic' }

export const IconButtonActive: Story = {
  name: 'Active',
  args: { active: true },
}

export const IconButtonOverlay: Story = {
  name: 'Overlay',
  args: { variant: 'overlay' },
}

/**
 * Все варианты, формы (`circle`, `square`) и состояния в единственном размере кита —
 * база для производных кнопок.
 * Ожидание и вспышку ошибки по нажатию показывает история «Async action».
 */
export const IconButtonVariants: Story = {
  name: 'Variants',
  render: function Render() {
    const { pin: PinIcon } = useIcons()
    const icon = <PinIcon width={16} height={16} />
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
          {(
            [
              ['ghost', 'circle'],
              ['ghost', 'square'],
              ['overlay', 'circle'],
            ] as const
          ).map(([variant, shape]) => (
            <Fragment key={`${variant}-${shape}`}>
              {(['rest', 'active', 'pending', 'disabled'] as const).map(
                state => (
                  <IconButton
                    key={state}
                    variant={variant}
                    shape={shape}
                    active={state === 'active'}
                    pending={state === 'pending'}
                    disabled={state === 'disabled'}
                    label={`${variant} ${shape} ${state}`}
                  >
                    {icon}
                  </IconButton>
                ),
              )}
            </Fragment>
          ))}
        </div>
      </UiCanvas>
    )
  },
}

/**
 * Асинхронное действие: нажатие — ожидание (свет, `aria-busy`, нажатия не доходят),
 * через полторы секунды — ответ. Столбцы — исход: отказ со вспышкой ошибки или успех,
 * когда свет просто гаснет; строки — варианты и формы. Нажмите снова — по кругу.
 */
export const IconButtonAsyncAction: Story = {
  name: 'Async action',
  parameters: { requirements: ['UB10'] },
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
