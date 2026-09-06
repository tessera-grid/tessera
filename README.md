<center>
<table align="center" style="max-width: 800px; margin: 8px auto"><tbody><tr><td width="800">

<a name="page-start" href="#"></a>
<center>
  <img src="docs/show-cases.png" width="600" style="border-radius: 16px;">
</center>

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
- [9. Создание своего плагина](#creation_plugin)
  - [9.1. Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке](#custom_plugin_example_1)
  - [9.2. Гайд 2. Кнопка "скрыть значение" в ячейках](#custom_plugin_example_2)
  - [9.3. Гайд 3. Создать новую колонку с кастомным чекбоксом](#custom_plugin_example_3)
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

```ts
// useColumns.tsx

import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Cell } from './Cell'
import { formatMeta } from './getMeta'
import { FieldType, ItemType } from './types'

interface UseColumnsParams {
  fields: FieldType[]
}

const columnHelper = createColumnHelper<ItemType>()

export const useColumns = ({ fields }: UseColumnsParams) => {
  return useMemo(
    () =>
      fields.map((field: FieldType) => {
        return columnHelper.accessor(row => row[field.name], {
          id: field.id,
          header: field.label,
          cell: cell => cell.getValue(),
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

import { FieldType } from './useColumns'

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
> Если Вы беспокоитесь об обновлении содержимого ячеек, то в следующих главах мы поговорим о `Pub-Sub` в `Tessera`.

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
  meta: formatMeta(field),
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

import { ItemType } from './useColumns'

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
> **Подробнее читайте здесь: https://tanstack.com/table/latest/docs/guide/data**

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
import { ItemType } from './types'

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const table = useCreateTable<ItemType>({
    columns,
    data,
  })

  return <DataGrid table={table} />
}
```

Отлично! Вы только что создали свою таблицу!

> ⚠️ Функция `useCreateTable` имеет гибкую типизацию: `useCreateTable<TData, THooks, TState, TOptions>`
>
> Что это значит и когда нужно типизировать?
>
> Данные 4 дженерика соответствуют параметрам таблицы:
>
> - `TData` - тип данных таблицы
> - `THooks` - тип **кастомных** хуков (контракты ваших собственных плагинов)
> - `TState` - тип состояния таблицы
> - `TOptions` - тип хендлеров состояния таблицы
>
> Хуки **встроенных** плагинов больше не входят в `THooks` — их тип выводится из
> переданного набора `plugins` (presence-based, ADR 0010). Есть два режима:
>
> - **Без явных дженериков** (рекомендуется): `useCreateTable({ plugins: [...], hooks })` —
>   тип `hooks` автоматически выводится из плагинов в `plugins`, а `TData`/`TState`/`TOptions`
>   — из `columns`/`data`/`state`/`handlers`.
> - **С явными дженериками** (когда нужны кастомные `TState`/`TOptions`): вывод из
>   кортежа отключается, поэтому встроенные слайсы указывают через агрегат
>   `BuiltinPluginsHooks` из `@mstrvtt/tessera/plugins`:
>   `useCreateTable<TData, BuiltinPluginsHooks & MyHooks, TState, TOptions>({ ... })`.
>
> Позже мы рассмотрим оба режима на примерах.

<a name="configure_table" id="configure_table"></a>

### Конфигурация таблицы

`Tessera` включает поведение таблицы через **композицию плагинов** (presence-based,
ADR 0010): наличие фабрики плагина в массиве `plugins` = фича включена.

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
import { ItemType } from './types'

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

Набор базовых плагинов поставляется отдельным входом `@mstrvtt/tessera/plugins`:

> `ColumnDragging` - перетаскивание колонок (отображение индикатора в заголовке)
>
> `ColumnPinning`
>
> - закрепление колонок слева (отображение кнопки в заголовке)
> - закрепление колонок справа (официальной поддержки пока нет, работает только для кнопок действий)
>
> `ColumnSizing` - ресайз колонок (отображение хендлера в заголовке)
>
> `ColumnSorting`
>
> - сортировка данных DESC/ASC (отображение кнопки в заголовке)
> - поддерживает клиентскую и серверную сортировку
>
> `RowSelection` - выбор строк (отображение колонки с чекбоксами)
>
> `RowExpanding`
>
> - разворачивание/сворачивание строк (отображение колонки с кнопкой)
> - поддерживает клиентское и серверное разворачивание строк
>
> `RowDragging`
>
> - перетаскивание групп и строк (отображение колонки с хендлером)
> - поддерживает иерархию данных
>
> `Grouping`
>
> - группировка данных по выбранным колонкам
> - не работает вместе с RowDragging
> - в режиме вложенных заголовков таблицы не работает с ColumnPinning и ColumnDragging

Каждый плагин импортируется из `@mstrvtt/tessera/plugins` и включается добавлением
его фабрики в массив `plugins` (наличие = включено, ADR 0010):

```tsx
import {
  rowSelection,
  rowExpanding,
  columnSorting,
  columnPinning,
  columnSizing,
  columnDragging,
  rowDragging,
  rowGrouping,
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

Каждый плагин предоставляет типизированный API для взаимодействия с ним и реализации специфичной бизнес-логики.

Для этого используйте функцию `useCreateHooks`:

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
import { ItemType } from './types'

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
    // Тип hooks выводится из plugins (без явных дженериков): здесь известен
    // слайс rowSelection, потому что передан плагин rowSelection().
    hooks: {
      rowSelection: {
        // Подписываемся на callbacks плагина выбора строк
        onSelectRow: (row, selected) => console.info(row.id, selected),
        onSelectAllRowsOnPage: selected => console.info('all', selected),
        // Для динамических признаков используйте state, данный пример временный
        isAllRowsSelected: false,
      },
    },
    plugins: [rowSelection()],
  })

  return <DataGrid table={table} />
}
```

Обратите внимание, что тип объекта `hooks` выводится из набора `plugins`: доступны
слайсы ровно тех плагинов, что вы передали. Если предпочитаете собирать `hooks`
отдельно, используйте `useCreateHooks` (он подкладывает always-on no-op дефолты).

> ❗ Что такое объект `hooks`?
>
> `hooks` - это API-контракт, который используется для взаимодействия с плагинами таблицы.
> Это помогает снизить связанность кода, отделяя бизнес-логику от технической реализации таблицы.

> ⚠️ Обязательно передавайте в него **мемоизированное значение**, если Вы не используйте `Pub-Sub`! Мы обязательно вернемся к нему.

<a name="reactivity" id="reactivity"></a>

### Реактивность обновления данных

Стоит рассказать о том, по какому механизму в Tessera обновляется содержимое той или иной ячейки, колонки, строки или всей таблицы в целом.

1. Первым признаком является обновление ссылок на `columns` и `data`. При их изменении `Tanstack Table` пересоздаст таблицу целиком с нуля.

2. Для гранулированного обновления конкретных ячеек, строк и заголовков `Tanstack Table` не предоставляет API. Специально для этого мы реализовали механизм `Pub-Sub` — именно он отвечает за реакцию на внешние состояния.

Далее, рассмотрим `Pub-Sub` и как с ним работать.

<a name="reactivity_methods" id="reactivity_methods"></a>

### Pub-Sub — гранулированная реактивность

`Pub-Sub` — это механизм точечного обновления содержимого ячеек, строк и заголовков в ответ на внешние состояния.

Чтобы подписать компонент таблицы на обновление внешнего/внутреннего состояния или параметра, используйте хук `useSubscribeStore`.
Таким образом Вы можете выборочно делать некоторые части таблицы интерактивными без потери производительности!

```tsx
export const PluginComponent = memo(
  ({ row, table }: CellComponentProps) => {
    useSubscribeStore(() => [
      row.getIsSelected(),
      table.getState().customState,
    ])

  ...
  })
```

Например, этот компонент плагина подписывается только на то, выбрана ли текущая строка, и на кастомное состояние таблицы, которое Вы сами можете реализовать.
Это означает, что Ваш плагин с этим содержимым обновится только в тех местах таблицы, где он рисуется, не задев остальные компоненты таблицы.

Примеры реализации плагинов и реактивных ячеек будут рассмотрены далее.

<a name="custom_plugin" id="custom_plugin"></a>

### Создание своего плагина

`Tessera` предоставляет API для создания пользовательских плагинов. Это позволит разработчикам создавать собственные поддерживаемые плагины и не дублировать бойлерплейт из таблицы в таблицу.

> Как создать свой плагин?

Для начала разберемся в том, что умеет плагин:

```tsx
const myPlugin: TablePlugin = {
  createCell: (cell, _, _, table) => void
  createColumn: (column, table) => void
  createHeader: (header, table) => void
  createRow: (row, table) => void
  createTable: (table) => void
  getDefaultOptions: (table) => table.options
  getInitialState: (initialState) => initialState
}
```

Через интерфейс плагина мы можем подписываться на жизненный цикл создания таблицы.
Это подойдет для реализации различных бизнес-кейсов, отображения произвольного контента и специфичного поведения таблицы.

> Какой метод использовать?

- Для инициализации кастомных параметров таблицы - `createTable`, `getDefaultOptions`.
- Для инициализации кастомного состояния таблицы - `getInitialState`.
- Если Вам нужно добавить кастомные методы для колонки, заголовка, строки или ячейки - используйте любой из соответствующих методов.
- Чтобы отрисовать кастомный плагин - используйте `createСell` или `createHeader` для рендера компонента в ячейке, либо `createTable` для рендера компонента в слоте.

> ⚠️ Важно!
>
> Учтите, что все методы, кроме `createRow`, `createHeader` и `createCell` вызываются только **один раз** при инициализации таблицы.
>
> Не используйте `createCell` для сложных вычислений и отрисовки плагинов, данный метод вызывается при каждом создании ячейки.

<a name="custom_plugin_example_1" id="custom_plugin_example_1"></a>

#### Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке

Создаем плагин для отрисовки кнопки в строках:

```tsx
// rowDownloadActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'

export const rowDownloadActionPlugin: TablePlugin = {
  createTable: table => {
    table.setRenderSlot({
      // id должен быть уникальным, иначе это может привести к коллизии плагинов
      id: 'rowDownloadActionPlugin',
      // Кнопка будет первой по списку (если есть другие кнопки) в конце каждой строки
      order: 0,
      slot: 'actionRowSlot',
      component: RowDownloadComponent,
    })
  },
}
```

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { RowDownloadButton } from './RowDownloadButton'
import { CellComponentProps } from '@mstrvtt/tessera'

export const RowDownloadComponent = memo((props: CellComponentProps) => {
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
import { ItemType } from './types'
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
    hooks: {
      rowSelection: {
        onSelectRow: (row, selected) => console.info(row.id, selected),
        onSelectAllRowsOnPage: selected => console.info('all', selected),
        isAllRowsSelected: false,
      },
    },
    // Встроенные плагины — фабриками; колонка действий — rowActions({ width });
    // пользовательский плагин приносит свою фичу записью реестра.
    plugins: [
      rowSelection(),
      rowActions({ width: 40 }),
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
    ],
  })

  return <DataGrid table={table} />
}
```

Отлично! Теперь, нам нужно сделать так, чтобы что-то происходило, когда мы нажимаем на эту кнопку, верно? Давайте это сделаем!

Как мы уже знаем, мы можем взаимодействовать с плагинами через объект `hooks`,
но изначально таблица ничего не знает про хук нашего плагина `rowDownloadAction`.
Кастомные хуки объявляются интерфейсом и проходят через `hooks` без явных
дженериков — они «поглощаются» выводом наравне с выведенными встроенными слайсами:

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
import { ItemType } from './types'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'

// Контракт кастомного хука нашего плагина (из types.ts)
export interface MyTableHooks {
  rowDownloadAction: { onDownload: (fileId: string) => void }
}

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
    hooks: {
      // Встроенный слайс — выведен из плагина rowSelection()
      rowSelection: {
        onSelectRow: (row, selected) => console.info(row.id, selected),
        onSelectAllRowsOnPage: selected => console.info('all', selected),
        isAllRowsSelected: false,
      },
      // Кастомный хук нашего плагина — проходит через вывод
      rowDownloadAction: {
        onDownload: (fileId: string) => console.info('download', fileId),
      },
    },
    plugins: [
      rowSelection(),
      rowActions({ width: 40 }),
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
    ],
  })

  return <DataGrid table={table} />
}
```

Обновим компонент плагина:

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { CellComponentProps } from '@mstrvtt/tessera'
import { ItemType, MyTableHooks } from './types'
import { RowDownloadButton } from './RowDownloadButton'

// Кастомный слайс hooks компонент типизирует через THooks (3-й дженерик)
export const RowDownloadComponent = memo(
  ({ row, table }: CellComponentProps<ItemType, unknown, MyTableHooks>) => {
    const { onDownload } = table.getHooks().rowDownloadAction

    return <RowDownloadButton onClick={() => onDownload(row.original.id)} />
  },
)

RowDownloadComponent.displayName = 'RowDownloadComponent'
```

И обязательно типизацию самого плагина:

```tsx
// rowDownloadActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'

// Уточняем типизацию hooks с помощью дженериков
export const rowDownloadActionPlugin: TablePlugin<ItemType, MyTableHooks> = {
  createRow: (_, table) => {
    table.setRenderSlot({
      // id должен быть уникальным, иначе это может привести к коллизии плагинов
      id: 'rowDownloadActionPlugin',
      // Кнопка будет первой по списку (если есть другие кнопки) в конце каждой строки
      order: 0,
      slot: 'actionRowSlot',
      component: RowDownloadComponent,
    })
  },
}
```

> ⚠️ Обратите внимание, что `Tessera` уже экспортирует готовые фасады кнопок действий для таблицы, а также функции и классы для их стилизации.
>
> Для этого используйте импорты `@mstrvtt/tessera/ui` или `@mstrvtt/tessera/styles`.

Поздравляю! Теперь мы можем реагировать на нажатии кнопки в каждой строке!

<a name="custom_plugin_example_2" id="custom_plugin_example_2"></a>

#### Гайд 2. Кнопка "скрыть значение" в ячейках

`Tessera` позволяет использовать как базовые состояния таблицы, так и расширять их список специфичными состояниями для разных бизнес-кейсов.

Давайте создадим состояние, которое будет хранить `id` скрытых ячеек:

```tsx
// MyTable.tsx

import { useMemo, useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
  useCreateHooks,
} from '@mstrvtt/tessera'
import type { BuiltinPluginsHooks } from '@mstrvtt/tessera/plugins'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { ItemType, MyTableHooks } from './types'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'

// Интерфейс состояния таблицы (из types.ts)
export interface MyTableState {
  hiddenCells: Record<string, boolean>
}

// Интерфейс хендлеров таблицы (из types.ts)
export interface MyTableOptions {
  onChangeHiddenCells: OnChangeFn<MyTableState['hiddenCells']>
}

const hiddenCellsInitialState = {}

export const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const hooks = useCreateHooks<BuiltinPluginsHooks & MyTableHooks>({
    rowSelection: {
      onSelectRow: (row: Row<any>, selected: boolean) =>
        console.info(row.id, selected),
      onSelectAllRowsOnPage: (selected: boolean) =>
        console.info('all', selected),
      isAllRowsSelected: false,
    },
    rowDownloadAction: {
      onDownload: (fileId: string) => console.info('download', fileId),
    },
  })

  // Уточним дженерики
  const table = useCreateTable<
    ItemType,
    BuiltinPluginsHooks & MyTableHooks,
    MyTableState,
    MyTableOptions
  >({
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
    hooks,
    plugins: [
      rowSelection(),
      rowActions({ width: 40 }),
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
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
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const cellHiddenActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {
  createTable: table => {
    table.setRenderSlot({
      id: 'cellHiddenActionPlugin',
      slot: 'rightCellSlot',
      order: 0,
      component: CellHiddenComponent,
    })
  },
}
```

Давайте сделаем так, чтобы новая кнопка взаимодействовала с нашим состоянием и реагировала на изменение состояния:

```tsx
// CellHiddenComponent.tsx

import { memo } from 'react'
import { CellComponentProps, useSubscribeStore } from '@mstrvtt/tessera'
import { CellHiddenButton } from './CellHiddenButton'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const CellHiddenComponent = memo(
  ({
    cell,
    table,
  }: CellComponentProps<
    ItemType,
    unknown,
    MyTableHooks,
    MyTableState,
    MyTableOptions
  >) => {
    // Подписываем компонент плагина обновляться только тогда, когда меняется его признак из hiddenCells
    useSubscribeStore(() => [table.getState().hiddenCells[cell.id]])

    const isHidden = table.getState().hiddenCells[cell.id]
    const { onChangeHiddenCells } = table.options

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

import { useMemo, useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
  useCreateHooks,
} from '@mstrvtt/tessera'
import type { BuiltinPluginsHooks } from '@mstrvtt/tessera/plugins'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { ItemType, MyTableHooks, MyTableState, MyTableOptions } from './types'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'
import { cellHiddenActionPlugin } from './cellHiddenActionPlugin'

const hiddenCellsInitialState = {}

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const hooks = useCreateHooks<BuiltinPluginsHooks & MyTableHooks>({
    rowSelection: {
      onSelectRow: (row: Row<any>, selected: boolean) =>
        console.info(row.id, selected),
      onSelectAllRowsOnPage: (selected: boolean) =>
        console.info('all', selected),
      isAllRowsSelected: false,
    },
    rowDownloadAction: {
      onDownload: (fileId: string) => console.info('download', fileId),
    },
  })

  const table = useCreateTable<
    ItemType,
    BuiltinPluginsHooks & MyTableHooks,
    MyTableState,
    MyTableOptions
  >({
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
    hooks,
    plugins: [
      rowSelection(),
      rowActions({ width: 40 }),
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
      { id: 'cellHiddenAction', feature: cellHiddenActionPlugin },
    ],
  })

  return <DataGrid table={table} />
}
```

Чтобы ячейки реагировали на новое состояние, вынесем их содержимое в отдельный компонент
и добавим подписку на изменение признака конкретной ячейки из hiddenCells:

```tsx
// Cell.tsx

import { type CellComponentProps, useSubscribeStore } from '@mstrvtt/tessera'
import { ItemType, MyTableHooks, MyTableState, MyTableOptions } from './types'
import { getMeta } from './getMeta'

export const Cell = memo(
  ({
    cell,
    row,
    column,
    table,
  }: CellComponentProps<
    ItemType,
    unknown,
    MyTableHooks,
    MyTableState,
    MyTableOptions
  >) => {
    useSubscribeStore(() => [table.getState().hiddenCells[cell.id]])

    if (table.getState().hiddenCells[cell.id]) {
      return 'Содержимое скрыто'
    }

    const { fieldName } = getMeta(column.columnDef.meta)

    return row.original[fieldName]
  },
)

Cell.displayName = 'Cell'
```

```tsx
// useColumns.tsx

...

columnHelper.accessor(row => row[field.name], {
  id: field.id,
  header: field.label,
  cell: Cell,
  meta: formatMeta(field),
  size: field.width,
  enableSorting: true,
  enableResizing: true,
})
```

И не забудьте обновить типизацию функции создания колонок:

```tsx
// useColumns.tsx

const columnHelper = createColumnHelper<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
>()
```

<a name="custom_plugin_example_3" id="custom_plugin_example_3"></a>

#### Гайд 3. Создать новую колонку с кастомным Switch

Представим, что мы хотим отрисовать еще одну колонку в конце таблицы с кастомным Switch-компонентом.

Для начала давайте создадим ее:

```ts
// switchActionColumn.ts

import { createColumnHelper } from '@tanstack/react-table'

import { ItemType, MyTableHooks, MyTableState, MyTableOptions } from './types'

const columnHelper = createColumnHelper<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
>()

export const SWITCH_ACTION_COLUMN_ID = 'switchActionColumn'

export const switchActionColumn = columnHelper.accessor('id', {
  id: SWITCH_ACTION_COLUMN_ID,
  minSize: 150,
  size: 150,
  header: 'Checked',
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})
```

Далее, добавим ее в массив колонок, которые будут отрисованы в таблице:

```tsx
// useColumns.tsx

import { switchActionColumn } from './switchActionColumn'

...

const useColumns = ({ fields }: UseColumnsParams) => {
  const columns = useMemo(
    () =>
      fields.map((field: FieldType) => {
        return columnHelper.accessor(row => row[field.name], {
          id: field.id,
          header: field.label,
          cell: Cell,
          meta: formatMeta(field),
          size: field.width,
          enableSorting: true,
          enableResizing: true,
        })
      }),
    [fields],
  )

  return useMemo(
    () => (columns.length > 0 ? [...columns, switchActionColumn] : []),
    [columns],
  )
}
```

Теперь, мы можем создать плагин для отрисовки и поведения чекбоксов в этой колонке:

```tsx
// switchActionPlugin.tsx

import { type TablePlugin } from '@mstrvtt/tessera'
import { SWITCH_ACTION_COLUMN_ID } from './switchActionColumn'
import { CustomCheckboxComponent } from './CustomCheckboxComponent'
import { ItemType, MyTableHooks, MyTableOptions, MyTableState } from './types'

export const switchActionPlugin: TablePlugin<
  ItemType,
  MyTableHooks,
  MyTableState,
  MyTableOptions
> = {
  createCell: (_staticCell, _staticColumn) => {
    if (_staticColumn.id !== SWITCH_ACTION_COLUMN_ID) return

    _staticCell.renderComponent = SwitchActionComponent
  },
}
```

```tsx
// SwitchActionComponent.tsx

import { memo } from 'react'
import { useSubscribeStore, CellComponentProps } from '@mstrvtt/tessera'
import { Switch } from './Switch'
import { ItemType, MyTableHooks, MyTableState } from './types'

export const SwitchActionComponent = memo(
  ({
    cell,
    table,
  }: CellComponentProps<ItemType, unknown, MyTableHooks, MyTableState>) => {
    // Не забываем про подписку скрытия значения ячеек из предыдущего плагина!
    useSubscribeStore(() => [table.getState().hiddenCells[cell.id]])

    if (table.getState().hiddenCells[cell.id]) {
      return 'Содержимое скрыто'
    }

    return <Switch />
  },
)

SwitchActionComponent.displayName = 'SwitchActionComponent'
```

Для необходимости, Вы сможете также добавить в этот плагин кастомные хуки и состояния, как мы это делали в предыдущих гайдах.

Подключим плагин:

```tsx
// MyTable.tsx

import { useMemo, useState } from 'react'
import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
  useCreateHooks,
} from '@mstrvtt/tessera'
import type { BuiltinPluginsHooks } from '@mstrvtt/tessera/plugins'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { ItemType, MyTableHooks, MyTableState, MyTableOptions } from './types'
import { rowDownloadActionPlugin } from './rowDownloadActionPlugin'
import { cellHiddenActionPlugin } from './cellHiddenActionPlugin'
import { switchActionPlugin } from './switchActionPlugin'

const hiddenCellsInitialState = {}

const Table = () => {
  const fields = useFields()
  const columns = useColumns({ fields })
  const data = useData()

  const { rowSelection: rowSelectionState, onRowSelectionChange } =
    useRowSelectionState()
  const [hiddenCells, setHiddenCells] = useState<MyTableState['hiddenCells']>(
    hiddenCellsInitialState,
  )

  const hooks = useCreateHooks<BuiltinPluginsHooks & MyTableHooks>({
    rowSelection: {
      onSelectRow: (row: Row<any>, selected: boolean) =>
        console.info(row.id, selected),
      onSelectAllRowsOnPage: (selected: boolean) =>
        console.info('all', selected),
      isAllRowsSelected: false,
    },
    rowDownloadAction: {
      onDownload: (fileId: string) => console.info('download', fileId),
    },
  })

  const table = useCreateTable<
    ItemType,
    BuiltinPluginsHooks & MyTableHooks,
    MyTableState,
    MyTableOptions
  >({
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
    hooks,
    plugins: [
      rowSelection(),
      rowActions({ width: 40 }),
      { id: 'rowDownloadAction', feature: rowDownloadActionPlugin },
      { id: 'cellHiddenAction', feature: cellHiddenActionPlugin },
      { id: 'switchAction', feature: switchActionPlugin },
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
