/**
 * Эффективное состояние при сужении параметров (ADR 0039, §4; ADR 0171, §1–§2). Плагин
 * объявляет сужение среза (`narrow`): функцию «сохранённое → допустимое». Ядро хранит
 * сохранённое значение в атоме-источнике и отдаёт TanStack атом-линзу в `options.atoms`:
 * чтение — эффективное значение, запись — в сохранённое. Эффективное — производный атом:
 * пересчитывается по всему, что читает сужение (аргументы, данные, состояние плагинов), без
 * перерисовки хоста. Сохранённое не переписывается: вернули параметр — вернулось прежнее
 * состояние; контролируемому потребителю `on*Change` из-за сужения не приходит. Значение
 * приложения, сужения и свёртку набора линза читает из опций текущего рендера, как TanStack
 * читает `state`: весь коммит видит одно значение. Рендер атомы не пишет.
 */
import { useMemo } from 'react'

import { createAtom } from '@tanstack/react-store'
import { functionalUpdate } from '@tanstack/react-table'
import { useIsomorphicLayoutEffect } from '../util/useIsomorphicLayoutEffect'
import { shallowEqual } from './reactivity'

/** The current fold of the plugin set (options, slot actions) — fresher than the `table` options. */
export interface NarrowContext {
  options: Record<string, unknown>
  slotActions: Partial<Record<string, readonly unknown[]>>
}

/**
 * Narrows a slice. `table` is the table instance or `null` (not created yet). Returns the same
 * value when there is nothing to narrow; `undefined` means it can't be computed without a table.
 * The core compares a result from the same value by fields: a value whose meaning isn't in its
 * fields (proxies, symbols) must be one object per stored value (ADR 0171, §1).
 */
export type NarrowState = (
  value: any,
  table: any,
  context: NarrowContext,
) => unknown

export type NarrowMap = Record<string, NarrowState[]>

export const handlerOf = (key: string) =>
  `on${key.charAt(0).toUpperCase()}${key.slice(1)}Change`

/** Применить цепочку сужений; `undefined` от любого звена — без таблицы не посчитать. */
export const applyNarrow = (
  narrows: readonly NarrowState[],
  value: unknown,
  table: unknown,
  context: NarrowContext = { options: {}, slotActions: {} },
): unknown => {
  let current = value
  for (const narrow of narrows) {
    const next = narrow(current, table, context)
    if (next === undefined) {
      return undefined
    }
    current = next
  }
  return current
}

/** Что ядро знает о срезе на рендер: сужение, значение снаружи и колбэки. */
export interface SliceInput {
  /** Значение снаружи: срез приложения (`controlled`) или ядра-владельца (`owned`). */
  value: unknown
  controlled: boolean
  /** Срезом владеет ядро (закрепление): запись — у владельца, слой только сужает. */
  owned: boolean
  external?: (updater: unknown) => void
  listener?: (next: unknown) => void
  /** Начальное значение среза, которым TanStack не владеет до первого рендера. */
  initial: { value: unknown } | undefined
}

/** Сохранённое значение; `undefined` — не сохранено: срез начальный у TanStack. */
type Saved = { value: unknown } | undefined

export interface SliceTable {
  options: {
    data?: unknown
    columns?: unknown
    state?: Record<string, unknown>
    pluginNarrows?: NarrowMap
    pluginNarrowContext?: NarrowContext
    pluginRenderVersion?: { get: () => number }
  }
  baseAtoms: Record<
    string,
    { get: () => unknown; set: (value: unknown) => void }
  >
  atoms: Record<string, Derived | undefined>
  initialState: Record<string, unknown>
}

interface Derived {
  get: () => unknown
  subscribe: (listener: (value: unknown) => void) => { unsubscribe: () => void }
}

interface Slice {
  /** Сохранённое ядром: неконтролируемый срез. */
  source: ReturnType<typeof createAtom<Saved>>
  lens: {
    get: () => unknown
    set: (updater: unknown) => void
    subscribe: (listener: (value: unknown) => void) => {
      unsubscribe: () => void
    }
  }
  /** Колбэки последнего коммита: их зовут события после него. */
  input: SliceInput
  /** Новое значение контролируемого среза до перерисовки: смены подряд строятся друг на друге (MP17). */
  sent?: { from: unknown; value: unknown }
}

/** Значение приложения или ядра-владельца в опциях рендера; `undefined` — среза снаружи нет. */
const externalOf = (instance: SliceTable | null, key: string) =>
  instance?.options.state?.[key]

export const createSliceStore = () => {
  const table = createAtom<SliceTable | null>(null)
  const slices = new Map<string, Slice>()
  /** Срезы, которые сужались и сужение сняли: их ведёт TanStack. */
  const released = new Set<string>()

  const savedOf = (key: string, slice: Slice) => {
    const saved = slice.source.get()
    return saved ? saved.value : table.get()?.baseAtoms[key]?.get()
  }

  const write = (key: string, slice: Slice, updater: unknown) => {
    const { input } = slice
    input.external?.(updater)
    const value = externalOf(table.get(), key)
    // Срез приложения: новое значение — колбэкам, отрисовка — от его пропа.
    if (value !== undefined && (input.external || input.listener)) {
      const { sent } = slice
      const base = sent && sent.from === value ? sent.value : value
      const next = functionalUpdate(updater as never, base as never)
      slice.sent = { from: value, value: next }
      input.listener?.(next)
      return
    }
    const next = functionalUpdate(
      updater as never,
      savedOf(key, slice) as never,
    )
    slice.source.set({ value: next })
    input.listener?.(next)
  }

  const create = (key: string, input: SliceInput): Slice => {
    const source = createAtom<Saved>(input.initial)
    let last: { raw: unknown; value: unknown } | undefined
    /** Сужение — производный атом: следит за атомами, которые читает (ленивые дети и т. п.). */
    const computeWith = (instance: SliceTable | null) => () => {
      const options = instance?.options
      // Функция-аргумент приходит обёрткой: её новую ссылку видно только по версии отрисовки.
      options?.pluginRenderVersion?.get()
      const external = externalOf(instance, key)
      const saved = source.get()
      const raw =
        external !== undefined
          ? external
          : saved
            ? saved.value
            : instance?.baseAtoms[key]?.get()
      // Сброс в `undefined` (`resetGlobalFilter`) — начальное значение TanStack.
      if (raw === undefined) return instance?.initialState[key]
      const narrowed = applyNarrow(
        options?.pluginNarrows?.[key] ?? [],
        raw,
        instance,
        options?.pluginNarrowContext,
      )
      // Сужать нечего — сужение отдаёт то же значение: мемо моделей строк не пересобираются.
      const value = narrowed === undefined ? raw : narrowed
      // Атом без подписчиков пересчитывается заново (StrictMode отписывается и подписывается):
      // тот же итог от того же значения — прежняя ссылка, иначе хост перерисуется зря.
      if (last && last.raw === raw && shallowEqual(last.value, value)) {
        return last.value
      }
      last = { raw, value }
      return value
    }
    // Опции React-адаптера — простые данные, `useTable` ставит их в рендере: то, что сужение
    // берёт из них, атом не видит — при смене берётся новый производный атом.
    let current: { inputs: unknown[]; atom: Derived } | undefined
    const effective = (): Derived => {
      const instance = table.get()
      const options = instance?.options
      const inputs = [
        instance,
        options?.data,
        options?.columns,
        externalOf(instance, key),
        options?.pluginNarrows?.[key],
        options?.pluginNarrowContext,
      ]
      if (current?.inputs.every((value, index) => value === inputs[index])) {
        return current.atom
      }
      const atom: Derived = createAtom<unknown>(computeWith(instance))
      current = { inputs, atom }
      return atom
    }
    const slice: Slice = {
      source,
      input,
      lens: {
        get: () => effective().get(),
        set: updater => write(key, slice, updater),
        // Производный атом при смене данных заменяется новым, атом таблицы — нет: его
        // подписку TanStack обновляет после коммита.
        subscribe: listener =>
          (table.get()?.atoms[key] ?? effective()).subscribe(listener),
      },
    }
    return slice
  }

  /** Внешние атомы таблицы: TanStack берёт объект при создании, срезы в нём меняет ядро. */
  const atoms: Record<string, Slice['lens']> = {}
  let constructed = false

  return {
    /** Фича набора: таблица узнаёт хранилище при создании — сужению она нужна сразу. */
    feature: {
      // StrictMode создаёт таблицу дважды, а React оставляет первую — её и берём.
      constructTableAPIs: (instance: unknown) => {
        if (constructed) return
        table.set(instance as SliceTable)
        constructed = true
      },
    },
    table: () => table.get(),
    /** Сохранённое значение среза: приложения или ядра, до сужения. */
    saved: (key: string) => {
      const instance = table.get()
      const external = externalOf(instance, key)
      const slice = slices.get(key)
      if (external !== undefined) {
        // Новое значение ушло приложению, перерисовки ещё не было.
        const sent = slice?.sent
        return sent && sent.from === external ? sent.value : external
      }
      return slice ? savedOf(key, slice) : instance?.atoms[key]?.get()
    },
    /**
     * Внешние атомы для опций таблицы. Срезы первого рендера — до создания таблицы; новые
     * срезы позже добавляет эффект коммита.
     */
    atoms: (inputs: Record<string, SliceInput>) => {
      if (!constructed) {
        for (const [key, input] of Object.entries(inputs)) {
          if (slices.has(key)) continue
          const slice = create(key, input)
          slices.set(key, slice)
          atoms[key] = slice.lens
        }
      }
      return atoms
    },
    /** Обработчики смены срезов: у сужаемых — запись в сохранённое, у снятых — в TanStack. */
    handlers: (inputs: Record<string, SliceInput>) => {
      // `useTable` сливает опции с прежними: обработчик снятого сужения остаётся в таблице
      // и пишет в срез TanStack, пока сужения нет.
      const handlers: Record<string, (updater: unknown) => void> = {}
      const keys = new Set([
        ...Object.keys(inputs),
        ...slices.keys(),
        ...released,
      ])
      for (const key of keys) {
        if (inputs[key]?.owned || slices.get(key)?.input.owned) continue
        handlers[handlerOf(key)] = updater => {
          const slice = slices.get(key)
          if (slice) {
            write(key, slice, updater)
            return
          }
          const atom = table.get()?.baseAtoms[key]
          atom?.set(functionalUpdate(updater as never, atom.get() as never))
        }
      }
      return handlers
    },
    /** Эффект коммита: срезы, появившиеся и снятые на лету, и колбэки для событий. */
    commit: (inputs: Record<string, SliceInput>) => {
      for (const [key, input] of Object.entries(inputs)) {
        let slice = slices.get(key)
        if (!slice) {
          // Сужение появилось на лету: срез с сохранённым значением TanStack.
          const base = table.get()?.baseAtoms[key]?.get()
          slice = create(key, {
            ...input,
            initial: base === undefined ? input.initial : { value: base },
          })
          slices.set(key, slice)
          atoms[key] = slice.lens
          released.delete(key)
          continue
        }
        // Приложение перестало вести срез: сохранённым становится его последнее значение.
        if (slice.input.controlled && !input.controlled) {
          slice.source.set({ value: slice.input.value })
        }
        slice.input = input
        // После перерисовки следующая смена — снова от значения приложения (MP17).
        slice.sent = undefined
        released.delete(key)
      }
      // Сужение сняли: сохранённое уходит TanStack (RX26, RX27).
      for (const [key, slice] of slices) {
        if (key in inputs) continue
        const saved = slice.source.get()
        if (saved && !slice.input.owned) {
          table.get()?.baseAtoms[key]?.set(saved.value)
        }
        slices.delete(key)
        delete atoms[key]
        released.add(key)
      }
    },
  }
}

export type SliceStore = ReturnType<typeof createSliceStore>

/** Хранилище срезов таблицы: линзы и обработчики рендера, перенос входов — в эффекте. */
export const useEffectiveSlices = (
  store: SliceStore,
  inputs: Record<string, SliceInput>,
) => {
  const atoms = store.atoms(inputs)
  const handlers = store.handlers(inputs)
  useIsomorphicLayoutEffect(() => store.commit(inputs))
  return { atoms, handlers }
}

/** Свёртка набора для сужения: новый объект — только при новой свёртке или загрузке. */
export const useNarrowContext = (
  folded: {
    options: Record<string, unknown>
    slotActions: NarrowContext['slotActions']
  },
  loading: unknown,
): NarrowContext =>
  useMemo(
    () => ({
      options: { ...folded.options, loading },
      slotActions: folded.slotActions,
    }),
    [folded, loading],
  )
