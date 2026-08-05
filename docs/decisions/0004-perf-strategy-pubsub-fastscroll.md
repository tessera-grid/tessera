# 0004 — Performance strategy on TanStack v8: Pub-Sub + fast-scroll

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

TanStack Table v8 has an architectural performance cost: **any change to table
state or data recalculates the entire table model**, which cascades into
re-rendering large numbers of cells. On highload grids this is felt directly. A
stack change (to a future TanStack v9) is **under consideration** as the long-term
fix, but we needed performance **without** changing the stack in the meantime.

Two distinct pressures: (1) broad re-renders when state changes, and (2) the JS
render stack being overwhelmed by mounting/painting huge numbers of cells during
rapid scrolling.

## Decision

Introduce two mechanisms on top of v8:

1. **Pub-Sub reactivity** (`useSubscribeStore`) — cells/headers subscribe to
   exactly the state they care about and re-render only when their primitive
   snapshot changes, **without rebuilding any model**.
2. **Fast-scroll** (`FastScrollProvider`) — during rapid scrolling, render
   lightweight skeleton cells instead of full content, so the render stack isn't
   flooded; real content fills in once scrolling settles.

## Consequences

- **+** Granular updates: state changes no longer imply a full re-render; `hooks`
  need not be memoized to stay performant.
- **+** Smooth rapid scrolling on large datasets; the JS stack stays bounded.
- **−** Pub-Sub granularity is a **React bail-out, not addressed delivery**:
  `notify()` still wakes every subscriber, each recomputing its snapshot. Fan-out
  with thousands of subscribers is **unmeasured** — a known edge; a possible future
  direction is keyed/selector-based notification.
- **−** These mitigate but do not remove v8's root cause. A migration to
  **TanStack Table v9** is **under consideration** as the real fix, where the
  full-model-recalc behavior would be addressed at the architecture level (see
  [roadmap](../roadmap.md)).
- See [reactivity.md](../architecture/reactivity.md) for the mechanism in depth.
