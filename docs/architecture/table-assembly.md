# Сборка таблицы — `useCreateTable`

`useCreateTable<TData, const TEntries>` — единственная точка входа. Она превращает
входы потребителя в сконфигурированный инстанс TanStack v9. Источник:
`src/lib/core/useCreateTable.ts`.

## Дженерики

Сигнатура в v9 сжата до двух параметров:

| Дженерик   | Значение                                                         | По умолчанию                     |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| `TData`    | форма строки                                                     | —                                |
| `TEntries` | кортеж записей `plugins` (`const`) — набор фич выводится из него | `readonly TesseraFeatureEntry[]` |

Из `TEntries` выводится набор фич `TesseraFeatures<TEntries>` (см.
[features.ts](../../src/lib/core/features.ts)), который в v9 идёт **ведущим**
дженериком `TFeatures` во все типы TanStack (`Table<TFeatures, TData>`,
`ColumnDef<TFeatures, TData, TValue>`, …). `columns` и `state` потребителя типизируются
через него: `ColumnDef<TesseraFeatures<TEntries>, TData, unknown>[]` и
`Partial<TableState<TesseraFeatures<TEntries>>>`. Бизнес-`hooks` — опция always-on
`commonFeature` (тип `CommonHooks`). Presence-based композиция и её обоснование —
[ADR 0010](../decisions/0010-invert-core-plugins-registry.md).

## Пайплайн

```mermaid
flowchart TB
    IN["useCreateTable(params)"]

    SIG["signature = id|enabled активных записей<br/>(стабилизирует набор по составу, не по идентичности массива)"]
    FEAT["buildTesseraFeatures(plugins)<br/>commonFeature + always-on grid-фичи + слоты записей → tableFeatures()"]
    FOLD["foldEntries(plugins)<br/>{ options, slots, slotActions, actionMenu, serviceColumns, setups }"]
    COLS["injectServiceColumns(columns, folded.serviceColumns)<br/>selection · expanding · dragging · row-actions"]
    CTRL["контролируемые срезы:<br/>columnPinning (пиннинг сервисных колонок)<br/>columnSizing (ресайз + авто-слайс)"]
    HK["useCreateHooks(hooks)"]

    RT["useTable(options)<br/>features, columns: injected, data<br/>...folded.options, state<br/>hooks, slots, slotActions, actionMenu"]

    OUT["инстанс table"]

    IN --> SIG --> FEAT --> FOLD --> COLS --> CTRL --> HK --> RT --> OUT
    RT --> EFF["useEffect: folded.setups(table)<br/>layout-эффект: reconcile каждой записи"]
```

## Сервисные столбцы (`injectServiceColumns`)

Tessera инъектирует не-data столбцы на основе **наличия плагина** в `plugins`
(presence-based, ADR 0010): плагин приносит свою сервисную колонку в записи как
`TablePlugin.column` (`rowSelection`, `rowExpanding`, `rowDragging`,
`rowActions`). `foldEntries` собирает их в `serviceColumns`, а `injectServiceColumns`
раскладывает по `side`/`order`; ядро плагины не импортит. При вставке ядро метит колонку
(символ в описании, ADR 0165): `column.getIsActionsColumn()` и `column.getServiceColumn()`
читают метку, а не id. Скрытую подпись шапки (`label`), ширину по кнопке грида
(`controlSized`) и зону действий строки (`fill` — свободное место и действия слота
`actionRowSlot`) колонка объявляет полями записи `ServiceColumn`. Сервисная
колонка — всегда лист без групп-обёрток: под вложенной шапкой полную высоту ей даёт
вертикальный спан TanStack v9 ([ADR 0049](../decisions/0049-native-header-spans.md)).

## Состояние: контролируемые срезы против pass-through

В отличие от прочих срезов, которыми в v9 владеют сами фичи (uncontrolled), ядро
перехватывает **два** среза, потому что они несут инъекцию сервисных колонок:

- **`columnPinning`** — контролируемый: пользовательский пиннинг + пиннинг сервисных
  колонок как **display-transform**. `mergeServiceColumnPinning` вклеивает сервисные
  `start/end`, а `onColumnPinningChange` срезает их обратно, чтобы наружу уходил
  чистый пользовательский пиннинг.
- **`columnSizing`** — контролируемый: пользовательский ресайз (`mergeColumnSizing`) +
  авто-слайс, который плагины пишут в `setup` через `table.setColumnAutoSizing`
  (`onColumnAutoSizingChange` бейлит при равенстве, иначе цикл).

`state`/`handlers` потребителя несут только срезы колонок (`columnVisibility`,
`columnOrder`, `columnPinning`, `columnSizing`) и их `on…Change`
([ADR 0120](../decisions/0120-model-and-interface-plugins.md), §4); остальные срезы колонок
пробрасываются в `useTable` **как есть**. Срез плагина (`sorting`, `expanded`,
`rowSelection`…) и колбэк вроде `onRowOrderChange` задаются аргументами фабрики плагина;
переданные ядру в обход типов, они вырезаются (`core/coreState.ts`, `splitCoreState`) с
dev-предупреждением, куда их перенести (MP7). Срезы из аргументов плагинов ядро собирает из
записей (`pluginSlicesOf`) и отдаёт TanStack вместе со своими. Новый объект `state` с теми же срезами
перерисовок не даёт: `useTable` публикует его по срезам со сравнением `shallow`
(см. [reactivity.md](reactivity.md)).

```mermaid
flowchart LR
    subgraph input["params.state / params.handlers"]
        P["columnPinning / columnSizing"]
        R["columnVisibility / columnOrder + onXChange"]
        F["срезы плагинов"]
    end
    subgraph args["аргументы фабрик"]
        S["sorting, expanded, rowSelection…"]
    end
    P --> CTRL["перехват:<br/>сервисный пиннинг + авто-слайс"]
    R --> PASS["pass-through в useTable"]
    F --> DROP["вырезка + dev-warn (MP7)"]
    S --> SLICES["pluginSlicesOf → useEffectiveState / TanStack"]
    CTRL --> MERGE["options.state"]
    PASS --> MERGE
    SLICES --> MERGE
```

## Источник строк

`table.getRowSource()` (`commonFeature`, [`core/rowSource.ts`](../../src/lib/core/rowSource.ts),
[ADR 0138](../decisions/0138-server-side-row-model.md)) — строки тела по индексу (`count`,
`at`, `indexOf`) и строка данных по id (`byId`, как `getRow(id, true)` TanStack, но без
исключения). Клиентский источник читает `getRowModel()`; серверная модель строк подставит
свой — хранилище блоков (`serverRowModel`, опция таблицы `getRowSource`). Необязательные
`rows` — весь список, если он загружен целиком (по нему тело считает дерево, линии,
движение строк и место броска), и `observe` — окно тела и быстрая прокрутка, по которым
серверный источник грузит блоки (`core/rowSourceWindow.ts`). Виртуализатор строк, тело,
клавиатура, правка, выбор, скелет, «наверх» и футер читают строки только через него. Модели строк TanStack мимо источника читают
только модули списка стража SD2 (`__tests__/rowSource.test.ts`) с причиной: фабрики
моделей, алгоритмы над массивом строк тела, ленивые дети, перетаскивание, выгрузка и
счётчики строк данных.

Серверная группировка ([ADR 0144](../decisions/0144-server-side-grouping.md)) — те же ветки
хранилищ: строка-группа — `constructRow` с `groupingColumnId` и id `group:<JSON пути>`
(`GROUP_ROW_PREFIX`), её ветка получает итог из `groupChildCount`, корень — `totals` и
`leafCount` (методы источника). Смена `grouping` — новая выборка, как сортировка
(`rowSourceWindow`), и серверное действие вида `grouping` с откатом среза. Раскрываемой
строку-группу делает `getRowCanExpand` плагина `rowExpanding`: TanStack проверяет
раскрываемость функцией, а не методом строки.

## Hooks — бизнес-контракт

`hooks` — типизированный объект бизнес-колбэков/значений (например,
`rowSelection.onSelectRow`). `useCreateHooks` мемоизирует его; он прикрепляется опцией
таблицы и читается через `table.getHooks()` (устанавливается `commonFeature`). Чтение
`getHooks()` **ни на что не подписывается** — hooks задуманы как точки входа для
сайд-эффектов, а не входы рендера. Динамические значения, которые должны управлять
рендерингом, принадлежат `state` и потребляются через гранулярные подписки
(`useSlice`/`useTableState`, [reactivity.md](reactivity.md)).

Отдельно от `hooks` — опция ядра `onDebugAction` (ADR 0125): отладочный журнал
действий, а не бизнес-контракт. Её читает `table.reportAction` из `commonFeature` на
каждом действии, поэтому смена слушателя ничего не пересобирает, а без слушателя канал
не строит деталей и не добавляет работы (AL3, AL26).

## Плагины

Набор фич собирается presence-based (ADR 0010): `buildTesseraFeatures` вклеивает
always-on `commonFeature` + grid-инфраструктурные фичи (columnOrdering/Visibility/
Pinning/Sizing/Grouping — их методы гриду нужны всегда), затем **фичи всех
присутствующих записей** (в т.ч. `enabled: false`) и прогоняет через `tableFeatures()`.
Почему всех: v9 фиксирует набор фич на маунте `useTable`, поэтому рантайм-включение
плагина не добавило бы фичу — вместо этого фича всегда в наборе, а поведение гейтится
`enable*`-опцией (фабрика отключённого плагина эмитит `enable*: false`; `foldEntries`
берёт опции от всех записей, а слоты/колонки/setup — только от активных).

Мемоизация идёт на двух уровнях (ADR 0039), а не по идентичности массива
`plugins` — свежий inline-массив с теми же значениями ничего не пересобирает:

- **по составу набора** (`id|enabled` активных записей) — `features` и сервисные
  колонки. Смена аргумента фабрики не пересоздаёт колонки и не перестраивает модель
  (RX1, RX3);
- **по значению аргументов фабрик** — `folded`: опции, слоты, `actionMenu` и
  `setup`. Запись `definePlugin` несёт `args`, ключ по значению `argsKey` и
  `configure` (`core/pluginArgs.ts`). При смене ключа ядро пересобирает настройку из
  **вида** аргументов: функции в нём — стабильные обёртки, которые зовут последнюю
  версию функции, поэтому пересборка не дёргает мемо row-моделей. Смена только
  функции ключ не меняет — она живёт в обёртке (RX2). `setup` перезапускается только
  при смене состава набора или значения аргументов, после cleanup прежнего (RX24):
  обёртка `useTable` новая на каждом рендере, поэтому в зависимости эффекта её нет, и
  `setup` получает таблицу своего запуска.

Состав набора — договор на время жизни таблицы (`core/pluginSet.ts`): ядро помнит
`id` с момента монтирования. Добавленный позже плагин исключается из сборки
(`'addedAfterMount'`, RX5), удалённый остаётся «призраком» с `enabled: false`
(`'removedAfterMount'`, RX6) — иначе его фича работала бы со старыми опциями. Аргументы
из `lifetime` записи берутся с момента монтирования (RX4); так же ядро держит режим
данных `dataMode` ([ADR 0169](../decisions/0169-data-mode.md)).

Хуки (`foldHooks`) по-прежнему сворачиваются каждый рендер. Записи, написанные
вручную (без `definePlugin`), не несут `args` — их поля статичны на время состава.

Про жизненный цикл фичи см. [plugins-and-slots.md](plugins-and-slots.md).
