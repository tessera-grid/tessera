# Visual tests — coverage requirements

> This is a **normative** document: it states what visual-test coverage Tessera
> requires, not just how the runner works. For the runner mechanics (Vitest
> browser mode, `composeStories`, existing suites) see the _Tests_ section of
> [`AGENTS.md`](../../AGENTS.md).

Tessera's behaviour is visual and layout-dependent — virtualization, slots, DnD,
theming. A green type-check and a passing unit assertion do not prove the grid
_renders_ the thing a plugin or component promises. Visual tests, run in a real
browser against real layout, are the gate that does.

## Requirements

1. **Full coverage.** Every **plugin** and every **UI component** of the table
   must have visual tests. No plugin and no rendered component ships without them.

2. **One requirement per test.** Each visual test verifies exactly **one**
   concrete requirement drawn from that plugin's or component's specification. A
   test that checks two things is two tests.

3. **Self-restoring.** If a test mutates data, table state, selection, expansion,
   ordering, etc., it must **return the table to its initial state** on
   completion. Tests must not leak state into each other; order of execution must
   not change outcomes.

4. **Spec-driven naming.** Each test is **named after the requirement** it
   verifies, from the plugin/component specification, in a **single consistent
   naming style** across the suite. Reading the test name should tell you which
   spec requirement is covered.

## How this maps to the current setup

- Tests live in `src/lib/stories/__tests__/` and reuse Storybook stories as
  fixtures via `composeStories` (see [`AGENTS.md`](../../AGENTS.md) → _Tests_).
- The requirement above means: for each plugin and component, its spec is the
  checklist. Each line of the spec becomes one named, self-restoring visual test.
- Coverage is measured against the **specification**, not against lines of code —
  a plugin is "covered" when every requirement in its spec has a matching test.

## Why these four rules

- **Full coverage** keeps the plugin/component contract honest: the promise in a
  spec is only real if a browser test holds it to it.
- **One requirement per test** makes failures diagnostic — a red test names the
  exact broken requirement instead of a vague "something in this plugin".
- **Self-restoring** is what lets stories be shared fixtures and lets the suite
  run in any order without cross-test contamination.
- **Spec-driven naming** turns the test list into a readable coverage report:
  the names _are_ the specification, checked.
