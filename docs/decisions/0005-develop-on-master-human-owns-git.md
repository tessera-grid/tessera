# 0005 — Develop on `master`; commits and pushes stay with the human

- **Status:** Accepted
- **Date:** 2026-08-05

## Context

Agent work had been landing on ad-hoc `claude/*` branches and worktrees, while the
guidance in [AGENTS §6](../../AGENTS.md#6-constraints) still named `main` as the
default and told the agent to "create a branch first." The result was branch
sprawl and an ambiguous `main`-vs-`master` story: in-progress work scattered across
throwaway branches, and the human left to reconcile it.

The human wants one predictable place for work-in-progress and full control over
history and the remote. The repo already follows a Conventional-Commits style
(`feat(theme): …`, `fix(ui): …`, `refactor(ui): …`, `chore(shadcn): …`).

## Decision

**All development happens on `master`. The agent never commits or pushes on its
own; the human owns git.**

Concretely:

- **`master` is the working branch.** Do not spin up `claude/*` / feature branches
  for routine work — edit `master`'s working tree directly.
- **The agent does not commit or push.** No autonomous `git commit`, no `git push`
  — under any framing. Leave staged/unstaged changes for the human to review and
  commit. (This tightens the "requires approval" line in AGENTS §6 into an
  unconditional one for commit/push.)
- **Commits are atomic, with clear messages.** When commits are made, each is one
  coherent, reviewable change with a descriptive Conventional-Commits subject
  matching repo history. Keep the working tree coherent so a change can be staged
  and described on its own.

## Consequences

- **+** A single source of in-progress truth on `master`; no branch sprawl and no
  `main`-vs-`master` ambiguity.
- **+** The human controls history and the remote — nothing is committed or pushed
  without them.
- **+** Atomic, well-described commits keep the log readable and reviewable.
- **−** No isolated branch per task: several in-flight changes share one working
  tree, so the agent must keep edits scoped and reviewable, and the human stages
  selectively when committing.
- **Supersedes** the earlier AGENTS §6 guidance ("default branch is `main`; if
  you're on a default branch, create a branch first"), which is updated to point
  here.
