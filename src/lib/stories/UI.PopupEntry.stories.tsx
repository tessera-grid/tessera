import { useId } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { dataExportLabels } from '../plugins/dataExport/labels'
import { failureLogLabels } from '../plugins/failureLog/labels'
import { Bubble } from '../ui/Bubble'
import { ItemButton } from '../ui/Popup/ItemButton'
import { useIcons } from '../ui/icons'
import popupStyles from '../ui/Popup/Popup.module.css'
import { PopupEntry } from '../ui/Popup/PopupEntry'
import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Запись поповера со списком (ADR 0178, §8) — облачко журнала ошибок и пульта несохранённых
 * изменений: точка слева, подпись, время и кнопки записи в строке, под ней — причина. С
 * переходом к цели подпись — кнопка. Тон, текст, переход и кнопки — в панели.
 */
interface EntryStoryArgs {
  tone: 'error' | 'draft'
  /** Подсказка точки (ADR 0224); пусто — без неё. */
  markHint?: string
  /** Пусто — «правка ячейки» и цель записи из словаря таблицы. */
  label?: string
  reason: string
  showable: boolean
  actions: boolean
  /** Строка ошибки действия записи; пусто — без неё. */
  error?: string
}

/** Подписи записей, как у журнала: действие и цель — «Возраст · строка 12». */
const useEntryLabels = () => {
  const labels = useStoryLabels()
  const editing = cellEditingLabels(labels)
  return {
    editCell: `${editing.editCell} ${labels.failureTargetCell('Age', 12)}`,
    export: dataExportLabels(labels).export,
    draft: `${editing.cellDraftKind} ${labels.failureTargetCell('City', 4)}`,
    retry: labels.failureRetry,
    close: failureLogLabels(labels).failureClose,
    log: failureLogLabels(labels).failureLog,
  }
}

const Entry = ({
  tone,
  markHint,
  label,
  reason,
  showable,
  actions,
  error,
}: EntryStoryArgs) => {
  const icons = useIcons()
  const texts = useEntryLabels()
  return (
    <PopupEntry
      mark={<Bubble size="dot" tone={tone} />}
      markHint={markHint || undefined}
      label={label || texts.editCell}
      onShow={showable ? () => {} : undefined}
      error={error || undefined}
      aside={
        <time
          dateTime="2026-03-12T09:30:00"
          style={{
            flex: 'none',
            color: 'var(--tsr-comp-popup-group-label-color)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          09:30
        </time>
      }
      actions={
        actions ? (
          <>
            <ItemButton label={texts.retry}>
              <icons.retry />
            </ItemButton>
            <ItemButton label={texts.close}>
              <icons.clear />
            </ItemButton>
          </>
        ) : undefined
      }
    >
      {reason || undefined}
    </PopupEntry>
  )
}

const EntryList = ({ entries }: { entries: EntryStoryArgs[] }) => {
  const titleId = useId()
  const texts = useEntryLabels()
  return (
    <PopupCanvas height={320}>
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="start" />}
          popup={
            <Popover.Popup
              aria-labelledby={titleId}
              initialFocus={false}
              style={{ width: 320 }}
            />
          }
        >
          <PopupPanel title={texts.log} titleId={titleId}>
            <div className={popupStyles.cardsScroll}>
              <div
                role="list"
                aria-label={texts.log}
                style={{
                  display: 'grid',
                  gap: 'var(--tsr-comp-popup-padding)',
                }}
              >
                {entries.map((entry, index) => (
                  <div key={index} role="listitem">
                    <Entry {...entry} />
                  </div>
                ))}
              </div>
            </div>
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/Entry',
  args: {
    tone: 'error',
    reason: 'The server refused the value: the age must be under 120.',
    showable: true,
    actions: true,
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['error', 'draft'],
      description: 'A refusal or an unsaved change',
    },
    markHint: {
      control: 'text',
      description: 'Dot tooltip on hover; empty means none',
    },
    label: { control: 'text', description: 'Entry label' },
    reason: { control: 'text', description: 'Reason; empty means none' },
    showable: { control: 'boolean', description: 'Click to go to the target' },
    actions: { control: 'boolean', description: 'Entry buttons' },
    error: {
      control: 'text',
      description: 'Error line of a failed entry action; empty means none',
    },
  },
  render: args => <EntryList entries={[args]} />,
} satisfies Meta<EntryStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupEntryPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'tone',
    'markHint',
    'label',
    'reason',
    'showable',
    'actions',
    'error',
  ),
}

/** Переход к цели не удался (ADR 0227, §7): строка ошибки под причиной. */
export const PopupEntryError: Story = {
  name: 'Action failed',
  parameters: noControls(),
  render: function Render(args) {
    const labels = useStoryLabels()
    return (
      <EntryList
        entries={[{ ...args, error: failureLogLabels(labels).targetNotFound }]}
      />
    )
  },
}

/** Список записей, как в журнале ошибок и пульте изменений. */
export const PopupEntryList: Story = {
  name: 'List',
  parameters: noControls(),
  render: function Render() {
    const texts = useEntryLabels()
    return (
      <EntryList
        entries={[
          {
            tone: 'error',
            label: texts.editCell,
            reason: 'The server refused the value.',
            showable: true,
            actions: true,
          },
          {
            tone: 'error',
            label: texts.export,
            reason: 'The file could not be created.',
            showable: false,
            actions: true,
          },
          {
            tone: 'draft',
            label: texts.draft,
            reason: '',
            showable: true,
            actions: false,
          },
        ]}
      />
    )
  },
}
