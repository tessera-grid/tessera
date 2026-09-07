# Открытые проблемы плагинов

Живой трекер недостатков, ограничений и спорных решений во взаимодействии
плагинов. Составлен по анализу кода стыков плагинов (матрица совместимости:
`плагин × плагин`, многоуровневая шапка, вложенность строк, состояния
активен/выключен/заблокирован). Решаем поэтапно; закрытый пункт переносим в ADR
или в историю коммитов, а не удаляем молча.

**Статусы:** `[ ]` не начато · `[~]` в работе · `[x]` закрыто (со ссылкой на
коммит/ADR).
**Уверенность** — насколько уверенно проблема подтверждена по коду (высокая /
средняя / низкая).

---

## A. Похоже на баги

### A1. `onColumnDragEnd`: нет `return` после «дропа мимо цели»

- Статус: `[x]` (коммит `e7d2319`) · Уверенность: **высокая**
- Где: [getColumnDraggingEvents.ts](../src/lib/plugins/columnDragging/getColumnDraggingEvents.ts)
- Суть: после `if (!over) { … }` отсутствует `return`, выполнение продолжается.
  `overOrderIndex = over?.data.current?.orderIndex` становится `undefined`, а
  охранник проверяет `=== null` (не `undefined`) и не отсекает. В итоге
  `onColumnOrderChange(prev => arrayMove(prev, activeOrderIndex, undefined))` —
  порядок колонок может испортиться при отпускании вне зоны.
- Что сделать: добавить `return`; свести проверки к `== null` либо к явному
  `undefined`.

### A2. Побочный вызов хука внутри updater'а состояния

- Статус: `[x]` (коммит `e7d2319`) · Уверенность: **высокая**
- Где: [getColumnDraggingEvents.ts](../src/lib/plugins/columnDragging/getColumnDraggingEvents.ts)
- Суть: `onColumnOrderChange?.(prev => { onColumnDragEnd?.({…}); return arrayMove(…) })`
  — пользовательский `onColumnDragEnd` вызывается **внутри** функции-updater'а. В
  StrictMode/конкурентном рендере updater может выполниться дважды → потребитель
  получит событие дважды. Побочные эффекты в reducer'е — антипаттерн.
- Что сделать: вынести вызов хука из updater'а (посчитать индексы заранее,
  вызвать после).

### A3. `getRowDraggableOffsetLeft` жёстко завязан на rowExpanding и раскладку

- Статус: `[ ]` · Уверенность: **средняя**
- Где: [getRowDraggableOffsetLeft.ts](../src/lib/plugins/rowDragging/getRowDraggableOffsetLeft.ts)
- Суть: `(firstUserColumnIndex - 1) * COLUMN_ACTIONS_SIZE + COLUMN_DRAGGING_SIZE + EXPANDING_DEPTH_OFFSET_PX`.
  Три проблемы:
  1. rowDragging импортит константу из rowExpanding — жёсткая связь плагинов;
  2. `EXPANDING_DEPTH_OFFSET_PX` прибавляется **всегда**, даже когда rowExpanding
     не подключён → отступ уровня вложенности едет;
  3. предполагается, что все лидирующие сервисные колонки шириной
     `COLUMN_ACTIONS_SIZE`, хотя сама dragging-колонка = `COLUMN_DRAGGING_SIZE`
     (24). Набор selection+dragging без expanding считается неверно.
- Что сделать: считать offset суммой реальных ширин лидирующих сервисных колонок;
  глубинный отступ добавлять только при активном rowExpanding.

---

## B. Спорные дизайн-решения (нужно договориться о контракте)

### B1. rowExpanding × rowGrouping — два плагина на один expander

- Статус: `[ ]` · Уверенность: **высокая** (поведение), **открыт** (контракт)
- Где: [rowExpandingPlugin.tsx](../src/lib/plugins/rowExpanding/rowExpandingPlugin.tsx)
- Суть: при `enableGrouping` `getCanExpand` уходит в штатный TanStack, а
  `maxExpandingDepth` молча игнорируется. Владелец раскрытия при обоих включённых
  сейчас — группировка, тихо.
- Обсудить: осознанный ли это контракт? Нужен ли warning/док, что при
  группировке настройки rowExpanding не действуют?

### B2. rowGrouping × rowDragging — жёсткое взаимоисключение без обратной связи

- Статус: `[ ]` · Уверенность: **высокая** (поведение), **открыт** (контракт)
- Где: [rowDraggingPlugin.tsx](../src/lib/plugins/rowDragging/rowDraggingPlugin.tsx)
- Суть: `getCanDrag` → `false` при `enableGrouping`. Ручки исчезают без сигнала
  разработчику.
- Обсудить: оставить тихо, кинуть dev-warning или дать явный API-приоритет?

### B3. rowActions перекрывает контролируемый columnSizing

- Статус: `[ ]` · Уверенность: **высокая**
- Где: [rowActions/registry.ts](../src/lib/plugins/rowActions/registry.ts)
- Суть: авто-сайзинг ширины колонки действий побеждает даже контролируемый
  `columnSizing`. Для сервисной колонки логично, но это скрытое «кто кого».
- Обсудить: зафиксировать инвариант в доках; нужен ли способ переопределить
  ширину через columnSizing?

### B4. Многоуровневая шапка молча выключает три плагина

- Статус: `[ ]` · Уверенность: **высокая**
- Где: [columnDraggingPlugin.tsx](../src/lib/plugins/columnDragging/columnDraggingPlugin.tsx),
  [columnPinningPlugin.tsx](../src/lib/plugins/columnPinning/columnPinningPlugin.tsx),
  [rowDraggingPlugin.tsx](../src/lib/plugins/rowDragging/rowDraggingPlugin.tsx)
- Суть: при `getHeaderGroups().length > 1` отваливаются columnDragging,
  columnPinning, rowDragging. UI-компоненты guard'ят на `getCan*` (мёртвых кнопок
  нет — это плюс), но включив плагин на сгруппированных заголовках, разработчик
  получит тишину.
- Обсудить: ограничение навсегда или пункт roadmap? Документировать
  несовместимость с multi-level header.

### B5. Пользовательский пиннинг — только влево

- Статус: `[ ]` · Уверенность: **высокая**
- Где: [ColumnPinningComponent.tsx](../src/lib/plugins/columnPinning/ColumnPinningComponent.tsx)
- Суть: `nextPinned = isPinned === 'left' ? false : 'left'`. При этом rowActions
  пиннится вправо — асимметрия: right-pin доступен ядру, но не пользователю.
- Обсудить: осознанное сужение или недоделка? Сверить с roadmap.

---

## C. DX / предсказуемость

### C1. `maxExpandingDepth` — семантика и дефолт

- Статус: `[ ]` · Уверенность: **высокая**
- Где: [rowExpandingPlugin.tsx](../src/lib/plugins/rowExpanding/rowExpandingPlugin.tsx)
- Суть: `accessDepth = row.depth < maxExpandingDepth`, дефолт `1` → раскрываются
  только корни (depth 0). Для дерева >2 уровней узлы глубже тоггла не получают,
  пока не поднять `maxDepth`. Имя читается как «максимальная глубина = 1», а
  фактически «строго меньше».
- Обсудить: дефолт `1` правильный? Переименовать / сменить на `<=`? Как минимум
  задокументировать off-by-one.

### C2. Единый сигнал «плагин активен, но инертен»

- Статус: `[ ]` · Уверенность: **средняя** (нужна выработка подхода)
- Суть: сквозная тема B1–B4 — множество тихих отключений (`getCan*` → false). Нет
  единого dev-режима, подсказывающего «плагин X подключён, но не работает из-за Y».
- Обсудить: ввести общий dev-warning канал для инертных плагинов?

### C3. columnSorting × rowDragging — конкуренция за порядок строк

- Статус: `[ ]` · Уверенность: **высокая** (поведение), **открыт** (контракт)
- Суть: кодом не блокируется, но ручной порядок строк и активная сортировка
  противоречат друг другу; итог на стороне потребителя.
- Обсудить: оставить на совести потребителя или блокировать drag при активной
  сортировке (по аналогии с группировкой)?

---

## D. Мелочи / документация

### D1. `multiSort.removal` в типах отсутствует

- Статус: `[ ]` · Уверенность: **высокая**
- Где: [columnSorting/registry.ts](../src/lib/plugins/columnSorting/registry.ts)
- Суть: JSDoc `multiSort` обещает объект `{ max / removal / event }`, но
  `ColumnMultiSortOptions` содержит только `max` и `event`. Либо добавить поле,
  либо поправить комментарий.

### D2. `getDraggableIndex` — возможная устаревшая memo

- Статус: `[ ]` · Уверенность: **низкая** (требует проверки)
- Где: [columnDraggingPlugin.tsx](../src/lib/plugins/columnDragging/columnDraggingPlugin.tsx)
- Суть: memo-ключ только `[_getVisibleLeafColumns(table)]`, тогда как `getCanDrag`
  зависит ещё от пиннинга и глубины шапки. Проверить, меняется ли ссылка на
  массив листовых колонок при смене пиннинга — иначе индекс может залипнуть.

---

## Предлагаемая этапность

1. **Этап 1 — баги drag-end:** A1, A2 (малая кровь, чинятся вместе в
   `getColumnDraggingEvents`).
2. **Этап 2 — контракт тихих отключений:** B1, B2, B4, C2, C3 — сначала решить
   принцип (тихо / warning / явный приоритет), он задаёт, как чинить остальное.
3. **Этап 3 — скрытые связки сервисных колонок:** A3, B3 (offset и авто-сайзинг).
4. **Этап 4 — семантика и охват:** C1 (`maxExpandingDepth`), B5 (right-pin).
5. **Этап 5 — мелочи:** D1, D2.
