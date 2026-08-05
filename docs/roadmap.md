# Roadmap

Planned forward direction for Tessera. This is **intent**, not a commitment —
distinct from the acknowledged _edges_ (untested/unimplemented gaps) documented in
the architecture docs. Decisions, once made, are recorded as
[ADRs](decisions/README.md).

## Under consideration

- **Migrate to TanStack Table v9.** The strategic fix for v8's core constraint:
  any change to table state or data recalculates the **entire** table model, an
  architecture-level performance hit. Pub-Sub and fast-scroll
  ([ADR 0004](decisions/0004-perf-strategy-pubsub-fastscroll.md)) mitigate this on
  v8 but do not remove it. Migration is being evaluated, not yet decided.

## Planned

- **Full pivot-table support.** First-class pivot mode, with **all existing
  plugins adapted** to work under it.
- **Flexible, customizable appearance.** Grow the theme-agnostic CSS-variable
  layer into a genuinely customizable visual system.
- **Developer experience.** Ongoing DX improvements across the API and tooling.

## Context

The motivation behind the project is in
[architecture/README.md → Why Tessera exists](architecture/README.md#why-tessera-exists).
