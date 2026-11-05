// @vitest-environment happy-dom
/**
 * Справочник действий и словарь по владельцам (ADR 0182; AN1, AN3–AN10, AN12–AN14, AN16, AN23–AN24): одно имя
 * действия для журнала, пульта, меню, объявлений и канала, подписи владельцев ключами
 * `<владелец>.<ключ>`, ядро — только механизм.
 * Запуск: npx vitest run --config vitest.node.config.ts actionCatalog
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { actionOwnerOf } from '../core/actionOwners'
import { actionRefOf, hasActionLabel, menuActionLabel } from '../core/actions'
import { registerAnnouncer } from '../core/announcer'
import { definePlugin } from '../core/definePlugin'
import { draftKindLabel, type DraftKind } from '../core/drafts/drafts'
import type { TesseraFeatureEntry } from '../core/features'
import { failureName } from '../core/failures/failuresFeature'
import { trackCellAction } from '../core/headerActions/cellActions'
import {
  createSectionLoads,
  loadSection,
  resolveMenuLevel,
  sectionKey,
} from '../core/headerActions/menuSections'
import {
  DEFAULT_LABELS,
  defineLabels,
  ENGLISH_LABELS,
  labelSetKeys,
  resolveLabels,
  unknownLabelKeys,
  unknownTableLabelKeys,
  type LabelSet,
} from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import * as builtIns from '../plugins'
import { cellEditing, pagination } from '../plugins'
import { cellEditingLabels } from '../plugins/cellEditing/labels'
import { startEditSession } from '../plugins/cellEditing/session'
import ru from '../stories/__mocks__/localization.ru.json'
import { watchUnknownActions } from '../../../.storybook/consoleErrors'
import { allLabelSets } from '../../labelSets'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Row = { id: string; name: string }
const columns = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Row[] = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
]
const LIB = resolve(__dirname, '..')

let table: any
let root: Root | undefined
let container: HTMLElement | undefined
let editRow = '1'

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.restoreAllMocks()
})

const Host = ({ plugins }: { plugins: TesseraFeatureEntry[] }) => {
  table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: Row) => row.id,
    plugins,
  } as never)
  const row = table.getRowSource().byId(editRow)
  const slot = table
    .getRenderSlots()
    .cellSlot.find((entry: { id: string }) => entry.id === 'cellEditing')
  return slot && row
    ? createElement(slot.component, {
        ...row.getAllCells()[0].getContext(),
        content: '',
      })
    : null
}

const mount = (plugins: TesseraFeatureEntry[]) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(createElement(Host, { plugins })))
}

const flush = () => act(async () => {})

/** Файлы исходников библиотеки без тестов и историй. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return /__tests__|stories|vendor/.test(name) ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : []
  })
const rel = (path: string) => relative(LIB, path).replace(/\\/g, '/')
const areaOf = (path: string) => rel(path).split('/')[0]!
const pluginOf = (path: string) => rel(path).split('/')[1]!

/** Имена действий в выражении: операнд сравнения в условии — не имя действия. */
const actionNames = (expression: string) =>
  [...expression.matchAll(/(?<![=!]==\s*)'([\w:]+)'/g)].map(name => name[1]!)

/**
 * Пары `{ plugin, action }` в вызовах канала действий и его итогов: из объекта вызова, из
 * объекта `report`, из обёртки плагина с именем действия аргументом (`report('resetSize')`).
 * Владелец не литералом (`plugin: ID`) — плагин по папке файла.
 */
const literalChannelActions = () =>
  sources(LIB).flatMap(path => {
    const text = readFileSync(path, 'utf8')
    const owner = areaOf(path) === 'plugins' ? pluginOf(path) : undefined
    const fromObjects = [
      ...text.matchAll(/\b(?:reportAction|reportOutcome)\(|const report = \{/g),
    ].flatMap(match => {
      const call = text.slice(match.index, match.index + 400)
      const plugin = /plugin: '(\w+)'/.exec(call)?.[1] ?? owner
      const action = /action: ([^,\n]+)/.exec(call)?.[1]
      if (!plugin || !action) return []
      return actionNames(action).map(name => ({ plugin, action: name }))
    })
    if (!owner) return fromObjects
    const fromWrappers = [
      ...text.matchAll(/\b(?:report|this\.load)\(([^\n]*)/g),
    ].flatMap(match =>
      actionNames(match[1]!).map(name => ({ plugin: owner, action: name })),
    )
    return [...fromObjects, ...fromWrappers]
  })

describe('Справочник действий (ADR 0182)', () => {
  it('AN1: справочник действий в ядре: действие { plugin, action } с одной подписью label(labels, params?); плагин-владелец объявляет свои действия в записи, ядро — свои; повторное объявление того же id — предупреждение в разработке, действует первое', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = {
      id: 'archive',
      slot: 'actionRowSlot' as const,
      icon: () => null,
      label: () => 'Archive from the menu',
      onSelect: () => {},
    }
    const notes = definePlugin()({
      id: 'notes',
      actions: {
        archive: () => 'Archive',
        note: (labels, params) => `Note ${String(params?.n)}`,
      },
      slotActions: [archive],
    })
    mount([notes()])
    expect(
      table.getActionLabel({
        plugin: 'notes',
        action: 'note',
        params: { n: 2 },
      }),
    ).toBe('Note 2')
    // Ядро — свои действия.
    expect(
      table.getActionLabel({ plugin: 'core', action: 'scrollToRow' }),
    ).toBe(ENGLISH_LABELS.actionScrollToRow)
    // Действие объявлено дважды: в записи и на пункте — первое, с предупреждением.
    expect(table.getActionLabel({ plugin: 'notes', action: 'archive' })).toBe(
      'Archive',
    )
    expect(warn.mock.calls.flat().join(' ')).toContain(
      'duplicate action notes/archive',
    )
  })

  it('AN3: запись реестра отказов хранит id действия и параметры: reportFailure({ action }), trackCellAction(…, { action }); встроенный код не передаёт литерал label — страж', async () => {
    // Страж: в вызовах встроенного кода нет литерала имени отказа.
    const offenders = sources(LIB).flatMap(path => {
      const text = readFileSync(path, 'utf8')
      return [
        ...text.matchAll(/reportFailure\(\s*\w+,\s*\{([\s\S]*?)\n\s*\}\)/g),
        ...text.matchAll(/trackCellAction\([\s\S]*?\{([^}]*)\}\s*\)/g),
      ]
        .filter(match => /(^|\n)\s*label[:,]/.test(match[1]!))
        .map(() => rel(path))
    })
    expect(offenders).toEqual([])

    mount([])
    table.reportFailure({
      action: { plugin: 'core', action: 'search' },
      target: { table: true },
      reason: 'No',
    })
    act(
      () =>
        void trackCellAction(
          table,
          { cell: ['1', 'name'] },
          Promise.reject(new Error('No')),
          { action: { plugin: 'core', action: 'copy' } },
        ).catch(() => {}),
    )
    await flush()
    const records = table.getFailures()
    expect(
      records.map((record: { action?: unknown }) => record.action),
    ).toEqual([
      { plugin: 'core', action: 'search' },
      { plugin: 'core', action: 'copy' },
    ])
    expect(
      records.every((record: { label?: string }) => record.label === undefined),
    ).toBe(true)
  })

  it('AN4: литерал label у reportFailure и trackCellAction — для приложения: журнал и объявление показывают его как есть', async () => {
    mount([])
    const say = vi.fn()
    registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
    act(
      () =>
        void trackCellAction(
          table,
          { cell: ['1', 'name'] },
          Promise.reject(new Error('Locked')),
          { label: 'Пересчёт премии' },
        ).catch(() => {}),
    )
    await flush()
    const [record] = table.getFailures()
    expect(record.label).toBe('Пересчёт премии')
    expect(failureName(table, record)).toBe('Пересчёт премии')
    expect(say).toHaveBeenCalledWith(
      ENGLISH_LABELS.announceActionFailed('Пересчёт премии', 'Locked'),
    )
  })

  it('AN5: вид черновика ссылается на действие справочника (action); своей label у DraftKind нет; запись пульта называет вид его подписью', () => {
    mount([
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
    ])
    const kinds = table.options.draftKinds as DraftKind[]
    expect(kinds.map(kind => kind.action).sort()).toEqual([
      'edit',
      'rowDelete',
      'rowInsert',
    ])
    expect(kinds.every(kind => !('label' in kind))).toBe(true)
    const edit = kinds.find(kind => kind.kind === 'cellValue')!
    expect(draftKindLabel(table, edit, ENGLISH_LABELS)).toBe(
      cellEditingLabels(ENGLISH_LABELS).cellDraftKind,
    )
    const ru = resolveLabels({ 'cellEditing.cellDraftKind': 'Правка' }, 'ru')
    expect(draftKindLabel(table, edit, ru)).toBe('Правка')
  })

  it('AN6: объявления об итоге и отказе называют действие подписью справочника, объект — текстом цели; колонка не повторяется', async () => {
    editRow = '2'
    mount([
      cellEditing({
        canEditCell: () => true,
        onCellEdit: () => Promise.reject(new Error('Server down')),
      } as never),
    ])
    const say = vi.fn()
    registerAnnouncer(table, { say, labels: ENGLISH_LABELS })
    act(() =>
      startEditSession(table, table.getRowSource().byId('2'), { id: 'name' }),
    )
    const input = container!.querySelector('input')!
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'X')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })
    await flush()
    const said = say.mock.calls.flat().join('\n')
    const expected = cellEditingLabels(ENGLISH_LABELS).announceSaveFailed(
      cellEditingLabels(ENGLISH_LABELS).cellDraftKind,
      ENGLISH_LABELS.failureTargetCell('Name', 2),
      'Server down',
    )
    expect(said).toContain(expected)
    expect(expected.split('Name')).toHaveLength(2)
    editRow = '1'
  })

  it('AN7: пункты меню и инлайн-кнопки слотов называются действием справочника (action); разные состояния — разные действия; своей label(ctx) у пункта нет; изменяемая часть подписи — параметры', () => {
    const toggle = {
      id: 'toggle',
      slot: 'actionRowSlot' as const,
      icon: () => null,
      label: () => 'Toggle',
      action: (ctx: { on?: boolean }) => (ctx.on ? 'turnOff' : 'turnOn'),
      params: (ctx: { count?: number }) => ({ count: ctx.count }),
      onSelect: () => {},
    }
    const lamps = definePlugin()({
      id: 'lamps',
      actions: {
        turnOn: (labels, params) => `Turn on ${String(params?.count)}`,
        turnOff: () => 'Turn off',
      },
      slotActions: [toggle],
    })
    mount([lamps()])
    const [action] = table.getSlotActions().actionRowSlot
    // Подпись пункта без контекста — в справочнике под его id.
    expect(table.getActionLabel({ plugin: 'lamps', action: 'toggle' })).toBe(
      'Toggle',
    )
    expect(
      menuActionLabel(action, { table, on: false, count: 3 }, ENGLISH_LABELS),
    ).toBe('Turn on 3')
    expect(menuActionLabel(action, { table, on: true }, ENGLISH_LABELS)).toBe(
      'Turn off',
    )
  })

  it('AN8: у каждого действия канала есть запись справочника той же пары { plugin, action }; table.getActionLabel(id, params?) даёт подпись по текущему словарю; консоль историй показывает подпись; перечень канала совпадает со справочником — страж', () => {
    const factories = Object.entries(builtIns).filter(
      ([name, value]) => typeof value === 'function' && /^[a-z]/.test(name),
    ) as [string, (options?: object) => TesseraFeatureEntry][]
    const entries = factories.flatMap(([, factory]) => {
      try {
        const entry = factory({})
        return entry && typeof entry === 'object' && 'id' in entry
          ? [entry]
          : []
      } catch {
        return []
      }
    })
    expect(entries.length).toBeGreaterThan(20)
    expect(literalChannelActions().length).toBeGreaterThan(50)
    mount(entries)
    const missing = [
      ...literalChannelActions(),
      ...(table.getKeyboardActions() ?? []).map((action: { id: string }) => ({
        plugin: action.id.split('.')[0]!,
        action: action.id,
      })),
    ]
      .filter(id => !hasActionLabel(table, id))
      .map(id => `${id.plugin}/${id.action}`)
    expect([...new Set(missing)]).toEqual([])
    // По текущему словарю: подписи владельца переводит словарь таблицы.
    const ru = resolveLabels({ 'columnPinning.pin': 'Закрепить' }, 'ru')
    expect(
      table.getActionLabel({ plugin: 'columnPinning', action: 'pin' }),
    ).toBe('Pin column')
    registerAnnouncer(table, { say: () => {}, labels: ru })
    expect(
      table.getActionLabel({ plugin: 'columnPinning', action: 'pin' }),
    ).toBe('Закрепить')
  })

  it('AN23: Пункт раздела меню принадлежит владельцу раздела: канал, отказ и журнал называют его этим владельцем; подпись пункта и его итога — в справочнике с показа раздела, и у пунктов, пришедших загрузкой, и после пересборки справочника; объявленное в `actions` главнее', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const item = (id: string, label: string) => ({
      id,
      icon: () => null,
      label: () => label,
      onSelect: () => {},
    })
    const archive = item('archive', 'Archive')
    const hold = item('hold', 'Hold')
    const flagged = item('flagged', 'Flagged')
    const section = (id: string, items: unknown) => ({
      ...item(id, id),
      submenu: () => ({ title: id, items }),
    })
    const moved = section('moved', [
      section('deep', [hold]),
      archive,
      item('declared', 'From the section'),
    ])
    const flags = section('flags', async () => [flagged])
    const notes = definePlugin()({
      id: 'notes',
      actions: { declared: () => 'Declared' },
      slotActions: [
        { ...moved, slot: 'actionRowSlot' },
        { ...flags, slot: 'actionRowSlot' },
      ] as never,
    })
    mount([notes()])
    const menu = table.getSlotActions().actionRowSlot
    const ctx = { table }
    const loads = createSectionLoads(() => {})
    const show = (path: string[]) =>
      resolveMenuLevel(menu, path, ctx, ENGLISH_LABELS, loads)

    show(['moved', 'deep'])
    expect(actionOwnerOf(archive)).toBe('notes')
    expect(actionOwnerOf(hold)).toBe('notes')
    expect(actionRefOf(archive as never, ctx, ENGLISH_LABELS)).toEqual({
      plugin: 'notes',
      action: 'archive',
    })
    expect(table.getActionLabel({ plugin: 'notes', action: 'archive' })).toBe(
      'Archive',
    )
    expect(
      table.getActionLabel({ plugin: 'notes', action: 'archiveRejected' }),
    ).toBe('Archive')
    expect(table.getActionLabel({ plugin: 'notes', action: 'hold' })).toBe(
      'Hold',
    )

    loadSection(menu[1], sectionKey(['flags']), ctx, ENGLISH_LABELS, loads)
    await flush()
    show(['flags'])
    expect(actionOwnerOf(flagged)).toBe('notes')
    expect(
      table.getActionLabel({ plugin: 'notes', action: 'flaggedResolved' }),
    ).toBe('Flagged')
    expect(table.getActionLabel({ plugin: 'notes', action: 'declared' })).toBe(
      'Declared',
    )

    // Новый набор плагинов — новый справочник, таблица и показанные пункты те же.
    const before = table.options.actionCatalog
    act(() =>
      root!.render(createElement(Host, { plugins: [notes(), pagination()] })),
    )
    expect(table.options.actionCatalog).not.toBe(before)
    expect(table.getActionLabel({ plugin: 'notes', action: 'archive' })).toBe(
      'Archive',
    )
    expect(warn.mock.calls.flat().join(' ')).not.toContain('unknown action')
  })

  it('AN24: Предупреждение `unknown action` роняет браузерный тест и тест истории; другие предупреждения их не роняют', () => {
    for (const setup of ['vitest.setup.ts', '.storybook/vitest.setup.ts'])
      expect(readFileSync(resolve(LIB, '../..', setup), 'utf8')).toMatch(
        /watchUnknownActions\(\)[\s\S]*beforeEach\(unknownActions\.start\)[\s\S]*afterEach\(unknownActions\.stop\)/,
      )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const watch = watchUnknownActions()
    watch.start()
    console.warn('[tessera] localization: unknown label key "x"')
    expect(watch.stop).not.toThrow()
    watch.start()
    console.warn('[tessera] unknown action "notes/missing"')
    expect(watch.stop).toThrow('notes/missing')
  })

  it('AN9: плагин — встроенный и сторонний одинаково — объявляет ключи словаря с английскими значениями в definePlugin({ labels }); в словаре таблицы ключ — <plugin>.<key>; приложение переводит его через localization, с подстановками и формами числа; тип — PluginLabels', () => {
    interface NotesLabels {
      note: string
      notes: (count: number) => string
    }
    const notesLabels = defineLabels<NotesLabels>()(
      'notes',
      { note: 'Note', notes: '{count} notes', notes_one: '{count} note' },
      { notes: ['count'] },
    )
    const notes = definePlugin()({ id: 'notes', labels: [notesLabels] })
    mount([notes()])
    expect(table.options.labelSets).toContain(notesLabels)
    expect(notesLabels(ENGLISH_LABELS).notes(1)).toBe('1 note')
    const ru = resolveLabels(
      {
        'notes.note': 'Заметка',
        'notes.notes_one': '{count} заметка',
        'notes.notes_few': '{count} заметки',
        'notes.notes': '{count} заметок',
      } as never,
      'ru',
    )
    expect(notesLabels(ru).note).toBe('Заметка')
    expect([1, 3, 5].map(notesLabels(ru).notes)).toEqual([
      '1 заметка',
      '3 заметки',
      '5 заметок',
    ])
    expect(labelSetKeys(notesLabels)).toEqual(
      expect.arrayContaining(['notes.note', 'notes.notes', 'notes.notes_one']),
    )
    // Встроенный плагин — тем же механизмом.
    expect(
      cellEditingLabels(
        resolveLabels({ 'cellEditing.editCell': 'Править' }, 'ru'),
      ).editCell,
    ).toBe('Править')
  })

  it('AN10: неизвестный id действия или ключ словаря — предупреждение в разработке, вместо подписи — id plugin/action или ключ; ключ неизвестен, если это не ключ ядра и не ключ переданных наборов', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount([])
    expect(table.getActionLabel({ plugin: 'notes', action: 'missing' })).toBe(
      'notes/missing',
    )
    expect(warn.mock.calls.flat().join(' ')).toContain(
      'unknown action "notes/missing"',
    )
    const notesLabels = defineLabels<{ note: string }>()(
      'notes',
      { note: 'Note' },
      {},
    )
    expect(
      unknownLabelKeys(
        {
          'notes.note': 'x',
          'notes.typo': 'x',
          'pagination.pageRange': 'x',
          expandRow: 'x',
          table: 'x',
        },
        [notesLabels],
      ),
    ).toEqual(['notes.typo', 'pagination.pageRange', 'expandRow'])
  })

  it('AN14: таблица считает неизвестным ключ без точки, который не ключ ядра, и ключ с префиксом своего владельца, которого нет в его наборе; ключ владельца не из таблицы — нет; выключенный плагин — владелец таблицы', () => {
    const notesLabels = defineLabels<{ note: string }>()(
      'notes',
      { note: 'Note' },
      {},
    )
    expect(
      unknownTableLabelKeys(
        {
          'notes.note': 'x',
          'notes.typo': 'x',
          'pagination.pageRange': 'x',
          'pagination.typo': 'x',
          expandRow: 'x',
          table: 'x',
        },
        [notesLabels],
      ),
    ).toEqual(['notes.typo', 'expandRow'])

    mount([pagination({ enabled: false })])
    expect(
      unknownTableLabelKeys(
        { 'pagination.typo': 'x', 'cellEditing.typo': 'x' },
        table.options.labelSets,
      ),
    ).toEqual(['pagination.typo'])
  })

  it('AN16: unknownLabelKeys(dictionary, allLabelSets) находит опечатку в префиксе владельца; allLabelSets содержит наборы всех модулей labels.ts плагинов и shared/ — страж', () => {
    expect(unknownLabelKeys(ru, allLabelSets)).toEqual([])
    expect(
      unknownLabelKeys({ ...ru, 'paginaton.pageRange': 'x' }, allLabelSets),
    ).toEqual(['paginaton.pageRange'])

    const declared = Object.values(
      import.meta.glob<Record<string, unknown>>(
        '../{plugins,shared}/**/labels.ts',
        { eager: true },
      ),
    )
      .flatMap(module => Object.values(module))
      .filter(
        (value): value is LabelSet =>
          typeof value === 'function' && 'params' in value,
      )
    expect(new Set(allLabelSets)).toEqual(new Set(declared))
  })

  it('AN12: ключи словаря ядра — только ключи возможностей ядра; ядро и грид не читают ключей плагинов, плагин — ключей другого плагина; подпись чужого действия — только по id через ядро — страж слоёв', () => {
    const files = sources(LIB)
    const labelImports = (path: string) =>
      [...readFileSync(path, 'utf8').matchAll(/from '([^']*\/labels)'/g)].map(
        match => rel(resolve(dirname(path), match[1]!)),
      )
    const violations = files.flatMap(path => {
      const area = areaOf(path)
      return labelImports(path)
        .filter(target => {
          const [targetArea, owner] = target.split('/')
          if (area === 'plugins')
            return targetArea === 'plugins' && owner !== pluginOf(path)
          if (area === 'shared') return targetArea === 'plugins'
          return targetArea === 'plugins' || targetArea === 'shared'
        })
        .map(target => `${rel(path)} -> ${target}`)
    })
    expect(violations).toEqual([])
    // Каждый ключ ядра читает код вне плагинов.
    const outside = files
      .filter(
        path =>
          areaOf(path) !== 'plugins' && !/localization\/labels\.ts$/.test(path),
      )
      .map(path => readFileSync(path, 'utf8'))
      .join('\n')
    const unused = Object.keys(DEFAULT_LABELS)
      .filter(key => !/_(zero|one|two|few|many|other)$/.test(key))
      .filter(key => !new RegExp(`\\b${key}\\b`).test(outside))
    expect(unused).toEqual([])
  })

  it('AN13: английские подписи плагина — в его модуле: сборка DataGrid с useCreateTable без плагинов их не содержит', () => {
    // Граф импортов DataGrid и useCreateTable: модулей подписей владельцев в нём нет.
    const seen = new Set<string>()
    const walk = (path: string) => {
      if (seen.has(path)) return
      seen.add(path)
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(
        /(?:import|export)[^'"]*?from '(\.[^']+)'/g,
      )) {
        const base = resolve(dirname(path), match[1]!)
        const file = ['.ts', '.tsx', '/index.ts', '/index.tsx']
          .map(ext => base + ext)
          .find(candidate => {
            try {
              return statSync(candidate).isFile()
            } catch {
              return false
            }
          })
        if (file && !/\.css$/.test(file)) walk(file)
      }
    }
    walk(join(LIB, 'grid', 'DataGrid.tsx'))
    walk(join(LIB, 'core', 'useCreateTable.ts'))
    const owners = [...seen].filter(path =>
      /(plugins|shared)\/[^/]+\/labels\.ts$/.test(rel(path)),
    )
    expect(owners.map(rel)).toEqual([])
    expect([...seen].some(path => /plugins\//.test(rel(path)))).toBe(false)
  })
})
