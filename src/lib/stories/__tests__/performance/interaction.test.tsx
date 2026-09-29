import { describe, expect, test } from 'vitest'

import {
  headCells,
  measureInteractionWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CPU_THROTTLE_RATE,
  LARGE,
  PERF_TIMEOUT,
  SMALL,
} from './perf-cases'
import { INTERACTION_BUDGET_MS } from '../perf.constants'

// Отзывчивость на ВЗАИМОДЕЙСТВИЕ (INP): выбор ОДНОЙ строки меняет только
// срез rowSelection на одну запись — законной работы минимум (обновить одну строку и
// её чекбокс), поэтому всё остальное во измеренной задаче есть «лишние» ре-рендеры от
// широких подписок компонентов на весь стейт. Шаг стрелкой (keyboardNavigation)
// аналогично меняет лишь активную ячейку и пиновку строки в виртуализаторе.
// Метрика — самая длинная задача главного потока (синхронный blob
// обработчик→рендер→коммит→layout), сверяется с бюджетом RAIL Response под ×4
// CPU-троттлингом.

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const firstRowCheckbox = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-row .row-select-checkbox',
  )

const firstBodyCell = () =>
  document.querySelector<HTMLElement>(
    ".data-grid__body-row[data-index='0'] .data-grid__body-cell[data-kn-cell]",
  )

const clickFirstRowCheckbox = async () => {
  firstRowCheckbox()?.click()
}

const pressArrowDown = async () => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }),
  )
}

// Меню колонок (ADR 0035): кнопка тулбара → поповер с деревом на 1000 колонок.
const COLUMN_VISIBILITY = { enableToolbar: true, enableColumnVisibility: true }

const columnsButton = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="column-visibility-button"]',
  )
const columnsMenu = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')

/** Поповер грузится лениво: ждём настоящий триггер Base UI. */
const waitForColumnsButton = () =>
  expect
    .poll(() => columnsButton()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)

const openColumnsMenu = async () => {
  columnsButton()!.click()
  await expect.poll(() => columnsMenu()?.hasAttribute('data-open')).toBe(true)
}

/** Ввод в контролируемое поле React: нативный сеттер + событие input. */
const typeIntoSearch = async () => {
  const input = columnsMenu()!.querySelector<HTMLInputElement>('input')!
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  setValue.call(input, 'col_9')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

interface InteractionCase {
  id: string
  label: string
  args: Record<string, number | boolean>
  /** Подготовка вне замера (напр. фокус на ячейку). */
  prepare?: () => Promise<void>
  /** Измеряемое взаимодействие. */
  act: () => Promise<void>
  /**
   * Известный недостиг: кейс сверяется с регресс-потолком, а не с бюджетом INP
   * (как P5/P6 в first-render).
   */
  regressionCeiling?: number
}

const CASES: InteractionCase[] = [
  {
    id: 'I1',
    label: 'выбор строки, небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    act: clickFirstRowCheckbox,
  },
  {
    id: 'I2',
    label: 'выбор строки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    act: clickFirstRowCheckbox,
  },
  {
    id: 'I3',
    label:
      'шаг стрелкой, большая выборка, все плагины + клавиатурная навигация',
    args: { ...LARGE, ...ALL_PLUGINS, enableKeyboardNavigation: true },
    prepare: async () => {
      await expect.poll(() => firstBodyCell()).not.toBeNull()
      firstBodyCell()!.focus()
    },
    act: pressArrowDown,
  },
  {
    id: 'I4',
    label: 'скрытие колонки из меню колонок, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    // Смена набора колонок перестраивает грид 1000×1000 со всеми плагинами
    // (~250 мс под ×4); меню — ~40 мс из них. Недостиг ядра, не плагина.
    regressionCeiling: 400,
    act: async () => {
      columnsMenu()!
        .querySelector<HTMLElement>('[data-column-id] [role="checkbox"]')!
        .click()
    },
  },
  {
    id: 'I5',
    label: 'открытие меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: waitForColumnsButton,
    act: async () => columnsButton()!.click(),
  },
  {
    id: 'I6',
    label: 'ввод в поиск меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    act: typeIntoSearch,
  },
]

describe('Отзывчивость взаимодействий (INP)', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args)
        await waitForGrid()
        await c.prepare?.()

        // Нативные события (а не userEvent) — чтобы НЕ мерить тяжёлые проверки
        // видимости userEvent (getComputedStyle/checkVisibility), а только работу
        // приложения: обработчик → обновление стейта → ре-рендер → коммит.
        const result = await measureInteractionWork(c.act)
        const budget = c.regressionCeiling ?? INTERACTION_BUDGET_MS

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'interaction',
          size:
            c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          knownShortfall: c.regressionCeiling !== undefined,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              budgetMs: budget,
              pass: result.longestMs <= budget,
              ...result,
            },
          ],
        })

        // Переключение выбора не переставляет строки/колонки — синхронная работа не
        // должна порождать длинную задачу. Превышение = лишние ре-рендеры (широкие
        // подписки компонентов на весь стейт).
        expect(
          result.longestMs,
          `longest=${result.longestMs.toFixed(1)}ms tasks=${result.taskCount}`,
        ).toBeLessThanOrEqual(budget)
      },
      PERF_TIMEOUT,
    )
  }
})
