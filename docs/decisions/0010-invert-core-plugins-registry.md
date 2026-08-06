# 0010 — Инверсия core ↔ plugins: composable-плагины (presence-based)

- **Статус:** Рассматривается
- **Дата:** 2026-08-06

## Контекст

Плагины Tessera — это TanStack `TableFeature` ([ADR 0004](0004-core-on-tanstack-table.md)),
собираемые в `useReactTable` через `_features`. Но стрелка зависимости смотрит
**вниз**: слой `core` импортирует конкретные плагины пофамильно, и вклад одного
плагина размазан по нескольким местам ядра:

| Точка в core                                                                 | Что захардкожено                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`useCreateTable`](../../src/lib/core/createTable/useCreateTable.ts)         | список из 9 плагинов в `_features`                        |
| [`useCreateColumns`](../../src/lib/core/createColumns/useCreateColumns.ts)   | импорт фабрик сервисных колонок + `if (enable…) unshift/push` |
| [`useCreateState`](../../src/lib/core/createState/useCreateState.ts)         | вся ручная сборка `state`/`handlers` по каждому плагину    |
| [`createHooks/types`](../../src/lib/core/createHooks/types.ts)               | `PluginsHooks` — статическое пересечение hook-контрактов   |

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

**Что в жизненный цикл не влезает.** Инъекция *набора* колонок — pre-table:
колонки приходят в таблицу готовыми, а `TableFeature` работает после
конструирования. В TanStack v8 нет фичевого хука «добавить колонку». Поэтому
сборка колонок обязана жить до `useReactTable` и требует привязки «плагин → его
сервисная колонка», читаемой на этапе сборки.

## Решение

Перейти на **presence-based композицию**: встроенные плагины импортируются
потребителем **отдельно** и передаются явным списком; **наличие = включено**.

```ts
import { useCreateTable } from '@mstrvtt/tessera'
import { rowSelection, rowExpanding, columnSorting } from '@mstrvtt/tessera/plugins'

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
  make: (maxDepthColumns: unknown[]) => AccessorKeyColumnDef<any>
  side: 'leading' | 'trailing'
  order: number
}

export interface RegistryEntry {
  id: string
  feature: TablePlugin // = TanStack TableFeature, не меняется
  column?: ServiceColumn // опционально — не у всех фич есть колонка
}
```

```ts
// plugins/rowSelection/index.ts
export const rowSelection = (opts?: RowSelectionOptions): RegistryEntry => ({
  id: 'rowSelection',
  feature: rowSelectionPlugin,
  column: { make: getRowSelectionColumn, side: 'leading', order: 1 },
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
> ([visual-tests.md](../architecture/visual-tests.md)).

**Инверсия и композиция**

| ID  | Требование                                                                                              | Тест                                  |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| R1  | `core` (`createTable`/`createColumns`/`createState`/`createHooks`) не импортирует ни один конкретный плагин | — покрыть (lint-правило на импорты)   |
| R2  | Добавление плагина не требует правок файлов `core` — только новая фабрика-запись                         | — покрыть                             |
| R3  | Плагины, не импортированные потребителем, отсутствуют в его бандле (tree-shaking)                        | — покрыть (build-size проверка)       |
| R4  | Пользовательский плагин приносит `feature`, `column` и state-слайс тем же способом, что встроенный        | — покрыть                             |
| R5  | `common` присутствует всегда, независимо от переданного списка                                           | — покрыть                             |

**Колонки и порядок**

| ID  | Требование                                                                                              | Тест         |
| --- | ------------------------------------------------------------------------------------------------------- | ------------ |
| R6  | Порядок сервисных колонок по умолчанию задаётся полем `order` записи; при равенстве — по позиции в списке | — покрыть    |
| R7  | Потребитель может переопределить фактический порядок (включая сервисные колонки) через `columnOrder`      | — покрыть    |
| R8  | Инъекция сервисной колонки гейтится наличием плагина в списке (нет плагина — нет колонки)                 | — покрыть    |

**Паритет поведения**

| ID  | Требование                                                                                              | Тест                          |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------- |
| R9  | Эквивалентный набор плагинов даёт поведение, идентичное текущему (существующие визуальные тесты зелёные) | ✔ существующие спеки плагинов  |
| R10 | Логика state сохранена: merge пиннинга, сев видимости сервисных колонок, приоритет external-vs-core      | — покрыть                     |

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

## Открытые вопросы

- **Миграция:** жёсткий разрыв (pre-1.0 допустимо) vs тонкий compat-слой,
  временно мапящий `enable*` → соответствующие фабрики.
- **Режим типов:** стартовать с (a) глобальной module-augmentation
  ([`table.d.ts`](../../src/table.d.ts)) и перейти к (b) per-instance выводу из
  кортежа плагинов позже — vs целиться в (b) сразу. Presence-based тяготеет к (b).
- **Форма state-слайса:** единый обобщённый контракт vs per-плагин коллбэки для
  нестандартных слияний (пиннинг — главный кандидат на исключение).
- **`common` и другой инфраструктурный код:** остаётся внутренним дефолтом ядра
  или выносится в явный, но всегда-включённый baseline.
