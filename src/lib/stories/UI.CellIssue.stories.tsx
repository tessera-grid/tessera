import { useMemo, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import type { TableLabels } from '../core/localization'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { CellIssue, type CellIssueAction } from '../ui/CellIssue/CellIssue'
import CellIssuePopup from '../ui/CellIssue/CellIssuePopup'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useNoInitialPopupFocus } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Отметка ячейки (ADR 0177, §5; ADR 0178, §6): треугольник в правом верхнем углу ячейки — отказ
 * сохранения или ошибка данных, в цвете несохранённого — черновик. Наведение — подсказка с
 * причиной, нажатие — поповер с причиной и действиями. Тон, причина и действия — в панели.
 */
interface CellIssueStoryArgs {
  tone: 'error' | 'draft'
  /** Пусто — у черновика «было и стало» из словаря таблицы. */
  reason?: string
  actions: boolean
}

/** Тексты отметки, как у таблицы: заголовки отказа и черновика, действия, было и стало. */
const issueTexts = (labels: TableLabels) => {
  const editing = cellEditingLabels(labels)
  return {
    actions: [
      {
        id: 'discard',
        label: labels.failureDiscard,
        onSelect: () => {},
        // Опасное действие — тоном, как у таблицы (ADR 0206).
        tone: 'danger',
      },
      {
        id: 'retry',
        label: labels.failureRetry,
        onSelect: () => {},
        primary: true,
      },
    ] satisfies CellIssueAction[],
    titles: { error: labels.cellNotSaved, draft: editing.cellDraft },
    draftReason: editing.cellDraftReason('42', '140'),
    was: labels.draftWas,
    now: labels.draftNow,
  }
}

const meta = {
  title: 'Tessera/UI/CellIssue',
  args: {
    tone: 'error',
    reason: 'The server refused the value: the age must be under 120.',
    actions: true,
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['error', 'draft'],
      description:
        'Отказ или ошибка — красный; несохранённое изменение — цвет черновика',
    },
    reason: { control: 'text', description: 'Причина: подсказка и поповер' },
    actions: { control: 'boolean', description: 'Действия в поповере' },
  },
  render: function Render({ tone, reason, actions }) {
    const texts = issueTexts(useStoryLabels())
    return (
      <UiCanvas host="cell" column="Age" caption="140" width={200}>
        <CellIssue
          tone={tone}
          label={texts.titles[tone]}
          reason={reason || texts.draftReason}
          actions={actions ? texts.actions : []}
        />
      </UiCanvas>
    )
  },
} satisfies Meta<CellIssueStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const CellIssuePlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('tone', 'reason', 'actions'),
}

/** Несохранённое изменение: треугольник в цвете черновика. */
export const CellIssueDraft: Story = {
  name: 'Unsaved change',
  parameters: noControls(),
  args: { tone: 'draft', reason: '' },
}

/** Поповер после нажатия на отметку: заголовок, было и стало, действия справа. */
const OpenIssue = () => {
  useNoInitialPopupFocus()
  const [button, setButton] = useState<HTMLButtonElement | null>(null)
  const anchor = useMemo(() => ({ current: button }), [button])
  const texts = issueTexts(useStoryLabels())
  return (
    <div style={{ height: 260 }}>
      <UiCanvas host="cell" column="Age" caption="140" width={200}>
        <span
          ref={node =>
            setButton(
              node?.querySelector<HTMLButtonElement>('[data-cell-draft]') ??
                null,
            )
          }
          style={{ display: 'contents' }}
        >
          <CellIssue
            tone="draft"
            label={texts.titles.draft}
            reason={texts.draftReason}
          />
        </span>
        {button && (
          <CellIssuePopup
            open
            anchor={anchor}
            tone="draft"
            title={texts.titles.draft}
            reason={texts.draftReason}
            details={[
              { label: texts.was, value: '42' },
              { label: texts.now, value: '140' },
            ]}
            actions={texts.actions}
            onClose={() => {}}
          />
        )}
      </UiCanvas>
    </div>
  )
}

export const CellIssuePopover: Story = {
  name: 'Popover open',
  parameters: noControls(),
  render: () => <OpenIssue />,
}
