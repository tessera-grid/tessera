# 0010 — Инверсия core ↔ plugins: composable-плагины (presence-based)

- **Статус:** Принято
- **Дата:** 2026-08-06
- **Принято:** 2026-09-01

## Контекст

Плагины Tessera — это TanStack `TableFeature` ([ADR 0004](0004-core-on-tanstack-table.md)),
собираемые в `useReactTable` через `_features`. Но стрелка зависимости смотрит
**вниз**: слой `core` импортирует конкретные плагины пофамильно, и вклад одного
плагина размазан по нескольким местам ядра:

| Точка в core                                                               | Что захардкожено                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`useCreateTable`](../../src/lib/core/createTable/useCreateTable.ts)       | список из 9 плагинов в `_features`                            |
| [`useCreateColumns`](../../src/lib/core/createColumns/useCreateColumns.ts) | импорт фабрик сервисных колонок + `if (enable…) unshift/push` |
| [`useCreateState`](../../src/lib/core/createState/useCreateState.ts)       | вся ручная сборка `state`/`handlers` по каждому плагину       |
| [`createHooks/types`](../../src/lib/core/createHooks/types.ts)             | `PluginsHooks` — статическое пересечение hook-контрактов      |

Плюс ~20 `enable*`-флагов в
[`CreateDataGridParams`](../../src/lib/core/createTable/types.ts).

**Следствия:**

- Добавить/убрать плагин = править 4–5 файлов ядра (плагин не самодостаточен).
- Встроенные плагины нельзя отключить или tree-shake'нуть — все 9 всегда тянутся
  ядром.
- Публичный вход для плагинов декоративен (инстансы не композируются) — поэтому
  был убран.
- «Расширяемость снаружи» ([ADR 0004](0004-core-on-tanstack-table.md)) — полу-правда:
  `externalPlugins` умеет добавить `TableFeature`, но не умеет, как встроенные,
  принести свой state-слайс, сервисную колонку и типизированные hooks.

**Что уже даёт жизненный цикл.** В интерфейсе
[`TablePlugin`](../../src/lib/plugins/types.ts) **уже объявлены**
`getDefaultOptions`, `getInitialState`, `getDefaultColumnDef` — но плагины ими не
пользуются, а ядро делает эту работу за них руками. Механизм для инверсии есть;
им не пользуются.

**Что в жизненный цикл не влезает.** Инъекция _набора_ колонок — pre-table:
колонки приходят в таблицу готовыми, а `TableFeature` работает после
конструирования. В TanStack v8 нет фичевого хука «добавить колонку». Поэтому
сборка колонок обязана жить до `useReactTable` и требует привязки «плагин → его
сервисная колонка», читаемой на этапе сборки.

## Решение

Перейти на **presence-based композицию**: встроенные плагины импортируются
потребителем **отдельно** и передаются явным списком; **наличие = включено**.

```ts
import { useCreateTable } from '@mstrvtt/tessera'
import {
  rowSelection,
  rowExpanding,
  columnSorting,
} from '@mstrvtt/tessera/plugins'

useCreateTable({
  columns,
  data,
  plugins: [rowSelection(), rowExpanding(), columnSorting({ removal: false })],
})
```

### Форма плагина: запись-фабрика

Каждый плагин экспортирует **фабрику записи** `RegistryEntry`. Объект-фича
(`rowSelectionPlugin`) остаётся плоским `TableFeature` — обёртки на нём нет;
привязка колонки/размещения живёт во внешней записи.

```ts
export interface ServiceColumn {
  id: string // стабильный базовый id (таргет видимости/пиннинга)
  make: (depth: number) => ColumnDef<any, any>
  side: 'leading' | 'trailing' // порядок в наборе колонок
  order: number
  // пиннинг объявляет плагин-владелец, ядро лишь исполняет:
  pin?: { side: 'left' | 'right'; when: 'always' | 'with-user' }
}

export interface RegistryEntry {
  id: string
  feature: TablePlugin // = TanStack TableFeature, не меняется
  column?: ServiceColumn // опционально — не у всех фич есть колонка
  options?: Partial<TableOptionsResolved<any>> & TOptions // тонкие опции фичи
  enabled?: boolean // false → ядро отсеивает запись (выключатель фабрики)
  // generic-escape: императивный сетап после создания таблицы (побочный эффект,
  // невыразимый через feature/options — напр. запись авто-слайса размеров).
  // Ядро запускает setup всех активных плагинов в ЕДИНОМ useEffect (не хук —
  // rules-of-hooks соблюдены при любом числе плагинов). Setup обязан быть
  // идемпотентным (список плагинов обычно нестабилен между рендерами).
  setup?: (table: Table<any>) => void | (() => void)
}
```

`plugins` в `useCreateTable` принимает и falsy-записи (их ядро игнорирует), так что
динамический тумблинг делается либо `фабрика({ enabled })` (одним движением, список
статичный), либо идиомой `cond && фабрика()` — как условные дети в JSX.

Фича остаётся плоским синглтоном; тонкие опции (`removal`, `server`, `maxDepth`
и т.п.) фабрика кладёт в поле `options` записи, а `useCreateTable` сливает
`options` всех записей в `useReactTable`, откуда фичи читают их как сейчас
(`table.options.*`).

```ts
// plugins/rowSelection/index.ts
export const rowSelection = (opts?: RowSelectionOptions): RegistryEntry => ({
  id: 'rowSelection',
  feature: rowSelectionPlugin,
  column: { make: getRowSelectionColumn, side: 'leading', order: 1 },
  options: { enableRowSelection: true, ...opts },
})
```

Никакого центрального статического `builtinRegistry` — он тянул бы все плагины и
ломал tree-shaking. Реестр **распределён по плагинам**; массив собирает
потребитель тем, что импортирует.

### `core` обобщается и перестаёт знать плагины

```ts
// useCreateColumns — generic, плагинов НЕ импортит
export const useCreateColumns = ({ initialColumns, pluginColumns }) =>
  useMemo(() => {
    if (!initialColumns.length) return []
    const maxDepth = getMaxColumnsDepth(initialColumns)
    const byOrder = (a, b) => a.order - b.order
    const lead = pluginColumns.filter(c => c.side === 'leading').sort(byOrder)
    const trail = pluginColumns.filter(c => c.side === 'trailing').sort(byOrder)
    return deduplicateColumns([
      ...lead.map(c => c.make(maxDepth)),
      ...initialColumns,
      ...trail.map(c => c.make(maxDepth)),
    ])
  }, [initialColumns, pluginColumns])
```

`useCreateTable` фолдит переданный список: `features = plugins.map(p => p.feature)`,
`pluginColumns = plugins.filter(p => p.column).map(p => p.column)`. `useCreateState`
сворачивается в **один обобщённый контролируемый** `useState<TableState>` +
`onStateChange`; слайсы сеют сами плагины через существующие `getInitialState` /
`getDefaultOptions`. `PluginsHooks` агрегируется из переданного набора.

### Что из этого следует

- **`enable*`-флаги растворяются.** «Фича включена» = «её фабрика в списке».
  **Тонкие** опции переезжают в аргумент фабрики
  (`columnSorting({ removal, server })`, `rowExpanding({ maxDepth })`) — это
  поглощает группировку опций по фиче.
- **`common` — не opt-in.** Bootstrap-фича (hooks/slots) включается ядром
  **всегда**, сама; opt-in касается только фич.
- **Сервисные колонки:** порядок-дефолт задаётся полем `order` в записи (данные,
  а не последовательность `unshift`); runtime-переопределение — существующим
  состоянием `columnOrder` (перставляет любые колонки по id). Отдельного
  `serviceColumnOrder` нет.
- **`/plugins`-вход возвращается настоящим** — он экспортирует фабрики
  (`rowSelection`, `columnSorting`, …) как примитивы композиции.

## Требования

> **Охват.** Инверсия ядра и форма композиции. Паритет рендера проверяется
> существующими визуальными тестами плагинов
> ([ADR 0009](0009-test-coverage-visual-and-performance.md)).

**Инверсия и композиция**

| ID  | Требование                                                                                                                | Тест                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `core` (`createTable`/`createColumns`/`createState`/`createSlots`/`createHooks`) не импортирует ни один конкретный плагин | ✔ [`eslint.config.js`](../../eslint.config.js) `no-restricted-imports` уровня `error` для всего `src/lib/core/**` (контракт — в `core/pluginContract`; `createHooks` доведён до `error` в types-mode (b), см. ниже) |
| R2  | Добавление плагина не требует правок файлов `core` — только новая фабрика-запись                                          | ✔ `createTable/__tests__/composition.test.tsx`                                                                                                                                                                      |
| R3  | Плагины, не импортированные потребителем, отсутствуют в его бандле (tree-shaking)                                         | ✔ по сути гарантирован R1=`error` (ядро без статических импортов плагинов; вход `@mstrvtt/tessera/plugins` отдельный). Build-size CI-проверка — отдельная задача                                                    |
| R4  | Пользовательский плагин приносит `feature`, `column` и state-слайс тем же способом, что встроенный                        | ✔ `createTable/__tests__/composition.test.tsx`                                                                                                                                                                      |
| R5  | `common` присутствует всегда, независимо от переданного списка                                                            | ✔ `createTable/__tests__/composition.test.tsx`                                                                                                                                                                      |

**Колонки и порядок**

| ID  | Требование                                                                                                | Тест                                                             |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R6  | Порядок сервисных колонок по умолчанию задаётся полем `order` записи; при равенстве — по позиции в списке | ✔ оракул `useCreateColumns.test.tsx`, `service-columns.test.tsx` |
| R7  | Потребитель может переопределить фактический порядок (включая сервисные колонки) через `columnOrder`      | ✔ оракул `useCreateState.test.tsx`                               |
| R8  | Инъекция сервисной колонки гейтится наличием плагина в списке (нет плагина — нет колонки)                 | ✔ оракул `useCreateColumns.test.tsx`, `service-columns.test.tsx` |

**Паритет поведения**

| ID  | Требование                                                                                               | Тест                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| R9  | Эквивалентный набор плагинов даёт поведение, идентичное текущему (существующие визуальные тесты зелёные) | ✔ существующие спеки плагинов                                                            |
| R10 | Логика state сохранена: merge пиннинга, сев видимости сервисных колонок, приоритет external-vs-core      | ✔ оракул `columnPinningState.test.ts`, `useCreateState.test.tsx`, `stateSlices.test.tsx` |

## Последствия

- **+** Полная инверсия: `core` переиспользуем, новый плагин = одна фабрика, ноль
  правок ядра.
- **+** Tree-shaking неиспользуемых плагинов.
- **+** Настоящий `/plugins`-вход и opt-in-композиция.
- **+** Опции сгруппированы по фиче (аргумент фабрики вместо плоского мешка `enable*`).
- **+** Паритет расширяемости: пользовательский плагин равноправен встроенному.
- **− Ломающее изменение API:** `enable*`-флаги → композиция плагинов. Нужна
  миграция (см. открытые вопросы).
- **−** `foldState` + вывод типов — самая тяжёлая часть. Неоднородные слияния
  (пиннинг, сев видимости, external-vs-core) надо выразить обобщённо или коллбэком.
- **−** Уходит текущий «zero-import» опыт: чтобы получить фичу, её надо импортнуть.
  Осознанный размен эргономики на tree-shaking и явность.
- **− Перф-ловушка идентичности:** `plugins` — массив, а не булевы флаги;
  потребитель легко отдаёт свежий массив каждый рендер (как демо-`argsToPlugins`),
  и тогда `activePlugins → pluginColumns → columns` получают новые ссылки, а
  TanStack пересобирает таблицу каждый рендер (на большой выборке — ×9 к первой
  отрисовке; поймано перф-тестами P3/P5 после инверсии). Смягчено в ядре:
  `features`/`pluginColumns` мемоизируются по СИГНАТУРЕ СТРУКТУРЫ (id фич +
  id/side/order сервисных колонок), а не по идентичности массива — ссылки
  сохраняются, пока состав/порядок не меняется; тонкие опции пересчитываются
  отдельно (на структуру колонок не влияют). Сигнатуры РАЗДЕЛЕНЫ:
  `pluginColumns` зависит только от плагинов, вносящих сервисную колонку,
  поэтому тумблер плагина без колонки (сортировка/ресайз/пиннинг/группировка/
  dnd колонок) не пересобирает `columns` → всю таблицу; `features`/`slots`
  держатся по составу активного набора (id).
- **− Слоты объявляются декларативно, не императивно.** `feature.createTable`
  в TanStack выполняется ОДИН раз при конструировании и не переигрывается при
  смене `_features`, поэтому императивная регистрация слота (`table.setRenderSlot`)
  «застревала» на составе плагинов момента монтирования — плагин, включённый
  позже, свою кнопку в шапке не показывал. Слоты перенесены в поле `slots`
  записи реестра (`RegistryEntry`); ядро сворачивает их из активного набора
  реактивно, так что появление/исчезновение кнопки точно следует за наличием
  плагина. `setRenderSlot` оставлен как императивный escape для пользовательских
  плагинов (нереактивен по своей природе). Покрыто `CS15` в
  [column-sorting.test.tsx](../../src/lib/stories/__tests__/visual/column-sorting.test.tsx).

## Решения по открытым вопросам

Приняты 2026-09-01, до начала реализации.

- **Миграция → compat-маппер в слое демо, ядро сразу presence-only.** Сначала
  `useCreateTable` временно мапил `enable*`→фабрики внутри ядра (держал оракул
  зелёным во время переноса), затем маппер `enable*`→plugins переехал из ядра в
  слой историй (`__mocks__/utils/argsToPlugins`), а ядро стало принимать только
  `plugins`. Так Storybook сохраняет boolean-тумблеры (демо-контролы), истории и
  тесты гоняют реальный presence-based API, а `enable*` из публичной сигнатуры
  ядра убраны. Тумблер→плагин выражается через `фабрика({ enabled })` — маппер
  живёт в демо, не в ядре.
- **Режим типов → (a) сейчас, (b) потом.** Стартуем с глобальной
  module-augmentation ([`table.d.ts`](../../src/table.d.ts)); per-instance вывод
  из кортежа плагинов (b) — отдельной задачей после инверсии. (b) сразу раздувает
  объём и не блокирует инверсию.
- **Форма state-слайса → единый контракт + escape для пиннинга.** Однородные
  слайсы (sizing/sorting/visibility/expanding/grouping/rowSelection) сеются одним
  обобщённым способом; неоднородные слияния идут через per-plugin коллбэк.
  Пиннинг сервисных колонок — единственное текущее исключение.
- **`common` → внутренний always-on дефолт ядра.** Не входит в список
  потребителя, вклеивается ядром всегда (R5); opt-in касается только фич.
- **`createHooks` → инверсия выполнена (types-mode b).** Хуки не гейтятся
  presence (always-on инфраструктура), но тип хуков теперь выводится per-instance
  из набора `plugins`, а не из глобального агрегата:
  - `PluginsHooks` в ядре — пустой (`Record<never, never>`); импортов плагинов в
    `createHooks` больше нет (R1 = `error` для всего `src/lib/core/**`).
  - Каждая фабрика несёт свой hook-слайс в типе записи
    (`RegistryEntry<THooksSlice>`; `rowSelection(): RegistryEntry<RowSelectionPlugin>`).
    `useCreateTable` выводит `InferPluginHooks<TPlugins>` из кортежа и типизирует
    им параметр `hooks` (`Partial<InferPluginHooks<TPlugins>> & THooks`), а таблицу
    инстанцирует как `useReactTable<…, InferPluginHooks<TPlugins> & THooks, …>` —
    так `table.getHooks()` у потребителя несёт выведенные слайсы. Кастомные хуки
    идут через `THooks`; чужой слайс мягко поглощается в `THooks` (безвредно —
    хуки always-on), но проверка формы известного слайса сохраняется.
  - **Ограничение вывода:** `const TPlugins` выводится только в вызове БЕЗ явных
    generic-аргументов (TS не выводит хвостовой параметр при частично заданных
    дженериках). Для вызовов с явными дженериками именованный агрегат
    `BuiltinPluginsHooks` (= бывший `PluginsHooks`) вынесен во вход
    `@mstrvtt/tessera/plugins` (стрелка вверх, R1-чисто): `useCreateTable<Data,
BuiltinPluginsHooks & MyHooks, …>({ … })`.
  - **Приёмка переформулирована:** символ `PluginsHooks` в `dist` намеренно пуст
    (`{}`) — полный контракт хуков доходит до потребителя через сигнатуру
    `useCreateTable` (presence-based) и через `BuiltinPluginsHooks` из `/plugins`,
    а не через символ `PluginsHooks`. Проверяется мини-пробой из собранного `dist`
    (вывод параметра `hooks` + резолв `BuiltinPluginsHooks` в полный union).
  - `useCreateHooks` — тонкий generic-merge (`<THooks>(hooks: Partial<THooks>)`),
    always-on no-op дефолты остаются в ядре литералами (значения, не импорт → R1).
- **Пиннинг сервисных колонок → политику объявляет плагин, ядро исполняет.**
  Каждая `ServiceColumn` несёт `pin: { side, when }`: `when:'always'` — закреплена
  всегда (колонка действий вправо, независимо от фичи `columnPinning`);
  `when:'with-user'` — присоединяется к блоку, только когда потребитель сам
  закрепил с этой стороны (лидирующие сервисные колонки). Ядро оставляет лишь
  генерик-механику `mergeServiceColumnPinning` (исполнить объявленные `pin`), без
  per-фиче политики; это R1-чисто (ядро не импортит плагины). Отдельный
  `reduceState`-escape не понадобился (YAGNI) — вернём, если появится реальный
  неоднородный merge. `rowActions` полностью вынесена в плагин
  (`@mstrvtt/tessera/plugins`): её колонка, опции (`width`) и автосайз живут в
  `plugins/rowActions`; фабрика `rowActions({ width })` объявляет колонку и `pin`
  (`right/always`). В ядре остаётся лишь id колонки (`ROW_ACTIONS_COLUMN_ID`) и
  предикаты `getIsActionsColumn`/`getIsRowActionsColumn` (always-on `commonPlugin`
  безусловно читает их в grid — плагин в ядро не импортить, R1). Плагин импортит
  id из `core` (стрелка вверх). Автосайз применяется через generic-escape:
  плагин в `setup` вызывает `table.setColumnAutoSizing` — ядровый writer
  авто-слайса размеров (`commonPlugin` вешает его на таблицу; слайс применяется
  поверх даже контролируемого `columnSizing`, поэтому `getInitialState`-seed не
  годился). Writer бейлит при равенстве (идемпотентность `setup`).

## План внедрения

Инвариант плана: **золотой оракул паритета остаётся зелёным на каждом шаге**.
Оракул написан до реализации на старом `enable*`-API и покрывает merge state,
порядок/видимость/пиннинг сервисных колонок и создание колонок (R6/R7/R8/R10);
в фазе миграции меняется только строка сборки, не ожидаемые значения. Уважает
[ADR 0009](0009-test-coverage-visual-and-performance.md).

**Фаза 1 — контракт `RegistryEntry` (аддитивно).** Ввести `ServiceColumn` и
`RegistryEntry` в [`plugins/types.ts`](../../src/lib/plugins/types.ts); каждый
плагин экспортирует фабрику `plugin(opts?) => RegistryEntry` (тонкие опции — в
аргумент фабрики); настоящий вход `@mstrvtt/tessera/plugins` реэкспортит фабрики.
Старый путь остаётся; `tsc` и оракул зелёные.

**Фаза 2 — обобщить ядро (критический путь).** `useCreateColumns` → generic по
`pluginColumns` (сортировка `leading/trailing` по `order`, при равенстве —
позиция в списке; дедуп), плагинов не импортит. `useCreateTable` принимает
`plugins: RegistryEntry[]`, выводит `features`/`pluginColumns`, всегда вклеивает
`common`. `useCreateState` сворачивается в один обобщённый контролируемый
`useState<TableState>` + `onStateChange`; слайсы сеют плагины через
`getInitialState`/`getDefaultOptions`; пиннинг — через коллбэк-escape. Чекпоинт:
юнит-оракул `useCreateState`/`stateSlices` зелёный без правки ассертов.

**Фаза 3 — compat-слой.** `useCreateTable` мапит `enable*` → фабрики. Весь
существующий набор зелёный на инвертированном ядре — это доказательство паритета
(R9).

**Фаза 4 — миграция историй/тестов на presence-based.** Переписать строки сборки
(`enable*` → `plugins: [...]`) в ~22 файлах; **ассерты не трогать**. Оракул
зелёный на новом API.

**Фаза 5 — снять леса.** Удалить `enable*`-флаги
([`createTable/types.ts`](../../src/lib/core/createTable/types.ts)) и compat-слой
(ломающее изменение API, pre-1.0 допустимо). `tsc` и оракул зелёные.

**Фаза 6 — затянуть гейты (выполнено).** Контракт плагинов вынесен из
`plugins/types` в `core/pluginContract` (стрелка зависимости выправлена);
`commonPlugin` и `useRowSelectionReset` перенесены из `plugins/` в ядро
(always-on инфраструктура). R1-правило поднято до `error` для всего
`src/lib/core/**` (включая `createHooks` — см. Фазу 7); R2/R4/R5 покрыты
`composition.test.tsx`, R3 по сути обеспечен R1=`error`. `rowActions` полностью
вынесена в плагин (`@mstrvtt/tessera/plugins`): колонка/опции/автосайз в
`plugins/rowActions`, в ядре — только id + предикаты (см. решение по пиннингу).
Для этого в контракт добавлен generic-escape `RegistryEntry.setup` (императивный
сетап плагина) и ядровый writer `table.setColumnAutoSizing`.

**Фаза 7 — инверсия `createHooks` (types-mode b, выполнено).** `PluginsHooks`
сведён к пустому `Record<never, never>` (импорты плагинов убраны); фабрики несут
hook-слайс через `RegistryEntry<THooksSlice>`; `useCreateTable` выводит тип хуков
из кортежа `plugins` (`InferPluginHooks`) и инстанцирует таблицу выведенными
хуками; агрегат `BuiltinPluginsHooks` вынесен во вход `/plugins` для вызовов с
явными дженериками (см. решение по `createHooks` выше). R1 доведён до `error` и
для `createHooks`. `tsc`/`eslint`/`build` зелёные; presence-вывод и полнота
`BuiltinPluginsHooks` проверены мини-пробой из собранного `dist`.

Осталось отдельными задачами: build-size CI-проверка (R3), миграция доков на API
ADR 0010 (`README.md` и `docs/architecture/table-assembly.md` пока документируют
старый `enable*` + сырой `plugins:[feature]`).
