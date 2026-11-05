import { Meta, StoryObj } from '@storybook/react'
import { fn } from 'storybook/test'

import { columnPinningLabels } from '../plugins/columnPinning/labels'
import { IconButton } from '../ui/IconButton'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
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
  label,
  ...props
}: Omit<
  Parameters<typeof IconButton>[0],
  'children' | 'activeIcon' | 'label'
> & {
  /** Пусто — «Закрепить колонку» из словаря таблицы, с числом включённых при `count`. */
  label?: string
  /** Свой значок включённой кнопки — `activeIcon`. */
  withActiveIcon?: boolean
}) => {
  const { pin: PinIcon, actionBlocked: LockIcon } = useIcons()
  const pin = usePinLabel()
  const labels = useStoryLabels()
  const count = props.active ? (props.count ?? 0) : 0
  return (
    <UiCanvas>
      <IconButton
        {...props}
        label={label || (count > 0 ? labels.withActiveCount(pin, count) : pin)}
        activeIcon={
          withActiveIcon ? <LockIcon width={16} height={16} /> : undefined
        }
      >
        <PinIcon width={16} height={16} />
      </IconButton>
    </UiCanvas>
  )
}

/** Подпись кнопок истории — «Закрепить колонку» на языке тулбара. */
const usePinLabel = () => columnPinningLabels(useStoryLabels()).pin

const meta = {
  title: 'Tessera/UI/IconButton',
  component: IconButtonDemo,
  argTypes: {
    variant: { control: 'inline-radio', options: ['ghost', 'overlay'] },
    shape: { control: 'inline-radio', options: ['circle', 'square'] },
    size: { control: 'inline-radio', options: ['default', 'compact'] },
    count: { control: { type: 'number', min: 0 }, if: { arg: 'active' } },
    withActiveIcon: { if: { arg: 'active' } },
    indicator: { if: { arg: 'active' } },
    tooltipWhenDisabled: { if: { arg: 'disabled' } },
  },
  args: {
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

export const IconButtonPlayground: Story = {
  name: 'Playground',
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
    'failed',
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
  args: { active: true, count: 3 },
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
 * база для производных кнопок. Включённая — с точкой и с числом `count` в бабле.
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
          columns={['Rest', 'Active', 'Active · count', 'Pending', 'Disabled']}
          rows={(
            [
              ['ghost', 'circle', 'default', 'Ghost · circle'],
              ['ghost', 'square', 'default', 'Ghost · square'],
              ['overlay', 'circle', 'default', 'Overlay · circle'],
              ['ghost', 'square', 'compact', 'Ghost · square · compact'],
            ] as const
          ).map(([variant, shape, size, label]) => ({
            label,
            cells: (
              ['rest', 'active', 'count', 'pending', 'disabled'] as const
            ).map(state => (
              <IconButton
                key={state}
                variant={variant}
                shape={shape}
                size={size}
                active={state === 'active' || state === 'count'}
                count={state === 'count' ? 3 : undefined}
                pending={state === 'pending'}
                disabled={state === 'disabled'}
                label={`${variant} ${shape} ${size} ${state === 'count' ? 'active, 3' : state}`}
              >
                {icon}
              </IconButton>
            )),
          }))}
        />
      </UiCanvas>
    )
  },
}

/**
 * Асинхронное действие: нажатие — ожидание (дуга, `aria-busy`, нажатия не доходят),
 * через полторы секунды — ответ. Столбцы — исход: отказ, когда дуга встаёт и гаснет, или успех,
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
    const pin = usePinLabel()
    return (
      <UiCanvas>
        <AsyncActionTable
          rows={[
            {
              label: 'Circle',
              fails: (
                <IconButton {...circleFails} label={pin}>
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton {...circleSucceeds} label={pin}>
                  {icon}
                </IconButton>
              ),
            },
            {
              label: 'Square',
              fails: (
                <IconButton {...squareFails} shape="square" label={pin}>
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton {...squareSucceeds} shape="square" label={pin}>
                  {icon}
                </IconButton>
              ),
            },
            {
              label: 'Overlay',
              fails: (
                <IconButton {...overlayFails} variant="overlay" label={pin}>
                  {icon}
                </IconButton>
              ),
              succeeds: (
                <IconButton {...overlaySucceeds} variant="overlay" label={pin}>
                  {icon}
                </IconButton>
              ),
            },
          ]}
        />
      </UiCanvas>
    )
  },
  // Сценарий нажимает кнопки — только в тестах каталога, у человека история стоит в покое.
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    await playAsyncAction(canvasElement)
  },
}
