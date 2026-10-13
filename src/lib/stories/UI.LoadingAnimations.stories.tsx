import { CSSProperties, ReactNode } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'
import clsx from 'clsx'

import '../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import menu from '../grid/headerActions/ActionMenu.module.css'
import { IconButton } from '../ui/IconButton'
import { LinearProgress } from '../ui/LinearProgress'
import popup from '../ui/Popup/Popup.module.css'
import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'
import ring from '../ui/ringStates/ringStates.module.css'

// Анимации загрузки в одном месте: свечение под шапкой (ADR 0094) и ожидание кнопок,
// ячейки в правке и пункта меню (ADR 0055, 0057, 0078) — одни оттенки и один ритм.
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
        padding: 24,
        background: 'var(--tsr-sys-surface)',
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

interface PendingCellProps {
  width: number
  value: string
  /** Ждёт ли ячейка сервера; без ожидания — обычная соседка. */
  pending?: boolean
  /** Фаза света от 0 до 1 — в гриде её считает ключ ячейки. */
  phase?: number
}

/** Ячейка, чьё сохранение ждёт сервера: слой ожидания поверх ячейки, как в гриде. */
const PendingCell = ({
  width,
  value,
  pending = true,
  phase = 0,
}: PendingCellProps) => (
  <div
    style={
      {
        position: 'relative',
        flex: 'none',
        width,
        height: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        boxSizing: 'border-box',
        background: 'var(--tsr-comp-row-bg)',
        borderRight: '1px solid var(--tsr-comp-cell-divider-color)',
        borderBottom: '1px solid var(--tsr-comp-cell-divider-color)',
        fontSize: 'var(--tsr-comp-cell-font-size)',
      } as CSSProperties
    }
  >
    {value}
    {pending && (
      <span
        className={clsx(ring.ring, ring.layer)}
        data-pending=""
        style={
          {
            '--tsr-pending-phase': phase,
            position: 'absolute',
            inset: 'var(--tsr-comp-focus-ring-width)',
            pointerEvents: 'none',
          } as CSSProperties
        }
      />
    )}
  </div>
)

/** Ячейки вплотную, как в строке или колонке грида. */
const CellStrip = ({
  direction,
  children,
}: {
  direction: 'row' | 'column'
  children: ReactNode
}) => (
  <div
    style={{
      display: 'inline-flex',
      flexDirection: direction,
      alignSelf: 'flex-start',
      borderTop: '1px solid var(--tsr-comp-cell-divider-color)',
      borderLeft: '1px solid var(--tsr-comp-cell-divider-color)',
    }}
  >
    {children}
  </div>
)

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
      <Caption>Editing cell — saving</Caption>
      <PendingCell width={200} value="Australia" />
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

const CellEditingDemo = ({ slowdown }: LoadingAnimationsProps) => (
  <Canvas slowdown={slowdown}>
    <div>
      <Caption>
        Two adjacent cells in a row — the middle ones are saving
      </Caption>
      <CellStrip direction="row">
        <PendingCell width={140} value="Andorra" pending={false} />
        <PendingCell width={160} value="Odell" phase={0.23} />
        <PendingCell width={160} value="Fahey" phase={0.71} />
        <PendingCell width={100} value="40" pending={false} />
      </CellStrip>
    </div>
    <div>
      <Caption>
        Two adjacent cells in a column — the top ones are saving
      </Caption>
      <CellStrip direction="column">
        <PendingCell width={200} value="Wallis and Futuna" phase={0.48} />
        <PendingCell width={200} value="Palestine" phase={0.07} />
        <PendingCell width={200} value="Poland" pending={false} />
      </CellStrip>
    </div>
    <div>
      <Caption>Cells of different width</Caption>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PendingCell width={120} value="31" phase={0.6} />
        <PendingCell width={240} value="Wallis and Futuna" phase={0.35} />
        <PendingCell
          width={480}
          value="A long comment that was just saved"
          phase={0.9}
        />
      </div>
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

export const LoadingAnimationsCellEditing: Story = {
  name: 'Editing cell',
  render: args => <CellEditingDemo {...args} />,
}

export const LoadingAnimationsMenuSpinner: Story = {
  name: 'Menu item spinner',
  render: args => <MenuSpinnerDemo {...args} />,
}
