# 0164 — Контракт ядра: опции одним типом, публичная запись плагина

- **Статус:** Принято (решения — по итогам прожарки 2026-10-31)
- **Дата:** 2026-10-31
- **Слой:** `core` — типы опций и записи плагина; `grid` и `definePlugin` перестают читать
  опции кастом. Плагинов не касается: это контракт между ними и ядром.
- **Изменяет:**
  - [ADR 0010](0010-invert-core-plugins-registry.md) — публичный `TablePlugin` больше не равен
    внутренней записи `TesseraFeatureEntry`.
  - [ADR 0120](0120-model-and-interface-plugins.md) — хелперы `use*State`, которые разворачивались
    в аргументы плагинов, удалены.
- **Связано:**
  - [Аудит архитектуры 2026-10-31](../research/architecture-audit-2026-10-31.md), находки 6, 7, 11, 12;
    шаг 2 порядка работ.
  - [ADR 0163](0163-layer-boundaries-and-guards.md) — снимок контракта LB8 и касты опций LB9.
  - [ADR 0028](0028-define-plugin-authoring-api.md), [ADR 0039](0039-reactive-plugin-arguments.md) —
    поля записи, которые ставят `definePlugin` и ядро.

## Контекст

Аудит 2026-10-31 нашёл в контракте ядра три лишних источника расхождений:

- пятнадцать пользовательских опций ядра (`loading`, `enableFooter`, `rowHeight`…) перечислены
  трижды — в `CommonOptions`, `CreateDataGridOptions` и `UseCreateTableParams` — и ещё раз
  вручную при передаче в `useTable`; списки уже разошлись: в `CreateDataGridOptions` нет
  `onDebugAction`;
- `useCreateTable` кладёт в опции таблицы `refreshNarrowing`, `pluginRenderVersion` и
  `pluginStateListeners`, которых нет в типе: их читают через `as any` и `options as { … }`;
- публичный `TablePlugin` — это внутренняя запись целиком: 26 полей, из которых девять ставят
  ядро и `definePlugin` (`args`, `argsKey`, `configure`…), а автор плагина их задавать не должен.

Хелперы `useRowSelectionState`, `useSortingState` и ещё шесть — тонкий `useState`, который
сбрасывает значение, когда `initial` приходит новой ссылкой: `useRowSelectionState({ a: true })`
в рендере зацикливается. Удобство «развернуть в аргументы плагина» не стоит отдельного
публичного API.

### Как у других

- **TanStack Table** — один тип опций таблицы (`TableOptions`), фичи дополняют его картой; своих
  хелперов состояния нет.
- **AG Grid** — `GridOptions` одним интерфейсом; внутреннее состояние модулей в публичный тип не
  попадает.

## Решение

### 1. Опции ядра — один тип

Пользовательские опции ядра — интерфейс `CoreOptions` (`loading`, `enableFooter`,
`footerPosition`, `enableToolbar`, `enableStatusBar`, `enableAnnouncements`,
`enableOverflowTooltip`, `enableRowAnimation`, `enableColumnAnimation`, `skeletonOptions`,
`refreshOptions`, `loadError`, `onRetry`, `onDebugAction`, `rowHeight`, `headerHeight`).
`CommonOptions` расширяет его каналами плагинов и сборки; `UseCreateTableParams` — его и поля
данных (`columns`, `data`, `plugins`, `getRowId`, `getSubRows`, `state`, `handlers`,
`defaultColumn`); аргументы историй — его же. `CreateDataGridOptions` удаляется. `useCreateTable`
берёт опции ядра остатком деструктуризации и передаёт в таблицу все ключи `CoreOptions`,
непереданные — `undefined`: `useTable` сливает опции с прежними, и снятое приложением значение
иначе осталось бы в таблице. Полноту списка ключей проверяет компилятор
(`Record<keyof CoreOptions, true>`).

### 2. Каналы сборки объявлены

Каждая опция, которую `useCreateTable` кладёт в опции таблицы сверх стоковых и опций плагинов,
объявлена в `CommonOptions`: `refreshNarrowing` (пересчёт сужения по просьбе плагина,
ADR 0160), `pluginRenderVersion` (номер перерисовки ячеек при смене функции-аргумента,
ADR 0039), `pluginStateListeners` (колбэки локальных срезов плагинов, DP17). `DataGrid` и
`definePlugin` читают их из типизированных опций, без каста.

### 3. Публичная и внутренняя запись плагина

`TablePlugin` — поля, которые задаёт автор плагина: `id`, `features`, `enabled`, `options`,
`hooks`, `slots`, `slotActions`, `stubs`, `contextMenuActions`, `keyboardActions`, `actionMenu`,
`diagnose`, `column`, `setup`, `narrow`, `reconcile`, `model`. Внутренняя `TesseraFeatureEntry`
расширяет его полями ядра и `definePlugin`: `args`, `argsKey`, `lifetimeArgs`, `refreshArgs`,
`controlledState`, `stateSlices`, `includedBy`, `inertReason`, `configure`. `useCreateTable`
принимает `TablePlugin[]`; запись `definePlugin` подходит ему как есть. Снимок контракта LB8
ведёт оба перечня.

### 4. Хелперов состояния нет

`useColumnOrderState`, `useColumnPinningState`, `useRowSelectionState`, `useColumnSizingState`,
`useExpandedState`, `useSortingState`, `useColumnVisibilityState`, `useGroupingState` удаляются из
экспортов и кода. README, `docs/architecture` и истории задают срез через `useState` и
аргументы плагина: `rowSelection({ rowSelection, onRowSelectionChange: setRowSelection })`.

## Границы

- Слияние локального состояния плагина (`controlled` у `definePlugin`) со срезами аргументов
  (ADR 0120) — шаг 8 аудита, вместе с переделкой эффективного состояния ADR 0039.
- Каналы плагинов в `CommonOptions` (`getTotalRowCount`, `partialData`…) остаются: их судьба —
  находка 4 аудита, шаг 4.

## Отвергнутые альтернативы

- **Оставить хелперы с `initial` как у `useState`** — чинит зацикливание, но держит отдельный
  публичный API ради одной строки; решено на прожарке: удалить.
- **Объявить каналы сборки методами таблицы** — `refreshNarrowing` и `pluginStateListeners`
  нужны до создания таблицы; опции проще и уже на месте.

## Последствия

- Новая опция ядра — одна правка типа `CoreOptions` и строка снимка LB8.
- База LB9 теряет касты `pluginRenderVersion` и опций ядра в `DataGrid`.
- **Ломающие изменения публичного API (до 1.0):** удалены восемь хелперов `use*State`; из
  `TablePlugin` убраны девять служебных полей; `CreateDataGridOptions` не экспортировался.

## Требования

| ID  | Требование                                                                                                                                                                                                                                 | Вид       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| CK1 | Пользовательские опции ядра — один тип `CoreOptions`: его ключи есть и в `CommonOptions`, и в параметрах `useCreateTable` с теми же типами; `CreateDataGridOptions` нет                                                                    | модульный |
| CK2 | Каждый ключ опций таблицы после `useCreateTable` со всеми встроенными плагинами — стоковый TanStack, опция плагина или ключ `CommonOptions`; `refreshNarrowing`, `pluginRenderVersion`, `pluginStateListeners` объявлены в `CommonOptions` | модульный |
| CK3 | Публичный `TablePlugin` не содержит полей `args`, `argsKey`, `lifetimeArgs`, `refreshArgs`, `controlledState`, `stateSlices`, `includedBy`, `inertReason`, `configure`; `useCreateTable` принимает `TablePlugin[]`                         | модульный |
| CK4 | Хелперов `use*State` нет ни в экспортах пакета, ни в `src`, README и `docs/architecture`                                                                                                                                                   | модульный |

## Сценарии

Нет: меняется контракт типов, у пользователя грида нового сценария нет.

## Внедрение

Внедрён 2026-10-31.

- **Опции ядра** — `CoreOptions` в `core/commonFeature.types.ts`, `CommonOptions` его расширяет
  каналами; `CORE_OPTION_KEYS` в `useCreateTable`; типизированный доступ `commonOptionsOf`
  (`core/commonFeature.ts`) — `DataGrid`, `definePlugin` и ленивые дети `rowExpanding` читают
  опции без каста. База LB9 в `DataGrid.tsx` — 2 каста вместо 13.
- **Запись плагина** — `TablePlugin` и `TesseraFeatureEntry extends TablePlugin` в
  `core/features.ts`; снимок LB8 ведёт оба перечня.
- **Хелперы** удалены из `core/createState.ts` и `src/index.ts`; README, истории
  (`DataGridStory`, `Theming`) и тесты (`theming-matrix`, MP8) — на `useState`. MP8 ADR 0120
  переформулирован без хелпера.
- **Тесты** — модульный `coreContract` (CK1–CK4; CK2 — таблица со всеми встроенными плагинами
  серверным рендером, `__tests__/tableHost.ts`). TQ1: `loading`, объявленный заново в
  `CommonOptions` (CK1), `pluginStateListeners` без объявления (CK2), `args` в `TablePlugin`
  (CK3), `useSortingState` в README (CK4).
