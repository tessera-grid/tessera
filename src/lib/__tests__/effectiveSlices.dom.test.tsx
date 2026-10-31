// @vitest-environment happy-dom
/**
 * Эффективное состояние в атомах (ADR 0171, §1–§2): суженный срез — атом-линза в
 * `options.atoms`, сужение — по зависимостям атома, значение приложения — из опций рендера.
 * Запуск: npx vitest run --config vitest.node.config.ts effectiveSlices
 */
import {
  act,
  memo,
  type ReactNode,
  startTransition,
  Suspense,
  use,
  useLayoutEffect,
  useState,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { definePlugin, setPluginState } from '../core/definePlugin'
import {
  PluginRenderVersionContext,
  usePluginRenderVersion,
} from '../core/renderVersion'
import { useCreateTable } from '../core/useCreateTable'
import { allSelectionOf } from '../core/rowSelectionAll'
import {
  cellEditing,
  columnPinning,
  columnSorting,
  rowExpanding,
  rowSelectionModel,
} from '../plugins'
import { setLoadedAnswer } from '../plugins/rowExpanding/lazyChildrenFeature'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let captured: any
let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const mount = (node: ReactNode) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(node))
}

const columns = [
  { id: 'name', accessorKey: 'name' },
  { id: 'rank', accessorKey: 'rank' },
]
const data = [
  { id: '1', name: 'A', rank: 2 },
  { id: '2', name: 'B', rank: 1 },
]
const SORTED = [
  { id: 'name', desc: false },
  { id: 'rank', desc: true },
]

const SortHost = ({
  max,
  sorting,
  onSortingChange,
}: {
  max: number
  sorting?: unknown
  onSortingChange?: (next: unknown) => void
}) => {
  captured = useCreateTable({
    columns: columns as never,
    data,
    plugins: [
      columnSorting({
        multiSort: { max },
        ...(sorting !== undefined && { sorting, onSortingChange }),
      } as never),
    ],
  })
  return null
}

describe('эффективное состояние в атомах (ADR 0171)', () => {
  it('EF1: суженный срез TanStack получает атомом-линзой из options.atoms: чтение — эффективное значение, запись — в сохранённое; сохранённое не переписывается, on*Change из-за сужения не приходит', () => {
    const onSortingChange = vi.fn()
    mount(<SortHost max={3} />)
    const lens = captured.options.atoms.sorting
    expect(lens).toBeDefined()
    act(() => {
      captured.getColumn('name').toggleSorting(false, false)
      captured.getColumn('rank').toggleSorting(true, true)
    })
    expect(lens.get()).toEqual(SORTED)

    // Сужение: таблица видит первую сортировку, линза — та же, сохранённое — обе.
    mount(<SortHost max={1} />)
    expect(captured.options.atoms.sorting).toBe(lens)
    expect(captured.atoms.sorting.get()).toEqual([SORTED[0]])
    mount(<SortHost max={3} />)
    expect(captured.atoms.sorting.get()).toEqual(SORTED)

    // Срез приложения: сужение его не переписывает и колбэк не зовёт.
    act(() => root?.unmount())
    root = undefined
    mount(
      <SortHost max={1} sorting={SORTED} onSortingChange={onSortingChange} />,
    )
    expect(captured.atoms.sorting.get()).toEqual([SORTED[0]])
    expect(onSortingChange).not.toHaveBeenCalled()
  })

  it('EF2: сужение пересчитывается по зависимостям атома без перерисовки хоста: при смене аргумента, данных, колонок и при приходе ленивых детей', () => {
    const tree = [
      { id: 'p', name: 'P', subRows: [] as { id: string; name: string }[] },
    ]
    const ids = () =>
      captured.getRowModel().rows.map((row: { id: string }) => row.id)
    let renders = 0
    const LazyHost = ({ maxDepth }: { maxDepth: number }) => {
      renders++
      captured = useCreateTable({
        columns: columns as never,
        data: tree,
        plugins: [
          rowExpanding({
            maxDepth,
            initialExpanded: { p: true },
            hasChildren: row => row.id === 'p',
            loadChildren: () => new Promise(() => {}),
          }),
        ],
      })
      return null
    }
    mount(<LazyHost maxDepth={2} />)
    // Ответа нет — раскрытие ленивой строки сужено.
    expect(captured.atoms.expanded.get()).toEqual({})

    // Ответ пришёл: сужение пересчитано при чтении, хост не перерисовывался.
    const before = renders
    setLoadedAnswer(captured, () => ({ p: [{ id: 'c', name: 'C' }] }))
    expect(captured.atoms.expanded.get()).toEqual({ p: true })
    expect(renders).toBe(before)

    // Аргумент сменился: сужение по новому — с первого же рендера.
    mount(<LazyHost maxDepth={0} />)
    expect(captured.atoms.expanded.get()).toEqual({})
    mount(<LazyHost maxDepth={2} />)
    expect(captured.atoms.expanded.get()).toEqual({ p: true })
    expect(ids()).toEqual(['p', 'c'])

    // Данные и колонки: та же сохранённая ссылка, новое сужение.
    const DataHost = ({ rows }: { rows: Node[] }) => {
      captured = useCreateTable({
        columns: columns as never,
        data: rows,
        plugins: [rowExpanding({ maxDepth: 1, initialExpanded: true })],
      })
      return null
    }
    act(() => root?.unmount())
    root = undefined
    mount(<DataHost rows={[{ id: 'p', name: 'P' }]} />)
    expect(captured.atoms.expanded.get()).toBe(true)
    mount(
      <DataHost
        rows={[
          {
            id: 'p',
            name: 'P',
            subRows: [{ id: 'c', name: 'C', subRows: [{ id: 'g' }] }],
          },
        ]}
      />,
    )
    expect(captured.atoms.expanded.get()).toEqual({ p: true })
  })

  it('EF5: контролируемый срез — state ядра и аргумент среза плагина — линза читает из опций рендера, как TanStack state: новое значение видно всему коммиту, в том числе layout-эффектам дочерних компонентов; рендер атомы не пишет', () => {
    const inEffects: unknown[] = []
    let rendering = false
    let notifiedInRender = 0
    // Ребёнок хоста: его layout-эффект идёт раньше эффектов самого хоста.
    const Probe = () => {
      useLayoutEffect(() => {
        rendering = false
        inEffects.push(captured.atoms.sorting.get())
      })
      return null
    }
    const ControlledHost = ({ sorting }: { sorting: unknown }) => {
      rendering = true
      captured = useCreateTable({
        columns: columns as never,
        data,
        plugins: [
          columnSorting({
            multiSort: { max: 3 },
            sorting,
            onSortingChange: () => {},
          } as never),
        ],
      })
      return <Probe />
    }
    mount(<ControlledHost sorting={[]} />)
    const unsubscribe = captured.store.subscribe(() => {
      if (rendering) notifiedInRender++
    })
    inEffects.length = 0

    mount(<ControlledHost sorting={SORTED} />)
    expect(inEffects).toEqual([SORTED])
    expect(captured.atoms.sorting.get()).toEqual(SORTED)
    expect(notifiedInRender).toBe(0)
    unsubscribe.unsubscribe?.()
  })

  it('EF6: прерванный конкурентный рендер не оставляет в хранилище срезов следа: срез, чьё сужение появилось только в нём, не заводится, сохранённое ядром не меняется', async () => {
    const nested = [
      {
        id: 'group',
        header: 'Group',
        columns: [
          { id: 'name', accessorKey: 'name' },
          { id: 'rank', accessorKey: 'rank' },
        ],
      },
      { id: 'other', accessorKey: 'other' },
    ]
    const never = new Promise<never>(() => {})
    const Suspend = ({ on }: { on: boolean }) => {
      if (on) use(never)
      return null
    }
    const PinHost = ({ leafPinning }: { leafPinning: boolean }) => {
      captured = useCreateTable({
        columns: nested as never,
        data,
        plugins: [columnPinning({ leafPinning })],
      })
      return null
    }
    let update:
      ((next: { leafPinning: boolean; suspend: boolean }) => void) | undefined
    const App = () => {
      const [props, setProps] = useState({ leafPinning: true, suspend: false })
      update = setProps
      return (
        <Suspense fallback={null}>
          <PinHost leafPinning={props.leafPinning} />
          <Suspend on={props.suspend} />
        </Suspense>
      )
    }
    mount(<App />)
    act(() => captured.getColumn('name').pin('start'))
    const committed = captured
    const atoms = committed.options.atoms

    // Переход сужает закрепление и застревает на ожидании — он не закоммичен.
    await act(async () => {
      startTransition(() => update!({ leafPinning: false, suspend: true }))
    })
    expect(Object.keys(atoms)).not.toContain('columnPinning')
    expect(committed.getColumn('name').getIsPinned()).toBe('start')

    // Тот же переход без ожидания — закоммичен: срез заведён, лист не закреплён.
    act(() => update!({ leafPinning: false, suspend: false }))
    expect(Object.keys(atoms)).toContain('columnPinning')
    expect(captured.getColumn('name').getIsPinned()).toBe(false)
  })

  it('EF7: хранилище аргументов плагинов обновляется в эффекте коммита: новая функция-предикат видна в перерисовке ячеек того же кадра, прерванный конкурентный рендер аргументов не оставляет', async () => {
    let view: { check: () => string } | undefined
    const probe = definePlugin<{ enabled?: boolean; check: () => string }>()({
      id: 'argsProbe',
      refreshOn: ['check'],
      // Вид аргументов с обёртками функций — у `setup` набора, который выполняет эффект.
      setup: opts => () => {
        view = opts as typeof view
      },
    })
    const seen: string[] = []
    // Ячейка под мемоизацией: перерисовывает её только версия отрисовки.
    const Cell = memo(() => {
      usePluginRenderVersion()
      // Вид появляется в эффекте: первый рендер ячейки его ещё не видит.
      seen.push(view?.check() ?? '')
      return null
    })
    const never = new Promise<never>(() => {})
    const Suspend = ({ on }: { on: boolean }) => {
      if (on) use(never)
      return null
    }
    const ArgsHost = ({ check }: { check: () => string }) => {
      captured = useCreateTable({
        columns: columns as never,
        data,
        plugins: [probe({ check })],
      })
      return (
        <PluginRenderVersionContext.Provider
          value={captured.options.pluginRenderVersion}
        >
          <Cell />
        </PluginRenderVersionContext.Provider>
      )
    }
    let update:
      ((next: { check: () => string; suspend: boolean }) => void) | undefined
    const App = () => {
      const [props, setProps] = useState<{
        check: () => string
        suspend: boolean
      }>({ check: () => 'a', suspend: false })
      update = setProps
      return (
        <Suspense fallback={null}>
          <ArgsHost check={props.check} />
          <Suspend on={props.suspend} />
        </Suspense>
      )
    }
    mount(<App />)
    expect(view!.check()).toBe('a')

    // Новый предикат: ячейка перерисована в том же коммите и видит его.
    act(() => update!({ check: () => 'b', suspend: false }))
    expect(seen.at(-1)).toBe('b')

    // Переход с новым предикатом застрял на ожидании — хранилище прежнее.
    await act(async () => {
      startTransition(() => update!({ check: () => 'c', suspend: true }))
    })
    expect(view!.check()).toBe('b')
  })

  it('EF9: канала controlled у definePlugin нет: локальный срез плагина берёт <срез>, on<Срез>Change и initial<Срез> из аргументов', () => {
    definePlugin<{ enabled?: boolean; mark?: number }>()({
      id: 'noControlled',
      state: () => 0,
      // @ts-expect-error — канала `controlled` нет (ADR 0171, §4)
      controlled: { value: 'mark' },
    })
    const onMarkChange = vi.fn()
    const marker = definePlugin<{
      enabled?: boolean
      mark?: number
      onMarkChange?: (next: number) => void
      initialMark?: number
    }>()({ id: 'marker', state: () => 0, stateName: 'mark' })
    const entry = marker({ mark: 2, onMarkChange, initialMark: 1 })
    expect(entry.stateSlices).toEqual([
      { key: 'plugin:marker', value: 2, onChange: onMarkChange, initial: 1 },
    ])
    expect('controlledState' in entry).toBe(false)
  })

  it('EF10: cellEditing принимает editing, onEditingChange и initialEditing, ядро — activeCell, onActiveCellChange и initialActiveCell', () => {
    // Отправленная ячейка отличает начальное значение от значения по умолчанию.
    const initialEditing = {
      active: null,
      submitted: {
        '1:name': {
          rowId: '1',
          columnId: 'name',
          draft: 'B',
          original: 'A',
          status: 'error' as const,
          attempt: 1,
        },
      },
    }
    const initialActiveCell = { rowIndex: 1, columnIndex: 0 }
    const editingKey = 'plugin:cellEditing'
    const cellKey = 'plugin:keyboardNavigation'
    const OwnHost = () => {
      captured = useCreateTable({
        columns: columns as never,
        data,
        initialActiveCell,
        plugins: [cellEditing({ initialEditing })],
      })
      return null
    }
    mount(<OwnHost />)
    // TanStack копирует начальное значение: сравнение по значению.
    expect(captured.atoms[editingKey].get()).toEqual(initialEditing)
    expect(captured.atoms[cellKey].get()).toEqual(initialActiveCell)

    act(() => root?.unmount())
    root = undefined
    const editing = { active: null, submitted: {} }
    const activeCell = { rowIndex: 0, columnIndex: 1 }
    const onEditingChange = vi.fn()
    const onActiveCellChange = vi.fn()
    const AppHost = () => {
      captured = useCreateTable({
        columns: columns as never,
        data,
        activeCell,
        onActiveCellChange,
        plugins: [cellEditing({ editing, onEditingChange })],
      })
      return null
    }
    mount(<AppHost />)
    expect(captured.atoms[editingKey].get()).toBe(editing)
    expect(captured.atoms[cellKey].get()).toBe(activeCell)
    const nextCell = { rowIndex: 1, columnIndex: 1 }
    const nextEditing = { active: null, submitted: {} }
    act(() => {
      setPluginState(captured, 'keyboardNavigation', nextCell)
      setPluginState(captured, 'cellEditing', nextEditing)
    })
    expect(onActiveCellChange).toHaveBeenCalledWith(nextCell)
    expect(onEditingChange).toHaveBeenCalledWith(nextEditing)
    // Срезом владеет приложение: без нового значения от него срез прежний.
    expect(captured.atoms[cellKey].get()).toBe(activeCell)
    expect(captured.atoms[editingKey].get()).toBe(editing)
  })

  it('EF12: подписчик на суженный срез — на атом таблицы table.atoms, на table.store или на сам атом-линзу из options.atoms — получает новое эффективное значение после смены данных и колонок', () => {
    const subscribe = (key: string) => {
      const seen = {
        atom: [] as unknown[],
        store: [] as unknown[],
        lens: [] as unknown[],
      }
      captured.atoms[key].subscribe((value: unknown) => seen.atom.push(value))
      captured.store.subscribe((state: Record<string, unknown>) =>
        seen.store.push(state[key]),
      )
      captured.options.atoms[key].subscribe((value: unknown) =>
        seen.lens.push(value),
      )
      return seen
    }

    // Данные: у новой строки есть дети — раскрытие сужено до глубины 1.
    const DataHost = ({ rows }: { rows: Node[] }) => {
      captured = useCreateTable({
        columns: columns as never,
        data: rows,
        plugins: [rowExpanding({ maxDepth: 1, initialExpanded: true })],
      })
      return null
    }
    mount(<DataHost rows={[{ id: 'p', name: 'P' }]} />)
    const expanded = subscribe('expanded')
    mount(
      <DataHost
        rows={[
          {
            id: 'p',
            name: 'P',
            subRows: [{ id: 'c', name: 'C', subRows: [{ id: 'g' }] }],
          },
        ]}
      />,
    )
    const deep = { p: true }
    expect(expanded.atom.at(-1)).toEqual(deep)
    expect(expanded.store.at(-1)).toEqual(deep)
    expect(expanded.lens.at(-1)).toEqual(deep)

    // Колонки: лист под группой без закрепления листьев — закрепление сужено.
    act(() => root?.unmount())
    root = undefined
    const nested = [
      { id: 'group', header: 'Group', columns },
      { id: 'other', accessorKey: 'other' },
    ]
    const PinHost = ({ cols }: { cols: unknown[] }) => {
      captured = useCreateTable({
        columns: cols as never,
        data,
        plugins: [columnPinning({ leafPinning: false })],
      })
      return null
    }
    mount(<PinHost cols={columns} />)
    act(() => captured.getColumn('name').pin('start'))
    const pinning = subscribe('columnPinning')
    mount(<PinHost cols={nested} />)
    const startOf = (value: unknown) =>
      (value as { start?: string[] } | undefined)?.start ?? []
    for (const seen of Object.values(pinning)) expect(seen).not.toHaveLength(0)
    expect(startOf(pinning.atom.at(-1))).not.toContain('name')
    expect(startOf(pinning.store.at(-1))).not.toContain('name')
    expect(startOf(pinning.lens.at(-1))).not.toContain('name')
  })

  it('EF11: итог сужения от того же сохранённого значения с теми же полями — прежний объект; от другого сохранённого значения прежний не берётся, даже если поля равны (значения «всё, кроме» выбора строк — разные объекты)', () => {
    const DataSortHost = ({
      rows,
      max,
    }: {
      rows: typeof data
      max: number
    }) => {
      captured = useCreateTable({
        columns: columns as never,
        data: rows,
        plugins: [columnSorting({ multiSort: { max } } as never)],
      })
      return null
    }
    mount(<DataSortHost rows={data} max={3} />)
    act(() => {
      captured.getColumn('name').toggleSorting(false, false)
      captured.getColumn('rank').toggleSorting(true, true)
    })
    mount(<DataSortHost rows={data} max={1} />)
    // Новые данные — пересчёт сужения; сохранённое прежнее, итог по полям тот же.
    const narrowed = captured.atoms.sorting.get()
    expect(narrowed).toEqual([SORTED[0]])
    mount(<DataSortHost rows={[...data]} max={1} />)
    expect(captured.atoms.sorting.get()).toBe(narrowed)

    // «Всё, кроме»: у каждого значения свой объект-вид, по полям виды равны.
    act(() => root?.unmount())
    root = undefined
    const SelectHost = () => {
      captured = useCreateTable({
        columns: columns as never,
        data,
        plugins: [rowSelectionModel()],
      })
      return null
    }
    mount(<SelectHost />)
    const first = { all: true, except: [] as string[] }
    const second = { all: true, except: first.except }
    act(() => captured.setRowSelection(first))
    expect(allSelectionOf(captured.atoms.rowSelection.get())).toBe(first)
    act(() => captured.setRowSelection(second))
    expect(allSelectionOf(captured.atoms.rowSelection.get())).toBe(second)
  })
})

interface Node {
  id: string
  name?: string
  subRows?: Node[]
}
