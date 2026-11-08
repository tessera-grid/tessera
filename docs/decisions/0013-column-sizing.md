# 0013 — Изменение ширины столбцов: плагин columnSizing

- **Статус:** Принято
- **Дата:** 2026-09-01
- **Изменён:** 2026-11-08 — [ADR 0197](0197-column-resize-line.md): во время протяжки и открытого
  меню ширины, кроме вытянутой черты (CR20), видна синяя линия во всю высоту колонки; у правого
  и левого края области протяжка прокручивает таблицу.
- **Изменён:** 2026-10-14 — грип на правой границе колонки, по 12px в каждую, без
  маски ([ADR 0111](0111-resize-grip-on-column-border.md), CR19). 2026-09-10 — при вводе кебаб-меню
  ([ADR 0024](0024-slot-action-descriptor-and-menu.md)) `columnSizing` СОЗНАТЕЛЬНО
  оставлен опаковым слот-компонентом (resize-грип — кромочный аффорданс, не пункт
  меню) и помечен `countsAsHeaderAction: false`, чтобы не учитываться в пороге
  схлопывания. Открытый вопрос: hover-джиттер кебаба рядом с растягивающимся грипом
  (кандидат — вынести грип из потока, `position:absolute`).
- **Связано:**
  - [ADR 0004](0004-core-on-tanstack-table.md) — плагин построен как слот поверх
    штатной модели изменения размеров TanStack (`column.getCanResize`,
    `column.getIsResizing`, `column.getSize`, `column.resetSize`,
    `header.getResizeHandler`, срез `columnSizing` / `columnResizing`).
  - [ADR 0026](0026-migrate-to-tanstack-v9.md) — affordance подписан на срез ресайза
    столбца через `useSelector` (TanStack Store), а не на глобальный ре-рендер.
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
> (`InferPluginHooks`).
>
> **Механика ниже приведена к v9** ([ADR 0026](0026-migrate-to-tanstack-v9.md)): жизненный
> цикл фичи — `constructTableAPIs`/`assign*Prototype`, реактивность — `useSelector`
> (TanStack Store, `table.atoms`); в v9 sizing/resizing разделены на две фичи, а срез
> ресайза называется `columnResizing` (v8: `columnSizingInfo`).

## Контекст

Потребителям нужно менять ширину столбца прямо из шапки — тянуть за грип у
правой границы заголовка, видеть ширину вживую при перетаскивании и сбрасывать её
двойным кликом. TanStack Table v9 несёт готовую модель ресайза (`columnSizing`- и
`columnResizing`-state, `column.getCanResize()`, `column.getIsResizing()`,
`column.getSize()`, `column.resetSize()`, `header.getResizeHandler()`), но она про
**состояние размеров и математику дельты**, а не про рендер: сам грип в шапке,
видимость по наведению, живое применение ширины к ячейкам шапки/тела/футера и
точку расширения надо построить поверх.

Этот ADR — единый источник истины по изменению ширины столбцов в Tessera. Он
фиксирует и **решение** (что ресайз строим на штатной модели TanStack, а не на
своей), и **как** оно реализовано плагином `columnSizing`: активацию, грип-
affordance в шапке, живой режим применения, сброс и точку расширения, — плюс
таблицу требований (CR1–CR17) со ссылками на тесты.

## Решение

### Опора на штатную модель TanStack

Ресайз опирается на встроенную модель TanStack Table
([ADR 0004](0004-core-on-tanstack-table.md)). Плагин не хранит собственное
состояние ширины — он читает `column.getCanResize()` / `column.getIsResizing()` /
`column.getSize()` и делегирует перетаскивание `header.getResizeHandler()`, а
сброс — `column.resetSize()`. Ширина возвращается в дерево через штатный срез
`columnSizing` (`core/createState.ts`); границы `[minSize,
maxSize]` применяет сам TanStack в `column.getSize()`.

Опции `useCreateTable` мапятся на штатные напрямую
(`core/useCreateTable.ts`):

- **`enableColumnResizing`** → `enableColumnResizing` (по умолчанию `false`);
- зафиксирован **`columnResizeMode: 'onChange'`** — ширина применяется вживую на
  каждом движении указателя, а не только по отпусканию.

### Форма плагина

`columnSizing` (`src/lib/plugins/columnSizing/registry.ts`) — фабрика записи
`TesseraFeatureEntry`, построенная на конвенциях фич + слоты
([plugins-and-slots.md](../architecture/plugins-and-slots.md)). Поведение дают две
встроенные фичи v9 (`columnSizingFeature` + `columnResizingFeature`); UI-affordance —
декларативный слот записи
`rightHeaderSlot` (`order: 'last'` — грип прижат к правой границе, за пином и
сортировкой):

```ts
slots: [
  {
    id: 'columnSizingPlugin',
    slot: 'rightHeaderSlot',
    order: 'last',
    component: ColumnSizingComponent,
    // resize-грип — аффорданс, не кнопка: не учитывается в пороге кебаба (ADR 0024)
    countsAsHeaderAction: false,
  },
]
```

Плагин делает что-либо только когда столбец ресайзабелен: `ColumnSizingComponent`
рендерит **ничего**, если `column.getCanResize()` === `false` (в т. ч. когда
`enableColumnResizing` выключено — тогда штатный `getCanResize()` = `false`).

### Affordance в шапке

`ColumnSizingComponent` (`ColumnSizingComponent.tsx`) — компонент слота. Он
подписывается на срез ресайза столбца через `useSelector`
(TanStack Store) — `getIsResizing()`, `getCanResize()`,
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
- **меню по клику** (WCAG 2.5.7, [ADR 0034](0034-wcag-22-dragging-and-target-size.md)):
  клик без сдвига открывает меню «Wider» / «Narrower» / «Reset width»; сброс —
  пункт «Reset width» (`onResetSize`), двойной клик больше не сбрасывает;
- в состоянии ресайза грип несёт `data-button-active` = `true` — это
  реактивный сигнал активного ресайза: `ColumnSizingComponent` подписан на
  `column.getIsResizing()` через `useSelector`
  (TanStack Store);
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
  `column.getIsResizing()` через `useSelector`
  (TanStack Store), поэтому атрибут обновляется при старте
  и завершении ресайза; на нём же `buttonVisibility.css` подавляет hover-раскрытие
  соседних кнопок ячейки во время перетаскивания
  (`.data-grid__head-cell:not([data-column-resizing='true'])`).
- **`data-resizing` на контейнере скролла** (`DataGrid.tsx`) —
  `columnSizingInfo.isResizingColumn !== false`: `true`, пока тянут любой столбец.
  По нему CSS изолирует интерактив грида на время жеста (см. «Изоляция
  интерактива во время ресайза»).
- **`data-column-id`** — логический id столбца (`column.id`) на ячейках шапки,
  тела и футера; даёт тестам и потребителю адресовать столбец по стабильному id.
- **ширина через CSS-переменные** `--col-<id>-size` / `--header-<id>-size`
  (`grid/useCalculateColumnSizes.ts`), вычисляемые из `getSize()` на уровне
  контейнера и читаемые ячейками шапки, тела и футера. Поэтому ширина шапки и тела
  столбца всегда синхронна, а границы `[minSize, maxSize]` соблюдаются штатным
  `getSize()`.

### Живой режим применения

Ширина применяется вживую (`columnResizeMode: 'onChange'`): на каждом движении
указателя TanStack пересчитывает `columnSizing`, переменные ширины обновляются, и
ячейки шапки/тела растут или сужаются синхронно. Дельта клампится штатно —
столбец не может стать уже `minSize` или шире `maxSize`.

### Изоляция интерактива во время ресайза

Пока идёт перетаскивание, курсор может заехать на соседние ячейки — TanStack
ведёт ресайз document-listener'ами, а не pointer capture. Чтобы это не поднимало
hover-состояния и не давало случайных кликов/сортировки по соседям, на время
жеста весь грид переводится в неинтерактивный режим. Контейнер скролла несёт
**`data-resizing`** (`columnSizingInfo.isResizingColumn !== false`); по этому
атрибуту `DataGrid.module.css` держит `cursor: col-resize` и `user-select: none`
по всей области и гасит `pointer-events` у ячеек шапки/тела и строк
(`.data-grid__head-cell` / `.data-grid__body-cell` / `.data-grid__body-row`).
Живым остаётся только активный сплиттер (`.resize__handler--column`
`[data-button-active='true']`) — сам драг идёт через document-listener'ы, а
`pointer-events: auto` на грипе сохраняет над ним `col-resize`.

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

### Владение шириной служебных столбцов

Ширину служебной колонки (действия, drag-ручка, чекбокс, раскрытие) задаёт
**плагин-владелец**, а не потребительский `columnSizing`. Плагин пишет её в
авто-слайс размеров через `setColumnAutoSizing` в `setup`
([ADR 0010](0010-invert-core-plugins-registry.md), generic-escape), а ядро в
`useCreateState` сводит слои так, что авто-слайс идёт **последним** и побеждает и
контролируемый, и внутренний `columnSizing` (`mergeColumnSizing` в `core/createState.ts`):

```ts
{ ...(externalColumnSizing ?? columnSizing), ...columnAutoSizing }
```

Это **осознанный контракт**, а не «кто кого» по случайности: служебной колонке
ширину через `columnSizing` не задают — её меняет опция плагина (напр.
`rowActions({ width })`). Поэтому и без dev-предупреждения ([ADR 0022](0022-plugin-compatibility-contract.md)):
это не инертность плагина и не конфликт, а граница ответственности. UI-ресайз
служебной колонки тоже закрыт (CR14 — грипа нет).

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
- **±** Ширину служебных колонок `columnSizing` не переопределяет — она во
  владении плагина (авто-слайс побеждает). Это осознанный контракт (CR17), а не
  скрытое «кто кого»: потребитель меняет её опцией плагина (`rowActions({ width })`).

Клавиатурное изменение ширины (фокусируемая ручка `separator`, стрелки, `Home`)
специфицировано в [ADR 0031](0031-wcag-keyboard.md) (KB2) и идёт через тот же
`onColumnResizeEnd`.

## Сценарии

| №   | Сценарий                                                                                                                      | Требования     | История           |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------- |
| S1  | Пользователь меняет ширину колонки протяжкой ручки: колонки правее сдвигаются, в узкой колонке кнопки заголовка уходят в меню | CR18, GB6, GB9 | `ResizingColumns` |

Истории — в `src/lib/stories/DataGrid.Columns.Resizing.stories.tsx` (`Tessera/DataGrid/Columns/Resizing`).

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

| ID   | Требование                                                                                                                                | Тест                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| CR1  | Плагин инертен без `enableColumnResizing`: грипы не отрисованы, заголовки несут `data-column-resizable='false'`                           | ✔ `CR1: the plugin is inert …`                                  |
| CR2  | При `enableColumnResizing` каждый ресайзабельный столбец получает грип в шапке (`data-column-resizable='true'`)                           | ✔ `CR2: each resizable data column …`                           |
| CR3  | Грип несёт `role="separator"`                                                                                                             | ✔ `CR3: the resize grip exposes …`                              |
| CR4  | Грип скрыт (`opacity: 0`), пока на заголовок не наведён курсор                                                                            | ✔ `CR4: … hidden … until … hovered`                             |
| CR5  | Грип проявляется при наведении на заголовок                                                                                               | ✔ `CR5: … revealed on header hover`                             |
| CR19 | Середина черты грипа — на правой границе заголовка ([ADR 0111](0111-resize-grip-on-column-border.md)) — при наведении и во время протяжки | ✔ `CR19: the grip line is centred on the header right border …` |
| CR20 | Пока идёт протяжка или открыто меню ширины, черта грипа вытянута, как при наведении, и без наведения на неё                               | ✔ `CR20: the grip line stays extended …`                        |

**Механика ресайза**

| ID   | Требование                                                                                                                                                 | Тест                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| CR6  | Перетаскивание грипа вправо расширяет столбец вживую (`columnResizeMode: 'onChange'`)                                                                      | ✔ `CR6: dragging … widens …`            |
| CR7  | Во время ресайза грип активен (`data-button-active='true'`) и заголовок несёт `data-column-resizing='true'`; после отпускания — снят                       | ✔ `CR7: while resizing …`               |
| CR8  | Ячейки тела повторяют ширину шапки (общая переменная `--col-<id>-size`) — ширины синхронны                                                                 | ✔ `CR8: body cells track …`             |
| CR9  | После отпускания новая ширина сохраняется                                                                                                                  | ✔ `CR9: the new width persists …`       |
| CR10 | Отпускание вызывает hook `onColumnResizeEnd({ id, width })` с id (из `data-column-id`) и новой шириной                                                     | ✔ `CR10: … calls `onColumnResizeEnd``   |
| CR16 | Во время ресайза грид неинтерактивен: контейнер несёт `data-resizing='true'`, ячейки шапки/тела глушат `pointer-events`, активный сплиттер остаётся живым  | ✔ `CR16: while resizing the grid …`     |
| CR18 | Во время протяжки грипа колонки правее изменяемой сдвигаются вслед за её краем — в шапке и теле, без зазора и наложения; после отпускания положение то же  | ✔ `CR18: while dragging the grip …`     |
| CR21 | Горизонтальная прокрутка во время протяжки грипа: смонтированные колонки правее изменяемой остаются у её края — в шапке и теле, без зазора и наложения     | ✔ `CR21: scrolling sideways mid-drag …` |
| CR22 | Перерисовка хоста без смены колонок и ширин отдаёт прежний объект CSS-переменных ширин: грид не перекладывает их на контейнер; смена ширины — новый объект | модульный                               |

**Сброс и границы**

| ID   | Требование                                                                                                                                                 | Тест                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| CR11 | Пункт «Reset width» меню грипа сбрасывает столбец к ширине по умолчанию и зовёт `onColumnResizeEnd` ([ADR 0034](0034-wcag-22-dragging-and-target-size.md)) | ✔ `CR11: the grip menu item «Reset width» …` |
| CR12 | Столбец не сужается ниже `minSize`: крайнее перетаскивание влево клампится к устойчивому минимуму                                                          | ✔ `CR12: a column cannot shrink …`           |
| CR13 | Ресайз одного столбца не меняет ширину соседей                                                                                                             | ✔ `CR13: resizing one column …`              |

**Границы применимости**

| ID   | Требование                                                                                                                             | Тест                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| CR14 | Служебный столбец действий не ресайзабелен (нет грипа, `data-column-resizable='false'`)                                                | ✔ `CR14: the row-actions column …` |
| CR15 | При многоуровневой шапке групповые заголовки не ресайзабельны, а листовые столбцы — да                                                 | ✔ `CR15: multi-level headers …`    |
| CR17 | Ширина служебной колонки во владении плагина: авто-слайс побеждает контролируемый/внутренний `columnSizing` (модульный тест, ADR 0009) | ✔ `columnSizing.test.ts` — `CR17:` |

См. [plugins-and-slots.md](../architecture/plugins-and-slots.md) про механизм
плагинов и слотов и [rendering.md](../architecture/rendering.md) про рендер ячеек.
