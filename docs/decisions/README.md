# Architecture Decision Records

Каждый ADR фиксирует **одно** решение: контекст, который его вынудил, само решение
и последствия (включая то, что было отвергнуто). Формат сознательно лёгкий —
_Контекст → Решение → Последствия_. Файлы нумеруются последовательно и никогда не
перенумеровываются; отменённое решение получает новый ADR, ссылающийся на старый.

| #                                                    | Решение                                                                  | Статус     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| [0001](0001-spec-driven-development.md)              | Spec-driven development: потребность → ADR + список требований           | Принято    |
| [0002](0002-develop-on-master-human-owns-git.md)     | Разработка на `master`; коммиты и пуши остаются за человеком             | Принято    |
| [0003](0003-formalize-tech-stack.md)                 | Формализация технического стека (Tailwind v4 + Base UI + shadcn)         | Принято    |
| [0004](0004-core-on-tanstack-table.md)               | Строим ядро на TanStack Table v8                                         | Принято    |
| [0005](0005-virtualization-tanstack-virtual.md)      | Виртуализация через TanStack Virtual                                     | Принято    |
| [0006](0006-dnd-with-dnd-kit.md)                     | Drag & drop через dnd-kit: плагины rowDragging + columnDragging (D1–D30) | Принято    |
| [0007](0007-reactivity-pubsub.md)                    | Гранулярная реактивность на v8: Pub-Sub                                  | Принято    |
| [0008](0008-fast-scroll.md)                          | Fast-scroll: скелетоны ячеек при быстрой прокрутке                       | Принято    |
| [0009](0009-test-coverage-visual-and-performance.md) | Покрытие тестами: визуальные + перформанс + модульные                    | Принято    |
| [0010](0010-invert-core-plugins-registry.md)         | Инверсия core ↔ plugins: composable-плагины (presence-based)             | Принято    |
| [0011](0011-column-pinning.md)                       | Закрепление столбцов: плагин columnPinning (CP1–CP15)                    | Принято    |
| [0012](0012-column-sorting.md)                       | Сортировка столбцов: плагин columnSorting (CS1–CS13)                     | Принято    |
| [0013](0013-column-sizing.md)                        | Изменение ширины столбцов: плагин columnSizing (CR1–CR15)                | Принято    |
| [0014](0014-row-selection.md)                        | Выбор строк: плагин rowSelection (RS1–RS18)                              | Принято    |
| [0015](0015-row-expanding.md)                        | Раскрытие строк: плагин rowExpanding (RE1–RE11)                          | Принято    |
| [0016](0016-row-grouping.md)                         | Группировка строк: плагин rowGrouping (RG1–RG11)                         | Принято    |
| [0017](0017-ui-components.md)                        | UI-компоненты: контракт и покрытие (IB/TT/SW/SK/LP/IC)                   | Принято    |
| [0018](0018-external-theming.md)                     | Внешняя темизация: переопределяемый слой токенов + тени (TH1–TH8)        | Принято    |
| [0019](0019-token-architecture.md)                   | Архитектура токенов: 3 уровня `--tsr-ref/sys/comp` (T-R1–T-R10, TK1–TK4) | Принято    |
| [0020](0020-accessibility.md)                        | Доступность (a11y): роли, имена, индексы, axe (A1–A5)                    | Принято    |
| [0021](0021-keyboard-navigation.md)                  | Клавиатурная навигация: плагин `keyboardNavigation` (KN1–KN14)           | Предложено |

См. также мотивацию проекта в
[`docs/architecture/README.md` → Зачем существует Tessera](../architecture/README.md#why-tessera-exists).
