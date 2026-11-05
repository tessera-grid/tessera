import { useMemo, useState } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import type { TableLabels } from '../core/localization'
import { columnDraggingLabels } from '../plugins/columnDragging/labels'
import { rowDraggingLabels } from '../plugins/rowDragging/labels'
import { DragHandle } from '../ui/DragHandle/DragHandle'
import { HandleMenuPopup } from '../ui/Popup/HandleMenuPopup'
import type { HandleMenuItemModel } from '../util/menuModel'
import { UiCanvas } from './__mocks__/UiCanvas'
import { useNoInitialPopupFocus } from './__mocks__/PopupCanvas'
import { defaultControls } from './__mocks__/utils/dataGridControls'
import { useStoryLabels } from './__mocks__/storyLocale'

/**
 * Меню ручки (ADR 0034, DA1–DA6): команды переноса без перетаскивания — открывается нажатием на
 * ручку строки или колонки. Что переносят и недоступный пункт у края — в панели.
 */
interface HandleMenuStoryArgs {
  kind: 'row' | 'column'
  atStart: boolean
}

/** Пункты меню ручки, как у таблицы: строка — вверх, вниз и к краям, колонка — влево и вправо. */
const itemsOf = (
  kind: 'row' | 'column',
  atStart: boolean,
  labels: TableLabels,
): HandleMenuItemModel[] => {
  const row = rowDraggingLabels(labels)
  const column = columnDraggingLabels(labels)
  const items =
    kind === 'row'
      ? [
          ['moveToStart', row.moveToStart],
          ['moveUp', row.moveUp],
          ['moveDown', row.moveDown],
          ['moveToEnd', row.moveToEnd],
        ]
      : [
          ['moveLeft', column.moveLeft],
          ['moveRight', column.moveRight],
        ]
  // У края недоступны шаги к нему: у строки — к началу и вверх, у колонки — влево.
  const towardStart = kind === 'row' ? 2 : 1
  return items.map(([id, label], index) => ({
    id: id!,
    label: label!,
    disabled: atStart && index < towardStart,
    onSelect: () => {},
  }))
}

const HandleMenuStory = ({ kind, atStart }: HandleMenuStoryArgs) => {
  useNoInitialPopupFocus()
  const [handle, setHandle] = useState<HTMLButtonElement | null>(null)
  const anchor = useMemo(() => ({ current: handle }), [handle])
  const labels = useStoryLabels()
  const moveLabel =
    kind === 'row'
      ? rowDraggingLabels(labels).moveRow
      : columnDraggingLabels(labels).moveColumn
  const button = (
    <span style={{ order: -1, display: 'flex' }}>
      <DragHandle
        ref={setHandle}
        aria-haspopup="menu"
        aria-expanded
        kind={kind}
        label={moveLabel}
        menu={
          handle && (
            <HandleMenuPopup
              anchor={anchor}
              label={moveLabel}
              items={itemsOf(kind, atStart, labels)}
              onClose={() => {}}
            />
          )
        }
      />
    </span>
  )
  return (
    <div style={{ height: 240 }}>
      {kind === 'row' ? (
        <UiCanvas host="row" column="Name" caption="Alice Smith" width={240}>
          {button}
        </UiCanvas>
      ) : (
        <UiCanvas host="head" caption="First name" width={200}>
          {button}
        </UiCanvas>
      )}
    </div>
  )
}

const meta = {
  title: 'Tessera/UI/Popup/HandleMenuPopup',
  args: { kind: 'row', atStart: true },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['row', 'column'],
      description: 'Ручка строки или колонки',
    },
    atStart: {
      control: 'boolean',
      description: 'Первая строка или колонка: перенос к началу недоступен',
    },
  },
  render: args => (
    <HandleMenuStory key={`${args.kind}-${args.atStart}`} {...args} />
  ),
} satisfies Meta<HandleMenuStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const HandleMenuPopupPlayground: Story = {
  name: 'Playground',
  parameters: defaultControls('kind', 'atStart'),
}
