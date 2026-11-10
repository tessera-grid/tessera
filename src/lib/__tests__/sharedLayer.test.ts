/**
 * Общий слой (ADR 0166): утилиты в `util/`, код плагинов в `shared/`, тема и компоненты, которые
 * грид делит с плагинами, — в `ui/`; базы LB1 без рёбер между ядром и китом.
 * Запуск: npx vitest run --config vitest.node.config.ts sharedLayer
 */
import { describe, expect, it } from 'vitest'

import { LAYER_EDGES } from './architecture.baseline'
import { modules, sourceOf } from './importGraph'
import { ENTRY, exportNames } from './publicTypes'

const TYPES_TIMEOUT = 120_000

const paths = () => new Set(modules().map(module => module.path))

/** Пути, которых нет среди модулей `src/lib`. */
const missing = (expected: string[]) => {
  const all = paths()
  return expected.filter(path => !all.has(path))
}

/** Модули с таким именем файла в слоях, где их быть не должно. */
const strays = (names: string[], layers: string[]) =>
  modules()
    .filter(module => layers.includes(module.layer))
    .map(module => module.path)
    .filter(path => names.some(name => path.endsWith(`/${name}`)))

/** Экспорты `/ui` (ADR 0166, SH4): переезд кита их не меняет; один `Checkbox` вместо `SelectCheckbox` и `CheckMark` — ADR 0183, PK18. */
const UI_EXPORTS = [
  'ActiveProps',
  'Button',
  'ButtonProps',
  'CellButton',
  'CellButtonProps',
  'Checkbox',
  'CheckboxProps',
  'DerivedButtonProps',
  'ExpandButton',
  'ExpandButtonProps',
  'GroupButton',
  'GroupButtonProps',
  'IconButton',
  'IconButtonProps',
  'PinButton',
  'PinButtonProps',
  'ResizeHandler',
  'ResizeSplitterProps',
  'RowButton',
  'RowButtonProps',
  'SegmentOption',
  'Segments',
  'SegmentsProps',
  'Skeleton',
  'SkeletonProps',
  'SortButton',
  'SortButtonProps',
  'Stub',
  'StubProps',
  'Switch',
  'SwitchProps',
  'ToneProps',
  'ToolbarButton',
  'ToolbarButtonProps',
]

/** Разбор CSS-времени: суффикс `ms` у значения из стиля. */
const CSS_TIME_PARSE = /endsWith\(\s*['"]ms['"]\s*\)/

describe('общий слой (ADR 0166)', () => {
  it('SH1: утилиты — в util/; разбор CSS-времени — одна функция, своих копий у грида и кита нет', () => {
    const utils = [
      'logger.ts',
      'useIsomorphicLayoutEffect.ts',
      'reactVersion.ts',
      'thenable.ts',
      'useLatest.ts',
      'oneCommit.ts',
      'timeSlice.ts',
      'useDebouncedCallback.ts',
      'cssTime.ts',
    ]
    expect(missing(utils.map(name => `lib/util/${name}`))).toEqual([])
    expect(strays(utils, ['core'])).toEqual([])
    const parsers = modules()
      .filter(module => CSS_TIME_PARSE.test(sourceOf(module.path)))
      .map(module => module.path)
    expect(parsers).toEqual(['lib/util/cssTime.ts'])
  })

  it('SH2: модели строк — в shared/rowModels/, failedAttempts, rowMoves, serverAggregations и фильтрация с FilteredRowsCount — в shared/; в core/ и grid/ их нет; передача словаря строк — в core/', () => {
    const rowModels = [
      'expandedRowModel.ts',
      'filteredRowModel.ts',
      'idleRowModel.ts',
    ]
    const shared = ['failedAttempts.ts', 'rowMoves.ts', 'serverAggregations.ts']
    const filtering = ['filtering.ts', 'FilteredRowsCount.tsx']
    expect(
      missing([
        ...rowModels.map(name => `lib/shared/rowModels/${name}`),
        ...shared.map(name => `lib/shared/${name}`),
        ...filtering.map(name => `lib/shared/filtering/${name}`),
      ]),
    ).toEqual([])
    expect(
      strays([...rowModels, ...shared, ...filtering], ['core', 'grid']),
    ).toEqual([])
    // Словарь хранилища правят и модель ядра, и стадия фильтра (ADR 0200): ядро не импортирует shared/.
    expect(missing(['lib/core/rowEngine/rowDict.ts'])).toEqual([])
  })

  it('SH3: тема — в ui/theme; в базе LB1 нет рёбер ui → core и core → ui', () => {
    expect(
      missing([
        'lib/ui/theme/index.ts',
        'lib/ui/theme/portalTheme.ts',
        'lib/ui/theme/themeSource.tsx',
      ]),
    ).toEqual([])
    expect(strays(['themeSource.tsx', 'portalTheme.ts'], ['core'])).toEqual([])
    expect(
      Object.keys(LAYER_EDGES).filter(edge =>
        /^lib\/(ui\/\S+ -> lib\/core|core\/\S+ -> lib\/ui)\//.test(edge),
      ),
    ).toEqual([])
  })

  it(
    'SH4: CellButton, RowButton, CellInvalid, StatusBarCount, LoadMoreError, линии дерева, видимость кнопок и visually-hidden — в ui/; плагины берут из грида только перетаскивание, HandleMenu и SkeletonBody; экспорты /ui прежние',
    () => {
      expect(
        missing([
          'lib/ui/CellButton/CellButton.tsx',
          'lib/ui/RowButton/RowButton.tsx',
          'lib/ui/cellControls/CellInvalid.tsx',
          'lib/ui/StatusBarCount/StatusBarCount.tsx',
          'lib/ui/LoadMoreError/LoadMoreError.tsx',
          'lib/ui/TreeLines/TreeLinesLayer.tsx',
        ]),
      ).toEqual([])
      expect(
        strays(
          [
            'CellButton.tsx',
            'RowButton.tsx',
            'CellInvalid.tsx',
            'StatusBarCount.tsx',
            'LoadMoreError.tsx',
            'TreeLinesLayer.tsx',
          ],
          ['grid'],
        ),
      ).toEqual([])
      expect(
        Object.keys(LAYER_EDGES)
          .filter(edge => /^lib\/plugins\/\S+ -> lib\/grid\//.test(edge))
          .filter(
            edge =>
              !/-> lib\/grid\/(dnd\/|handleMenu\/|SkeletonBody\.tsx)/.test(
                edge,
              ),
          ),
      ).toEqual([])
      expect(exportNames(ENTRY.ui).sort()).toEqual(UI_EXPORTS)
    },
    TYPES_TIMEOUT,
  )
})
