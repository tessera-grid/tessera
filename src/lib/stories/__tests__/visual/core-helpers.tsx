import type { ReactNode } from 'react'

import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { expect } from 'vitest'

import { SEL, bodyRows, getScroller, headCells } from '../helpers'

// Общие хелперы для набора тестов ядра (core-*.test.tsx). Разбиты по требованиям:
// структура, размеры, роли, визуальные состояния и раскладка при
// прокрутке лежат в отдельных файлах, а всё, что переиспользуется между ними, —
// здесь.

export const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/**
 * Дождаться, пока грид смонтируется и отрисует заголовки и строки. Гейт опирается
 * на контракт селекторов (`.data-grid__head-cell` / `.data-grid__body-row`), а не
 * на текст мока: готовность — это наличие структуры, а не конкретных значений
 * (см. docs/decisions/0009-test-coverage-visual-and-performance.md — запрет хардкода мок-данных).
 */
/** Грид нарисован целиком: рамка первого рендера и порции строк позади (ADR 0203). */
export const waitForGrid = () =>
  expect
    .poll(
      () =>
        headCells().length > 0 &&
        bodyRows().length > 0 &&
        !document.querySelector(
          '[data-portions-pending], [data-tsr-grid-pending]',
        ),
    )
    .toBe(true)

export const bodyCellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(SEL.bodyCell))

interface ColumnSpec {
  id: string
  header: string
  size?: number
  cell?: (info: CellContext<any, any>) => ReactNode
}

/**
 * Собрать явные колонки с известными `header`/`size`/`cell` — seam против
 * дефолтного мока: тест подаёт их через `columnsOverride` и сверяется с ними, а
 * не с литералами `__mocks__/columns`.
 */
export const buildColumns = (specs: ColumnSpec[]): ColumnDef<any, any>[] =>
  specs.map(({ id, header, size, cell }) => ({
    id,
    accessorKey: id,
    header,
    ...(size !== undefined ? { size } : {}),
    ...(cell ? { cell } : {}),
  }))

export const textOf = (el: Element) => el.textContent?.trim() ?? ''

/** Строки в визуальном (сверху вниз) порядке. */
export const rowsTopDown = () =>
  bodyRows().sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
  )

/** Заголовки в визуальном (слева направо) порядке. */
export const headCellsLeftRight = () =>
  headCells().sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  )

/**
 * Разрешить цвет CSS-переменной грида в конкретный rgb: пробник наследует
 * `--tsr-comp-*` от обёртки темы, поэтому `var(--token)` вычисляется так же, как
 * на реальной ячейке. Позволяет сравнивать фактический цвет с обещанным токеном
 * без хрупких хардкод-rgb.
 */
export const resolveVarColor = (expr: string): string => {
  const host = getScroller()
  const probe = document.createElement('span')
  probe.style.color = `var(${expr})`
  host.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  return rgb
}

export const HEAD_HEIGHT_VAR = '--tsr-comp-head-height'
export const ROW_HEIGHT_VAR = '--tsr-comp-row-height'

/** Значение CSS-переменной, вычисленное на реальном узле грида. */
export const cssVar = (name: string) =>
  getComputedStyle(getScroller()).getPropertyValue(name).trim()
