/**
 * Headless/чистые проверки плагина cellSelection и ядровой сериализации буфера.
 * Требования CRS8, CRS10, CRS17–CRS24 из docs/decisions/0029-cell-range-selection.md — каждое
 * отдельным именованным тестом (ADR 0009).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { describe, expect, it } from 'vitest'

import {
  cellRangesToHtml,
  cellRangesToTsv,
  hasSelectedCells,
} from '../core/clipboard'
import { foldEntries } from '../core/features'
import { cellSelection } from '../plugins/cellSelection'
import type { CellSelectionPredicateCell } from '../plugins/cellSelection/types'

// Фейковая ячейка для предиката выбираемости (duck-typed под stock-фичу).
const fakeCell = (
  isActions = false,
  columnId = 'name',
): CellSelectionPredicateCell => ({
  id: `r1_${columnId}`,
  column: {
    id: columnId,
    getIsActionsColumn: () => isActions,
  },
  row: { id: 'r1', original: { name: 'Alice', age: 30 }, depth: 0 },
  getValue: () => 'Alice',
})

const predicateOf = (options: object) =>
  foldEntries([cellSelection(options)] as never).options
    .enableCellSelection as (cell: CellSelectionPredicateCell) => boolean

describe('cellSelection — сериализация буфера (CRS8)', () => {
  it('CRS18: TSV — колонки табом, строки переводом строки, регионы пустой строкой', () => {
    const regions = [
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
    ]
    expect(cellRangesToTsv(regions)).toBe('a\tb\nc\td')

    const twoRegions = [[['a']], [['b']]]
    expect(cellRangesToTsv(twoRegions)).toBe('a\n\nb')
  })

  it('CRS17: null/undefined → пустая строка', () => {
    expect(cellRangesToTsv([[[null, undefined, 0]]])).toBe('\t\t0')
  })

  it('CRS8: поля с табом/переводом строки/кавычкой экранируются (CSV-quoting)', () => {
    expect(cellRangesToTsv([[['a\tb']]])).toBe('"a\tb"')
    expect(cellRangesToTsv([[['a\nb']]])).toBe('"a\nb"')
    expect(cellRangesToTsv([[['say "hi"']]])).toBe('"say ""hi"""')
    expect(cellRangesToTsv([[['plain']]])).toBe('plain')
  })

  it('CRS19: HTML — таблица на регион, спецсимволы экранированы', () => {
    expect(cellRangesToHtml([[['a', 'b']]])).toBe(
      '<table><tr><td>a</td><td>b</td></tr></table>',
    )
    expect(cellRangesToHtml([[['<x> & y']]])).toBe(
      '<table><tr><td>&lt;x&gt; &amp; y</td></tr></table>',
    )
  })

  it('CRS20: hasSelectedCells — пустые массивы/регионы → false', () => {
    expect(hasSelectedCells([])).toBe(false)
    expect(hasSelectedCells([[]])).toBe(false)
    expect(hasSelectedCells([[[]]])).toBe(false)
    expect(hasSelectedCells([[['x']]])).toBe(true)
  })
})

describe('cellSelection — гейтинг и предикат (CRS10/CRS11)', () => {
  it('CRS10: enabled:false → все enable* жёстко false (present-but-disabled)', () => {
    const { options } = foldEntries([
      cellSelection({ enabled: false }),
    ] as never)
    expect(options.enableCellSelection).toBe(false)
    expect(options.enableCellRangeSelection).toBe(false)
    expect(options.enableCellSelectionDrag).toBe(false)
    expect(options.enableMultiCellRangeSelection).toBe(false)
  })

  it('по умолчанию enable* включены, enableCellSelection — предикат', () => {
    const { options } = foldEntries([cellSelection()] as never)
    expect(typeof options.enableCellSelection).toBe('function')
    expect(options.enableCellRangeSelection).toBe(true)
    expect(options.enableCellSelectionDrag).toBe(true)
    expect(options.enableMultiCellRangeSelection).toBe(true)
  })

  it('CRS21: дефолтный предикат исключает сервисные колонки (действия)', () => {
    const { options } = foldEntries([cellSelection()] as never)
    const predicate = options.enableCellSelection as (
      cell: CellSelectionPredicateCell,
    ) => boolean
    expect(predicate(fakeCell())).toBe(true)
    // Служебные колонки, и колонка действий строки тоже, — по метке ядра (ADR 0165).
    expect(predicate(fakeCell(true))).toBe(false)
  })

  it('CRS22: пользовательский canSelectCell сужает выбор — запрещённая им ячейка не выделяется', () => {
    const predicate = predicateOf({
      canSelectCell: (cell: CellSelectionPredicateCell) =>
        cell.column.id !== 'age',
    })
    expect(predicate(fakeCell(false, 'age'))).toBe(false)
    expect(predicate(fakeCell(false, 'name'))).toBe(true)
  })

  it('CRS23: предикат получает id, column.id, row.id/original/depth и getValue() без приведения типа', () => {
    const seen: unknown[] = []
    const predicate = predicateOf({
      canSelectCell: (cell: CellSelectionPredicateCell) => {
        seen.push([
          cell.id,
          cell.column.id,
          cell.row.id,
          (cell.row.original as { age: number }).age,
          cell.row.depth,
          cell.getValue(),
        ])
        return true
      },
    })
    predicate(fakeCell())
    expect(seen).toEqual([['r1_name', 'name', 'r1', 30, 0, 'Alice']])
  })

  it('CRS24: служебные колонки не выделяются и при canSelectCell, разрешающем всё', () => {
    const predicate = predicateOf({ canSelectCell: () => true })
    expect(predicate(fakeCell())).toBe(true)
    expect(predicate(fakeCell(true))).toBe(false)
  })

  it('rangeSelection/dragSelection/multiRange — тумблеры прокидываются', () => {
    const { options } = foldEntries([
      cellSelection({
        rangeSelection: false,
        dragSelection: false,
        multiRange: false,
      }),
    ] as never)
    expect(options.enableCellRangeSelection).toBe(false)
    expect(options.enableCellSelectionDrag).toBe(false)
    expect(options.enableMultiCellRangeSelection).toBe(false)
  })
})
