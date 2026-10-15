// Общий meta историй DataGrid: дефолтные аргументы и render. Без `play`: история не
// проигрывает чужой сценарий (ADR 0117, SN12).
import { Meta } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import {
  COLUMN_COUNT,
  DATA_COUNT,
  type StoryProps,
} from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import {
  dataGridArgTypes,
  dataGridDefaultArgs,
} from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'

// Файл историй повторяет `parameters: { ...dataGridMeta.parameters }` явно: addon-docs
// пишет описание из JSDoc в `meta.parameters` и параметры, пришедшие спредом, теряет.
export const dataGridMeta = {
  args: {
    columnCount: COLUMN_COUNT,
    dataCount: DATA_COUNT,
    ...dataGridDefaultArgs,
  },
  // Все контролы; история показывает свои через `showControls` (ADR 0117).
  argTypes: dataGridArgTypes,
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    controls: {
      expanded: true,
      exclude: ['colorMode'],
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return <StoryComponent {...normalizeArgs(args)} updateArgs={updateArgs} />
  },
} satisfies Meta<StoryProps>
