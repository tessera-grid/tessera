import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { commands } from 'vitest/browser'
import { expect } from 'vitest'

import { useCreateTable } from '../../core/useCreateTable'
import { DataGrid } from '../../grid/DataGrid'
import { columns as mockColumns } from '../__mocks__/columns'
import { getData } from '../__mocks__/data'
import {
  argsToPlugins,
  type FeatureToggles,
} from '../__mocks__/utils/argsToPlugins'
import type { DomCounters, GlobalListeners } from './memory.commands'

// Помощники набора утечек (ADR 0092): свой корень React вместо `render` из
// `vitest-browser-react`, метки удерживаемых объектов, сборка мусора и наклон роста.

type Point = { x: number; y: number }

export const memory = commands as unknown as {
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseDown: (at: Point) => Promise<void>
  realMouseUp: () => Promise<void>
  collectGarbage: () => Promise<void>
  domCounters: () => Promise<DomCounters>
  globalListeners: () => Promise<GlobalListeners>
  heapUsed: () => Promise<number>
  retainingPaths: (className: string, labels: string[]) => Promise<string[]>
}

/** Все плагины грида, кроме ленты: с пагинацией она инертна (ADR 0081). */
export const ALL_PLUGINS: FeatureToggles = {
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableRowExpanding: true,
  enableTreeLines: true,
  enableRowDragging: true,
  enableColumnSorting: true,
  enableColumnPinning: true,
  enableColumnSizing: true,
  enableColumnDragging: true,
  enableRowGrouping: true,
  enableRowActions: true,
  enableHeaderActionMenu: true,
  enableRowActionMenu: true,
  enableCellEditing: true,
  enableCellSelection: true,
  enableContextMenu: true,
  enableKeyboardNavigation: true,
  enableColumnVisibility: true,
  enableColumnFiltering: true,
  enableQuickSearch: true,
  enableDataExport: true,
  enablePagination: true,
  enableBackToTop: true,
}

export interface GridProps {
  toggles?: FeatureToggles
  /** Готовый набор записей плагинов вместо `toggles`. */
  plugins?: readonly unknown[]
  data?: unknown[]
  columns?: unknown[]
  /** Отдаёт тесту экземпляр таблицы после каждого коммита. */
  onTable?: (table: object) => void
  colorMode?: 'auto' | 'light' | 'dark'
}

const DEFAULT_DATA = getData(60, 'nested')

export const Grid = ({
  toggles = ALL_PLUGINS,
  plugins: pluginsProp,
  data = DEFAULT_DATA,
  columns = mockColumns,
  onTable,
  colorMode,
}: GridProps) => {
  const built = useMemo(() => argsToPlugins(toggles), [toggles])
  const plugins = pluginsProp ?? built
  const table = useCreateTable({
    columns: columns as never,
    data: data as never,
    getRowId: (row: { id: string }) => row.id,
    plugins: plugins as never,
  })
  useEffect(() => {
    onTable?.(table)
  })
  return (
    // По ширине окна теста: действия мышью идут по координатам и не прокручивают к цели.
    <div style={{ width: window.innerWidth - 8, height: 520 }}>
      <DataGrid table={table} height={480} colorMode={colorMode} />
    </div>
  )
}

export interface Mounted {
  container: HTMLElement
  render: (element: ReactElement) => void
  unmount: () => void
}

/** Монтирует в свой корень в StrictMode; `unmount` убирает и корень, и контейнер. */
export const mount = (element: ReactElement): Mounted => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  // Элемент — вне колбэка `flushSync`: стек отладки dev-сборки держал бы контекст
  // колбэка, а с ним — элемент первого рендера.
  const render = (next: ReactElement) => {
    const element = <StrictMode>{next}</StrictMode>
    flushSync(() => root.render(element))
  }
  render(element)
  return {
    container,
    render,
    unmount: () => {
      flushSync(() => root.unmount())
      container.remove()
    },
  }
}

/**
 * Ждёт условия по кадрам. Не `expect.poll`: Vitest держит каждое ожидание до конца
 * теста, а с ним — всё, что замкнула проверка.
 */
export const waitFor = async (check: () => boolean, timeout = 3000) => {
  const started = performance.now()
  while (!check()) {
    if (performance.now() - started > timeout) {
      throw new Error('условие не выполнилось за ' + timeout + ' мс')
    }
    await frames()
  }
}

/** Ждёт, пока грид нарисует строки тела. */
export const settled = async (container: ParentNode = document) => {
  await waitFor(
    () => container.querySelectorAll('.data-grid__body-row').length > 0,
  )
  await frames(2)
}

/**
 * Ждёт, пока документ затихнет: `quiet` мс без новых узлов в `<head>` и без загрузок
 * ресурсов. Ленивые модули, начатые при рендере (ADR 0061), приходят позже монтирования
 * и вставляют свои стили — один раз на документ.
 */
export const waitForQuietDocument = async (quiet = 1000, timeout = 15_000) => {
  let last = performance.now()
  const touch = () => (last = performance.now())
  const head = new MutationObserver(touch)
  head.observe(document.head, { childList: true })
  const resources = new PerformanceObserver(touch)
  resources.observe({ type: 'resource' })
  try {
    await waitFor(() => performance.now() - last >= quiet, timeout)
  } finally {
    head.disconnect()
    resources.disconnect()
  }
}

/**
 * Первая таблица документа удерживается навсегда (`leaks.ts`), а ленивые модули
 * грузятся один раз на документ: тесты прогревают документ одним гридом и ждут, пока
 * модули придут.
 */
export const warmUpDocument = async () => {
  const mounted = mount(<Grid />)
  await settled(mounted.container)
  await waitForQuietDocument()
  mounted.unmount()
}

export const frames = async (count = 1) => {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

/** Метка удерживаемого объекта: по имени класса её находит снимок кучи. */
export class TesseraLeakMarker {
  constructor(readonly label: string) {}
}

const MARKER = Symbol('tesseraLeakMarker')

export interface Tracked {
  label: string
  ref: WeakRef<object>
}

/** `WeakRef` на объект и метка на нём — для пути удержания при падении. */
export const track = (label: string, target: object): Tracked => {
  Object.defineProperty(target, MARKER, {
    value: new TesseraLeakMarker(label),
    configurable: true,
  })
  return { label, ref: new WeakRef(target) }
}

const Flush = () => {
  const [count, setCount] = useState(0)
  return (
    <>
      <input aria-label="flush" />
      <button type="button" onClick={() => setCount(count + 1)}>
        {count}
      </button>
    </>
  )
}

/**
 * Сбрасывает служебные переменные модуля React DOM (`leaks.ts`): событие и рендер в
 * отдельном корне вытесняют последнюю цель события, очередь обновлений и поле ввода в
 * фокусе.
 */
export const flushReactBookkeeping = async () => {
  const mounted = mount(<Flush />)
  const input = mounted.container.querySelector('input')!
  input.focus()
  input.blur()
  mounted.container.querySelector('button')!.click()
  await frames(2)
  mounted.unmount()
}

/**
 * Требует, чтобы сборщик мусора забрал все объекты; иначе падает с путями удержания
 * меток от корня кучи.
 */
export const expectCollected = async (tracked: Tracked[]) => {
  await flushReactBookkeeping()
  await memory.collectGarbage()
  let alive = tracked.filter(item => item.ref.deref() !== undefined)
  if (alive.length > 0) {
    // Отложенная работа — таймеры затухания, кадры — отпускает объекты не сразу.
    await new Promise(resolve => setTimeout(resolve, 500))
    await flushReactBookkeeping()
    await memory.collectGarbage()
    alive = alive.filter(item => item.ref.deref() !== undefined)
  }
  if (alive.length === 0) {
    return
  }
  const paths = await memory.retainingPaths(
    TesseraLeakMarker.name,
    alive.map(item => item.label),
  )
  throw new Error(
    `удержаны: ${alive.map(item => item.label).join(', ')}\n` +
      `пути удержания:\n${paths.map(path => `  ${path}`).join('\n') || '  (не найдены)'}`,
  )
}

/** Сколько отслеживаемых объектов пережили сборку мусора. */
export const countAlive = async (tracked: Tracked[]) => {
  await flushReactBookkeeping()
  await memory.collectGarbage()
  return tracked.filter(item => item.ref.deref() !== undefined).length
}

/**
 * Разброс числа удержанных объектов: React держит в двух буферах fiber пропсы
 * последних отрисовок, а поддерево без перерисовки — пропсы своей (`leaks.ts`).
 */
export const RETAINED_NOISE = 2

export interface Growth {
  nodes: number
  jsEventListeners: number
  heap: number
}

const sample = async (): Promise<Growth> => {
  const counters = await memory.domCounters()
  return {
    nodes: counters.nodes,
    jsEventListeners: counters.jsEventListeners,
    heap: await memory.heapUsed(),
  }
}

const diff = (to: Growth, from: Growth): Growth => ({
  nodes: to.nodes - from.nodes,
  jsEventListeners: to.jsEventListeners - from.jsEventListeners,
  heap: to.heap - from.heap,
})

/**
 * Шум одного замера после сборки мусора. Узлы и обработчики после полной сборки
 * считаются точно: утечка в один узел или обработчик за цикл за N циклов даёт рост
 * больше шума (LK11). Куча гуляет на кэшах V8 и React до 2 МБ — это грубая сеть: при
 * N = 4 она ловит утечку от ~0,6 МБ за цикл.
 */
export const NOISE: Growth = { nodes: 2, jsEventListeners: 2, heap: 2_500_000 }

export interface Slope {
  /** Прирост за первые N циклов после прогрева. */
  first: Growth
  /** Прирост за следующие 2N циклов. */
  second: Growth
}

/**
 * Наклон роста: прогрев, затем N циклов и ещё 2N. Без утечки прирост за 2N — в пределах
 * шума от прироста за N; утечка удваивает его.
 */
export const measureSlope = async (
  cycle: (index: number) => Promise<void>,
  { warmup = 3, cycles = 8 }: { warmup?: number; cycles?: number } = {},
): Promise<Slope> => {
  let index = 0
  for (let i = 0; i < warmup; i++) {
    await cycle(index++)
  }
  const start = await sample()
  for (let i = 0; i < cycles; i++) {
    await cycle(index++)
  }
  const middle = await sample()
  for (let i = 0; i < cycles * 2; i++) {
    await cycle(index++)
  }
  const end = await sample()
  return { first: diff(middle, start), second: diff(end, middle) }
}

type GrowthKey = keyof Growth

/** Рост не зависит от числа циклов: прирост за 2N не больше прироста за N плюс шум. */
export const expectFlat = (
  slope: Slope,
  keys: GrowthKey[] = ['nodes', 'jsEventListeners'],
) => {
  for (const key of keys) {
    expect(
      slope.second[key],
      `${key}: за N циклов +${slope.first[key]}, за 2N +${slope.second[key]}`,
    ).toBeLessThanOrEqual(Math.max(slope.first[key], 0) + NOISE[key])
  }
}

// Действия мышью по координатам: `userEvent` с элементом оставляет локатор в отчёте
// Vitest до конца теста, а с ним — элемент и весь его отсоединённый DOM.

let pointer: Point = { x: 1, y: 1 }

const center = (element: Element): Point => {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

export const hover = async (element: Element) => {
  const to = center(element)
  await memory.realMouseMove(pointer, to, 4)
  pointer = to
  await frames(2)
}

/** Ждёт конечные анимации ячейки: кнопки проявляются шириной (ADR 0076). */
const settleAnimations = async (element: Element) => {
  const scope =
    element.closest('.data-grid__head-cell, .data-grid__body-cell') ?? element
  await Promise.all(
    scope
      .getAnimations({ subtree: true })
      .filter(
        animation => animation.effect?.getTiming().iterations !== Infinity,
      )
      .map(animation => animation.finished.catch(() => undefined)),
  )
}

/** Клик в темпе человека: нажатие, пауза, отпускание. */
export const click = async (element: Element) => {
  await hover(element)
  await settleAnimations(element)
  await hover(element)
  await memory.realMouseDown(pointer)
  await new Promise(resolve => setTimeout(resolve, 100))
  await memory.realMouseUp()
  await frames(2)
}

/** Уводит указатель в угол: наведение не держит тултипы следующего цикла. */
export const parkPointer = async () => {
  const to = { x: 1, y: 1 }
  await memory.realMouseMove(pointer, to, 2)
  pointer = to
}
