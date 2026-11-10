import { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { fn } from 'storybook/test'

import { columnFilteringLabels } from '../plugins/columnFiltering/labels'
import { Button } from '../ui/Button'
import { useIcons } from '../ui/icons'
import { AsyncActionTable } from './__mocks__/AsyncActionTable'
import { UiCanvas } from './__mocks__/UiCanvas'
import { VariantGrid } from './__mocks__/VariantGrid'
import { playAsyncAction, useAsyncAction } from './__mocks__/asyncAction'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Кнопка с подписью (ADR 0097): `outline` — на поверхности грида, `ghost` — в
 * поповерах. Иконка, ожидание, вспышка ошибки и выключение — из контролов.
 */
type ButtonDemoProps = Omit<
  Parameters<typeof Button>[0],
  'icon' | 'children'
> & {
  withIcon: boolean
  /** Пусто — подпись из словаря таблицы по `text`. */
  children?: ReactNode
  /** Подпись из словаря: повтор загрузки или сброс фильтра. */
  text?: 'retry' | 'reset'
}

/** Подписи кнопок историй: «повторить» и «сбросить» — на языке тулбара. */
const useButtonTexts = () => {
  const labels = useStoryLabels()
  return {
    retry: labels.loadRetry,
    reset: columnFilteringLabels(labels).filterReset,
    save: labels.actionSave,
  }
}

const DemoButton = ({
  withIcon,
  children,
  text = 'retry',
  ...props
}: ButtonDemoProps) => {
  const { retry: RetryIcon } = useIcons()
  const texts = useButtonTexts()
  return (
    <Button
      {...props}
      icon={
        withIcon ? (
          <RetryIcon width={16} height={16} aria-hidden="true" />
        ) : undefined
      }
    >
      {children || texts[text]}
    </Button>
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
    tone: {
      control: 'inline-radio',
      options: ['none', 'danger'],
      mapping: { none: undefined },
      description: 'Тон: опасное действие — красное (ADR 0206)',
    },
    tooltip: { control: 'text' },
    failed: { control: 'boolean' },
    tooltipWhenDisabled: { if: { arg: 'disabled' } },
  },
  args: {
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
    'tone',
    'withIcon',
    'tooltip',
    'pending',
    'failed',
    'disabled',
    'tooltipWhenDisabled',
  ),
}

export const ButtonGhost: Story = {
  name: 'Ghost',
  parameters: noControls(),
  args: { variant: 'ghost', withIcon: false, text: 'reset' },
}

/** Иконка слева от подписи — в обоих вариантах. */
export const ButtonWithIcon: Story = {
  name: 'With icon',
  parameters: noControls(),
  args: { withIcon: true, text: 'retry' },
  ...inBothVariants,
}

/** Только подпись — в обоих вариантах. */
export const ButtonWithoutIcon: Story = {
  name: 'Without icon',
  parameters: noControls(),
  args: { withIcon: false, text: 'reset' },
  ...inBothVariants,
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
    const texts = useButtonTexts()
    return (
      <UiCanvas>
        <VariantGrid
          columns={['Rest', 'With icon', 'Pending', 'Disabled']}
          rows={(['outline', 'ghost'] as const).map(variant => ({
            label: VARIANT_LABELS[variant],
            cells: [
              <Button variant={variant}>{texts.reset}</Button>,
              <Button variant={variant} icon={icon}>
                {texts.retry}
              </Button>,
              <Button variant={variant} icon={icon} pending>
                {texts.retry}
              </Button>,
              <Button variant={variant} disabled>
                {texts.reset}
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
 * через полторы секунды — ответ. Столбцы — исход: отказ, когда дуга встаёт и гаснет, или успех,
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
    const texts = useButtonTexts()
    return (
      <UiCanvas>
        <AsyncActionTable
          rows={[
            {
              label: 'Outline',
              fails: (
                <Button {...outlineFails} icon={icon}>
                  {texts.retry}
                </Button>
              ),
              succeeds: (
                <Button {...outlineSucceeds} icon={icon}>
                  {texts.retry}
                </Button>
              ),
            },
            {
              label: 'Ghost',
              fails: (
                <Button {...ghostFails} variant="ghost">
                  {texts.save}
                </Button>
              ),
              succeeds: (
                <Button {...ghostSucceeds} variant="ghost">
                  {texts.save}
                </Button>
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
