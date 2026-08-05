# 0003 — Drag & drop with dnd-kit (columns + hierarchical rows)

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Consumers needed to reorder both **columns** and **rows** by drag & drop — and row
dragging had to work **within hierarchy and grouping**, not just on a flat list.
This is a demanding requirement: a DnD solution had to integrate with
virtualization and the TanStack model without owning layout.

## Decision

Use **dnd-kit** (`@dnd-kit/core`, `sortable`, `modifiers`, `utilities`) for both
column and row drag & drop, including **hierarchical / grouped row** dragging.

## Consequences

- **+** Column reordering and row reordering share one modern, composable DnD
  foundation; order is surfaced back to consumers via `columnOrder` /
  `onColumnOrderChange` and `onRowOrderChange`.
- **+** Hierarchical row dragging (reparenting within groups/trees) works — a
  genuinely hard capability that off-the-shelf grids rarely expose cleanly.
- **−** Getting hierarchical row DnD correct alongside virtualization was
  **very difficult** and is among the most intricate parts of the codebase; changes
  here warrant live Storybook verification.
- **−** Grouping + RowDragging together is **not yet** implemented (believed
  feasible) — a known edge.
- See [rendering-and-virtualization.md](../architecture/rendering-and-virtualization.md)
  for the DnD wrapper/overlay structure.
