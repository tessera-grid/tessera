import { useRef, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { ResizeHandler } from '../plugins/columnSizing/ResizeHandler'
import { UiCanvas } from './__mocks__/UiCanvas'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

const MIN_SIZE = 80
const MAX_SIZE = 400
const DEFAULT_SIZE = 200

interface ResizeHandlerDemoProps {
  disabled: boolean
}

/**
 * Грип ширины колонки (ADR 0013): протяжка мышью, стрелки и Home на фокусе, клик без
 * сдвига — меню ширины (ADR 0034). Здесь ширину держит демо, в гриде — TanStack.
 */
const ResizeHandlerDemo = ({ disabled }: ResizeHandlerDemoProps) => {
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [isResizing, setIsResizing] = useState(false)
  const start = useRef({ x: 0, size: DEFAULT_SIZE })
  const clamp = (value: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, value))

  const onMove = (event: MouseEvent) =>
    setSize(clamp(start.current.size + event.clientX - start.current.x))
  const stop = () => {
    setIsResizing(false)
    document.removeEventListener('mousemove', onMove)
  }

  return (
    <UiCanvas
      host="head"
      caption={`Name · ${size}px`}
      nextColumn="City"
      width={size}
    >
      <ResizeHandler
        isResizing={isResizing}
        size={size}
        minSize={MIN_SIZE}
        maxSize={MAX_SIZE}
        disabled={disabled}
        onResize={event => {
          if (disabled || !(event as MouseEvent).clientX) return
          start.current = { x: (event as MouseEvent).clientX, size }
          setIsResizing(true)
          document.addEventListener('mousemove', onMove)
        }}
        onResizeEnd={stop}
        onResizeCancel={() => {
          stop()
          setSize(start.current.size)
        }}
        onEscape={() => {
          stop()
          setSize(start.current.size)
        }}
        onResetSize={() => setSize(DEFAULT_SIZE)}
        onResizeBy={delta => setSize(prev => clamp(prev + delta))}
      />
    </UiCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/ResizeHandler',
  component: ResizeHandlerDemo,
  args: { disabled: false },
} satisfies Meta<typeof ResizeHandlerDemo>

export default meta

type Story = StoryObj<typeof meta>

export const ResizeHandlerPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('disabled'),
}

export const ResizeHandlerDisabled: Story = {
  name: 'Disabled',
  parameters: noControls(),
  args: { disabled: true },
}
