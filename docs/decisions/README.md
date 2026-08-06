# Architecture Decision Records

Каждый ADR фиксирует **одно** решение: контекст, который его вынудил, само решение
и последствия (включая то, что было отвергнуто). Формат сознательно лёгкий —
_Контекст → Решение → Последствия_. Файлы нумеруются последовательно и никогда не
перенумеровываются; отменённое решение получает новый ADR, ссылающийся на старый.

| #                                                   | Решение                                                        | Статус  |
| --------------------------------------------------- | -------------------------------------------------------------- | ------- |
| [0001](0001-spec-driven-development.md)             | Spec-driven development: потребность → ADR + список требований  | Принято |
| [0002](0002-develop-on-master-human-owns-git.md)    | Разработка на `master`; коммиты и пуши остаются за человеком   | Принято |
| [0003](0003-formalize-tech-stack.md)                | Формализация технического стека (Tailwind v4 + Base UI + shadcn) | Принято |
| [0004](0004-core-on-tanstack-table.md)              | Строим ядро на TanStack Table v8                               | Принято |
| [0005](0005-virtualization-tanstack-virtual.md)     | Виртуализация через TanStack Virtual                           | Принято |
| [0006](0006-dnd-with-dnd-kit.md)                    | Drag & drop через dnd-kit (колонки + иерархические строки)     | Принято |
| [0007](0007-reactivity-pubsub.md)                   | Гранулярная реактивность на v8: Pub-Sub                        | Принято |
| [0008](0008-fast-scroll.md)                         | Fast-scroll: скелетоны ячеек при быстрой прокрутке             | Принято |
| [0009](0009-rowdragging-plugin.md)                  | Плагин rowDragging: реализация                                 | Принято |
| [0011](0011-columndragging-plugin.md)               | Плагин columnDragging: реализация                              | Принято |

См. также мотивацию проекта в
[`docs/architecture/README.md` → Зачем существует Tessera](../architecture/README.md#why-tessera-exists).
