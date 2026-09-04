# 0012 — Сортировка столбцов: плагин columnSorting

- **Статус:** Принято
- **Дата:** 2026-09-01
- **Связано:**
  - [ADR 0004](0004-core-on-tanstack-table.md) — плагин построен как слот поверх
    штатной модели сортировки TanStack (`getSortedRowModel`, `column.getIsSorted`,
    `column.getToggleSortingHandler`).
  - [ADR 0007](0007-reactivity-pubsub.md) — affordance подписан на срез сортировки
    столбца через `useSubscribeStore`, а не на глобальный ре-рендер.
  - [ADR 0009](0009-test-coverage-visual-and-performance.md) — покрытие
    визуальными + перформанс-тестами; требования (`CS<n>`) кодируются тестами.
  - [ADR 0011](0011-column-pinning.md) — общий с пиннингом контракт affordance в
    шапке: слот `rightHeaderSlot`, кнопка-иконка, видимость по наведению через
    `buttonVisibility.css`.

> **Обновление ([ADR 0010](0010-invert-core-plugins-registry.md)).** Активация
> через флаг `enableColumnSorting` у `useCreateTable` заменена presence-based
> композицией: плагин включается фабрикой `columnSorting({ removal, server })` в
> массиве `plugins` (тонкие опции — аргумент фабрики). Упомянутые ниже `enable*`
> остаются TanStack-опциями, которые фабрика проставляет сама
> (`RegistryEntry.options`). Тип хуков плагина выводится из набора `plugins`
> (`InferPluginHooks`). Текст ниже отражает исходное решение и сохранён как история.

## Контекст

Потребителям нужно сортировать грид по столбцу прямо из шапки — с понятным
индикатором текущего направления и предсказуемым циклом переключения. TanStack
Table v8 несёт готовую модель сортировки (`sorting`-state, `column.getIsSorted()`,
`column.getNextSortingOrder()`, `column.getToggleSortingHandler()`,
`getSortedRowModel`), но она про **состояние и модель строк**, а не про рендер:
affordance в шапке, иконку направления, тултип следующего действия и опциональную
серверную сортировку надо построить поверх.

Этот ADR — единый источник истины по сортировке столбцов в Tessera. Он фиксирует
и **решение** (что сортировку строим на штатной модели TanStack, а не на своей),
и **как** оно реализовано плагином `columnSorting`: активацию, кнопку-affordance
в шапке, цикл направлений, серверный режим и точку расширения, — плюс таблицу
требований (CS1–CS13) со ссылками на тесты.

## Решение

### Опора на штатную модель TanStack

Сортировка опирается на встроенную модель TanStack Table
([ADR 0004](0004-core-on-tanstack-table.md)). Плагин не хранит собственное
состояние сортировки — он читает `column.getIsSorted()` /
`column.getNextSortingOrder()` / `column.getCanSort()` и делегирует переключение
`column.getToggleSortingHandler()`. Состояние возвращается потребителю через
штатный контракт `sorting` / `onSortingChange`.

Опции `useCreateTable` мапятся на штатные напрямую
(`core/createTable/useCreateTable.ts`):

- **`enableColumnSorting`** → `enableSorting` (по умолчанию `false`);
- **`enableSortingRemoval`** → `enableSortingRemoval` (по умолчанию `true`);
- **`serverColumnSorting`** → `manualSorting` (по умолчанию `false`);
- зафиксирован **`sortDescFirst: true`** — первый клик по несортированному
  столбцу даёт `desc`, не `asc`.

### Форма плагина

`columnSortingPlugin` (`src/lib/plugins/columnSorting/columnSortingPlugin.tsx`) —
всегда инъектируемая базовая фича (`TablePlugin`), построенная на конвенциях
`TablePlugin` + слоты ([plugins-and-slots.md](../architecture/plugins-and-slots.md)).
Единственный хук — **`createTable`**, регистрирующий UI-affordance слотом
`rightHeaderSlot` (`order: 1`, сразу за пиннингом — `order: 0`):

```ts
table.setRenderSlot({
  id: 'columnSortingPlugin',
  slot: 'rightHeaderSlot',
  order: 1,
  component: ColumnSortingComponent,
})
```

Плагин делает что-либо только когда столбец сортируем: `ColumnSortingComponent`
рендерит **ничего**, если `column.getCanSort()` === `false` (в т. ч. когда
`enableColumnSorting` выключено — тогда штатный `getCanSort()` = `false`).

### Affordance в шапке

`ColumnSortingComponent` (`ColumnSortingComponent.tsx`) — компонент слота. Он
подписывается на срез сортировки столбца через `useSubscribeStore`
([ADR 0007](0007-reactivity-pubsub.md)) — `getIsSorted()`,
`getNextSortingOrder()`, `getCanSort()`, `enableSorting`,
`enableSortingRemoval` — и рендерит `SortButton`:

```tsx
if (!column.getCanSort()) return null

const operation = column.getIsSorted()
const nextOperation = column.getNextSortingOrder()

const onSort = (event) => {
  const { onToggleColumnSort } = table.getHooks().columnSorting
  column.getToggleSortingHandler()?.(event)
  onToggleColumnSort(column.id, nextOperation)
}
```

`SortButton` (`SortButton.tsx`):

- **иконка направления** (16×16), переопределяема через
  `<DataGrid icons={{ sort, sortAsc, sortDesc }} />`:
  - `asc` → `sortAsc` (по умолчанию lucide `ChevronUp`);
  - `desc` → `sortDesc` (по умолчанию `ChevronDown`);
  - не отсортировано → `sort` (по умолчанию `ChevronsUpDown`);
- в отсортированном состоянии кнопка красится в активный цвет
  (`SortButton.module.css`: `.sorted { color: var(--data-grid-control-active-color) }`)
  и несёт `data-button-active` = `true`;
- **тултип описывает следующее действие** (из локализации):
  не отсортировано → `sortDescending`; отсортировано `desc` → `sortAscending`;
  отсортировано `asc` при `enableSortingRemoval` → `clearSort`; при отключённом
  удалении сортировки цикл не даёт `clearSort` — тултип возвращается к
  `sortDescending`;
- **видимость только при наведении для несортированного столбца** — кнопка
  присутствует в DOM всегда, но скрыта `opacity: 0` до наведения на ячейку
  заголовка (общая конвенция `cell__button--hidden`,
  `grid/cellControls/buttonVisibility.css`). Как только столбец отсортирован
  (`data-button-active='true'`), кнопка-индикатор остаётся видимой без наведения —
  так текущее направление сортировки читается всегда.

### Контракт DOM

Состояние сортировки выражено в разметке ячейки заголовка — это seam, за который
цепляются и доступность, и тесты (см.
[ADR 0009](0009-test-coverage-visual-and-performance.md) про запрет хардкода
мок-данных: направление читается из атрибута, а не из класса иконки или текста
мока):

- **`aria-sort` на `role="columnheader"`** (`HeadCell.tsx`, `getAriaSort`) —
  проставляется только на сортируемом столбце: `ascending` / `descending` по
  текущему направлению, иначе `none`; на несортируемом столбце атрибут опускается.
  `HeadCell` подписан на `column.getIsSorted()` / `column.getCanSort()` через
  `useSubscribeStore` ([ADR 0007](0007-reactivity-pubsub.md)), поэтому атрибут
  обновляется реактивно при переключении.
- **`data-column-id` на ячейках шапки, тела и футера** (`HeadCell` / `BodyCell` /
  `FooterCell`) — логический id столбца (`column.id`). Даёт тестам и потребителю
  адресовать столбец по стабильному id, а не позиционно (`aria-colindex`) и не по
  тексту заголовка.

### Цикл направлений

Цикл задаётся штатным `getNextSortingOrder()` при `sortDescFirst: true`:

- **`enableSortingRemoval: true`** (по умолчанию): не отсортировано → `desc` →
  `asc` → не отсортировано;
- **`enableSortingRemoval: false`**: не отсортировано → `desc` → `asc` → `desc`
  (сортировка никогда не снимается кликом).

### Клиентская и серверная сортировка

По умолчанию строки сортирует сам грид (`getSortedRowModel`). При
**`serverColumnSorting`** (`manualSorting: true`) TanStack **не** переупорядочивает
строки — порядок строк остаётся исходным, владелец сортировки внешний. При этом
клик по-прежнему обновляет состояние сортировки (`getIsSorted()` меняется,
индикатор активен) и вызывает hook — потребитель перезапрашивает данные сам.

### Точка расширения

`ColumnSortingPluginParams.onToggleColumnSort(id, sortDirection)` — hook плагина,
вызываемый после переключения с id столбца и **следующим** направлением (дефолт —
no-op). Позволяет потребителю среагировать на сортировку (аналитика, серверный
перезапрос, персистенция), не перехватывая сам контракт `onSortingChange`.

## Последствия

- **+** Сортировка опирается на штатную, проверенную модель TanStack — свой
  «источник истины» по состоянию не заводится.
- **+** Affordance переиспользует общий с пиннингом контракт шапки (слот, иконка,
  видимость по наведению) — единообразие и меньше кода.
- **+** Индикатор направления остаётся видимым для отсортированного столбца —
  состояние читается без наведения.
- **+** Серверный режим (`serverColumnSorting`) отдаёт порядок строк наружу без
  переделки affordance.
- **−** UI переключает одно направление за клик по фиксированному циклу
  (`sortDescFirst`); альтернативные жесты (напр. отдельная кнопка сброса) в
  affordance не выведены.
- **−** Мульти-сортировка (несколько столбцов) опирается на штатное поведение
  TanStack и не имеет собственного UI-приоритета/порядкового индикатора в шапке.

## Требования и покрытие тестами

Критерии приёмки, которые кодируют тесты. По конвенции проекта
([ADR 0001](0001-spec-driven-development.md),
[ADR 0009](0009-test-coverage-visual-and-performance.md)) каждое требование —
**отдельный именованный тест** с ID-префиксом `CS<n>:`, совпадающим с ID из
таблиц ниже. Визуальные тесты живут в
`stories/__tests__/visual/column-sorting.test.tsx` (vitest-browser, реальный
Chromium), перформанс-покрытие даёт кейс сортировки в общей перф-матрице
(`stories/__tests__/performance/`, см. [ADR 0009](0009-test-coverage-visual-and-performance.md)).

**Активация и affordance**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CS1  | Плагин инертен без `enableColumnSorting` (нет кнопок сортировки, порядок строк исходный)         | ✔ `CS1: the plugin is inert …`         |
| CS2  | При `enableColumnSorting` каждый сортируемый столбец получает кнопку в правой части шапки        | ✔ `CS2: each sortable data column …`   |
| CS3  | Иконка кнопки — 16×16                                                                           | ✔ `CS3: the sort icon is 16×16`        |
| CS4  | Кнопка несортированного столбца скрыта (`opacity: 0`), пока на заголовок не наведён курсор        | ✔ `CS4: … hidden … until … hovered`    |
| CS5  | Кнопка проявляется при наведении на заголовок                                                   | ✔ `CS5: … revealed on header hover`    |
| CS6  | Кнопка отсортированного столбца остаётся видимой без наведения (`data-button-active='true'`)      | ✔ `CS6: a sorted column's button …`    |

**Тултип и индикатор направления**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CS7  | Тултип описывает следующее действие: `Sort descending` → `Sort ascending` → `Clear sorting`     | ✔ `CS7: the tooltip describes …`       |
| CS8  | Иконка отражает текущее направление: `sortDesc` для `desc`, `sortAsc` для `asc`, `sort` иначе    | ✔ `CS8: the icon reflects …`           |
| CS14 | Сортируемый заголовок несёт `aria-sort` (`none`/`ascending`/`descending`); несортируемый — нет   | ✔ `CS14: a sortable header exposes …`  |

**Переключение состояния**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CS9  | Клик циклит `aria-sort` `none → descending → ascending → none` при `sortDescFirst` и `enableSortingRemoval` | ✔ `CS9: clicking cycles …`   |
| CS10 | При `enableSortingRemoval: false` цикл не снимает сортировку (`descending → ascending → descending`) | ✔ `CS10: … removal disabled …`     |
| CS11 | Переключение вызывает hook `onToggleColumnSort(id, next)` с id (из `data-column-id`) и следующим направлением | ✔ `CS11: … calls `onToggleColumnSort`` |

**Модель строк**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CS12 | Клиентская сортировка переупорядочивает строки (`desc` — по убыванию, `asc` — по возрастанию)   | ✔ `CS12: sorting reorders rows …`      |
| CS13 | При `serverColumnSorting` клик не переупорядочивает строки, но меняет состояние и зовёт hook      | ✔ `CS13: server sorting keeps order …` |

См. [plugins-and-slots.md](../architecture/plugins-and-slots.md) про механизм
плагинов и слотов и [rendering.md](../architecture/rendering.md) про рендер ячеек.
