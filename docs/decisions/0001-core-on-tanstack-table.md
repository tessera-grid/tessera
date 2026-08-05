# 0001 — Build the core on TanStack Table v8

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Tessera had to deliver flexible, extensible, high-performance tables for varied
(originally CRM) use cases. The existing and off-the-shelf options were each
disqualified:

- **react-base-table** — the incumbent, effectively abandoned for years.
- **Material React Table** and similar modern kits — incompatible with the host
  project's dated stack.
- **AG Grid** — capable, but the licensing cost was not payable.
- **Canvas-rendered grids** — strong raw performance, but a disproportionate
  development burden for the flexibility/extensibility we needed.

We needed a **headless, agnostic model** we could extend from the outside, not a
styled product or a rendering engine we'd have to build and maintain ourselves.

## Decision

Build Tessera's table model on **TanStack Table v8**, composed (never forked) and
extended through its `_features` / `TableFeature` extension point. TanStack owns
the model, state, and columns; Tessera adds the plugin/slot layer, reactivity, and
theming on top.

## Consequences

- **+** A modern, well-maintained, headless core; no bespoke model to maintain.
- **+** The `TableFeature` API becomes Tessera's native plugin substrate — every
  plugin _is_ a TanStack feature with extra lifecycle sugar.
- **+** Agnostic by construction: no design system or backend assumptions baked in.
- **−** We inherit TanStack v8's architectural cost: state/data changes trigger a
  full model recalculation. This is the root perf constraint addressed in
  [ADR 0004](0004-perf-strategy-pubsub-fastscroll.md) and motivates a possible
  future migration to v9 (**under consideration**; see [roadmap](../roadmap.md)).
- Deliberately **not** a canvas grid — a trade of peak throughput for
  extensibility and development tractability.
