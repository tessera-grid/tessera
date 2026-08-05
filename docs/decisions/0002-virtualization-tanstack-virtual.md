# 0002 — Virtualize with TanStack Virtual

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Performance on large datasets was a first-class goal. Rendering all rows (and, for
flat headers, all columns) is untenable, so virtualization was required. Candidates
were evaluated:

- **react-virtuoso** — ergonomic, but virtualizes only along **Y** (list-style).
  Tessera needs **column** virtualization too, not just rows.
- **react-window / react-virtualized** — already dated.
- **TanStack Virtual** — low-level and unopinionated, virtualizes any axis, and
  pairs naturally with the TanStack Table core ([ADR 0001](0001-core-on-tanstack-table.md)).

## Decision

Use **TanStack Virtual** for both **row** virtualization (always) and **column**
virtualization (flat headers only). Accept its low-level nature as the cost of the
control and performance it provides.

## Consequences

- **+** Both axes virtualized; strong measured performance on large grids.
- **+** Consistent mental model and lifecycle with the TanStack Table core.
- **−** It is a **low-level tool**: correct configuration (range extraction,
  measurement, padding) took significant tuning effort and remains the most
  delicate part of the render path.
- **−** Column virtualization is disabled for **nested (multi-level) headers**,
  which use a CSS `grid` layout — a different render path. This is why nested
  headers don't yet combine with column pinning/dragging (a known edge).
- See [rendering-and-virtualization.md](../architecture/rendering-and-virtualization.md)
  for the flex-vs-grid layout split.
