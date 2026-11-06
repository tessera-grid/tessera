<center>
<table align="center" style="max-width: 800px; margin: 8px auto"><tbody><tr><td width="800">

<a name="page-start" href="#"></a>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/lockup/lockup-tagline-color-dark-bg.svg">
    <source media="(prefers-color-scheme: light)" srcset="brand/lockup/lockup-tagline-color-light-bg.svg">
    <img alt="tessera — Extensible, customizable data grid for React" src="brand/lockup/lockup-tagline-universal.svg" width="560">
  </picture>
</p>

# Tessera

`@tessera-grid/tessera`

Библиотека для создания производительных и нагруженных интерактивных таблиц на основе TanStack Table.

## Руководство по использованию

### Содержание

- [1. Введение](#intro)
- [2. Подготовка данных](#prepare)
  - [2.1. Создание колонок](#create_columns)
  - [2.2. Доступ к объектам колонок](#get_object_column)
  - [2.3. Параметризация колонок](#columns_settings)
  - [2.4. Создание данных](#create_data)
- [3. Создание таблицы](#create_table)
- [4. Конфигурация таблицы](#configure_table)
- [5. Управление состоянием таблицы](#state_table)
- [6. Использование плагинов](#usage_plugins)
- [7. Реализация бизнес-логики для плагинов](#business_plugins)
- [8. Реактивность обновления данных](#reactivity)
- [9. Создание своего плагина](#custom_plugin)
  - [9.1. Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке](#custom_plugin_example_1)
  - [9.2. Гайд 2. Кнопка "скрыть значение" в ячейках](#custom_plugin_example_2)
  - [9.3. Гайд 3. Создать новую колонку с кастомным Switch](#custom_plugin_example_3)
- [10. Best Practices](#best_practices)

<a name="intro" id="intro"></a>

### Введение

> ⚠️ Это руководство по созданию таблиц с помощью `Tessera`, которое содержит базовый гайдлайн по основным механикам данной библиотеки.
>
> Если Вас интересует только практический пример, то Вы можете найти его здесь: `src/lib/stories` (истории `DataGrid*.stories.tsx`).

В случае, если вы новичок и хотите подробнее ознакомиться с библиотекой `Tanstack Table` и особенностями `Tessera` - велком!

<a name="prepare" id="prepare"></a>

### Подготовка данных

Для создания таблицы нам понадобятся **стабильные данные** - `columns` и `data`.

<a name="create_columns" id="create_columns"></a>

#### Создание колонок

`Columns` - это массив метаданных, которые определяют базовую отрисовку колонок и ячеек таблицы.

Давайте их создадим!

Сначала опишем типы данных в отдельном модуле `types.ts` — их будут импортировать все примеры ниже:

```ts
// types.ts

// Тип строки данных таблицы. Индексная сигнатура нужна, т.к. колонки строятся
// динамически по списку полей (row[field.name]).
export interface ItemType {
  id: string
  name: string
  description: string
  price: number
  [key: string]: unknown
}

// Описание поля-колонки (используется как meta-контекст колонки)
export interface FieldType {
  id: string
  name: string
  label: string
  width: number
  type: string
}
```

```ts
// useColumns.tsx

import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { FieldType, ItemType } from './types'

interface UseColumnsParams {
  fields: FieldType[]
}

// TFeatures у потребителя — any (набор фич собирает useCreateTable из plugins),
// второй генерик — тип строки данных.
const columnHelper = createColumnHelper<any, ItemType>()

export const useColumns = ({ fields }: UseColumnsParams) => {
  return useMemo(
    () =>
      fields.map((field: FieldType) => {
        return columnHelper.accessor(row => row[field.name], {
          id: field.id,
          header: field.label,
          cell: cell => String(cell.getValue() ?? ''),
          size: field.width,
        })
      }),
    [fields],
  )
}
```

```ts
// useFields.ts

import { useMemo } from 'react'

import { FieldType } from './types'

export const useFields = (): FieldType[] => {
  return useMemo(
    () => [
      {
        id: '0',
        name: 'id',
        label: 'ID',
        width: 100,
        type: 'string',
      },
      {
        id: '1',
        name: 'name',
        label: 'Name',
        width: 100,
        type: 'string',
      },
      {
        id: '2',
        name: 'description',
        label: 'Description',
        width: 100,
        type: 'string',
      },
      {
        id: '3',
        name: 'price',
        label: 'Price',
        width: 100,
        type: 'number',
      },
    ],
    [],
  )
}
```

`header` и `cell` могут быть как строками, функциями и компонентами.
С помощью них мы можем настраивать логику отрисовки контента в заголовках и ячейках таблицы.

> ⚠️ Мы настоятельно рекомендуем избегать прямых внешних зависимостей для рендера заголовков и колонок.
>
> Если Вы беспокоитесь об обновлении содержимого ячеек, то в следующих главах мы поговорим о точечных подписках на состояние в `Tessera`.

<a name="get_object_column" id="get_object_column"></a>

#### Доступ к объектам колонок

В дальнейшем, все свойства и методы колонки доступны через свойство `column.columnDef`. Но как в будущем получить доступ к параметрам `field`?

В примере выше мы уже это сделали, типизировав параметр `meta` через функцию `getMeta`.

```ts
columnHelper.accessor(row => row[field.name], {
  id: field.id,
  header: field.label,
  cell: cell => cell.getValue(),
  // Параметр meta используется как произвольный контекст колонки и доступен через column.columnDef.meta
  meta: setMeta(field),
  size: field.width,
})
```

```ts
// getMeta.ts
// Пример реализации получения типизированного объекта meta

import { ColumnMeta } from '@tanstack/react-table'

import { FieldType } from './types'

export const DEFAULT_META: FieldType = {
  id: '',
  name: 'id',
  label: '',
  width: 150,
  type: '',
}

export const getMeta = (meta: ColumnMeta<any, unknown> | undefined) => {
  return { ...DEFAULT_META, ...meta } satisfies FieldType
}

export const setMeta = (meta: FieldType) => meta
```

> ⚠️ Для получения типизированной `meta` пока нет готовой функции из библиотеки,
> но Вы всегда можете предложить имплементацию, которая может стать частью публичного API.

<a name="columns_settings" id="columns_settings"></a>

#### Параметризация колонок

Обратите внимание, что `Tanstack Table` также позволяет параметризировать поведение каждой колонки при их создании, например:

```ts
columnHelper.accessor(row => row[field.name], {
  id: field.id,
  header: field.label,
  cell: Cell,
  meta: setMeta(field),
  size: field.width,
  // Включить сортировку данных по этой колонке
  enableSorting: true,
  // Включить изменение ширины колонки
  enableResizing: true,
  // Включить возможность закрепления колонки
  enablePinning: true,
  // Включить возможность перетаскивания колонки
  enableDragging: true,
  // Включить группировку данных по этой колонке
  enableGrouping: true,
  // Тип значения: вид, сортировка, фильтр, поиск, выгрузка и редактор ячейки
  dataType: 'number',
})
```

`dataType` — тип значения колонки ([ADR 0172](docs/decisions/0172-column-data-type.md),
[ADR 0174](docs/decisions/0174-object-and-number-string-types.md)): `'text'`, `'number'`,
`'numberString'` (десятичное число строкой), `'boolean'`, `'date'` и `'dateTime'` (объект
`Date`), `'dateString'` и `'dateTimeString'` (строки), `'select'`, `'multiSelect'`, `'object'`
(запись с ключом и подписью) или свой тип из реестра `useCreateTable({ dataTypes })`. По типу
работают вид ячейки, сортировка, фильтр, поиск, выгрузка и **редактор ячейки**
([ADR 0175](docs/decisions/0175-data-type-editors.md)): число правится полем на языке таблицы,
булево — одним нажатием, даты — календарём, варианты — полем с поиском или списком флажков.

Правка отдаёт значение **в типе колонки**: `onCellEdit({ value, text })` получает число,
`Date`, запись или массив и набранный текст. Текст разбирается при сохранении: свой
`parseValue(text, row)` колонки или типа главнее встроенного разбора; не разобрался — поле
показывает ошибку, и правка не сохраняется. В серверной модели строк, где данные держит грид,
сохранённое значение пишется в кэш по пути `accessorKey` (`address.city` — вглубь), если
`onCellEdit` не вернул сохранённую строку
([ADR 0139](docs/decisions/0139-saved-row-and-column-data-type.md)). Тип даты своего формата
читается полем `parseDate` и пишется обратно полем `formatDate`; запись варианта `object` —
поле `record` у варианта справочника.

> ⚠️ Подробнее о создании колонок читайте здесь: https://tanstack.com/table/latest/docs/guide/column-defs

<a name="create_data" id="create_data"></a>

#### Создание данных

Теперь поговорим о данных.

`Data` - это непосредственно наши данные, например: список товаров.

```tsx
// useData.ts

import { useMemo } from 'react'

import { ItemType } from './types'

// Выдуманный эндпоинт, возвращающий стабильные данные определенного типа
const useDataQuery = (): ItemType[] => {
  return useMemo(
    () => [
      { id: '0', name: 'Name 1', description: 'desc', price: 100 },
      { id: '1', name: 'Name 2', description: 'desc', price: 200 },
      { id: '2', name: 'Name 3', description: 'desc', price: 300 },
    ],
    [],
  )
}

export const useData = () => {
  // Подразумевается, что каждый объект данных соответствует типу ItemType, который используют колонки
  return useDataQuery()
}
```

Здесь все очень просто: получаем массив объектов, мемоизируем значение, если Вы применяете предобработку данных.

> ⚠️ Обратите внимание, что здесь не требуются сложные преобразования и объединения `columns` и `data`, `Tessera` все делает за Вас.
> Их нужно будет только передать в саму таблицу.

Доступ к каждому элементу массива `data` можно получить через свойство `row.original`.
В примере выше мы читали значение через метод `cell.getValue()` с сочетанием `accessorFn`, но Вы также можете использовать `row.original[fieldName]` для отрисовки каждой ячейки.

В следующей главе мы узнаем, как передать колонки и данные в таблицу и отрисовать их на экране.

---

> ⚠️⚠️⚠️ **Обязательно используйте стабильные ссылки на данные, чтобы избежать непредвиденной или бесконечной перерисовки всей таблицы!**
>
> **Подробнее читайте здесь:** https://tanstack.com/table/latest/docs/guide/data

---

<a name="create_table" id="create_table"></a>

### Создание таблицы

Для начала нам потребуется использовать функцию `useCreateTable` и компонент `DataGrid`.

Используя наши подготовленные колонки и данные, давайте отрисуем их на экране!

```tsx
// Table.tsx

import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const table = useCreateTable({
    columns,
    data,
  })

  return <DataGrid table={table} />
}
```

Отлично! Вы только что создали свою таблицу!

> ⚠️ В большинстве случаев `useCreateTable` **не требует явных дженериков** — типы
> выводятся из аргументов:
>
> - `TData` (тип данных) — из `columns` и `data`;
> - набор плагинов — из массива `plugins` (кортеж выводится как есть, поэтому
>   доступны ровно те плагины, что вы передали).
>
> Id строки по умолчанию берётся из поля `row.id`, поэтому для такого `TData` нужен
> строковый `id`. Если его нет (или он числовой), `getRowId` **обязателен** — это
> проверяет компилятор: `getRowId: row => String(row.key)`.
>
> Состояние и хендлеры — это обычные аргументы (`state` / `handlers`), а **не
> дженерики**: их типы определяются формой передаваемых объектов. Бизнес-логика
> (колбэки плагинов) задаётся **прямо в аргументах фабрики плагина**
> (`rowSelection({ onSelectRow })`) — отдельного параметра `hooks` нет. Как это
> выглядит на практике — в главах ниже.

<a name="configure_table" id="configure_table"></a>

### Конфигурация таблицы

`Tessera` включает поведение таблицы через **композицию плагинов** (presence-based):
наличие фабрики плагина в массиве `plugins` = фича включена.

Например, чтобы включить сортировку и изменение ширины для всех колонок, импортируйте
соответствующие плагины из `@tessera-grid/tessera/plugins` и передайте их фабрики:

```tsx
import { columnSorting, columnSizing } from '@tessera-grid/tessera/plugins'

useCreateTable({
  columns,
  data,
  plugins: [columnSorting(), columnSizing()],
})
```

> ⚠️ Некоторые плагины требуют включённых параметров в самих колонках
> (`enableSorting`, `enableResizing` и т.п. в определении колонки). Плагин включает
> механику на уровне таблицы, а колонка — разрешает её для себя.
>
> Тонкие настройки передаются аргументом фабрики: `columnSorting({ removal: false })`,
> `rowExpanding({ maxDepth: 3 })`. Отключить плагин «одним движением», не убирая из
> массива, можно через `columnSorting({ enabled: false })`.

<a name="state_table" id="state_table"></a>

### Управление состоянием таблицы

По умолчанию `Tessera` не требует инициализации внешних состояний для корректной работы.

Если Вам нужно вручную работать с состоянием таблицы, у каждого среза — свой владелец:

- **срезы колонок** (`columnVisibility`, `columnOrder`, `columnPinning`, `columnSizing`)
  принадлежат ядру — их передают в `state` и `handlers` `useCreateTable`;
- **срезы плагинов** (`sorting`, `pagination`, `columnFilters`, `globalFilter`, `grouping`,
  `expanded`, `rowSelection`, `cellSelection`) принадлежат плагинам — их передают
  аргументами фабрики: `<срез>`, `on<Срез>Change` и `initial<Срез>`.

```tsx
// Table.tsx

import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  // Срез выбора — состояние приложения, аргументами плагина.
  const [selected, setSelected] = useState<RowSelectionValue>({})

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      rowSelection({
        rowSelection: selected,
        onRowSelectionChange: setSelected,
      }),
    ],
  })

  return <DataGrid table={table} />
}
```

В этом случае выбор строк хранит приложение: `rowSelection` применяет внешнее значение, а
каждое изменение изнутри грида приходит в `onRowSelectionChange` новым значением. Без
внешнего значения срез живёт внутри грида; начальное значение задаёт `initialRowSelection`.

Срез плагина, переданный в `state`/`handlers` ядра в обход типов, не применяется — в
режиме разработки грид подскажет, в аргумент какого плагина его перенести.

Нужно только состояние, без контролов? У каждого плагина интерфейса есть плагин модели:
`columnSortingModel`, `paginationModel`, `columnFilteringModel`, `quickSearchModel`,
`rowGroupingModel`, `rowExpandingModel`, `rowSelectionModel`, `cellSelectionModel`,
`dataExportModel`. Он применяет срез, но не рисует кнопок, колонок и полей — их рисует
приложение:

```tsx
const [sorting, setSorting] = useState<SortingState>([])

const table = useCreateTable({
  columns,
  data,
  // Строки упорядочены по sorting, кнопок сортировки в заголовках нет.
  plugins: [columnSortingModel({ sorting, onSortingChange: setSorting })],
})
```

<a name="usage_plugins" id="usage_plugins"></a>

### Использование плагинов

Набор базовых плагинов поставляется отдельным входом `@tessera-grid/tessera/plugins`.
Каждый включается добавлением своей фабрики в массив `plugins`:

| Фабрика              | Что делает                                                                        | UI                                                                          | Ограничения / примечания                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columnSorting()`    | Сортировка данных DESC/ASC                                                        | кнопка в заголовке                                                          | клиентская и серверная; требует `enableSorting` в колонке                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `columnSizing()`     | Ресайз колонок                                                                    | хендлер в заголовке                                                         | требует `enableResizing` в колонке; с клавиатуры — фокус на хендлере, `←`/`→` (±10px, `Shift` ±50px), `Home` — сброс                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `columnPinning()`    | Закрепление колонок слева/справа                                                  | кнопка в заголовке                                                          | работает и под многоуровневой шапкой (групповой пин + вынос отдельных листьев/групп)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `columnDragging()`   | Перетаскивание колонок                                                            | индикатор в заголовке                                                       | требует `enableDragging` в колонке; не работает под многоуровневой (сгруппированной) шапкой; с `keyboardNavigation` — `Alt+Shift+←/→` на заголовке                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `columnVisibility()` | Скрытие и показ колонок                                                           | кнопка «Колонки» в тулбаре                                                  | нужен `enableToolbar`; меню с поиском, деревом (группы вложенной шапки — трёхсостоянные галочки), «Показать все» и «Сбросить»; служебные колонки в меню не попадают, `enableHiding: false` и последняя видимая колонка заблокированы; с `headerActionMenu()` — «Скрыть колонку» / «Скрыть группу» в кебабе заголовка; колбэк `onToggleColumnVisibility(columnIds, visible)`; состояние — общий срез `columnVisibility` (`state` + `handlers`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `rowSelection()`     | Выбор строк                                                                       | колонка с чекбоксами                                                        | скрывается при активной группировке; `selectedCount: true` — счётчик выбранных строк в нижней панели (учитывает выбор на других страницах); `selectAll` — что выбирает флажок в заголовке: `'filtered'` (по умолчанию) — строки после фильтров и поиска на всех страницах, `'currentPage'` — строки текущей страницы, `'all'` — все строки данных                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rowExpanding()`     | Разворачивание/сворачивание строк                                                 | колонка с кнопкой                                                           | клиентское и серверное; поддерживает иерархию (`getSubRows`); промис из `onExpandRow` при раскрытии — ожидание подгрузки (`aria-busy`), отказ сворачивает строку ([ADR 0041](docs/decisions/0041-async-business-callbacks.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `treeLines()`        | Линии дерева у видимой иерархии: дерево и группы                                  | ветки со скруглёнными поворотами в отступе первой колонки                   | сам ничего не раскрывает — нужен `rowExpanding` или `rowGrouping`; в серверной модели инертен                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `rowDragging()`      | Перетаскивание строк и групп                                                      | колонка с хендлером                                                         | поддерживает иерархию; отключается при активной группировке; с `keyboardNavigation` — `Alt+Shift+↑/↓` (среди строк того же уровня), `Alt+Shift+→/←` (в группу / из группы)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `rowGrouping()`      | Группировка данных по колонкам                                                    | кнопка/пункт меню в заголовке                                               | при активной группировке отключает `rowDragging` и `rowSelection`; под вложенной шапкой несовместима с `columnDragging`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `rowActions()`       | Колонка кнопок действий над строкой                                               | колонка, закреплённая справа                                                | ширина `width` (px, по умолч. 120) и `collapsedWidth` (56) при схлопывании действий                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `headerActionMenu()` | Схлопывает кнопки заголовка в кебаб-меню «⋯»                                      | меню в заголовке                                                            | `mode`: `auto` (по порогу) / `always`; `threshold` (по умолч. 3). Своей колонки/фичи не вносит                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `rowActionMenu()`    | Схлопывает действия строки в кебаб-меню «⋯»                                       | меню в колонке действий строки                                              | `mode`: `auto` / `always`; `threshold` (по умолч. 2). Работает поверх `rowActions()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `cellEditing()`      | Инлайн-редактирование значения ячейки                                             | кнопка в ячейке (по hover)                                                  | кнопка в ЛЮБОЙ не-сервисной колонке; показ гейтит предикат `canEditCell(ctx)`; `validate(value, ctx, text)` — текст ошибки блокирует коммит; редактор замещает контент ячейки (`cellSlot`) и выбирается по типу колонки (число, булево, даты, варианты; ADR 0175), сменный через `editor` колонки, её типа или аргумента; `searchDebounceMs` — пауза перед запросом справочника; `Enter` и потеря фокуса сохраняют через `onCellEdit({ value, text, original, current? })` — `value` в типе колонки — промис из него отделяет ячейку в ожидание (`aria-busy`), не блокируя правку других, а отказ оставляет ячейку в «ошибке» с черновиком и текстом отказа ([ADR 0041](docs/decisions/0041-async-business-callbacks.md)), `Escape` отменяет; завершение без сохранения — `onEditCancel({ reason, draft, text, original })`; `onConflict: 'block'` — не сохранять значение, изменённое извне                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `cellSelection()`    | Выделение диапазона ячеек + копирование                                           | клик / Shift / drag / Ctrl-Cmd по ячейкам                                   | `Ctrl/Cmd+C` копирует выделение как TSV и HTML-таблицу; сервисные колонки невыбираемы всегда, `canSelectCell` сужает выбор                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `columnFiltering()`  | Фильтры колонок по типу данных колонки (`dataType`)                               | кнопка фильтра в заголовке с панелью, сводка в тулбаре, «показано N из M»   | фильтры разных колонок объединяются через И; `dataMode: { filtering: 'server' }` у таблицы — фильтрует сервер                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `quickSearch()`      | Быстрый поиск по видимым колонкам                                                 | поле поиска в тулбаре                                                       | с фильтрами колонок — через И; `dataMode: { search: 'server' }` у таблицы — ищет сервер                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `contextMenu()`      | Контекстное меню по правому клику                                                 | меню у курсора                                                              | пункты вносят другие плагины (напр. «Копировать» от `cellSelection`); на сервисных колонках не показывается                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pagination()`       | Пагинация строк                                                                   | контрол в нижней панели                                                     | клиентская и серверная (`dataMode: { pagination: 'server' }` и итог `rowCount` у таблицы; пока ответа нет — `rowCount: 0`); `initialPageSize` (начальный размер, по умолч. 25; текущим владеет срез `pagination`), `pageSizes` (10/25/50/100, `false` — без выбора); страницы по верхнему уровню — дети группы не рвутся; сортировка и группировка возвращают на первую страницу, правка и перестановка строк — нет; колбэк `onPageChange(pageIndex, pageSize)`; состояние — срез `pagination` (`state` + `handlers`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `infiniteScroll()`   | Лента: у края тела грид просит следующий блок                                     | хвост скелет-строк, строка ошибки с повтором, счётчик в нижней панели       | `onLoadMore` дописывает строки в конец `data`, `hasMore` — есть ли ещё; инертна вместе с пагинацией                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `backToTop()`        | Кнопки «наверх» и «к первой колонке»                                              | кнопки в нижней панели                                                      | появляются после порога прокрутки (`threshold`), оси — `axes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `columnTotals()`     | Итоги колонок в футере по `aggregationFn`                                         |
| `dataExport()`       | Выгрузка данных в файл                                                            | кнопка «Экспорт» с панелью настроек в тулбаре, `table.exportData(settings)` | нужен `enableToolbar`; панель собирает выгрузку из осей: **строки** (`all` — весь `data` в исходном порядке; `view` — «С учётом сортировки», при `columnSorting`; `page` — при `pagination`; `selected` — выбранные всех страниц, при `rowSelection`, недоступны без выбора), **колонки** (видимые в порядке отображения / все), **формат**; `presets: [{ id, label, rows?, columns?, format? }]` — быстрые наборы, заполняют оси без выгрузки; `allow: { rows, columns, formats }` — допустимое (остальное недоступно); если осталась одна комбинация, клик выгружает сразу; значения — сырые `cell.getValue()` + `formatValue`; CSV по RFC 4180 (UTF-8 BOM; защита от формул включена, `sanitizeFormulas: false` — на ответственности разработчика), свои форматы через `formats`; Excel — `exportFormats.xlsx({ timeZone?, sheetName? })` (без `timeZone` — пояс таблицы `useCreateTable({ timeZone })`): типизированные ячейки (числа, булевы значения и даты по типу данных колонки), жирная закреплённая шапка с автофильтром, ширины и закрепление слева как в гриде; генератор грузится при первой выгрузке; `dataMode: { export: 'server' }`у таблицы —`page`скачивает клиент, остальное уходит в`onExport(request)` (`rowIds`у`selected`), пока промис в ожидании кнопка занята; `onExported` — файл скачан |
| `serverRowModel()`   | Серверная модель строк: строки блоками по прокрутке, кэш с пределом, ленивые дети | скелеты незагруженных строк, строка ошибки блока                            | строки держит грид, `data` не читается, нужен `getRowId`; пагинация, лента, перестановка строк, группировка, линии дерева и выделение ячеек инертны; выгрузка — только серверная. См. [Большие данные](#server_row_model)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Плагин интерфейса включает свою модель сам. Модель отдельно — когда нужен только эффект
среза без контролов: кнопки и поля рисует приложение (см. [Управление состоянием
таблицы](#state_table), [ADR 0120](docs/decisions/0120-model-and-interface-plugins.md)):

| Модель                   | Что делает                                                               | Интерфейс           |
| ------------------------ | ------------------------------------------------------------------------ | ------------------- |
| `columnSortingModel()`   | Упорядочивает строки по срезу `sorting`                                  | `columnSorting()`   |
| `columnFilteringModel()` | Фильтрует строки по срезу `columnFilters` и типам данных колонок         | `columnFiltering()` |
| `quickSearchModel()`     | Фильтрует строки по срезу `globalFilter`                                 | `quickSearch()`     |
| `paginationModel()`      | Отдаёт строки текущей страницы среза `pagination`                        | `pagination()`      |
| `rowGroupingModel()`     | Группирует строки по срезу `grouping` с агрегацией                       | `rowGrouping()`     |
| `rowExpandingModel()`    | Раскрывает дерево по срезу `expanded`                                    | `rowExpanding()`    |
| `rowSelectionModel()`    | Выбор строк по срезу `rowSelection`: заливка и `aria-selected`           | `rowSelection()`    |
| `cellSelectionModel()`   | Выделение ячеек по срезу `cellSelection`: контур диапазона               | `cellSelection()`   |
| `dataExportModel()`      | Метод `table.exportData` для своих кнопок: форматы, оси, серверный режим | `dataExport()`      |

> ♿ **Доступность.** Грид строит валидное ARIA-дерево и доступные имена всегда
> ([ADR 0020](docs/decisions/0020-accessibility.md)), но WCAG 2.1.1 (всё, что
> доступно указателем, доступно и с клавиатуры) выполняется **только с опцией
> `useCreateTable({ enableKeyboardNavigation: true })`** ([ADR 0031](docs/decisions/0031-wcag-keyboard.md)). Без
> неё грид — `role="table"` для чтения: область прокрутки, футер и перестановка
> колонок/строк с клавиатуры недоступны. Изменения (сортировка, выбор, копирование,
> загрузка) объявляются скринридеру; свои сообщения — `table.announce(text)`,
> отключить объявления ядра — `useCreateTable({ enableAnnouncements: false })`
> ([ADR 0032](docs/decisions/0032-wcag-aa-remainder.md)). Всё, что делается
> перетаскиванием, доступно и кликом: ручки перестановки колонок и строк и грип
> ширины открывают меню команд, а малые контролы имеют зону нажатия 24×24
> (WCAG 2.2 AA, [ADR 0034](docs/decisions/0034-wcag-22-dragging-and-target-size.md)).
> Как управлять таблицей с клавиатуры и мышью — [гайд](docs/guides/table-controls.md).

> 🎞️ **Движение строк.** Раскрытие, сортировка, фильтр, приход ленивых детей и
> перестановка двигают строки к новым местам, уходящие строки гаснут, а при броске
> облако долетает до слота ([ADR 0107](docs/decisions/0107-row-motion.md)). Длительность —
> токен `--tsr-comp-row-motion-duration` (250 мс); `prefers-reduced-motion` и
> `useCreateTable({ enableRowAnimation: false })` выключают движение. Колонки так же
> переезжают при смене порядка — откат, клавиатура, меню ручки, `setColumnOrder`
> ([ADR 0115](docs/decisions/0115-column-motion.md)); выключает
> `useCreateTable({ enableColumnAnimation: false })`.

> ⚠️ Плагин включает механику на уровне таблицы, а колонка — **разрешает её для себя**
> соответствующим флагом в определении (`enableSorting`, `enableResizing`,
> `enablePinning`, `enableDragging`, `enableGrouping`).

Импортируйте нужные фабрики из `@tessera-grid/tessera/plugins` и передайте их вызовы в
`plugins` (наличие в массиве = плагин включён):

```tsx
import {
  rowSelection,
  columnSorting,
  columnSizing,
} from '@tessera-grid/tessera/plugins'

useCreateTable({
  columns,
  data,
  plugins: [rowSelection(), columnSorting(), columnSizing()],
})
```

Плагины, которые вы не импортировали и не передали, не попадают в бандл (tree-shaking).
Тонкие опции задаются аргументом фабрики (`columnSorting({ removal, multiSort })`,
`rowExpanding({ maxDepth })`), а колонка действий — плагином `rowActions({ width })`.

> ⚠️ **Аргументы фабрик живые** — меняйте их в рендере как обычные пропсы, мемоизировать
> массив `plugins` не нужно. Исключения ([ADR 0039](docs/decisions/0039-reactive-plugin-arguments.md)):
>
> - **состав массива** фиксирован на время жизни таблицы: включайте и выключайте
>   плагин через `enabled`, а не добавлением в массив — добавленный позже плагин не
>   подключится (dev-warn), удалённый выключится как `enabled: false`;
> - **режим данных** (`useCreateTable({ dataMode })`: `'client'`, `'server'` или по операциям
>   `sorting`, `filtering`, `search`, `pagination`, `export`;
>   [ADR 0169](docs/decisions/0169-data-mode.md)) — тоже на время жизни: для смены пересоздайте
>   таблицу, например новым `key`. Итог строк сервера (`rowCount`, `-1` — неизвестен;
>   `totalRowCount` — до фильтров и поиска), язык `locale`, пояс дат `timeZone` и язык
>   календарей `dateLocale` (объект `Locale` `date-fns`) — тоже опции `useCreateTable`, они
>   живые;
> - **начальные значения** (`pagination({ initialPageSize })`) задают только старт,
>   текущим значением владеет состояние таблицы.
>
> Функции-предикаты (`canSelectCell`, `canEditCell`, `canDragRow`) тоже живые:
> новая ссылка сразу перерисовывает ячейки. Инлайн-лямбда поэтому перерисовывает видимые
> ячейки на каждый рендер компонента с `useCreateTable` — на больших таблицах
> мемоизируйте предикаты через `useCallback`. На корректность это не влияет.

<a name="business_plugins" id="business_plugins"></a>

### Реализация бизнес-логики для плагинов

Бизнес-логика плагина (колбэки) задаётся **прямо в аргументах его фабрики** —
параметры типизируются нативно из сигнатуры плагина, отдельного объекта `hooks` нет:

```tsx
import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const [rowSelectionState, onRowSelectionChange] = useState<RowSelectionValue>(
    {},
  )

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      // Колбэки — в аргументах фабрики; параметры типизированы, задавать все не нужно.
      rowSelection({
        rowSelection: rowSelectionState,
        onRowSelectionChange,
        onSelectRow: (row, selected) => console.info(row.id, selected),
        onSelectAllRows: (selected, scope) =>
          console.info('all', selected, scope),
      }),
    ],
  })

  return <DataGrid table={table} />
}
```

Колбэки читаются **живо** через `table.getHooks()` в момент вызова, поэтому
передавайте обычные (в т.ч. инлайновые) функции — мемоизировать их не нужно.
Незаданные колбэки дополняются no-op дефолтами, так что чтение любого слайса
не упадёт.

> ⚠️ Колбэки — контекст для бизнес-функций, а не для динамических признаков рендера.
> Для значений, влияющих на отрисовку, используйте `state` и точечные подписки
> (см. следующую главу).

<a name="reactivity" id="reactivity"></a>

### Реактивность обновления данных

Разберёмся, как в Tessera обновляется содержимое отдельной ячейки, строки, заголовка или всей таблицы.

1. **Полное пересоздание.** При изменении ссылок на `columns` или `data` `TanStack Table` пересоздаёт таблицу целиком. Поэтому держите эти ссылки **стабильными** (мемоизация).

2. **Гранулярные подписки.** Состояние таблицы живёт в TanStack Store: каждый слайс — это атом, на который компонент подписывается точечно и ре-рендерится только при изменении именно этого слайса. Ручного механизма подписки больше нет — точечные подписки идут через хелперы `useSlice` и `useTableState`, экспортируемые из `@tessera-grid/tessera`.

<a name="reactivity_methods" id="reactivity_methods"></a>

#### Точечные подписки: `useSlice` и `useTableState`

- `useSlice(table, 'rowSelection')` — подписка на **один** встроенный слайс состояния (самая узкая: ре-рендер только при изменении этого слайса).
- `useTableState(table, s => ...)` — подписка на **проекцию** из общего состояния с shallow-сравнением; нужна, когда требуется несколько срезов сразу или собственный ключ состояния.

```tsx
import { memo } from 'react'
import { useSlice, type CellComponentProps } from '@tessera-grid/tessera'

export const PluginComponent = memo(({ row, table }: CellComponentProps) => {
  // Узкая подписка на встроенный слайс: компонент реагирует только на выбор строк.
  useSlice(table, 'rowSelection')

  const selected = row.getIsSelected()

  // ...
})
```

Так вы делаете интерактивными только нужные части таблицы, не задевая остальные компоненты. Для подписки на **собственное** состояние используйте `useTableState` с проекцией (пример — в гайде 2 ниже).

<a name="custom_plugin" id="custom_plugin"></a>

### Создание своего плагина

`Tessera` предоставляет API для создания пользовательских плагинов. Это позволит разработчикам создавать собственные поддерживаемые плагины и не дублировать бойлерплейт из таблицы в таблицу.

> Как создать свой плагин?

Плагин пишется через **`definePlugin`** — декларации по именованным полям. Каррированная
форма `definePlugin<Opts>()({ … })` задаёт входной тип опций **один раз** (в дженерике), а
`o` в `options`/`hooks` выводится из него. Обязателен только `id`.

```tsx
import { definePlugin } from '@tessera-grid/tessera'

interface MyPluginOptions {
  enabled?: boolean // наличие в plugins = включён; enabled:false — выключить, не убирая
  onSomething?: (id: string) => void // бизнес-колбэк (задаётся в аргументах фабрики)
}

export const myPlugin = definePlugin<MyPluginOptions>()({
  id: 'myPlugin', // уникальный id; служит и ключом scope для хуков и локального state
  features: {
    /* фрагмент фич TanStack: rowSortingFeature, filteredRowModel и т.п. */
  },
  options: o => ({
    /* табличные опции фичи, напр. { enableSorting: o.enabled !== false } */
  }),
  hooks: o => ({ onSomething: o.onSomething ?? (() => {}) }), // живые бизнес-колбэки
  // state: () => /* дефолт ЛОКАЛЬНОГО состояния плагина — см. Гайд 2 */,
  slots: [/* что рисуем в ячейках/строках/заголовках (см. ниже) */],
  slotActions: [/* действия для кебаб-меню заголовка/строки */],
  contextMenuActions: [/* пункты контекстного меню по правому клику */],
  keyboardActions: [/* что делают Space / Enter / F2 на ячейках плагина */],
  column: {/* сервисная колонка плагина (напр. колонка чекбоксов) */},
  diagnose: table => /* причина инертности или undefined */ undefined,
  setup: o => table => {
    /* императивный сетап после создания таблицы; может вернуть cleanup */
  },
})
```

Плагин **декларативно** описывает, что добавить в таблицу; ядро собирает активные плагины реактивно — появление/исчезновение UI следует за наличием плагина в массиве `plugins`.

> Какое поле использовать?

- **Отрисовать контент** в ячейке/строке/заголовке — `slots` (место задаётся полем `slot`: `leftCellSlot` / `rightCellSlot` / `actionRowSlot` / `leftHeaderSlot` / `rightHeaderSlot`).
- **Добавить кнопку в верхний тулбар** (при `enableToolbar`) — `slot: 'toolbarSlot'`: компонент получает `{ table }`, рисуйте кнопку `ToolbarButton`; поле `group` раскладывает кнопки по подгруппам с разделителями. См. «Рамка и верхний тулбар».
- **Показать сведения о данных под таблицей** (счётчики, статус) — `slot: 'statusBarSlot'`: компонент получает `{ table }`, поле `align` (`'start'` / `'end'`) выбирает сторону нижней панели. Панель появляется, пока есть хоть один такой слот. Сверху — контролы (тулбар), снизу — сведения.
- **Заместить рендер ячейки** (напр. инлайн-редактором) — `slot: 'cellSlot'` (слот-владелец): компонент получает собственный рендер ячейки пропсом `content` и рантайм решает, показать его или заместить своим. Единственный канал, подавляющий рендер ячейки. См. Гайд 2.
- **Добавить свою колонку** — `column` (сервисная колонка со своими `header`/`cell`).
- **Добавить действие в кебаб-меню** — `slotActions`. `placement: 'menu'` — только строка кебаба, без инлайн-кнопки; кебаб, который оно показывает, считается в пороге одной кнопкой; без плагина-меню такое действие не показывается.
- **Добавить пункт в контекстное меню** (правый клик, плагин `contextMenu`) — `contextMenuActions`.
- **Дать клавиатурное действие ячейкам** (при опции `enableKeyboardNavigation`) — `keyboardActions`: `{ id, scope: 'cell' | 'header', keys: [' ', 'Enter', 'F2', 'Alt+Shift+ArrowUp'], priority?, visible?(ctx), run(ctx, event) }` (сочетания — в форме `Ctrl+Alt+Shift+Meta+key`, срабатывают только с `Alt`). Резолвер берёт применимое действие с наибольшим `priority` (по умолчанию `0`), при равенстве — первое по порядку `plugins`; вызывайте из `run` ту же функцию, что и по клику, — с теми же хуками.
- **Сообщить, что плагин сейчас не работает** — `diagnose(table)`: вернуть причину (`'grouping'`, `'sorting'`, своя строка) или `undefined`. Результат виден в `table.getPluginDiagnostics()` — снимке `{ id, status: 'active' | 'inert' | 'error', reason?, error? }` по каждому подключённому плагину на момент вызова (`enabled: false` → `reason: 'disabled'`). Если компонент плагина, его `setup` или `diagnose` бросит исключение, грид не упадёт: UI этого плагина погаснет, ошибка уйдёт в `logError`, а в снимке плагин получит `status: 'error'`. Используйте в `diagnose` ту же проверку, что гасит ваш `getCan*`.
- **Включить поведение TanStack Table** (сортировка, фильтрация и т.п.) — `features` (фрагмент фич) + `options`.
- **Живые бизнес-колбэки** (задаются в аргументах фабрики) — `hooks`; компонент получает их **пропсом** `hooks` (без кастов).
- **Локальное состояние плагина** — `state` (дефолт слайса); компонент получает его **пропсом** `state: [value, setter]`. См. Гайд 2.
- **Побочный эффект после создания таблицы** — `setup`.

> ⚠️ Важно!
>
> Компоненты слотов получают контекст ячейки/заголовка типизированными пропсами
> (`PluginCellProps<THooks>` / `PluginHeaderProps<THooks>`, а для локального состояния —
> `PluginCellStateProps<THooks, TState>`) и рендерятся часто: не кладите в них тяжёлые
> вычисления, оборачивайте в `memo` и подписывайтесь точечно (`useSlice` / `useTableState`).
> Хуки и state подмешивает `definePlugin`: компонент слота или сервисной колонки
> получает их пропсами с типами из деклараций плагина — не читайте их кастами
> `table.getHooks() as …`. Пара `state` приходит слоту с `state: true`. Владелец ячейки
> (`cellSlot`) получает ещё пропс `content` (тип `PluginCellOwnerProps<THooks, TState>`).

<a name="custom_plugin_example_1" id="custom_plugin_example_1"></a>

#### Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке

Создаем плагин для отрисовки кнопки в строках:

```tsx
// rowDownloadAction.tsx

import { definePlugin } from '@tessera-grid/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'

// Плагин через definePlugin. Рисуем кнопку в слоте действий каждой строки.
export const rowDownloadAction = definePlugin<{ enabled?: boolean }>()({
  // id должен быть уникальным, иначе это может привести к коллизии плагинов
  id: 'rowDownloadAction',
  slots: [
    {
      id: 'rowDownloadAction',
      slot: 'actionRowSlot',
      // Кнопка будет первой по списку (если есть другие кнопки) в конце каждой строки
      order: 0,
      component: RowDownloadComponent,
    },
  ],
})
```

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { RowDownloadButton } from './RowDownloadButton'

export const RowDownloadComponent = memo(() => {
  return <RowDownloadButton />
})

RowDownloadComponent.displayName = 'RowDownloadComponent'
```

Далее, добавляем новый плагин в параметр `plugins`:

```tsx
// MyTable.tsx

import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  rowActions,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadAction } from './rowDownloadAction'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const [rowSelectionState, onRowSelectionChange] = useState<RowSelectionValue>(
    {},
  )

  const table = useCreateTable({
    columns,
    data,
    // Встроенные плагины — фабриками (колбэки в их аргументах); колонка действий —
    // rowActions({ width }); пользовательский плагин — записью реестра.
    plugins: [
      rowSelection({
        rowSelection: rowSelectionState,
        onRowSelectionChange,
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction(),
    ],
  })

  return <DataGrid table={table} />
}
```

Отлично! Теперь нужно сделать так, чтобы при нажатии на кнопку что-то происходило. Давайте это сделаем!

Чтобы кнопка что-то делала, дадим плагину **свой колбэк**. Сначала опишем его
контракт в `types.ts`:

```ts
// types.ts

// Контракт хуков нашего плагина (слайс)
export interface RowDownloadHooks {
  onDownload: (fileId: string) => void
}
```

Объявим колбэк в `hooks` фабрики (как встроенные плагины) — компонент слота получит
его пропсом `hooks`:

```tsx
// rowDownloadAction.tsx

import { definePlugin } from '@tessera-grid/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'
import type { RowDownloadHooks } from './types'

export interface RowDownloadOptions {
  enabled?: boolean
  onDownload?: RowDownloadHooks['onDownload']
}

// hooks эмитит слайс колбэков (undefined-ключи отбрасываются, дефолт — no-op);
// definePlugin подмешивает его компоненту пропсом `hooks`. Компонент, ждущий другие
// хуки, — ошибка компиляции.
export const rowDownloadAction = definePlugin<RowDownloadOptions>()({
  id: 'rowDownloadAction',
  hooks: o => ({ onDownload: o.onDownload ?? (() => {}) }),
  slots: [
    {
      id: 'rowDownloadAction',
      slot: 'actionRowSlot',
      order: 0,
      component: RowDownloadComponent,
    },
  ],
})
```

Компонент получает колбэк **типизированным пропсом** `hooks` — без кастов
`table.getHooks() as …`:

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { type PluginCellProps } from '@tessera-grid/tessera'
import type { RowDownloadHooks } from './types'
import { RowDownloadButton } from './RowDownloadButton'

// hooks приходят пропсом (типизированы из RowDownloadHooks), без table.getHooks()-каста.
export const RowDownloadComponent = memo(
  ({ row, hooks }: PluginCellProps<RowDownloadHooks>) => (
    <RowDownloadButton onClick={() => hooks.onDownload(row.original.id)} />
  ),
)

RowDownloadComponent.displayName = 'RowDownloadComponent'
```

Подключаем плагин фабрикой и передаём колбэк в её аргументах:

```tsx
// MyTable.tsx

import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  rowActions,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadAction } from './rowDownloadAction'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const [rowSelectionState, onRowSelectionChange] = useState<RowSelectionValue>(
    {},
  )

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      rowSelection({
        rowSelection: rowSelectionState,
        onRowSelectionChange,
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      // Колбэк нашего плагина — в его же аргументах.
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
    ],
  })

  return <DataGrid table={table} />
}
```

> ⚠️ Обратите внимание, что `Tessera` уже экспортирует готовые фасады кнопок действий для таблицы (`CellButton`, `RowButton`) — импортируйте их из `@tessera-grid/tessera/ui`. Их вид настраивается токенами темы `--tsr-comp-action-button-*`.

Поздравляю! Теперь мы можем реагировать на нажатии кнопки в каждой строке!

<a name="custom_plugin_example_2" id="custom_plugin_example_2"></a>

#### Гайд 2. Кнопка "скрыть значение" в ячейках

Плагин может держать собственное состояние. Давайте заведём состояние с `id` скрытых
ячеек: кнопка в ячейке переключает признак, а содержимое скрытой ячейки заменяется
надписью. Опишем типы в `types.ts`:

```ts
// types.ts (добавляем к предыдущим типам)

// Состояние плагина: признак скрытия по id ячейки.
export type HiddenCells = Record<string, boolean>

export interface CellHiddenOptions {
  enabled?: boolean
  /** Скрытые ячейки: задаёт приложение; без них состояние хранит плагин. */
  hiddenCells?: HiddenCells
  /** Новое значение после каждого переключения. */
  onHiddenCellsChange?: (next: HiddenCells) => void
  /** Скрытые ячейки при монтировании, если состояние хранит плагин. */
  initialHiddenCells?: HiddenCells
}
```

Состояние объявим полем `state` в `definePlugin`, а его имя в аргументах — полем
`stateName`: плагин принимает `hiddenCells`, `onHiddenCellsChange` и `initialHiddenCells`,
как срезы TanStack. Так состояние может держать и сам плагин, и приложение через аргументы
фабрики. Плагин рисует кнопку справа в ячейке (`rightCellSlot`) и замещает
содержимое скрытой ячейки (`cellSlot`); оба слота получают состояние пропсом
`state: [value, setter]`:

```tsx
// cellHiddenAction.tsx

import { definePlugin } from '@tessera-grid/tessera'
import { CellHiddenToggle } from './CellHiddenToggle'
import { CellHiddenContent } from './CellHiddenContent'
import type { CellHiddenOptions, HiddenCells } from './types'

export const cellHiddenAction = definePlugin<CellHiddenOptions>()({
  id: 'cellHiddenAction',
  state: (): HiddenCells => ({}),
  stateName: 'hiddenCells',
  slots: [
    {
      id: 'cellHiddenToggle',
      slot: 'rightCellSlot',
      order: 0,
      state: true,
      component: CellHiddenToggle,
    },
    {
      id: 'cellHiddenContent',
      slot: 'cellSlot',
      state: true,
      component: CellHiddenContent,
    },
  ],
})
```

Кнопка переключает признак своей ячейки:

```tsx
// CellHiddenToggle.tsx

import type { PluginCellStateProps } from '@tessera-grid/tessera'
import { CellHiddenButton } from './CellHiddenButton'
import type { HiddenCells } from './types'

export const CellHiddenToggle = ({
  cell,
  state: [hidden, setHidden],
}: PluginCellStateProps<Record<never, never>, HiddenCells>) => (
  <CellHiddenButton
    active={!!hidden[cell.id]}
    onClick={() => setHidden({ ...hidden, [cell.id]: !hidden[cell.id] })}
  />
)
```

Владелец ячейки (`cellSlot`) получает её собственный рендер пропсом `content` и решает,
показать его или заместить:

```tsx
// CellHiddenContent.tsx

import type { PluginCellOwnerProps } from '@tessera-grid/tessera'
import type { HiddenCells } from './types'

export const CellHiddenContent = ({
  cell,
  content,
  state: [hidden],
}: PluginCellOwnerProps<Record<never, never>, HiddenCells>) =>
  hidden[cell.id] ? 'Содержимое скрыто' : content
```

Подключаем плагин. Если скрытые ячейки нужны и приложению (например, чтобы сохранить их),
передадим состояние аргументами фабрики:

```tsx
// MyTable.tsx

import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  rowActions,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import type { HiddenCells } from './types'
import { rowDownloadAction } from './rowDownloadAction'
import { cellHiddenAction } from './cellHiddenAction'

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const [selected, setSelected] = useState<RowSelectionValue>({})
  const [hiddenCells, setHiddenCells] = useState<HiddenCells>({})

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      rowSelection({
        rowSelection: selected,
        onRowSelectionChange: setSelected,
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
      cellHiddenAction({ hiddenCells, onHiddenCellsChange: setHiddenCells }),
    ],
  })

  return <DataGrid table={table} />
}
```

> С `hiddenCells` состоянием владеет приложение: переключение приходит в
> `onHiddenCellsChange` и видно, когда приложение передаст новое значение. Без
> `hiddenCells` в аргументах состояние живёт внутри плагина. Состояние плагина
> задаётся только его аргументами: `state`/`handlers` `useCreateTable` принимают лишь
> срезы колонок (ADR 0120).

##### Локальное состояние плагина (`state`)

Состояние плагина объявляют полем `state` в `definePlugin` (как в гайде 2). Ядро сгенерирует v9-фичу и заведёт слайс под ключом `plugin:<id>` (он не пересечётся со
стоковыми срезами TanStack), а
компонент получит его **пропсом** `state: [value, setter]` (без глобальной типизации и
кастов). Так, например, устроен встроенный плагин `cellEditing` (хранит, какая ячейка
редактируется):

```tsx
// myLocalPlugin.tsx
import { definePlugin } from '@tessera-grid/tessera'
import { MyCell } from './MyCell'

interface MyOptions {
  enabled?: boolean
}
// Значение слайса (TState) выводится из возврата `state`.
type MyLocalState = string | null

export const myLocalPlugin = definePlugin<MyOptions>()({
  id: 'myLocalPlugin',
  state: (): MyLocalState => null, // дефолт приватного слайса
  slots: [
    {
      id: 'myLocalPlugin',
      slot: 'rightCellSlot',
      order: 'last',
      // state: true — слот получает `state: [value, setter]` (реактивно) + hooks пропсами.
      state: true,
      component: MyCell,
    },
  ],
})
```

```tsx
// MyCell.tsx
import { type PluginCellStateProps } from '@tessera-grid/tessera'

// state — типизированная пара [значение, сеттер]; TState = MyLocalState.
export const MyCell = ({
  row,
  state: [active, setActive],
}: PluginCellStateProps<Record<never, never>, string | null>) => (
  <button onClick={() => setActive(active === row.id ? null : row.id)}>
    {active === row.id ? 'on' : 'off'}
  </button>
)
```

> **Кто владеет состоянием.** Состояние нужно только плагину → поле `state` (пропс
> `state: [value, setter]`). Нужно и приложению → вдобавок пара `controlled`: приложение
> передаёт значение и колбэк аргументами фабрики (как `hiddenCells` в гайде 2).

##### Замещение рендера ячейки (`cellSlot`) и свой редактор

Обычные слоты (`leftCellSlot` / `rightCellSlot`) **добавляются** рядом с собственным
рендером ячейки — не замещают его. Когда плагину нужно в какой-то момент **заменить**
контент ячейки (инлайн-редактор, свой просмотрщик), объявите слот-владельца
`slot: 'cellSlot'` (с `state: true`, если владельцу нужно локальное состояние). Владелец получает
собственный рендер ячейки пропсом `content` (`PluginCellOwnerProps<THooks, TState>`) и
рантайм решает, отдать его как есть или заместить своим UI. Это **единственный** канал,
подавляющий рендер ячейки; в сервисных колонках слоты не рендерятся, поэтому владелец
там не сработает.

> ⚠️ Владение ячейкой **эксклюзивно**: держите один владелец `cellSlot` на таблицу.
> Несколько владельцев вкладываются (в покое контент проходит насквозь), но при
> одновременной активности внешний замещает контент, а внутренние не рендерятся —
> ядро на такой набор выдаёт дев-варн.

Так устроен встроенный `cellEditing`: кнопка правки живёт в `rightCellSlot` (по hover),
а редактор — во владельце `cellSlot` (замещает значение на время правки). Редактор —
**сменный** (BYO — под свою дизайн-систему): `editor` у колонки, у её типа в реестре
`dataTypes` или аргументом плагина — по этому порядку; не задан — встроенный по типу колонки:

```tsx
import { cellEditing } from '@tessera-grid/tessera'
import { MyInput } from './design-system'

cellEditing({
  // editor получает черновик в типе колонки (value) и текстом (text), доступное имя поля
  // (label — из localization.editCellValue с именем колонки), сохранение — commit(value)
  // для значения в типе или commitText(text) для набранного текста (его разбирает тип
  // колонки), cancel и контекст ячейки. setDraft и setText сообщают черновик: он
  // переживает прокрутку и смену страницы, а при отмене приходит в onEditCancel.
  editor: ({ text, label, error, commitText, cancel, setText }) => (
    <MyInput
      aria-label={label}
      error={error}
      defaultValue={text}
      onChange={setText}
      onEnter={commitText}
      onBlur={event => commitText(event.target.value)}
      onEscape={cancel}
      autoFocus
    />
  ),
})
```

Каждая сессия действия сообщает не только об успехе, но и о завершении без результата
([ADR 0040](docs/decisions/0040-action-sessions.md)): `onEditCancel`, `onRowDragCancel`,
`onColumnDragCancel`, `onColumnResizeCancel` получают причину — `'cancel'` (`Escape`,
бросок мимо), `'revoke'` (запрет на лету) или `'unavailable'` (строка или колонка ушла).
`Escape` во время ресайза отменяет его и возвращает ширины.

Свой владелец ячейки в собственном плагине:

```tsx
import { definePlugin, type PluginCellOwnerProps } from '@tessera-grid/tessera'

// content — собственный рендер ячейки; показываем его или замещаем своим UI.
const MyOwner = ({
  content,
  state: [active, setActive],
  row,
}: PluginCellOwnerProps<Record<never, never>, string | null>) =>
  active === row.id ? <input autoFocus /> : <>{content}</>

export const myOwner = definePlugin<{ enabled?: boolean }>()({
  id: 'myOwner',
  state: (): string | null => null,
  slots: [
    {
      id: 'myOwner',
      slot: 'cellSlot',
      state: true,
      component: MyOwner,
    },
  ],
})
```

<a name="custom_plugin_example_3" id="custom_plugin_example_3"></a>

#### Гайд 3. Создать новую колонку с кастомным Switch

Представим, что мы хотим отрисовать еще одну колонку в конце таблицы с кастомным Switch-компонентом.

В v9 плагин может принести **свою колонку** сам — через поле `column` (как это делают
встроенные `rowSelection` / `rowExpanding`). Отдельно добавлять колонку в `useColumns`
не нужно.

```tsx
// switchAction.tsx

import { definePlugin } from '@tessera-grid/tessera'
import { SwitchActionComponent } from './SwitchActionComponent'

export const SWITCH_ACTION_COLUMN_ID = 'switchActionColumn'

// Сервисная колонка плагина: ставится справа (side: 'trailing'), ячейки рисует
// SwitchActionComponent. make() строит ColumnDef колонки.
export const switchAction = definePlugin<{ enabled?: boolean }>()({
  id: 'switchAction',
  column: {
    id: SWITCH_ACTION_COLUMN_ID,
    side: 'trailing',
    order: 0,
    make: () => ({
      id: SWITCH_ACTION_COLUMN_ID,
      size: 150,
      minSize: 150,
      header: 'Checked',
      cell: SwitchActionComponent,
      enablePinning: false,
      enableSorting: false,
      enableResizing: false,
    }),
  },
})
```

Компонент ячейки со Switch (в служебной колонке слоты не рендерятся — кнопка скрытия
из прошлого гайда сюда не попадает):

```tsx
// SwitchActionComponent.tsx

import { memo } from 'react'
import { Switch } from './Switch'

export const SwitchActionComponent = memo(() => <Switch />)

SwitchActionComponent.displayName = 'SwitchActionComponent'
```

При необходимости в этот плагин можно так же добавить кастомные хуки и состояния, как мы это делали в предыдущих гайдах. Компонент, которому нужны хуки плагина, передайте в `column.cell` / `column.header`: `definePlugin` подмешает `hooks` пропсом и отдаст обёрнутые компоненты аргументом `make({ cell, header })`.

Подключим плагин:

```tsx
// MyTable.tsx

import { useState } from 'react'
import { useCreateTable, DataGrid } from '@tessera-grid/tessera'
import {
  rowSelection,
  rowActions,
  type RowSelectionValue,
} from '@tessera-grid/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import type { HiddenCells } from './types'
import { rowDownloadAction } from './rowDownloadAction'
import { cellHiddenAction } from './cellHiddenAction'
import { switchAction } from './switchAction'

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const [selected, setSelected] = useState<RowSelectionValue>({})
  const [hiddenCells, setHiddenCells] = useState<HiddenCells>({})

  const table = useCreateTable({
    columns,
    data,
    plugins: [
      rowSelection({
        rowSelection: selected,
        onRowSelectionChange: setSelected,
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
      cellHiddenAction({ hiddenCells, onHiddenCellsChange: setHiddenCells }),
      switchAction(),
    ],
  })

  return <DataGrid table={table} />
}
```

> Обратите внимание, что видимостью, закреплением и порядком колонок вы можете управлять через хуки состояний, экспортируемые из `@tessera-grid/tessera`.

Поздравляем! Теперь вы знаете как управлять состоянием таблицы, создавать плагины и взаимодействовать с ними!

<a name="best_practices" id="best_practices"></a>

### Best practices

#### Синхронная и асинхронная загрузка данных в таблице

Состояние загрузки `Tessera` принимает одним пропом `loading`: `'initial'`, `'refresh'` или `false`.

1. Если Вы первый раз загружаете данные для таблицы, передайте `loading: 'initial'`, чтобы добиться лучшего UX во время ожидания данных.
   Вы также можете использовать параметр `skeletonOptions`, чтобы настроить количество скелетонов по обоим осям.

2. Если Вам нужно отобразить асинхронное неблокирующее обновление данных, передайте `loading: 'refresh'` — под строкой заголовков появится свечение. Задержку и минимум показа задаёт `refreshOptions`.

С TanStack Query: `loading: isLoading ? 'initial' : isFetching ? 'refresh' : false`.

<a name="server_row_model" id="server_row_model"></a>

#### Большие данные: серверная модель строк

Когда строк слишком много, чтобы загрузить их целиком, подключите `serverRowModel`: грид сам
просит у сервера строки блоками по мере прокрутки и держит их в кэше
([ADR 0138](docs/decisions/0138-server-side-row-model.md)). `data` в этом режиме не читается.

```tsx
import {
  serverRowModel,
  type ServerRowsRequest,
} from '@tessera-grid/tessera/plugins'

const getRows = async ({
  start,
  end,
  sorting,
  columnFilters,
  globalFilter,
  signal,
}: ServerRowsRequest) => {
  const response = await fetch('/api/items', {
    method: 'POST',
    body: JSON.stringify({ start, end, sorting, columnFilters, globalFilter }),
    signal,
  })
  const { rows, total } = await response.json()
  // Итог необязателен: без него список растёт по блокам до короткого блока.
  return { rows, rowCount: total }
}

const table = useCreateTable({
  columns,
  data: [],
  // У каждой строки — свой строковый id: индекс после перезапроса бессмыслен.
  getRowId: row => row.id,
  plugins: [serverRowModel({ getRows, blockSize: 100, maxBlocks: 100 })],
})
```

- **Запросы.** `getRows` получает диапазон `[start, end)`, текущие сортировку, фильтры и
  поиск и `signal`: ушедший из окна блок отменяется. Незагруженные строки — скелеты, отказ
  блока — строка ошибки с повтором. В кэше не больше `maxBlocks` блоков, давно не нужные
  вытесняются.
- **Сортировка, фильтры, поиск** считает сервер. Смена перезапрашивает список с начала:
  прежние строки остаются под свечением до ответа, отказ откатывает сортировку.
- **Обновление.** `table.refreshRows()` перезапрашивает окно (`{ purge: true }` — сразу со
  скелетами), `table.setRowData(id, updater)` меняет одну строку в кэше.
- **Транзакции.** `table.applyRowTransaction({ add, index, update, remove, parentId, rowCount })`
  добавляет, меняет и удаляет строки без перезапроса: новые встают на место `index` (в ветке
  `parentId`), строки ниже едут, новая вспыхивает. Без `index` место знает только сервер —
  окно тихо перезапрашивается. Транзакции одного кадра применяются вместе — поток изменений
  с сервера (push, WebSocket) стоит одной перерисовки на кадр.
- **Страницы.** С `pagination()` сервер по-прежнему отдаёт блоки, а таблица показывает их
  страницами: страница — `pageSize` строк верхнего уровня, раскрытые ветки — на странице
  родителя. Незагруженная страница открывается сразу со скелетами, посещённая — из кэша без
  запроса. Пока итог неизвестен, пейджер показывает «1–25 of many», а последнюю страницу
  открыть нельзя. Режим пагинации `dataMode` здесь не нужен: данные страниц запрашивает грид.
- **Прокрутка к строке.** `table.scrollToRowIndex(index)` загружает блок и прокручивает к
  строке; `table.scrollToRow(id, { index })` — по id с подсказкой места. Строка другой
  страницы — сначала переход на её страницу.
- **Правка ячейки.** Верните сохранённую строку из `onCellEdit` — сразу или промисом — и она
  ляжет в кэш; иначе в кэш ложится сохранённое значение в типе колонки (см. [Параметризация
  колонок](#columns_settings)).
- **Выбор и выгрузка.** «Выбрать всё» не грузит строки: срез выбора — `{ all: true, except }`.
  Серверная выгрузка — `dataMode: { export: 'server' }`, запрос несёт выборку (`query`) и выбор
  (`selection`). Без неё страница и вся выборка выгружаются в браузере, с догрузкой строк, до предела
  `maxLoadedRows` (10 000); `selectAll: 'currentPage'` при пагинации выбирает строки страницы.
- **Ручной порядок.** `rowDragging({ onRowDragEnd })` переносит строки и здесь: строка сразу
  встаёт на новое место в кэше, `onRowDragEnd` получает место среди всех строк списка и
  может вернуть промис — отказ возвращает строку. Над незагруженными строками бросить
  нельзя; меню ручки умеет ещё «в начало» и «в конец» списка, вложить строку в соседнюю ветку,
  вынести её и перенести лист в соседнюю группу. При серверной сортировке,
  фильтре и поиске перенос недоступен — порядком владеет сервер.
- **Дерево.** `rowExpanding({ hasChildren })` раскрывает строки: `getRows` получает
  `parentId` и отдаёт детей блоками.
- **Предел браузера.** Список выше 8 млн px (160 000 строк по 50px) грид растягивает сам:
  полоса прокрутки сжата, ползунок отмеряет весь итог, колесо и клавиши двигают строки как
  в коротком списке, шапка держится. Касание и протяжка ползунка в таком списке — грубее,
  на долю итога.

#### Рамка и верхний тулбар

Грид всегда рисует собственную рамку со скруглением. Если у Вас уже есть своя
обёртка с рамкой, уберите нашу токеном `--tsr-comp-frame-border-width: 0`.

`enableToolbar` добавляет над таблицей тулбар для кнопок, относящихся ко всей
таблице. Тулбар не прокручивается вместе с таблицей и рисуется, даже если в нём
пока нет кнопок. Кнопки добавляют плагины через слот `toolbarSlot` и компонент
`ToolbarButton` из `@tessera-grid/tessera/ui`:

```tsx
import { ToolbarButton } from '@tessera-grid/tessera/ui'

const exportPlugin = definePlugin<{ enabled?: boolean }>()({
  id: 'export',
  slots: [
    {
      id: 'exportButton',
      slot: 'toolbarSlot',
      group: 'data', // подгруппа; между подгруппами — разделитель
      order: 0,
      component: ({ table }) => (
        <ToolbarButton
          label="Export"
          icon={<Download size={18} />}
          onClick={() => downloadCsv(table)}
        />
      ),
    },
  ],
})

useCreateTable({
  columns,
  data,
  enableToolbar: true,
  plugins: [exportPlugin()],
})
```

#### Словарь подписей

Подписи таблицы переводит словарь `localization`, язык чисел и форм слова — опция таблицы
`locale`. Ключи ядра — плоские (`table`), ключи плагинов — `<плагин>.<ключ>`
(`'pagination.rowsPerPage'`); значение — строка-шаблон с `{имя}` или функция.

```tsx
const ru: LabelDictionary = { table: 'Таблица', 'pagination.rowsPerPage': 'Строк на странице' }

const table = useCreateTable({ columns, data, plugins, locale: 'ru' })

<DataGrid table={table} localization={ru} />
```

Ключ, которого нет в типе словаря, — ошибка компиляции на `<DataGrid localization={ru} />`, в том
числе у словаря из JSON (`resolveJsonModule`). Тип не видит ключей словаря, загруженного в рантайме
(`fetch`, i18n-бэкенд), и такой словарь проходит. В разработке таблица предупреждает об опечатке в
ключе ядра и в ключе своего плагина, а ключи плагинов, которых в ней нет, не проверяет: словарь
обычно один на всё приложение. Опечатка в имени плагина (`'paginaton.rowsPerPage'`) в таком словаре
молча оставит английскую подпись, поэтому проверяйте его целиком в тесте приложения:

```ts
import { unknownLabelKeys } from '@tessera-grid/tessera'
import { allLabelSets } from '@tessera-grid/tessera/plugins'

test('словарь без опечаток', () => {
  expect(
    unknownLabelKeys(ru, [...allLabelSets, ...(myPlugin().labels ?? [])]),
  ).toEqual([])
})
```

Свой плагин объявляет подписи набором `defineLabels` и дополняет тип словаря:

```ts
import { defineLabels, definePlugin } from '@tessera-grid/tessera'

const archiveRowsLabels = defineLabels<{ archive: string }>()(
  'archiveRows', // id плагина — префикс ключей в словаре
  { archive: 'Archive' }, // английские значения
  {}, // имена параметров подписей-функций
)

declare module '@tessera-grid/tessera' {
  interface PluginLabels {
    archiveRows: typeof archiveRowsLabels
  }
}

export const archiveRows = definePlugin()({
  id: 'archiveRows',
  labels: [archiveRowsLabels],
})
```

Вызов набора с подписями таблицы даёт подписи плагина на её языке:
`archiveRowsLabels(labels).archive`.

#### Внешние зависимости для таблицы

1. Не создавайте внешние зависимости для функции создания колонок, ячеек и заголовков. Это ведет к пересозданию всей таблицы и сильно влияет на производительность.

> Что делать, если мне нужно вызвать свою функцию или прочитать значение извне в ячейке?
>
> Используйте `state` или `hooks`!

2. Для динамических признаков/состояний, которые живут извне таблицы, но должны влиять на рендер отдельных ее частей, используйте `state`.
   Напоминаем, что его типизация расширяема, а ячейки, заголовки и плагины могут гранулярно подписываться на его изменение.

> Могу ли я пробросить динамический признак или состояние через `hooks` и подписаться на него?
>
> Технически да, но пожалуйста, не делайте так. `hooks` - это контекст для бизнес-функций, которые в идеале не должны мемоизироваться. Для динамических состояний мы используем `state`.

3. Для бизнес-функций, внешних методов и событий, которые нужно вызывать внутри таблицы, используйте `hooks`.
   Их изменение не должно вызывать ререндер таблицы, поэтому на момент их вызова они будут актуальны.
   Помните, что ререндер может вызывать только подписка на `state`, сама таблица и полное пересоздание колонок или данных.

> Не смешивайте техническую реализацию таблицы и Вашу бизнес-логику, иначе библиотека превратится в God Object, а ее поддержка станет невозможна.
>
> Мы постарались разложить эти абстракции на слои, чтобы решение оставалось максимально гибким.

#### Типы из TanStack Table

`Tessera` не переэкспортирует типы `TanStack Table` (`ColumnDef`, `Row`, `Cell`, `CellContext`, `OnChangeFn` и т.д.): `@tanstack/react-table` — peer-зависимость, импортируйте их напрямую.

Типы v9 параметризованы набором фич (`TFeatures`). Набор выводится из Ваших плагинов через `TesseraFeatures`:

```tsx
import { useCreateTable, type TesseraFeatures } from '@tessera-grid/tessera'
import { columnPinning, columnSorting } from '@tessera-grid/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'

// Держите набор плагинов вне компонента: он же задаёт тип фич
const plugins = [columnPinning(), columnSorting()] as const
type Features = TesseraFeatures<typeof plugins>

const columns: ColumnDef<Features, Person, unknown>[] = [
  { accessorKey: 'name', pinSides: 'start' },
]
```

Аугментации `Tessera` (методы `commonFeature` вроде `column.getIsActionsColumn()`, поле колонки `pinSides`, срезы состояния плагинов) подключаются вместе с импортом пакета — отдельный импорт для них не нужен. API фичи виден в типах ровно тогда, когда плагин есть в `plugins`.

### Полезные ссылки

<ul>
  <li><a href="https://tanstack.com/table">TanStack Table</a> - headless-конструктор построения таблиц</li>
  <li><a href="https://tanstack.com/virtual">TanStack Virtual</a> - виртуальный рендеринг</li>
<li><a href="https://dndkit.com/">Dnd kit</a> - перетаскивание элементов</li>
</ul>

</td></tr></tbody></table>
</center>
