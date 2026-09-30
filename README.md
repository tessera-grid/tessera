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

| Фабрика                | Что делает                                   | UI                                        | Ограничения / примечания                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columnSorting()`      | Сортировка данных DESC/ASC                   | кнопка в заголовке                        | клиентская и серверная; требует `enableSorting` в колонке                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `columnSizing()`       | Ресайз колонок                               | хендлер в заголовке                       | требует `enableResizing` в колонке; с клавиатуры — фокус на хендлере, `←`/`→` (±10px, `Shift` ±50px), `Home` — сброс                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `columnPinning()`      | Закрепление колонок слева/справа             | кнопка в заголовке                        | работает и под многоуровневой шапкой (групповой пин + вынос отдельных листьев/групп)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `columnDragging()`     | Перетаскивание колонок                       | индикатор в заголовке                     | требует `enableDragging` в колонке; не работает под многоуровневой (сгруппированной) шапкой; с `keyboardNavigation` — `Alt+Shift+←/→` на заголовке                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `columnVisibility()`   | Скрытие и показ колонок                      | кнопка «Колонки» в тулбаре                | нужен `enableToolbar`; меню с поиском, деревом (группы вложенной шапки — трёхсостоянные галочки), «Показать все» и «Сбросить»; служебные колонки в меню не попадают, `enableHiding: false` и последняя видимая колонка заблокированы; с `headerActionMenu()` — «Скрыть колонку» / «Скрыть группу» в кебабе заголовка; колбэк `onToggleColumnVisibility(columnIds, visible)`; состояние — общий срез `columnVisibility` (`state` + `handlers`)                                                                                                                                                                                                                                    |
| `rowSelection()`       | Выбор строк                                  | колонка с чекбоксами                      | скрывается при активной группировке; `selectedCount: true` — счётчик выбранных строк в нижней панели (учитывает выбор на других страницах)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `rowExpanding()`       | Разворачивание/сворачивание строк            | колонка с кнопкой                         | клиентское и серверное; поддерживает иерархию (`getSubRows`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rowDragging()`        | Перетаскивание строк и групп                 | колонка с хендлером                       | поддерживает иерархию; отключается при активной группировке; с `keyboardNavigation` — `Alt+Shift+↑/↓` (среди строк того же уровня), `Alt+Shift+→/←` (в группу / из группы)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `rowGrouping()`        | Группировка данных по колонкам               | кнопка/пункт меню в заголовке             | при активной группировке отключает `rowDragging` и `rowSelection`; под вложенной шапкой несовместима с `columnDragging`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `rowActions()`         | Колонка кнопок действий над строкой          | колонка, закреплённая справа              | ширина `width` (px, по умолч. 120) и `collapsedWidth` (56) при схлопывании действий                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `headerActionMenu()`   | Схлопывает кнопки заголовка в кебаб-меню «⋯» | меню в заголовке                          | `mode`: `auto` (по порогу) / `always`; `threshold` (по умолч. 3). Своей колонки/фичи не вносит                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rowActionMenu()`      | Схлопывает действия строки в кебаб-меню «⋯»  | меню в колонке действий строки            | `mode`: `auto` / `always`; `threshold` (по умолч. 2). Работает поверх `rowActions()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `cellEditing()`        | Инлайн-редактирование значения ячейки        | кнопка в ячейке (по hover)                | кнопка в ЛЮБОЙ не-сервисной колонке; показ гейтит предикат `canEdit(ctx)`; `validate(value, ctx)` — текст ошибки блокирует коммит; редактор замещает контент ячейки (`cellSlot`), сменный через `editor`; `Enter` и потеря фокуса сохраняют через `onCellEdit({ value, original, current? })` — промис из него отделяет ячейку в ожидание (`aria-busy`), не блокируя правку других, а отказ оставляет ячейку в «ошибке» с черновиком и текстом отказа ([ADR 0041](docs/decisions/0041-async-business-callbacks.md)), `Escape` отменяет; завершение без сохранения — `onEditCancel({ reason, draft, original })`; `onConflict: 'block'` — не сохранять значение, изменённое извне |
| `cellSelection()`      | Выделение диапазона ячеек + копирование      | клик / Shift / drag / Ctrl-Cmd по ячейкам | `Ctrl/Cmd+C` копирует выделение как TSV и HTML-таблицу; сервисные колонки невыбираемы (`canSelectCell`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `contextMenu()`        | Контекстное меню по правому клику            | меню у курсора                            | пункты вносят другие плагины (напр. «Копировать» от `cellSelection`); на сервисных колонках не показывается                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pagination()`         | Пагинация строк                              | контрол в нижней панели                   | клиентская и серверная (`server` + `rowCount`; пока ответа нет — `rowCount: 0`); `initialPageSize` (начальный размер, по умолч. 25; текущим владеет срез `pagination`), `pageSizes` (10/25/50/100, `false` — без выбора); страницы по верхнему уровню — дети группы не рвутся; сортировка и группировка возвращают на первую страницу, правка и перестановка строк — нет; колбэк `onPageChange(pageIndex, pageSize)`; состояние — срез `pagination` (`state` + `handlers`)                                                                                                                                                                                                       |
| `keyboardNavigation()` | Клавиатурная навигация по ячейкам            | контур фокуса активной ячейки             | `role="grid"` (с иерархией строк — `treegrid`: `←` с первой ячейки ставит фокус на строку, на строке `→`/`←` раскрывают и сворачивают), roving `tabindex`; стрелки / Home / End / PageUp-Down, в т.ч. по заголовку и сервисным колонкам; строки групп вложенной шапки; с `cellSelection` — Shift+стрелки расширяют диапазон, Ctrl+Shift+стрелки — до края, Ctrl+A — всё; Space — выбор строки, Enter — сортировка/раскрытие/правка, F2 — правка или вход в виджеты ячейки, Escape — обратно, Tab — выход из грида, Shift+F10 — контекстное меню (ADR 0021, ADR 0031)                                                                                                             |

> ♿ **Доступность.** Грид строит валидное ARIA-дерево и доступные имена всегда
> ([ADR 0020](docs/decisions/0020-accessibility.md)), но WCAG 2.1.1 (всё, что
> доступно указателем, доступно и с клавиатуры) выполняется **только с плагином
> `keyboardNavigation()`** ([ADR 0031](docs/decisions/0031-wcag-keyboard.md)). Без
> него грид — `role="table"` для чтения: область прокрутки, футер и перестановка
> колонок/строк с клавиатуры недоступны. Изменения (сортировка, выбор, копирование,
> загрузка) объявляются скринридеру; свои сообщения — `table.announce(text)`,
> отключить объявления ядра — `useCreateTable({ enableAnnouncements: false })`
> ([ADR 0032](docs/decisions/0032-wcag-aa-remainder.md)). Всё, что делается
> перетаскиванием, доступно и кликом: ручки перестановки колонок и строк и грип
> ширины открывают меню команд, а малые контролы имеют зону нажатия 24×24
> (WCAG 2.2 AA, [ADR 0034](docs/decisions/0034-wcag-22-dragging-and-target-size.md)).
> Как управлять таблицей с клавиатуры и мышью — [гайд](docs/guides/table-controls.md).

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

> ⚠️ **Аргументы фабрик живые** — меняйте их в рендере как обычные пропсы, мемоизировать
> массив `plugins` не нужно. Исключения ([ADR 0039](docs/decisions/0039-reactive-plugin-arguments.md)):
>
> - **состав массива** фиксирован на время жизни таблицы: включайте и выключайте
>   плагин через `enabled`, а не добавлением в массив — добавленный позже плагин не
>   подключится (dev-warn), удалённый выключится как `enabled: false`;
> - **режим данных** (`server` у `columnSorting` и `pagination`) — тоже на время
>   жизни: для смены пересоздайте таблицу, например новым `key`;
> - **начальные значения** (`pagination({ initialPageSize })`) задают только старт,
>   текущим значением владеет состояние таблицы.
>
> Функции-предикаты (`canSelectCell`, `canEdit`, `enable` у `rowDragging`) тоже живые:
> новая ссылка сразу перерисовывает ячейки. Инлайн-лямбда поэтому перерисовывает видимые
> ячейки на каждый рендер компонента с `useCreateTable` — на больших таблицах
> мемоизируйте предикаты через `useCallback`. На корректность это не влияет.

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

Плагин пишется через **`definePlugin`** — декларации по именованным полям. Каррированная
форма `definePlugin<Opts>()({ … })` задаёт входной тип опций **один раз** (в дженерике), а
`o` в `options`/`hooks` выводится из него. Обязателен только `id`.

```tsx
import { definePlugin } from '@mstrvtt/tessera'

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
- **Дать клавиатурное действие ячейкам** (при плагине `keyboardNavigation`) — `keyboardActions`: `{ id, scope: 'cell' | 'header', keys: [' ', 'Enter', 'F2', 'Alt+Shift+ArrowUp'], priority?, visible?(ctx), run(ctx, event) }` (сочетания — в форме `Ctrl+Alt+Shift+Meta+key`, срабатывают только с `Alt`). Резолвер берёт применимое действие с наибольшим `priority` (по умолчанию `0`), при равенстве — первое по порядку `plugins`; вызывайте из `run` ту же функцию, что и по клику, — с теми же хуками.
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
> Хуки и state приходят пропсами через обёртки `injectCellHooks` / `injectHeaderHooks` /
> `injectCellState` / `injectCellOwner` — не читайте их кастами `table.getHooks() as …`.
> Владелец ячейки (`cellSlot`) оборачивается `injectCellOwner` и получает пропс
> `content` (тип `PluginCellOwnerProps<THooks, TState>`).

<a name="custom_plugin_example_1" id="custom_plugin_example_1"></a>

#### Гайд 1. Нарисовать кнопку "скачать файл" в каждой строке

Создаем плагин для отрисовки кнопки в строках:

```tsx
// rowDownloadAction.tsx

import { definePlugin } from '@mstrvtt/tessera'
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

import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadAction } from './rowDownloadAction'

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

Объявим колбэк в `hooks` фабрики (как встроенные плагины) и доставим его компоненту
пропсом через обёртку `injectCellHooks`:

```tsx
// rowDownloadAction.tsx

import { definePlugin, injectCellHooks } from '@mstrvtt/tessera'
import { RowDownloadComponent } from './RowDownloadComponent'
import type { RowDownloadHooks } from './types'

export interface RowDownloadOptions {
  enabled?: boolean
  onDownload?: RowDownloadHooks['onDownload']
}

// hooks эмитит слайс колбэков (undefined-ключи отбрасываются, дефолт — no-op);
// injectCellHooks подмешивает его компоненту пропсом `hooks` (scope = id плагина).
export const rowDownloadAction = definePlugin<RowDownloadOptions>()({
  id: 'rowDownloadAction',
  hooks: o => ({ onDownload: o.onDownload ?? (() => {}) }),
  slots: [
    {
      id: 'rowDownloadAction',
      slot: 'actionRowSlot',
      order: 0,
      component: injectCellHooks(RowDownloadComponent, 'rowDownloadAction'),
    },
  ],
})
```

Компонент получает колбэк **типизированным пропсом** `hooks` — без кастов
`table.getHooks() as …`:

```tsx
// RowDownloadComponent.tsx

import { memo } from 'react'
import { type PluginCellProps } from '@mstrvtt/tessera'
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

import {
  useCreateTable,
  DataGrid,
  useRowSelectionState,
} from '@mstrvtt/tessera'
import { rowSelection, rowActions } from '@mstrvtt/tessera/plugins'
import { useColumns } from './useColumns'
import { useData } from './useData'
import { useFields } from './useFields'
import { rowDownloadAction } from './rowDownloadAction'

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

> ⚠️ Обратите внимание, что `Tessera` уже экспортирует готовые фасады кнопок действий для таблицы (`CellButton`, `RowButton`) — импортируйте их из `@mstrvtt/tessera/ui`. Их вид настраивается токенами темы `--tsr-comp-action-button-*`.

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
import { rowDownloadAction } from './rowDownloadAction'

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
// cellHiddenAction.tsx

import { definePlugin } from '@mstrvtt/tessera'
import { CellHiddenComponent } from './CellHiddenComponent'

export const cellHiddenAction = definePlugin<{ enabled?: boolean }>()({
  id: 'cellHiddenAction',
  slots: [
    {
      id: 'cellHiddenAction',
      slot: 'rightCellSlot',
      order: 0,
      component: CellHiddenComponent,
    },
  ],
})
```

> Здесь `hiddenCells` — **общее (shared)** состояние: его читают и кнопка плагина, и
> контент ячейки, и потребитель контролирует его через `useCreateTable({ state, handlers })`.
> Если же состояние **приватно одному плагину** (никто снаружи его не читает), объявите
> его полем `state` в `definePlugin` — ядро само заведёт слайс, а компонент получит его
> пропсом `state: [value, setter]` (см. врезку после гайда).

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
import { rowDownloadAction } from './rowDownloadAction'
import { cellHiddenAction } from './cellHiddenAction'

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
      cellHiddenAction(),
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
> `createColumnHelper<any, ItemType>()` из главы «Создание колонок». **Общее (shared)**
> состояние читают в компонентах через `useSlice`/`useTableState` (кастомные ключи — с
> приведением к своим типам, как выше).

##### Локальное состояние плагина (`state`)

Если состояние **приватно одному плагину** (снаружи его никто не читает), не нужно
прокидывать `state`/`handlers` через `useCreateTable` — объявите поле `state` в
`definePlugin`. Ядро сгенерирует v9-фичу и заведёт слайс под ключом `plugin:<id>` (он не пересечётся со
стоковыми срезами TanStack), а
компонент получит его **пропсом** `state: [value, setter]` (без глобальной типизации и
кастов). Так, например, устроен встроенный плагин `cellEditing` (хранит, какая ячейка
редактируется):

```tsx
// myLocalPlugin.tsx
import { definePlugin, injectCellState } from '@mstrvtt/tessera'
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
      // injectCellState доставляет `state: [value, setter]` (реактивно) + hooks пропсом.
      component: injectCellState(MyCell, 'myLocalPlugin'),
    },
  ],
})
```

```tsx
// MyCell.tsx
import { type PluginCellStateProps } from '@mstrvtt/tessera'

// state — типизированная пара [значение, сеттер]; TState = MyLocalState.
export const MyCell = ({
  row,
  state: [active, setActive],
}: PluginCellStateProps<never, string | null>) => (
  <button onClick={() => setActive(active === row.id ? null : row.id)}>
    {active === row.id ? 'on' : 'off'}
  </button>
)
```

> **Общее vs локальное.** Читают несколько компонентов/потребитель снаружи → **общее**
> состояние через `useCreateTable({ state, handlers })` (как `hiddenCells` выше).
> Приватно одному плагину → поле `state` (пропс `state: [value, setter]`).

##### Замещение рендера ячейки (`cellSlot`) и свой редактор

Обычные слоты (`leftCellSlot` / `rightCellSlot`) **добавляются** рядом с собственным
рендером ячейки — не замещают его. Когда плагину нужно в какой-то момент **заменить**
контент ячейки (инлайн-редактор, свой просмотрщик), объявите слот-владельца
`slot: 'cellSlot'` и оберните компонент в `injectCellOwner`. Владелец получает
собственный рендер ячейки пропсом `content` (`PluginCellOwnerProps<THooks, TState>`) и
рантайм решает, отдать его как есть или заместить своим UI. Это **единственный** канал,
подавляющий рендер ячейки; в сервисных колонках слоты не рендерятся, поэтому владелец
там не сработает.

> ⚠️ Владение ячейкой **эксклюзивно**: держите один владелец `cellSlot` на таблицу.
> Несколько владельцев вкладываются (в покое контент проходит насквозь), но при
> одновременной активности внешний замещает контент, а внутренние не рендерятся —
> ядро на такой набор выдаёт дев-варн.

Так устроен встроенный `cellEditing`: кнопка правки живёт в `rightCellSlot` (по hover),
а редактор — во владельце `cellSlot` (замещает значение на время правки). Сам инпут —
**сменный**: передайте свой через опцию `editor` (BYO — под свою дизайн-систему), не
задан — используется встроенный:

```tsx
import { cellEditing } from '@mstrvtt/tessera'
import { MyInput } from './design-system'

cellEditing({
  // editor получает текущее значение, доступное имя поля (label — из
  // localization.editCellValue с именем колонки), коллбэки commit/cancel (инкапсулируют
  // запись в приватный слайс и вызов onCellEdit) + контекст ячейки. value — черновик
  // сессии; setDraft сообщает введённый текст: он переживает прокрутку и смену
  // страницы, а при отмене приходит в onEditCancel, а не пропадает молча.
  editor: ({ value, label, commit, cancel, setDraft }) => (
    <MyInput
      aria-label={label}
      defaultValue={value}
      onChange={setDraft}
      onEnter={commit}
      onBlur={event => commit(event.target.value)}
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
import { definePlugin, injectCellOwner } from '@mstrvtt/tessera'
import { type PluginCellOwnerProps } from '@mstrvtt/tessera'

// content — собственный рендер ячейки; показываем его или замещаем своим UI.
const MyOwner = ({
  content,
  state: [active, setActive],
  row,
}: PluginCellOwnerProps<never, string | null>) =>
  active === row.id ? <input autoFocus /> : <>{content}</>

export const myOwner = definePlugin<{ enabled?: boolean }>()({
  id: 'myOwner',
  state: (): string | null => null,
  slots: [
    {
      id: 'myOwner',
      slot: 'cellSlot',
      component: injectCellOwner(MyOwner, 'myOwner'),
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

import { definePlugin } from '@mstrvtt/tessera'
import { SwitchActionComponent } from './SwitchActionComponent'

export const SWITCH_ACTION_COLUMN_ID = 'switchActionColumn'

// Сервисная колонка плагина: ставится справа (side: 'trailing'), ячейки рисует
// SwitchActionComponent. make(depth) строит ColumnDef; для плоской колонки depth не нужен.
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
import { rowDownloadAction } from './rowDownloadAction'
import { cellHiddenAction } from './cellHiddenAction'
import { switchAction } from './switchAction'

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
      cellHiddenAction(),
      switchAction(),
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

#### Рамка и верхний тулбар

Грид всегда рисует собственную рамку со скруглением. Если у Вас уже есть своя
обёртка с рамкой, уберите нашу токеном `--tsr-comp-frame-border-width: 0`.

`enableToolbar` добавляет над таблицей тулбар для кнопок, относящихся ко всей
таблице. Тулбар не прокручивается вместе с таблицей и рисуется, даже если в нём
пока нет кнопок. Кнопки добавляют плагины через слот `toolbarSlot` и компонент
`ToolbarButton` из `@mstrvtt/tessera/ui`:

```tsx
import { ToolbarButton } from '@mstrvtt/tessera/ui'

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
import { useCreateTable, type TesseraFeatures } from '@mstrvtt/tessera'
import { columnPinning, columnSorting } from '@mstrvtt/tessera/plugins'
import type { ColumnDef } from '@tanstack/react-table'

// Держите набор плагинов вне компонента: он же задаёт тип фич
const plugins = [columnPinning(), columnSorting()] as const
type Features = TesseraFeatures<typeof plugins>

const columns: ColumnDef<Features, Person, unknown>[] = [
  { accessorKey: 'name', meta: { pinSides: 'start' } },
]
```

Аугментации `Tessera` (методы `commonFeature` вроде `column.getIsActionsColumn()`, `meta.pinSides`, срезы состояния плагинов) подключаются вместе с импортом пакета — отдельный импорт для них не нужен. API фичи виден в типах ровно тогда, когда плагин есть в `plugins`.

### Полезные ссылки

<ul>
  <li><a href="https://tanstack.com/table">TanStack Table</a> - headless-конструктор построения таблиц</li>
  <li><a href="https://tanstack.com/virtual">TanStack Virtual</a> - виртуальный рендеринг</li>
<li><a href="https://dndkit.com/">Dnd kit</a> - перетаскивание элементов</li>
</ul>

</td></tr></tbody></table>
</center>
