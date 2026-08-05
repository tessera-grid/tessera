# Architecture Decision Records

Each ADR captures **one** decision: the context that forced it, the decision
itself, and the consequences (including what was rejected). Format is deliberately
light — _Context → Decision → Consequences_. Files are numbered sequentially and
never renumbered; a superseded decision gets a new ADR that references the old one.

| #                                                | Decision                                                  | Status   |
| ------------------------------------------------ | --------------------------------------------------------- | -------- |
| [0001](0001-core-on-tanstack-table.md)           | Build the core on TanStack Table v8                       | Accepted |
| [0002](0002-virtualization-tanstack-virtual.md)  | Virtualize with TanStack Virtual                          | Accepted |
| [0003](0003-dnd-with-dnd-kit.md)                 | Drag & drop with dnd-kit (columns + hierarchical rows)    | Accepted |
| [0004](0004-perf-strategy-pubsub-fastscroll.md)  | Performance strategy on v8: Pub-Sub + fast-scroll         | Accepted |
| [0005](0005-develop-on-master-human-owns-git.md) | Develop on `master`; commits and pushes stay with human   | Accepted |
| [0006](0006-formalize-tech-stack.md)             | Formalize the tech stack (Tailwind v4 + Base UI + shadcn) | Accepted |

See also the project rationale in
[`docs/architecture/README.md` → Why Tessera exists](../architecture/README.md#why-tessera-exists).
