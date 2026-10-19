# 0014 — Выбор строк: плагин rowSelection

- **Статус:** Принято
- **Дата:** 2026-09-01
- **Изменено:** [ADR 0126](0126-cell-fill-precedence.md) (2026-10-19) — выбор — слой поверх фона строки; закреплённые ячейки берут тот же слой.
- **Изменено:** [ADR 0120](0120-model-and-interface-plugins.md) (2026-10-16) — модель выбора —
  плагин `rowSelectionModel` (`subRows`, запрет при группировке, срез `rowSelection` аргументами;
  вид выбранной строки и `aria-selected` — у модели); `rowSelection` её включает и добавляет
  колонку флажков, Space, счётчик и колбэки.
- **Изменено:** [ADR 0099](0099-perf-gates-and-ab-compare.md) (2026-10-12) — перф-требования I1, I2: гейт против базы того же теста вместо абсолютного порога или только замер против цели RAIL.
- **Связано:**
  - [ADR 0004](0004-core-on-tanstack-table.md) — плагин построен на штатной
    модели выбора TanStack (`enableRowSelection` / `enableSubRowSelection`, срез
    `rowSelection`, `row.getIsSelected` / `getIsSomeSelected` /
    `getToggleSelectedHandler`, `table.getIsAllPageRowsSelected` /
    `getIsSomePageRowsSelected` / `getToggleAllPageRowsSelectedHandler`,
    `table.resetRowSelection`).
  - [ADR 0026](0026-migrate-to-tanstack-v9.md) — чекбоксы шапки и строк подписаны на
    срез выбора через `useSelector` (TanStack Store), а не на глобальный ре-рендер.
  - [ADR 0009](0009-test-coverage-visual-and-performance.md) — покрытие
    визуальными + перформанс-тестами; требования (`RS<n>`) кодируются тестами, а
    состояние читается из контракта DOM (запрет хардкода мок-данных).
  - [ADR 0038](0038-pagination-and-status-bar.md) — счётчик выбранных строк в
    нижней панели (опция `selectedCount`, RS19–RS22).
  - [ADR 0011](0011-column-pinning.md), [ADR 0012](0012-column-sorting.md),
    [ADR 0013](0013-column-sizing.md) — общий с пиннингом, сортировкой и
    ресайзом приём: плагин — это `TableFeature`, служебный столбец инъектируется
    в сборке колонок, а состояние выражено атрибутами ячейки.

> **Обновление ([ADR 0010](0010-invert-core-plugins-registry.md)).** Активация
> через флаг `enableRowSelection` у `useCreateTable` заменена presence-based
> композицией: плагин включается фабрикой `rowSelection({ subRows })` в массиве
> `plugins`. Упомянутые ниже `enableRowSelection`/`enableSubRowSelection` остаются
> TanStack-опциями, которые фабрика проставляет сама (`RegistryEntry.options`). Тип
> хуков плагина (`rowSelection`) выводится из набора `plugins` (`InferPluginHooks`).
>
> **Механика ниже приведена к v9** ([ADR 0026](0026-migrate-to-tanstack-v9.md)): жизненный
> цикл фичи — `constructTableAPIs`/`assign*Prototype`, реактивность — `useSelector`
> (TanStack Store, `table.atoms`); гейт группировки — функциональный `enableRowSelection`.

## Контекст

Потребителям нужно выбирать строки — по одной чекбоксом в строке, все на
странице чекбоксом в шапке, а также каскадом по дереву (родитель ↔ потомки).
Выбор должен быть виден (маркер строки, состояние чекбокса: снят / выбран /
частично) и отдавать наружу событие выбора для внешней бизнес-логики (панель
пакетных действий, серверный «выбрать всё»).

TanStack Table v9 несёт готовую модель выбора: срез `rowSelection`, опции
`enableRowSelection` / `enableSubRowSelection`, методы строки (`getIsSelected`,
`getIsSomeSelected`, `getCanSelect`, `getCanSelectSubRows`,
`getToggleSelectedHandler`) и таблицы (`getIsAllPageRowsSelected`,
`getIsSomePageRowsSelected`, `getToggleAllPageRowsSelectedHandler`,
`resetRowSelection`). Но она про **состояние выбора и его математику**, а не про
рендер: сам служебный столбец с чекбоксами, чекбокс «выбрать все на странице» в
шапке, маркировку выбранной строки, режим блокировки при внешнем «выбрать всё» и
точки расширения надо построить поверх.

Этот ADR — единый источник истины по выбору строк в Tessera. Он фиксирует и
**решение** (что выбор строим на штатной модели TanStack, а не на своей), и
**как** оно реализовано плагином `rowSelection`: инъекцию служебного столбца,
чекбоксы шапки и строки, каскад по поддереву, блокировку при внешнем «выбрать
всё» и точки расширения, — плюс таблицу требований (RS1–RS18) со ссылками на
тесты.

## Решение

### Опора на штатную модель TanStack

Выбор опирается на встроенную модель TanStack Table
([ADR 0004](0004-core-on-tanstack-table.md)). Плагин не хранит собственного
состояния выбора — он читает `row.getIsSelected()` / `getIsSomeSelected()` /
`getCanSelect()` / `getCanSelectSubRows()` и делегирует переключение
`row.getToggleSelectedHandler()`, а «выбрать все на странице» —
`table.getToggleAllPageRowsSelectedHandler()`. Выбор возвращается в дерево через
штатный срез `rowSelection` (`core/createState.ts`); каскад по
поддереву обеспечивает сам TanStack при `enableSubRowSelection`.

Опции `useCreateTable` мапятся на штатные напрямую:

- **`enableRowSelection`** → `enableRowSelection` (по умолчанию `false`);
- **`enableSubRowSelection`** → `enableSubRowSelection` — включает выбор
  дочерних строк и каскад родитель ↔ потомки.

При смене этих флагов выбор сбрасывается: `useCreateTable` (`core/useCreateTable.ts`)
в `useEffect` зовёт `table.resetRowSelection(true)` по изменению
`enableRowSelection` / `enableSubRowSelection` / `manualExpanding`.

### Форма плагина

`rowSelection` (`src/lib/plugins/rowSelection/registry.ts`) — фабрика записи
`TesseraFeatureEntry`. Поведение даёт встроенная `rowSelectionFeature`; гейт
группировки (ADR 0022) — функциональный `enableRowSelection`. UI **не** вешается
хуками жизненного цикла: `renderComponent` (`HeadSelectionComponent` для шапки,
`RowSelectionComponent` для ячейки) **запечён в дефиниции служебного столбца**
(`getRowSelectionColumn`). Признак «есть ли выбираемая строка» (для блокировки
чекбокса шапки) в v9 даёт хелпер `getCanSomeRowsSelect(table)` (был Tessera-метод
`table.getCanSomeRowsSelect`).

Служебный столбец выбора инъектируется **не** плагином напрямую, а сборкой колонок
(`injectServiceColumns`, `core/createColumns`): запись приносит столбец в
`entry.column` (`getRowSelectionColumn`), а сборка раскладывает его ведущим (по
`side`/`order`). Столбец служебный (`getActionColumnId('rowSelection')`,
`enablePinning: false`, `enableSorting: false`, `enableResizing: false`,
`enableDragging: false`) и при многоуровневой шапке разворачивается в группу нужной глубины.

### Чекбоксы шапки и строки

Оба построены на общем `SelectCheckbox` (`SelectCheckbox.tsx`, примитив Base UI
`Checkbox`, иконки `checkboxChecked` / `checkboxIndeterminate` через `useIcons`
— переопределяемы) и подписаны на срез выбора через `useSelector`
(TanStack Store):

- **`RowSelectionComponent`** (ячейка) — подписан на `getIsSelected()`,
  `getIsSomeSelected()`, `getCanSelect()`, `getCanSelectSubRows()`. Клик зовёт
  `row.getToggleSelectedHandler()` и следом hook `onSelectRow(row, selected)`.
  Чекбокс `indeterminate`, когда выбрана часть потомков (`getIsSomeSelected()`).
  Для дочерней строки (`row.depth > 0`) чекбокс не рендерится, если выбор
  поддерева выключен (`!getCanSelectSubRows()`).
- **`HeadSelectionComponent`** (шапка) — подписан на `getIsAllPageRowsSelected()`,
  `getIsSomePageRowsSelected()`, `getCanSomeRowsSelect()`. Клик зовёт
  `table.getToggleAllPageRowsSelectedHandler()` и следом hook
  `onSelectAllRowsOnPage(selected)`. Чекбокс `checked`, когда выбраны все строки
  страницы, и `indeterminate`, когда часть.

### Блокировка при внешнем «выбрать всё»

Hook `isAllRowsSelected` — флаг режима «выбрано всё поверх страниц» (например,
через панель пакетных действий и серверный выбор). Когда он `true`, отдельные
чекбоксы строк и чекбокс шапки становятся `disabled`: локальный выбор в UI
блокируется, пока действует серверный «выбрать всё». (Пометка `TODO` в коде —
перенести флаг из hooks в state таблицы; на контракт это не влияет.)

### Контракт DOM

Состояние выбора выражено в разметке — seam, за который цепляются и доступность,
и тесты (см. [ADR 0009](0009-test-coverage-visual-and-performance.md) про запрет
хардкода мок-данных: состояние читается из атрибутов, а не из литералов мока):

- **`data-selected` на `role="row"`** (`BodyRow.tsx`) — `row.getIsSelected()`;
  реактивен (`useSelector`). На нём `BodyRow.module.css` кладёт поверх фона строки
  слой выбора (`--tsr-comp-row-selected-bg`, при наведении —
  `--tsr-comp-row-selected-hovered-bg`; [ADR 0126](0126-cell-fill-precedence.md)).
- **`data-checked` / `data-indeterminate` / `data-unchecked` на чекбоксе**
  (`.row-select-checkbox`) — состояние, которое проставляет Base UI Checkbox;
  блокировка — нативным `disabled` / `data-disabled`.
- **`data-actions-column-cell='true'` и `data-column-id` =
  `actionColumn__rowSelection`** на ячейке служебного столбца выбора — дают
  тестам и потребителю адресовать столбец, а также маркируют его как служебный
  (не сортируемый / не ресайзабельный / не закрепляемый / не перетаскиваемый).

### Точки расширения

- **`onSelectRow(row, selected)`** — hook, вызываемый при переключении одной
  строки, с самой строкой и её **следующим** состоянием выбора.
- **`onSelectAllRowsOnPage(selected)`** — hook, вызываемый при переключении
  «выбрать все на странице», со следующим состоянием.
- **`isAllRowsSelected`** — вход, включающий режим блокировки локального выбора.

Все три (дефолты — no-op / `false`) позволяют потребителю среагировать на выбор
(панель пакетных действий, серверный «выбрать всё», аналитика), не перехватывая
сам контракт `onRowSelectionChange`.

## Последствия

- **+** Выбор опирается на штатную, проверенную модель TanStack — свой «источник
  истины» по выбору и каскаду по поддереву не заводится.
- **+** Служебный столбец переиспользует общий механизм инъекции служебных
  колонок и `renderComponent`; чекбокс — общий переопределяемый `SelectCheckbox`.
- **+** Реактивность гранулярна: чекбоксы и строки подписаны на срез выбора через
  `useSelector` (TanStack Store), а не перерисовываются глобально.
- **+** Режим `isAllRowsSelected` даёт чистый шов для серверного «выбрать всё» без
  раздувания клиентского среза выбора.
- **−** Флаг `isAllRowsSelected` пока живёт в `hooks`, а не в `state` таблицы
  (помечено `TODO`); это внутренняя деталь, контракт UI она не меняет.
- **−** Чекбокс шапки выбирает строки **текущей страницы**
  (`getToggleAllPageRowsSelectedHandler`), а не весь набор поверх страниц —
  выбор всего набора остаётся за внешним `isAllRowsSelected`.

## Требования и покрытие тестами

Критерии приёмки, которые кодируют тесты. По конвенции проекта
([ADR 0001](0001-spec-driven-development.md),
[ADR 0009](0009-test-coverage-visual-and-performance.md)) каждое требование —
**отдельный именованный тест** с ID-префиксом `RS<n>:`, совпадающим с ID из
таблиц ниже. Визуальные тесты живут в
`stories/__tests__/visual/row-selection.test.tsx` (vitest-browser, реальный
Chromium), перформанс — кейсы выбора I1–I2 в перф-матрице
(`stories/__tests__/performance/`, см.
[ADR 0009](0009-test-coverage-visual-and-performance.md)).

**Активация и служебный столбец**

| ID  | Требование                                                                                           | Тест                                       |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| RS1 | Плагин инертен без `enableRowSelection`: служебного столбца и чекбоксов нет                          | ✔ `RS1: the plugin is inert …`             |
| RS2 | При `enableRowSelection` добавляется ведущий служебный столбец с чекбоксом в шапке и в каждой строке | ✔ `RS2: enabling adds a leading service …` |
| RS3 | Служебный столбец выбора не сортируемый / не ресайзабельный / не закрепляемый / не перетаскиваемый   | ✔ `RS3: the selection column is not …`     |

**Чекбокс строки**

| ID  | Требование                                                                                    | Тест                                        |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| RS4 | Клик по чекбоксу строки выбирает строку (чекбокс `checked`, строка `data-selected='true'`)    | ✔ `RS4: clicking a row checkbox selects …`  |
| RS5 | Повторный клик снимает выбор строки (самовосстановление)                                      | ✔ `RS5: clicking a selected row checkbox …` |
| RS6 | Переключение строки зовёт hook `onSelectRow(row, selected)` со строкой и следующим состоянием | ✔ `RS6: toggling a row calls …`             |
| RS7 | Выбранная строка визуально маркируется отдельным фоном                                        | ✔ `RS7: a selected row is visually …`       |

**Чекбокс шапки (выбрать все на странице)**

| ID   | Требование                                                               | Тест                                       |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------ |
| RS8  | Клик по чекбоксу шапки выбирает все строки страницы                      | ✔ `RS8: the header checkbox selects …`     |
| RS9  | Когда выбраны все строки страницы — чекбокс шапки `checked`              | ✔ `RS9: when all page rows are selected …` |
| RS10 | Когда выбрана часть строк — чекбокс шапки `indeterminate` (иконка minus) | ✔ `RS10: when only some page rows …`       |
| RS11 | Переключение шапки зовёт hook `onSelectAllRowsOnPage(selected)`          | ✔ `RS11: toggling the header calls …`      |
| RS12 | Клик по `checked`-шапке очищает выбор страницы                           | ✔ `RS12: clicking a checked header …`      |

**Блокировка при внешнем «выбрать всё»**

| ID   | Требование                                               | Тест                                       |
| ---- | -------------------------------------------------------- | ------------------------------------------ |
| RS13 | При `isAllRowsSelected` каждый чекбокс строки `disabled` | ✔ `RS13: with `isAllRowsSelected` every …` |
| RS14 | При `isAllRowsSelected` чекбокс шапки `disabled`         | ✔ `RS14: with `isAllRowsSelected` the …`   |

**Внешний вид**

| ID   | Требование                      | Тест                                    |
| ---- | ------------------------------- | --------------------------------------- |
| RS15 | Индикатор-иконка чекбокса 14×14 | ✔ `RS15: the checkbox indicator icon …` |

**Выбор поддерева**

| ID   | Требование                                                                         | Тест                                        |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| RS16 | Без `enableSubRowSelection` дочерние строки не получают чекбокса                   | ✔ `RS16: without `enableSubRowSelection` …` |
| RS17 | С `enableSubRowSelection` выбор родителя каскадирует на потомков                   | ✔ `RS17: selecting a parent cascades …`     |
| RS18 | С `enableSubRowSelection` частичный выбор потомков делает родителя `indeterminate` | ✔ `RS18: a partial child selection …`       |

**Производительность** (`performance/interaction.test.tsx`)

| ID  | Требование                                                                                                           | Тест   |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| I1  | Выбор строки на небольшой выборке со всеми плагинами — замер против цели Response (INP) пишется в дашборд (ADR 0099) | ✔ `I1` |
| I2  | Выбор строки на большой выборке со всеми плагинами — замер против цели Response (INP) пишется в дашборд (ADR 0099)   | ✔ `I2` |

См. [plugins-and-slots.md](../architecture/plugins-and-slots.md) про механизм
плагинов и `renderComponent` и [rendering.md](../architecture/rendering.md) про
рендер ячеек и строк.
