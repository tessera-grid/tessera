<center>
<table align="center" style="max-width: 800px; margin: 8px auto"><tbody><tr><td width="800">

<a name="page-start" href="#"></a>

# Tessera

`@mstrvtt/tessera`

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
> Если Вас интересует только практический пример, то Вы можете найти его здесь: `src/lib/stories/Guide`.

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
})
```

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

import { useCreateTable, DataGrid } from '@mstrvtt/tessera'
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
соответствующие плагины из `@mstrvtt/tessera/plugins` и передайте их фабрики:

```tsx
import { columnSorting, columnSizing } from '@mstrvtt/tessera/plugins'

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

Однако, если Вам нужно вручную работать с некоторым состоянием таблицы, Вам потребуется:

- импортировать соответствующую функцию инициализации состояния
- обязательно добавить методы состояния в `state` и `handlers`

```tsx
// Table.tsx

import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
    },
    handlers: {
      onRowSelectionChange,
    },
    // Включите плагин выбора строк, чтобы состояние rowSelection начало меняться!
    plugins: [rowSelection()],
  })

  return <DataGrid table={table} />
}
```

В этом случае `Tessera` начнет использовать `onRowSelectionChange` для изменения состояния выбранных строк.

При необходимости, Вы можете задать мемоизируемое `initialState` для контролируемого состояния, чтобы изменить поведение таблицы.

<a name="usage_plugins" id="usage_plugins"></a>

### Использование плагинов

Набор базовых плагинов поставляется отдельным входом `@mstrvtt/tessera/plugins`.
Каждый включается добавлением своей фабрики в массив `plugins`:

| Фабрика              | Что делает                                   | UI                             | Ограничения / примечания                                                                                                |
| -------------------- | -------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `columnSorting()`    | Сортировка данных DESC/ASC                   | кнопка в заголовке             | клиентская и серверная; требует `enableSorting` в колонке                                                               |
| `columnSizing()`     | Ресайз колонок                               | хендлер в заголовке            | требует `enableResizing` в колонке                                                                                      |
| `columnPinning()`    | Закрепление колонок слева/справа             | кнопка в заголовке             | работает и под многоуровневой шапкой (групповой пин + вынос отдельных листьев/групп)                                    |
| `columnDragging()`   | Перетаскивание колонок                       | индикатор в заголовке          | требует `enableDragging` в колонке; не работает под многоуровневой (сгруппированной) шапкой                             |
| `rowSelection()`     | Выбор строк                                  | колонка с чекбоксами           | скрывается при активной группировке                                                                                     |
| `rowExpanding()`     | Разворачивание/сворачивание строк            | колонка с кнопкой              | клиентское и серверное; поддерживает иерархию (`getSubRows`)                                                            |
| `rowDragging()`      | Перетаскивание строк и групп                 | колонка с хендлером            | поддерживает иерархию; отключается при активной группировке                                                             |
| `rowGrouping()`      | Группировка данных по колонкам               | кнопка/пункт меню в заголовке  | при активной группировке отключает `rowDragging` и `rowSelection`; под вложенной шапкой несовместима с `columnDragging` |
| `rowActions()`       | Колонка кнопок действий над строкой          | колонка, закреплённая справа   | ширина `width` (px, по умолч. 120) и `collapsedWidth` (56) при схлопывании действий                                     |
| `headerActionMenu()` | Схлопывает кнопки заголовка в кебаб-меню «⋯» | меню в заголовке               | `mode`: `auto` (по порогу) / `always`; `threshold` (по умолч. 3). Своей колонки/фичи не вносит                          |
| `rowActionMenu()`    | Схлопывает действия строки в кебаб-меню «⋯»  | меню в колонке действий строки | `mode`: `auto` / `always`; `threshold` (по умолч. 2). Работает поверх `rowActions()`                                    |

> ⚠️ Плагин включает механику на уровне таблицы, а колонка — **разрешает её для себя**
> соответствующим флагом в определении (`enableSorting`, `enableResizing`,
> `enablePinning`, `enableDragging`, `enableGrouping`).

Импортируйте нужные фабрики из `@mstrvtt/tessera/plugins` и передайте их вызовы в
`plugins` (наличие в массиве = плагин включён):

```tsx
import {
  rowSelection,
  columnSorting,
  columnSizing,
} from '@mstrvtt/tessera/plugins'

useCreateTable({
  columns,
  data,
  plugins: [rowSelection(), columnSorting(), columnSizing()],
})
```

Плагины, которые вы не импортировали и не передали, не попадают в бандл (tree-shaking).
Тонкие опции задаются аргументом фабрики (`columnSorting({ removal, server })`,
`rowExpanding({ maxDepth })`), а колонка действий — плагином `rowActions({ width })`.

<a name="business_plugins" id="business_plugins"></a>

### Реализация бизнес-логики для плагинов

Бизнес-логика плагина (колбэки) задаётся **прямо в аргументах его фабрики** —
параметры типизируются нативно из сигнатуры плагина, отдельного объекта `hooks` нет:

```tsx
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
    },
    handlers: {
      onRowSelectionChange,
    },
    plugins: [
      // Колбэки — в аргументах фабрики; параметры типизированы, задавать все не нужно.
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
        onSelectAllRowsOnPage: selected => console.info('all', selected),
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

2. **Гранулярные подписки.** Состояние таблицы живёт в TanStack Store: каждый слайс — это атом, на который компонент подписывается точечно и ре-рендерится только при изменении именно этого слайса. Ручного механизма подписки больше нет — точечные подписки идут через хелперы `useSlice` и `useTableState`, экспортируемые из `@mstrvtt/tessera`.

<a name="reactivity_methods" id="reactivity_methods"></a>

#### Точечные подписки: `useSlice` и `useTableState`

- `useSlice(table, 'rowSelection')` — подписка на **один** встроенный слайс состояния (самая узкая: ре-рендер только при изменении этого слайса).
- `useTableState(table, s => ...)` — подписка на **проекцию** из общего состояния с shallow-сравнением; нужна, когда требуется несколько срезов сразу или собственный ключ состояния.

```tsx
import { memo } from 'react'
import { useSlice, type CellComponentProps } from '@mstrvtt/tessera'

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

Для начала разберемся в том, что умеет плагин:

```tsx
// Плагин — это запись фичи (TablePlugin = TesseraFeatureEntry).
// Обязателен только id; остальные поля добавляют нужное поведение.
const myPlugin: TablePlugin = {
  id: 'myPlugin', // уникальный идентификатор
  enabled: true, // наличие в plugins = включён; enabled:false — выключить, не убирая
  slot: {
    /* фрагмент фич TanStack: rowSortingFeature, filteredRowModel и т.п. */
  },
  options: {/* табличные опции фичи, напр. { enableSorting: true } */},
  slots: [/* что рисуем в ячейках/строках/заголовках (см. ниже) */],
  slotActions: [/* действия для кебаб-меню заголовка/строки */],
  column: {/* сервисная колонка плагина (напр. колонка чекбоксов) */},
  setup: table => {
    /* императивный сетап после создания таблицы; может вернуть cleanup */
  },
}
```

Плагин **декларативно** описывает, что добавить в таблицу; ядро собирает активные плагины реактивно — появление/исчезновение UI следует за наличием плагина в массиве `plugins`.

> Какое поле использовать?

- **Отрисовать контент** в ячейке/строке/заголовке — `slots` (место задаётся полем `slot`: `leftCellSlot` / `rightCellSlot` / `actionRowSlot` / `leftHeaderSlot` / `rightHeaderSlot`).
- **Добавить свою колонку** — `column` (сервисная колонка со своими `header`/`cell`).
- **Добавить действие в кебаб-меню** — `slotActions`.
- **Включить поведение TanStack Table** (сортировка, фильтрация и т.п.) — `slot` (фрагмент фич) + `options`.
- **Побочный эффект после создания таблицы** — `setup`.

> ⚠️ Важно!
>
> Компоненты слотов (`component`) получают контекст ячейки/заголовка
> (`CellComponentProps` / `HeaderComponentProps`) и рендерятся часто — не кладите в них
> тяжёлые вычисления, оборачивайте в `memo` и подписывайтесь точечно
> (`useSlice` / `useTableState`).

<a name="custom_plugin_example_1" id="custom_plugin_example_1"></a>

#### Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке

Создаем плагин для отрисовки кнопки в строках:

```tsx
// rowDownloadActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'

// Плагин = запись фичи. Рисуем кнопку в слоте действий каждой строки.
export const rowDownloadActionPlugin: TablePlugin = {
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
}
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

import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
    },
    handlers: {
      onRowSelectionChange,
    },
    // Встроенные плагины — фабриками (колбэки в их аргументах); колонка действий —
    // rowActions({ width }); пользовательский плагин — записью реестра.
    plugins: [
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadActionPlugin,
    ],
  })

  return <DataGrid table={table} />
}
```

Отлично! Теперь нужно сделать так, чтобы при нажатии на кнопку что-то происходило. Давайте это сделаем!

Чтобы кнопка что-то делала, дадим плагину **свой колбэк**. Сначала опишем его
контракт в `types.ts`:

```ts
// types.ts (добавляем к уже описанным ItemType/FieldType)

// Контракт кастомного хука нашего плагина
export interface MyTableHooks {
  rowDownloadAction: { onDownload: (fileId: string) => void }
}
```

Переведём плагин на **фабрику**, принимающую колбэк (как встроенные плагины), и
положим его в hook-слайс записи:

```tsx
// rowDownloadActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'
import type { MyTableHooks } from './types'

// Фабрика пользовательского плагина: принимает свой колбэк и кладёт его в hook-слайс
// записи — он читается живо через table.getHooks().
export const rowDownloadAction = (
  opts: Partial<MyTableHooks['rowDownloadAction']> = {},
): TablePlugin => ({
  id: 'rowDownloadAction',
  slots: [
    {
      id: 'rowDownloadAction',
      slot: 'actionRowSlot',
      order: 0,
      component: RowDownloadComponent,
    },
  ],
  hooks: { rowDownloadAction: opts },
})
```

Компонент читает колбэк через `table.getHooks()` с приведением к своему типу:

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { type CellComponentProps } from '@mstrvtt/tessera'
import { MyTableHooks } from './types'
import { RowDownloadButton } from './RowDownloadButton'

// Кастомный слайс hooks читаем через table.getHooks() с приведением к своему типу
export const RowDownloadComponent = memo(
  ({ row, table }: CellComponentProps) => {
    const { onDownload } = (table.getHooks() as MyTableHooks).rowDownloadAction

    return <RowDownloadButton onClick={() => onDownload(row.original.id)} />
  },
)

RowDownloadComponent.displayName = 'RowDownloadComponent'
```

Подключаем плагин фабрикой и передаём колбэк в её аргументах:

```tsx
// MyTable.tsx

import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadAction } from './rowDownloadActionPlugin'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
    },
    handlers: {
      onRowSelectionChange,
    },
    plugins: [
      rowSelection({
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

> ⚠️ Обратите внимание, что `Tessera` уже экспортирует готовые фасады кнопок действий для таблицы, а также функции и классы для их стилизации.
>
> Для этого используйте импорты `@mstrvtt/tessera/ui` или `@mstrvtt/tessera/styles`.

Поздравляю! Теперь мы можем реагировать на нажатии кнопки в каждой строке!

<a name="custom_plugin_example_2" id="custom_plugin_example_2"></a>

#### Гайд 2. Кнопка "скрыть значение" в ячейках

`Tessera` позволяет использовать как базовые состояния таблицы, так и расширять их список специфичными состояниями для разных бизнес-кейсов.

Давайте создадим состояние, которое будет хранить `id` скрытых ячеек. Опишем его типы в `types.ts`:

```ts
// types.ts (добавляем к предыдущим типам)

import type { OnChangeFn } from '@tanstack/react-table'

// Кастомное состояние таблицы
export interface MyTableState {
  hiddenCells: Record<string, boolean>
}

// Кастомные хендлеры состояния
export interface MyTableOptions {
  onChangeHiddenCells: OnChangeFn<MyTableState['hiddenCells']>
}
```

Заведём состояние и передадим его в таблицу:

```tsx
// MyTable.tsx

import { useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { MyTableState } from './types'
import { rowDownloadAction } from './rowDownloadActionPlugin'

const hiddenCellsInitialState: MyTableState['hiddenCells'] = {}

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
      // Добавим состояние
      hiddenCells,
    },
    handlers: {
      onRowSelectionChange,
      // И хендлер
      onChangeHiddenCells: setHiddenCells,
    },
    plugins: [
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
    ],
  })

  return <DataGrid table={table} />
}
```

Теперь нам нужно создать плагин для отрисовки кнопки в ячейках.

```tsx
// cellHiddenActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { CellHiddenComponent } from './CellHiddenComponent'

export const cellHiddenActionPlugin: TablePlugin = {
  id: 'cellHiddenAction',
  slots: [
    {
      id: 'cellHiddenAction',
      slot: 'rightCellSlot',
      order: 0,
      component: CellHiddenComponent,
    },
  ],
}
```

Давайте сделаем так, чтобы новая кнопка взаимодействовала с нашим состоянием и реагировала на изменение состояния:

```tsx
// CellHiddenComponent.tsx

import { memo } from 'react'
import { useTableState, type CellComponentProps } from '@mstrvtt/tessera'
import { CellHiddenButton } from './CellHiddenButton'
import { MyTableOptions, MyTableState } from './types'

export const CellHiddenComponent = memo(
  ({ cell, table }: CellComponentProps) => {
    // Точечная подписка на СВОЙ ключ состояния: ре-рендер только при смене признака
    // именно этой ячейки (кастомные ключи читаем через приведение типа).
    const isHidden = useTableState(
      table,
      s => (s as unknown as MyTableState).hiddenCells[cell.id],
    )
    const { onChangeHiddenCells } = table.options as unknown as MyTableOptions

    return (
      <CellHiddenButton
        active={isHidden}
        onClick={() => {
          onChangeHiddenCells(prev => ({
            ...prev,
            [cell.id]: !prev[cell.id],
          }))
        }}
      />
    )
  },
)

CellHiddenComponent.displayName = 'CellHiddenComponent'
```

Подключаем плагин:

```tsx
// MyTable.tsx

import { useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { MyTableState } from './types'
import { rowDownloadAction } from './rowDownloadActionPlugin'
import { cellHiddenActionPlugin } from './cellHiddenActionPlugin'

const hiddenCellsInitialState: MyTableState['hiddenCells'] = {}

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
      hiddenCells,
    },
    handlers: {
      onRowSelectionChange,
      onChangeHiddenCells: setHiddenCells,
    },
    plugins: [
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
      cellHiddenActionPlugin,
    ],
  })

  return <DataGrid table={table} />
}
```

Чтобы ячейки реагировали на новое состояние, вынесем их содержимое в отдельный компонент
и добавим подписку на изменение признака конкретной ячейки из hiddenCells:

```tsx
// Cell.tsx

import { memo } from 'react'
import { useTableState, type CellComponentProps } from '@mstrvtt/tessera'
import { MyTableState } from './types'
import { getMeta } from './getMeta'

export const Cell = memo(({ cell, row, column, table }: CellComponentProps) => {
  const isHidden = useTableState(
    table,
    s => (s as unknown as MyTableState).hiddenCells[cell.id],
  )

  if (isHidden) {
    return 'Содержимое скрыто'
  }

  const { name } = getMeta(column.columnDef.meta)

  return String(row.original[name] ?? '')
})

Cell.displayName = 'Cell'
```

```tsx
// useColumns.tsx

...

columnHelper.accessor(row => row[field.name], {
  id: field.id,
  header: field.label,
  cell: Cell,
  meta: setMeta(field),
  size: field.width,
  enableSorting: true,
  enableResizing: true,
})
```

> ⚠️ Дополнительная типизация `createColumnHelper` не нужна — он остаётся
> `createColumnHelper<any, ItemType>()` из главы «Создание колонок». Кастомные
> состояние и хуки не проходят через дженерики хелпера: их читают в компонентах через
> `table.getState()` / `table.getHooks()` (с приведением к своим типам, как выше).

<a name="custom_plugin_example_3" id="custom_plugin_example_3"></a>

#### Гайд 3. Создать новую колонку с кастомным Switch

Представим, что мы хотим отрисовать еще одну колонку в конце таблицы с кастомным Switch-компонентом.

В v9 плагин может принести **свою колонку** сам — через поле `column` (как это делают
встроенные `rowSelection` / `rowExpanding`). Отдельно добавлять колонку в `useColumns`
не нужно.

```tsx
// switchActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { SwitchActionComponent } from './SwitchActionComponent'

export const SWITCH_ACTION_COLUMN_ID = 'switchActionColumn'

// Сервисная колонка плагина: ставится справа (side: 'trailing'), ячейки рисует
// SwitchActionComponent. make(depth) строит ColumnDef; для плоской колонки depth не нужен.
export const switchActionPlugin: TablePlugin = {
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
}
```

Компонент ячейки со Switch (подписку на скрытие значения из прошлого гайда сохраняем):

```tsx
// SwitchActionComponent.tsx

import { memo } from 'react'
import { useTableState, type CellComponentProps } from '@mstrvtt/tessera'
import { Switch } from './Switch'
import { MyTableState } from './types'

export const SwitchActionComponent = memo(
  ({ cell, table }: CellComponentProps) => {
    const isHidden = useTableState(
      table,
      s => (s as unknown as MyTableState).hiddenCells[cell.id],
    )

    if (isHidden) {
      return 'Содержимое скрыто'
    }

    return <Switch />
  },
)

SwitchActionComponent.displayName = 'SwitchActionComponent'
```

При необходимости в этот плагин можно так же добавить кастомные хуки и состояния, как мы это делали в предыдущих гайдах.

Подключим плагин:

```tsx
// MyTable.tsx

import { useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { MyTableState } from './types'
import { rowDownloadAction } from './rowDownloadActionPlugin'
import { cellHiddenActionPlugin } from './cellHiddenActionPlugin'
import { switchActionPlugin } from './switchActionPlugin'

const hiddenCellsInitialState: MyTableState['hiddenCells'] = {}

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const table = useCreateTable({
    columns,
    data,
    state: {
      rowSelection: rowSelectionState,
      hiddenCells,
    },
    handlers: {
      onRowSelectionChange,
      onChangeHiddenCells: setHiddenCells,
    },
    plugins: [
      rowSelection({
        onSelectRow: (row, selected) => console.info(row.id, selected),
      }),
      rowActions({ width: 40 }),
      rowDownloadAction({
        onDownload: fileId => console.info('download', fileId),
      }),
      cellHiddenActionPlugin,
      switchActionPlugin,
    ],
  })

  return <DataGrid table={table} />
}
```

> Обратите внимание, что видимостью, закреплением и порядком колонок вы можете управлять через хуки состояний, экспортируемые из `@mstrvtt/tessera`.

Поздравляем! Теперь вы знаете как управлять состоянием таблицы, создавать плагины и взаимодействовать с ними!

<a name="best_practices" id="best_practices"></a>

### Best practices

#### Синхронная и асинхронная загрузка данных в таблице

`Tessera` предлагает два признака для отображения загрузки: `enableSkeleton` и `enableLoading`.

1. Если Вы первый раз загружаете данные для таблицы, используйте `enableSkeleton`, чтобы добиться лучшего UX во время ожидания данных.
   Вы также можете использовать параметр `skeletonOptions`, чтобы настроить количество скелетонов по обоим осям.

2. Если Вам нужно отобразить асинхронное неблокирующее обновление данных, то используйте `enableLoading` для отображения прогресс-бара под строкой заголовков таблицы.

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

### Полезные ссылки

<ul>
  <li><a href="https://tanstack.com/table">TanStack Table</a> - headless-конструктор построения таблиц</li>
  <li><a href="https://tanstack.com/virtual">TanStack Virtual</a> - виртуальный рендеринг</li>
<li><a href="https://dndkit.com/">Dnd kit</a> - перетаскивание элементов</li>
</ul>

</td></tr></tbody></table>
</center>
