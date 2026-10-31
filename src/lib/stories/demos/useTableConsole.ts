/**
 * Состояние и жизненный цикл грида истории — в консоль (ADR 0124, CL3, CL5): подписка
 * на атомы таблицы и записи о монтировании, плагинах, загрузке, данных и колонках.
 */
import { useEffect, useRef } from 'react'

import { useLatest } from '../../util/useLatest'
import { type ConsoleLog, preview } from './consoleLog'

type Atom = {
  get: () => unknown
  subscribe: (listener: (value: unknown) => void) => { unsubscribe: () => void }
}

const plural = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many
  return `${count} ${word}`
}

const rows = (count: number) => plural(count, 'строка', 'строки', 'строк')
const columns = (count: number) =>
  plural(count, 'колонка', 'колонки', 'колонок')
const loadingLabel = (loading: unknown) =>
  loading === 'initial' ? 'initial' : loading === 'refresh' ? 'refresh' : 'off'

interface Snapshot {
  data: readonly unknown[]
  columnDefs: readonly unknown[]
  loading: unknown
  plugins: readonly string[]
}

export const useTableConsole = (
  log: ConsoleLog | undefined,
  table: unknown,
  snapshot: Snapshot,
) => {
  const atoms = (table as { atoms: Record<string, Atom> }).atoms
  useEffect(() => {
    if (!log) return
    // Атом сообщает и о записи того же значения: в журнал — только смена.
    const last = new Map(
      Object.entries(atoms).map(([key, atom]) => [key, preview(atom.get())]),
    )
    const subscriptions = Object.entries(atoms).map(([key, atom]) =>
      atom.subscribe(value => {
        const detail = preview(value)
        if (last.get(key) === detail) return
        last.set(key, detail)
        log.write('state', key, detail)
      }),
    )
    return () => {
      for (const subscription of subscriptions) subscription.unsubscribe()
    }
  }, [log, atoms])

  const latest = useLatest(snapshot)
  // Ref живёт, пока жив экземпляр: повтор эффектов StrictMode не пишет «пересоздан».
  const mounted = useRef(false)
  useEffect(() => {
    if (!log || mounted.current) return
    mounted.current = true
    const { data, columnDefs, loading, plugins } = latest.current
    log.write(
      'lifecycle',
      log.mounted() === 1 ? 'Грид смонтирован' : 'Грид пересоздан',
      `загрузка ${loadingLabel(loading)}, ${rows(data.length)}, ${columns(columnDefs.length)}, плагины: ${plugins.join(', ') || 'нет'}`,
    )
  }, [log, latest])

  // Прошлый рендер — после коммита: смена между рендерами пишется одной записью.
  const last = useRef<Snapshot | undefined>(undefined)
  useEffect(() => {
    const before = last.current
    last.current = snapshot
    if (!log || !before) return
    const had = new Set(before.plugins)
    const has = new Set(snapshot.plugins)
    const changes = [
      ...snapshot.plugins.filter(id => !had.has(id)).map(id => `+${id}`),
      ...before.plugins.filter(id => !has.has(id)).map(id => `−${id}`),
    ]
    if (changes.length > 0) log.write('lifecycle', 'Плагины', changes.join(' '))
    const was = loadingLabel(before.loading)
    const is = loadingLabel(snapshot.loading)
    if (was !== is) log.write('lifecycle', 'Загрузка', `${was} → ${is}`)
    if (before.data !== snapshot.data) {
      log.write('lifecycle', 'Данные', rows(snapshot.data.length))
    }
    if (before.columnDefs !== snapshot.columnDefs) {
      log.write('lifecycle', 'Колонки', columns(snapshot.columnDefs.length))
    }
  })
}
