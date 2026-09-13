# `src/v9/` — параллельный слой миграции на TanStack Table v9

Реализация [ADR 0026](../../docs/decisions/0026-migrate-to-tanstack-v9.md) по
[плану](../../docs/research/tanstack-table-v9-migration-plan.md). Стратегия — **параллельный
слой с cutover в конце**: новый код на v9 живёт здесь, существующий v8-код (`src/lib/**`)
остаётся рабочим и зелёным, пока идёт миграция; смена зависимости и удаление v8 —
последним шагом.

## Как это собрано

- v9 установлен npm-алиасом **`@tanstack/table-v9`** (= `@tanstack/react-table@9`),
  сосуществует с v8 (`@tanstack/react-table@8`). Разные спецификаторы → разные
  declaration merging, слои не конфликтуют (доказано спайком + зелёным `tsc`).
- Весь `src/v9/**` импортит типы TanStack **только через [`types.ts`](./types.ts)**.
- Контракты Tessera (бывш. глобальные дженерики `THooks/TState/TOptions`) переезжают в
  **опции и API конкретных фич** через v9 `*_FeatureMap` (см. `core/commonFeature.types.ts`).

## Статус по фазам

- **Фаза A — типовой фундамент** — готово (основа).
  - ✅ `core/commonFeature.types.ts` — тип-контракт always-on `commonFeature`
    (declaration merging + API-интерфейсы).
  - ✅ `types.ts` — единый импорт-слой.
  - ✅ `core/commonFeature.contract.ts` — компайл-тайм проверка контракта.
  - ✅ Порт слот-машинерии — сделан в фазе C (placeholder'ы заменены реальными типами).
- **Фаза B — ядро** — готово (базовый каркас).
  - ✅ `core/features.ts` — presence-based `buildTesseraFeatures` (свёртка commonFeature + слоты записей).
  - ✅ `core/commonFeature.ts` — рантайм always-on фичи (табличные/колоночные/строчные/групповые API).
  - ✅ `core/useCreateTable.ts` — v9-хук (`useTable` + `buildTesseraFeatures`; компилируется).
  - ✅ `__tests__/core.test.ts` — headless-проверка (5/5): API commonFeature + сортировка.
- **Фаза C — слот-машинерия** — готово.
  - ✅ `core/createSlots/**` — `RenderSlots`/`RegisterSlotParams`/`PluginSlot` + `createEmptyRenderSlots`/`registerSlotInto`/`registerSlot` (v9-контексты).
  - ✅ `core/headerActions/**` — `SlotAction`/`SlotActions`/`SlotActionMenu` + `createEmptySlotActions`/`registerSlotActionInto`/`resolveActionLayout`/`resolveMenuItems`.
  - ✅ Контракт `commonFeature` подключён к реальным типам слотов (placeholder'ы убраны).
  - ✅ `__tests__/slots.test.ts` — юнит-покрытие fold + резолверов (10/10).
  - Решения: поле `subscribe` (Pub-Sub) убрано → реактивность на `table.atoms` (фаза D);
    `render`/`ColumnDefTemplate` оставлено deprecated, рендер — нативный `FlexRender`.
- **Фаза E — плагины по одному** — ✅ ГОТОВО (все 11).
  - ✅ Запись фичи расширена (`core/features.ts`): `TesseraFeatureEntry` несёт
    `options`/`slots`/`slotActions`/`actionMenu`/`column`/`setup`; чистая свёртка
    `foldEntries` (→ опции/слоты/действия/меню/сервисные колонки/setups). `useCreateTable`
    складывает их, инъектит сервисные колонки и прогоняет setups единым useEffect.
  - ✅ **columnSorting** (`plugins/columnSorting/**`, ADR 0012): `rowSortingFeature`
    + слот `sortedRowModel` + `sortFns`; дескриптор `sortHeaderAction` (v9-контекст,
    длина через `table.atoms.sorting`, без `subscribe`). Тест (5/5).
  - ✅ **Инъекция сервисных колонок** (`core/createColumns/**`): чистая
    `injectServiceColumns` (leading/trailing/order/dedup) + `getMaxColumnsDepth`;
    `TesseraFeatureEntry.column` + сбор в `foldEntries.serviceColumns`; `useCreateTable`
    инъектит. Переиспользуют rowExpanding/rowSelection/rowActions.
  - ✅ **rowExpanding** (`plugins/rowExpanding/**`, ADR 0015): `rowExpandingFeature`
    + слот `expandedRowModel`; сервисная колонка раскрытия (cell — компонент напрямую,
    без `createCell`); `getRowCanExpand` вместо обёртки `getCanExpand` (в v9 замещает
    дефолт → включает проверку subRows + гейт группировки ADR 0022 + глубину).
    `keepFeatureWhenDisabled` не нужен. Тест `__tests__/rowExpanding.test.ts` (7/7).
  - ✅ **rowSelection** (`plugins/rowSelection/**`, ADR 0014/0022): встроенный
    `rowSelectionFeature` (row-модель не нужна); сервисная колонка выбора (header/cell
    — компоненты напрямую); гейт группировки через функциональный `enableRowSelection`
    (в v9 влияет и на агрегаты), а не обёртку `getCanSelect`; `enableRowRangeSelection:
    false` для паритета (в v9 shift-range — дефолт); индетерминантность шапки исправлена
    на `some && !all` (в v9 getIsSomePageRowsSelected true и при всех выбранных);
    `getCanSomeRowsSelect` (в v9 нет) вычисляется инлайн. Тест (5/5).
  - ✅ **rowGrouping** (`plugins/rowGrouping/**`, ADR 0016): `columnGroupingFeature` +
    слот `groupedRowModel`; агрегация в v9 ОТДЕЛЕНА — добавлены `rowAggregationFeature`
    + стандартный набор `aggregationFns` (в v8 шли внутри getGroupedRowModel); дескриптор
    `groupHeaderAction` (тумблер группировки). Это владелец гейта группировки, которому
    уступают rowExpanding/rowSelection (ADR 0022). Тест (3/3).
  - ✅ **columnSizing** (`plugins/columnSizing/**`, ADR 0013): в v9 sizing/resizing
    РАЗДЕЛЕНЫ — слот несёт обе фичи (`columnSizingFeature` + `columnResizingFeature`,
    prereq resizing→sizing проверяется типами); слот-грип `ColumnSizingComponent`
    (countsAsHeaderAction: false); опции (enableColumnResizing/columnResizeMode)
    совпали с v8; state ресайза переименован columnSizingInfo→columnResizing
    (компонент читает методы колонки — на порт не влияет). Тест (3/3).
  - ✅ **columnPinning** (`plugins/columnPinning/**`, ADR 0011): встроенный
    `columnPinningFeature` (state `{start,end}`); дескриптор `pinHeaderAction` с
    reorder-out (`enableLeafPinning`). Логическая сторона `left/right`→`start/end`
    по всему коду; состояние — `table.atoms.columnPinning`. Гранулярность под вложенной
    шапкой перенесена в `visible` дескриптора (в v9 нет опции per-column canPin →
    обёртка getCanPin и `keepFeatureWhenDisabled` не нужны). Тест (4/4).
    ⚠️ `cellPinningParams`/sticky-offset (`calc()`) — это grid-рендер, портируется на
    cutover (Фаза D/grid), не в плагине.
  - ✅ **columnDragging** (`plugins/columnDragging/**`, ADR 0006/0022): первая
    кастомная v9-фича после commonFeature — `columnDraggingFeature` (свой слайс
    `columnDraggingActiveId` + updater через makeStateUpdater, column-методы
    getCanDrag/getDraggableIndex через assignColumnPrototype); порядок — слот
    `columnOrderingFeature`. getDraggableIndex считается напрямую (в v9 нет
    `_getVisibleLeafColumns`/`getMemoOptions`). dnd-события — `getColumnDraggingEvents`
    (грид вызывает на cutover), не пекутся в options. `keepFeatureWhenDisabled` не нужен.
    Тест (4/4).
  - ✅ **rowDragging** (`plugins/rowDragging/**`, ADR 0006/0022): кастомная v9-фича
    `rowDraggingFeature` (слайс `rowDragging` + updater; row-метод getCanDrag с
    гейтами: многоуровневая шапка / активная сортировка / активная группировка,
    все читаются из атомов optional); сервисная колонка-ручка (cell — компонент
    напрямую). dnd-редьюсер с геометрией offset/nesting — grid-слой, на cutover.
    Тест (6/6, включая кросс-гейты sorting/grouping).
  - ✅ **rowActions / headerActionMenu / rowActionMenu** (`plugins/**`, ADR 0024/0025):
    menu-плагины — чистые декларации `actionMenu` (без фичи/слота); rowActions —
    сервисная колонка действий (trailing, pin end always) + `setup` (ширина через
    `setColumnAutoSizing`: сужается до collapsedWidth, когда `actionRowSlot` схлопнут).
    Тест `__tests__/actions.test.ts` (6/6).
- **Фаза D — реактивность на `table.atoms`** — ✅ ГОТОВО (слой утилит + доказательство).
  - ✅ `core/reactivity.ts` — `useSlice(table, key)` (подписка на один срез) и
    `useTableState(table, selector)` (проекция из store с shallow) — штатная замена
    `useSubscribeStore(() => [primitives])` (ADR 0007). `shallowEqual` локальный.
  - ✅ `__tests__/reactivity.dom.test.tsx` (happy-dom, 2/2): render-count доказывает
    per-slice ре-рендеры — смена `sorting` перерисовывает только подписчика sorting,
    смена `columnVisibility` — только его подписчика. Это React-уровень поверх
    store-гранулярности из спайка (условие ADR 0026 V9-2).
  - Ported-компоненты плагинов используют `useSelector(table.atoms.X)` напрямую (тот же
    механизм); helper — для grid-компонентов на cutover (multi-slice).
- **Cutover (финал)** — репойнт импортов на v9, удаление v8-слоя, перенос отложенных
  grid-кусков (cellPinningParams/sticky-offset, rowDragging offset/nesting-редьюсер,
  auto-sizing writer), прогон `perf` против базлайна (условие V9-1). См. чеклист ниже.
- **Фаза D — реактивность на `table.atoms`** — проявится на cutover (подписка грида);
  как утилитный слой не начата.

## Порядок фаз (факт)

A (типы) → B (ядро) → C (слот-машинерия) → **E (плагины, идёт)**. D (реактивность)
делается при подключении к `<DataGrid>` на cutover.

## Тесты v9-слоя

Гоняются отдельным node-конфигом (не в браузере основного прогона):

```bash
npx vitest run --config vitest.v9.config.ts
```

## Cutover-чеклист (финал)

1. Заменить зависимость: `@tanstack/react-table` `^8` → `^9`; убрать алиас `@tanstack/table-v9`.
2. Перецелить [`types.ts`](./types.ts) с `@tanstack/table-v9` на `@tanstack/react-table`.
3. Перевести потребителей (`src/lib/grid/**`, публичные barrel'ы) на `src/v9`.
4. Удалить v8-слой: `src/table.d.ts`, `src/types/**`, `src/lib/core/subscribeStore/**` и
   заменённые части `src/lib/core/**`, `src/lib/plugins/**`.
5. Поднять `src/v9/**` на их места; прогнать `typecheck` / `test` / `perf` (условие V9-1).
