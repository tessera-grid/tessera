# Темизация и контракты переопределения

Три поверхности, через которые потребитель настраивает внешний вид грида, не
трогая его внутренности: **тема** (`colorMode` → CSS-переменные), **иконки** и
**подписи** (локализация). Все три — контракты переопределения: Tessera задаёт
дефолты и позволяет их перекрыть, ничего не хардкодя. Питаются из провайдеров в
стеке `<DataGrid/>` (см. [rendering.md](rendering.md)).

## Тема — CSS-переменные (трёхуровневая система токенов)

Интерактивные контролы — это примитивы Base UI (фундамент shadcn),
стилизованные Tailwind + cva; layout грида и темизация используют CSS Modules,
читающие CSS custom properties `--tsr-*`. Токены разложены на **три уровня**
(ADR [0019](../decisions/0019-token-architecture.md)); слой и шиппинг — ADR
[0018](../decisions/0018-external-theming.md).

| Уровень   | Префикс        | Что                                                        | Тема-зависим      |
| --------- | -------------- | ---------------------------------------------------------- | ----------------- |
| Primitive | `--tsr-ref-*`  | сырые шкалы (`neutral-50…950`, `blue-500`, `radius-md`)    | нет               |
| Semantic  | `--tsr-sys-*`  | роли (`fg`/`surface`/`accent`/`overlay-*`) + мост к shadcn | **да**            |
| Component | `--tsr-comp-*` | токены части грида (`head-bg`/`row-*`/`checkbox-*`)        | нет (из semantic) |

- **Ссылки строго вниз:** `comp → sys → ref`. Component упоминает только
  `--tsr-sys-*`; primitive и shadcn там не встречаются.
- **Мост к shadcn — только в Semantic:** `--tsr-sys-x: var(--<shadcn>, <ref>)`.
  Если потребитель задал апстрим-палитру (`--foreground`/`--card`/…), она
  наследуется в обёртку и побеждает; иначе берётся primitive-дефолт. Дженерик-имена
  в глобальный скоуп НЕ выносятся — грид не мешает чужому UI-фреймворку.
- **Тема-зависимость — только в Semantic:** light/dark переключают, какой primitive
  играет роль. Дефолты — на `.data-grid-theme` через `:where()`; dark —
  `:where(.data-grid-theme.dark), :where(.dark .data-grid-theme)`. Обёртка несёт
  стабильный `DATA_GRID_THEME_CLASS = 'data-grid-theme'`.
- **Шиппинг:** `theme.css` — ГЛОБАЛЬНЫЙ (не-модульный) CSS side-effect, импортится
  из `DataGrid.tsx`. Через `@import` в `.module.css` его нельзя — CSS Modules
  захешировали бы классы `data-grid-theme`/`dark` (инвариант сборки:
  `grep -c '_data-grid-theme_' dist/style.css` = 0).
- **Три публичные поверхности переопределения** (все без `!important`, бьют
  `:where(...)` нулевой специфичности): broad — shadcn (`--foreground`…);
  mid — `--tsr-sys-*`; narrow — `--tsr-comp-*`. Ось режима — `.dark`; ось
  инстанса — проп `style`/`className` на `<DataGrid/>`. Primitive НЕ является
  поверхностью переопределения.
- Цвет текста грид задаёт сам на обёртке (`--tsr-comp-fg`, ADR 0018, TH10) и не
  наследует его от страницы: без этого в тёмной теме на странице без shadcn текст
  оставался тёмным на тёмном фоне.
- Инлайн на обёртке остаются только РАНТАЙМ-переменные
  (`--tsr-comp-head-height`, `--tsr-comp-body-height`, drag-офсеты) и токены высоты,
  когда их задали пропы `rowHeight`/`headerHeight`.
- **Высота строк и шапки** ([ADR 0077](../decisions/0077-row-height-and-default-column-width.md)):
  `--tsr-comp-row-height` (50px) и `--tsr-comp-head-row-height` (по умолчанию — как
  строки). Шапка переопределяет у себя `--tsr-comp-row-height` значением высоты шапки.
  Тема может задать оба токена в CSS — грид прочтёт их для виртуализации.
- **Рамка и тулбар** (ADR 0035): рамка грида — `--tsr-comp-frame-border-color` /
  `-border-width` / `-radius` (ширина `0` убирает рамку); тулбар —
  `--tsr-comp-toolbar-height` / `-padding-x` / `-gap` / `-bg` / `-divider-color`,
  кнопки F4 — `--tsr-comp-toolbar-button-size` / `-button-radius`.
  `--tsr-comp-toolbar-offset` выставляет сам грид при `enableToolbar` — его не
  переопределяют.
- **Нижняя панель** (ADR 0038): `--tsr-comp-status-bar-height` / `-padding-x` /
  `-gap` / `-bg` / `-divider-color`. `--tsr-comp-status-bar-offset` выставляет сам
  грид, когда есть `statusBarSlot`, — его не переопределяют.
- **Ожидание и отказ кнопок** (ADR [0055](../decisions/0055-button-pending-and-error-flash.md)):
  блик `pending` по контуру — `--tsr-comp-pending-ring-color` / `-width` /
  `-duration`; вспышка `errorFlash` — `--tsr-comp-error-flash-color` / `-fill-duration` (блик
  заливает контур) / `-duration` (удержание; гаснет `--tsr-comp-motion-duration`). Кольцо и вспышка — `::after`
  кнопки: `::before` у `IconButton` и `ToolbarButton` остаётся за слоями наведения.
  Своих правил для `prefers-reduced-motion` у них нет: гаситель темы останавливает
  блик (он остаётся виден на месте), а удержание вспышки отсчитывает таймер кнопки.
  Пока грид прокручивается (`data-scrolling`), блик кнопок на паузе — вращение угла
  градиента перерисовывает кольцо на каждом кадре (ADR [0078](../decisions/0078-async-menu-actions.md), MI25).
- **Подсветка** (ADR [0080](../decisions/0080-highlight-api.md)): заливка тона —
  `--tsr-comp-highlight-<tone>-bg` для `danger`/`warning`/`success` (роли
  `--tsr-sys-danger`, новые `--tsr-sys-warning` и `--tsr-sys-success` с мостом к
  `--warning`/`--success` потребителя); блик — `--tsr-comp-highlight-<tone>-shimmer`,
  `-shimmer-width`, `-shimmer-period`; затухание — `--tsr-comp-highlight-fade-duration`.
  Свой тон — токен `--tsr-comp-highlight-<имя>-bg` (и при желании `-shimmer`) в теме
  приложения; синий и нейтральный не берите — их занимают выделение ячеек, приход и
  состояния строк. Заливка — слой `background-image` под текстом и индикаторами:
  строка рисует его своим фоном, ячейки с непрозрачной подложкой закрепления повторяют
  его по `--tsr-highlight-row`; слои — зарегистрированные цветовые свойства, поэтому
  снятие гаснет переходом. Блик всех элементов цели идёт в одной фазе (`startTime` с момента постановки); пока грид прокручивается (`data-scrolling`), полосы нет.
- **Лента** (ADR [0081](../decisions/0081-infinite-scroll.md)): блок ошибки догрузки в
  конце списка — высота `--tsr-comp-load-more-height`, иконка
  `--tsr-comp-load-more-icon-color` (из `--tsr-sys-danger`), заголовок
  `--tsr-comp-load-more-title-color`, причина `--tsr-comp-load-more-reason-color`
  (приглушённый текст); иконки — `icons.loadMoreFailed` и `icons.retry`; хвост
  ожидания — те же статичные полоски `--tsr-comp-skeleton-bg`, что у скелет-ячеек
  быстрой прокрутки.
- **Отказ действия меню** (ADR [0078](../decisions/0078-async-menu-actions.md)):
  `--tsr-comp-action-error-color` — иконка `actionFailed` упавшего пункта и
  отметка ошибки на кебабе (тон `error` у `Bubble`).
- **Шаг отступа вложенности** (ADR [0059](../decisions/0059-row-nesting-indent.md)):
  `--tsr-comp-row-nesting-indent` (16px) — отступ первой колонки, шаг линий дерева и
  шаг перетаскивания строки по уровням (JS читает его из темы грида).
- **Линии дерева** (ADR [0058](../decisions/0058-tree-lines.md)): псевдоэлемент
  `::before` ячейки отступа с `data-tree-depth` — `--tsr-comp-tree-line-color` (3 %
  цвета текста) и `--tsr-comp-tree-line-width` (1px); линии — слои маски псевдоэлемента,
  по слою на уровень со сдвигом на шаг `--tsr-comp-row-nesting-indent` (ADR 0059).
  Маска, а не прямоугольник, тень или стоп градиента: те в 1px при дробном масштабе
  схлопываются в ноль (ADR 0084).
- **Индикатор включённого действия** (ADR [0062](../decisions/0062-active-action-indicator.md)):
  точка на кнопке заголовка и кебабе, номер приоритета сортировки, счётчики тулбара —
  `--tsr-comp-active-indicator` (по умолчанию `--tsr-comp-loader-bar`), цифры —
  `--tsr-comp-active-indicator-fg` (`--tsr-sys-surface`: белые цифры на синем тёмной
  темы не держат 4.5:1). `Bubble` с `tone="active"`; тон по умолчанию — акцент
  (счётчик перетаскиваемых строк).
- **Подсветка пришедших строк** (ADR [0056](../decisions/0056-lazy-children-arrival-highlight.md)):
  слой `::after` строки тела с `data-arrived` — `--tsr-comp-row-arrival-color` (по
  умолчанию 16 % `--tsr-comp-loader-bar`), удержание `--tsr-comp-row-arrival-duration`
  (отсчитывает таймер плагина, токен читается с узла внутри темы), угасание
  `--tsr-comp-row-arrival-fade-duration`. Слой лежит над текстом ячеек — тон
  ограничен контрастом текста 4.5:1.
- **Асинхронная правка ячейки** (ADR [0057](../decisions/0057-async-cell-edit-feedback.md)):
  слой `cellEditing` поверх ячейки. Блик и вспышка — общий модуль колец
  `ui/ringStates` с кнопками; у слоя ячейки маску несёт сам слой, а внутри вращается
  квадрат с градиентом — `transform`-анимация на компоновщике (вращение угла
  градиента перерисовывало каждое кольцо на каждом кадре: CF12). Подсветка сохранения —
  `--tsr-comp-cell-saved-color` / `-duration` / `-fade-duration`, по умолчанию
  равны `--tsr-comp-row-arrival-*`. Токена приглушения ожидания больше нет.
- **Длинный текст** (ADR [0083](../decisions/0083-text-overflow.md)): меню действий и
  панель экспорта не шире `--tsr-comp-popup-max-width` (320px), подпись пункта
  переносится. Где высота задана — `…` и тултип только у обрезанного текста
  (`Tooltip` с `overflowOnly`); где свободна — перенос; числа не обрезаются.

```mermaid
flowchart LR
    SHADCN["shadcn потребителя (опц.)"] -.-> SYS
    REF["--tsr-ref-* (primitive)"] --> SYS["--tsr-sys-* (semantic, light/dark)"]
    SYS --> COMP["--tsr-comp-* (component)"]
    COMP --> CSSM["CSS Modules (компоненты грида)"]
    OVERCSS["CSS-правило на .data-grid-theme"] -.-> COMP
    OVERINLINE["проп style/className на DataGrid"] -.-> COMP
```

### Высокая контрастность

В контрастных темах Windows (`@media (forced-colors: active)`) браузер заменяет цвета
палитрой пользователя и снимает фоны, кроме заданных системным цветом. Блок в
`theme.css` переопределяет токены состояний системными цветами: выбор и выделение —
`Highlight`, подсветка — `Mark`, линии дерева и скелет — `GrayText`, блик — `Highlight`,
вспышка — `Mark`. Цвет текста на заливке, выделение ячеек и подсветка на градиентах —
правила режима в модулях; контур кольца (`::after`) не перекрашивается
(`forced-color-adjust: none`). Системные цвета вне медиа-запроса запрещены (HC11,
ADR [0087](../decisions/0087-forced-colors.md)). Переопределённый приложением токен
состояния с обычным цветом браузер в режиме заменит на `Canvas`.

### Повышенный контраст

Тона, которые грид смешивает сам, выводятся из пяти рычагов — долей цвета текста:
`--tsr-sys-tint-hover` (наведение), `-selected` (выбор), `-pinned` (подложка
закреплённых), `-line` (линии дерева; в режиме — разделители и контуры через
`--tsr-sys-line`), `-fill` (скелет, выключенный `Switch`, ползунок прокрутки). По
`prefers-contrast: more` или `contrast="more"` надстройка в `theme.css` поднимает рычаги,
запасную рамку, приглушённые тексты грида и включает контуры там, где заливка за
текстом не даёт 3:1 ([ADR 0088](../decisions/0088-increased-contrast.md)). Роли из
палитры shadcn приложения надстройка не трогает. `contrast="standard"` её выключает,
атрибут `data-tsr-contrast` на предке (например, `<html>`) переключает все гриды.

Рецепт приложения — свои рычаги и своя палитра в том же режиме:

```css
@media (prefers-contrast: more) {
  :root {
    --border: #737373; /* палитра shadcn приложения */
  }
  .my-grid.data-grid-theme {
    --tsr-sys-tint-hover: 10%;
    --tsr-sys-tint-selected: 14%;
  }
}
```

Правило приложения перебивает надстройку без `!important`. Рычаг, переопределённый вне
медиа-запроса, перебивает её и в режиме — своё усиление приложение пишет отдельным
блоком.

### Порталы и тёмная тема

Меню, поповеры и тултипы рендерятся в портал вне корня грида, поэтому не наследуют его
класс `dark`. Грид передаёт класс своей цветовой схемы через контекст
(`usePortalThemeClass`, [ADR 0017](../decisions/0017-ui-components.md), PP5), а режим
контраста — атрибутом `data-tsr-contrast` на позиционере (`usePortalContrast`, ADR 0088);
новый всплывающий компонент обязан брать оба оттуда, а не ставить `data-grid-theme` сам.
Пользовательский `className` и инлайн-`style` грида в порталы не попадают:
переопределения токенов для поповеров объявляются на `.data-grid-theme`.

**Известная проблема — неравномерное переключение темы.** Части грида меняют цвет при
смене темы не вместе: класс `.dark` у предка при `colorMode="light"` у грида делает
шапку и футер тёмными, а строки тела оставляет светлыми. Роли `--tsr-sys-*` берут
значение из shadcn-токенов потребителя, а dark-блок темы срабатывает от класса
`.dark` на гриде или у предка — источников темы два. Разбор и решение — в roadmap,
«Известные проблемы».

### Ловушка: `composes` и dev-сервер

Поверхность поповеров и пункт списка подключаются из
[`ui/Popup/Popup.module.css`](../../src/lib/ui/Popup/Popup.module.css) через
`composes … from`. Vite в dev-режиме (Storybook, `npm run dev`) не отслеживает эту
зависимость: модули, которые подключают общий файл (`ActionMenu`, меню колонок, панель
экспорта, пагинация), держат его старую копию, и правка `Popup.module.css` не видна даже
после перезагрузки страницы. Сборка `dist` и тесты собирают всё заново и этой ловушке не
подвержены. После правки общего файла перезапустите dev-сервер или обновите время
изменения подключающих модулей (`touch`). Второе следствие `composes`: порядок правил в
бандле не гарантирован, поэтому локальный модуль не должен переопределять свойства,
которые задаёт общий (PP1 ловит такое расхождение).

## Иконки

Дефолтные inline-SVG живут в `ui/icons`; `IconsProvider` сливает проп потребителя
`icons` поверх `DEFAULT_ICONS`; кнопки-плагины читают их через `useIcons()`.

## Локализация

`LocalizationProvider` сливает проп потребителя `localization` поверх английских
`DEFAULT_LABELS`; контролы читают их через `useLocalization()`. Дефолтные подписи —
на английском (см. инвариант де-брендинга). У счётчиков нижней панели две формы:
полная и короткая (`*Short`) для компактного вида
([ADR 0083](../decisions/0083-text-overflow.md), TX6).
