# Плагины и слоты

**Плагин** Tessera — это TanStack `TableFeature` (`TablePlugin`; контракт
принадлежит ядру — `src/lib/core/pluginContract.ts`, `plugins/types.ts` его
реэкспортит, ADR 0010) плюс конвенция рендеринга, построенная на **слотах** и
переопределениях `renderComponent` на уровне ячейки/заголовка. Потребителю плагин
доставляется фабрикой-записью `RegistryEntry` (presence-based композиция): фича
остаётся плоским `TablePlugin`, а привязка сервисной колонки, тонкие опции и
hook-слайс живут в записи.

## Жизненный цикл `TablePlugin`

```ts
interface TablePlugin<TData, THooks, TState, TOptions, TValue> {
  // однократно, при конструировании инстанса
  createTable?(table): void
  getDefaultColumnDef?(): Partial<ColumnDef>
  getDefaultOptions?(table): Partial<TableOptionsResolved> & TOptions
  getInitialState?(initialState?): InitialTableState & TState

  // на каждый инстанс каждого объекта модели
  createColumn?(column, table): void
  createHeader?(header, table): void
  createRow?(row, table): void
  createCell?(cell, column, row, table): void
}
```

```mermaid
flowchart TB
    subgraph once["Однократно на инстанс таблицы"]
        GIS["getInitialState → засев кастомного TState"]
        GDO["getDefaultOptions / getDefaultColumnDef"]
        CT["createTable → аугментация инстанса,<br/>регистрация слотов"]
    end
    subgraph per["(Пере)создание объекта модели"]
        CCOL["createColumn"]
        CH["createHeader"]
        CR["createRow"]
        CC["createCell"]
    end
    once --> per
```

> **Модель стоимости.** `createTable` / `getDefaultOptions` / `getInitialState`
> выполняются **однократно**. `createColumn/Header/Row/Cell` выполняются при каждом
> (пере)создании этого объекта — держите их дешёвыми. Не делайте тяжёлой работы или
> решений о рендеринге в `createCell`.

### `commonPlugin` — bootstrap-фича

`commonPlugin` выполняется первым и в `createTable` устанавливает расширения, от
которых зависят каждый другой плагин и UI:

- `table.getHooks()` → `table.options.hooks`
- `table.getRenderSlots()` → `table.options.slots`
- `table.setRenderSlot(params)` → `registerSlot({ ...params, table })`
- плюс хелперы: `getHeaderGroups` (обёрнут флагами первой/последней группы),
  `getIsAnyColumnResizing` и хелперы на строку/заголовок/ячейку через остальные
  `create*`-хуки.

## Слоты

**Слот** — это именованная точка вставки, рендерящаяся вокруг содержимого
ячейки/заголовка. «Корзины» (`useCreateSlots`):

`leftHeaderSlot`, `rightHeaderSlot`, `leftCellSlot`, `rightCellSlot`,
`actionRowSlot`.

Плагины регистрируются в слотах в своём хуке **`createTable`** (это переехало из
`createHeader`/`createRow` — регистрация это забота уровня «однократно на таблицу»):

```ts
createTable: table => {
  table.setRenderSlot({
    id: 'columnPinningPlugin', // уникальный id — ключ дедупликации
    slot: 'rightHeaderSlot',
    order: 0, // число = индекс splice, 'last'/undefined = push
    component: PinButton, // либо `render: (ctx) => ReactNode`
  })
}
```

`registerSlot` (`core/createSlots/registerSlot.ts`) **дедуплицирует по `id`**: если
id уже существует в слоте, он обновляет `visible/render/component` на месте, иначе
вставляет (по `order`) или пушит. Так что повторная регистрация безопасна и
идемпотентна.

```mermaid
flowchart LR
    subgraph reg["регистрация (createTable, однократно)"]
        P1["pinning → rightHeaderSlot"]
        P2["sizing → rightHeaderSlot"]
        P3["sorting → leftHeaderSlot"]
        P4["dragging → leftHeaderSlot"]
        P5["grouping → rightHeaderSlot"]
        CUST["кастомный плагин → любой слот"]
    end
    STORE["table.options.slots<br/>(registerSlot дедуплицирует по id)"]
    reg --> STORE
    STORE --> RS["RenderSlot маппит slot[] → компоненты<br/>внутри ячеек Head / Body"]
```

При рендере `HeadCell` / `BodyCell` вытягивают релевантный массив слота из
`table.getRenderSlots()` и передают его в `RenderSlot`, который рендерит каждый
зарегистрированный `component`/`render` с контекстом ячейки/заголовка.

## Переопределения `renderComponent`

Помимо слотов, плагин может заменить всё содержимое конкретной ячейки или
заголовка, задав `renderComponent` в `createCell` / `createHeader`:

```ts
createCell: cell => {
  if (cell.column.id !== COLUMN_SELECTION_ID) return
  cell.renderComponent = RowSelectionComponent
}
```

`BodyCell` предпочитает `cell.renderComponent`, когда он присутствует. Именно так
встроенные сервисные столбцы (чекбокс выбора, expander) инъектируют свой UI и так
`switchActionPlugin` из Guide подменяет рендерер ячейки столбца.

## Руководство для авторов

- **Рендерить кнопку в каждой строке/ячейке/заголовке** → зарегистрируйте слот в
  `createTable`.
- **Владеть ячейкой/заголовком всего столбца** → задайте `renderComponent` в
  `createCell`/`createHeader`, защитив по id столбца.
- **Добавить кастомное состояние таблицы** → `getInitialState` + типизация через
  `TState`.
- **Добавить кастомные методы/опции** → `createTable` / `getDefaultOptions` +
  типизация через `TOptions`.
- **Реагировать на внешние значения внутри компонента плагина** → читайте
  `table.getState()` и подписывайтесь через `useSubscribeStore`
  ([reactivity.md](reactivity.md)); вызывайте бизнес-функции через
  `table.getHooks()`.
