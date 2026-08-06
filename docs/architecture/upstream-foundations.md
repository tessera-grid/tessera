# Upstream-основания

Tessera компонует три headless-библиотеки. Эта страница своими словами резюмирует
те части каждой из них, что важны для Tessera, и помечает точные точки расширения,
в которые Tessera врезается. За авторитетными деталями API обращайтесь к
документации каждой библиотеки.

## TanStack Table v8

TanStack Table — это **headless** ядро таблицы: оно вычисляет модели (строки,
столбцы, заголовки, футеры) из `columns` + `data` + `state` и выдаёт инстанс с
методами — само по себе оно ничего не рендерит.

Концепции, на которые опирается Tessera:

- **Instance** — создаётся через `useReactTable(options)`; стабильный объект, чьи
  методы (`getHeaderGroups`, `getRowModel`, `getState`, …) читаются во время
  рендера.
- **Модели мемоизированы.** Каждая модель (core row model, sorted, grouped,
  expanded, header groups) — это мемоизированная функция, ключами которой служат
  конкретные входы. Пересчёт происходит только когда эти входы меняют
  идентичность. Tessera **заменяет** функцию core row model, чтобы расширить эти
  ключи (см. [reactivity.md](reactivity.md)).
- **Состояние controlled/uncontrolled по слайсам.** Вы можете передать `state.X` +
  `onXChange`, чтобы контролировать слайс, либо отдать его во владение таблице.
  Tessera формализует это в разделение core/external (см.
  [table-assembly.md](table-assembly.md)).
- **`_features` (TableFeature[]).** API кастомных фич. Каждая фича может
  подцепиться к жизненному циклу инстанса и каждого column/row/header/cell и может
  вносить дефолтные опции и начальное состояние. **`TablePlugin` в Tessera — это в
  точности `TableFeature`** с небольшим количеством добавленной конвенции.
- **`meta`** — произвольный контекстный «мешок» на столбец (`column.columnDef.meta`),
  используемый потребителями для переноса метаданных поля.

Точки соприкосновения Tessera: нативный `getCoreRowModel`, нативный
`getHeaderGroups` (обёрнутый `commonPlugin` для флагов первой/последней группы),
список `_features` и аугментация инстанса через `createTable` фичи (добавляет
`getHooks`, `getRenderSlots`, `setRenderSlot` и SDK-хелперы).

```mermaid
flowchart LR
    subgraph opts["опции useReactTable"]
        C["columns"]
        D["data"]
        S["state + on*Change"]
        F["_features (TablePlugin[])"]
        M["нативный getCoreRowModel<br/>+ нативный getHeaderGroups<br/>(обёрнут для флагов first/last)"]
    end
    INST["инстанс table"]
    RM["row model (мемоизирована)"]
    HG["header groups (мемоизированы)"]
    opts --> INST
    INST --> RM
    INST --> HG
```

## TanStack Virtual

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
  `DndHeadWrapper` / `DndBodyWrapper`.
- **`SortableContext` + `useSortable`** — упорядоченные, сортируемые списки;
  используются для переупорядочивания столбцов (header) и строк (body).
- **Sensors / collision detection / modifiers** — Tessera поставляет кастомную
  стратегию коллизий для столбцов и модификаторы для ограничения движения.
- **Drag overlay** — плавающий элемент, рендерящийся во время перетаскивания;
  Tessera рендерит для этого `OverlayHeadCell` / `OverlayBodyRow`.

## Где находится Tessera

```mermaid
flowchart TB
    subgraph tessera["Tessera"]
        PL["Слой Plugin + Slot"]
        PS["Реактивность Pub-Sub"]
        THEME["Темизация на CSS-переменных<br/>(Base UI + нативные контролы)"]
        UI["Пайплайн рендеринга DataGrid"]
    end
    subgraph up["Upstream (headless)"]
        TT["TanStack Table<br/>(модель + _features)"]
        TV["TanStack Virtual<br/>(виртуализаторы строк/столбцов)"]
        DND["dnd-kit<br/>(DnD-контексты)"]
    end
    PL --> TT
    PS -.->|читает getState/getHooks| TT
    UI --> TV
    UI --> DND
    UI --> TT
    THEME --> UI
```

Практическое правило при чтении кодовой базы: всё, что названо `create*` на
плагине, `_features`, `getRowModel`, `getState` — это **TanStack**; всё, что
названо `setRenderSlot`, `getRenderSlots`, `getHooks`, `useSubscribeStore`,
`renderComponent` — это расширение **самой Tessera**.
