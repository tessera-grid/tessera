import {
  Cell,
  Column,
  ColumnDef,
  Header,
  InitialTableState,
  Row,
  Table,
  TableOptionsResolved,
} from '@tanstack/react-table'

import { CellContextSDK } from '../../types/cell'
import { HeaderContextSDK } from '../../types/header'

// Контракт плагинов — принадлежит ядру (ADR 0010): ядро определяет, ЧТО такое
// плагин, а плагины его реализуют. Стрелка зависимости: плагины → этот контракт
// ← ядро. `plugins/types.ts` реэкспортит отсюда для обратной совместимости.

/**
 * @link https://tanstack.com/table/v8/docs/guide/custom-features
 */
export interface TablePlugin<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> {
  /**
   * Подписка на ициниализацию инстанса ячейки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#cell
   */
  createCell?: (
    _staticCell: Cell<TData, TValue, THooks, TState, TOptions>,
    _staticColumn: Column<TData, TValue>,
    _staticRow: Row<TData>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса колонки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#column
   */
  createColumn?: (
    _staticColumn: Column<TData, TValue>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса заголовка колонки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#header
   */
  createHeader?: (
    _staticHeader: Header<TData, TValue, THooks, TState, TOptions>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса строки
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#row
   */
  createRow?: (
    _staticRow: Row<TData>,
    table: Table<TData, THooks, TState, TOptions>,
  ) => void
  /**
   * Подписка на ициниализацию инстанса таблицы
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#createtable
   */
  createTable?: (table: Table<TData, THooks, TState, TOptions>) => void
  /**
   * Метод для установки параметров колонок таблицы по умолчанию
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getdefaultcolumndef
   */
  getDefaultColumnDef?: () => Partial<ColumnDef<TData>>
  /**
   * Метод для установки параметров таблицы
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getdefaultoptions
   */
  getDefaultOptions?: (
    table: Table<TData, THooks, TState, TOptions>,
  ) => Partial<TableOptionsResolved<TData>> & TOptions
  /**
   * Метод для установки состояния таблицы по умолчанию
   * @link https://tanstack.com/table/v8/docs/guide/custom-features#getinitialstate
   */
  getInitialState?: (
    initialState?: InitialTableState | undefined,
  ) => InitialTableState & TState
}

/**
 * Привязка сервисной колонки плагина к сборке колонок (pre-table инъекция).
 * `make` строит колонку по глубине шапки; `side`/`order` задают размещение и
 * порядок по умолчанию (см. ADR 0010).
 */
export interface ServiceColumn {
  /**
   * Стабильный базовый id колонки — по нему её таргетят видимость и пиннинг
   * (при depth>1 `make` возвращает группу с другим id, поэтому id хранится явно).
   */
  id: string
  make: (depth: number) => ColumnDef<any, any>
  /** Размещение в НАБОРЕ колонок (порядок), не путать с пиннингом. */
  side: 'leading' | 'trailing'
  order: number
  /**
   * Пиннинг колонки — политику объявляет плагин-владелец, ядро лишь исполняет
   * (ADR 0010). `when: 'always'` — закреплена всегда (напр. колонка действий);
   * `when: 'with-user'` — присоединяется к блоку, только когда потребитель сам
   * закрепил что-то с этой стороны. Без `pin` колонка не закрепляется.
   */
  pin?: {
    side: 'left' | 'right'
    when: 'always' | 'with-user'
  }
}

/**
 * Запись реестра плагина: то, что фабрика плагина отдаёт потребителю для
 * presence-based композиции (см. ADR 0010). Фича остаётся плоским `TablePlugin`;
 * привязка колонки и тонкие опции живут в записи, а не на фиче.
 */
export interface RegistryEntry {
  id: string
  feature: TablePlugin
  column?: ServiceColumn
  options?: Partial<TableOptionsResolved<any>>
  /**
   * Включён ли плагин. `undefined`/`true` — включён (наличие = включено);
   * `false` — ядро отсеивает запись при сборке. Позволяет отключить конкретный
   * плагин «одним движением» через `фабрика({ enabled })`, не трогая массив.
   */
  enabled?: boolean
  /**
   * Императивный сетап плагина ПОСЛЕ создания таблицы (generic-escape ADR 0010:
   * когда плагину нужен побочный эффект, невыразимый через `feature`/`options` —
   * например записать авто-слайс размеров). Ядро выполняет `setup` всех активных
   * плагинов в ЕДИНОМ `useEffect`, поэтому это обычная функция, а НЕ React-хук
   * (число реальных хуков не зависит от длины списка — rules-of-hooks соблюдены).
   * Может вернуть cleanup. Перезапускается при смене идентичности активного списка.
   */
  setup?: (table: Table<any>) => void | (() => void)
}

/** Базовые опции, общие для всех фабрик плагинов. */
export interface PluginOptions {
  /** `false` — плагин отключён (запись отсеивается ядром). По умолчанию включён. */
  enabled?: boolean
}

/**
 * Тип для описания компонента заголовков
 */
export type HeaderComponentProps<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> = HeaderContextSDK<TData, TValue, THooks, TState, TOptions>

/**
 * Тип для описания компонента ячеек
 */
export type CellComponentProps<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
  TValue = unknown,
> = CellContextSDK<TData, TValue, THooks, TState, TOptions>
