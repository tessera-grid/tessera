import { Meta, StoryObj } from '@storybook/react'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'

/** Ядро грида: все тумблеры, скелет, загрузка, заглушка, футер. */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/DataGrid/Core',
} satisfies Meta<StoryProps>

export default meta

export const AllFeatures: StoryObj<StoryProps> = {
  name: 'All features',
  // Все тумблеры грида по группам панели Controls (общие для всех историй). Мок
  // вложенный: дети у каждой 10-й строки видны с «Раскрытием строк»; ядро и плагины
  // по умолчанию выключены.
  args: {
    dataNesting: 'nested',
    containerHeight: 600,
    height: 500,
    maxHeight: 500,
  },
}

export const Skeletons: StoryObj<StoryProps> = {
  name: 'Skeleton',
  // Скелет первой загрузки повторяет раскладку грида (ADR 0060): служебные колонки,
  // закрепление, шапку и пагинатор. Выключите enableSkeleton — данные встанут на
  // место без сдвига; skeletonOptions.rowsCount числом задаёт строки вручную.
  args: {
    // Вложенный мок: колонка раскрытия появляется, только если есть строки с детьми.
    dataNesting: 'nested',
    enableSkeleton: true,
    enableRowSelection: true,
    showSelectedCount: true,
    enableRowDragging: true,
    enableRowExpanding: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enablePagination: true,
    enableFooter: true,
  },
}

export const Loading: StoryObj<StoryProps> = {
  name: 'Loading',
  args: {
    enableLoading: true,
  },
}

export const Stub: StoryObj<StoryProps> = {
  name: 'Empty (stub)',
  args: {
    showStub: true,
  },
}

export const WithFooter: StoryObj<StoryProps> = {
  name: 'Footer',
  args: {
    enableFooter: true,
  },
}
