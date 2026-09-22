# RnD + план работ: освоение стоковых фич TanStack Table v9

**Статус:** исследование + план (RnD-продолжение), не решение. Каждая фаза, если
берётся в работу, фиксируется отдельным ADR (spec-driven,
[ADR 0001](../decisions/0001-spec-driven-development.md)).
**Дата:** 2026-09-19.
**Основано на:** [tanstack-table-v9-migration.md](./tanstack-table-v9-migration.md),
[tanstack-table-v9-migration-plan.md](./tanstack-table-v9-migration-plan.md),
[roadmap](../roadmap.md). Проверено по установленной `@tanstack/react-table@9.2.4`
(bundled skill-доки в `node_modules/@tanstack/table-core/skills/*`).

---

## 1. Главный вывод (TL;DR)

Миграция на v9 — не только перф. В v9 функциональность вынесена в **tree-shakeable
набор стоковых фич**, и там готовым лежит ровно то, что в роадмапе числится как
«критичные разрывы data-layer» и «далее». Эти пункты перешли из режима «строить с
нуля» в режим **«подключить стоковую фичу + собрать UI-слой + контракт совместимости
(ADR 0022) + тесты (ADR 0009)»**.

Наш core уже мигрирован _чисто_: он корректно опирается на разделённые фичи v9
(в v8 они были слиты) — `rowGrouping` использует `rowAggregationFeature`,
`columnSizing` — `columnResizingFeature`, `columnSorting` — `rowSortingFeature`.
Поэтому «переписать дубли» — тонкий слой; основной рычаг — освоение дремлющих фич.

---

## 2. Карта: стоковые фичи v9 ↔ наш код

Полный список стоковых фич — `dist/features/stockFeatures.d.ts`.

| v9-фича                                           | У нас                          | Статус                                   |
| ------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `rowSortingFeature`                               | columnSorting                  | ✅ используется                          |
| `columnGroupingFeature` + `rowAggregationFeature` | rowGrouping                    | ✅ используется                          |
| `columnPinningFeature`                            | columnPinning (always-on)      | ✅                                       |
| `columnSizingFeature` + `columnResizingFeature`   | columnSizing                   | ✅                                       |
| `columnOrderingFeature`                           | columnDragging (+dnd-kit)      | ✅                                       |
| `columnVisibilityFeature`                         | always-on в `core/features.ts` | ✅ фича есть, UI-плагина нет             |
| `rowSelectionFeature`                             | rowSelection                   | ✅                                       |
| `rowExpandingFeature`                             | rowExpanding                   | ✅                                       |
| — (нет фичи v9)                                   | rowDragging                    | ✅ обоснованно кастомный (порядок строк) |
| **`columnFilteringFeature`**                      | —                              | 🔴 дремлет → «Разрыв №1»                 |
| **`globalFilteringFeature`**                      | —                              | 🔴 дремлет → quick-search                |
| **`columnFacetingFeature`**                       | —                              | 🔴 дремлет → set-фильтры/диапазоны       |
| **`rowPaginationFeature`**                        | —                              | 🔴 дремлет → pagination                  |
| **`rowPinningFeature`**                           | —                              | 🔴 дремлет → закреп строк top/bottom     |
| **`cellSelectionFeature`**                        | —                              | 🔴 дремлет → range-выбор/clipboard       |
| **`cellSpanningFeature`**                         | —                              | 🔴 дремлет → объединение ячеек           |

Grep подтвердил: фильтрации/поиска в `src/lib` нет вообще — это чистый пробел, не дубль.

---

## 3. Сквозной Definition of Done (для каждой фазы)

- Плагин оформлен как `TesseraFeatureEntry` (registry.ts), tree-shakeable вход в `plugins`
  ([ADR 0010](../decisions/0010-core-plugins-inversion.md)).
- Строки в матрице совместимости ([ADR 0022](../decisions/0022-plugin-compatibility-contract.md)):
  для каждой пары — «работает как есть / адаптирован (как) / недоступен (инертен + warns)».
- Тесты трёх видов ([ADR 0009](../decisions/0009-test-coverage-visual-and-performance.md)):
  **visual** + **unit-logic** + **perf** (где применимо) + **cross-plugin `X<n>`**
  ([ADR 0023](../decisions/0023-cross-plugin-interactions.md)) для новых связок.
- Перф-гейты не пробиты (методология: prod-сборка `vitest.perf.config.ts`, потолки
  ~2× baseline). Фильтрация/пагинация меняют размер row-model → нужен свой perf-кейс.
- Синхронизированы [roadmap](../roadmap.md) (перенос из «Запланировано»/«Критично» в
  «Сделано») и `docs/architecture/*.md`.
- Бандл-бюджет: новые плагины — opt-in входы, не утяжеляют голый `DataGrid`.

---

## 4. Part A — что поменять в своём коде сейчас

Немного — миграция сделана аккуратно. Реальные пункты:

1. **`columnVisibilityFeature` уже включён always-on, UI-плагина нет.** Скрытие/показ
   колонок «бесплатно» через `column.getCanHide()/toggleVisibility()` — оформить
   лёгкий плагин `columnVisibility` (пункт меню шапки), почти без ядровой работы.
2. **Унифицировать серверную историю.** Сейчас «только серверные sort/expand» (ad-hoc).
   В v9 весь серверный контракт — единое семейство `manual*`
   (`manualSorting/…/manualPagination`) + `rowCount`/`pageCount` (skill
   `client-vs-server`). Привести существующий server sort/expand к этому контракту —
   тогда фильтрация/пагинация лягут туда же без второй архитектуры.
3. Больше «переписать под v9» нет — split-фичи уже адоптированы (долг закрыт при миграции).

---

## 5. Part B / план фаз — что запланировать (теперь дёшево на v9)

Нумерация ADR продолжается с **0027** (последний — 0026, v9). Префиксы требований —
предложение, окончательные выбирает автор; выбраны так, чтобы не сталкиваться с
перф-кейсами `P1..P8`.

### Фаза 0 — Подготовка (enabler, малый риск)

- **0.1 Плагин `columnVisibility`** _(S)_ — см. Part A.1. Обкатка нового плагина на
  готовой фиче.
- **0.2 ADR 0027 — единый серверный контракт `manual*`** _(M)_ — обобщить ad-hoc
  server sort/expand до семейства `manual*` + `rowCount`/`pageCount`. Фундамент под
  фильтрацию и Server-Side Row Model. Требования `SRV<n>`.

### Фаза 1 — Фильтрация (критично, «Разрыв №1») _(L)_

**ADR 0028 — Filtering.** Комплект из трёх стоковых фич; требования `F<n>`.

- **1.1 Column-фильтры** — `columnFilteringFeature` + `createFilteredRowModel()` +
  точечные `filterFn_*` (text/number/date), `filterFn: 'auto'` по типу. Контролируемые
  апдейтеры через `functionalUpdate`. Фильтры ждут comparable-значения аксессора,
  не объекты/ReactNode.
- **1.2 UI фильтров в шапке** — точка в `headerActions` (иконка/поповер на колонку),
  состояние читается из DOM-контракта для тестов.
- **1.3 Quick-search** — `globalFilteringFeature` + `globalFilterFn`; тулбар-поле.
- **1.4 Faceting** — `columnFacetingFeature` + `facetedUniqueValues`/`facetedMinMaxValues`
  для set-фильтров и range-слайдеров.
- **1.5 Клиент/сервер** — путь `manualFiltering` поверх 0.2.
- **1.6 Совместимость** — матрица: фильтр × sorting (порядок стадий row-model),
  × grouping (`filterFromLeafRows`/`maxLeafRowFilterDepth`), × pinning, × rowSelection
  (сохранение выбора при сужении набора).
- **Тесты:** visual (UI, пустой результат), unit-logic (filterFn, faceting, manual-путь),
  perf (скролл/рендер на отфильтрованном большом наборе), `X<n>` (фильтр × grouping,
  фильтр × selection).

### Фаза 2 — Pagination _(M)_

**ADR 0029.** `rowPaginationFeature` + `paginatedRowModel` (client) и `manualPagination`

- `rowCount`/`pageCount` (server, поверх 0.2). Требования `PG<n>`. Отдельно —
  **стыковка с виртуализацией** (страница vs окно), `autoResetPageIndex` при фильтрации.
  UI — контрол пагинации в футере.

### Фаза 3 — Cell/range selection _(M)_

**ADR 0030.** `cellSelectionFeature`. Требования `SEL<n>`. Критичные из skill-дока →
в требования:

- подписка **пер-строка**, не на весь `<tbody>` (драг пишет state на каждой границе —
  иначе перф-регресс);
- рамка через `box-shadow`, не `border` (border меняет layout на border-collapse);
- `autoResetCellSelection` при смене `data`;
- диапазоны привязаны к corner-id → «расползаются» после сортировки/reorder, reset в
  userland (`table.resetCellSelection(true)`);
- clipboard — userland (TSV с квотингом), таблица отдаёт только сырые значения;
- навигация с клавиатуры — userland (`moveCellSelection`/`extendCellSelection`…).
- **Тесты:** visual (рамка/диапазоны), unit-logic (include/exclude геометрия, edges),
  perf (драг по большому окну), `X<n>` (cell-selection × сортировка/reorder).

### Фаза 4 — Row pinning _(S–M)_

**ADR 0031.** `rowPinningFeature` (top/bottom), `keepPinnedRows`. Требования `RP<n>`.
Sticky-CSS переиспользуем из инфраструктуры columnPinning. Матрица: закреп строк ×
фильтрация/пагинация (видимость закреплённых), × grouping.

### Фаза 5 — Cell spanning _(M, ниже приоритетом)_

**ADR 0032.** `cellSpanningFeature` (`spanRows`/`spanColumns`, соглашение covered-cell
= 0). Требования `SPAN<n>`. Подводные: спаны «ломаются» после сортировки/пагинации —
покрыть тестами. Открывает merged-grids и часть истории master-detail.

---

## 6. Порядок и зависимости

```
Фаза 0.2 (manual*) ──┬─→ Фаза 1 (фильтрация) ──→ Фаза 2 (pagination)
Фаза 0.1 (visibility)┘
                        Фаза 3 (cell-selection)   ← независимы от 0.2
                        Фаза 4 (row-pinning)
                        Фаза 5 (cell-spanning)
```

Критический путь ценности: **0.2 → 1 → 2**. Фазы 3–5 ведутся параллельно/в любом
порядке — от фильтрации не зависят.

## 7. Грубая оценка

| Фаза                 | Размер | Риск                                              |
| -------------------- | ------ | ------------------------------------------------- |
| 0.1 visibility       | S      | низкий                                            |
| 0.2 manual* контракт | M      | средний (трогает существующий server sort/expand) |
| 1 фильтрация         | L      | средний (3 фичи + матрица)                        |
| 2 pagination         | M      | средний (виртуализация)                           |
| 3 cell-selection     | M      | средний (перф драга)                              |
| 4 row-pinning        | S–M    | низкий                                            |
| 5 cell-spanning      | M      | средний (стабильность спанов)                     |

---

## 8. Первый шаг

Логичный старт — **ADR 0027 (`manual*`)** или сразу **ADR 0028 (фильтрация)** со
спецификацией и списком требований `F<n>`.
