import { CSSProperties, useState } from 'react'

import { Toolbar } from '@base-ui/react/toolbar'
import { Meta, StoryObj } from '@storybook/react'

import '../core/themeVariables/theme.css'
import { DATA_GRID_THEME_CLASS } from '../core/themeVariables'
import { IconButton } from '../ui/IconButton'
import { ToolbarButton } from '../ui/ToolbarButton'
import { useIcons } from '../ui/icons'

// Ожидание и вспышка ошибки базовых кнопок (ADR 0055) на круглых и квадратных кнопках
// разных размеров. «Pending» запускает ожидание (блик по контуру), «Succeed» его
// снимает, «Fail» снимает и вспыхивает цветом ошибки: default → pending → error → default.

const ROUND_ICON_SIZES = [16, 20, 28]
const SQUARE_SIZES = [24, 32, 40]

const ButtonStatesDemo = () => {
  const { expand: Expand, download: Download } = useIcons()
  const [pending, setPending] = useState(false)
  const [failures, setFailures] = useState(0)

  const state = { pending, errorFlash: failures }

  return (
    <div
      className={DATA_GRID_THEME_CLASS}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 24,
        background: 'var(--tsr-sys-surface)',
        color: 'var(--tsr-sys-fg)',
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => setPending(true)}
        >
          Pending
        </button>
        <button
          type="button"
          disabled={!pending}
          onClick={() => setPending(false)}
        >
          Succeed
        </button>
        <button
          type="button"
          disabled={!pending}
          onClick={() => {
            setPending(false)
            setFailures(n => n + 1)
          }}
        >
          Fail
        </button>
        <span>
          State: <b>{pending ? 'pending' : 'default'}</b>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {ROUND_ICON_SIZES.map(size => (
          <IconButton key={size} aria-label={`Expand ${size}`} {...state}>
            <Expand width={size} height={size} />
          </IconButton>
        ))}
      </div>

      <Toolbar.Root style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {SQUARE_SIZES.map(size => (
          <span
            key={size}
            style={
              { '--tsr-comp-toolbar-button-size': `${size}px` } as CSSProperties
            }
          >
            <ToolbarButton
              label={`Export ${size}`}
              icon={<Download width={size * 0.55} height={size * 0.55} />}
              {...state}
            />
          </span>
        ))}
      </Toolbar.Root>
    </div>
  )
}

const meta = {
  title: 'Tessera/UI/Button states',
  component: ButtonStatesDemo,
} satisfies Meta<typeof ButtonStatesDemo>

export default meta

export const ButtonStates: StoryObj<typeof ButtonStatesDemo> = {
  name: 'Pending shine & error flash',
}
