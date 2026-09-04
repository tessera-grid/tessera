# 0011 — Закрепление столбцов: плагин columnPinning

- **Статус:** Принято
- **Дата:** 2026-08-07
- **Связано:**
  - [ADR 0004](0004-core-on-tanstack-table.md) — плагин построен как TanStack
    `TableFeature` поверх штатной модели `columnPinning`.
  - [ADR 0006](0006-dnd-with-dnd-kit.md) — закреплённый столбец нельзя
    перетаскивать (`columnDragging`, требование D29); тот же жёсткий гейт на
    многоуровневые заголовки.
  - [ADR 0009](0009-test-coverage-visual-and-performance.md) — покрытие
    визуальными + перформанс-тестами; требования (`CP<n>`) кодируются тестами.
  - [ADR 0010](0010-invert-core-plugins-registry.md) — merge-логика пиннинга и
    сев видимости сервисных колонок — один из «неоднородных» слайсов state,
    отмеченных как исключение при инверсии ядра.

> **Обновление ([ADR 0010](0010-invert-core-plugins-registry.md)).** Активация
> через флаг `enableColumnPinning` у `useCreateTable` заменена presence-based
> композицией: плагин включается фабрикой `columnPinning()` в массиве `plugins`.
> Упомянутые ниже `enable*` остаются TanStack-опциями, которые фабрика проставляет
> сама (`RegistryEntry.options`). Тип хуков плагина выводится из набора `plugins`
> (`InferPluginHooks`). Текст ниже отражает исходное решение и сохранён как история.

## Контекст

Потребителям нужно удерживать значимые столбцы (идентификатор строки, статус,
столбец действий) в поле зрения при горизонтальной прокрутке широкого грида.
TanStack Table v8 несёт готовую модель `columnPinning` (`column.pin`,
`column.getIsPinned`, `column.getStart('left')`, `column.getAfter('right')`,
`getIsLastColumn`), но она про **состояние**, а не про рендер: sticky-раскладку,
affordance закрепления в шапке и приоритет сервисных колонок надо построить
поверх.

Этот ADR — единый источник истины по закреплению столбцов в Tessera. Он фиксирует
и **решение** (что закрепление строим на штатной модели TanStack, а не на своей),
и **как** оно реализовано плагином `columnPinning`: активацию, кнопку-affordance
в шапке, sticky-рендер ячеек, авто-закрепление сервисных колонок и flow
переключения, — плюс таблицу требований (CP1–CP15) со ссылками на тесты.

## Решение

### Опора на штатную модель TanStack

Закрепление опирается на встроенную фичу `columnPinning` TanStack Table
([ADR 0004](0004-core-on-tanstack-table.md)). Плагин не хранит собственную карту
закрепления — он читает `column.getIsPinned()` / `column.getStart('left')` /
`column.getAfter('right')` и вызывает `column.pin(...)`. Состояние возвращается
потребителю через штатный контракт `columnPinning` / `onColumnPinningChange`.

### Форма плагина

`columnPinningPlugin` (`src/lib/plugins/columnPinning/columnPinningPlugin.tsx`) —
всегда инъектируемая базовая фича (`TablePlugin`), построенная на конвенциях
`TablePlugin` + слоты ([plugins-and-slots.md](../architecture/plugins-and-slots.md)).
Она делает что-либо только после того, как потребитель включит её опцией
**`enableColumnPinning`** у `useCreateTable` (по умолчанию `false`). Плагин
подключён двумя хуками:

- **`createColumn`** — оборачивает `column.getCanPin()`, добавляя жёсткий гейт на
  многоуровневые (вложенные) заголовки:

  ```ts
  createColumn: (_staticColumn, table) => {
    const originalGetCanPin = _staticColumn.getCanPin
    _staticColumn.getCanPin = () => {
      if (table.getHeaderGroups().length !== 1) {
        return false
      }
      return originalGetCanPin()
    }
  }
  ```

- **`createTable`** — регистрирует UI-affordance слотом `rightHeaderSlot`
  (`order: 0`), т. е. в правой части каждой ячейки заголовка:

  ```ts
  table.setRenderSlot({
    id: 'columnPinningPlugin',
    slot: 'rightHeaderSlot',
    order: 0,
    component: ColumnPinningComponent,
  })
  ```

### Только левое закрепление в UI

Кнопка закрепляет столбец **только к левому краю** — по продуктовому решению
пользователь тумблит между `'left'` и `false`, правого края в UI нет:

```ts
const isPinned = column.getIsPinned()
const nextPinned = isPinned === 'left' ? false : 'left'
```

При этом **рендер и state поддерживают обе стороны** (`left` / `right`): правое
закрепление используется системно — для сервисного столбца действий (см.
[Сервисные столбцы](#сервисные-столбцы-авто-закрепление)). `cellPinningParams`
целиком покрывает и правый край, чтобы этот системный путь и возможное будущее
UI правого закрепления работали без переделки рендера.

### Affordance в шапке

`ColumnPinningComponent` (`ColumnPinningComponent.tsx`) — компонент слота. Он
подписывается на `column.getIsPinned()`, `column.getCanPin()` и
`table.options.enableColumnPinning` и рендерит **ничего**, когда столбец нельзя
закрепить, иначе — `PinButton`:

```tsx
if (!column.getCanPin()) return null
const isPinned = column.getIsPinned()
const nextPinned = isPinned === 'left' ? false : 'left'
const handleClick = () => {
  const { onTogglePin } = table.getHooks().columnPinning
  column.pin(nextPinned)
  onTogglePin(!!nextPinned)
}
```

`PinButton` (`PinButton.tsx`):

- иконка `pin` (по умолчанию lucide `Pin`, переопределяема через
  `<DataGrid icons={{ pin }} />`) — **16×16**;
- в закреплённом состоянии иконка **повёрнута на −45°** (`PinButton.module.css`:
  `.pinned svg { rotate: -45deg }`) и красится в активный цвет
  (`--data-grid-control-active-color`), `data-button-active` = `true`;
- тултип — `pin` / `unpin` из локализации (по умолчанию `Pin column` /
  `Unpin column`);
- **видимость только при наведении** — кнопка присутствует в DOM всегда, но
  скрыта `opacity: 0` до наведения на ячейку заголовка через общую конвенцию
  `cell__button--hidden` (`grid/cellControls/buttonVisibility.css`).

### Sticky-рендер ячеек

Позиционирование закреплённых ячеек считает `useCellPinningParams`
(`cellPinningParams.ts`) из штатных методов TanStack. И `HeadCell`, и `BodyCell`
читают его и превращают в inline-стиль + data-атрибуты:

- **offset:** `left = column.getStart('left')` для левого края,
  `right = column.getAfter('right')` для правого — накопительное смещение с
  учётом ширин соседних закреплённых столбцов;
- **sticky-слой:** CSS по `data-cell-pinned` даёт `position: sticky`,
  `z-index: var(--data-grid-z-index-pinned)`, фон
  (`--data-grid-cell-pinned-left-bg`, для нечётных строк —
  `--data-grid-cell-odd-pinned-left-bg`), чтобы прокручиваемый контент не
  просвечивал сквозь закреплённую ячейку;
- **разделитель:** последний закреплённый слева столбец
  (`data-cell-last-left-pinned`, `column.getIsLastColumn('left')`) получает
  правую границу `--data-grid-cell-pinned-border-color`; правый край
  зеркально (`isFirstRightPinnedColumn` / `isAloneRightPinnedColumn`
  выравнивают контент по правому краю).

data-атрибуты (`data-cell-pinned`, `data-cell-last-left-pinned`,
`data-cell-odd-left-pinned`, `data-cell-first-right-pinned`,
`data-cell-last-right-pinned`, `data-cell-alone-right-pinned`) — контракт между
расчётом и CSS; на них же опираются визуальные тесты.

### Сервисные столбцы: авто-закрепление

Сервисные (action-) столбцы плагинов закрепляются **автоматически**, помимо
пользовательских кликов. `useColumnPinningInitialState`
(`core/createState/columnPinningState.ts`) вычисляет их набор: **слева** —
expander (`rowExpanding`), selection (`rowSelection`), drag-ручка
(`rowDragging`); **справа** — столбец действий строки (`rowActions`).

Как этот набор применяется, решает `mergedColumnPinning` в `useCreateState`
(асимметрично, намеренно):

- **столбец действий (справа)** закрепляется **всегда** — даже когда
  пользователь ничего не пинил;
- **ведущие сервисные столбцы (слева)** подмешиваются в закрепление **только
  когда пользователь закрепил хотя бы один столбец влево** (или пришёл external
  left-пиннинг). Иначе они остаются обычными — незачем создавать закреплённую
  зону слева, пока в ней нет пользовательских столбцов; как только она
  появляется, сервисные столбцы «прилипают» к её началу, а не остаются левее
  прокручиваемыми.

Слияние идёт через `mergeColumnPinning` (dedupe левых/правых id через `Set`), а
`useColumnPinningState` пере-мёржит дефолт с начальным состоянием при его смене.
Это тот самый неоднородный слайс state, отмеченный в
[ADR 0010](0010-invert-core-plugins-registry.md).

### Точка расширения

`ColumnPinningPluginParams.onTogglePin(pinned: boolean)` — hook плагина,
вызываемый после переключения (дефолт — no-op). Позволяет потребителю
среагировать на закрепление/открепление (аналитика, серверная персистенция),
не перехватывая сам контракт `onColumnPinningChange`.

## Последствия

- **+** Закрепление опирается на штатную, проверенную модель TanStack — свой
  «источник истины» по состоянию не заводится.
- **+** Sticky-раскладка выражена data-атрибутами + CSS-переменными: тема и
  границы переопределяемы, визуальные тесты цепляются за атрибуты.
- **+** Сервисные столбцы закрепляются сами — пользователю не надо вручную
  фиксировать selection/expander/действия.
- **−** UI закрепляет только влево; правый край поддержан рендером/состоянием, но
  не выведен в интерфейс (осознанное сужение affordance).
- **−** Многоуровневые заголовки закрепление не поддерживают (жёсткий гейт по
  `getHeaderGroups().length !== 1`) — как и перетаскивание
  ([ADR 0006](0006-dnd-with-dnd-kit.md)): render-путь вложенных заголовков —
  CSS-grid, а не плоский flex-путь.

## Требования и покрытие тестами

Критерии приёмки, которые кодируют тесты. По конвенции проекта
([ADR 0001](0001-spec-driven-development.md),
[ADR 0009](0009-test-coverage-visual-and-performance.md)) каждое требование —
**отдельный именованный тест** с ID-префиксом `CP<n>:`, совпадающим с ID из
таблиц ниже. Визуальные тесты живут в
`stories/__tests__/visual/column-pinning.test.tsx` (vitest-browser, реальный
Chromium), перформанс-покрытие даёт кейс `enableColumnPinning` в общей перф-матрице
(`stories/__tests__/performance/`, см. [ADR 0009](0009-test-coverage-visual-and-performance.md)).

**Активация и affordance**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CP1  | Плагин инертен без `enableColumnPinning` (нет кнопок, sticky не применяется)                    | ✔ `CP1: the plugin is inert …`         |
| CP2  | При `enableColumnPinning` каждый закрепляемый столбец получает кнопку в правой части шапки       | ✔ `CP2: each pinnable data column …`   |
| CP3  | Иконка кнопки — 16×16                                                                          | ✔ `CP3: the pin icon is 16×16`         |
| CP4  | Кнопка скрыта (`opacity: 0`), пока на ячейку заголовка не наведён курсор                        | ✔ `CP4: … hidden … until … hovered`    |
| CP5  | Кнопка проявляется при наведении на заголовок                                                  | ✔ `CP5: … revealed on header hover`    |
| CP6  | Тултип кнопки — `pin` до закрепления и `unpin` после (из локализации)                           | ✔ `CP6: the tooltip reads …`           |

**Переключение состояния**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CP7  | Клик по кнопке закрепляет столбец влево (`column.pin('left')`); повторный клик открепляет       | ✔ `CP7: clicking pins … again unpins`  |
| CP8  | В закреплённом состоянии иконка повёрнута на −45° и `data-button-active='true'`                 | ✔ `CP8: a pinned toggle is active …`   |
| CP9  | Переключение вызывает hook `onTogglePin(pinned)` с актуальным флагом                            | ✔ `CP9: … calls the `onTogglePin` …`   |

**Sticky-рендер**

| ID   | Требование                                                                                     | Тест                                   |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| CP10 | Закреплённая ячейка — `position: sticky` с offset `getStart('left')` / `getAfter('right')`      | ✔ `CP10: … position:sticky offset …`   |
| CP11 | Закреплённая ячейка держит фон и `z-index`, не просвечивая прокручиваемым контентом             | ✔ `CP11: … keeps a background …`       |
| CP12 | Последний закреплённый слева столбец несёт правую границу-разделитель                           | ✔ `CP12: … right divider border`       |

**Ограничения и системное поведение**

| ID   | Требование                                                                                     | Тест                                     |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| CP13  | При многоуровневых заголовках `getCanPin()` = `false` (кнопка не рендерится)                             | ✔ `CP13: multi-level headers …`                |
| CP14  | Столбец действий строки авто-закреплён справа без клика                                                  | ✔ `CP14: the row-actions column …`             |
| CP14b | Ведущие сервисные столбцы прилипают к левому закреплённому блоку, как только пользователь пинит столбец влево | ✔ `CP14b: leading service columns …`       |
| CP15  | Закреплённый столбец нельзя перетащить                                                                   | ✔ `column-dragging.test.tsx` (D29)             |

См. [plugins-and-slots.md](../architecture/plugins-and-slots.md) про механизм
плагинов и слотов и [rendering.md](../architecture/rendering.md) про рендер ячеек.
