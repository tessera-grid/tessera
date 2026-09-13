# Спайк: TanStack Table v9

Разведочный прототип к [плану миграции](../../docs/research/tanstack-table-v9-migration-plan.md).
Цель — проверить ключевые гипотезы на **реальном** пакете `@tanstack/react-table@9.2.4`
(поставлен как npm-алиас `@tanstack/table-v9`, сосуществует с текущим v8), а не по памяти.

> Это одноразовая разведка. В сборку библиотеки не входит (лежит вне `src/`), основной
> `npm test`/`typecheck`/`build` её не трогают. v8-код репозитория не затронут.

## Как запустить

```bash
# Доказательство гранулярности состояния (headless, node):
npx vitest run --config spike/tanstack-v9/vitest.config.ts

# Типовой прототип (компиляция против реальных типов v9):
npx tsc --noEmit -p spike/tanstack-v9/tsconfig.json
```

Статус на 2026-09-13: **оба зелёные** (3/3 теста, typecheck без ошибок), основной
`npx tsc --noEmit` репозитория тоже чист (v8-код не сломан).

## Файлы

| Файл | Что показывает |
|---|---|
| `reactivity.test.ts` | ЗАПУСКАЕМОЕ доказательство: смена среза `sorting` не меняет идентичность `columnVisibility`; per-slice атом нотифицирует только свой срез; сортировка реально переупорядочивает модель. Таблица собрана headless через `constructTable` + `storeReactivityBindings()`. |
| `commonFeature.ts` | Порт среза `commonPlugin` как v9-фичи: `getHooks`/`getRenderSlots` → `constructTableAPIs`; `getIsFirstRow` → `assignRowPrototype`; `hooks`/`slots` → опции фичи через `*_FeatureMap`. |
| `registry.ts` | Presence-based сборка `tableFeatures()` из динамического массива записей (наш DX `plugins={[...]}`). |
| `prototype.tsx` | `useTable` + `tableFeatures` + `createColumnHelper` + гранулярная подписка `useSelector(table.atoms.sorting)` + нативный `table.FlexRender`. Компилируется. |

## Выводы по 5 открытым вопросам плана (§7)

**Q-реактивность (главное): снос Pub-Sub подтверждён.**
`table.atoms.<slice>` — это `ReadonlyAtom` с `.get()`/`.subscribe()`; `table.store` —
`ReadonlyStore`. Незатронутый срез сохраняет референсную идентичность (тест `.toBe`),
т.е. `useSelector(table.atoms.X)` даёт ровно ту гранулярность, ради которой написан
`useSubscribeStore`. Наш `src/lib/core/subscribeStore/` заменяется штатным механизмом.

**Q1 — `render`→`columnDef` vs `FlexRender`: в пользу нативного.**
v9 даёт `flexRender` и компонент `table.FlexRender` (`<table.FlexRender header={h} />` /
`cell={c}`). Самописную мутацию `columnDef.header/cell` из нашего `commonPlugin` можно
удалить. В `commonFeature.ts` она намеренно не портирована.

**Q2 — `tableFeatures()` из динамического массива: решаемо, но с компромиссом по типам.**
В рантайме `tableFeatures(x)` ≈ тождество (валидирует слоты, возвращает объект). Слой
presence-based превращается в «слить фрагменты-карты активных записей в один объект →
`tableFeatures()`» (`registry.ts`). НО: полностью динамический массив теряет статическую
валидацию слотов (`ValidateFeatureSlots`) и точный тип набора. Типобезопасный путь —
собирать набор **литералом** (как в `prototype.tsx`). Это развилка для редизайна
`RegistryEntry`: либо DX-массив + ослабленные типы, либо литерал + полная типобезопасность.

**Q4 — `keepFeatureWhenDisabled`: скорее не нужен.**
v9 собирает набор фич в `tableFeatures()` на этапе опций, а прототипы/API ставятся
лениво при первом обращении. Рантайм-тумблинг фичи — это другой объект `features` →
другой `useTable`-инстанс (или внешние атомы). Жёсткой фиксации `_features` «на маунте»,
как в v8, нет. Финально проверить при миграции `columnDragging`/`rowDragging`.

**Q5 — судьба `<TData,THooks,TState,TOptions>`: `TFeatures` ведущий, наши контракты — в опции фич.**
`commonFeature` показывает путь: `hooks`/`slots` (бывш. дженерики `THooks`/кастомные
опции) регистрируются через `TableOptions_FeatureMap`/`Table_FeatureMap` и читаются из
`table.options`. Отдельный глобальный `THooks`-дженерик не нужен — всё едет как опции и
API конкретной фичи. `createColumnHelper<typeof features, Person>()` компилируется.

## Что спайк НЕ покрывает (осознанно)

- **Рендер-счётчик в реальном React** — гранулярность доказана на уровне store (атомы);
  измерение фактических ре-рендеров и перф-сравнение с v8-базлайном — следующий шаг
  плана (фаза 0 + G), на настоящих perf-стори.
- **Остальные 10 плагинов, пиннинг `start/end`, сплит sizing/resizing** — не трогались.
- **Дистрибутив (ESM-only/CJS)** — отдельное решение, кодом не проверяется.

## Вывод

Все пять вопросов имеют рабочие ответы на реальном API; блокеров, делающих миграцию
невозможной, не обнаружено. Главный выигрыш (снос Pub-Sub) подтверждён запускаемым
тестом. Рекомендация плана в силе: оформить ADR 0026 (go/no-go) после перф-замера на
базлайне.
