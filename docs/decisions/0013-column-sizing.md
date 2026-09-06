# 0013 — Изменение ширины столбцов: плагин columnSizing

- **Статус:** Принято
- **Дата:** 2026-09-01
- **Связано:**
  - [ADR 0004](0004-core-on-tanstack-table.md) — плагин построен как слот поверх
    штатной модели изменения размеров TanStack (`column.getCanResize`,
    `column.getIsResizing`, `column.getSize`, `column.resetSize`,
    `header.getResizeHandler`, срез `columnSizing` / `columnSizingInfo`).
  - [ADR 0007](0007-reactivity-pubsub.md) — affordance подписан на срез ресайза
    столбца через `useSubscribeStore`, а не на глобальный ре-рендер.
  - [ADR 0009](0009-test-coverage-visual-and-performance.md) — покрытие
    визуальными + перформанс-тестами; требования (`CR<n>`) кодируются тестами, а
    состояние читается из контракта DOM (запрет хардкода мок-данных).
  - [ADR 0011](0011-column-pinning.md), [ADR 0012](0012-column-sorting.md) —
    общий с пиннингом и сортировкой контракт affordance в шапке: слот
    `rightHeaderSlot`, скрытие до наведения через `buttonVisibility.css`.

> **Обновление ([ADR 0010](0010-invert-core-plugins-registry.md)).** Активация
> через флаг `enableColumnResizing` у `useCreateTable` заменена presence-based
> композицией: плагин включается фабрикой `columnSizing()` в массиве `plugins`.
> Упомянутые ниже `enable*` остаются TanStack-опциями, которые фабрика проставляет
> сама (`RegistryEntry.options`). Тип хуков плагина выводится из набора `plugins`
> (`InferPluginHooks`). Текст ниже отражает исходное решение и сохранён как история.

## Контекст

Потребителям нужно менять ширину столбца прямо из шапки — тянуть за грип у
правой границы заголовка, видеть ширину вживую при перетаскивании и сбрасывать её
двойным кликом. TanStack Table v8 несёт готовую модель ресайза (`columnSizing`- и
`columnSizingInfo`-state, `column.getCanResize()`, `column.getIsResizing()`,
`column.getSize()`, `column.resetSize()`, `header.getResizeHandler()`), но она про
**состояние размеров и математику дельты**, а не про рендер: сам грип в шапке,
видимость по наведению, живое применение ширины к ячейкам шапки/тела/футера и
точку расширения надо построить поверх.

Этот ADR — единый источник истины по изменению ширины столбцов в Tessera. Он
фиксирует и **решение** (что ресайз строим на штатной модели TanStack, а не на
своей), и **как** оно реализовано плагином `columnSizing`: активацию, грип-
affordance в шапке, живой режим применения, сброс и точку расширения, — плюс
таблицу требований (CR1–CR15) со ссылками на тесты.

## Решение

### Опора на штатную модель TanStack

Ресайз опирается на встроенную модель TanStack Table
([ADR 0004](0004-core-on-tanstack-table.md)). Плагин не хранит собственное
состояние ширины — он читает `column.getCanResize()` / `column.getIsResizing()` /
`column.getSize()` и делегирует перетаскивание `header.getResizeHandler()`, а
сброс — `column.resetSize()`. Ширина возвращается в дерево через штатный срез
`columnSizing` (`core/createState/columnSizingState.ts`); границы `[minSize,
maxSize]` применяет сам TanStack в `column.getSize()`.

Опции `useCreateTable` мапятся на штатные напрямую
(`core/createTable/useCreateTable.ts`):

- **`enableColumnResizing`** → `enableColumnResizing` (по умолчанию `false`);
- зафиксирован **`columnResizeMode: 'onChange'`** — ширина применяется вживую на
  каждом движении указателя, а не только по отпусканию.

### Форма плагина

`columnSizingPlugin` (`src/lib/plugins/columnSizing/columnSizingPlugin.tsx`) —
всегда инъектируемая базовая фича (`TablePlugin`), построенная на конвенциях
`TablePlugin` + слоты ([plugins-and-slots.md](../architecture/plugins-and-slots.md)).
Единственный хук — **`createTable`**, регистрирующий UI-affordance слотом
`rightHeaderSlot` (`order: 'last'` — грип прижат к правой границе, за пином и
сортировкой):

```ts
table.setRenderSlot({
  id: 'columnSizingPlugin',
  slot: 'rightHeaderSlot',
  order: 'last',
  component: ColumnSizingComponent,
})
```

Плагин делает что-либо только когда столбец ресайзабелен: `ColumnSizingComponent`
рендерит **ничего**, если `column.getCanResize()` === `false` (в т. ч. когда
`enableColumnResizing` выключено — тогда штатный `getCanResize()` = `false`).

### Affordance в шапке

`ColumnSizingComponent` (`ColumnSizingComponent.tsx`) — компонент слота. Он
подписывается на срез ресайза столбца через `useSubscribeStore`
([ADR 0007](0007-reactivity-pubsub.md)) — `getIsResizing()`, `getCanResize()`,
`enableColumnResizing` — и рендерит `ResizeHandler`:

```tsx
if (!column.getCanResize()) return

const onResizeEnd = () => {
  const { onColumnResizeEnd } = table.getHooks().columnSizing
  onColumnResizeEnd?.({ id: column.id, width: column.getSize() })
}

const onResetSize = () => {
  const { onColumnResizeEnd } = table.getHooks().columnSizing
  const defaultSize = table.options.defaultColumn?.size || 150
  column.resetSize()
  onColumnResizeEnd?.({ id: column.id, width: defaultSize })
}
```

`ResizeHandler` (`ResizeHandler.tsx`):

- **грип у правой границы** заголовка (`ResizeHandler.module.css`:
  `position: absolute; right: 0`), внутри — `role="separator"`;
- **старт по нажатию**: `onMouseDown` / `onTouchStart` вызывают
  `header.getResizeHandler()`, ставят курсор `col-resize` на `document.body` и
  вешают одноразовый `mouseup` / `touchend`, который по отпусканию зовёт
  `onResizeEnd` и возвращает курсор;
- **сброс двойным кликом**: `onDoubleClick` → `onResetSize`;
- в состоянии ресайза грип несёт `data-button-active` = `true` — это
  реактивный сигнал активного ресайза: `ColumnSizingComponent` подписан на
  `column.getIsResizing()` через `useSubscribeStore`
  ([ADR 0007](0007-reactivity-pubsub.md));
- **видимость только при наведении** — грип присутствует в DOM всегда, но скрыт
  `opacity: 0` до наведения на ячейку заголовка (общая конвенция
  `cell__button--hidden`, `grid/cellControls/buttonVisibility.css`). Пока идёт
  ресайз (`data-button-active='true'`), грип виден без наведения.

### Контракт DOM

Состояние ресайза выражено в разметке ячейки заголовка — это seam, за который
цепляются и доступность, и тесты (см.
[ADR 0009](0009-test-coverage-visual-and-performance.md) про запрет хардкода
мок-данных: ширина и ресайзабельность читаются из атрибутов и вычисленного
стиля, а не из литералов мока):

- **`data-column-resizable` на `role="columnheader"`** (`HeadCell.tsx`) —
  `column.getCanResize()`: `true` на ресайзабельном столбце, `false` — иначе (в
  т. ч. на служебном столбце и на групповых заголовках).
- **`data-column-resizing` на `role="columnheader"`** — `column.getIsResizing()`:
  `true`, пока столбец тянут. Реактивен — `HeadCell` подписан на
  `column.getIsResizing()` через `useSubscribeStore`
  ([ADR 0007](0007-reactivity-pubsub.md)), поэтому атрибут обновляется при старте
  и завершении ресайза; на нём же `buttonVisibility.css` подавляет hover-раскрытие
  соседних кнопок ячейки во время перетаскивания
  (`.data-grid__head-cell:not([data-column-resizing='true'])`).
- **`data-column-id`** — логический id столбца (`column.id`) на ячейках шапки,
  тела и футера; даёт тестам и потребителю адресовать столбец по стабильному id.
- **ширина через CSS-переменные** `--col-<id>-size` / `--header-<id>-size`
  (`createColumns/calculateColumnSizes.ts`), вычисляемые из `getSize()` на уровне
  контейнера и читаемые ячейками шапки, тела и футера. Поэтому ширина шапки и тела
  столбца всегда синхронна, а границы `[minSize, maxSize]` соблюдаются штатным
  `getSize()`.

### Живой режим применения

Ширина применяется вживую (`columnResizeMode: 'onChange'`): на каждом движении
указателя TanStack пересчитывает `columnSizing`, переменные ширины обновляются, и
ячейки шапки/тела растут или сужаются синхронно. Дельта клампится штатно —
столбец не может стать уже `minSize` или шире `maxSize`.

### Сброс к ширине по умолчанию

Двойной клик по грипу зовёт `column.resetSize()` — TanStack убирает запись
столбца из `columnSizing`, и ширина возвращается к `columnDef.size` (или
дефолтной). Плагин следом зовёт hook с этой шириной.

### Точка расширения

`ColumnSizingPluginParams.onColumnResizeEnd({ id, width })` — hook плагина,
вызываемый по завершении ресайза и по сбросу с id столбца и **итоговой** шириной
(дефолт — no-op). Позволяет потребителю среагировать на изменение ширины
(персистенция раскладки, аналитика, серверный перезапрос), не перехватывая сам
контракт `onColumnSizingChange`.

## Последствия

- **+** Ресайз опирается на штатную, проверенную модель TanStack — свой «источник
  истины» по ширинам и математике дельты не заводится.
- **+** Affordance переиспользует общий с пиннингом и сортировкой контракт шапки
  (слот, скрытие до наведения) — единообразие и меньше кода.
- **+** Живой режим (`onChange`) даёт немедленную обратную связь; ширина шапки и
  тела не рассинхронизируется — обе читают одну CSS-переменную.
- **+** Границы `[minSize, maxSize]` и сброс работают штатно, без своей логики
  клампа.
- **−** Режим применения зафиксирован `onChange`; отложенный режим (`onEnd`, без
  живого пересчёта) наружу не выведен.
- **−** UI меняет один столбец за жест; групповой ресайз (тянуть несколько
  выделенных столбцов сразу) в affordance не выведен.

## Требования и покрытие тестами

Критерии приёмки, которые кодируют тесты. По конвенции проекта
([ADR 0001](0001-spec-driven-development.md),
[ADR 0009](0009-test-coverage-visual-and-performance.md)) каждое требование —
**отдельный именованный тест** с ID-префиксом `CR<n>:`, совпадающим с ID из
таблиц ниже. Визуальные тесты живут в
`stories/__tests__/visual/column-resizing.test.tsx` (vitest-browser, реальный
Chromium), перформанс-покрытие даёт кейс ресайза в общей перф-матрице
(`stories/__tests__/performance/`, см. [ADR 0009](0009-test-coverage-visual-and-performance.md)).

**Активация и affordance**

| ID  | Требование                                                                                                      | Тест                                  |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| CR1 | Плагин инертен без `enableColumnResizing`: грипы не отрисованы, заголовки несут `data-column-resizable='false'` | ✔ `CR1: the plugin is inert …`        |
| CR2 | При `enableColumnResizing` каждый ресайзабельный столбец получает грип в шапке (`data-column-resizable='true'`) | ✔ `CR2: each resizable data column …` |
| CR3 | Грип несёт `role="separator"`                                                                                   | ✔ `CR3: the resize grip exposes …`    |
| CR4 | Грип скрыт (`opacity: 0`), пока на заголовок не наведён курсор                                                  | ✔ `CR4: … hidden … until … hovered`   |
| CR5 | Грип проявляется при наведении на заголовок                                                                     | ✔ `CR5: … revealed on header hover`   |

**Механика ресайза**

| ID   | Требование                                                                                                                           | Тест                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| CR6  | Перетаскивание грипа вправо расширяет столбец вживую (`columnResizeMode: 'onChange'`)                                                | ✔ `CR6: dragging … widens …`          |
| CR7  | Во время ресайза грип активен (`data-button-active='true'`) и заголовок несёт `data-column-resizing='true'`; после отпускания — снят | ✔ `CR7: while resizing …`             |
| CR8  | Ячейки тела повторяют ширину шапки (общая переменная `--col-<id>-size`) — ширины синхронны                                           | ✔ `CR8: body cells track …`           |
| CR9  | После отпускания новая ширина сохраняется                                                                                            | ✔ `CR9: the new width persists …`     |
| CR10 | Отпускание вызывает hook `onColumnResizeEnd({ id, width })` с id (из `data-column-id`) и новой шириной                               | ✔ `CR10: … calls `onColumnResizeEnd`` |

**Сброс и границы**

| ID   | Требование                                                                                        | Тест                               |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| CR11 | Двойной клик по грипу сбрасывает столбец к ширине по умолчанию и зовёт `onColumnResizeEnd`        | ✔ `CR11: double-click resets …`    |
| CR12 | Столбец не сужается ниже `minSize`: крайнее перетаскивание влево клампится к устойчивому минимуму | ✔ `CR12: a column cannot shrink …` |
| CR13 | Ресайз одного столбца не меняет ширину соседей                                                    | ✔ `CR13: resizing one column …`    |

**Границы применимости**

| ID   | Требование                                                                              | Тест                               |
| ---- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| CR14 | Служебный столбец действий не ресайзабелен (нет грипа, `data-column-resizable='false'`) | ✔ `CR14: the row-actions column …` |
| CR15 | При многоуровневой шапке групповые заголовки не ресайзабельны, а листовые столбцы — да  | ✔ `CR15: multi-level headers …`    |

См. [plugins-and-slots.md](../architecture/plugins-and-slots.md) про механизм
плагинов и слотов и [rendering.md](../architecture/rendering.md) про рендер ячеек.
