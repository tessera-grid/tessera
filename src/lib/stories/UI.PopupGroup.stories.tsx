import { Menu } from '@base-ui/react/menu'
import { Meta, StoryObj } from '@storybook/react'

import { cellSelectionLabels } from '../plugins/cellSelection/labels'
import { columnPinningLabels } from '../plugins/columnPinning/labels'
import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { PopupGroup } from '../ui/Popup/PopupGroup'
import { PopupItem } from '../ui/Popup/PopupItem'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Группа пунктов поповера (ADR 0183, PK4): подпись группы и линия над ней — между группами, не над
 * первой. Подпись и линия второй группы — в панели.
 */
interface GroupStoryArgs {
  /** Не задана — «Закрепить колонку» из словаря таблицы; пусто — без подписи. */
  label?: string
  divided: boolean
}

/** Подписи групп и пунктов — из словаря таблицы, как в меню колонки. */
const useGroupTexts = () => {
  const labels = useStoryLabels()
  const sorting = columnSortingLabels(labels)
  const pinning = columnPinningLabels(labels)
  return {
    menu: labels.headerMenu,
    sort: sorting.actionSort,
    sortItems: [sorting.sortAscending, sorting.sortDescending],
    pin: pinning.pin,
    pinItems: [pinning.pinLeft, pinning.pinRight],
    copy: cellSelectionLabels(labels).copy,
    hide: columnVisibilityLabels(labels).hideColumn,
  }
}

const Items = ({ labels }: { labels: string[] }) =>
  labels.map(label => (
    <PopupItem key={label} wrap render={<Menu.Item />} label={label} />
  ))

const meta = {
  title: 'Tessera/UI/Popup/Group',
  args: { divided: true },
  argTypes: {
    label: { control: 'text', description: 'Label of the second group' },
    divided: {
      control: 'boolean',
      description: 'Divider above the second group',
    },
  },
  render: function Render({ label, divided }) {
    const texts = useGroupTexts()
    return (
      <PopupCanvas kind="menu">
        <Menu.Portal>
          <PopupSurface
            positioner={<Menu.Positioner side="bottom" align="start" />}
            popup={
              <Menu.Popup aria-label={texts.menu} style={{ width: 240 }} />
            }
          >
            <PopupGroup
              render={<Menu.Group />}
              label={texts.sort}
              labelRender={<Menu.GroupLabel />}
            >
              <Items labels={texts.sortItems} />
            </PopupGroup>
            <PopupGroup
              render={<Menu.Group />}
              label={label === undefined ? texts.pin : label || undefined}
              labelRender={<Menu.GroupLabel />}
              divided={divided}
            >
              <Items labels={texts.pinItems} />
            </PopupGroup>
          </PopupSurface>
        </Menu.Portal>
      </PopupCanvas>
    )
  },
} satisfies Meta<GroupStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupGroupPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('label', 'divided'),
}

/** Группы без подписей: делит только линия. */
export const PopupGroupWithoutLabels: Story = {
  name: 'Without labels',
  parameters: noControls(),
  render: function Render() {
    const texts = useGroupTexts()
    return (
      <PopupCanvas kind="menu">
        <Menu.Portal>
          <PopupSurface
            positioner={<Menu.Positioner side="bottom" align="start" />}
            popup={
              <Menu.Popup aria-label={texts.menu} style={{ width: 240 }} />
            }
          >
            <PopupGroup render={<Menu.Group />}>
              <Items labels={[texts.copy, texts.pin]} />
            </PopupGroup>
            <PopupGroup render={<Menu.Group />} divided>
              <Items labels={[texts.hide]} />
            </PopupGroup>
          </PopupSurface>
        </Menu.Portal>
      </PopupCanvas>
    )
  },
}
