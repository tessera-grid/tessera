/** Опции и типы плагина cellSelection. */

import type {
  CellSelectionModelOptions,
  CellSelectionPredicateCell,
} from '../cellSelectionModel/registry'

export type { CellSelectionPredicateCell }

/** Для каких указателей показан маркер угла выделения (ADR 0198). По умолчанию — для обоих. */
export interface CellSelectionHandleOptions {
  /** Мышь, тачпад, стилус: квадрат в правом нижнем углу. */
  mouse?: boolean
  /** Палец: круги в противоположных углах. */
  touch?: boolean
  /**
   * Что делает протяжка квадрата (ADR 0219, §4): `'range'` — меняет диапазон, `'fill'` — тянет
   * значения в ячейки. По умолчанию `'range'`; круги пальца всегда меняют диапазон.
   */
  mode?: 'range' | 'fill'
  /** Оси протяжки значения. По умолчанию `'xy'`. */
  direction?: 'x' | 'y' | 'xy'
  /** Своё значение ячейки протяжки; `ctx.skip` — оставить ячейку как есть. */
  getFillValue?: FillValue
}

/** Ячейка протяжки значения для `getFillValue` (ADR 0219, WR26). */
export interface FillContext {
  /** Исходные значения линии вдоль оси протяжки. */
  values: readonly unknown[]
  /** Номер ячейки протяжки на линии: 0 — ближайшая к исходным. */
  index: number
  direction: 'down' | 'up' | 'right' | 'left'
  rowId: string
  columnId: string
  /** Строка ячейки. */
  row: unknown
  /** Значение по правилу копии, ряда или повтора. */
  value: unknown
  /** Вернуть, чтобы оставить ячейку как есть. */
  skip: symbol
}

export type FillValue = (ctx: FillContext) => unknown

/**
 * Свой разбор буфера при вставке (ADR 0219, WR3): строки и ячейки текста, `null` — отмена,
 * промис — ожидание с отменой; `signal` прерывается, когда ожидание отменили или его сменила
 * новая вставка. `confirm()` спрашивает пользователя «Вставить?» на месте плашки ожидания:
 * `true` — вставить, `false` — отказ или отмена.
 */
export type ParseClipboard = (
  clipboard: { text: string; html: string },
  context: { signal: AbortSignal; confirm: () => Promise<boolean> },
) => string[][] | null | PromiseLike<string[][] | null>

export interface CellSelectionOptions extends Omit<
  CellSelectionModelOptions,
  'enabled' | 'canSelectCell'
> {
  /** `false` — плагин присутствует, но инертен (present-but-disabled). */
  enabled?: boolean
  /** Shift-расширение прямоугольного диапазона. По умолчанию `true`. */
  rangeSelection?: boolean
  /** Протяжка выделения мышью (drag). По умолчанию `true`. */
  dragSelection?: boolean
  /** Ctrl/Cmd — добавление/вычитание отдельного прямоугольника. По умолчанию `true`. */
  multiRange?: boolean
  /** Сужает выбор; сервисные колонки (действия) не выбираются при любом предикате. */
  canSelectCell?: (cell: CellSelectionPredicateCell) => boolean
  /** Больше строк выделения копирование не кладёт в буфер. По умолчанию 10 000. */
  maxCopyRows?: number
  /**
   * Маркер угла активного диапазона, за который диапазон растягивают (ADR 0198). `false` —
   * маркера нет. По умолчанию — для мыши и пальца.
   */
  handle?: false | CellSelectionHandleOptions
  /**
   * Вставка из буфера, вырезание и очистка выделения (ADR 0219): пишут через плагин правки.
   * `false` — их нет. По умолчанию `true`.
   */
  paste?: boolean
  /** Свой разбор буфера при вставке; главнее своего формата и текста. */
  parseClipboard?: ParseClipboard
}
