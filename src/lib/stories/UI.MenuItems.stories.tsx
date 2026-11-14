import { Menu } from '@base-ui/react/menu'
import { Meta, StoryObj } from '@storybook/react'

import type { TableLabels } from '../core/localization'
import { columnPinningLabels } from '../plugins/columnPinning/labels'
import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { MenuItems } from '../ui/Popup/MenuItems'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import type { MenuGroupModel, MenuItemModel } from '../util/menuModel'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Пункты меню действий (ADR 0024, ADR 0078, ADR 0079) — кебаб заголовка и строки, контекстное
 * меню: группы с подписью, флажок, раздел с подсказкой и шевроном, ожидание, отказ, причина
 * блокировки — значком справа, полный текст — в подсказке. Состояние пункта — в панели.
 */
type ItemState =
  'idle' | 'checked' | 'pending' | 'failed' | 'done' | 'locked' | 'disabled'

interface MenuItemsStoryArgs {
  state: ItemState
}

const item = (
  key: string,
  label: string,
  extra: Partial<MenuItemModel> = {},
): MenuItemModel => ({
  key,
  actionId: key,
  itemId: key,
  label,
  section: false,
  checkbox: false,
  active: false,
  disabled: false,
  pending: false,
  failed: false,
  checkFailed: false,
  done: false,
  locked: false,
  closeOnClick: false,
  onClick: () => {},
  ...extra,
})

const STATE: Record<ItemState, Partial<MenuItemModel>> = {
  idle: {},
  checked: { checkbox: true, active: true },
  pending: { pending: true },
  failed: { failed: true, tooltip: 'The server refused: the row is locked.' },
  done: { done: true, tooltip: 'Already sorted ascending' },
  locked: { locked: true, disabled: true, tooltip: 'Sorting is off here' },
  disabled: { disabled: true },
}

/** Пункты меню колонки: подписи сортировки и закрепления — из словаря таблицы. */
const groupsOf = (state: ItemState, labels: TableLabels): MenuGroupModel[] => [
  {
    key: 'sort',
    label: columnSortingLabels(labels).actionSort,
    divided: false,
    items: [
      item('asc', columnSortingLabels(labels).sortAscending, STATE[state]),
      item('desc', columnSortingLabels(labels).sortDescending),
    ],
  },
  {
    key: 'view',
    label: 'View',
    divided: true,
    items: [
      item('wrap', 'Wrap text', { checkbox: true }),
      item('pin', columnPinningLabels(labels).pin, {
        section: true,
        hint: columnPinningLabels(labels).pinLeft,
      }),
    ],
  },
]

const ItemsMenu = ({ groups }: { groups: MenuGroupModel[] }) => {
  const headerMenu = useStoryLabels().headerMenu
  return (
    <PopupCanvas kind="menu" height={300}>
      <Menu.Portal>
        <PopupSurface
          positioner={<Menu.Positioner side="bottom" align="start" />}
          popup={<Menu.Popup aria-label={headerMenu} style={{ width: 240 }} />}
        >
          <MenuItems groups={groups} />
        </PopupSurface>
      </Menu.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/MenuItems',
  args: { state: 'idle' },
  argTypes: {
    state: {
      control: 'select',
      options: Object.keys(STATE),
      description: 'State of the “Sort ascending” item',
    },
  },
  render: function Render({ state }) {
    return <ItemsMenu groups={groupsOf(state, useStoryLabels())} />
  },
} satisfies Meta<MenuItemsStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const MenuItemsPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('state'),
}

/** Все состояния пункта рядом. */
export const MenuItemsStates: Story = {
  name: 'States',
  parameters: noControls(),
  render: () => (
    <ItemsMenu
      groups={[
        {
          key: 'states',
          divided: false,
          items: (Object.keys(STATE) as ItemState[]).map(state =>
            item(state, `${state[0]!.toUpperCase()}${state.slice(1)}`, {
              ...STATE[state],
            }),
          ),
        },
      ]}
    />
  ),
}
