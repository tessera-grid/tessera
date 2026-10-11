import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { renderGrid } from '../helpers'
import { submittedCellsSeed } from '../performance/perf-cases'
import baseline from './contrast-baseline.json'
import { contrast, effectiveBg, toRgba } from './a11y-helpers'

// Матрица контраста (ADR 0089, CX1–CX8): WCAG-пороги по отрисованным состояниям грида в
// двух палитрах, двух темах и двух режимах. Текст — 4,5:1 (крупный — 3:1), в повышенном
// контрасте 7:1 (4,5:1); иконки и границы контролов — 3:1. Нарушения, которым нужно
// решение по дизайну, — в `contrast-baseline.json` с причиной; база только сокращается.

type Palette = 'tessera' | 'stories'
type Theme = 'light' | 'dark'
type Mode = 'standard' | 'more'
interface Combo {
  palette: Palette
  theme: Theme
  mode: Mode
}

const COMBOS: Combo[] = (['tessera', 'stories'] as const).flatMap(palette =>
  (['light', 'dark'] as const).flatMap(theme =>
    (['standard', 'more'] as const).map(mode => ({ palette, theme, mode })),
  ),
)
const comboLabel = (c: Combo) => `${c.palette}/${c.theme}/${c.mode}`

/** Роли shadcn, которые мост темы берёт из палитры приложения. */
const PALETTE_ROLES = [
  '--foreground',
  '--background',
  '--card',
  '--muted',
  '--primary',
  '--primary-foreground',
  '--border',
  '--ring',
  '--destructive',
  '--info',
  '--warning',
  '--success',
]

const html = document.documentElement
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

const finishTransitions = () =>
  document
    .getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .forEach(animation => animation.finish())

const applyCombo = async (combo: Combo) => {
  html.classList.toggle('dark', combo.theme === 'dark')
  if (combo.mode === 'more') html.setAttribute('data-tsr-contrast', 'more')
  else html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) {
    if (combo.palette === 'tessera') html.style.setProperty(role, 'initial')
    else html.style.removeProperty(role)
  }
  await frame()
  finishTransitions()
  await frame()
}

const resetCombo = () => {
  html.classList.remove('dark')
  html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) html.style.removeProperty(role)
}

afterEach(resetCombo)

// --- Обход узлов -------------------------------------------------------------------

const style = (el: Element) => getComputedStyle(el)

/** Элемент виден: есть размер, не скрыт, суммарная прозрачность предков не гасит. */
const visible = (el: Element) => {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return false
  if (style(el).visibility !== 'visible') return false
  let opacity = 1
  for (let e: Element | null = el; e; e = e.parentElement) {
    opacity *= Number(style(e).opacity)
  }
  return opacity >= 0.9
}

/** Выключенное WCAG освобождает от контраста. */
const disabled = (el: Element) =>
  !!el.closest(
    '[disabled], [aria-disabled="true"], [data-disabled]:not([data-disabled="false"])',
  )

const ownText = (el: Element) =>
  [...el.childNodes].some(
    node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
  )

const REGIONS: [string, string][] = [
  ['menu', '[role="menu"]'],
  ['popup', '[data-side]'],
  ['toolbar', '[role="toolbar"]'],
  ['head', '.data-grid__head-cell'],
  ['footer', '[class*="footer"]'],
  ['row', '.data-grid__body-row'],
]

/** Стабильное имя узла: область, строка, колонка, подпись. */
const describeNode = (el: Element) => {
  const region =
    REGIONS.find(([, selector]) => el.closest(selector))?.[0] ?? 'panel'
  const row = el.closest('[data-row-id]')?.getAttribute('data-row-id')
  const column = el.closest('[data-column-id]')?.getAttribute('data-column-id')
  const named =
    el.closest('[aria-label]')?.getAttribute('aria-label') ??
    el.closest('[role]')?.getAttribute('role') ??
    el.tagName.toLowerCase()
  return [region, row, column, named].filter(Boolean).join('/')
}

const CONTROLS =
  'button, a[href], [role="button"], [role^="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"]'

const isLarge = (el: Element) => {
  const s = style(el)
  const size = parseFloat(s.fontSize)
  return size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
}

interface Finding {
  key: string
  ratio: number
  need: number
}

/** Нарушения порогов в корнях для одного сочетания. */
const auditRoots = (scenario: string, combo: Combo, roots: Element[]) => {
  const more = combo.mode === 'more'
  const found = new Map<string, Finding>()
  let checked = 0
  const report = (kind: string, el: Element, ratio: number, need: number) => {
    checked++
    if (ratio + 0.005 >= need) return
    const key = `${scenario} | ${comboLabel(combo)} | ${kind} | ${describeNode(el)}`
    const prev = found.get(key)
    if (!prev || prev.ratio > ratio) found.set(key, { key, ratio, need })
  }
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el) || disabled(el)) continue
      if (ownText(el)) {
        const need = isLarge(el) ? (more ? 4.5 : 3) : more ? 7 : 4.5
        report(
          'text',
          el,
          contrast(toRgba(style(el).color), effectiveBg(el)),
          need,
        )
      }
      // Иконка контрола — WCAG 1.4.11; декоративная графика (стрелка поповера) — нет.
      if (el instanceof SVGSVGElement && el.closest(CONTROLS)) {
        const s = style(el)
        const paint = s.stroke !== 'none' ? s.stroke : s.fill
        if (paint && paint !== 'none' && !paint.startsWith('url')) {
          report('icon', el, contrast(toRgba(paint), effectiveBg(el)), 3)
        }
      }
      if (el.getAttribute('role') === 'checkbox') {
        const s = style(el)
        const fill = toRgba(s.backgroundColor)
        const around = effectiveBg(el.parentElement!)
        const ratio =
          fill[3]! > 0.99
            ? contrast(fill, around)
            : contrast(toRgba(s.borderTopColor), around)
        report('control', el, ratio, 3)
      }
    }
  }
  return { findings: [...found.values()], checked }
}

// --- База известных нарушений (CX8) -------------------------------------------------

const known = baseline as Record<string, string>
const seen = new Set<string>()
const ranScenarios = new Set<string>()

const expectClean = (findings: Finding[]) => {
  for (const f of findings) seen.add(f.key)
  const unexpected = findings
    .filter(f => !(f.key in known))
    .map(f => `${f.key} — ${f.ratio.toFixed(2)}:1 < ${f.need}:1`)
  expect(unexpected).toEqual([])
}

/** Прогнать проверку во всех сочетаниях; `prepare` — состояние после переключения. */
const acrossCombos = async (
  scenario: string,
  roots: () => Element[],
  prepare?: () => Promise<void>,
) => {
  ranScenarios.add(scenario)
  const findings: Finding[] = []
  for (const combo of COMBOS) {
    await applyCombo(combo)
    await prepare?.()
    const audit = auditRoots(scenario, combo, roots())
    // Холостой проход (корни пусты, узлы скрыты) — не проверка.
    expect(audit.checked, `${scenario} | ${comboLabel(combo)}`).toBeGreaterThan(
      0,
    )
    findings.push(...audit.findings)
  }
  resetCombo()
  return findings
}

// --- Гриды сценариев ----------------------------------------------------------------

type SeedTable = {
  getCoreRowModel: () => { rows: unknown[] }
  getRowModel: () => { rows: { id: string }[] }
  getAllLeafColumns: () => {
    id: string
    columnDef: { accessorKey?: unknown; accessorFn?: unknown }
  }[]
  setColumnPinning: (value: { start: string[]; end: string[] }) => void
  setRowSelection?: (value: Record<string, boolean>) => void
  setSorting?: (value: { id: string; desc: boolean }[]) => void
  highlight: (target: object, options?: object) => unknown
}

const dataColumns = (t: SeedTable) =>
  t
    .getAllLeafColumns()
    .filter(c => c.columnDef.accessorKey != null || c.columnDef.accessorFn)
    .map(c => c.id)

/** Состояния матрицы — как только появились строки (история подаёт данные эффектом). */
const seed = (apply: (t: SeedTable) => void): TesseraFeatureEntry => ({
  id: 'contrastMatrixSeed',
  setup: table => {
    const t = table as unknown as SeedTable
    let handle = 0
    const run = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        handle = requestAnimationFrame(run)
        return
      }
      apply(t)
    }
    run()
    return () => cancelAnimationFrame(handle)
  },
})

/** Ячейка закреплена слева или справа. */
const pinned = (cell: Element) =>
  ['left', 'right'].includes(cell.getAttribute('data-cell-pinned') ?? '')

const bodyRows = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__body-row'),
]
const wrapper = () =>
  document.querySelector<HTMLElement>(
    '.data-grid-theme[class*="theme-wrapper"]',
  )!

/** Грид состояний тела, шапки, футера и панелей. */
const mountStates = async () => {
  const screen = await renderGrid({
    columnCount: 6,
    dataCount: 40,
    containerHeight: 640,
    height: 560,
    enableRowSelection: true,
    showSelectedCount: true,
    enableRowDragging: true,
    enableRowActionMenu: true,
    enableColumnPinning: true,
    enableColumnSorting: true,
    enableColumnVisibility: true,
    enableQuickSearch: true,
    enableKeyboardNavigation: true,
    enablePagination: true,
    enableFooter: true,
    extraPlugins: [
      seed(t => {
        const columns = dataColumns(t)
        t.setColumnPinning({ start: [columns[0]!], end: [columns.at(-1)!] })
      }),
    ],
  })
  await expect.poll(() => bodyRows().length).toBeGreaterThan(8)
  // Активная сортировка и выбор двух строк — настоящими нажатиями.
  const sortable = () =>
    [...document.querySelectorAll<HTMLElement>('.data-grid__head-cell')].find(
      h => !pinned(h) && h.querySelector('.column-sort__button'),
    )
  await expect.poll(sortable).toBeTruthy()
  const head = sortable()!
  await userEvent.hover(head)
  await userEvent.click(
    head.querySelector<HTMLElement>('.column-sort__button')!,
  )
  await expect
    .poll(() =>
      document.querySelector(
        '[aria-sort="ascending"], [aria-sort="descending"]',
      ),
    )
    .not.toBeNull()
  for (const row of bodyRows().slice(2, 4)) {
    await userEvent.click(row.querySelector<HTMLElement>('[role="checkbox"]')!)
  }
  await expect
    .poll(() => document.querySelectorAll('[data-selected="true"]').length)
    .toBeGreaterThanOrEqual(2)
  await frame()
  return screen
}

const hoverRow = async (selected: boolean) => {
  const row = bodyRows().find(
    r =>
      (r.getAttribute('data-selected') === 'true') === selected &&
      bodyRows().indexOf(r) > 1,
  )!
  const cell = [
    ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
  ].find(c => !pinned(c))!
  await userEvent.hover(cell)
}

const focusActiveCell = async () => {
  const row = bodyRows()[6]!
  const cell = [
    ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell'),
  ].find(c => !pinned(c))!
  cell.focus()
  await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
}

const parkPointer = async () => {
  const park = document.createElement('div')
  park.style.cssText =
    'position:fixed;top:0;left:0;width:6px;height:6px;z-index:2147483647'
  document.body.append(park)
  await userEvent.hover(park)
  park.remove()
}

const headAndFooter = () => [
  ...document.querySelectorAll('.data-grid__head-cell'),
  ...document.querySelectorAll('[class*="footer"]'),
]

const panels = () =>
  [
    wrapper().querySelector('[role="toolbar"]'),
    wrapper().querySelector('[data-status-bar] [class*="status"]') ??
      [...wrapper().children].at(-1),
  ].filter((el): el is Element => !!el)

describe('Матрица контраста (ADR 0089)', () => {
  test('CX1: тело — текст, иконки и флажки во всех состояниях строки и видах ячейки, обе темы, оба режима', async () => {
    await mountStates()
    await focusActiveCell()
    const findings: Finding[] = []
    for (const selected of [false, true]) {
      await hoverRow(selected)
      findings.push(
        ...(await acrossCombos(
          `CX1 hover-${selected ? 'selected' : 'plain'}`,
          bodyRows,
        )),
      )
    }
    expectClean(findings)
  })

  test('CX2: наложения — подсветка трёх тонов, диапазон ячеек, ожидание и ошибка ячейки', async () => {
    let table: SeedTable | undefined
    await renderGrid({
      columnCount: 6,
      dataCount: 30,
      enableCellEditing: true,
      enableCellSelection: true,
      enableColumnPinning: true,
      extraPlugins: [
        submittedCellsSeed(6, 'mixed'),
        seed(t => {
          table = t
          t.setColumnPinning({ start: [dataColumns(t)[0]!], end: [] })
        }),
      ],
    })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(14)
    // Подсветки — после того как история подала данные: цель должна быть в модели.
    const rowId = (index: number) =>
      bodyRows()[index]!.getAttribute('data-row-id')!
    const columns = dataColumns(table!)
    table!.highlight({ row: rowId(7) }, { tone: 'danger' })
    table!.highlight({ row: rowId(8) }, { tone: 'warning' })
    table!.highlight({ cell: [rowId(9), columns[2]!] }, { tone: 'success' })
    table!.highlight({ column: columns[3]! }, { tone: 'success' })
    await expect
      .poll(() =>
        [7, 8].every(i => bodyRows()[i]!.hasAttribute('data-highlight')),
      )
      .toBe(true)
    await expect
      .poll(
        () =>
          document.querySelectorAll(
            `.data-grid__body-cell[data-column-id="${columns[3]}"][data-column-highlight]`,
          ).length,
      )
      .toBeGreaterThan(0)
    // Диапазон ячеек: нажатие и Shift-нажатие — подготовка состояния.
    const cellAt = (row: number, col: number) =>
      bodyRows()[row]!.querySelectorAll<HTMLElement>(
        '.data-grid__body-cell:not([data-cell-pinned="left"]):not([data-cell-pinned="right"])',
      )[col]!
    const press = (cell: HTMLElement, shiftKey = false) => {
      const init = { bubbles: true, cancelable: true, button: 0, shiftKey }
      cell.dispatchEvent(new MouseEvent('mousedown', init))
      document.dispatchEvent(new MouseEvent('mouseup', init))
    }
    press(cellAt(11, 1))
    press(cellAt(13, 2), true)
    await expect
      .poll(() => document.querySelector('[data-cell-selected="true"]'))
      .not.toBeNull()
    await parkPointer()
    // Все наложения на месте перед проходом.
    expect(
      document.querySelectorAll('.data-grid__body-row[data-highlight]').length,
    ).toBe(2)
    expect(document.querySelector('[data-column-highlight]')).not.toBeNull()
    expectClean(await acrossCombos('CX2 overlays', bodyRows))
  })

  test('CX3: шапка и футер — покой, наведение, активная сортировка, закрепление', async () => {
    await mountStates()
    await parkPointer()
    const findings = await acrossCombos('CX3 rest', headAndFooter)
    const head = [
      ...document.querySelectorAll<HTMLElement>('.data-grid__head-cell'),
    ].find(c => !pinned(c) && c.offsetWidth > 40)!
    await userEvent.hover(head)
    findings.push(...(await acrossCombos('CX3 hover', headAndFooter)))
    expect(
      document.querySelector('[aria-sort]:not([aria-sort="none"])'),
    ).not.toBeNull()
    expectClean(findings)
  })

  test('CX4: панели — тулбар, быстрый поиск, пагинация, счётчик выбранного', async () => {
    await mountStates()
    await parkPointer()
    expect(wrapper().querySelector('[role="toolbar"] input')).not.toBeNull()
    expect(panels().length).toBe(2)
    expectClean(await acrossCombos('CX4 panels', panels))
  })

  test('CX5: поповеры — пункт в покое, под указателем и выбранный, тултип', async () => {
    await mountStates()
    // Меню «Колонки»: пункты-флажки, выбранные и нет, один под клавиатурой.
    const columnsButton = wrapper().querySelector<HTMLElement>(
      '[role="toolbar"] button[aria-haspopup]',
    )!
    columnsButton.focus()
    await userEvent.keyboard('{Enter}')
    const popup = () =>
      document.querySelector('[role="menu"], [role="dialog"], [data-side]')
    await expect.poll(popup).not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    const menu = popup()!
    const findings = await acrossCombos('CX5 menu', () => [popup()!])
    expect(
      menu.querySelector('[aria-checked="true"], [data-checked]'),
    ).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(popup).toBeNull()

    // Тултип кнопки тулбара.
    await userEvent.hover(columnsButton)
    const tooltip = () =>
      [...document.querySelectorAll<HTMLElement>('[data-side]')].find(el =>
        el.textContent?.trim(),
      )
    await expect.poll(tooltip).toBeTruthy()
    findings.push(...(await acrossCombos('CX5 tooltip', () => [tooltip()!])))
    expectClean(findings)
  })

  test('CX6: матрица идёт на двух палитрах — запасной и палитре историй', async () => {
    await mountStates()
    const border = async (palette: Palette) => {
      await applyCombo({ palette, theme: 'light', mode: 'more' })
      return style(wrapper()).borderTopColor
    }
    // Палитры различаются там, где надстройка поднимает запасную роль.
    expect(await border('tessera')).not.toBe(await border('stories'))
    expect(COMBOS.map(comboLabel)).toHaveLength(8)
    expect(new Set(COMBOS.map(c => c.palette))).toEqual(
      new Set(['tessera', 'stories']),
    )
  })

  test('CX7: axe — нарушений нет, incomplete на тексте только по разобранным причинам', async () => {
    await mountStates()
    await focusActiveCell()
    await hoverRow(true)
    // Разобранные причины, по которым axe не считает контраст (`messageKey` проверки):
    // каждую закрывает свой расчёт CX1–CX5, у каждой — обоснование. Ошибка axe
    // (`error-occurred`) снимает правило целиком — разобранной не бывает.
    const ALLOWED: Record<string, string> = {}
    const reasonOf = (node: axe.NodeResult) => {
      const check = [...node.any, ...node.all, ...node.none][0]
      return check?.id === 'error-occurred'
        ? `ошибка axe: ${(check.data as { message?: string } | null)?.message}`
        : (check?.data as { messageKey?: string } | null)?.messageKey
    }
    const nodeName = (node: axe.NodeResult) => {
      const el = document.querySelector(node.target.join(' '))
      return el ? describeNode(el) : node.target.join(' ')
    }
    const problems: string[] = []
    for (const combo of COMBOS) {
      await applyCombo(combo)
      const rule =
        combo.mode === 'more' ? 'color-contrast-enhanced' : 'color-contrast'
      const result = await axe.run(wrapper(), { runOnly: [rule] })
      for (const v of result.violations) {
        for (const node of v.nodes) {
          const key = `CX7 | ${comboLabel(combo)} | axe | ${nodeName(node)}`
          seen.add(key)
          if (!(key in known)) problems.push(`${key}: ${node.failureSummary}`)
        }
      }
      for (const v of result.incomplete) {
        for (const node of v.nodes) {
          const reason = reasonOf(node)
          if (reason && reason in ALLOWED) continue
          problems.push(
            `CX7 incomplete | ${comboLabel(combo)} | ${nodeName(node)} | ${reason ?? 'без причины'}`,
          )
        }
      }
    }
    ranScenarios.add('CX7')
    resetCombo()
    expect(problems).toEqual([])
  })

  test('CX8: база известных нарушений только сокращается', () => {
    // У каждой записи — причина; запись прогнанного сценария, которой больше нет, — устарела.
    expect(
      Object.entries(known).filter(([, reason]) => !reason.trim()),
    ).toEqual([])
    const stale = Object.keys(known).filter(key => {
      const scenario = key.split(' | ')[0]!
      return ranScenarios.has(scenario) && !seen.has(key)
    })
    expect(stale).toEqual([])
  })
})
