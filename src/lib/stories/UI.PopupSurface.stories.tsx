import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Meta, StoryObj } from '@storybook/react'

import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { columnVisibilityLabels } from '../plugins/columnVisibility/labels'
import { PopupItem } from '../ui/Popup/PopupItem'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Поверхность поповера (ADR 0183, PK1): фон, тень, скругление, поле и зазор до якоря — одни
 * у поповеров, меню и списков. Сторона и выравнивание — в панели.
 */
interface SurfaceStoryArgs {
  side: 'top' | 'bottom' | 'left' | 'right'
  align: 'start' | 'center' | 'end'
  text: string
}

const meta = {
  title: 'Tessera/UI/Popup/Surface',
  args: {
    side: 'bottom',
    align: 'start',
    text: 'Any content of a popover sits on this surface.',
  },
  argTypes: {
    side: {
      control: 'inline-radio',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'Сторона якоря',
    },
    align: {
      control: 'inline-radio',
      options: ['start', 'center', 'end'],
      description: 'Выравнивание по якорю',
    },
    text: { control: 'text', description: 'Содержимое' },
  },
  render: ({ side, align, text }) => (
    <PopupCanvas>
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side={side} align={align} />}
          popup={<Popover.Popup aria-label="Surface" initialFocus={false} />}
        >
          <p style={{ margin: 0, padding: 8, maxWidth: 240 }}>{text}</p>
        </PopupSurface>
      </Popover.Portal>
    </PopupCanvas>
  ),
} satisfies Meta<SurfaceStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupSurfacePlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('side', 'align', 'text'),
}

/** Та же поверхность у меню: примитив другой, вид один. */
export const PopupSurfaceMenu: Story = {
  name: 'Menu',
  parameters: noControls(),
  render: function Render() {
    const labels = useStoryLabels()
    const sorting = columnSortingLabels(labels)
    const items = [
      sorting.sortAscending,
      sorting.sortDescending,
      columnVisibilityLabels(labels).hideColumn,
    ]
    return (
      <PopupCanvas kind="menu">
        <Menu.Portal>
          <PopupSurface
            positioner={<Menu.Positioner side="bottom" align="start" />}
            popup={<Menu.Popup aria-label={labels.headerMenu} />}
          >
            {items.map(label => (
              <PopupItem
                key={label}
                wrap
                render={<Menu.Item />}
                label={label}
              />
            ))}
          </PopupSurface>
        </Menu.Portal>
      </PopupCanvas>
    )
  },
}
