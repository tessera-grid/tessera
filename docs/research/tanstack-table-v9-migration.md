# RnD: миграция Tessera на TanStack Table v9

**Статус:** исследование (RnD), не решение. Питает пункт «На рассмотрении → Миграция
на TanStack Table v9» в [roadmap](../roadmap.md). Решение, если будет принято,
фиксируется отдельным ADR.
**Дата:** 2026-09-13.
**Область:** влияние v9 на ядро Tessera (`useCreateTable`, контракт плагинов,
реактивность, типы, дистрибутив) и оценка стратегий перехода.

---

## 1. Краткий вывод (TL;DR)

- **v9 стабилен** — релиз 4 августа 2026, beta 8 июня 2026. Это не альфа; мигрировать
  можно на реальную версию.
- **v9 напрямую бьёт в мотив миграции.** Ключевая боль v8 — любое изменение
  состояния/данных пересчитывает **всю** модель таблицы ([roadmap](../roadmap.md),
  [ADR 0007](../decisions/0007-reactivity-pubsub.md)). v9 переносит состояние на
  **TanStack Store** с гранулярными подписками (`table.atoms`, `table.store`,
  `table.Subscribe`) и переписанной мемоизацией row-моделей: заявлено −40…70% времени
  на sort/filter/aggregate и до −90% памяти на больших таблицах.
- **Главный архитектурный выигрыш для нас — не перф сам по себе, а возможность
  удалить собственный Pub-Sub.** Слой `subscribeStore` / `useSubscribeStore` /
  `SubscriptionStoreProvider` (ADR 0007) — это ручная реализация ровно того, что v9
  теперь даёт из коробки. Миграция позволяет upstream'нуть ADR 0007.
- **Плагинная модель концептуально выживает, но API ломается целиком.** v8-интерфейс
  `TableFeature` (`createTable/createColumn/createHeader/createRow/createCell` +
  `getInitialState/getDefaultOptions`) заменён на v9-интерфейс с `assign*Prototype`,
  `init*InstanceData`, `constructTableAPIs`, `getDefaultTableOptions`. Наша обёртка
  `TablePlugin` ([pluginContract.ts](../../src/lib/core/pluginContract.ts)) и все 9
  базовых плагинов + `commonPlugin` требуют переписывания сигнатур.
- **Самый дорогой пункт — не рантайм, а типы.** В v9 у всех публичных типов
  (`Table`, `Column`, `ColumnDef`, `Cell`, `Header`…) добавлен **ведущий** дженерик
  `TFeatures`. Наш сквозной дженерик-контракт `<TData, THooks, TState, TOptions>`
  ([table.d.ts](../../src/table.d.ts), `src/types/*`) придётся переосмыслить.
- **Дистрибутив: v9 ESM-only, target ES2022, без CJS/UMD.** Наш `dist/index.cjs` и
  `exports.require` (см. [package.json](../../package.json)) на ESM-only-зависимости
  требуют пересмотра стратегии сборки.
- **Оценка:** это **major-переписывание ядра**, а не bump зависимости. Порядок —
  недели, не дни. Рекомендация в §8.

---

## 2. Мотивация (зачем вообще)

Из [roadmap](../roadmap.md):

> Любое изменение состояния таблицы или данных пересчитывает **всю** модель таблицы —
> это архитектурный удар по производительности. Pub-Sub ([ADR 0007]) смягчает его на
> v8, но не устраняет.

То есть смысл миграции — **не «быть на свежей версии»**, а снять архитектурное
ограничение, вокруг которого Tessera построила два обходных механизма:

1. **Pub-Sub** (ADR 0007) — чтобы компонент ре-рендерился только при изменении своего
   среза состояния, а не всей таблицы.
2. **Сигнатуры структуры** в [`useCreateTable`](../../src/lib/core/createTable/useCreateTable.ts)
   (`pluginSignature`/`featureSignature`/`columnSignature`) — чтобы нестабильные по
   идентичности `plugins`/`columns` не пересобирали всю модель каждый рендер.

Оба — компенсация за то, что v9 решает на уровне ядра. Это делает миграцию
**стратегически осмысленной**, а не косметической.

---

## 3. Что такое TanStack Table v9

| Аспект | v8 (сейчас) | v9 |
|---|---|---|
| Статус | стабильно, у нас `^8.20` | **стабильно (4 авг 2026)** |
| Стейт | внутренний, `getState()`, `on*Change` | **TanStack Store** (атомы), `table.state` / `table.store` / `table.atoms.<slice>` |
| Ре-рендеры | всё или ничего (отсюда наш Pub-Sub) | **гранулярные подписки** (`table.Subscribe`, `useSelector(atom)`) |
| Фичи | все включены всегда | **opt-in, tree-shakeable** через `tableFeatures({...})` |
| Row-модели | `getSortedRowModel()` и т.п. как опции | слоты `tableFeatures({ sortedRowModel: createSortedRowModel() })`, ядровая модель автоматически |
| Хук | `useReactTable` | `useTable` |
| Методы инстансов | замыкают инстанс (можно деструктурировать) | живут на **прототипах**, используют `this` — **деструктуризация ломается** |
| Сборка | CJS + ESM + UMD | **ESM-only, ES2022** |
| Мост совместимости | — | `useLegacyTable` из `@tanstack/react-table/legacy` (deprecated) |

Новое в v9, потенциально полезное Tessera: `cellSelectionFeature` (диапазоны ячеек),
`cellSpanningFeature` (объединение ячеек), расширенные aggregation/pinning/resizing,
переписанные devtools, `createTableHook`/`tableOptions()` для фабрик таблиц.

---

## 4. Как v9 закрывает нашу мотивацию (реактивность)

Это центральный раздел — ради него всё и затевается.

**v9 из коробки:**
```tsx
// Узкий ре-рендер: компонент подписан только на свой срез
import { useSelector } from '@tanstack/react-store'
const pagination = useSelector(table.atoms.pagination) // рендер только при смене pagination

// Либо через рендер-проп с селектором
<table.Subscribe selector={s => ({ sorting: s.sorting })}>
  {({ sorting }) => /* ... */}
</table.Subscribe>
```

**Что это значит для Tessera:**

- **`src/lib/core/subscribeStore/` можно удалить целиком.** `useSubscribeStore(() => [primitives])`
  поверх `useSyncExternalStore` с join'ом примитивов — это ручная эмуляция
  `useSelector(atom)`. 48 файлов сейчас так или иначе завязаны на реактивность
  (grep по `subscribeStore|getState()|useReactTable|_features|...`).
- **[ADR 0007](../decisions/0007-reactivity-pubsub.md) фактически upstream'ится.**
  Останется описать в новом ADR, что механизм заменён на store v9, и почему.
- **«Известная проблема» из roadmap — «Pub-Sub на масштабе (fan-out не измерен на
  тысячах подписчиков)» — снимается:** масштабирование подписок становится заботой
  TanStack Store, а не нашей.
- Наши **сигнатуры структуры** в `useCreateTable` (§2) частично теряют смысл: v9 сам
  не пересобирает модель на новую идентичность опций так тотально, как v8. Часть
  мемоизации можно упростить (проверить эмпирически, не выкидывать вслепую).

> Риск: атомная модель — не «бесплатная». Нужно перепроверить, что наши компоненты
> подписываются на правильные срезы, иначе можно как выиграть, так и потерять на
> ре-рендерах. Это тема для перф-тестов (ADR 0009), которые как раз есть.

---

## 5. Матрица breaking changes → проекция на Tessera

| Изменение v9 | Что ломает у нас | Файлы / ADR | Усилие |
|---|---|---|---|
| `useReactTable` → `useTable` | augmentation `useReactTable` в типах, вызов в ядре | [table.d.ts](../../src/table.d.ts), [useCreateTable.ts](../../src/lib/core/createTable/useCreateTable.ts) | S |
| `_features: [...]` → `features: tableFeatures({...})` | вся presence-based композиция фич | `useCreateTable.ts`, [pluginContract.ts](../../src/lib/core/pluginContract.ts) | **L** |
| Row-модели в слоты `tableFeatures` | `getCoreRowModel/getGroupedRowModel/getExpandedRowModel/getSortedRowModel` в ядре | `useCreateTable.ts:243-247` | S |
| `TableFeature`: `create*` → `assign*Prototype`/`init*InstanceData`/`constructTableAPIs`/`getDefaultTableOptions` | **все 9 плагинов + `commonPlugin`** | `pluginContract.ts`, `src/lib/plugins/*`, [commonPlugin.ts](../../src/lib/core/commonPlugin.ts) | **XL** |
| Ведущий дженерик `TFeatures` во всех типах | сквозной контракт `<TData,THooks,TState,TOptions>` | [table.d.ts](../../src/table.d.ts), `src/types/*` | **XL** |
| Declaration merging: `Table_FeatureMap`/`TableState_FeatureMap`/`TableOptions_FeatureMap`/`Plugins` вместо прямого augmentation `Table`/`Column`/... | наш `declare module` целиком | `table.d.ts` | **L** |
| Методы инстансов на прототипах (нельзя деструктурировать) | места, где деструктурируем методы row/cell/column/header | аудит по `src/lib/grid/*`, компоненты плагинов | M |
| Pinning `left`/`right` → `start`/`end` | плагин пиннинга, sticky-offset, тесты | [columnPinning](../../src/lib/plugins/columnPinning/) (~264 упоминаний left/right в 57 файлах), [ADR 0011](../decisions/0011-column-pinning.md) | **L** |
| `enablePinning` → `enableColumnPinning`/`enableRowPinning` | опции пиннинга | columnPinning, `createState` | S |
| Сплит `columnSizing`/`columnResizing`; `columnSizingInfo`→`columnResizing` | плагин размеров | [columnSizing](../../src/lib/plugins/columnSizing/), [ADR 0013](../decisions/0013-column-sizing.md) | M |
| `sortingFn`→`sortFn`, `getSortingFn`→`getSortFn`, `sortingFns`→`sortFns` | плагин сортировки | [columnSorting](../../src/lib/plugins/columnSorting/), [ADR 0012](../decisions/0012-column-sorting.md) | S |
| RowSelection: shift-range по умолчанию; `getIsSomeRowsSelected` семантика | плагин выбора, кросс-плагин тесты | [rowSelection](../../src/lib/plugins/rowSelection/), [ADR 0014](../decisions/0014-row-selection.md), [cross-plugin](../decisions/0023-cross-plugin-interactions.md) | M |
| Aggregation отделена от grouping, контекстный API | плагин группировки | [rowGrouping](../decisions/0016-row-grouping.md) | M |
| Стейт: `getState()` → `table.state`/`store`/`atoms`; `onStateChange` убран | реактивность, `createState` | [subscribeStore](../../src/lib/core/subscribeStore/), [createState](../../src/lib/core/createState/) | **L** |
| `createColumnHelper<TData>` → `createColumnHelper<TFeatures,TData>` | хелперы колонок, стори, тесты | `src/types/column.ts`, stories | S |
| ESM-only, ES2022, без CJS/UMD | наш дуальный дистрибутив CJS+ESM | [package.json](../../package.json) `exports`, `main` | M |

Легенда усилия: S — часы, M — день-два, L — несколько дней, XL — недели.

---

## 6. Разбор по подсистемам

### 6.1. Ядро сборки (`useCreateTable`)

Сейчас ([useCreateTable.ts](../../src/lib/core/createTable/useCreateTable.ts)):
```tsx
const features = useMemo(() => [commonPlugin, ...featurePlugins.map(p => p.feature)], [featureSignature])
const table = useReactTable({
  getCoreRowModel: getCoreRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSortedRowModel: getSortedRowModel(),
  _features: features,
  // ...state, handlers, hooks, slots, slotActions, actionMenu, pluginOptions
})
```

В v9:
```tsx
const features = tableFeatures({
  commonFeature,           // наш бывший commonPlugin
  rowSortingFeature, rowExpandingFeature, columnGroupingFeature, /* ... */
  sortedRowModel: createSortedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  // ядровая модель — автоматически, getCoreRowModel не нужен
})
const table = useTable({ features, columns, data, /* state/options */ })
```

Тонкость: `tableFeatures({...})` — это **объект-карта**, а не массив. Наша
presence-based композиция из массива записей (`RegistryEntry[]` → `_features`)
должна собирать этот объект динамически. `tableFeatures()` валидирует зависимости
фич **на уровне типов**, что усложняет полностью динамический набор (объект
приходится собирать типобезопасно). Это ключевая точка редизайна `RegistryEntry`.

### 6.2. Плагинная модель: `TablePlugin` → v9 `TableFeature`

Наш v8-контракт ([pluginContract.ts](../../src/lib/core/pluginContract.ts)):
`createCell/createColumn/createHeader/createRow/createTable`, `getDefaultColumnDef`,
`getDefaultOptions`, `getInitialState`.

Соответствие v9:

| v8 (наш `TablePlugin`) | v9 `TableFeature` |
|---|---|
| `createTable(table)` — вешает методы на инстанс | `constructTableAPIs(table)` (через `assignTableAPIs`) |
| `createColumn(col, table)` — методы колонки | `assignColumnPrototype(proto, table)` + `initColumnInstanceData(col)` |
| `createHeader(hdr, table)` | `assignHeaderPrototype(...)` + `initHeaderInstanceData(hdr)` + `initHeaderGroupInstanceData(hg)` |
| `createRow(row, table)` | `assignRowPrototype(...)` + `initRowInstanceData(row)` |
| `createCell(cell, ...)` | `assignCellPrototype(...)` + `initCellInstanceData(cell)` |
| `getInitialState(init)` | `getInitialState(init)` — **имя совпало** |
| `getDefaultOptions(table)` | `getDefaultTableOptions(table)` |
| `getDefaultColumnDef()` | `getDefaultColumnDef()` — **имя совпало** |

**Принципиальный сдвиг:** v8 мутирует **конкретный** инстанс (метод замыкает `col`),
v9 кладёт метод на **общий прототип**, метод обращается к `this`. Плюс `init*InstanceData`
для собственных мутабельных данных на инстансе. Значит, логику плагинов надо
переписать с «замыкание над экземпляром» на «`this` + прототип».

Хорошая новость по объёму: `create*`-хуки инстансов реально используют **немногие**
плагины — сейчас это в основном `columnDragging` и `rowDragging`
(`getCanDrag`/`getDraggableIndex` и т.п.). Большинство плагинов Tessera — это
**React-компоненты в слотах, читающие состояние**, а не глубокая работа с
инстансами. Основная тяжесть create*-миграции ложится на **`commonPlugin`** (§6.3).

### 6.3. `commonPlugin` — самая тяжёлая миграция

[commonPlugin.ts](../../src/lib/core/commonPlugin.ts) — always-on baseline-фича
ядра. Она:

- **Монки-патчит `table.getHeaderGroups`** (оборачивает нативный, добавляя
  `getIsFirstGroup`/`getIsLastGroup` на группы). В v9 методы на прототипах — прямой
  перехват прототипного метода менее естественен; флаги групп переносятся на
  `initHeaderGroupInstanceData`. **Требует редизайна, а не механического переноса.**
- Вешает на таблицу `getIsAnyColumnResizing`, `setColumnAutoSizing`, `getHooks`,
  `getRenderSlots`, `getSlotActions`, `setRenderSlot` → `constructTableAPIs`.
- Вешает на колонку `getIsActionsColumn`/`getIsRowActionsColumn` → `assignColumnPrototype`.
- Вешает на header/row флаги first/last/full-height → `assign*Prototype`.
- **Кастомный механизм `render` → `columnDef.header`/`columnDef.cell`** в
  `createHeader`/`createCell` (наш `renderComponent`, см.
  [architecture/plugins-and-slots.md](../architecture/plugins-and-slots.md)). v9
  предлагает `FlexRender`/`table.FlexRender` — надо решить, оставляем ли свой
  механизм или переходим на нативный.
- Кастомные опции `hooks`/`slots`/`slotActions`/`actionMenu` живут на `table.options`
  через augmentation `TableOptionsResolved`. В v9 они объявляются через
  `TableOptions_FeatureMap` + `getDefaultTableOptions`; чтение `table.options.hooks`
  остаётся рабочим.

### 6.4. Типы и дженерики — вероятно, самый дорогой пункт

В v9 **все** публичные типы получили **ведущий** параметр `TFeatures`:
```ts
// v8:  Table<TData>            Column<TData>            ColumnDef<TData>
// v9:  Table<TFeatures,TData>  Column<TFeatures,TData,TValue>  ColumnDef<TFeatures,TData,TValue>
```

У Tessera свой сквозной контракт `<TData, THooks, TState, TOptions>`, протянутый
через [table.d.ts](../../src/table.d.ts) и весь `src/types/*` (`TableSDK`,
`ColumnSDK`, `CellSDK`, `HeaderSDK`, `ColumnHelperSDK`, …). Совмещение нашего
контракта с v9-порядком дженериков — это **сплошная переработка типового слоя**, а
не точечные правки. `InferPluginHooks`/`RegistryEntry<THooksSlice>` тоже завязаны на
текущую форму дженериков.

### 6.5. Declaration merging (`table.d.ts`)

v8: мы напрямую расширяем интерфейсы (`interface Table extends TableSDK`,
`interface Column extends ColumnSDK`, …).

v9: augmentation идёт через **feature-карты** —
`interface Plugins { commonFeature: TableFeature }`,
`interface TableState_FeatureMap { ... }`,
`interface TableOptions_FeatureMap<TFeatures,TData> { ... }`,
`interface Table_FeatureMap<TFeatures,TData> { ... }`. Наш `ColumnMeta.pinSides`
([table.d.ts:65](../../src/table.d.ts)) сохраняется, но с добавленным `TFeatures`.
Функциональные реестры (filter/sort/aggregation) в v9 больше **не требуют**
`declare module` — регистрируются в слотах фич.

### 6.6. Постолбцовые фичи

- **Pinning** ([ADR 0011](../decisions/0011-column-pinning.md)): `left/right` →
  `start/end` по всему коду и тестам (~264 упоминания в 57 файлах — но значительная
  часть это CSS/несвязанные `.left/.right`, нужен точечный аудит). Наш реактивный
  sticky-offset через `calc()` и `enableLeafPinning` придётся выверить под новые
  имена и, возможно, под расширенный pinning v9.
- **Sizing/Resizing** ([ADR 0013](../decisions/0013-column-sizing.md)): сплит на две
  фичи; `columnSizingInfo`→`columnResizing`, `onColumnSizingInfoChange`→
  `onColumnResizingChange`. Наш `onColumnAutoSizingChange` — generic-writer ядра, его
  переносим как есть.
- **Sorting** ([ADR 0012](../decisions/0012-column-sorting.md)): переименования
  `sortingFn`→`sortFn`. Мульти-сорт (CS16–CS23) — наш UI поверх, ломается меньше.
- **RowSelection** ([ADR 0014](../decisions/0014-row-selection.md)): shift-range
  теперь дефолт (можно вернуть `enableRowRangeSelection: false`), изменилась
  семантика `getIsSomeRowsSelected`. Затрагивает кросс-плагин тесты X1/X4/X6
  ([ADR 0023](../decisions/0023-cross-plugin-interactions.md)).
- **Grouping** ([ADR 0016](../decisions/0016-row-grouping.md)): aggregation отделена;
  оба фичефлага объявляются явно. Наш контракт «активная группировка гасит
  drag/selection» (B2/B5, [ADR 0022](../decisions/0022-plugin-compatibility-contract.md))
  переносится на уровне нашей логики, не ломается семантикой v9.

### 6.7. Дистрибуция и сборка

v9 — **ESM-only, target ES2022, без CJS/UMD, без sourcemaps в пакете.**
Наш [package.json](../../package.json) отдаёт дуальный дистрибутив: `main:
dist/index.cjs`, `exports["."].require`. Если наш CJS-бандл во время исполнения
`require('@tanstack/react-table')`, а тот ESM-only — это сломается у CJS-потребителей.
Варианты: (а) отказаться от CJS-выхода (ESM-only, как v9); (б) держать `@tanstack/react-table`
строго peer-зависимостью и не тянуть его в CJS-путь. Требует решения по политике
дистрибуции. React 18/19 совместимость с v9 сохраняется.

### 6.8. Что миграция НЕ трогает

- **TanStack Virtual** ([ADR 0005](../decisions/0005-virtualization-tanstack-virtual.md)) —
  отдельный пакет, версия v9 таблицы на него не влияет.
- **dnd-kit** ([ADR 0006](../decisions/0006-dnd-with-dnd-kit.md)) — независим (его
  апгрейд — отдельный пункт roadmap).
- **Тема/CSS-переменные** ([ADR 0018](../decisions/0018-external-theming.md),
  [0019](../decisions/0019-token-architecture.md)), **UI-примитивы Base UI**
  ([ADR 0017](../decisions/0017-ui-components.md)), **иконки**, **a11y/клавиатура**
  ([ADR 0020](../decisions/0020-accessibility.md)/[0021](../decisions/0021-keyboard-navigation.md)) —
  наш слой поверх таблицы, от версии ядра не зависят напрямую.

---

## 7. Стратегии перехода

### A. Big-bang (полное переписывание ядра под нативный v9)
- **Плюс:** сразу получаем весь выигрыш (store, tree-shaking, перф), чистый код без
  легаси.
- **Минус:** большой неделимый PR; долго держать ветку зелёной; риск регрессий по
  всем ADR-контрактам одновременно.

### B. Мост `useLegacyTable` (инкрементально)
- `@tanstack/react-table/legacy` принимает **v8-образный API поверх v9-внутренностей**.
- **Плюс:** можно получить v9-ядро (в т.ч. store-перф) при минимальных правках вызова.
- **Минусы:** (1) **deprecated** с самого начала — тупик, не цель; (2) тянет **все
  фичи** (нет tree-shaking, бандл больше v8); (3) **неясно**, поддерживает ли мост
  наши **кастомные** v8-`TableFeature` (create*-хуки) — вероятно, нет, а именно они у
  нас основное. → Ценность моста для Tessera под вопросом; пригоден максимум как
  временный шаг для core-вызова, не для плагинов.

### C. Гибрид (рекомендуемый вектор исследования)
Разнести миграцию на срезы, защищённые тестами (ADR 0009 + safety-net
[ADR 0010](../decisions/0010-invert-core-plugins-registry.md)):
1. **Стейт/реактивность:** заменить наш Pub-Sub на store v9 — самый ценный и
   относительно изолированный срез.
2. **Ядро сборки:** `useTable` + `tableFeatures` + row-модели в слотах.
3. **`commonPlugin` → `commonFeature`** (базовый прототип-слой).
4. **Плагины по одному**, каждый со своими визуальными/перф/юнит-тестами (ADR 0009),
   держа parity-тесты зелёными.
5. **Типовой слой** — сквозной `TFeatures` (можно вести параллельно, финализировать в
   конце).
6. **Дистрибутив** — решение по CJS/ESM.

Проблема гибрида: v9 меняет сигнатуру фич и порядок дженериков **фундаментально**, так
что «половина на v8, половина на v9» внутри одной таблицы едва ли собирается. Скорее
это **последовательность срезов на отдельной ветке**, чем сосуществование в проде.

---

## 8. Рекомендация

1. **Миграция оправдана стратегически** — v9 закрывает именно тот архитектурный мотив,
   ради которого пункт стоит в roadmap, и позволяет **удалить собственный Pub-Sub** и
   часть мемоизационных костылей. Это не косметика.
2. **Масштаб — major-переписывание ядра** (недели). Основная тяжесть — не рантайм
   плагинов (их create*-логика скромная), а **типовой слой** (сквозной `TFeatures`) и
   **`commonPlugin`** + переизобретение presence-based композиции под `tableFeatures()`.
3. **Мост `useLegacyTable` как цель не годится** (deprecated + без tree-shaking +
   сомнителен для наших кастомных фич). Максимум — разовый разведочный прототип.
4. **Предлагаемый следующий шаг — не сразу код, а спайк:**
   - собрать **минимальный прототип** ветки: `useTable` + `tableFeatures` с `commonFeature`
     и **одним** простым плагином (напр. `columnSorting`), реактивность на `table.atoms`;
   - на нём **измерить** перф на текущих perf-стори (ADR 0009) против v8-базлайна и
     проверить, что сквозной `TFeatures` уживается с нашим `<TData,THooks,TState,TOptions>`;
   - по итогам спайка — **ADR-решение** (мигрируем/откладываем) с реальными цифрами, а
     не гипотезой −40…70%.
5. Держать [roadmap](../roadmap.md) синхронным: сейчас пункт «На рассмотрении» — этот
   RnD его питает, но статус не меняет до спайка/ADR.

---

## 9. Риски и открытые вопросы

- **Гранулярные подписки — палка о двух концах.** Выигрыш не автоматический: нужно,
  чтобы компоненты подписывались на верные срезы. Проверять perf-тестами.
- **`tableFeatures()` типобезопасен и валидирует зависимости фич** — полностью
  динамическая сборка объекта фич из массива `RegistryEntry` может упереться в типы.
  Открытый вопрос: как сохранить наш presence-based DX (`plugins={[...]}`) поверх
  статически-типизированной карты фич v9.
- **`keepFeatureWhenDisabled`** (наш обход того, что v8 фиксирует `_features` на
  маунте): нужно перепроверить, как v9 относится к рантайм-тумблингу фич — возможно,
  костыль больше не нужен, возможно, нужен другой.
- **Кастомный `render`→`columnDef`** vs нативный `FlexRender`: решить, мигрируем ли на
  нативный механизм рендера (упрощение) или сохраняем свой (совместимость API).
- **CJS-дистрибутив:** отказ от CJS — потенциально ломающее изменение для потребителей;
  требует явного решения и, возможно, мажорного релиза Tessera.
- **Проверить всё против первоисточников на момент старта работ** — данные ниже
  собраны на 2026-09-13; API v9 могли уточниться в минорных релизах.

---

## 10. Источники

- [Announcing TanStack Table V9 — TanStack Blog](https://tanstack.com/blog/announcing-tanstack-table-v9)
- [TanStack Table V9: Taking Form — TanStack Blog](https://tanstack.com/blog/tanstack-table-v9-taking-form)
- [Migrating to TanStack Table V9 (React) — TanStack Docs](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)
- [TanStack Table V9 Beta — InfoQ (июль 2026)](https://www.infoq.com/news/2026/07/tanstack-table-v9-beta/)
- Репозиторий [TanStack/table](https://github.com/TanStack/table) — `TableFeature` v9, custom-features skill (через DeepWiki).
- Внутренние: [roadmap](../roadmap.md), [ADR 0004](../decisions/0004-core-on-tanstack-table.md),
  [ADR 0007](../decisions/0007-reactivity-pubsub.md),
  [ADR 0010](../decisions/0010-invert-core-plugins-registry.md),
  [architecture/upstream-foundations.md](../architecture/upstream-foundations.md).
