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
- **Импорт ядра** (`react-virtual/index.tsx`): `../virtual-core` вместо `@tanstack/virtual-core`.

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
