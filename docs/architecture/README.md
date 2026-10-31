# Tessera — архитектура

`@tessera-grid/tessera` — это headless-first, plugin-driven таблица данных, построенная
поверх **TanStack Table v9** (модель таблицы), **TanStack Virtual** (виртуализация
строк/столбцов) и **dnd-kit** (drag & drop). Tessera не форкает эти библиотеки —
она их компонует и расширяет, добавляя слой рендеринга на плагинах/слотах и
theme-agnostic UI на CSS-переменных. Гранулярная реактивность — штатная, на
**TanStack Store** v9 (`table.atoms`; собственный Pub-Sub снят при миграции с v8,
[ADR 0026](../decisions/0026-migrate-to-tanstack-v9.md)).

> Эта база знаний написана для **контрибьюторов**. Она отражает текущий
> исходный код (сверено с кодом, а не только с README). Там, где раздел описывает
> upstream-библиотеку, это концептуальное резюме, и оно помечено как таковое.

## Зачем нужна Tessera

Tessera решает конкретный класс задач: **highload-таблицы со сложным, гибким
поведением**, которым нужно быть расширяемыми и быстрыми в множестве разных
сценариев. Существующие варианты для этого не подошли:

- **Современные React-киты для таблиц** (например, Material React Table) —
  поставляют стилизованный batteries-included UI, несовместимый с agnostic-целью.
- **AG Grid** — функционально мощный, но с неподходящей моделью лицензирования.
- **Гриды на canvas** — сильны в чистой производительности, но несоразмерно сложны
  в разработке.

Поэтому Tessera была спроектирована с нуля вокруг четырёх приоритетов:

1. **Agnostic** — не привязана ни к одному приложению, дизайн-системе или бэкенду.
2. **Современное ядро** — построение на TanStack Table, а не на самодельной или
   canvas-модели.
3. **Производительность** — виртуализация и гранулярная реактивность как
   first-class-задачи.
4. **Расширяемость снаружи** — командам нужны были действительно разные вещи:
   рендерить свои кнопки в строки, менять поведение таблицы в ответ на внешнее
   состояние и компоновать сложные структуры внутри таблицы. Модель plugin + slot
   - `hooks` существует именно ради этого.

### Аудитория и охват

Tessera нацелена на **любую систему, которой нужны сложные, гибкие табличные
интерфейсы** — highload-сценарии вроде CRM это пример такой системы, а не её
потолок. Гибкий, кастомизируемый
визуальный слой — явная цель (сегодня: theme-agnostic контракт на CSS-переменных;
см. документ о рендеринге).

### Non-goals

- **Не canvas-грид.** Путь DOM + виртуализация — это осознанный размен пиковой
  пропускной способности на управляемость разработки и расширяемость.
- **Не batteries-included стилизованный UI-кит.** Tessera не поставляет
  runtime-библиотеку компонентов; она предоставляет механику и контракты
  переопределения, а финальный визуал оставляет на потребителя.

Проектные решения за этими выборами зафиксированы как ADR в
[`docs/decisions/`](../decisions/).

## Документы

| Документ                                             | Охват                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [upstream-foundations.md](upstream-foundations.md)   | Как работают TanStack Table / Virtual и dnd-kit и в какие точки расширения врезается Tessera          |
| [table-assembly.md](table-assembly.md)               | `useCreateTable`: столбцы, разделение состояния, hooks, слоты, инъекция плагинов                      |
| [plugins-and-slots.md](plugins-and-slots.md)         | Жизненный цикл фичи (v9 `TableFeature`: `assign*Prototype`/`init*`), регистрация слотов, render-слоты |
| [reactivity.md](reactivity.md)                       | Реактивность: идентичность ссылки против гранулярных подписок TanStack Store (`table.atoms`)          |
| [rendering.md](rendering.md)                         | Пайплайн `DataGrid`: стек провайдеров, layout flex против grid, отрисовка, состояния загрузки         |
| [virtualization.md](virtualization.md)               | Два виртуализатора, кастомные range extractors, filler-столбцы, динамическое измерение строк          |
| [dnd.md](dnd.md)                                     | DnD рендер-слоя: обёртки head/body, reorder столбцов и строк, overlay, collision/modifiers            |
| [theming-and-overrides.md](theming-and-overrides.md) | Контракты переопределения: `colorMode` → CSS-переменные, иконки, локализация                          |

## Слои

Tessera намеренно слоистая, чтобы **механика таблицы** и **бизнес-логика
потребителя** никогда не сливались в God object. Данные текут вниз; события текут
вверх через `hooks`; рендеринг управляется состоянием, плагинами и слотами.

```mermaid
flowchart TB
    subgraph consumer["Входы потребителя (стабильные ссылки)"]
        COLS["columns (TanStack column defs)"]
        DATA["data (массив строк)"]
        STATE["state + handlers"]
        HOOKS["hooks (бизнес-контракт)"]
        PLUGINS["plugins (фабрики: встроенные + кастомные, presence-based)"]
        OPTS["ядровые опции (skeleton / loading / footer) / icons / localization / colorMode"]
    end

    subgraph core["Ядро — useCreateTable()"]
        CC["useCreateColumns<br/>(инъекция сервисных столбцов по наличию плагина-владельца)"]
        CS["useCreateState<br/>(разделение core против external)"]
        CH["useCreateHooks"]
        CSL["useCreateSlots"]
        RT["useTable (TanStack v9)<br/>features = buildTesseraFeatures(commonFeature + активные, presence-based)<br/>ядровая row-модель включается автоматически"]
    end

    subgraph inst["Инстанс таблицы"]
        TI["table<br/>+ getHooks / getRenderSlots / setRenderSlot<br/>+ SDK-хелперы"]
    end

    subgraph render["Рендеринг — <DataGrid/>"]
        PROV["IconsProvider · LocalizationProvider<br/>FastScrollProvider"]
        VIRT["виртуализаторы строк + столбцов (TanStack Virtual)"]
        DND["DnD-обёртки (dnd-kit)"]
        UI["Head / Body / Footer → ячейки<br/>+ RenderSlot / FlexRender"]
    end

    COLS --> CC
    DATA --> RT
    STATE --> CS
    HOOKS --> CH
    PLUGINS --> RT
    OPTS --> RT
    CC --> RT
    CS --> RT
    CH --> RT
    CSL --> RT
    RT --> TI
    TI --> render
    PROV --> UI
    VIRT --> UI
    DND --> UI
```

### Слои кода и границы импортов

Схеме выше соответствуют папки `src/lib` с правилами импортов
([ADR 0163](../decisions/0163-layer-boundaries-and-guards.md)):

| Слой                | Что в нём                                                      | Может импортировать                                               |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `util/`             | листовые утилиты: журнал, разбор CSS-времени, хуки окружения   | ничего из `src/lib`                                               |
| `ui/`               | примитивы кита и тема (`ui/theme`)                             | `util`                                                            |
| `core/`             | сборка таблицы, контракт плагинов, реактивность, виртуализация | `util`                                                            |
| `grid/`             | рендер `DataGrid`                                              | `core`, `ui`, `util`                                              |
| `shared/`           | код, общий у двух и более плагинов                             | `core`, `ui`, `util`                                              |
| `plugins/<плагин>/` | плагин                                                         | `core`, `ui`, `util`, `shared`, свои модели цепочки `entry.model` |

Вендор `src/vendor` импортирует любой слой, входы пакета — всё. Код, нужный только плагинам,
живёт в `shared/`, а не в ядре. Стражи `layerBoundaries` и `contractSnapshot` (`npm test`) и
`check:tree-shaking` держат правила; нынешние нарушения — в базе
`src/lib/__tests__/architecture.baseline.ts` с причиной, база только сокращается. Что в ней и
почему — [аудит 2026-10-31](../research/architecture-audit-2026-10-31.md).

## Порядок чтения

1. **upstream-foundations** — чтобы термины TanStack/dnd-kit ниже обрели смысл.
2. **table-assembly** — как собирается инстанс `table`.
3. **plugins-and-slots** — как фичи рендерятся в грид.
4. **reactivity** — как распространяются обновления (история про производительность).
5. **rendering** — как `DataGrid` всё это отрисовывает, а следом — механики
   рендер-слоя: **virtualization**, **dnd** и **theming-and-overrides**.

## Инварианты дизайна

- **Стабильные ссылки.** Смена идентичности `columns` и `data` пересоздаёт модель
  таблицы с нуля (поведение TanStack). Потребители обязаны мемоизировать входы.
- **`hooks` никогда не вызывают перерендер.** Бизнес-колбэки живут в `hooks`; их
  чтение ни на что не подписывается. Динамические значения, которые должны
  управлять рендерингом, живут в `state`.
- **Theme-agnostic.** Нет библиотеки компонентов в рантайме; темизация — это
  контракт на CSS-переменных, управляемый пропом `colorMode`. См. документ о
  рендеринге.
- **Плагины — это TanStack-фичи.** Плагин Tessera строится на v9 `TableFeature`
  (`assign*Prototype`/`init*InstanceData`/`constructTableAPIs`/`getDefaultTableOptions`),
  доставляется записью `TesseraFeatureEntry` (presence-based), а `commonFeature`
  добавляет общий сахар (`getHooks`/`getRenderSlots`/…). См. документ о плагинах.
- **Каждый плагин и компонент покрыт тестами — визуальными и перформанс.** Каждый
  плагин и UI-компонент поставляется с обоими видами тестов — по одному на
  требование спецификации, самовосстанавливающимися, названными по спецификации.
  См. [ADR 0009](../decisions/0009-test-coverage-visual-and-performance.md).
