/**
 * Юнит-покрытие слот-машинерии (чистые функции): раскладка действий слота и пункты
 * меню — ADR 0024, AM1–AM9, AM20–AM23, AM33; включённые уходят последними — ADR 0156, KA1–KA2.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it, vi } from 'vitest'

import { createEmptyRenderSlots, registerSlotInto } from '../core/createSlots'
import {
  createEmptySlotActions,
  registerSlotActionInto,
  buttonCapacity,
  resolveActionLayout,
  menuDividers,
  resolveMenuItems,
} from '../core/headerActions'
import type { SlotAction } from '../core/headerActions'
import { headerCapacityOf } from '../grid/headerActions/headerCapacity'

const action = (
  over: Partial<SlotAction> & Pick<SlotAction, 'id'>,
): SlotAction => ({
  slot: 'rightHeaderSlot',
  icon: () => null,
  label: () => over.id,
  onSelect: () => {},
  ...over,
})

describe('createSlots: registerSlotInto', () => {
  it('пустой набор содержит все десять слотов', () => {
    expect(Object.keys(createEmptyRenderSlots()).sort()).toEqual(
      [
        'actionRowSlot',
        'cellSlot',
        'leftCellSlot',
        'leftHeaderSlot',
        'rightCellSlot',
        'rightHeaderSlot',
        'toolbarSlot',
        'statusBarSlot',
        'bodyEndSlot',
        'tableEndSlot',
      ].sort(),
    )
  })

  it('IV12: повторная регистрация с тем же id обновляет слот на месте', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, {
      id: 'a',
      slot: 'rightHeaderSlot',
      component: () => null,
    })
    registerSlotInto(slots, {
      id: 'a',
      slot: 'rightHeaderSlot',
      visible: false,
    })
    expect(slots.rightHeaderSlot).toHaveLength(1)
    expect(slots.rightHeaderSlot[0].visible).toBe(false)
  })

  it('order числом вставляет по индексу, без order — в конец', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'a', slot: 'rightHeaderSlot' })
    registerSlotInto(slots, { id: 'b', slot: 'rightHeaderSlot' })
    registerSlotInto(slots, { id: 'c', slot: 'rightHeaderSlot', order: 0 })
    expect(slots.rightHeaderSlot.map(s => s.id)).toEqual(['c', 'a', 'b'])
  })

  // cellSlot — владелец контента ячейки, владение эксклюзивно. Дев-варн ядра
  // (useCreateTable) сигналит по числу владельцев ПОСЛЕ дедупа по id: разные id —
  // конфликт (вкладываются), одинаковый id — схлопнут (не конфликт).
  it('cellSlot: разные id владельцев сосуществуют (сигнал конфликта для дев-варна)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'a', slot: 'cellSlot' })
    registerSlotInto(slots, { id: 'b', slot: 'cellSlot' })
    expect(slots.cellSlot.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('cellSlot: одинаковый id владельца дедуплицируется (не конфликт)', () => {
    const slots = createEmptyRenderSlots()
    registerSlotInto(slots, { id: 'x', slot: 'cellSlot' })
    registerSlotInto(slots, { id: 'x', slot: 'cellSlot' })
    expect(slots.cellSlot).toHaveLength(1)
  })
})

describe('headerActions: registerSlotActionInto', () => {
  it('дедуп по id и вставка по order', () => {
    const actions = createEmptySlotActions()
    registerSlotActionInto(actions, action({ id: 'a' }))
    registerSlotActionInto(actions, action({ id: 'b' }))
    registerSlotActionInto(actions, action({ id: 'c', order: 0 }))
    registerSlotActionInto(actions, action({ id: 'a', disabled: () => true }))
    expect(actions.rightHeaderSlot.map(a => a.id)).toEqual(['c', 'a', 'b'])
    expect(
      actions.rightHeaderSlot
        .find(a => a.id === 'a')
        ?.disabled?.({}, new AbortController().signal),
    ).toBe(true)
  })
})

describe('headerActions: resolveActionLayout', () => {
  const layoutOf = (
    actions: SlotAction[],
    config?: { mode: 'auto' | 'always'; threshold: number },
    opaqueCount = 0,
  ) => resolveActionLayout({ actions, opaqueCount, config, ctx: {} })

  it('AM1: без конфига меню все применимые действия инлайн, схлопывания нет', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a' }), action({ id: 'b' })],
      opaqueCount: 0,
      config: undefined,
      ctx: {},
    })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['a', 'b'])
  })

  it('AM2: auto — применимых меньше порога, все инлайн', () => {
    const layout = layoutOf([action({ id: 'a' }), action({ id: 'b' })], {
      mode: 'auto',
      threshold: 3,
    })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['a', 'b'])
    expect(layout.menu).toEqual([])
  })

  it('AM3: auto — применимых не меньше порога, все схлопываемые в кебабе', () => {
    const layout = layoutOf([action({ id: 'a' }), action({ id: 'b' })], {
      mode: 'auto',
      threshold: 2,
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.inline).toEqual([])
    expect(layout.menu.map(a => a.id)).toEqual(['a', 'b'])
  })

  it('AM4: опаковые компоненты добивают счётчик до порога, но сами в кебаб не уезжают', () => {
    const layout = resolveActionLayout({
      actions: [action({ id: 'a' }), action({ id: 'b' })],
      opaqueCount: 1,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.menu.map(a => a.id)).toEqual(['a', 'b'])
    // Без опаковых тот же набор ниже порога — опаковые и дали схлопывание.
    expect(
      layoutOf([action({ id: 'a' }), action({ id: 'b' })], {
        mode: 'auto',
        threshold: 3,
      }).collapsed,
    ).toBe(false)
  })

  it('AM5: always схлопывает независимо от счётчика', () => {
    const layout = layoutOf([action({ id: 'a' })], {
      mode: 'always',
      threshold: 10,
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.menu.map(a => a.id)).toEqual(['a'])
  })

  it('AM7: collapsible: false остаётся инлайн при схлопывании', () => {
    const layout = resolveActionLayout({
      actions: [
        action({ id: 'a' }),
        action({ id: 'grip', collapsible: false }),
      ],
      opaqueCount: 0,
      config: { mode: 'always', threshold: 0 },
      ctx: {},
    })
    expect(layout.collapsed).toBe(true)
    expect(layout.inline.map(a => a.id)).toEqual(['grip'])
    expect(layout.menu.map(a => a.id)).toEqual(['a'])
  })

  it("AM22: placement:'menu' не рисуется инлайн; кебаб показан и сам считается в пороге одной кнопкой", () => {
    const hide = action({ id: 'hide', placement: 'menu' })
    // pin + кебаб = 2 < 3: pin остаётся кнопкой, кебаб — ради menu-действия.
    const below = resolveActionLayout({
      actions: [action({ id: 'pin' }), hide],
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(below.collapsed).toBe(true)
    expect(below.inline.map(a => a.id)).toEqual(['pin'])
    expect(below.menu.map(a => a.id)).toEqual(['hide'])

    // pin + sort + кебаб = 3: порог достигнут — всё в кебабе, по order.
    const above = resolveActionLayout({
      actions: [
        action({ id: 'pin', order: 0 }),
        action({ id: 'sort', order: 1 }),
        action({ ...hide, order: 2 }),
      ],
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
    })
    expect(above.inline).toEqual([])
    expect(above.menu.map(a => a.id)).toEqual(['pin', 'sort', 'hide'])
  })

  it("AM23: без плагина-меню действие placement:'menu' не показывается нигде", () => {
    const layout = resolveActionLayout({
      actions: [
        action({ id: 'pin' }),
        action({ id: 'hide', placement: 'menu' }),
      ],
      opaqueCount: 0,
      config: undefined,
      ctx: {},
    })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['pin'])
    expect(layout.menu).toEqual([])
  })

  it('AM6: visible(ctx) === false убирает действие целиком и из счётчика', () => {
    const actions = [
      action({ id: 'a', visible: () => false }),
      action({ id: 'b' }),
    ]
    expect(layoutOf(actions).inline.map(a => a.id)).toEqual(['b'])
    // Невидимое не добивает счётчик: одно видимое при пороге 2 — инлайн.
    const layout = layoutOf(actions, { mode: 'auto', threshold: 2 })
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['b'])
  })

  it('AM8: схлопывание с пустым меню невозможно — при одних инлайн-only кебаба нет', () => {
    const layout = layoutOf(
      [
        action({ id: 'grip', collapsible: false }),
        action({ id: 'handle', collapsible: false }),
      ],
      { mode: 'always', threshold: 0 },
    )
    expect(layout.collapsed).toBe(false)
    expect(layout.inline.map(a => a.id)).toEqual(['grip', 'handle'])
    expect(layout.menu).toEqual([])
  })

  it('AM9: порядок по order един для инлайн и меню; смена подачи его не тасует', () => {
    const actions = [
      action({ id: 'c', order: 2 }),
      action({ id: 'a', order: 0 }),
      action({ id: 'b', order: 1 }),
    ]
    expect(layoutOf(actions).inline.map(a => a.id)).toEqual(['a', 'b', 'c'])
    expect(
      layoutOf(actions, { mode: 'always', threshold: 0 }).menu.map(a => a.id),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('headerActions: resolveMenuItems', () => {
  it('AM21: без menuItems одна строка из полей дескриптора: disabled/active по умолчанию false, onSelect зовёт action.onSelect(ctx)', () => {
    const ctx = { cell: 1 }
    const onSelect = vi.fn()
    const items = resolveMenuItems(
      action({ id: 'a', onSelect }),
      ctx,
      {} as never,
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'a', disabled: false, active: false })
    items[0].onSelect()
    expect(onSelect).toHaveBeenCalledWith(ctx)

    const flagged = resolveMenuItems(
      action({ id: 'b', active: () => true, disabled: () => true }),
      ctx,
      {} as never,
    )
    expect(flagged[0]).toMatchObject({ active: true, disabled: true })
  })

  it('AM20: с menuItems возвращает его результат, передавая ctx и labels', () => {
    const ctx = { column: 'age' }
    const labels = { sortAsc: 'ASC' } as never
    const expanded = [
      { id: 'asc', label: 'ASC', onSelect: () => {} },
      { id: 'desc', label: 'DESC', onSelect: () => {} },
    ]
    const menuItems = vi.fn(() => expanded)
    const items = resolveMenuItems(
      action({ id: 'sort', menuItems }),
      ctx,
      labels,
    )
    expect(items).toBe(expanded)
    expect(menuItems).toHaveBeenCalledWith(ctx, labels)
  })
})

describe('menuDividers — разделители подгрупп меню', () => {
  it('AM33: разделитель только рядом с составной подгруппой; одиночные действия подряд — без разделителей', () => {
    const single = { items: 1, labeled: false }
    expect(menuDividers([single, single, single])).toEqual([
      false,
      false,
      false,
    ])
    expect(
      menuDividers([single, { items: 3, labeled: false }, single, single]),
    ).toEqual([false, true, true, false])
    expect(menuDividers([single, { items: 1, labeled: true }, single])).toEqual(
      [false, true, true],
    )
    expect(menuDividers([])).toEqual([])
  })
})

describe('headerActions: кнопки по ширине (ADR 0111)', () => {
  it('GB7: число кнопок в ряд — по ширине, кнопке и отступам; порог действует как прежде, ширина только уменьшает ряд; опаковые не уезжают', () => {
    // 200px, отступы и подпись 80, кнопки 32 с зазором 4: (200 − 80 + 4) / 36 → 3.
    expect(
      buttonCapacity({ width: 200, reserve: 80, button: 32, gap: 4 }),
    ).toBe(3)
    expect(buttonCapacity({ width: 60, reserve: 80, button: 32, gap: 4 })).toBe(
      0,
    )

    const actions = ['a', 'b', 'c', 'd'].map((id, order) =>
      action({ id, order }),
    )
    const config = { mode: 'auto' as const, threshold: 10 }
    const layout = (capacity?: number, opaqueCount = 0, list = actions) =>
      resolveActionLayout({
        actions: list,
        opaqueCount,
        config,
        ctx: {},
        capacity,
      })

    // Помещаются все — как без ширины.
    expect(layout(4).inline.map(a => a.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(layout(undefined).collapsed).toBe(false)
    // Места на 3: две кнопки и кебаб; в кебаб — с конца по order.
    const narrow = layout(3)
    expect(narrow.collapsed).toBe(true)
    expect(narrow.inline.map(a => a.id)).toEqual(['a', 'b'])
    expect(narrow.menu.map(a => a.id)).toEqual(['c', 'd'])
    // Места на 1 — только кебаб.
    expect(layout(1).inline).toEqual([])
    // Опаковый занимает место в ряду и в кебаб не уезжает.
    expect(layout(3, 1).inline.map(a => a.id)).toEqual(['a'])
    // Несворачиваемое остаётся в ряду.
    const pinnedFirst = [
      action({ id: 'x', order: -1, collapsible: false }),
      ...actions,
    ]
    expect(layout(2, 0, pinnedFirst).inline.map(a => a.id)).toEqual(['x'])
    // Порог по-прежнему сворачивает всё, сколько бы ни было места.
    const byThreshold = resolveActionLayout({
      actions,
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
      capacity: 10,
    })
    expect(byThreshold.inline).toEqual([])
    expect(byThreshold.menu).toHaveLength(4)
  })
})

describe('headerActions: включённые уходят в кебаб последними (ADR 0156)', () => {
  const four = ['a', 'b', 'c', 'd'].map((id, order) => action({ id, order }))
  const ids = (list: SlotAction[]) => list.map(a => a.id)
  const layout = ({
    capacity,
    active,
    threshold = 10,
    mode = 'auto' as const,
    list = four,
  }: {
    capacity?: number
    active: string[]
    threshold?: number
    mode?: 'auto' | 'always'
    list?: SlotAction[]
  }) =>
    resolveActionLayout({
      actions: list,
      opaqueCount: 0,
      config: { mode, threshold },
      ctx: {},
      capacity,
      active: new Set(active),
    })

  it('KA1: по ширине в кебаб уходят сначала невключённые сворачиваемые, затем включённые; внутри группы — с конца по order; в ряду — порядок order; кебаб занимает одно место', () => {
    // Места на 3: две кнопки и кебаб. Включённое a держится, уходят невключённые с конца.
    const firstActive = layout({ capacity: 3, active: ['a'] })
    expect(ids(firstActive.inline)).toEqual(['a', 'b'])
    expect(ids(firstActive.menu)).toEqual(['c', 'd'])
    // Включённое d с конца остаётся, в ряду — порядок order, а не «включённые первыми».
    const lastActive = layout({ capacity: 3, active: ['d'] })
    expect(ids(lastActive.inline)).toEqual(['a', 'd'])
    expect(ids(lastActive.menu)).toEqual(['b', 'c'])
    // Включённых больше, чем мест: невключённые ушли все, включённые — с конца.
    const crowded = layout({ capacity: 3, active: ['a', 'c', 'd'] })
    expect(ids(crowded.inline)).toEqual(['a', 'c'])
    expect(ids(crowded.menu)).toEqual(['b', 'd'])
    // Места на 1 — только кебаб, включённые тоже в нём.
    expect(ids(layout({ capacity: 1, active: ['a'] }).inline)).toEqual([])
    // Всё помещается — кебаба нет.
    expect(layout({ capacity: 4, active: ['b'] }).collapsed).toBe(false)
    // Без набора включённых — по `active(ctx)` действия.
    const own = resolveActionLayout({
      actions: four.map(a => (a.id === 'd' ? { ...a, active: () => true } : a)),
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 10 },
      ctx: {},
      capacity: 3,
    })
    expect(ids(own.inline)).toEqual(['a', 'd'])
  })

  it("KA2: по порогу невключённые сворачиваются, включённые остаются в ряду, пока помещаются по ширине; mode: 'always' сворачивает все, включённые тоже", () => {
    // Порог достигнут: в ряду только включённые, кебаб с остальными.
    const byThreshold = layout({ threshold: 3, active: ['b', 'd'] })
    expect(byThreshold.collapsed).toBe(true)
    expect(ids(byThreshold.inline)).toEqual(['b', 'd'])
    expect(ids(byThreshold.menu)).toEqual(['a', 'c'])
    // Ширина режет и включённые: место на 2 — одна включённая и кебаб.
    const narrow = layout({ threshold: 3, active: ['b', 'd'], capacity: 2 })
    expect(ids(narrow.inline)).toEqual(['b'])
    expect(ids(narrow.menu)).toEqual(['a', 'c', 'd'])
    // Включённых нет — всё в кебабе, как прежде (AM3).
    expect(ids(layout({ threshold: 3, active: [] }).inline)).toEqual([])
    // `always` — явный выбор приложения: в кебабе все.
    const always = layout({ mode: 'always', active: ['b', 'd'] })
    expect(always.inline).toEqual([])
    expect(ids(always.menu)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('Вместимость кнопок заголовка с ручкой (ADR 0114)', () => {
  it('CO9: число кнопок в ряд вычитает ширину раскрытой ручки — у перетаскиваемой незакреплённой колонки', () => {
    // Ручка сдвигает подпись на 16: компакт 24 + отступ 4 − отступ содержимого 16 + зазор 4.
    // Колонка без грипа: справа — свой резерв `right`.
    const metrics = {
      reserve: 64,
      right: 16,
      button: 32,
      gap: 4,
      half: 12,
      gripGap: 4,
      handle: 16,
      handleAfterGrip: 24,
    }
    const header = (column?: object) => ({
      index: 0,
      getSize: () => 190,
      ...(column && { column }),
    })
    // 190px: (190 − 80 + 4) / 36 → 3; с ручкой (190 − 96 + 4) / 36 → 2.
    expect(headerCapacityOf(header(), metrics)).toBe(3)
    expect(
      headerCapacityOf(
        header({ getCanDrag: () => true, getIsPinned: () => false }),
        metrics,
      ),
    ).toBe(2)
    expect(
      headerCapacityOf(
        header({ getCanDrag: () => true, getIsPinned: () => 'left' }),
        metrics,
      ),
      'закреплённая — ручки нет',
    ).toBe(3)
    expect(
      headerCapacityOf(
        header({ getCanDrag: () => false, getIsPinned: () => false }),
        metrics,
      ),
    ).toBe(3)
  })
})

describe('Вместимость кнопок заголовка — кнопки грида 28px (ADR 0135)', () => {
  it('GZ5: вместимость — от кнопок грида, промежутков, отступа и зон грипов темы: с ручкой и грипом соседа вторая кнопка — с 166px, третья — со 196px; порог числа действий прежний', () => {
    // Длины токенов темы по умолчанию: отступ 12, наименьшая подпись 48, кнопка 28 с
    // иконкой 16, между кнопками 2, до подписи 4, зона грипа 24, от кнопки до неё 8,
    // ручка 24 — за зоной грипа соседа (12) или на отступе 4.
    const metrics = {
      reserve: 12 + 48,
      right: 12 - (28 - 16) / 2,
      button: 28,
      gap: 2,
      half: 12,
      gripGap: 8,
      handle: 24 + 4 - 12 + 4,
      handleAfterGrip: 24 + 12 - 12 + 4,
    }
    const column = {
      getCanDrag: () => true,
      getIsPinned: () => false,
      getCanResize: () => true,
    }
    const resizable = { column: { getCanResize: () => true } }
    const header = (width: number) => ({
      index: 1,
      getSize: () => width,
      column,
      headerGroup: { headers: [resizable, { column }, resizable] },
    })
    expect(headerCapacityOf(header(135), metrics)).toBe(0)
    expect(headerCapacityOf(header(136), metrics)).toBe(1)
    expect(headerCapacityOf(header(165), metrics)).toBe(1)
    expect(headerCapacityOf(header(166), metrics)).toBe(2)
    expect(headerCapacityOf(header(195), metrics)).toBe(2)
    expect(headerCapacityOf(header(196), metrics)).toBe(3)
    // У последней колонки зона грипа целиком внутри: место справа — вся зона.
    const last = {
      ...header(166),
      index: 2,
      headerGroup: { headers: [resizable, resizable, { column }] },
    }
    expect(headerCapacityOf(last, metrics)).toBe(1)
    // Ширина только уменьшает ряд: порог числа действий сворачивает всё.
    const actions = ['a', 'b', 'c', 'd'].map(id => action({ id }))
    const byThreshold = resolveActionLayout({
      actions,
      opaqueCount: 0,
      config: { mode: 'auto', threshold: 3 },
      ctx: {},
      capacity: headerCapacityOf(header(400), metrics),
    })
    expect(byThreshold.inline).toEqual([])
    expect(byThreshold.menu).toHaveLength(4)
  })
})
