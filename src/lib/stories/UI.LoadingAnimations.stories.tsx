import { CSSProperties, ReactNode } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'

import '../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import menu from '../grid/headerActions/ActionMenu.module.css'
import { IconButton } from '../ui/IconButton'
import { LinearProgress } from '../ui/LinearProgress'
import popup from '../ui/Popup/Popup.module.css'
import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'

// Анимации загрузки в одном месте: свечение под шапкой (ADR 0094), дуга ожидания кнопок
// (ADR 0127) и спиннер пункта меню (ADR 0078) — одни оттенки и один ритм.
// `slowdown` растягивает все периоды, чтобы разглядеть переливание.

interface LoadingAnimationsProps {
  /** Во сколько раз медленнее периоды анимаций. */
  slowdown: number
}

const HEAD_HEIGHT = 40

const Canvas = ({
  slowdown,
  children,
}: LoadingAnimationsProps & { children: ReactNode }) => (
  <div
    className={DATA_GRID_THEME_CLASS}
    style={
      {
        '--tsr-comp-loader-duration': `${2 * slowdown}s`,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        padding: 16,
        color: 'var(--tsr-sys-fg)',
        fontFamily: 'var(--tsr-comp-font-family)',
        fontSize: 13,
      } as CSSProperties
    }
  >
    {children}
  </div>
)

const Caption = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>{children}</div>
)

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
    {children}
  </div>
)

/** Шапка грида со свечением под ней — как при `loading: 'refresh'`. */
const GridHeadWithGlow = ({ width = 560 }: { width?: number }) => (
  <div
    style={
      {
        '--tsr-comp-head-height': `${HEAD_HEIGHT}px`,
        '--tsr-comp-scrollbar-actual-width': '0px',
        position: 'relative',
        width,
        height: 120,
        overflow: 'hidden',
        border: '1px solid var(--tsr-sys-border)',
        borderRadius: 6,
        background: 'var(--tsr-comp-row-bg)',
      } as CSSProperties
    }
  >
    <div
      style={{
        height: HEAD_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        background: 'var(--tsr-comp-head-bg)',
        fontWeight: 600,
      }}
    >
      Country · First name · Last name
    </div>
    {/* Полоса сама сдвигается на высоту шапки от верха контейнера, как в гриде. */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <LinearProgress label="Loading" />
    </div>
  </div>
)

const RoundButtons = ({ sizes }: { sizes: number[] }) => {
  const { expand: Expand } = useIcons()
  return (
    <Row>
      {sizes.map(size => (
        <IconButton key={size} aria-label={`Expand ${size}`} pending>
          <Expand width={size} height={size} />
        </IconButton>
      ))}
    </Row>
  )
}

const SquareButtons = ({ sizes }: { sizes: number[] }) => {
  const { download: Download } = useIcons()
  return (
    <Toolbar.Root style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      {sizes.map(size => (
        <span
          key={size}
          style={
            { '--tsr-comp-toolbar-button-size': `${size}px` } as CSSProperties
          }
        >
          <ToolbarButton
            label={`Export ${size}`}
            icon={<Download width={size * 0.55} height={size * 0.55} />}
            pending
          />
        </span>
      ))}
    </Toolbar.Root>
  )
}

const MenuWithPendingItem = () => {
  const { download: Download, columns: Columns } = useIcons()
  const items = [
    { label: 'Export to CSV', icon: <Download width={14} height={14} /> },
    {
      label: 'Export to Excel',
      icon: <Download width={14} height={14} />,
      pending: true,
    },
    { label: 'Columns', icon: <Columns width={14} height={14} /> },
  ]
  return (
    <div className={popup.popup} role="menu" style={{ width: 220 }}>
      {items.map(item => (
        <div key={item.label} className={menu.item} role="menuitem">
          <span className={menu.itemIcon} aria-hidden>
            {item.icon}
          </span>
          <span className={menu.itemLabel}>{item.label}</span>
          <span className={menu.itemCheck} aria-hidden>
            {item.pending && <span className={menu.itemSpinner} />}
          </span>
        </div>
      ))}
    </div>
  )
}

const ScaledSpinners = () => (
  <Row>
    {[1, 3, 6].map(scale => (
      <span key={scale} style={{ width: 12 * scale, height: 12 * scale }}>
        {/* Масштаб — на обёртке: свой transform спиннера занят вращением. */}
        <span
          style={{
            display: 'block',
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <span className={menu.itemSpinner} style={{ display: 'block' }} />
        </span>
      </span>
    ))}
  </Row>
)

const SideBySideDemo = ({ slowdown }: LoadingAnimationsProps) => (
  <Canvas slowdown={slowdown}>
    <div>
      <Caption>Progress bar — glow under the header</Caption>
      <GridHeadWithGlow />
    </div>
    <div>
      <Caption>Icon buttons and toolbar buttons — pending</Caption>
      <Row>
        <RoundButtons sizes={[16, 20, 28]} />
        <SquareButtons sizes={[24, 32, 40]} />
      </Row>
    </div>
    <div>
      <Caption>Menu item — action in progress</Caption>
      <MenuWithPendingItem />
    </div>
  </Canvas>
)

const LargeButtonsDemo = ({ slowdown }: LoadingAnimationsProps) => (
  <Canvas slowdown={slowdown}>
    <div>
      <Caption>Round icon buttons</Caption>
      <RoundButtons sizes={[32, 48, 72]} />
    </div>
    <div>
      <Caption>Square toolbar buttons</Caption>
      <SquareButtons sizes={[48, 72, 112]} />
    </div>
  </Canvas>
)

const MenuSpinnerDemo = ({ slowdown }: LoadingAnimationsProps) => (
  <Canvas slowdown={slowdown}>
    <div>
      <Caption>Menu with an item in progress</Caption>
      <MenuWithPendingItem />
    </div>
    <div>
      <Caption>Spinner enlarged ×1, ×3, ×6</Caption>
      <ScaledSpinners />
    </div>
  </Canvas>
)

const meta = {
  title: 'Tessera/UI/Loading animations',
  tags: ['done'],
  component: SideBySideDemo,
  args: { slowdown: 1 },
  argTypes: {
    slowdown: { control: { type: 'range', min: 1, max: 8, step: 1 } },
  },
} satisfies Meta<typeof SideBySideDemo>

export default meta

type Story = StoryObj<typeof meta>

export const LoadingAnimationsSideBySide: Story = { name: 'Side by side' }

export const LoadingAnimationsSlowMotion: Story = {
  name: 'Side by side — slow motion',
  args: { slowdown: 4 },
}

export const LoadingAnimationsLargeButtons: Story = {
  name: 'Large buttons',
  render: args => <LargeButtonsDemo {...args} />,
}

export const LoadingAnimationsMenuSpinner: Story = {
  name: 'Menu item spinner',
  render: args => <MenuSpinnerDemo {...args} />,
}
