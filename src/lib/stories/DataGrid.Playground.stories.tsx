import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Песочница грида: все фичи и все тумблеры вместе — любое их сочетание. Сценарии каждой
 * фичи — в её разделе.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Playground',
} satisfies Meta<StoryProps>

export default meta

export const DataGridPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  // Все тумблеры грида по группам панели Controls (общие для всех историй). Мок
  // вложенный: дети у каждой 10-й строки видны с «Раскрытием строк»; ядро и плагины
  // по умолчанию выключены.
  args: {
    dataNesting: 'nested',
    containerHeight: '600',
    height: '500',
    maxHeight: '500',
  },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}
