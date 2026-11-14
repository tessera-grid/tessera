import { useState } from 'react'
import { Meta, StoryObj } from '@storybook/react'
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Ellipsis,
  FileDown,
  Grip,
  ListFilter,
  SlidersHorizontal,
} from 'lucide-react'
import { expect } from 'storybook/test'
import type { IconComponent } from '../ui/icons'
import type { StoryProps } from './DataGridStory.types'
import { StoryComponent } from './DataGridStory'
import { dataGridMeta } from './dataGridMeta'
import { guideNext, settle, until, waitForRows } from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import { normalizeArgs } from './__mocks__/utils/normalizeArgs'
import { GuideStory, type GuideStoryStep, guideArgs } from './demos/GuideStory'
import { WithConsole } from './demos/StoryConsole'
import { createConsoleLog } from './demos/consoleLog'

/**
 * Иконки таблицы (ADR 0017, IC3): приложение заменяет иконки по ключу пропом `icons`,
 * остальные — встроенные. `Playground` — песочница, S1 — сценарий.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Customization/Icons',
  argTypes: { ...dataGridMeta.argTypes, icons: { control: false } },
} satisfies Meta<StoryProps>

export default meta

const NOT_ICONS = 'Does not affect icons'

/** Свой набор приложения: сортировка, фильтр, перетаскивание, меню, выгрузка. */
/** Иконка набора приложения с меткой: по ней видно, что таблица показала свою иконку. */
const own = (Icon: IconComponent): IconComponent =>
  function OwnIcon(props) {
    return <Icon {...props} data-own-icon="" />
  }

const OWN_ICONS = {
  sort: own(ArrowUpDown),
  sortAsc: own(ArrowUpNarrowWide),
  sortDesc: own(ArrowDownWideNarrow),
  filter: own(SlidersHorizontal),
  filterActive: own(ListFilter),
  drag: own(Grip),
  menu: own(Ellipsis),
  download: own(FileDown),
}

/** Плагины, у кнопок которых есть иконки. */
const WITH_ICONS = {
  enableColumnSorting: true,
  enableColumnFiltering: true,
  enableRowDragging: true,
  enableRowActions: true,
  enableRowActionMenu: true,
  enableDataExport: true,
} satisfies Partial<StoryProps>

/** Таблица со своими иконками приложения; тумблеры показывают кнопки с иконками. */
export const IconsPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  parameters: showControls(Object.keys(WITH_ICONS), {
    columnCount: NOT_ICONS,
    dataCount: NOT_ICONS,
    containerHeight: NOT_ICONS,
    height: NOT_ICONS,
    maxHeight: NOT_ICONS,
    rowHeight: NOT_ICONS,
    headerHeight: NOT_ICONS,
    defaultColumn: NOT_ICONS,
  }),
  args: { ...WITH_ICONS, icons: OWN_ICONS },
  render: function Render(args) {
    const [consoleLog] = useState(createConsoleLog)
    return (
      <WithConsole log={consoleLog} args={args}>
        <StoryComponent {...normalizeArgs(args)} />
      </WithConsole>
    )
  },
}

// --- S1 ------------------------------------------------------------------------------

/** Иконки набора приложения в таблице — по их метке: встроенные по тем же ключам другие. */
const ownIcons = (root: ParentNode) =>
  root.querySelectorAll('svg[data-own-icon]').length

const OWN_SET: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Иконки по умолчанию', en: 'Default icons' },
    hint: {
      ru: 'Таблица отображает встроенные иконки кнопок сортировки, фильтра, перетаскивания, меню и выгрузки.',
      en: 'The table shows the built-in icons on the sort, filter, drag, menu, and export buttons.',
    },
  },
  {
    title: { ru: 'Свои иконки приложения', en: "The app's own icons" },
    hint: {
      ru: 'Приложение передало таблице свой набор иконок. Таблица заменила ими встроенные, остальные иконки остались по умолчанию.',
      en: 'The app passed its own icon set to the table. The table replaced the built-in icons with it; the other icons kept their defaults.',
    },
    props: () => ({ icons: OWN_ICONS }),
  },
]

/** S1: приложение подменяет иконки таблицы своими. */
export const IconsOwnSet: StoryObj<StoryProps> = {
  name: 'Own icons',
  parameters: {
    scenario: '0017/S1',
    ...guideControls(),
  },
  render: args => (
    <GuideStory
      title={{ ru: 'Свои иконки', en: 'Custom icons' }}
      steps={OWN_SET}
      args={guideArgs(WITH_ICONS, args)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    // В Storybook сценарий проходит человек; `play` — только в тестах каталога.
    if (globals.catalog !== true) return
    await step(OWN_SET[0]!.title.ru, async () => {
      await waitForRows(canvas)
      await expect(ownIcons(canvas)).toBe(0)
    })
    await step(OWN_SET[1]!.title.ru, async () => {
      await guideNext(canvas)
      await until(() => expect(ownIcons(canvas)).toBeGreaterThan(0))
      await settle()
    })
  },
}
