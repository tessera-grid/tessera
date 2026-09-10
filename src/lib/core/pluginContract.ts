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
import type { PluginSlot } from './createSlots'
import type { ActionMenuDeclaration, SlotAction } from './headerActions'

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
 *
 * `THooksSlice` — hook-слайс, который плагин добавляет в контракт хуков таблицы
 * (`{ rowSelection: RowSelectionPluginParams }` и т.п.). Ядро выводит из набора
 * записей объединение слайсов (`InferPluginHooks`) и типизирует им параметр
 * `hooks` в `useCreateTable` — presence-based, без глобального `PluginsHooks`
 * (types-mode b, ADR 0010). Плагины без хуков оставляют дефолт «пустой слайс»
 * (`Record<never, never>` — не добавляет ключей в пересечение).
 */
export interface RegistryEntry<THooksSlice = Record<never, never>> {
  id: string
  feature: TablePlugin
  column?: ServiceColumn
  options?: Partial<TableOptionsResolved<any>>
  /**
   * Декларативные слоты плагина (ADR 0010): кнопки в шапке/ячейке/строке
   * действий. Ядро собирает их реактивно из активного набора, поэтому
   * появление/исчезновение слота точно следует за наличием плагина — в отличие
   * от императивного `table.setRenderSlot` в `createTable`, который выполняется
   * лишь однажды при конструировании таблицы (TanStack не переигрывает
   * `createTable` при смене `_features`) и не реагирует на включение плагина
   * после монтирования.
   */
  slots?: PluginSlot[]
  /**
   * Декларативные действия слота (единый дескриптор `SlotAction`): кнопки в шапке/
   * ячейке/строке действий, которые плагин-меню может схлопнуть в кебаб. Ядро
   * собирает их реактивно из активного набора — так же, как `slots`, — маршрутизируя
   * по полю `slot`. Действие описывается данными (иконка/подпись/обработчик/
   * признаки), а ядро решает подачу: инлайн иконка-кнопка или строка меню.
   */
  slotActions?: SlotAction[]
  /**
   * Декларация плагина-меню: на какие слоты распространить схлопывание в кебаб и с
   * какими `mode`/`threshold`. Ядро сворачивает декларации активных плагинов в
   * `table.options.actionMenu` (карта по слотам) реактивно, поэтому разные плагины
   * (заголовки/строки) не затирают друг друга, а отключение корректно убирает слоты.
   */
  actionMenu?: ActionMenuDeclaration
  /**
   * Фантомный носитель типа hook-слайса плагина: существует только в типах (нет
   * рантайм-значения), нужен чтобы `THooksSlice` был выводим через
   * `RegistryEntry<infer S>`. Фабрика задаёт слайс аннотацией типа возврата
   * (`rowSelection(): RegistryEntry<RowSelectionPlugin>`), а не этим полем.
   */
  readonly __hooksSlice?: THooksSlice
  /**
   * Включён ли плагин. `undefined`/`true` — включён (наличие = включено);
   * `false` — ядро отсеивает запись при сборке. Позволяет отключить конкретный
   * плагин «одним движением» через `фабрика({ enabled })`, не трогая массив.
   */
  enabled?: boolean
  /**
   * Регистрировать `feature` в `_features` таблицы ДАЖЕ при `enabled: false`.
   * Нужно плагинам, чья `feature` вешает на инстанс колонки/строки НОВЫЕ методы
   * (`columnDragging` → `getCanDrag`/`getDraggableIndex`, `rowDragging` →
   * `getCanDrag`), которые реактивный UI зовёт без защиты. TanStack вычисляет
   * `_features` ОДИН раз при `createTable` и не перечитывает их (`useReactTable`
   * не пересоздаёт таблицу) — поэтому фича, не попавшая в набор на маунте, не
   * появится при live-включении плагина, и потребитель звал бы несуществующий
   * метод (`getCanDrag is not a function`). Методы читают свою опцию в момент
   * вызова и инертны, пока плагин выключен, поэтому держать их всегда безопасно.
   * Колонка/слоты/опции по-прежнему следуют за `enabled` — «выключен» остаётся
   * выключенным для пользователя.
   */
  keepFeatureWhenDisabled?: boolean
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

/** Свести объединение в пересечение (`A | B` → `A & B`). */
export type UnionToIntersection<U> = (
  U extends any ? (arg: U) => void : never
) extends (arg: infer I) => void
  ? I
  : never

/** Элемент списка `plugins` в `useCreateTable` (запись или отсеиваемое falsy). */
export type PluginEntryInput = RegistryEntry<any> | false | null | undefined

/**
 * Вывести контракт хуков из кортежа плагинов (presence-based, types-mode b):
 * пересечение hook-слайсов всех записей набора. Falsy-элементы и плагины без
 * слайса (`{}`) вклада не дают. Так `useCreateTable` типизирует `hooks` ровно по
 * переданным плагинам, не завися от глобального `PluginsHooks`.
 */
export type InferPluginHooks<TPlugins extends readonly PluginEntryInput[]> =
  UnionToIntersection<
    TPlugins[number] extends infer Entry
      ? Entry extends RegistryEntry<infer Slice>
        ? Slice
        : never
      : never
  >

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
