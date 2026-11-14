import { useRef } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Meta, StoryObj } from '@storybook/react'

import type { TableLabels } from '../core/localization'
import { columnPinningLabels } from '../plugins/columnPinning/labels'
import { columnSortingLabels } from '../plugins/columnSorting/labels'
import { MenuSections, type MenuSectionsModel } from '../ui/Popup/MenuSections'
import { PopupItem } from '../ui/Popup/PopupItem'
import { PopupSurface } from '../ui/Popup/PopupSurface'
import type { MenuLevelModel } from '../util/menuModel'
import { PopupCanvas } from './__mocks__/PopupCanvas'
import { useStoryLabels } from './__mocks__/storyLocale'
import { defaultControls, noControls } from './__mocks__/utils/dataGridControls'

/**
 * Разделы меню (ADR 0079): уровень раздела — строка «назад» с его названием, пункты, скелет, пока
 * пункты грузятся, и строка повтора после отказа. Уровень и его состояние — в панели.
 */
interface MenuSectionsStoryArgs {
  depth: 0 | 1
  status: 'done' | 'loading' | 'failed'
}

/** Уровень меню колонки: подписи закрепления и сортировки — из словаря таблицы. */
const levelOf = (
  { depth, status }: MenuSectionsStoryArgs,
  labels: TableLabels,
): MenuLevelModel<string> => {
  const pinning = columnPinningLabels(labels)
  return {
    path: depth > 0 ? ['pin'] : [],
    title: depth > 0 ? pinning.pin : undefined,
    items:
      status === 'done'
        ? {
            status: 'done',
            items:
              depth > 0
                ? [pinning.pinLeft, pinning.pinRight, pinning.unpin]
                : [columnSortingLabels(labels).actionSort, pinning.pin],
          }
        : status === 'loading'
          ? { status: 'loading' }
          : {
              status: 'failed',
              error: new Error('The server did not answer.'),
            },
  }
}

const Sections = (args: MenuSectionsStoryArgs) => {
  const levelRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const labels = useStoryLabels()
  const sections: MenuSectionsModel<string> = {
    level: levelOf(args, labels),
    depth: args.depth,
    direction: null,
    levelRef,
    ghostRef,
    retry: () => {},
  }
  return (
    <MenuSections
      sections={sections}
      backLabel={labels.menuBack(columnPinningLabels(labels).pin)}
      failedLabel={labels.sectionLoadFailed}
      onBack={() => {}}
    >
      {actions =>
        actions.map(label => (
          <PopupItem
            key={label}
            wrap
            render={<Menu.Item closeOnClick={false} />}
            label={label}
          />
        ))
      }
    </MenuSections>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/MenuSections',
  args: { depth: 1, status: 'done' },
  argTypes: {
    depth: {
      control: 'inline-radio',
      options: [0, 1],
      description: 'Top level or a section',
    },
    status: {
      control: 'inline-radio',
      options: ['done', 'loading', 'failed'],
      description: 'Items loaded, still loading, or refused',
    },
  },
  render: function Render(args) {
    const headerMenu = useStoryLabels().headerMenu
    return (
      <PopupCanvas kind="menu" height={260}>
        <Menu.Portal>
          <PopupSurface
            positioner={<Menu.Positioner side="bottom" align="start" />}
            popup={<Menu.Popup aria-label={headerMenu} />}
          >
            <Sections key={`${args.depth}-${args.status}`} {...args} />
          </PopupSurface>
        </Menu.Portal>
      </PopupCanvas>
    )
  },
} satisfies Meta<MenuSectionsStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const MenuSectionsPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('depth', 'status'),
}

/** Раздел грузится: скелет на месте пунктов. */
export const MenuSectionsLoading: Story = {
  name: 'Loading',
  parameters: noControls(),
  args: { status: 'loading' },
}

/** Отказ загрузки раздела: строка повтора с причиной в подсказке. */
export const MenuSectionsFailed: Story = {
  name: 'Failed',
  parameters: noControls(),
  args: { status: 'failed' },
}
