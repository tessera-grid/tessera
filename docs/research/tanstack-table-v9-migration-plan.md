# План работ: миграция на TanStack Table v9

**Статус:** план (RnD-продолжение), не решение. Основан на
[tanstack-table-v9-migration.md](./tanstack-table-v9-migration.md).
**Дата:** 2026-09-13.
**Ветка:** `feat/tanstack-v9` (от `master`; git ведёт человек — [ADR 0002](../decisions/0002-develop-on-master-human-owns-git.md)).

> Важно: это **не инкрементальный bump**, а переписывание типового слоя и ядра. Дерево
> **не будет** зелёным после каждого мелкого шага — типы v9 (`TFeatures`) и новый
> контракт фич ломают компиляцию до тех пор, пока фаза 1–3 не сядет целиком. Поэтому
> план сгруппирован в **фазы-«приземления»**, а не в отдельные зелёные коммиты.

---

## 0. Инвентаризация затронутого (что вообще в игре)

| Область                | Единиц                  | Где                                                                                                                                                             |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Плагины (user-facing)  | **11**                  | `columnDragging, columnPinning, columnSizing, columnSorting, rowDragging, rowExpanding, rowGrouping, rowSelection, rowActions, headerActionMenu, rowActionMenu` |
| Always-on фича ядра    | 1                       | [commonPlugin.ts](../../src/lib/core/commonPlugin.ts)                                                                                                           |
| Типовой слой           | 8                       | [table.d.ts](../../src/table.d.ts) + `src/types/{table,column,cell,header,row,state,options}.ts`                                                                |
| Контракт/сборка        | ~5                      | [pluginContract.ts](../../src/lib/core/pluginContract.ts), `createTable/{useCreateTable,pluginOptions,usePluginSetups,useRowSelectionReset,types}.ts`           |
| Стейт                  | 14                      | `src/lib/core/createState/*`                                                                                                                                    |
| Реактивность (Pub-Sub) | 2 + **20 потребителей** | `src/lib/core/subscribeStore/*` + 20 файлов, импортящих `useSubscribeStore`                                                                                     |
| Тесты                  | **33**                  | `src/lib/stories/__tests__/{visual,performance}/*` + юнит-тесты плагинов/ядра                                                                                   |
| Дистрибутив            | 2                       | [package.json](../../package.json), `vite.config.*`                                                                                                             |

---

## 1. Что УДАЛИТЬ

| Путь                                                                                                     | Почему                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/core/subscribeStore/` (весь каталог: `subscribeStore.tsx`, `index.ts`)                          | Ручная эмуляция того, что v9 даёт из коробки (TanStack Store). Заменяется на `table.atoms`/`useSelector`/`table.Subscribe`. Апстрим [ADR 0007](../decisions/0007-reactivity-pubsub.md). |
| Вызовы `getCoreRowModel()` в ядре                                                                        | В v9 ядровая модель включается автоматически, отдельная опция не нужна.                                                                                                                 |
| Мемоизация-костыли в `useCreateTable` (`featureSignature`, частично `pluginSignature`/`columnSignature`) | Компенсируют тотальную пересборку модели v8; при store-модели v9 часть не нужна. **Не удалять вслепую** — снимать после перф-замера (§6).                                               |
| `keepFeatureWhenDisabled` в `RegistryEntry`                                                              | Обход того, что v8 фиксирует `_features` на маунте. Проверить, нужен ли аналог в v9; если нет — удалить.                                                                                |
| CJS-выход дистрибутива (`dist/index.cjs`, `exports.*.require`, `main`)                                   | v9 ESM-only. Требует решения (см. §7); при отказе от CJS — удаляется.                                                                                                                   |

---

## 2. Что ПЕРЕПИСАТЬ (по фазам)

### Фаза A — Типовой фундамент (`TFeatures`)

Самый дорогой и блокирующий слой: v9 добавляет **ведущий** дженерик `TFeatures` во все
публичные типы. Пока это не сделано, ничего ниже не компилируется.

| Файл                                    | Что делаем                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/table.d.ts](../../src/table.d.ts)  | Полный редизайн `declare module`. Прямое расширение `Table`/`Column`/`Cell`/`Header`/`Row`/`ColumnDef` → augmentation **feature-карт** v9: `Plugins`, `TableState_FeatureMap`, `TableOptions_FeatureMap<TFeatures,TData>`, `Table_FeatureMap<TFeatures,TData>`. `ColumnMeta.pinSides` сохранить (с `TFeatures`). Убрать augmentation `useReactTable`. |
| `src/types/table.ts`                    | `TableSDK<TData,THooks,TState,TOptions>` → пересобрать под v9-инстанс (методы на прототипе, `TFeatures` первым).                                                                                                                                                                                                                                      |
| `src/types/{column,cell,header,row}.ts` | Добавить ведущий `TFeatures`; согласовать с v9-сигнатурами. `ColumnHelperSDK` → `createColumnHelper<TFeatures,TData>`.                                                                                                                                                                                                                                |
| `src/types/state.ts`                    | Слайсы состояния под `TableState_FeatureMap`.                                                                                                                                                                                                                                                                                                         |
| `src/types/options.ts`                  | `TableOptionsResolvedSDK` → под `TableOptions_FeatureMap` + `getDefaultTableOptions`.                                                                                                                                                                                                                                                                 |
| `pluginContract.ts` (типовая часть)     | `InferPluginHooks`/`RegistryEntry<THooksSlice>` — согласовать с новым порядком дженериков.                                                                                                                                                                                                                                                            |

**Решение по контракту `<TData,THooks,TState,TOptions>`:** его надо совместить с
v9-`TFeatures`. Наиболее вероятно `TFeatures` становится первым параметром, наши
`THooks/TState/TOptions` уезжают правее либо частично инкапсулируются в кастомную фичу
(`hooks`/`slots` как опции `commonFeature`). Финализировать на спайке.

### Фаза B — Ядро сборки

| Файл                                                                  | Что делаем                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [useCreateTable.ts](../../src/lib/core/createTable/useCreateTable.ts) | `useReactTable`→`useTable`; `_features: [...]`→`features: tableFeatures({...})`; row-модели в слоты (`sortedRowModel: createSortedRowModel()` и т.д., `getCoreRowModel` убрать); стейт из `state:{...}` в модель v9; `getState`→атомы.     |
| `pluginContract.ts` (рантайм-часть)                                   | `TablePlugin` (`create*`) → v9 `TableFeature` (`assign*Prototype`/`init*InstanceData`/`constructTableAPIs`/`getDefaultTableOptions`). Редизайн `RegistryEntry`: как из массива записей собрать **типобезопасную карту** `tableFeatures()`. |
| `createTable/pluginOptions.ts`                                        | `foldPluginOptions`/`FEATURE_OFF_BASELINE` под опции v9-фич.                                                                                                                                                                               |
| `createTable/usePluginSetups.ts`, `useRowSelectionReset.ts`           | Согласовать с API инстанса v9 (методы через `this`, стейт через атомы).                                                                                                                                                                    |

### Фаза C — `commonPlugin` → `commonFeature`

Самая тяжёлая **рантайм**-миграция ([commonPlugin.ts](../../src/lib/core/commonPlugin.ts)):

| v8 сейчас                                                                                               | v9                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| монки-патч `table.getHeaderGroups` (флаги `getIsFirstGroup/getIsLastGroup`)                             | `initHeaderGroupInstanceData`                                                                          |
| `table.getIsAnyColumnResizing/setColumnAutoSizing/getHooks/getRenderSlots/getSlotActions/setRenderSlot` | `constructTableAPIs`                                                                                   |
| `createColumn` → `getIsActionsColumn/getIsRowActionsColumn`                                             | `assignColumnPrototype` (через `this.id`)                                                              |
| `createHeader` → `getIsFirstHeader/...` + `render`→`columnDef.header`                                   | `assignHeaderPrototype` + `initHeaderInstanceData`; **решить**: свой `render` vs нативный `FlexRender` |
| `createRow` → `getIsFirstRow/getIsLastRow/getIsLastSubRow`                                              | `assignRowPrototype`                                                                                   |
| `createCell` → `render`→`columnDef.cell`                                                                | `assignCellPrototype` + решение по `render`                                                            |
| опции `hooks/slots/slotActions/actionMenu` на `table.options`                                           | `TableOptions_FeatureMap` + `getDefaultTableOptions`                                                   |

### Фаза D — Реактивность (снос Pub-Sub)

| Файл                                | Что делаем                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/core/subscribeStore/*`     | **Удалить** (см. §1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 20 потребителей `useSubscribeStore` | Переписать на `useSelector(table.atoms.<slice>)` / `table.Subscribe`. Список: `rowSelection/{HeadSelectionComponent,RowSelectionComponent}`, `grid/HeadCell/HeadCell`, `grid/headerActions/{ActionsZone,ActionMenu,ActionButton}`, `core/headerActions/types`, `grid/DataGrid/DataGrid`, `columnSizing/ColumnSizingComponent`, `grid/BodyRow/BodyRow`, `rowDragging/RowDraggingComponent`, `columnDragging/ColumnDraggingComponent`, `rowExpanding/RowExpandingComponent`, `stories/Guide/{Cell,CellHiddenComponent,SwitchActionComponent}`, `index.ts`, тест `theming-overlays`. |
| `src/lib/core/createState/*` (14)   | Стейт-слайсы под store v9: `getState`→атомы, `onStateChange` убран (`table.store.subscribe`), индивидуальные `on*Change` сохраняются. `columnSizingState`→разделить sizing/resizing; `columnPinningState`→`start/end`.                                                                                                                                                                                                                                                                                                                                                            |
| `src/index.ts`                      | Убрать реэкспорт `SubscriptionStoreProvider`/`useSubscribeStore`; экспортировать нужные v9-примитивы, если публикуем.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Фаза E — Плагины по одному (11 шт.)

Каждый: фича (`TableFeature` v9) + стейт-слайс + опции + **свои тесты зелёными**
([ADR 0009](../decisions/0009-test-coverage-visual-and-performance.md)). Порядок — от
простого к сложному:

1. `columnSorting` — переименования `sortingFn→sortFn`, `getSortingFn→getSortFn`; UI мульти-сорта поверх (ломается мало). [ADR 0012](../decisions/0012-column-sorting.md)
2. `rowExpanding` — `expandedRowModel` в слот. [ADR 0015](../decisions/0015-row-expanding.md)
3. `rowSelection` — shift-range теперь дефолт (`enableRowRangeSelection:false` для старого поведения); семантика `getIsSomeRowsSelected` изменилась → правка индетерминантного чекбокса. [ADR 0014](../decisions/0014-row-selection.md)
4. `rowGrouping` — aggregation отделена от grouping, оба флага явно; контекстный aggregation API. [ADR 0016](../decisions/0016-row-grouping.md)
5. `columnSizing` — **сплит** `columnSizing`/`columnResizing`; `columnSizingInfo→columnResizing`. [ADR 0013](../decisions/0013-column-sizing.md)
6. `columnPinning` — `left/right→start/end` по коду и тестам; `enablePinning→enableColumnPinning`; выверить sticky-offset `calc()` и `enableLeafPinning`. [ADR 0011](../decisions/0011-column-pinning.md)
7. `columnDragging` / `rowDragging` — единственные с плотной `create*`-логикой (`getCanDrag/getDraggableIndex`); переносить в `assign*Prototype`; сверить с `keepFeatureWhenDisabled`. [ADR 0006](../decisions/0006-dnd-with-dnd-kit.md)
8. `rowActions`, `headerActionMenu`, `rowActionMenu` — в основном слоты/меню поверх; правки по опциям и `slotActions`. [ADR 0024](../decisions/0024-slot-action-descriptor-and-menu.md)/[0025](../decisions/0025-row-actions.md)

### Фаза F — Дистрибутив

| Файл                                           | Что делаем                                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [package.json](../../package.json)             | `peerDependencies.@tanstack/react-table` `^8`→`^9`; devDep тоже. Решение по CJS (§7): либо убрать `require`/`main`/`index.cjs`, либо оставить только ESM. |
| `vite.config.*`                                | Формат сборки: ESM-only, target ES2022. Проверить `vite-plugin-dts` под новые типы.                                                                       |
| `src/lib/plugins/index.ts`, публичные barrel'ы | Согласовать реэкспорты (`tableFeatures`-friendly).                                                                                                        |

---

## 3. Что СОЗДАТЬ (новое)

| Файл/сущность                                                                                        | Назначение                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/core/commonFeature.ts`                                                                      | v9-версия `commonPlugin` (переименовать по смыслу).                                                                        |
| Адаптер `tableFeatures()` в ядре                                                                     | Функция, собирающая типобезопасную карту фич из массива активных `RegistryEntry` (сердце presence-based композиции на v9). |
| Новый ADR `0026-migrate-to-tanstack-v9.md`                                                           | Фиксация решения, если спайк подтвердит. Отмечает апстрим ADR 0007.                                                        |
| Обновление `docs/architecture/{reactivity,table-assembly,plugins-and-slots,upstream-foundations}.md` | Синхронизация с новым ядром.                                                                                               |

---

## 4. Массовые переименования (search-replace, аудит вручную)

| Из                                             | В                                           | Область                                                                                              |
| ---------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useReactTable`                                | `useTable`                                  | ядро, типы                                                                                           |
| `getState()`                                   | `table.state` / `table.atoms.<slice>`       | реактивность                                                                                         |
| `sortingFn`/`sortingFns`/`getSortingFn`        | `sortFn`/`sortFns`/`getSortFn`              | columnSorting                                                                                        |
| `columnSizingInfo`/`onColumnSizingInfoChange`  | `columnResizing`/`onColumnResizingChange`   | columnSizing                                                                                         |
| pinning `'left'`/`'right'` (только табличные!) | `'start'`/`'end'`                           | columnPinning (**осторожно:** ~264 совпадений включают CSS/несвязанные `.left/.right` — фильтровать) |
| `enablePinning`                                | `enableColumnPinning` (+`enableRowPinning`) | columnPinning                                                                                        |
| `createColumnHelper<TData>`                    | `createColumnHelper<TFeatures,TData>`       | типы, stories, тесты                                                                                 |

---

## 5. Тесты (33 файла) — держать контракт

- **Юнит/логика** плагинов и `createState` — правятся вместе со своей фазой.
- **Визуальные** (`__tests__/visual/*`) — читают DOM-контракт; большинство должно
  пережить миграцию без правок, кроме `column-pinning`/`column-leaf-pinning`
  (start/end), `column-resizing`, `row-selection` (семантика), `cross-plugin`
  (X1/X4/X6). [ADR 0009](../decisions/0009-test-coverage-visual-and-performance.md)/[0023](../decisions/0023-cross-plugin-interactions.md).
- **Перф** (`__tests__/performance/{first-render,scroll}`) — **главный арбитр**
  миграции: снять v8-базлайн ДО работ, сравнить после. [ADR 0010](../decisions/0010-invert-core-plugins-registry.md) safety-net parity держать зелёным как можно дольше.

---

## 6. Порядок и контрольные точки

```
Фаза 0  ✅ Ветка + snapshot перф-базлайна v8 (spike/tanstack-v9/perf-baseline-v8.json) + ADR 0026
Фаза A  Типовой фундамент (TFeatures)          ─┐
Фаза B  Ядро сборки (useTable/tableFeatures)    ├─ «приземляются» вместе,
Фаза C  commonPlugin → commonFeature           ─┘  компиляция зелёная в конце блока
Фаза D  Снос Pub-Sub + createState на атомы     → первый прогон визуальных тестов
Фаза E  Плагины по одному (1→8, тесты зелёные пофазно)
Фаза F  Дистрибутив (ESM/peerDep)
Фаза G  Перф-замер vs базлайн, снятие лишних мемо-костылей, стори/доки/ADR
```

**Gate между блоками A–C и остальным:** `npm run typecheck` + `npm run build`
проходят. **Gate после D:** визуальные тесты идут. **Gate после E:** весь `npm test`
зелёный. **Финальный gate (G):** перф не хуже базлайна (иначе — разбор до релиза).

---

## 7. Открытые решения (принять на спайке, ДО массовой работы)

1. **`render`→`columnDef` (наш механизм) vs нативный `FlexRender`** — упрощение против
   совместимости API. Влияет на `commonFeature`, слоты, `renderComponent`.
2. **Как собрать `tableFeatures()` из динамического массива плагинов**, сохранив наш
   presence-based DX (`plugins={[...]}`) поверх статически-типизированной карты v9.
3. **CJS: убираем или оставляем.** Отказ — потенциально ломающее для потребителей →
   мажорный релиз Tessera.
4. **`keepFeatureWhenDisabled`** — нужен ли аналог при рантайм-тумблинге фич в v9.
5. **Судьба сквозного `<TData,THooks,TState,TOptions>`** рядом с `TFeatures`.

---

## 8. Рекомендация по запуску

**Не начинать фазу A сразу.** Сначала — **спайк** на `feat/tanstack-v9`:
`useTable` + `tableFeatures` с `commonFeature` и плагином сортировки, реактивность на
`table.atoms`. По результату — ADR 0026 (go/no-go), и только потом фазы A–G.

> **Статус: спайк собран и зелёный** (`spike/tanstack-v9/`, ветка
> `feat/tanstack-v9`; после миграции удалён, последний раз — в коммите `bbc7bb5`). На реальном `@tanstack/react-table@9.2.4` подтверждены
> ответы на все 5 вопросов §7: снос Pub-Sub (запускаемый тест гранулярности 3/3),
> `FlexRender` вместо самописного рендера (Q1), presence-based→`tableFeatures()` с
> компромиссом по типам (Q2), `keepFeatureWhenDisabled` скорее не нужен (Q4), `hooks`/
> `slots` как опции фичи вместо глобальных дженериков (Q5). Блокеров нет. Осталось для
> ADR: **перф-замер на базлайне** (фаза 0 + G) — единственное, что спайк не меряет.
