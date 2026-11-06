# 0019. Архитектура токенов: трёхуровневая система (`--tsr-ref/sys/comp`)

Статус: Принято (2026-09-05). Развивает [ADR 0018](0018-external-theming.md)
(механику слоя + шиппинг), заменяя ad-hoc-именование токенов на строгую
трёхуровневую систему. Ломающее изменение по именам токенов (pre-1.0).

Изменено: [ADR 0126](0126-cell-fill-precedence.md) (2026-10-19) — TT-03, TT-04:
`--tsr-comp-row-hovered-bg` и `-selected-bg` — цвет слоя поверх фона строки; токены
`--tsr-comp-cell-pinned-bg`, `-pinned-hovered-bg`, `-pinned-selected-hovered-bg` удалены
(ломающее изменение).
2026-11-04 — T-R4: мост к `--font-sans` (TK6) и список осознанно не связанных имён shadcn;
TI-10: кегли только токенами. T-R11, TI-08, TI-09, TK5: скругление только токенами; роли `--tsr-sys-radius-inner`
(пункт поповера) и `-outer` (край липкого блока) — мост к `--radius-sm` и `--radius-lg` shadcn,
`--tsr-ref-radius-lg` — 10px, как `--radius-lg` shadcn по умолчанию; облачко перетаскивания
следует за `--tsr-sys-radius`, `Bubble` и полоса прокрутки — пилюля `--tsr-comp-radius-pill`.

## Контекст

После ADR 0018 токены грида жили в двух ad-hoc-неймспейсах: `--data-grid-*`
(component-уровень) и `--dg-*` (введённый как fallback semantic-уровень). Проблемы:

- **Нет явной иерархии уровней.** Дизайнеры мыслят токены слоями (primitive →
  semantic → component); наш набор не отражал это, `--dg-*` был безымянным
  «полу-уровнем».
- **Мост к shadcn размазан.** `var(--<shadcn>, var(--dg-<x>))` повторялся в ~40
  component-токенах — дубли, трудно менять.
- **Производные (hover/selected) захардкожены** в каждом component-токене
  отдельными `color-mix()` — нет единого рычага «интенсивности интеракций».
- **Generic-префикс `--data-grid-`** длинный, а `--dg-` рискует коллизией.

## Решение

**Трёхуровневая система токенов под единым брендовым префиксом `--tsr-`**
(Tessera). Уровни кодируются сегментом имени и ссылаются строго вниз.

```
Consumer shadcn (опц.)  → мост: подставляется ОДИН раз, в Semantic
        ▼
Tier 1  PRIMITIVE   --tsr-ref-*    сырые шкалы, без смысла, БЕЗ light/dark
        ▼
Tier 2  SEMANTIC    --tsr-sys-*    роли, ТЕМА-ЗАВИСИМЫ (light/dark), + мост к shadcn
        ▼
Tier 3  COMPONENT   --tsr-comp-*   привязка к части грида; ссылается ТОЛЬКО на --tsr-sys-*
```

### Требования к токенам и стилизации (нормативно)

- **T-R1. Префикс.** Все CSS-переменные грида — `--tsr-`. Никаких `--data-grid-`,
  `--dg-`, generic-имён. Класс-якорь обёртки остаётся `data-grid-theme`
  (`DATA_GRID_THEME_CLASS`) — это не токен.
- **T-R2. Три уровня, сегмент в имени.** `--tsr-ref-*` (primitive),
  `--tsr-sys-*` (semantic), `--tsr-comp-*` (component). Другого уровня не вводить.
- **T-R3. Однонаправленные ссылки.** `comp → sys → ref`. Для ЦВЕТА: component НЕ
  ссылается на цветовой primitive (`--tsr-ref-neutral/blue/red`) и НЕ упоминает
  shadcn-имён — только `--tsr-sys-*` (напрямую или через `color-mix` над ним).
  Размерные примитивы (`--tsr-ref-space/radius`) component может тянуть напрямую
  (у них нет «роли» и они мода-независимы). Semantic НЕ ссылается на component.
  Primitive ни на что не ссылается. Проверяется TI-06/TI-06b.
- **T-R4. Мост к shadcn — только в Semantic.** Единственное место, где встречаются
  апстрим-имена (`--foreground`/`--card`/`--muted`/`--primary`/`--info`/`--border`/
  `--destructive`/`--radius-sm`/`--radius-md`/`--radius-lg`/`--font-sans`):
  `--tsr-sys-x: var(--<shadcn>, <ref>)`. Осознанно **не** мостятся: `--popover` — поповер
  без рамки в тёмной теме отделяет от грида только тон светлее карточки (`--tsr-sys-elevated`),
  а у shadcn `--popover` равен `--card`; `--accent` — наведение и выбор считаются от тона
  текста, на них держатся рычаги контраста (ADR 0088); `--input` — рамка контрола не ниже
  3:1 к фону (WCAG 1.4.11), у shadcn она бледнее; `--muted-foreground` — приглушённый
  текст не ниже 4,5:1 (ADR 0089); `--ring` — кольцо фокуса не ниже 3:1, у shadcn на белом 2,58:1
  (ADR 0191). Приложение меняет их ролями `--tsr-sys-*`.
- **T-R5. Тема-зависимость — только в Semantic.** light/dark переключаются в
  `--tsr-sys-*` сменой того, какой primitive играет роль. Primitive и component
  БЕЗ `.dark`-блоков. Селекторы dark: `:where(.data-grid-theme.dark)` и
  `:where(.dark .data-grid-theme)`.
- **T-R6. Числа vs t-shirt.** Числа — ТОЛЬКО в primitive-шкалах: цвет
  (`neutral-50…950`, `blue-500`) и spacing-множители (`space-1/2/4` = ×4px).
  Радиус и размер шрифта — t-shirt (`radius-sm/md/lg`). В semantic/component чисел
  и t-shirt-шкал НЕТ — только роли (`--tsr-sys-fg`, `--tsr-comp-head-bg`); размерная
  роль тянет t-shirt из ref (`--tsr-sys-radius: var(--radius-md, --tsr-ref-radius-md)`).
  Число/t-shirt в имени semantic/component = запах протёкшей шкалы.
- **T-R7. Производные интеракций — semantic-токены.** hover/selected/overlay и
  прочие `color-mix`-оттенки, используемые не в одном месте, объявляются как
  `--tsr-sys-overlay-*` (один рычаг), а не хардкодятся в каждом component-токене.
  Разовый `color-mix` в component допустим, но ТОЛЬКО над `--tsr-sys-*`.
- **T-R8. Нулевая специфичность дефолтов.** Слой объявляется через `:where(...)`,
  чтобы правило/`style` потребителя (спец. ≥ 0,1,0) всегда перебивало дефолт.
- **T-R9. Три публичные поверхности переопределения:** broad — shadcn
  (`--foreground`…); mid — grid-semantic (`--tsr-sys-accent`, `--tsr-sys-overlay-*`);
  narrow — component (`--tsr-comp-head-bg`). Ось режима — `.dark`; ось инстанса —
  проп `style`. Primitive НЕ является публичной поверхностью переопределения.
- **T-R10. Шиппинг (из ADR 0018).** `theme.css` — глобальный (не-модульный) CSS
  side-effect, импортится из `DataGrid.tsx`. НЕ через `@import` в `.module.css`
  (CSS Modules захешируют классы). Инвариант сборки:
  `grep -c '_data-grid-theme_' dist/style.css` = 0 И есть литеральный
  `:where(.data-grid-theme)`.
- **T-R11. Скругление — только токенами.** В CSS и стилях TSX библиотеки значение
  `border-radius` — `var(--tsr-comp-*)` (и `calc` над ними), `inherit`, `0` или круг `50%`;
  литерала длины нет. Component-токен скругления выводится из роли скругления `--tsr-sys-radius*`
  (`--tsr-sys-radius` — контрол и поверхность, `-inner` — элемент внутри поверхности, `-outer` —
  крупный край блока; роли названы по смыслу, а не t-shirt, T-R6) — прямо или через другой
  токен скругления, — поэтому следует за `--radius` приложения.
  Постоянный радиус — только у форм и геометрии из списка стража с причиной: пилюля,
  круг, черта грипа, чекбокс, скелет, поворот линии дерева. Проверяется TI-08, TI-09.

### Примеры по уровням

```css
/* Tier 1 PRIMITIVE — сырые шкалы, числа для цвета/spacing, t-shirt для радиуса */
--tsr-ref-neutral-0: #ffffff;
--tsr-ref-neutral-900: #171717;
--tsr-ref-neutral-950: #0a0a0a;
--tsr-ref-blue-500: #0070f3;
--tsr-ref-red-500: #ee0000;
--tsr-ref-space-4: 16px;
--tsr-ref-radius-md: 8px;

/* Tier 2 SEMANTIC — роли, тема-зависимы, мост к shadcn ЗДЕСЬ */
--tsr-sys-fg: var(
  --foreground,
  var(--tsr-ref-neutral-900)
); /* dark: neutral-50 */
--tsr-sys-accent: var(--primary, var(--tsr-ref-neutral-900));
--tsr-sys-overlay-hover: color-mix(in oklch, var(--tsr-sys-fg) 4%, transparent);
--tsr-sys-radius: var(--radius-md, var(--tsr-ref-radius-md));

/* Tier 3 COMPONENT — часть грида, только var(--tsr-sys-*) */
--tsr-comp-head-bg: var(--tsr-sys-muted);
--tsr-comp-row-hovered-bg: var(--tsr-sys-overlay-hover);
--tsr-comp-control-radius: var(--tsr-sys-radius);
```

## Последствия

- **+ Каноничная дизайнерская модель** (primitive/semantic/component) явно видна в
  коде и витрине; новичок читает уровень из префикса.
- **+ Мост к shadcn в одном месте** (Semantic) — component-слой тривиален
  (`var(--tsr-sys-*)`), меньше строк, чем в редакции ADR 0018.
- **+ Единый рычаг интеракций** (`--tsr-sys-overlay-*`) и три чёткие поверхности
  переопределения.
- **+ Primitive централизует light/dark-литералы** (раньше дублировались парами).
- **+ Tooltip токенизирован** (`--tsr-comp-tooltip-bg/-fg/-radius/-shadow`, инверсная
  поверхность из semantic) — убран последний островок захардкоженных `rgba` в CSS;
  тултип теперь тема-зависим и переопределяем как все компоненты (тест TH9).
- **− Ломающее изменение имён токенов:** `--data-grid-*` → `--tsr-comp-*` (75
  токенов, 42 файла). Потребители, оверрайдившие старые имена, должны обновиться.
  Допустимо на 0.0.1; алиасы намеренно НЕ вводим (чистое переименование до релиза).
- **− Primitive-tier добавляет ~15 токенов**; держим шкалу минимальной (только
  используемые ступени).
- **Ссылки на имена токенов в прочих ADR обновлены** до `--tsr-comp-*` (единовременная
  вычистка старого именования; исключение — Контекст этого ADR, где `--data-grid-*`/
  `--dg-*` фигурируют как то, что заменяется).

## Требования и покрытие тестами

Расширяет матрицу TH из ADR 0018 (те же тесты, переименованные токены). Новые —
на уровни и однонаправленность.

| ID  | Требование                                                                                                                                                 | Тест                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| TK1 | Primitive-шкала присутствует и мода-независима (`--tsr-ref-*` не меняется в dark)                                                                          | ✔ `TK1: primitive scale is …`          |
| TK2 | Semantic флипается в dark, подставляя другой primitive (`--tsr-sys-fg`)                                                                                    | ✔ `TK2: semantic role flips …`         |
| TK3 | Component ссылается на semantic: `--tsr-sys-accent` перекрывает группу                                                                                     | ✔ `TK3: overriding a semantic …`       |
| TK4 | Мост shadcn в semantic: `--primary` потребителя выигрывает у primitive-дефолта                                                                             | ✔ `TK4: a shadcn upstream token …`     |
| TK5 | Мост shadcn для скруглений: `--radius-sm` и `--radius-lg` приложения скругляют пункт поповера и край липкого блока; без них — шкала primitive (6px и 10px) | ✔ `TK5: --radius-sm and --radius-lg …` |
| TK6 | Мост shadcn для шрифта: `--font-sans` приложения — шрифт грида и его порталов; без него — системный набор                                                  | ✔ `TK6: --font-sans of the app …`      |
| TK7 | Сброс браузерных стилей — только под корнем темы: внутри таблицы поля, рамки и списки сброшены без Tailwind, страница приложения не меняется               | ☑ visual                               |

**Матрица и инварианты токенов.** Каждое — в light и dark, где тест проходит оба
режима; этапы и найденные ими дефекты — ниже.

| ID     | Требование                                                                                                                          | Тест                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| TI-05  | Каждый `var(--tsr-comp-*)`, используемый в CSS, определён в `theme.css`                                                             | ✔ `theming-invariants.test.tsx`      |
| TI-06  | Component-токены ссылаются только на semantic — не на shadcn и не на цветовой primitive                                             | ✔ `theming-invariants.test.tsx`      |
| TI-06b | Semantic-токены не ссылаются на component (нет ссылок вверх)                                                                        | ✔ `theming-invariants.test.tsx`      |
| TI-07  | Каждая тема-зависимая semantic-роль определена в тёмном блоке                                                                       | ✔ `theming-invariants.test.tsx`      |
| TI-08  | `border-radius` в CSS и стилях TSX библиотеки — токен `--tsr-comp-*`, `inherit`, `0` или `50%`, без литерала длины (T-R11)          | ✔ `theming-invariants.test.tsx`      |
| TI-09  | Component-токен скругления выводится из роли `--tsr-sys-radius*`; постоянный — только из списка форм и геометрии с причиной (T-R11) | ✔ `theming-invariants.test.tsx`      |
| TI-10  | `font-size` в CSS библиотеки — токен `--tsr-comp-*` (и `calc` над ним) или `inherit`, без литерала                                  | ✔ `theming-invariants.test.tsx`      |
| TT-01  | Фон строки тела = `--tsr-comp-row-bg`                                                                                               | ✔ `theming-matrix.test.tsx`          |
| TT-02  | Фон нечётной строки = `--tsr-comp-row-odd-bg`                                                                                       | ✔ `theming-matrix.test.tsx`          |
| TT-03  | Слой строки при наведении поверх её фона = `--tsr-comp-row-hovered-bg` (ADR 0126)                                                   | ✔ `theming-matrix.test.tsx`          |
| TT-04  | Слой выбранной строки поверх её фона = `--tsr-comp-row-selected-bg` (ADR 0126)                                                      | ✔ `theming-matrix.test.tsx`          |
| TT-12  | Фон шапки = `--tsr-comp-head-bg`                                                                                                    | ✔ `theming-matrix.test.tsx`          |
| TT-13  | Фон ячейки шапки при наведении = `--tsr-comp-head-cell-hovered-bg`                                                                  | ✔ `theming-matrix.test.tsx`          |
| TT-16  | Цвет кнопки сортировки = `--tsr-comp-control-color`                                                                                 | ✔ `theming-header-controls.test.tsx` |
| TT-17  | Цвет кнопки сортировки при активной сортировке = `--tsr-comp-control-active-color`                                                  | ✔ `theming-header-controls.test.tsx` |
| TT-18  | Фон активной кнопки сортировки при наведении = `--tsr-comp-control-active-hover-bg`                                                 | ✔ `theming-header-controls.test.tsx` |
| TT-19p | Цвет кнопки закрепления у закреплённой колонки = `--tsr-comp-control-active-color`                                                  | ✔ `theming-header-controls.test.tsx` |
| TT-19g | Цвет активной кнопки группировки = `--tsr-comp-control-active-color`                                                                | ✔ `theming-header-controls.test.tsx` |
| TT-20  | Цвет ручки перетаскивания = `--tsr-comp-control-color`                                                                              | ✔ `theming-header-controls.test.tsx` |
| TT-20d | Цвет выключенной ручки перетаскивания = `--tsr-comp-control-disabled-color`                                                         | ✔ `theming-header-controls.test.tsx` |
| TT-21  | Цвет грипа ширины = `--tsr-comp-control-color`                                                                                      | ✔ `theming-header-controls.test.tsx` |
| TT-22  | Рамка чекбокса = `--tsr-comp-control-border`                                                                                        | ✔ `theming-controls.test.tsx`        |
| TT-23  | Фон отмеченного чекбокса = `--tsr-comp-checkbox-checked-bg`                                                                         | ✔ `theming-controls.test.tsx`        |
| TT-23b | Фон частично отмеченного чекбокса = `--tsr-comp-checkbox-checked-bg`                                                                | ✔ `theming-controls.test.tsx`        |
| TT-25  | Рамка чекбокса при наведении = `--tsr-comp-control-active-color`                                                                    | ✔ `theming-controls.test.tsx`        |
| TT-26  | Трек выключенного переключателя = `--tsr-comp-switch-track-off`                                                                     | ✔ `theming-controls.test.tsx`        |
| TT-27  | Трек включённого переключателя = `--tsr-comp-switch-track-on`                                                                       | ✔ `theming-controls.test.tsx`        |
| TT-27t | Бегунок переключателя = `--tsr-comp-switch-thumb`                                                                                   | ✔ `theming-controls.test.tsx`        |
| TT-29  | Цвет и фон кнопки действия строки — из токенов контрола                                                                             | ✔ `theming-controls.test.tsx`        |
| TT-32  | Фон иконки-кнопки при наведении = `--tsr-comp-control-hover-bg`                                                                     | ✔ `theming-controls.test.tsx`        |
| TT-33  | Трек `LinearProgress` = `--tsr-comp-loader-track` (дорожки нет с ADR 0094)                                                          | → GL11                               |
| TT-33b | Бар `LinearProgress` = `--tsr-comp-loader-bar`                                                                                      | ✔ `theming-loading.test.tsx`         |
| TT-34  | Фон `Skeleton` = `--tsr-comp-skeleton-bg`                                                                                           | ✔ `theming-loading.test.tsx`         |
| TT-35  | Оверлей перетаскивания строки: `--tsr-comp-draggable-cell-bg`, прозрачность и `--tsr-comp-shadow-drag`                              | ✔ `theming-overlays.test.tsx`        |
| TT-36  | Фон бабла перетаскивания = `--tsr-comp-accent`                                                                                      | ✔ `theming-overlays.test.tsx`        |
| TT-37  | Оверлей перетаскивания колонки: `--tsr-comp-draggable-cell-bg` и `--tsr-comp-shadow-drag`                                           | ✔ `theming-overlays.test.tsx`        |
| TT-38  | Недопустимое место броска строки (ADR 0137): токен облака определён и отличим от фона облака в обеих темах                          | ✔ `theming-overlays.test.tsx`        |
| TT-40  | Токен бегунка скроллбара определён и флипается light↔dark                                                                           | ✔ `theming-overlays.test.tsx`        |
| TT-41  | Угол, где сходятся полосы прокрутки контейнера грида, прозрачен, как и дорожки: без белого квадрата                                 | ✔ `theming-overlays.test.tsx`        |

Существующие TH1–TH9 (ADR 0018 + токенизация Tooltip) сохраняются с
переименованными токенами (`theming.test.tsx`).

**Инварианты (этап 0).** `theming-invariants.test.tsx` (по исходникам): TI-05
целостность графа (каждый `var(--tsr-comp-*)` определён), TI-06/TI-06b
однонаправленность ссылок, TI-07 полнота dark-блока. `scripts/check-theme-dist.mjs`
(по артефакту, `npm run check:theme` после сборки): TI-01 слой шиппится без
хеширования, TI-11 нет глобального сброса и переменных Tailwind, TI-02 нет `--data-grid-`, TI-03 нет дженерик-имён в глобале, TI-04
все три уровня в бандле.

**Матрица DOM↔токен↔состояние (этап 1).** `theming-matrix.test.tsx`: TT-01/02
строки base/odd, TT-03 hover, TT-04 selected, TT-12 head, TT-13 head-cell hover —
каждый в light И dark.

**Форм-контролы (этап 2).** `theming-controls.test.tsx` (контролы рендерятся
standalone в обёртке темы, состояния — пропом): checkbox (TT-22 border / TT-23
checked / TT-23b indeterminate / TT-25 hover), switch (TT-26 off / TT-27 on / TT-27t
thumb), IconButton (TT-32 hover), action-button (TT-29 base) — в обоих режимах.
Этап 2 попутно вскрыл и починил баг: `Switch.module.css` матчил `[data-state='checked']`
(radix), а base-ui выставляет `[data-checked]` — включённый switch не менял ни цвет
трека, ни положение thumb.

**Контролы шапки (этап 3).** `theming-header-controls.test.tsx`: SortButton (TT-16
base / TT-17 sorted / TT-18 sorted hover), PinButton (TT-19p pinned), GroupButton
(TT-19g active), DragHandler (TT-20 base / TT-20d disabled), ResizeHandler (TT-21
base) — в обоих режимах.

**Загрузка / tooltip / иконки (этап 4).** `theming-loading.test.tsx`: LinearProgress
(TT-33 track / TT-33b bar), Skeleton (TT-34 bg), SvgIcon (TT-icon наследование
control-color через currentColor + TT-icon-size 24×24), Tooltip (TT-tooltip —
реальное открытие popup). Этап 4 вскрыл регресс токенизации Tooltip: popup уходит
в ПОРТАЛ (document.body) вне обёртки темы, где `--tsr-comp-tooltip-*` не определены
→ popup был бы прозрачным. Фикс: popup сам несёт класс `data-grid-theme`
(самонесущий слой токенов).

**Плагин-`*Component` поведенческие (этап 5) — АУДИТ, новых тестов не требуется.**
Проверка показала: три критерия (gating→null, вывод состояния, dual-dispatch хука)
уже покрыты ADR-набором 0006/0011–0016, включая тонкие кейсы — RS13 (disabled при
`isAllRowsSelected`), CS7 (последовательность сортировки), D29 (drag disabled у
pinned), CP7 (pin/unpin toggle), RG3 (service-колонка без кнопки), `onTogglePin`/
`onExpandRow`/`onToggleColumnSort`/`onSelect*` со спаями. grouping/columnDragging/
rowDragging бизнес-хук не диспатчат (grouping — `toggleGrouping` напрямую, dragging
— через dnd-kit), так что «пробел» был ложным. Дубли не добавляем.

**DnD-оверлеи и «края» (этап 6).** `theming-overlays.test.tsx`: оверлей строки
(TT-35 draggable-cell-bg/opacity/shadow-drag), bubble-счётчик (TT-36 accent),
оверлей колонки (TT-37), тон недопустимого места (TT-38 — `--tsr-comp-row-drop-invalid-overlay-bg` против
`--tsr-comp-draggable-cell-bg`, ADR 0137), scrollbar (TT-40 — инвариант значения токена, TT-41 — правило угла полос в загруженных
стилях: headless Chromium тестов полосы прячет; псевдоэлемент недоступен
`getComputedStyle`). Оверлеи рендерятся напрямую с реальными cell/header из
таблицы (минуя dnd-kit-симуляцию — её поведение уже в D-тестах, ADR 0009 R-B3).
**TT-39 (границы grid-раскладки вложенных заголовков) намеренно пропущен**: nested
headers — известно-ограниченный edge-режим (см. known-future-work; ColumnPinning/
Dragging там тоже не работают), ценность низкая, рендер флаки. Матрица темизации
покрыта по этапам 1–6.

См. [architecture/theming-and-overrides.md](../architecture/theming-and-overrides.md).
