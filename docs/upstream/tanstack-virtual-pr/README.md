# PR в TanStack Virtual: пересчёт позиций от первого изменённого ключа

Правка `getMeasurements` из нашего вендора ([ADR 0143](../../decisions/0143-tanstack-virtual-fork.md),
VF4), оформленная для [TanStack/virtual](https://github.com/TanStack/virtual). Подготовлена
2026-10-27 поверх `main` upstream `18d08351` (`@tanstack/virtual-core` 3.19.8 — та же версия,
что в вендоре). PR отправляет автор; принятый PR сокращает `tessera.patch`.

Файл [`0001-measurements-from-first-changed-key.patch`](0001-measurements-from-first-changed-key.patch) —
один коммит:

- `packages/virtual-core/src/index.ts` — сама правка, без пометок Tessera;
- `packages/virtual-core/tests/incremental-measurements.test.ts` — паритет с полным пересчётом
  (дописывание, вставка и удаление в середине, усечение, перестановка, ключи по индексу,
  измеренные размеры) и отсутствие вызовов `estimateSize` для неизменного начала; новая
  `estimateSize` и новый `gap` пересчитывают с нуля;
- `packages/virtual-core/tests/bench.bench.ts` — раздел «Count change»;
- `.changeset/measurements-from-first-changed-key.md` — patch-версия `virtual-core`.

## Что получилось в замере — прочтите до отправки

Бенчмарк: 100 000 строк, на каждой итерации 100 строк добавляются и убираются; операций в
секунду, больше — лучше (Node, Windows, без замедления):

| Место      | Размеры                   | `main` | С правкой   |
| ---------- | ------------------------- | ------ | ----------- |
| В конец    | постоянная `estimateSize` | 919    | 841 (−9 %)  |
| В конец    | все строки измерены       | 296    | 818 (×2,8)  |
| В конец    | дорогая `estimateSize`    | 209    | 818 (×3,9)  |
| В середину | постоянная `estimateSize` | 912    | 806 (−12 %) |
| В середину | все строки измерены       | 277    | 433 (×1,6)  |
| В середину | дорогая `estimateSize`    | 197    | 303 (×1,5)  |

Правка выигрывает, когда строка стоит дорого — измеренные размеры (поиск в `itemSizeCache`)
или нетривиальная оценка, — и проигрывает 9–12 % в самом дешёвом случае: сверка ключей
начала списка стоит столько же, сколько пересчёт строки с постоянной оценкой. Это та же
известная проблема, что в roadmap («Смена числа строк сверяет ключи начала списка»).
Мейнтейнеры почти наверняка спросят про этот случай — ответ есть в тексте PR ниже.

## Как проверить самому

Нужны Git, `gh`, Node из `.nvmrc` upstream (на 2026-10-27 — 24.8.0) и pnpm из их
`packageManager` (11.9.0; `corepack enable && corepack prepare`).
Команды — в Git Bash из любого каталога вне репозитория Tessera.

1. Форк и клон:

   ```bash
   gh repo fork TanStack/virtual --clone --remote
   ```

2. Ветка от свежего `main` и коммит из патча (путь — к этому каталогу):

   ```bash
   cd virtual && git switch -c perf/measurements-from-first-changed-key origin/main
   ```

   ```bash
   git am --3way ~/WebstormProjects/tessera/docs/upstream/tanstack-virtual-pr/0001-measurements-from-first-changed-key.patch
   ```

   Если `main` ушёл вперёд и `git am` остановился на конфликте — разрешить, `git add`, `git am --continue`.

3. Зависимости и проверки пакета:

   ```bash
   pnpm install
   ```

   ```bash
   cd packages/virtual-core && pnpm test:lib && pnpm test:types && pnpm test:eslint
   ```

   Ожидается: все наборы зелёные, в выводе — `incremental-measurements.test.ts` с восемью тестами.

4. Тест падает без правки — откатить только исходник и запустить новый набор:

   ```bash
   git stash push src/index.ts && pnpm vitest run tests/incremental-measurements.test.ts; git stash pop
   ```

   Ожидается: шесть тестов красные (неизменное начало списка снова спрашивает `estimateSize`),
   два — про новую `estimateSize` и `gap` — зелёные.

5. Замер до и после:

   ```bash
   pnpm vitest bench --run -t "Count change"
   ```

   Затем то же с откатом исходника, как в шаге 4. Сравнивать колонку `hz`; цифры другой
   машины будут другими, соотношения — близкими к таблице выше.

   Примеры upstream (`examples/react/*`) для замера не годятся: в них короткие списки с
   постоянной оценкой, где правка ничего не меняет. Выигрыш на живом гриде — в перф-кейсах
   Tessera IS16 и SD46 (ADR 0143).

6. Отправка — после того как шаги 3–5 сошлись:

   ```bash
   git push -u origin perf/measurements-from-first-changed-key
   ```

   ```bash
   gh pr create --repo TanStack/virtual --base main --title "perf(virtual-core): rebuild measurements from the first changed key" --body-file pr-body.md
   ```

   `pr-body.md` — текст из следующего раздела, сохранённый в файл.

## Текст PR

```markdown
## What

When only `count` or `getItemKey` changes, `getMeasurements` for a single-lane list now
keeps the previous build up to the first index whose key differs and rebuilds from there,
instead of from index 0.

The previous build is reused only when every other layout input is the same:
`paddingStart`, `scrollMargin`, `gap`, `estimateSize` identity and the item size cache
version. Multi-lane lists, lane settling and a pending `resizeItem` minimum keep the
current behaviour.

## Why

Appending a page to a long list (infinite scroll, lazy tree children, server-side
pagination) re-estimated and re-looked-up every item before it. With measured items or a
non-trivial `estimateSize`, that dominated the update.

## Benchmark

`pnpm vitest bench --run -t "Count change"`, 100 000 items, 100 items added and removed
per iteration, ops/s (higher is better):

| Where  | Sizes              | main | this PR    |
| ------ | ------------------ | ---- | ---------- |
| end    | constant estimate  | 919  | 841 (−9%)  |
| end    | all items measured | 296  | 818 (×2.8) |
| end    | costly estimate    | 209  | 818 (×3.9) |
| middle | constant estimate  | 912  | 806 (−12%) |
| middle | all items measured | 277  | 433 (×1.6) |
| middle | costly estimate    | 197  | 303 (×1.5) |

The cheapest case is slightly slower: comparing the keys of the unchanged prefix costs
about as much as recomputing items with a constant estimate. If that matters, a follow-up
could accept a hint with the first changed index and skip the comparison.

## Tests

`tests/incremental-measurements.test.ts` checks that the result equals a fresh virtualizer
with the same measured sizes (append, insert and remove in the middle, truncate, swap,
index keys) and that `estimateSize` is not called for the unchanged prefix. Six of the
eight tests fail on `main`.
```
