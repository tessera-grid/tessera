# 0166 — Общий слой: код плагинов, утилиты и кит из ядра и грида

- **Статус:** Принято (решения — по итогам прожарки 2026-10-31)
- **Дата:** 2026-10-31
- **Слой:** `util/` — листовые утилиты; `shared/` — код, общий у плагинов; `ui/` — тема и
  компоненты, которые грид делит с плагинами. Ядро и грид теряют то, что им не принадлежит.
- **Изменяет:**
  - [ADR 0163](0163-layer-boundaries-and-guards.md), §3 и LB2 — рядом с базой долга перечень
    «API ядра для плагинов» с причиной.
  - [ADR 0010](0010-invert-core-plugins-registry.md), IV3 — общий код плагинов переезжает в
    `shared/`.
  - [ADR 0018](0018-external-theming.md), [ADR 0019](0019-token-architecture.md),
    [ADR 0090](0090-theme-source-and-switching.md) — тема живёт в `ui/theme`, а не в
    `core/themeVariables`; публичные имена (`DATA_GRID_THEME_CLASS`, `ColorMode`,
    `ContrastMode`) прежние.
- **Связано:**
  - [Аудит архитектуры 2026-10-31](../research/architecture-audit-2026-10-31.md), находки 1, 8, 9
    и край «свои модели строк»; шаг 3 порядка работ.
  - [ADR 0017](0017-ui-components.md) — правило UI-кита: переиспользуемые контролы — в `ui/`.
  - [ADR 0128](0128-derived-button-contract.md) — `CellButton`, публичная производная кнопка.

## Контекст

Слои `util/` и `shared/` введены ADR 0163, но пусты (кроме двух типов шага 2), а база стражей
держит то, что им принадлежит:

- восемнадцать модулей ядра нужны только плагинам (LB2): модели строк фильтрации и раскрытия,
  учёт отказов, переносы строк, агрегаты для сервера; часть — утилиты без знания о гриде;
- ядро и кит импортируют друг друга: ядро берёт разбор CSS-времени из `ui/buttonStates`, кит —
  журнал, хук окружения и тему из ядра; разбор CSS-времени написан трижды;
- плагины берут из грида компоненты (`CellButton`, `CellInvalid`, `StatusBarCount`,
  `LoadMoreError`, линии дерева), CSS видимости кнопок и класс CSS-модуля грида.

Часть модулей из базы LB2 — честный API ядра для плагинов: `servicePresence` и `scrollGridTo`
читает и само ядро. Убрать их из ядра нельзя, а в базе долга они выглядят как работа, которой
нет.

### Как у других

- **MUI X** — общий код пакетов вынесен в `@mui/x-internals`, кит — в отдельные пакеты;
  сам грид их только импортирует.
- **AG Grid** — модули фич зависят от общего ядра и общих утилит, а не друг от друга.

## Решение

### 1. Утилиты — в `util/`

`logger`, `useIsomorphicLayoutEffect`, `reactVersion`, `thenable`, `useLatest`, `oneCommit`,
`timeSlice`, `useDebouncedCallback` переезжают из `core/` в `util/` без изменения поведения.
Разбор CSS-времени (`600ms`, `0.6s`, список значений) — одна функция `util/cssTime.ts`; копии в
`grid/useSkeletonWave.ts` и `grid/rowMotion/rowMotionTiming.ts` и функция из
`ui/buttonStates/useErrorFlash.ts` переходят на неё.

### 2. Код плагинов — в `shared/`

- `shared/rowModels/` — свои модели строк, которые делят плагины: `expandedRowModel`,
  `filteredRowModel`, `idleRowModel`, `rowsByIdHandover`. Модели одного плагина
  (`sortedRowModel`, `lazyCoreRowModel`) остаются у него. Проверка при обновлении TanStack —
  эта папка и два модуля плагинов (край [«Свои модели строк»](../roadmap.md#известные-проблемы)).
- `failedAttempts`, `rowMoves`, `serverAggregations`.
- `shared/filtering/` — `core/filtering.ts`, `core/searchColumns.ts` и
  `grid/filtering/FilteredRowsCount.tsx`: условия, колонки быстрого поиска и счётчик «показано N
  из M» у фильтров колонок и поиска.

`serverRowModel` берёт `readPluginHooks` из входа `definePlugin`, а не из `definePlugin/channels`.

### 3. Тема и компоненты — в `ui/`

- **Тема.** `core/themeVariables` целиком — в `ui/theme`: `colorMode`, тема порталов,
  `theme.css`. Ядро её не импортирует; кит импортирует только `util`.
- **Компоненты, которые грид делит с плагинами**, — в `ui/`: `CellButton` (публичный в `/ui`,
  как прежде), `CellInvalid`, `StatusBarCount`, `LoadMoreError`, линии дерева
  (`TreeLinesLayer`), CSS видимости кнопок ячеек (`buttonVisibility.css`) и класс
  `visually-hidden`. Новые компоненты — внутренние: из `src/ui.ts` не экспортируются,
  публичность каждого — отдельным решением.
- `RowButton` — рядом с `CellButton`: публичная производная кнопка семейства ADR 0128 тоже лежала в
  `grid/Actions`.
- Длительность движения строк из токенов темы (`rowMotionTiming`) — в `ui/theme`: её читают
  движение строк и колонок грида и линии дерева кита.
- Иконка и иллюстрация заглушки (`StubEntry.media`, `StubAction.icon`) в `core/stubs.ts` —
  строковый ключ словаря `icons`, а не `keyof TableIcons`: ядро не ссылается на кит, иконку
  по ключу находит грид. Опечатку в ключе компилятор больше не ловит — иконки просто нет.

### 4. Перечень «API ядра для плагинов»

Страж LB2 сверяет модули ядра, которые извне читают только плагины, с двумя перечнями
`architecture.baseline.ts`: база долга (модуль переедет) и «API ядра для плагинов» (модуль
нужен самому ядру и открыт плагинам). У каждой записи — причина; модуль не может быть в обоих;
запись без модуля роняет страж.

## Границы

- Перетаскивание (`grid/dnd`, `HandleMenu`) — шаг 5 аудита; `SkeletonBody` в ленте и
  `cellSelectionCopy`/`clipboard` — шаг 7; `serverActions` и `rowSelectionAll` — шаг 6;
  `effectiveState` — шаг 8; `columnOptions`, `wallTime`, `columnDataType` — прожарка `dataType`.
- Поведение не меняется: переезд модулей и импортов. Пути `dist` меняются вместе с исходниками;
  входы пакета и публичные имена — нет.
- ADR 0018, 0019, 0090 не переписываются: пути к `core/themeVariables` в них — история.

## Отвергнутые альтернативы

- **В `ui/` только тема порталов** — тема разрезалась бы на два слоя; решено на прожарке.
- **Опубликовать переехавшие компоненты в `/ui`** — каждому нужны история и требования;
  публичность — отдельное решение.
- **LB2 не считает модули, которые читает само ядро** — долг вроде `clipboard` и
  `effectiveState` исчез бы из базы без исправления.
- **Перенести `wallTime` и `columnDataType` сейчас** — где живёт тип значения, решает прожарка
  `dataType`.

## Последствия

- Ядро не держит код, нужный только плагинам; кит не зависит от ядра.
- Базы стражей: LB1 — 12 рёбер (перетаскивание, `HandleMenu`, `SkeletonBody`), LB2 — долг из
  `clipboard`, `columnDataType`, `effectiveState`, `wallTime`, остальное — в перечне API.
- Импорты меняются по всему `src/lib`; публичный API пакета — нет.

## Требования

| ID  | Требование                                                                                                                                                                                                                                                       | Вид       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SH1 | `logger`, `useIsomorphicLayoutEffect`, `reactVersion`, `thenable`, `useLatest`, `oneCommit`, `timeSlice`, `useDebouncedCallback` и разбор CSS-времени живут в `util/`; разбор CSS-времени — одна функция, своих копий у грида и кита нет                         | модульный |
| SH2 | Модели строк `expandedRowModel`, `filteredRowModel`, `idleRowModel`, `rowsByIdHandover` — в `shared/rowModels/`; `failedAttempts`, `rowMoves`, `serverAggregations`, фильтрация и `FilteredRowsCount` — в `shared/`; в `core/` и `grid/` их нет                  | модульный |
| SH3 | Тема (`colorMode`, тема порталов, `theme.css`) — в `ui/theme`; в базе LB1 нет рёбер `ui → core` и `core → ui`                                                                                                                                                    | модульный |
| SH4 | `CellButton`, `RowButton`, `CellInvalid`, `StatusBarCount`, `LoadMoreError`, линии дерева, видимость кнопок ячеек и `visually-hidden` — в `ui/`; в базе LB1 рёбра «плагин → грид» — только перетаскивание, `HandleMenu` и `SkeletonBody`; экспорты `/ui` прежние | модульный |

## Сценарии

Нет: код переезжает, поведение и публичный API прежние.

## Внедрение

Внедрён 2026-10-31.

- **Переезд** — 35 модулей `git mv`, импорты переписаны кодмодом по разрешению старых путей
  (относительные и `@/`): `util/` — 9 модулей с `cssTime`, `shared/` — `rowModels/` (4),
  `failedAttempts`, `rowMoves`, `serverAggregations`, `filtering/` (3), `ui/` — `theme/` (6 с
  `rowMotionTiming`), `CellButton`, `RowButton`, `cellControls/`, `StatusBarCount`,
  `LoadMoreError`, `TreeLines`, `visuallyHidden.module.css`.
- **Базы** — LB1: 12 рёбер (перетаскивание, `HandleMenu`, `SkeletonBody`); LB2: долг
  `clipboard`, `columnDataType`, `effectiveState`, `wallTime`, перечень API — `rowChanges`,
  `scrollGridTo`, `servicePresence`. `rowChanges` попал в перечень после переезда моделей:
  подсказку виртуализатору пишут модели строк `shared/`, читает ядро.
- **Тесты** — модульный `sharedLayer` (SH1–SH4); TQ1 — все четыре красные до переезда.
  Пути `theme.css`, `rowMoves`, `logger` и моделей строк обновлены в стражах FB10, LT11, LK10,
  SD2.
