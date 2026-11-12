/**
 * Вклад textWrap в тело (ADR 0218, §1–4): атрибут переноса и свой предел строк у ячейки,
 * проба замера в ячейке колонки `autoHeight`, число строк в высоте строки и колонки, которые
 * рисуются вне окна, — хуком корня.
 */
import { useLayoutEffect, useRef } from 'react'

import { setMeasuringColumns } from '../../core/autosize'
import { setHeadColumns } from '../../core/headSizes'
import type {
  BodyContributions,
  RootHookProps,
} from '../../core/bodyContributions'
import {
  disposeHeadMeasurer,
  disposeMeasurer,
  headMeasurerOf,
  measurerOf,
} from './measure'
import {
  headWrapModeOf,
  maxLinesOf,
  type TextWrapColumnDef,
  wrapModeOf,
} from './textWrapFeature'

const OWNER = 'textWrap'

/**
 * Проба в ячейке колонки `autoHeight`: отдаёт обёртку содержимого ячейки замеру. Живёт со
 * своей ячейкой: новая копия `table` на смену состояния пробу не пересоздаёт.
 */
const Probe = ({ table }: { table: unknown }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const store = (table as { store: object }).store
  // Без зависимостей: ячейка перерисована — обёртка содержимого могла смениться.
  useLayoutEffect(() => {
    const node = ref.current
    if (node) measurerOf(table).track(node)
  })
  useLayoutEffect(() => {
    const node = ref.current
    return () => {
      if (node) measurerOf(table).untrack(node)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- на хранилище таблицы
  }, [store])
  return <span ref={ref} hidden data-text-wrap-probe="" />
}

/** Проба в ячейке заголовка `autoHeaderHeight`: отдаёт обёртку подписи замеру шапки. */
const HeadProbe = ({ table }: { table: unknown }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const store = (table as { store: object }).store
  useLayoutEffect(() => {
    const node = ref.current
    if (node) headMeasurerOf(table).track(node)
  })
  useLayoutEffect(() => {
    const node = ref.current
    return () => {
      if (node) headMeasurerOf(table).untrack(node)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- на хранилище таблицы
  }, [store])
  return <span ref={ref} hidden data-text-wrap-probe="" />
}

const columnDefOf = (table: unknown, columnId: string) =>
  ((
    table as {
      getColumn: (id: string) => { columnDef: TextWrapColumnDef } | undefined
    }
  ).getColumn(columnId)?.columnDef ?? {}) as TextWrapColumnDef

/** Строк текста в высоте строки: высота без отступов по высоте на высоту строки текста. */
const fitLines = (scroller: HTMLElement, heightVar: string) => {
  const style = getComputedStyle(scroller)
  const rowHeight = parseFloat(style.getPropertyValue(heightVar))
  const padding = parseFloat(
    style.getPropertyValue('--tsr-comp-cell-wrap-padding-y'),
  )
  const lineHeight = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  )
  if (!(rowHeight > 0) || !(lineHeight > 0)) return 1
  return Math.max(
    1,
    Math.floor((rowHeight - 2 * (padding || 0) + 0.5) / lineHeight),
  )
}

const useTextWrapRoot = ({ table, getScrollElement }: RootHookProps) => {
  const ids = (
    table.getAllLeafColumns() as { id: string; columnDef: TextWrapColumnDef }[]
  )
    .filter(column => wrapModeOf(column.columnDef) === 'auto')
    .map(column => column.id)
  const key = ids.join('\n')
  // Заголовки `autoHeaderHeight` — их листья: шапка рисует их и вне окна колонок (§10).
  const headIds = (
    table.getAllColumns() as {
      columnDef: TextWrapColumnDef
      getLeafColumns: () => { id: string }[]
    }[]
  )
    .filter(column => headWrapModeOf(column.columnDef) === 'auto')
    .flatMap(column => column.getLeafColumns().map(leaf => leaf.id))
  const headKey = headIds.join('\n')
  const headMaxLines = table.options.textWrapHeaderMaxLines
  const store = (table as { store: object }).store
  const maxLines = table.options.textWrapMaxLines

  // Колонки `autoHeight` рисуются и вне окна колонок (ADR 0218, §4).
  useLayoutEffect(() => {
    setMeasuringColumns(table, key ? key.split('\n') : [], OWNER)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по составу колонок
  }, [store, key])

  useLayoutEffect(() => {
    setHeadColumns(table, headKey ? headKey.split('\n') : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по составу колонок
  }, [store, headKey])

  // Число строк в высоте строки и предел строк по умолчанию — на области прокрутки.
  useLayoutEffect(() => {
    const scroller = getScrollElement()
    if (!scroller) return
    scroller.style.setProperty(
      '--tsr-text-wrap-fit',
      String(fitLines(scroller, '--tsr-comp-row-height')),
    )
    scroller.style.setProperty(
      '--tsr-text-wrap-head-fit',
      String(fitLines(scroller, '--tsr-comp-head-row-height')),
    )
    if (headMaxLines !== undefined) {
      scroller.style.setProperty(
        '--tsr-text-wrap-head-max-lines',
        String(headMaxLines),
      )
    }
    if (maxLines === undefined) {
      scroller.style.removeProperty('--tsr-text-wrap-max-lines')
    } else {
      scroller.style.setProperty('--tsr-text-wrap-max-lines', String(maxLines))
    }
  })

  // Плагин снят или грид размонтирован: высоты забыты, окно колонок прежнее.
  useLayoutEffect(
    () => () => {
      setMeasuringColumns(table, [], OWNER)
      setHeadColumns(table, [])
      disposeMeasurer(table)
      disposeHeadMeasurer(table)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- на хранилище таблицы
    [store],
  )
}

export const textWrapBody: BodyContributions = {
  cell: {
    id: 'textWrap',
    slices: [],
    // Свой предел строк колонки — переменной стиля ячейки.
    select: (_state, { cell }) =>
      maxLinesOf(cell.column.columnDef as TextWrapColumnDef) ?? null,
    render: maxLines =>
      maxLines === null
        ? null
        : { style: { '--tsr-text-wrap-max-lines': String(maxLines) } },
    // Вид переноса — слоем: он считается на каждую отрисовку ячейки и следует за сменой
    // колонок на лету; проба замера — в ячейке колонки `autoHeight`, кроме скелета.
    layer: ({ table, columnId, skeleton }) => {
      const mode = wrapModeOf(columnDefOf(table, columnId))
      if (!mode) return null
      return {
        attrs: { 'data-text-wrap': mode },
        node:
          mode === 'auto' && !skeleton ? <Probe table={table} /> : undefined,
      }
    },
  },
  head: {
    id: 'textWrap',
    render: ({ table, columnId }) => {
      const mode = headWrapModeOf(columnDefOf(table, columnId))
      if (!mode) return null
      return {
        attrs: { 'data-text-wrap': mode },
        node: mode === 'auto' ? <HeadProbe table={table} /> : undefined,
      }
    },
  },
  root: {
    id: 'textWrap',
    useRoot: useTextWrapRoot,
  },
}
