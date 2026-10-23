# 0128 — Единый контракт производных кнопок кита

- **Статус:** Принято (решения — по итогам прожарки 2026-10-21)
- **Дата:** 2026-10-21
- **Изменено:** [ADR 0129](0129-button-active-state.md) (2026-10-21) — `active` у
  `CellButton` и `RowButton` (§3) дополняют `count`, `activeIcon` и `indicator`; знак
  рисует база `IconButton`.
- **Меняет:**
  - [ADR 0098](0098-button-system.md) — производные кнопки собираются из `IconButton` и
    теперь делят с ней пропсы занятости, отказа и тултипа выключенной кнопки.
  - [ADR 0127](0127-initiator-pending-and-failure.md) — IR15 (`CellButton` с `pending`,
    `errorFlash`, `failure`, видна без наведения) выполняется здесь, а не на этапе 2, и для
    всех производных кнопок.
- **Изменено:** [ADR 0117](0117-story-controls.md) (2026-10-22) — первая история `UI/<Кнопка>` —
  `Playground` вместо `Default` (DB4, SN31).
- **Связано:** [ADR 0017](0017-ui-components.md) — UI-примитивы; [ADR 0106](0106-flag-and-predicate-naming.md)
  — правило имён; [ADR 0076](0076-smooth-cell-button-reveal.md) — раскрытие кнопок ячейки;
  [ADR 0117](0117-story-controls.md) — истории.

## Контекст

Производные кнопки кита из `/ui` — `CellButton`, `RowButton`, `ExpandButton`,
`GroupButton`, `PinButton`, `SortButton`, `ToolbarButton` — собираются из `IconButton`
(ADR 0098), но их пропсы и истории сложились по месту и расходятся:

- **имя кнопки** — `title` у `CellButton` и `RowButton`, `label` у базы и `ToolbarButton`;
- **тултип выключенной** — `showTooltipWhenDisabled` у `CellButton`/`RowButton`,
  `tooltipWhenDisabled` у базы, у остальных его нет;
- **показ по наведению** — `showOnHover` (по умолчанию `true`) у `CellButton`, `isVisible`
  с обратным смыслом (по умолчанию `false`) у `RowButton`; `PinButton`, `SortButton`,
  `GroupButton` прячутся всегда, без пропа;
- **включённое состояние** — `expanded`, `isGrouped`, `isPinned`, `operation`;
- **занятость и отказ** — `pending`/`errorFlash` есть только у `ExpandButton` и
  `ToolbarButton`, `failure` — только у `ToolbarButton`;
- **`onClick`** — где с событием, где без; **`testId`** вместо `data-testid`; тип пропсов
  `CellButton` называется `CellEditButtonProps`;
- **истории** — у одних кнопка в рамке своего места (ячейка, заголовок, строка), у
  `ExpandButton` — на голом холсте; клик где переключает состояние, где только пишет
  действие; набор историй состояний у каждой свой.

Автор плагина, собирающий свою колонку или слот из этих кнопок, учит каждую отдельно, а
ожидание и отказ (ADR 0127) у большинства недоступны.

### Как у других

- **MUI** — `Button`, `IconButton`, `ToggleButton` делят базовые пропсы (`disabled`,
  `size`, `color`), различаются только своим состоянием (`selected`).
- **shadcn/ui** — производные кнопки — та же `Button` с вариантом, пропсы одни.

## Решение

### 1. Общие пропсы

Все семь кнопок принимают общий набор `DerivedButtonProps` (тип из `/ui`): `disabled`,
`tooltipWhenDisabled`, `pending`, `errorFlash`, `failure`, `onClick(event)`, `data-testid`.
Кнопка передаёт их базе: занятость (`aria-busy`, дуга, нажатия не доходят), вспышка
отказа и отметка `ErrorDot` с текстом — ровно как у `IconButton` (ADR 0127). Подключение
занятости и отказа в самих плагинах (серверная сортировка, закрепление и т. п.) остаётся
этапом 2 ADR 0127.

### 2. Показ по наведению — `revealOnHover`

У кнопок, живущих в ячейке, заголовке или строке, — `CellButton`, `RowButton`,
`PinButton`, `SortButton`, `GroupButton` — проп `revealOnHover`, по умолчанию `true`:
кнопка скрыта до наведения на свою ячейку, заголовок или строку (и до клавиатурного
фокуса в них, как прежде); `false` — видна всегда. Включённая (закреплена,
сгруппирована, сортирует), занятая и с отметкой отказа кнопка видна и без наведения:
ожидание и отказ, спрятанные до наведения, пользователь бы не увидел. `ExpandButton` и
`ToolbarButton` видны всегда.

### 3. Включённое у кнопок без своего состояния — `active`

`CellButton` и `RowButton` — кнопки своих слотов без собственного состояния — принимают
`active`: действие включено (фильтр задан, режим выбран). Вид — как у включённых кнопок
заголовка (ADR 0062): цвет `--tsr-comp-control-active-color` и точка в правом верхнем
углу; кнопка видна и без наведения (§2). У кнопок со своим состоянием `active` не
появляется — его выводит само состояние (`pinned`, `grouped`, `operation`, `expanded`).

### 4. Имена

| Было                                | Стало                            |
| ----------------------------------- | -------------------------------- |
| `title` (`CellButton`, `RowButton`) | `label`                          |
| `showOnHover` (`CellButton`)        | `revealOnHover`                  |
| `isVisible` (`RowButton`)           | `revealOnHover` — обратный смысл |
| `showTooltipWhenDisabled`           | `tooltipWhenDisabled`            |
| `isPinned` (`PinButton`)            | `pinned`                         |
| `isGrouped` (`GroupButton`)         | `grouped`                        |
| `testId`                            | `data-testid`                    |
| тип `CellEditButtonProps`           | `CellButtonProps`                |

Без префикса `is` — как `disabled`, `active`, `expanded` у базы. `SortButton` сохраняет
`operation` и `nextOperation`: у него три состояния, а не флаг.

### 5. Истории

Каждая производная кнопка — история `UI/<Кнопка>` одного устройства:

- **`Playground`** — песочница в рамке своего места (`UiCanvas` с `host` ячейки, заголовка или
  строки, `ToolbarButton` — в тулбаре): скрыта до наведения, где есть `revealOnHover`;
  клик переключает своё состояние (раскрыта, сгруппирована, закреплена, сортировка по
  кругу), у кнопок без состояния — пишет действие; контролы — по пропсам кнопки.
- **Истории состояний** — включённое (`Expanded`, `Grouped`, `Pinned`, `Sorted`,
  `Active` у `ToolbarButton`, `CellButton` и `RowButton`), `Pending`, `Disabled` с тултипом выключенной; у кнопок с `revealOnHover` —
  ещё `Always visible`. Вкладки Controls у них нет — контролы только у `Playground`
  ([ADR 0117](0117-story-controls.md), SN30).
- **Особые** — свои как есть (`Multi-sort` у `SortButton`).

Цикл «ожидание → отказ» показывает история `UI/IconButton` «Async action»; у производных
его нет.

## Границы

- Подключение `pending` и `failure` во встроенных плагинах — этап 2 ADR 0127.
- `Button` и `IconButton` не меняются.
- Своих историй сценариев нет: истории примитивов показывают состояния (AGENTS.md, UI-кит).

## Отвергнутые альтернативы

- **Только истории, API позже** — расхождения в историях вытекают из пропсов; без
  единого API истории снова разойдутся.
- **`alwaysVisible` вместо `revealOnHover`** — флаг включал бы исключение; поведение по
  умолчанию лучше читается из имени.
- **`active` вместо `pinned`, `grouped`, `expanded`** — у каждой кнопки своё состояние со
  своей ролью (`aria-expanded` у раскрытия); имя состояния — часть смысла кнопки.

## Последствия

- **Ломающее изменение публичного API `/ui`** (до 1.0): переименования §4, тип
  `CellButtonProps`. Встроенные плагины, тесты и истории переведены тем же изменением.
- Новый публичный тип `DerivedButtonProps`; новый проп `active` у `CellButton` и
  `RowButton`.
- ADR 0127: IR15 выполнено здесь (DB1–DB2), его строка в таблице помечена.

## Требования

| ID  | Требование                                                                                                                                                                                                                                                                                                                                                                                                        | Вид        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DB1 | `CellButton`, `RowButton`, `ExpandButton`, `GroupButton`, `PinButton`, `SortButton` и `ToolbarButton` принимают `disabled`, `tooltipWhenDisabled`, `pending`, `errorFlash`, `failure`, `onClick` с событием и `data-testid`; занятая — `aria-busy` и дуга, нажатия не доходят; `errorFlash` — вспышка отказа; `failure` — отметка и её текст тултипом; выключенная с `tooltipWhenDisabled` — тултип при наведении | визуальный |
| DB2 | `revealOnHover` у `CellButton`, `RowButton`, `PinButton`, `SortButton`, `GroupButton`: по умолчанию кнопка скрыта до наведения на свою ячейку, заголовок или строку и видна при наведении; `false` — видна всегда; включённая, занятая и с отметкой отказа видна без наведения                                                                                                                                    | визуальный |
| DB3 | Публичные типы `/ui`: `label` вместо `title`, `revealOnHover` вместо `showOnHover` и `isVisible`, `tooltipWhenDisabled` вместо `showTooltipWhenDisabled`, `pinned` и `grouped` вместо `isPinned` и `isGrouped`, `data-testid` вместо `testId`, тип `CellButtonProps`; старых имён в типах нет; `DerivedButtonProps` экспортируется                                                                                | модульный  |
| DB4 | Истории `UI/<Кнопка>` семи производных кнопок: первая — `Playground` в рамке своего места (`host` холста или тулбар); есть истории `Pending` и `Disabled`, у кнопок со своим состоянием и у `CellButton` и `RowButton` — история включённого состояния, у кнопок с `revealOnHover` — `Always visible`                                                                                                             | модульный  |
| DB5 | `CellButton` и `RowButton` с `active` — цвет `--tsr-comp-control-active-color` и точка включённого действия ADR 0062 в правом верхнем углу кнопки; без `active` — цвет покоя `--tsr-comp-button-color`, точки нет                                                                                                                                                                                                 | визуальный |

## План внедрения

Один этап: тип и пропсы семи кнопок, правило видимости занятой и отмеченной кнопки,
перевод встроенных плагинов, тестов и историй, требования DB1–DB5.
