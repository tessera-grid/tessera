/**
 * Headless-проверки плагина dataExport (ADR 0044): оси настроек, строки и колонки,
 * значения, CSV, серверный режим, `table.exportData`.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it, vi } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { DEFAULT_LABELS } from '../core/localization'
import { columnPinning } from '../plugins/columnPinning'
import { columnSorting } from '../plugins/columnSorting'
import { dataExport } from '../plugins/dataExport'
import { csvFormat } from '../plugins/dataExport/csv'
import { collectExportData } from '../plugins/dataExport/exportData'
import { rowLabel } from '../plugins/dataExport/rowLabel'
import {
  resolveAxes,
  resolveSettings,
  type ExportAxes,
} from '../plugins/dataExport/settings'
import { pagination } from '../plugins/pagination'
import { rowGrouping } from '../plugins/rowGrouping'
import { rowSelection } from '../plugins/rowSelection'

interface Item {
  id: string
  first: string
  last: string
  age: number
  team: string
  subRows?: Item[]
}

const DATA: Item[] = [
  { id: '1', first: 'Cy', last: 'Zed', age: 30, team: 'a' },
  { id: '2', first: 'Ann', last: 'Yu', age: 25, team: 'b' },
  { id: '3', first: 'Bob', last: 'Xi', age: 41, team: 'a' },
]

const COLUMNS = [
  {
    id: 'person',
    header: 'Person',
    columns: [
      { id: 'first', accessorKey: 'first', header: 'First name' },
      { id: 'last', accessorKey: 'last', header: 'Last name' },
    ],
  },
  { id: 'age', accessorKey: 'age', header: 'Age' },
  { id: 'team', accessorKey: 'team' },
]

const build = ({
  data = DATA as unknown[],
  columns = COLUMNS as any[],
  plugins = [] as any[],
  state,
  enableToolbar = true,
}: {
  data?: unknown[]
  columns?: any[]
  plugins?: any[]
  state?: Record<string, unknown>
  enableToolbar?: boolean
} = {}) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data,
    columns: injectServiceColumns(columns, folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    ...folded.options,
    hooks: resolveHooks(foldHooks(entries)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
    ...(state ? { state } : {}),
    enableToolbar,
  } as never) as any
}

type Rows = 'all' | 'view' | 'page' | 'selected'

const columnIds = (table: unknown, options = {}) =>
  collectExportData(table, options).columns.map(c => c.id)
const firstNames = (table: unknown, rows: Rows) =>
  collectExportData(table, { rows }).rows.map(row => row[0])
const present = (table: unknown) =>
  resolveAxes(table)!.rows.map(choice => choice.value)
const disabled = (choices: ExportAxes['rows']) =>
  choices.filter(choice => choice.disabled).map(choice => choice.value)

describe('dataExport — оси настроек', () => {
  it('EX2: без enableToolbar плагин инертен — diagnose → noToolbar', () => {
    const entry = dataExport() as any
    expect(entry.diagnose(build({ enableToolbar: false }))).toBe('noToolbar')
    expect(entry.diagnose(build({ plugins: [dataExport()] }))).toBeUndefined()
  })

  it('EX3: значения оси «Строки» — по активным плагинам, в порядке all, view, page, selected', () => {
    expect(present(build({ plugins: [dataExport()] }))).toEqual(['all'])
    expect(
      present(build({ plugins: [dataExport(), columnSorting()] })),
    ).toEqual(['all', 'view'])
    expect(present(build({ plugins: [dataExport(), pagination()] }))).toEqual([
      'all',
      'page',
    ])
    expect(present(build({ plugins: [dataExport(), rowSelection()] }))).toEqual(
      ['all', 'selected'],
    )
    expect(
      present(
        build({
          plugins: [
            rowSelection(),
            pagination(),
            columnSorting(),
            dataExport(),
          ],
        }),
      ),
    ).toEqual(['all', 'view', 'page', 'selected'])
    // Отключённый плагин значения не даёт.
    expect(
      present(
        build({
          plugins: [
            dataExport(),
            columnSorting({ enabled: false }),
            pagination({ enabled: false }),
            rowSelection({ enabled: false }),
          ],
        }),
      ),
    ).toEqual(['all'])
  })

  it('EX4: allow делает значения вне списка недоступными по каждой оси; selected недоступно, пока ничего не выбрано', () => {
    const plugins = (allow?: object) => [
      dataExport({
        allow,
        formats: [
          csvFormat(),
          {
            id: 'json',
            label: 'JSON',
            extension: 'json',
            mimeType: 'application/json',
            serialize: () => '[]',
          },
        ],
      }),
      columnSorting(),
      pagination(),
      rowSelection(),
    ]

    const free = resolveAxes(build({ plugins: plugins() }))!
    expect(disabled(free.rows)).toEqual(['selected'])
    expect(disabled(free.columns as never)).toEqual([])

    const limited = resolveAxes(
      build({
        plugins: plugins({
          rows: ['all', 'page', 'selected'],
          columns: ['visible'],
          formats: ['csv'],
        }),
        state: { rowSelection: { '1': true } },
      }),
    )!
    expect(disabled(limited.rows)).toEqual(['view'])
    expect(disabled(limited.columns as never)).toEqual(['all'])
    expect(disabled(limited.formats as never)).toEqual(['json'])
  })

  it('EX5: начальные настройки — первое доступное значение каждой оси; запомненное недоступное заменяется первым доступным', () => {
    const table = build({
      plugins: [dataExport(), pagination(), rowSelection()],
    })
    const axes = resolveAxes(table)!
    expect(resolveSettings(axes)).toEqual({
      rows: 'all',
      columns: 'visible',
      format: 'csv',
    })
    expect(resolveSettings(axes, { rows: 'page', columns: 'all' })).toEqual({
      rows: 'page',
      columns: 'all',
      format: 'csv',
    })
    // `selected` недоступно без выбора — остаётся первое доступное.
    expect(resolveSettings(axes, { rows: 'selected' })?.rows).toBe('all')
  })

  it('EX10: подпись view называет учитываемое, остальные — из локализации', () => {
    expect(rowLabel(DEFAULT_LABELS, 'all', [])).toBe('All data')
    expect(rowLabel(DEFAULT_LABELS, 'view', ['sorting'])).toBe('With sorting')
    expect(rowLabel(DEFAULT_LABELS, 'page', [])).toBe('Current page')
    expect(rowLabel(DEFAULT_LABELS, 'selected', [])).toBe('Selected rows')
    expect(
      rowLabel(
        {
          ...DEFAULT_LABELS,
          exportView: features => `С учётом: ${features.join(', ')}`,
        },
        'view',
        ['sorting'],
      ),
    ).toBe('С учётом: sorting')
  })
})

describe('dataExport — колонки', () => {
  it('EX11: visible — видимые колонки в порядке отображения; all добавляет скрытые', () => {
    const table = build({
      plugins: [columnPinning()],
      state: {
        columnVisibility: { team: false },
        columnPinning: { start: [], end: ['first'] },
      },
    })
    expect(columnIds(table)).toEqual(['last', 'age', 'first'])
    expect(columnIds(table, { columns: 'all' })).toEqual([
      'last',
      'age',
      'team',
      'first',
    ])
  })

  it('EX12: служебные колонки в выгрузку не попадают', () => {
    const table = build({ plugins: [rowSelection()] })
    expect(
      table.getAllLeafColumns().some((c: any) => c.getIsActionsColumn()),
    ).toBe(true)
    expect(columnIds(table)).toEqual(['first', 'last', 'age', 'team'])
  })

  it('EX13: заголовок — строка header, иначе id; вложенная шапка — подписи листьев', () => {
    const { columns } = collectExportData(build())
    expect(columns.map(c => c.header)).toEqual([
      'First name',
      'Last name',
      'Age',
      'team',
    ])
  })
})

describe('dataExport — строки', () => {
  const sortedPaged = (extra: Record<string, unknown> = {}) =>
    build({
      plugins: [
        columnSorting(),
        pagination({ initialPageSize: 2 }),
        rowSelection(),
      ],
      state: { sorting: [{ id: 'age', desc: false }], ...extra },
    })

  it('EX14: all — весь data в исходном порядке, без влияния сортировки и страницы; subRows включены', () => {
    expect(firstNames(sortedPaged(), 'all')).toEqual(['Cy', 'Ann', 'Bob'])

    const nested = build({
      data: [
        {
          id: 'p',
          first: 'Parent',
          last: '',
          age: 1,
          team: 'a',
          subRows: [{ id: 'c', first: 'Child', last: '', age: 2, team: 'a' }],
        },
        { id: 'z', first: 'Zed', last: '', age: 3, team: 'a' },
      ],
    })
    expect(firstNames(nested, 'all')).toEqual(['Parent', 'Child', 'Zed'])
  })

  it('EX15: view — в порядке сортировки, все страницы; свёрнутая группа не прячет строки, группы не попадают', () => {
    expect(firstNames(sortedPaged(), 'view')).toEqual(['Ann', 'Cy', 'Bob'])

    const grouped = build({
      plugins: [rowGrouping()],
      state: { grouping: ['team'], expanded: {} },
    })
    expect(grouped.getRowModel().rows.every((r: any) => r.getIsGrouped())).toBe(
      true,
    )
    expect(firstNames(grouped, 'view').sort()).toEqual(['Ann', 'Bob', 'Cy'])
  })

  it('EX16: page — только текущая страница; selected — выбранные всех страниц в порядке view', () => {
    const table = sortedPaged({ rowSelection: { '1': true, '3': true } })
    expect(firstNames(table, 'page')).toEqual(['Ann', 'Cy'])
    // Выбранные «Cy» (страница 1) и «Bob» (страница 2) — оба в выгрузке, в порядке сортировки.
    expect(firstNames(table, 'selected')).toEqual(['Cy', 'Bob'])
  })
})

describe('dataExport — значения', () => {
  it('EX17: значение — cell.getValue(), а не отрисовка; serialize и formatValue получают его как есть', () => {
    const date = new Date(0)
    const object = { a: 1 }
    const table = build({
      data: [{ id: '1', v: null, d: date, o: object }],
      columns: [
        { id: 'v', accessorKey: 'v', cell: () => 'RENDERED' },
        { id: 'd', accessorKey: 'd' },
        { id: 'o', accessorKey: 'o' },
      ],
    })
    const data = collectExportData(table)
    expect(data.rows[0]).toEqual([null, date, object])
    expect(data.rows[0][1]).toBe(date)
    expect(data.rows[0][2]).toBe(object)

    const overridden = collectExportData(table, {
      formatValue: ({ value, column }) => (column.id === 'd' ? 'x' : value),
    })
    expect(overridden.rows[0][1]).toBe('x')
  })

  it('EX18: CSV приводит значения к тексту: null → пусто, Date → ISO, boolean, объект → JSON', () => {
    const csv = csvFormat({ bom: false }).serialize({
      columns: ['v', 'd', 'b', 'o'].map(id => ({ id, header: id })),
      rows: [[null, new Date(0), true, { a: 1 }]],
    })
    expect(csv).toBe('v,d,b,o\r\n,1970-01-01T00:00:00.000Z,true,"{""a"":1}"')
  })

  it('EX24: пустая таблица выгружает только заголовки', () => {
    const data = collectExportData(build({ data: [] }))
    expect(data.rows).toEqual([])
    expect(csvFormat({ bom: false }).serialize(data)).toBe(
      'First name,Last name,Age,team',
    )
  })
})

describe('dataExport — серверный режим и exportData', () => {
  const serverTable = (
    options: Record<string, unknown> = {},
    state?: Record<string, unknown>,
  ) =>
    build({
      plugins: [
        dataExport({ server: true, ...options }),
        columnSorting(),
        pagination(),
        rowSelection(),
      ],
      state,
    })

  it('EX29: серверная выгрузка без onExport — diagnose → noOnExport; с onExport или только page — нет', () => {
    const entry = dataExport() as any
    expect(entry.diagnose(serverTable())).toBe('noOnExport')
    expect(entry.diagnose(serverTable({ onExport: () => {} }))).toBeUndefined()
    expect(
      entry.diagnose(serverTable({ allow: { rows: ['page'] } })),
    ).toBeUndefined()
  })

  it('EX30: table.exportData(arg) идёт тем же путём, что «Выгрузить»; недоступное значение или неизвестный набор — logError без выгрузки', async () => {
    const onExport = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const table = serverTable(
        {
          onExport,
          presets: [{ id: 'sel', label: 'Selected', rows: 'selected' }],
        },
        { rowSelection: { '1': true } },
      )
      await table.exportData()
      expect(onExport.mock.calls[0][0].settings).toEqual({
        rows: 'all',
        columns: 'visible',
        format: 'csv',
      })

      await table.exportData({ rows: 'selected', columns: 'all' })
      expect(onExport.mock.calls[1][0].settings.columns).toBe('all')
      expect(onExport.mock.calls[1][0].rowIds).toEqual(['1'])

      await table.exportData('sel')
      expect(onExport.mock.calls[2][0].settings.rows).toBe('selected')
      expect(onExport).toHaveBeenCalledTimes(3)

      await table.exportData('nope')
      await table.exportData({ format: 'xlsx' })
      expect(onExport).toHaveBeenCalledTimes(3)
      expect(error).toHaveBeenCalledTimes(2)

      // Ничего не выбрано — значение selected недоступно, выгрузки нет.
      await serverTable({ onExport }).exportData({ rows: 'selected' })
      expect(onExport).toHaveBeenCalledTimes(3)
      expect(error).toHaveBeenCalledTimes(3)
    } finally {
      error.mockRestore()
    }
  })
})

describe('dataExport — CSV', () => {
  const data = (rows: unknown[][]) => ({
    columns: [{ id: 'c', header: 'h' }],
    rows,
  })
  const lines = (csv: string | Uint8Array | Blob) =>
    (csv as string).split('\r\n').slice(1)

  it('EX19: разделитель запятая, CRLF, заголовки первой строкой; поле с , " CR LF — в кавычках с удвоением', () => {
    const csv = csvFormat({ bom: false }).serialize({
      columns: [
        { id: 'a', header: 'A' },
        { id: 'b', header: 'B' },
      ],
      rows: [
        [1, 2],
        ['a,b', 'say "hi"'],
        ['l1\nl2', 3],
      ],
    })
    expect(csv).toBe('A,B\r\n1,2\r\n"a,b","say ""hi"""\r\n"l1\nl2",3')
  })

  it('EX20: BOM по умолчанию; bom: false его убирает', () => {
    expect((csvFormat().serialize(data([])) as string).charCodeAt(0)).toBe(
      0xfeff,
    )
    expect(
      (csvFormat({ bom: false }).serialize(data([])) as string).charCodeAt(0),
    ).toBe('h'.charCodeAt(0))
  })

  it("EX21: защита от формул включена по умолчанию: текст с = + - @ \\t \\r в начале получает префикс '; числа и даты не меняются", () => {
    const csv = csvFormat({ bom: false }).serialize(
      data([
        ['=1+1'],
        ['+x'],
        ['-x'],
        ['@x'],
        ['\tx'],
        ['\rx'],
        [-5],
        [new Date(0)],
      ]),
    )
    expect(lines(csv)).toEqual([
      "'=1+1",
      "'+x",
      "'-x",
      "'@x",
      "'\tx",
      '"\'\rx"',
      '-5',
      '1970-01-01T00:00:00.000Z',
    ])
  })

  it('EX22: sanitizeFormulas: false отключает префикс', () => {
    const csv = csvFormat({ bom: false, sanitizeFormulas: false }).serialize(
      data([['=1+1']]),
    )
    expect(csv).toBe('h\r\n=1+1')
  })
})
