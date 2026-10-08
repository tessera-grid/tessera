# 0003 — Формализация технического стека

- **Статус:** Принято
- **Дата:** 2026-08-05

> **Актуализировано (2026-09-15).** Стек приведён к текущему состоянию кода: TanStack
> Table **v9** (состояние — TanStack Store, [ADR 0026](0026-migrate-to-tanstack-v9.md));
> контролы — примитивы **Base UI** со стилями на **CSS Modules** (не Tailwind-утилиты и не
> `cva`); тема — трёхуровневые токены `--tsr-ref/sys/comp`
> ([ADR 0019](0019-token-architecture.md)), статически в `core/themeVariables/theme.css`.
> `tailwind-merge`/`cn` удалены; `cva`/`motion` объявлены, но не используются.

## Контекст

К моменту этого ADR ранние решения фиксировали только _headless-ядро_: TanStack Table
([0004](0004-core-on-tanstack-table.md)), TanStack Virtual
([0005](0005-virtualization-tanstack-virtual.md)) и dnd-kit
([0006](0006-dnd-with-dnd-kit.md)). Рантайм-слой контролов и стилизации —
примитивы, утилитарный CSS, токены темы — сложился позже и **до настоящего ADR не был
зафиксирован ни в одном решении**, а `AGENTS.md` и `docs/**` не описывали его полно. Этот
ADR закрывает пробел (сам слой позже детализируют [0017](0017-ui-components.md),
[0018](0018-external-theming.md), [0019](0019-token-architecture.md)).

Нужен единый формальный источник правды о полном стеке, на который ссылаются
`AGENTS.md` и архитектурные документы, чтобы перечни библиотек не расходились с
`package.json` и кодом.

## Решение

Зафиксировать полный технический стек как единый источник правды и **поддерживать его
актуальным** (перечень ниже сверяется с `package.json` и кодом; правки — датированной
пометкой в шапке). Внутри — несколько связанных решений, ранее нигде не записанных.

### Слои стека

| Слой                            | Что                                                                                                                                                                                                                                          | Поставка                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Peer (приносит потребитель)** | `react` 18/19, `react-dom`, `@tanstack/react-table` **v9** (состояние — TanStack Store, `@tanstack/react-store`)                                                                                                                             | `peerDependencies`; `external` в сборке        |
| **Headless-ядро**               | `@tanstack/react-virtual` v3, `@dnd-kit/{core,sortable,modifiers,utilities}`                                                                                                                                                                 | `@dnd-kit/*` — `external`; virtual — бандлится |
| **Примитивы контролов**         | **Base UI** (`@base-ui/react`) — фундамент shadcn (Button, Tooltip, Switch, Checkbox…)                                                                                                                                                       | **бандлится в `dist`**                         |
| **Стилизация контролов**        | **CSS Modules** на примитивах Base UI; `clsx` для склейки классов. Tailwind v4 (`@tailwindcss/vite`) + `tw-animate-css` — build-time, для `@theme`-моста shadcn-токенов в Storybook (`src/styles/global.css`), а не для утилит в компонентах | clsx — бандлится; Tailwind — build-time        |
| **Контролы (`ui/`)**            | компоненты на примитивах Base UI со стилями в CSS Modules (`Switch`, `Tooltip`, `IconButton`, `Skeleton`, `LinearProgress`, `Bubble`); CLI `shadcn` — devDep, каталог `ui/shadcn` не используется                                            | код в репозитории; бандлится                   |
| **Иконки**                      | `lucide-react` — набор по умолчанию, переопределяемый через `IconsContext`                                                                                                                                                                   | бандлится                                      |
| **Календарь**                   | `@daypicker/react` v10 (+ `date-fns` 4, `@date-fns/tz`) — фильтр дат, ленивый модуль ([ADR 0047](0047-date-filtering.md))                                                                                                                    | бандлится                                      |
| **Стилизация грида**            | **CSS Modules** (`*.module.css`) для раскладки; тема — трёхуровневые токены `--tsr-ref/sys/comp` в `core/themeVariables/theme.css` ([ADR 0019](0019-token-architecture.md))                                                                  | собирается в единый `dist/style.css`           |
| **Анимация (задел)**            | `motion` — объявлена, **пока не импортирована**; зарезервирована под будущие анимации                                                                                                                                                        | бандлится по факту использования               |
| **Сборка**                      | **Vite 8** (lib mode, ESM + CJS, `preserveModules` — модуль на файл, чтобы потребитель выбрасывал неиспользуемые плагины), `vite-plugin-dts`, `@vitejs/plugin-react`                                                                         | —                                              |
| **Язык / типы**                 | **TypeScript `~6`** (зафиксирован; TS 7 ломает typescript-eslint и dts — нет JS Compiler API)                                                                                                                                                | —                                              |
| **Тесты**                       | **Vitest 4** browser mode (Playwright/Chromium), `vitest-browser-react`; доступность — `axe-core` и эмулятор скринридера `@guidepup/virtual-screen-reader` ([ADR 0033](0033-a11y-tree-and-virtual-screen-reader.md))                         | —                                              |
| **Качество**                    | ESLint 10 (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks` (классические правила); Prettier                                                                                                                                 | —                                              |
| **Витрина**                     | **Storybook 10** (`@storybook/react-vite`); `@faker-js/faker`, `@fontsource/inter`                                                                                                                                                           | dev-only                                       |
| **Пакетный менеджер**           | **npm** (Node 25, npm 11), `package-lock.json`                                                                                                                                                                                               | —                                              |

### Встроенные решения

1. **Примитивы контролов — Base UI.** Фундамент headless-примитивов (Button,
   Tooltip, Switch, Checkbox…) — `@base-ui/react`, база shadcn.
2. **Примитивы бандлятся, а не peer.** `@base-ui/react`, `clsx`, `lucide-react`
   собираются **в `dist`** — пакет самодостаточен. `external` в `vite.config.ts`
   держит вынесенными **только** `react`, `react-dom`, `react/jsx-runtime`,
   `@tanstack/*`, `@dnd-kit/*`.
3. **Стилизация — CSS Modules.** И раскладка грида, и контролы (примитивы Base UI)
   стилизуются **CSS Modules** (`*.module.css` + BEM), классы склеиваются `clsx`.
   Tailwind-утилиты и `cva` в компонентах библиотеки **не применяются** (`cva`
   объявлена, но не используется; `tailwind-merge`/`cn` удалены). Tailwind остаётся
   build-time для `@theme`-моста shadcn-токенов в Storybook (`src/styles/global.css`).
4. **Тема — трёхуровневые токены (ADR 0019).** Источник, шиппящийся с библиотекой, —
   `core/themeVariables/theme.css` (импортится из `DataGrid.tsx`): `--tsr-ref-*`
   (primitive) → `--tsr-sys-*` (semantic, тема-зависимы, мост к shadcn-именам) →
   `--tsr-comp-*` (component). Проп `colorMode` вешает класс `.dark` на обёртку грида;
   в dark значения **меняются** в semantic-уровне (не «одинаковы» — см.
   [ADR 0019](0019-token-architecture.md) T-R5). `src/styles/global.css` (`@theme
inline`, палитра «Vercel Inspired») — **только Storybook**, в `dist` не входит.
5. **`cssFileName: 'style'`** в lib mode — чтобы сохранить экспорт `./style.css`
   (Vite 8/Rolldown иначе назвал бы файл по имени пакета).
6. **Только `clsx` для склейки классов.** `cn` (`twMerge(clsx(...))`) и
   `tailwind-merge` удалены вместе с уходом контролов на CSS Modules: разруливать
   конфликтующие Tailwind-утилиты нечего, а `twMerge` на каждый рендер в горячем
   пути грида — оверхед без пользы. Классы склеиваются `clsx` напрямую.
7. **Ошибка декларации роняет сборку.** `vite-plugin-dts` на ошибке генерации
   декларации (например, TS4023: экспортируемый тип ссылается на неэкспортированный
   интерфейс модуля) молча не пишет `.d.ts` этого файла, а `index.d.ts` остаётся
   ссылаться на него — у потребителя ломаются типы при зелёной сборке. Хук
   `afterDiagnostic` в `vite.config.ts` превращает любую диагностику в ошибку
   сборки. Тесты (`__tests__`) и истории в декларации не входят.

## Следствия

- **+** Единый источник правды о стеке; `AGENTS.md` и `docs/**` ссылаются на него
  вместо дублирования перечней, которые устаревают.
- **+** `dist` самодостаточен — потребитель приносит только React, TanStack Table
  и (транзитивно) dnd-kit; примитивы и стили уже внутри.
- **+** Контролы на примитивах Base UI + CSS Modules: полный контроль над разметкой и
  стилями, та же тема-зависимость через токены `--tsr-*`, что и у грида.
- **+** Один слой стилей (CSS Modules) — Tailwind остаётся лишь build-time для
  Storybook; контрибьютор не смешивает утилиты с CSS-модулями.
- **−** Больше размер бандла — примитивы Base UI внутри `dist`.
- **−** Тема грида зависит от токенов: `--tsr-comp-*` тянут `--tsr-sys-*`, а те —
  мост к shadcn-именам с fallback на `--tsr-ref-*` ([ADR 0019](0019-token-architecture.md)).
- ADR **0004–0007 не отменяются** — ядро по-прежнему headless и компонуется, а не
  форкается; этот ADR лишь формализует рантайм-слой контролов и стилизации поверх него.

### Отвергнутые альтернативы

- **Сделать примитивы peer-зависимостями** — переложило бы установку небольшого
  набора библиотек на потребителя и усложнило бы DX ради спорной экономии размера.
  Выбран бандл в `dist`.
- **Стилизовать контролы на CSS Modules, а не на Tailwind** — потеряли бы
  токен-систему и скорость авторства shadcn-контролов. Гибрид оставляет CSS Modules
  там, где они сильны (раскладка грида), и берёт Tailwind там, где силён он (контролы).
- **Не объявлять `motion`** — оставлена как задел под запланированные анимации;
  додержать объявленной дешевле, чем вводить зависимость позже.
