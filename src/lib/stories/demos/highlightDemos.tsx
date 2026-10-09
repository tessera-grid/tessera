/**
 * Демо публичной подсветки (ADR 0080). Внешний плагин удаления строк подсвечивает
 * строку через `table.highlight`, пока человек подтверждает удаление; поиск отмечает
 * совпадения группой `search`; кнопки — вспышка ячейки и блик колонки.
 */
import { useCallback, useMemo, useState } from 'react'

import { Trash2 } from 'lucide-react'

import { definePlugin, readPluginHooks } from '../../core/definePlugin'
import type { RowAction } from '../../core/headerActions'
import type {
  HighlightHandle,
  HighlightOptions,
  HighlightTarget,
} from '../../core/highlights/highlightFeature'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { getData } from '../__mocks__/data'
import {
  DemoButton,
  DemoInput,
  DemoItem,
  DemoNote,
  DemoPanel,
} from './DemoPanel'

type DemoRow = ReturnType<typeof getData>[number]

interface HighlightApi {
  highlight: (
    target: HighlightTarget,
    options?: HighlightOptions,
  ) => HighlightHandle
  clearHighlights: (key?: string) => void
  getHooks: () => unknown
}

interface DeleteRowsOptions {
  enabled?: boolean
  /** Спросить человека; `true` — удалить. */
  confirmDelete: (row: DemoRow) => Promise<boolean>
  /** Таблица для кнопок демо над гридом. */
  onTable: (table: HighlightApi | null) => void
}

const deleteRow: RowAction = {
  id: 'deleteRow',
  slot: 'actionRowSlot',
  order: 0,
  icon: () => <Trash2 width={16} height={16} />,
  label: () => 'Удалить',
  onSelect: ctx => {
    const table = ctx.table as unknown as HighlightApi
    const row = ctx.row.original as DemoRow
    const { confirmDelete } = readPluginHooks<
      Pick<DeleteRowsOptions, 'confirmDelete'>
    >(table, 'deleteRowsDemo')
    // Строка подсвечена, пока решение не принято.
    table.highlight(
      { row: ctx.row.id },
      {
        tone: 'danger',
        until: confirmDelete(row),
        label: `Строка «${row.firstName} ${row.lastName}» будет удалена`,
      },
    )
  },
}

/** Плагин приложения: действие строки «Удалить» с подтверждением. */
const deleteRowsDemo = definePlugin<DeleteRowsOptions>()({
  id: 'deleteRowsDemo',
  hooks: o => ({ confirmDelete: o.confirmDelete }),
  slotActions: [deleteRow],
  setup: o => table => {
    o.onTable(table as HighlightApi)
    return () => o.onTable(null)
  },
})

interface Pending {
  row: DemoRow
  resolve: (ok: boolean) => void
}

/** «1 строку», «2 строки», «5 строк». */
const rows = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'строку'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'строки'
        : 'строк'
  return `${count} ${word}`
}

const SEARCH_COLUMNS = ['firstName', 'lastName', 'country'] as const

export const HighlightDemo = (args: StoryProps) => {
  const [data, setData] = useState<DemoRow[]>(() => getData(30))
  const [table, setTable] = useState<HighlightApi | null>(null)
  // Строки, ожидающие подтверждения удаления: решение одно на всех.
  const [pending, setPending] = useState<Pending[]>([])
  const [decisions] = useState(() => new Map<string, Promise<boolean>>())
  const [query, setQuery] = useState('')
  const [columnShimmer, setColumnShimmer] = useState<HighlightHandle | null>(
    null,
  )

  const confirmDelete = useCallback(
    (row: DemoRow) => {
      // Повторный клик по той же строке — то же решение.
      const known = decisions.get(row.id)
      if (known) return known
      const decision = new Promise<boolean>(resolve =>
        setPending(prev => [...prev, { row, resolve }]),
      )
      decisions.set(row.id, decision)
      void decision.then(ok => {
        decisions.delete(row.id)
        setPending(prev => prev.filter(item => item.row.id !== row.id))
        if (ok) setData(prev => prev.filter(item => item.id !== row.id))
      })
      return decision
    },
    [decisions],
  )
  const decideAll = (ok: boolean) => pending.forEach(item => item.resolve(ok))

  const plugins = useMemo(
    () => [deleteRowsDemo({ confirmDelete, onTable: setTable })],
    [confirmDelete],
  )

  const search = (text: string) => {
    setQuery(text)
    if (!table) return
    table.clearHighlights('search')
    const needle = text.trim().toLowerCase()
    if (!needle) return
    for (const row of data) {
      for (const column of SEARCH_COLUMNS) {
        if (String(row[column]).toLowerCase().includes(needle)) {
          table.highlight(
            { cell: [row.id, column] },
            { key: 'search', tone: 'warning' },
          )
        }
      }
    }
  }

  const flashCell = () =>
    table?.highlight(
      { cell: [data[2]!.id, 'age'] },
      {
        tone: 'success',
        duration: 1500,
        shimmer: true,
        label: 'Возраст обновлён',
      },
    )

  const toggleColumn = () => {
    if (columnShimmer) {
      columnShimmer.clear()
      setColumnShimmer(null)
      return
    }
    setColumnShimmer(
      table?.highlight(
        { column: 'total' },
        { tone: 'success', shimmer: { repeat: 'infinite' }, key: 'column' },
      ) ?? null,
    )
  }

  const question = pending.length > 0 && (
    <DemoNote>Удалить {rows(pending.length)}?</DemoNote>
  )
  const decide = (
    <>
      <DemoButton
        tone="danger"
        disabled={pending.length === 0}
        onClick={() => decideAll(true)}
      >
        Удалить
      </DemoButton>
      <DemoButton
        disabled={pending.length === 0}
        onClick={() => decideAll(false)}
      >
        Отмена
      </DemoButton>
    </>
  )

  return (
    <div>
      <DemoPanel
        status={
          pending.length > 0 && (
            <div
              role="group"
              aria-label="Подтверждение удаления"
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
            >
              {question}
              {decide}
            </div>
          )
        }
      >
        <DemoItem
          title="Удаление строк"
          hint="Наведите на строку и нажмите корзину справа — можно в нескольких строках: они подсвечены красным, пока удаление не подтверждено или не отменено."
        >
          <div
            role="group"
            aria-label="Подтверждение удаления"
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              width: '100%',
            }}
          >
            {/* Вопрос и кнопки в одной строке: появление вопроса не меняет высоту. */}
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
              {question}
            </span>
            {decide}
          </div>
        </DemoItem>
        <DemoItem
          title="Поиск"
          hint="Совпадения в имени, фамилии и стране подсвечиваются жёлтым; новый запрос снимает прежние."
        >
          <DemoInput
            aria-label="Поиск по имени и стране"
            placeholder="Например, ar"
            value={query}
            onChange={event => search(event.target.value)}
          />
        </DemoItem>
        <DemoItem
          title="Вспышка ячейки"
          hint="Ячейка «Age» в третьей строке на полторы секунды загорается зелёным с бликом и гаснет."
        >
          <DemoButton onClick={flashCell}>Подсветить ячейку</DemoButton>
        </DemoItem>
        <DemoItem
          title="Блик колонки"
          hint="Колонка «Total» — заголовок, ячейки и футер — подсвечена, по ней бежит блик, пока не выключите."
        >
          <DemoButton pressed={!!columnShimmer} onClick={toggleColumn}>
            {columnShimmer ? 'Выключить блик' : 'Включить блик'}
          </DemoButton>
        </DemoItem>
      </DemoPanel>
      <StoryComponent
        {...args}
        bare
        dataOverride={data}
        extraPlugins={plugins}
      />
    </div>
  )
}
