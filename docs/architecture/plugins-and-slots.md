# Плагины и слоты

**Плагин** Tessera — это v9 `TableFeature` плюс конвенция рендеринга на **слотах** и
переопределениях рендера на уровне ячейки/заголовка. Потребителю плагин доставляется
записью `TesseraFeatureEntry` (presence-based композиция,
[features.ts](../../src/lib/core/features.ts), ADR 0010): фрагмент карты фич живёт в
`entry.slot`, а сервисная колонка, тонкие опции, декларативные слоты/действия и
императивный `setup` — в остальных полях записи.

## Жизненный цикл фичи (v9 `TableFeature`)

```ts
interface TableFeature {
  // однократно, при конструировании инстанса
  constructTableAPIs?(table): void // методы таблицы (getHooks, setRenderSlot, …)
  getDefaultTableOptions?(table): Partial<TableOptions>
  getDefaultColumnDef?(): Partial<ColumnDef>
  getInitialState?(initialState?): TableState

  // методы на ПРОТОТИПЫ (используют this) + начальные данные на инстанс
  assignColumnPrototype?(prototype, table): void
  assignHeaderPrototype?(prototype, table): void
  assignRowPrototype?(prototype, table): void
  assignCellPrototype?(prototype, table): void
  initColumnInstanceData?(column): void
  initHeaderInstanceData?(header): void
  initHeaderGroupInstanceData?(headerGroup): void
  initRowInstanceData?(row): void
  initCellInstanceData?(cell): void
}
```

> **Принципиальный сдвиг с v8:** методы теперь живут на **прототипах** и обращаются к
> `this` (нельзя деструктурировать), а собственные мутабельные данные объекта кладутся
> через `init*InstanceData` — вместо v8-хуков `create*`, замыкавших конкретный
> инстанс.

```mermaid
flowchart TB
    subgraph once["Однократно на инстанс таблицы"]
        GIS["getInitialState → засев состояния"]
        GDO["getDefaultTableOptions / getDefaultColumnDef"]
        CT["constructTableAPIs → аугментация инстанса"]
    end
    subgraph per["Прототипы + init данных объекта модели"]
        CCOL["assignColumnPrototype / initColumnInstanceData"]
        CH["assignHeaderPrototype / initHeader(Group)InstanceData"]
        CR["assignRowPrototype / initRowInstanceData"]
        CC["assignCellPrototype / initCellInstanceData"]
    end
    once --> per
```

> **Модель стоимости.** `constructTableAPIs` / `getDefaultTableOptions` /
> `getInitialState` выполняются **однократно**; `assign*Prototype` — тоже однократно
> (на прототип), но повешенные ими методы зовутся часто, а `init*InstanceData` бежит
> при каждом (пере)создании объекта — держите их дешёвыми.

### `commonFeature` — bootstrap-фича

`commonFeature` — always-on фича ядра; в `constructTableAPIs` она ставит расширения,
от которых зависят каждый другой плагин и UI:

- `table.getHooks()` → `table.options.hooks`
- `table.getRenderSlots()` → `table.options.slots`
- `table.getSlotActions()` → `table.options.slotActions` (дескрипторы действий, ADR 0024)
- `table.getContextMenuActions()` → `table.options.contextMenuActions` (пункты
  контекстного меню, ADR 0030)
- `table.getKeyboardActions()` → `table.options.keyboardActions` (клавиатурные
  действия ячеек: `Space`/`Enter`/`F2`, ADR 0021; упорядочены по `priority`)
- `table.reportPluginError(id, error)` → реестр ошибок плагинов: `logError` один раз
  на плагин + `status: 'error'` в снимке (ADR 0037, PE5). Компоненты слотов и сервисных
  колонок ядро само рендерит в `PluginErrorBoundary` с `id` плагина (метку ставит
  `foldEntries`; PE1–PE2), `setup` (PE3), `diagnose` (PE4) и `reconcile` (PE6) обёрнуты
  в `try/catch`.
- `table.getPluginDiagnostics()` → снимок `active`/`inert` (+`reason`) по каждой
  записи из `table.options.pluginDiagnostics`, считается на момент вызова через
  `diagnose` записи (ADR 0022, PC12–PC14)
- `table.setRenderSlot(params)` → регистрация слота на месте
- плюс хелперы: `getHeaderGroups` (флаги первой/последней группы через
  `initHeaderGroupInstanceData`), `getIsAnyColumnResizing` и флаги на
  колонку/заголовок/строку/ячейку через `assign*Prototype`.

### Согласование состояния: `reconcile`

Поле записи `reconcile(table, { enabled, hooks })` (ADR 0040, §2) ядро зовёт после
каждого рендера таблицы (`useTableEffects`, layout-эффект без зависимостей) у **всех
присутствующих** записей — и у выключенных (SS16), и у «призраков» удалённых после
монтирования (SS19). Хуки у включённой записи живые (`table.getHooks()`), у выключенной —
из самой записи. Назначение — сверить с таблицей состояние, которое переживает
размонтирование компонентов: `cellEditing` так завершает сессию правки, когда строка
ушла из данных (`unavailable`, SS5), плагин выключили или `canEdit` запретил ячейку
вне экрана (`revoke`, SS16). Поле зовётся на каждый рендер — без открытой сессии оно обязано
выходить сразу.

### Сессии действий

Правка, перетаскивание и ресайз — сессии с причиной завершения (ADR 0040):
`commit` зовёт колбэк успеха, остальное (`cancel`/`revoke`/`unavailable`) — колбэк
отмены плагина. Причина проходит через `core/cancelInteraction.ts`: у
перетаскивания — синхронно вокруг синтетического `Escape`, у ресайза — меткой на
событии конца протяжки. Хуки плагина запоминаются на начало сессии
(`holdSessionHooks`), чтобы отмена дошла и при выключенном посреди неё плагине
(SS13, SS16). `Head`/`Body`/`Footer` на время ресайза заморожены memo-компаратором,
поэтому исчезновение колонки посреди протяжки ловит `DataGrid`, а не ручка (SS15).

## Слоты

**Слот** — это именованная точка вставки, рендерящаяся вокруг содержимого
ячейки/заголовка. «Корзины» (`useCreateSlots`):

`leftHeaderSlot`, `rightHeaderSlot`, `leftCellSlot`, `rightCellSlot`,
`actionRowSlot`, `cellSlot`, `toolbarSlot`, `statusBarSlot`.

`toolbarSlot` — табличный слот верхнего тулбара (ADR 0035): компонент получает
`{ table }` (контекста колонки нет), кнопки группируются полем `group`; группы идут
по наименьшему `order`, между ними — разделитель. Кнопку рисует `ToolbarButton`
(семейство F4); вне тулбара она не работает. Тулбар есть, пока есть хоть один активный
`toolbarSlot`; `enableToolbar: true` / `false` это переопределяет (ADR 0046, PB1–PB2).

`statusBarSlot` — табличный слот нижней панели (ADR 0038): сведения о данных
(счётчики, пагинация), компонент получает `{ table }`. Поле `align` (`'start'` по
умолчанию или `'end'`) выбирает сторону, внутри стороны — порядок по `order`
(`resolveStatusBarSides`, `core/statusBar.ts`; SB4). Панель рисуется, пока есть хоть
один активный слот (SB1); `enableStatusBar: true` / `false` это переопределяет
(ADR 0046, PB3). Правило границы: сверху (тулбар) — контролы, снизу —
сведения.

`cellSlot` — особый канал: его компонент-владелец получает собственный рендер
ячейки пропсом `content` и решает, показать его как есть или заместить своим
(инлайн-редактор `cellEditing`). Это единственный канал, подавляющий `{render}`
ячейки; на несколько владельцев одного `cellSlot` ядро выдаёт дев-варн (ADR 0028,
DP16).

Плагины объявляют слоты **декларативно** в записи (`TesseraFeatureEntry.slots`);
`foldEntries` сворачивает слоты активных записей в `table.options.slots`. Императивный
`table.setRenderSlot(...)` от `commonFeature` остаётся как escape-hatch для
пользовательских плагинов.

```ts
// поле записи фичи
slots: [
  {
    id: 'myPlugin', // уникальный id — ключ дедупликации
    slot: 'rightHeaderSlot',
    order: 0, // число = индекс splice, 'last'/undefined = push
    component: MyButton, // либо `render: (ctx) => ReactNode`
  },
]
```

> Слоты рендерят **опаковый** JSX. Кнопки-действия встроенных плагинов (пиннинг/
> сортировка/группировка) на слотах больше **не** живут — они объявляются единым
> дескриптором `slotActions` (см. ниже «Действия слота»); на слотах остаются
> аффордансы (resize-грип `columnSizing`, ручка `columnDragging`) и произвольный
> пользовательский JSX.

Регистрация слота (`registerSlotInto`, `core/createSlots`) **дедуплицирует по `id`**:
если id уже существует в слоте, обновляет `visible/render/component` на месте, иначе
вставляет (по `order`) или пушит. Так что повторная регистрация безопасна и
идемпотентна ([ADR 0010](../decisions/0010-invert-core-plugins-registry.md), IV12).

```mermaid
flowchart LR
    subgraph reg["регистрация слотов (опаковый JSX)"]
        P2["sizing → rightHeaderSlot (resize-грип)"]
        P4["dragging → leftHeaderSlot (ручка)"]
        CUST["кастомный плагин → любой слот"]
    end
    STORE["table.options.slots<br/>(регистрация дедуплицирует по id)"]
    reg --> STORE
    STORE --> RS["RenderSlot маппит slot[] → компоненты<br/>внутри ячеек Head / Body"]
```

При рендере `HeadCell` / `BodyCell` вытягивают релевантный массив слота из
`table.getRenderSlots()` и передают его в `RenderSlot`, который рендерит каждый
зарегистрированный `component`/`render` с контекстом ячейки/заголовка.

## Свой рендер ячейки/заголовка колонки

По умолчанию содержимое рендерится нативным `FlexRender` от `columnDef.cell` /
`columnDef.header`. Чтобы владеть всей колонкой, задайте `cell` / `header`
**компонентом напрямую** в определении (сервисной) колонки — так делают встроенные
сервисные столбцы (чекбокс выбора, expander):

```ts
const leafColumn = {
  id: COLUMN_SELECTION_ID,
  header: HeadSelectionComponent,
  cell: RowSelectionComponent,
}
```

**Показ по условию.** Служебная колонка в `definePlugin` может объявить
`presence(table, context, opts)` — когда она нужна; без поля колонка видна всегда.
Условие смотрит только на исходные строки (`getCoreRowModel`), аргументы фабрики и
свёртку набора (`context.options`, `context.slotActions`), но не на вид. Ложное
условие скрывает колонку сужением среза `columnVisibility` в эффективном состоянии —
идентичность `columns` не меняется. Плагин с условием даёт приложению опцию
`column: 'auto' | 'always'` ([ADR 0050](../decisions/0050-service-column-presence.md)).

Дополнительно `BodyCell` / `HeadCell` уважают **приоритетный** override
`cell.renderComponent` (escape-hatch — если фиче нужно подменить рендерер на уровне
инстанса ячейки через `assignCellPrototype` / `init*InstanceData`).

## Действия слота (дескриптор) и кебаб-меню

Кнопки-действия (пиннинг, сортировка, группировка, действия строки) объявляются не
опаковым слот-компонентом, а **единым дескриптором `SlotAction`** — данными (ADR
0024). Плагин кладёт их в `RegistryEntry.slotActions`; ядро сворачивает реактивно
(как `slots`, маршрутизируя по `slot`) в `table.options.slotActions` и **само решает
подачу**: инлайн иконка-кнопка или строка раскрывающегося кебаб-меню.

```ts
export const pinHeaderAction: HeaderAction = {
  id: 'columnPinning',
  slot: 'rightHeaderSlot',
  order: 0,
  visible: ({ column }) => column.getCanPin(), // применимость (и участие в пороге)
  icon: () => <PinActionIcon />, // компонент — доступ к useIcons
  label: (ctx, labels) => (isPinned(ctx) ? labels.unpin : labels.pin), // labels инъектируются
  active: isPinned, // подсветка инлайн + галочка в меню
  onSelect: togglePin,
}
```

> Поля `visible`/`active`/`label` — чистые функции контекста; их реактивность
> обеспечивает сам компонент действия, подписываясь на нужный срез через
> `useSlice`/`useTableState`. Прежнее поле `subscribe` (ключи Pub-Sub) в v9 убрано.

Дженерик по контексту: `HeaderAction = SlotAction<HeaderComponentProps>` (шапка),
`RowAction = SlotAction<CellComponentProps, 'actionRowSlot'>` (строка). Один движок
(`resolveActionLayout`) и рендереры (`ActionButton`, `ActionMenu`, `ActionsZone`)
обслуживают оба; `ActionsZone` встроена в `HeadCell` (слоты шапки) и `BodyCell`
(колонка действий строки).

Схлопывание включает **плагин-меню** (`headerActionMenu` / `rowActionMenu`): он
объявляет `RegistryEntry.actionMenu` (`{ slots, mode, threshold }`), ядро сворачивает
декларации в карту `table.options.actionMenu` по слотам. Правило **all-or-nothing**:
применимые действия слота либо все инлайн, либо (при достижении порога или
`mode: 'always'`) все схлопнутых — в кебаб (AM10, AM15). Опаковые слот-компоненты не схлопываются
(всегда инлайн), но учитываются в пороге; аффорданс с `countsAsHeaderAction: false`
(resize-грип) — не учитывается (AM14). `menuItems` разворачивает одно действие в несколько
пунктов меню (сортировка → asc/desc/сброс), `adornment` — довесок инлайн-кнопки
(бейдж приоритета). `placement: 'menu'` — действие только для кебаба («Скрыть
колонку», ADR 0035): инлайн не рисуется, но само по себе показывает кебаб, и этот
кебаб считается в пороге одной кнопкой (AM22); без плагина-меню у такого действия нет
поверхности (AM23). `panel(ctx, { close, initialFocusRef })` — **действие с панелью**
(фильтр колонки, [ADR 0045](../decisions/0045-filtering.md)): инлайн-кнопка и пункт
кебаба открывают поповер с этим содержимым (у кебаба — у его кнопки), `onSelect` не
вызывается; фокус при открытии — на `initialFocusRef`, при закрытии — на открывшую
кнопку.

### Асинхронные действия

Пункты меню бывают асинхронными ([ADR 0078](../decisions/0078-async-menu-actions.md)):

- **`disabled(ctx, signal)` может вернуть промис** — проверка доступности на сервере.
  Её запускает сессия меню: при наведении и фокусе на кебабе (или при открытии, если
  сессии ещё нет), до закрытия; закрытие прерывает `signal`. Пока проверка идёт, пункт
  заблокирован с бликом по контуру. Ядро зовёт `disabled` и в рендере — для синхронных
  значений; дескриптор, однажды вернувший промис, рендер больше не вызывает. У
  инлайн-кнопки асинхронный `disabled` не поддержан — кнопка заблокирована, dev-warn.
  `visible` остаётся синхронным.
- **Причина блокировки** — ответ `disabled`: `{ kind: 'done' | 'forbidden', reason? }`
  (`true` — запрещено). Значок у правого края: галочка «уже сделано», замок
  «запрещено» с текстом (без текста пункт только гаснет); отклонённый промис — проверка не удалась: иконка ошибки, пункт доступен,
  нажатие проверяет заново. `reason` — в тултипе и `aria-describedby`.
- **`onSelect` может вернуть промис** — долгое действие. Ожидание и отказ живут в
  always-on срезе `actionStatus` (`actionStatusFeature`) по ключу «цель + действие»
  (`actionTarget`: колонка заголовка или ячейка строки) и переживают виртуализацию.
  Кебаб бликует, пока ждёт хотя бы одно действие, и после отказа держит отметку
  ошибки до открытия меню; имя и тултип кебаба перечисляют ждущие и упавшие
  действия. В пункте отказ — иконка `actionFailed` с полным текстом в тултипе
  (`errorMessage`, иначе текст ошибки). Инлайн-кнопка показывает ожидание кольцом и
  отказ вспышкой.

Пункты кебаба, мини-меню и контекстного меню рисует один компонент
`ActionMenuItems`; запуск выбора — `runMenuAction`.

## Руководство для авторов

- **Каждый встроенный плагин объявляет `diagnose`** ([ADR 0036](../decisions/0036-plugin-contract-diagnostics-and-a11y.md)):
  функция причины инертности (или `neverInert`, если инертным он не бывает). Ядро
  предупреждает о статических причинах при монтировании; причины, зависящие от
  состояния, гейт `getCan*` предупреждает сам через `warnPluginInert` — из той же
  функции, что и `diagnose`. Новый плагин добавляется в карту axe-прогона
  `visual/plugin-a11y.test.tsx` (PQ4), иначе тест падает.

- **Действие-кнопка (пиннинг/сортировка/…), которое может уехать в кебаб-меню** →
  объявите `slotActions: [SlotAction]` в записи реестра (данными), не опаковый
  компонент.
- **Рендерить произвольный JSX в каждой строке/ячейке/заголовке** → объявите слот
  декларативно (`entry.slots`) или императивно `table.setRenderSlot`; такой компонент
  кебаб не схлопывает.
- **Владеть ячейкой/заголовком всего столбца** → задайте `cell`/`header` компонентом
  в определении колонки (или приоритетный `cell.renderComponent`), защитив по id
  столбца.
- **Добавить кастомное состояние таблицы** → `getInitialState` фичи + declaration
  merging через `TableState_FeatureMap`.
- **Добавить кастомные методы/опции** → `constructTableAPIs` / `getDefaultTableOptions`
  фичи + declaration merging через `Table_FeatureMap` / `TableOptions_FeatureMap`.
- **Реагировать на внешние значения внутри компонента плагина** → подписывайтесь на
  срез через `useSlice(table, key)` / `useTableState(table, selector)`
  ([reactivity.md](reactivity.md)); вызывайте бизнес-функции через `table.getHooks()`.
