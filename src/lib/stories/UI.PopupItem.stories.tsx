import type { ReactNode } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Meta, StoryObj } from '@storybook/react'
import { ArrowDownWideNarrow, EyeOff, Pin } from 'lucide-react'

import {
  PopupItem,
  PopupItemMark,
  type PopupItemStatus,
} from '../ui/Popup/PopupItem'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Пункт поповера (ADR 0183, PK3): значок, подпись, подсказка и метка состояния справа —
 * отмечен, раздел, ожидание, отказ, блокировка. Значок, подсказка, состояние и перенос — в панели.
 */
interface ItemStoryArgs {
  /** Пусто — «По возрастанию» из словаря таблицы. */
  label?: string
  icon: boolean
  /** Подсказка значка (ADR 0224); пусто — без неё. */
  iconHint: string
  hint: string
  status: PopupItemStatus | 'none'
  disabled: boolean
  wrap: boolean
}

const Surface = ({ children }: { children: ReactNode }) => {
  const headerMenu = useStoryLabels().headerMenu
  return (
    <PopupCanvas kind="menu">
      <Menu.Portal>
        <PopupSurface
          positioner={<Menu.Positioner side="bottom" align="start" />}
          popup={<Menu.Popup aria-label={headerMenu} style={{ width: 260 }} />}
        >
          {children}
        </PopupSurface>
      </Menu.Portal>
    </PopupCanvas>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/Item',
  args: {
    icon: true,
    iconHint: '',
    hint: '',
    status: 'checked',
    disabled: false,
    wrap: true,
  },
  argTypes: {
    label: { control: 'text', description: 'Подпись' },
    icon: { control: 'boolean', description: 'Значок слева' },
    iconHint: {
      control: 'text',
      description: 'Подсказка значка по наведению; пусто — без неё',
    },
    hint: { control: 'text', description: 'Подсказка справа от подписи' },
    status: {
      control: 'select',
      options: ['none', 'checked', 'submenu', 'pending', 'failed', 'blocked'],
      description: 'Метка состояния справа',
    },
    disabled: { control: 'boolean', description: 'Выключен' },
    wrap: {
      control: 'boolean',
      description: 'Подпись переносится, значки — по первой строке',
    },
  },
  render: function Render({
    label,
    icon,
    iconHint,
    hint,
    status,
    disabled,
    wrap,
  }) {
    const sortAscending = columnSortingLabels(useStoryLabels()).sortAscending
    return (
      <Surface>
        <PopupItem
          wrap={wrap}
          render={<Menu.Item disabled={disabled} />}
          icon={icon ? <ArrowDownWideNarrow width={16} height={16} /> : null}
          iconHint={iconHint || undefined}
          label={label || sortAscending}
          hint={hint || undefined}
          end={
            <PopupItemMark status={status === 'none' ? undefined : status} />
          }
        />
      </Surface>
    )
  },
} satisfies Meta<ItemStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const PopupItemPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls(
    'label',
    'icon',
    'iconHint',
    'hint',
    'status',
    'disabled',
    'wrap',
  ),
}

const STATES: [string, PopupItemStatus | undefined, boolean?][] = [
  ['Plain', undefined],
  ['Checked', 'checked'],
  ['Opens a section', 'submenu'],
  ['Waiting for the server', 'pending'],
  ['Refused', 'failed'],
  ['Not allowed', 'blocked', true],
  ['Disabled', undefined, true],
]

/** Каждое состояние пункта меткой справа, одно под другим. */
export const PopupItemStates: Story = {
  name: 'States',
  parameters: noControls(),
  render: () => (
    <Surface>
      {STATES.map(([label, status, disabled]) => (
        <PopupItem
          key={label}
          wrap
          render={<Menu.Item disabled={disabled} />}
          icon={<Pin width={16} height={16} />}
          label={label}
          end={<PopupItemMark status={status} />}
        />
      ))}
    </Surface>
  ),
}

/** Длинная подпись переносится, значок и метка остаются у первой строки. */
export const PopupItemLongLabel: Story = {
  name: 'Long label',
  parameters: noControls(),
  args: {
    label: 'Hide this column and every column grouped under the same header',
    hint: '',
  },
  render: ({ label }) => (
    <Surface>
      <PopupItem
        wrap
        render={<Menu.Item />}
        icon={<EyeOff width={16} height={16} />}
        label={label}
        hint="Alt+H"
        end={<PopupItemMark status="checked" />}
      />
    </Surface>
  ),
}
