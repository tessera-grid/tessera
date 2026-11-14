import { useId } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { unsavedChangesLabels } from '../plugins/unsavedChanges/labels'
import { Button } from '../ui/Button'
import { PopupPanel } from '../ui/Popup/PopupPanel'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Поповер-панель (ADR 0183, PK2; ADR 0017, PP11–PP13): заголовок, содержимое и кнопки внизу на
 * двойном поле от краёв, без линии над кнопками. Заголовок, кнопки и подпись в их ряду — в панели.
 */
interface PanelStoryArgs {
  /** Не задан — «Несохранённое изменение» из словаря таблицы; пусто — без заголовка. */
  title?: string
  body: string
  buttons: 0 | 1 | 2
  footerLabel: string
}

const PanelStory = ({ title, body, buttons, footerLabel }: PanelStoryArgs) => {
  const titleId = useId()
  const labels = useStoryLabels()
  const drafts = unsavedChangesLabels(labels)
  const heading =
    title === undefined ? cellEditingLabels(labels).cellDraft : title
  return (
    <PopupCanvas>
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="start" />}
          popup={
            <Popover.Popup
              initialFocus={false}
              aria-labelledby={heading ? titleId : undefined}
              aria-label={heading ? undefined : 'Panel'}
              style={{ width: 280 }}
            />
          }
        >
          <PopupPanel
            title={heading || undefined}
            titleId={titleId}
            footer={
              buttons > 0 || footerLabel ? (
                <>
                  {footerLabel && (
                    <span
                      style={{
                        marginInlineEnd: 'auto',
                        paddingInlineStart:
                          'var(--tsr-comp-popup-item-padding-x)',
                        alignSelf: 'center',
                      }}
                    >
                      {footerLabel}
                    </span>
                  )}
                  {buttons > 1 && (
                    <Button variant="ghost" tone="danger">
                      {drafts.draftDiscard}
                    </Button>
                  )}
                  {buttons > 0 && (
                    <Button variant="outline">{drafts.draftApply}</Button>
                  )}
                </>
              ) : undefined
            }
          >
            <p
              style={{
                margin: 0,
                padding: '0 var(--tsr-comp-popup-item-padding-x)',
              }}
            >
              {body}
            </p>
          </PopupPanel>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/Panel',
  args: {
    body: 'The value was changed and is not saved yet.',
    buttons: 2,
    footerLabel: '',
  },
  argTypes: {
    title: { control: 'text', description: 'Title; empty — no title' },
    body: { control: 'text', description: 'Content' },
    buttons: {
      control: 'inline-radio',
      options: [0, 1, 2],
      description: 'Number of buttons at the bottom',
    },
    footerLabel: {
      control: 'text',
      description: 'A label on the left of the button row',
    },
  },
  render: args => <PanelStory {...args} />,
} satisfies Meta<PanelStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupPanelPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('title', 'body', 'buttons', 'footerLabel'),
}

export const PopupPanelNoTitle: Story = {
  name: 'Without title',
  parameters: noControls(),
  args: { title: '', buttons: 1 },
}

export const PopupPanelNoButtons: Story = {
  name: 'Without buttons',
  parameters: noControls(),
  args: { body: 'More than 15 visits.', buttons: 0 },
  render: function Render(args) {
    return <PanelStory {...args} title={useStoryLabels().cellError} />
  },
}

export const PopupPanelFooterLabel: Story = {
  name: 'Label in the button row',
  parameters: noControls(),
  args: { title: '', buttons: 1 },
  render: function Render(args) {
    const selected = columnVisibilityLabels(useStoryLabels()).selectedColumns(6)
    return <PanelStory {...args} footerLabel={selected} />
  },
}
