# TanStack Virtual — изменённая копия

Исходники `@tanstack/virtual-core` и `@tanstack/react-virtual` из
[TanStack/virtual](https://github.com/TanStack/virtual) (MIT, © Tanner Linsley) с правками
Tessera ([ADR 0143](../../../docs/decisions/0143-tanstack-virtual-fork.md)). Это не
официальный TanStack: версии, теги и коммиты upstream — в `upstream.json`, наши правки — в
`tessera.patch` и комментариях `Tessera (ADR 0143)` в коде.

Файлы не форматируются Prettier и не проверяются линтом: правка — только через патч.
Страж VF2 (`src/lib/__tests__/vendorVirtual.test.ts`) сверяет вендор с upstream и патчем.

## Правки

- **Пересчёт позиций от места изменения** (`virtual-core/index.ts`, `getMeasurements`): на
  смене `count` или `getItemKey` при прежних отступах, `estimateSize` и кэше размеров
  пересчёт начинается с первого изменённого ключа.
- **Подсказка места изменения** (`virtual-core/index.ts`, опция `getFirstChangedIndex`,
  [ADR 0145](../../../docs/decisions/0145-first-changed-row-hint.md)): индекс вместо сверки
  ключей; в разработке сверяется с ней, неверная подсказка — одно предупреждение.
- **Сдвиг прежних отрезков** (`virtual-core/index.ts`, `getFirstChangedIndex` с `{ from, kept }`,
  `keptRunsOf`, [ADR 0210](../../../docs/decisions/0210-positions-by-shift.md)): на отрезках прежних
  элементов ключ и размер берутся из прежней сборки, начало — нарастающим итогом; в разработке
  каждый перенесённый ключ и размер сверяется с пересчётом, неверный отрезок — одно предупреждение.
- **Пересборка после замеров** (`virtual-core/index.ts`, `getMeasurements` и `resizeItem`,
  [ADR 0218](../../../docs/decisions/0218-text-wrap-and-auto-height.md)): если с прошлой сборки при
  тех же опциях менялись только размеры от `resizeItem`, места пересобираются без ключей и оценок —
  размер прежний, кроме изменённых, начало нарастающим итогом.
- **Пачка размеров** (`virtual-core/index.ts`, `resizeItems`, ADR 0218): размеры нескольких
  элементов одной пачкой, как записи колбэка ResizeObserver, с одним уведомлением.
- **Поправка прокрутки опцией** (`virtual-core/index.ts`, опция
  `shouldAdjustScrollPositionOnItemSizeChange`, ADR 0218): тот же предикат, что поле экземпляра;
  поле главнее.
- **Импорт ядра** (`react-virtual/index.tsx`): `../virtual-core` вместо `@tanstack/virtual-core`.
- **Синхронность по уведомлению** (`react-virtual/index.tsx`, опция `useFlushSync`,
  [ADR 0202](../../../docs/decisions/0202-window-band.md)): булево или функция от
  виртуализатора — решение на каждое уведомление, а не по значению с прошлого рендера; ответ
  `'transition'` ставит перерисовку переходом React
  ([ADR 0203](../../../docs/decisions/0203-whole-window-in-row-portions.md)).
- **Без перерисовки того же окна** (`react-virtual/index.tsx`, `onChange`, ADR 0202):
  уведомление, после которого элементы окна, полный размер и признак прокрутки те же, что
  в последнем коммите, React не перерисовывает.

## Обновление версии

1. Скачать архивы новых версий во временный каталог вне репозитория:
   `npm pack @tanstack/virtual-core@<версия> @tanstack/react-virtual@<версия>` и распаковать.
2. Положить `src/` каждого пакета поверх `virtual-core/` и `react-virtual/`, `LICENSE` — в
   корень вендора.
3. Записать в `upstream.json` версии, теги, коммиты тегов
   (`gh api repos/TanStack/virtual/git/refs/tags/<тег> --jq .object.sha`) и SHA-256 файлов
   upstream с концами строк LF.
4. Наложить патч: `git apply --3way tessera.patch` из каталога вендора; конфликты разрешить
   вручную. Если upstream принял свою версию правки — убрать её из кода.
5. Пересобрать патч против чистых исходников upstream:
   `git -c core.autocrlf=false diff --no-index <чистые> <вендор>` с путями `a/…` и `b/…`.
6. Проверить: `npm run typecheck`, модульный `vendorVirtual`, наборы `virtualization`,
   `core-scroll`, `scroll-stretch`, `server-row-model`, `infinite-scroll`, перф IS16, SD46,
   XS11.
