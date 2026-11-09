# Upstream-основания

Tessera компонует три headless-библиотеки. Эта страница своими словами резюмирует
те части каждой из них, что важны для Tessera, и помечает точные точки расширения,
в которые Tessera врезается. За авторитетными деталями API обращайтесь к
документации каждой библиотеки.

## TanStack Table v9

TanStack Table — это **headless** ядро таблицы: оно вычисляет модели (строки,
столбцы, заголовки, футеры) из `columns` + `data` + `state` и выдаёт инстанс с
методами — само по себе оно ничего не рендерит.

Концепции, на которые опирается Tessera:

- **Instance** — создаётся через `useTable(options)`; стабильный объект, чьи методы
  (`getHeaderGroups`, `getRowModel`, …) читаются во время рендера. Состояние живёт в
  **TanStack Store**: `table.state` (снимок), `table.store` и слайс-атомы
  `table.atoms.<slice>` (см. [reactivity.md](reactivity.md)).
- **Модели мемоизированы.** Каждая модель (core row model, sorted, grouped,
  expanded, header groups) — мемоизированная функция от конкретных входов; пересчёт
  только при смене их идентичности. В v9 состояние разложено по атомам, поэтому смена
  одного среза не инвалидирует все модели — это и был мотив миграции с v8 (см.
  [reactivity.md](reactivity.md)).
- **Состояние controlled/uncontrolled по слайсам.** Вы можете передать `state.X` +
  `onXChange`, чтобы контролировать слайс, либо отдать его во владение таблице.
  Tessera формализует это в разделение core/external (см.
  [table-assembly.md](table-assembly.md)).
- **`features` (`tableFeatures({...})`).** API кастомных фич. В v9 набор фич —
  типизированная карта, собираемая `tableFeatures()` (tree-shakeable). Фича вешает
  методы на **прототипы** (`assign*Prototype`, используют `this`), кладёт мутабельные
  данные на инстанс (`init*InstanceData`), аугментирует API таблицы
  (`constructTableAPIs`) и вносит дефолтные опции/состояние. **Плагин Tessera строится
  на этом `TableFeature`**; карту фич Tessera собирает из записей presence-based
  (`buildTesseraFeatures`).
- **`meta`** — произвольный контекстный «мешок» на столбец (`column.columnDef.meta`),
  используемый потребителями для переноса метаданных поля.

Точки соприкосновения Tessera: ядровая row-модель включается автоматически (v9;
прочие row-модели приходят слотами фич), `getHeaderGroups` с флагами первой/последней
группы через `commonFeature`, карта `features` и аугментация инстанса через
`constructTableAPIs` фичи `commonFeature` (добавляет `getHooks`, `getRenderSlots`,
`setRenderSlot` и SDK-хелперы).

```mermaid
flowchart LR
    subgraph opts["опции useTable"]
        C["columns"]
        D["data"]
        S["state + on*Change"]
        F["features (tableFeatures({...}))"]
        M["ядровая row-модель — автоматически<br/>+ getHeaderGroups<br/>(обёрнут для флагов first/last)"]
    end
    INST["инстанс table"]
    RM["row model (мемоизирована)"]
    HG["header groups (мемоизированы)"]
    opts --> INST
    INST --> RM
    INST --> HG
```

## TanStack Virtual

TanStack Virtual — не зависимость, а изменённая копия в `src/vendor/tanstack-virtual/`
([ADR 0143](../decisions/0143-tanstack-virtual-fork.md)): исходники upstream с одним патчем —
пересчёт позиций от места изменения. Код грида импортирует его оттуда; версия, патч и
процедура обновления — в `README.md` вендора.

TanStack Virtual вычисляет, **какие элементы в scroll-контейнере видимы**, и
padding, нужный для сохранения размера прокрутки. Это измерение + математика; он
ничего не рендерит.

Концепции, на которые опирается Tessera:

- **Virtualizer** — конфигурируется через `count`, `getScrollElement`,
  `estimateSize` и (опционально) `getItemKey` / динамическое измерение. Он выдаёт
  `virtualItems` (index, start, size) и `totalSize`.
- **Range extractor** — функция, решающая, какие индексы «в диапазоне». Tessera
  кастомизирует её, чтобы всегда удерживать pinned/action-столбцы и расширять
  диапазон строк (см. `core/virtualization`).
- **Динамическое измерение строк** — строки могут измерять свою реальную высоту
  через `measureElement`, так что строки переменной высоты работают.

Как именно Tessera это использует — два виртуализатора (строки всегда, столбцы
только при плоском layout), кастомные range extractors, filler-столбцы для padding
и динамическое измерение строк — см. [virtualization.md](virtualization.md).

## dnd-kit

dnd-kit — это headless-тулкит drag-and-drop для React.

Концепции, на которые опирается Tessera:

- **`DndContext`** — предоставляет состояние перетаскивания, подключает сенсоры,
  эмитит `onDragStart/Over/End`. Tessera оборачивает head и body в
  обёртки плагинов `HeadBoundary` / `BodyBoundary` (ADR 0168).
- **`SortableContext` + `useSortable`** — упорядоченные, сортируемые списки;
  используются для переупорядочивания столбцов (header) и строк (body).
- **Sensors / collision detection / modifiers** — Tessera поставляет кастомную
  стратегию коллизий для столбцов и модификаторы для ограничения движения.
- **Drag overlay** — плавающий элемент, рендерящийся во время перетаскивания;
  Tessera рендерит для этого `OverlayHeadCell` / `OverlayBodyRow`.

## Движок строк поверх TanStack

Строки, их порядок, видимость и место строит свой движок Tessera
([ADR 0200](../decisions/0200-own-row-engine.md)): хранилище строк
([`memoryStore.ts`](../../src/lib/core/rowEngine/memoryStore.ts), словарь с версиями
[`rowDict.ts`](../../src/lib/core/rowEngine/rowDict.ts)), конвейер стадий в плагинах моделей
(фильтр и поиск → группировка → сортировка → раскрытие → страница) и источник строк. Слоты
моделей TanStack — обёртки над стадиями; `table.get*RowModel()` собирает стоковый вид лениво
([`stockView.ts`](../../src/lib/core/rowEngine/stockView.ts)). Ядро, грид и плагины читают
строки через [`rowsOf`](../../src/lib/core/rowEngine/rows.ts) (страж SD2). Серверная модель —
хранилище блоков движка; стадии на клиенте в её режиме не идут.

### На что опираемся

Опор на неописанное поведение TanStack нет (ADR 0200, EN21). Движок пользуется только
публичным API:

| API TanStack                                                                                          | Зачем                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `constructRow(table, id, original, index, depth, subRows, parentId)`                                  | строки хранилища, строки-группы, копии родителей у фильтра дерева и ответа ленивых детей |
| `copyInstancePropertiesWithoutMemos`                                                                  | копии строк стокового вида `table.get*RowModel()`                                        |
| `table.getRowId`, `options.getSubRows`                                                                | id и дети строк данных                                                                   |
| `table.autoResetPageIndex()`, `autoResetExpanded()`, `autoResetSorting()`, `autoResetCellSelection()` | автосбросы после пересчёта — микрозадачей, по правилу TanStack                           |
| `sortFns`, `filterFns`, `getGlobalFilterFn`, `column.getAggregationFns()`                             | функции стадий сортировки, фильтра, поиска и группировки                                 |
| `row.getValue`, `row.getIsExpanded`, `row.getCanExpand`                                               | значения ячеек и раскрытие                                                               |
| `table.atoms.*`                                                                                       | срезы состояния; стадии сравнивают их по значению, а не по ссылке                        |

Фасеты (`column.getFacetedRowModel`), выбор и раскрытие всего, число страниц — стоковые фичи
TanStack; они читают ленивые виды движка (ADR 0200, §6, EN7).

### При обновлении TanStack

1. Паритет: `npm run test:parity` — наборы движка против стоковых моделей. Тот же набор раз в
   неделю идёт против свежей 9.x в `prerelease.yml` (ADR 0200, EN23).
2. Перф: `npm run perf:compare -- <ref>`.

Peer — `^9` (ADR 0200, EN22): новая минорная версия TanStack не требует нашего выпуска.
Последняя сверка исходников — 9.2.4 → 9.3.1 (ADR 0200, этап 0); с этапа 5 сверять нечего.

## Обходы апстрима

Ошибки upstream, которые Tessera обходит композицией (без форка). У каждого обхода —
условие снятия: проверяйте его при обновлении зависимости.

Сейчас обходов нет. Ошибка `createSortedRowModel` в 9.2.4–9.3.1 — `rowsById` указывает на
строку вне модели, когда сортировка переставила детей, — Tessera не задевает: сортировку строит
своя стадия без копий, а стоковый вид кладёт копии и в словарь (ADR 0200, EN6; CS24
[ADR 0012](../decisions/0012-column-sorting.md)).

## Где находится Tessera

```mermaid
flowchart TB
    subgraph tessera["Tessera"]
        PL["Слой Plugin + Slot"]
        PS["Реактивность: TanStack Store (table.atoms)"]
        THEME["Темизация на CSS-переменных<br/>(Base UI + нативные контролы)"]
        UI["Пайплайн рендеринга DataGrid"]
    end
    subgraph up["Upstream (headless)"]
        TT["TanStack Table v9<br/>(модель + features)"]
        TV["TanStack Virtual<br/>(виртуализаторы строк/столбцов)"]
        DND["dnd-kit<br/>(DnD-контексты)"]
    end
    PL --> TT
    PS -.->|читает atoms/getHooks| TT
    UI --> TV
    UI --> DND
    UI --> TT
    THEME --> UI
```

Практическое правило при чтении кодовой базы: всё, что названо `assign*Prototype` /
`init*InstanceData` на фиче, `features`, `getRowModel`, `table.atoms` / `table.store` —
это **TanStack** (v9); всё, что названо `setRenderSlot`, `getRenderSlots`, `getHooks`,
`useSlice` / `useTableState`, `TesseraFeatureEntry` — это расширение **самой Tessera**.
