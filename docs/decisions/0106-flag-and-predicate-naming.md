# 0106 — Правило имён флагов, состояния и предикатов

- **Статус:** Принято (решения — по итогам прожарки 2026-10-13)
- **Дата:** 2026-10-13
- **Изменяет:**
  - [ADR 0060](0060-initial-loading-skeleton.md) — скелет первой загрузки включает
    `loading: 'initial'` вместо `enableSkeleton`.
  - [ADR 0094](0094-loading-glow.md) — свечение обновления включает `loading: 'refresh'`
    вместо `enableLoading`; тайминги — `refreshOptions` (тип `RefreshOptions`) вместо
    `loadingOptions` (`LoadingOptions`).
  - [ADR 0028](0028-define-plugin-authoring-api.md), [ADR 0040](0040-action-sessions.md) —
    предикат `cellEditing` называется `canEditCell` вместо `canEdit`.
  - [ADR 0039](0039-reactive-plugin-arguments.md) — аргумент `rowDragging` `enable` заменён
    предикатом `canDragRow`; булева форма снята, вкл/выкл — `enabled`. RX23 проверяет
    `canDragRow`.
- **Связано:** [ADR 0010](0010-invert-core-plugins-registry.md) — плагины по наличию,
  [ADR 0046](0046-toolbar-and-status-bar-visibility.md) — `enableToolbar`/`enableStatusBar`,
  [ADR 0096](0096-load-error.md) — `loadError`/`onRetry`,
  [ADR 0029](0029-cell-range-selection.md) — `canSelectCell`.

## Контекст

Имена флагов публичного API сложились по ходу работы и разошлись:

- **Состояние под видом возможности.** `enableSkeleton` и `enableLoading` — не «включить
  умение», а «данные грузятся сейчас»: README советует `enableSkeleton: isLoading`. Рядом
  уже есть `loadError` и `onRetry` — состояние загрузки названо по-разному. Оба флага сразу
  — противоречивое сочетание, которое ядро разрешает правилом «скелет главнее».
- **Предикаты «можно ли»** — три вида: `canEdit` (`cellEditing`), `canSelectCell`
  (`cellSelection`), `enable` (`rowDragging`). У `rowDragging` вдобавок и `enabled`, и
  `enable` — два почти одинаковых ключа с разным смыслом.
- **Тумблеры историй** названы не по фабрикам: `enableGrouping` у `rowGrouping`,
  `enableExport` у `dataExport`, `enableColumnResizing` у `columnSizing`; подопции то
  плоские с разными приставками (`showSelectedCount`, `rowDraggingEnable`,
  `serverColumnSorting`, `rangeSelection`), то объектом `xOptions`.

Остальное уже единообразно: возможности ядра — `enableX`, вкл/выкл плагина — `enabled`
(ADR 0039), подвозможности плагина — существительные (`multiSort`,
`subRows`, `server`), флаги `columnDef` — по образцу TanStack (`enableDragging` рядом с
`enableSorting`, `enableResizing`).

### Как это сделано у других

- **TanStack Table и Mantine React Table** — возможности `enableX` (таблица и колонка),
  предикат — та же опция функцией (`enableRowSelection: row => …`). MRT держит загрузку
  в состоянии: `state: { isLoading, showSkeletons, showProgressBars }`.
- **AG Grid** — возможности колонки прилагательными (`sortable`, `editable`), `editable` и
  `rowDrag` — булево или функция; отключение — `suppressX`; загрузка — проп `loading`.
- **MUI X** — отключение `disableX`/`hideX`, предикаты `isCellEditable`/`isRowSelectable`,
  загрузка — `loading` и вариант оверлея (`skeleton` или полоса).

## Решение

### 1. Правило

| Что                        | Правило                                   | Примеры                                                                                            |
| -------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Возможность ядра           | `enable<Возможность>`, булево             | `enableFooter`, `enableToolbar`, `enableStatusBar`, `enableAnnouncements`, `enableOverflowTooltip` |
| Состояние ядра             | существительное без `enable`              | `loading`, `loadError`                                                                             |
| Положение элемента ядра    | `<элемент>Position`, перечисление         | `footerPosition` (ADR 0118)                                                                        |
| Вкл/выкл плагина           | только `enabled` в аргументах фабрики     | `rowSelection({ enabled })`                                                                        |
| Подвозможность плагина     | существительное без приставки             | `multiSort`, `subRows`, `server`, `selectedCount`                                                  |
| Предикат разрешения        | `can<Глагол><Объект>`, функция            | `canEditCell`, `canSelectCell`, `canDragRow`                                                       |
| Предикат о данных          | вне правила — описывает данные, не доступ | `hasChildren`, `hasMore`, `isAllRowsSelected`                                                      |
| Флаг `columnDef`           | как в TanStack                            | `enableSorting`, `enableResizing`, `enableDragging`                                                |
| Тумблер плагина в историях | `enable<Фабрика>`                         | `enableRowGrouping`, `enableDataExport`, `enableColumnSizing`                                      |
| Подопция в историях        | `<фабрика><Опция>`                        | `rowExpandingTreeLines`, `rowSelectionSelectedCount`, `columnSortingServer`                        |
| Опция ядра в историях      | как в API                                 | `loading`, `enableFooter`                                                                          |

Внутренние опции таблицы, которые плагины выставляют для TanStack
(`enableColumnResizing`, `enableCellSelectionDrag` и т. п.), и все имена TanStack правило не
трогает: это не публичный ввод, а апстрим не форкается (ADR 0003).

### 2. Загрузка — одно состояние

```ts
useCreateTable({
  loading?: 'initial' | 'refresh' | false, // по умолчанию false
  refreshOptions?: RefreshOptions,          // { delayMs, minDurationMs } — бывшие loadingOptions
  skeletonOptions?: SkeletonOptions,        // вид скелета — без изменений
})
```

- `'initial'` — скелет первой загрузки (ADR 0060), `'refresh'` — свечение обновления
  (ADR 0094). Поведение каждого режима не меняется.
- `true` не принимается: строгий набор значений проще проверять, TypeScript подсказывает
  нужное.
- Рецепт с TanStack Query:
  `loading: isLoading ? 'initial' : isFetching ? 'refresh' : false`.
- Внутренняя опция таблицы — `table.options.loading`; кто читал `enableSkeleton`
  (пагинатор, счётчик выбранного, ошибка загрузки), читает `loading === 'initial'`.

### 3. Переименования

| Было                                   | Стало                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| `enableSkeleton: true`                 | `loading: 'initial'`                                                |
| `enableLoading: true`                  | `loading: 'refresh'`                                                |
| `loadingOptions`, тип `LoadingOptions` | `refreshOptions`, тип `RefreshOptions`                              |
| `cellEditing({ canEdit })`             | `cellEditing({ canEditCell })`                                      |
| `rowDragging({ enable })`              | `rowDragging({ canDragRow })` — функция; `false` → `enabled: false` |

Синонимов на переходный период нет: пакет не опубликован (0.0.x); изменения — в
`CHANGELOG.md` как ломающие.

### 4. Истории

Тумблеры и подопции историй переименовываются по правилу §1. Объекты-аргументы
(`exportOptions`, `columnFilteringOptions` и т. п.) раскладываются на плоские подопции —
каждая опция фабрики остаётся отдельным контролом Controls: `columnFilteringServer`,
`paginationInitialPageSize`, `cellSelectionMultiRange`. Бизнес-колбэки `on*` сохраняют
имена из API (`onLoadMore`, `onCellEdit`): они уникальны между плагинами (ADR 0027).
Тип аргументов историй выводится из типов опций фабрик, маппер раскладывает подопции
обратно в аргументы фабрики одним правилом. Страж `storyControls` проверяет правило для
каждой фабрики из `/plugins`.

## Границы

- Флаги `columnDef` и имена TanStack не меняются.
- Предикаты о данных (`hasChildren`, `hasMore`, `isAllRowsSelected`) — вне правила.
- Внутренние опции таблицы не переименовываются.
- Прочие имена подвозможностей (`removal`, `leafPinning`, `multiRange`…) уже следуют
  правилу и не меняются.

## Последствия

- Ломающие изменения публичного API: `enableSkeleton`, `enableLoading`, `loadingOptions`,
  `LoadingOptions`, `canEdit`, `enable` у `rowDragging`.
- Новая возможность ядра — `enableX`, новое состояние — существительное, новый предикат —
  `can<Глагол><Объект>`, новый тумблер истории — `enable<Фабрика>`; стражи FN1, FN2, FN5
  держат правило.
- В принятых ADR старые имена остаются как история; действующие имена — здесь.

## Требования

| ID  | Требование                                                                                                                                                                                                      | Вид       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FN1 | В аргументах фабрик всех плагинов из `/plugins` вкл/выкл называется только `enabled`; других ключей `enable*` нет                                                                                               | модульный |
| FN2 | Предикаты разрешения в аргументах фабрик — вида `can<Глагол><Объект>`: `canEditCell`, `canSelectCell`, `canDragRow`; ключей `can*` другого вида нет                                                             | модульный |
| FN3 | Состояние загрузки — единственный параметр `useCreateTable` `loading` типа `'initial'                                                                                                                           | 'refresh' | false`; `enableSkeleton`и`enableLoading` нет (вид режимов покрывают SL и GL) | модульный |
| FN4 | Тайминги обновления передаются в `refreshOptions` (тип `RefreshOptions` из корня пакета); `loadingOptions` и `LoadingOptions` нет                                                                               | модульный |
| FN5 | У каждой фабрики из `/plugins` в историях тумблер `enable<Фабрика>`, её подопции — `<фабрика><Опция>`, колбэки — `on*` из API; других аргументов плагинов нет                                                   | модульный |
| FN6 | В `src`, `README.md`, `docs/architecture` и `AGENTS.md` нет старых имён (`enableSkeleton`, `enableLoading`, `loadingOptions`, `LoadingOptions`, `canEdit`, `rowDraggingEnable`); ADR и `CHANGELOG.md` — история | модульный |
