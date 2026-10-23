import { commands, userEvent } from 'vitest/browser'
import { beforeAll, describe, expect, test } from 'vitest'

import { getData } from '../../__mocks__/data'
import {
  ALL_PLUGINS,
  Grid,
  NOISE,
  TesseraLeakMarker,
  click,
  expectCollected,
  flushReactBookkeeping,
  frames,
  hover,
  hoverSettled,
  memory,
  mount,
  parkPointer,
  settled,
  track,
  waitFor,
  warmUpDocument,
  type GridProps,
  type Tracked,
} from '../memory.helpers'
import {
  MODULE,
  holdModule,
  releaseModule,
  rightClick,
} from '../visual/lazy-helpers'
import { tableLabels } from '../labels'

// Утечки при размонтировании (ADR 0092, LK1–LK4): грид со всеми плагинами монтируется
// и размонтируется в разных состояниях; после сборки мусора таблица и корень грида
// собраны, узлы, обработчики и порталы — как до монтирования.

const pointer = commands as unknown as {
  realDragHold: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps?: number,
  ) => Promise<void>
  realMouseUp: () => Promise<void>
}

const CYCLES = 20

beforeAll(warmUpDocument)

interface Cycle {
  container: HTMLElement
  table: object
}

/**
 * Монтирует грид, доводит до состояния, отдаёт метки таблицы и корня и размонтирует.
 * Всё, что держит смонтированный грид, живёт только внутри вызова.
 */
const cycle = async (
  label: string,
  props: Omit<GridProps, 'onTable'> = {},
  state: (cycle: Cycle) => Promise<void> = async () => {},
  afterUnmount: () => Promise<void> = async () => {},
): Promise<Tracked[]> => {
  await parkPointer()
  const box: { table?: object } = {}
  const mounted = mount(
    <Grid {...props} onTable={table => (box.table = table)} />,
  )
  await settled(mounted.container)
  await state({ container: mounted.container, table: box.table! })
  const tracked = [
    track(`${label}: таблица`, box.table!),
    track(`${label}: корень грида`, mounted.container.firstElementChild!),
  ]
  box.table = undefined
  mounted.unmount()
  await afterUnmount()
  await frames(2)
  return tracked
}

/** Счётчики после того же сброса служебных ссылок React, что и в `expectCollected`. */
const settledCounters = async () => {
  await flushReactBookkeeping()
  return memory.domCounters()
}

const bodyChildren = () =>
  [...document.body.children].filter(el => el.tagName !== 'SCRIPT').length

const headCell = (container: ParentNode, id: string) =>
  container.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const bodyCell = (container: ParentNode, column: string) =>
  container.querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!
const menu = () => document.querySelector('[role="menu"]')
const dialog = () => document.querySelector('[role="dialog"]')
/** Тултип и поповеры Base UI помечены стороной раскрытия. */
const tooltip = () => document.querySelector('[data-side]')

/** Ошибки и предупреждения консоли — строками, чтобы не удержать аргументы. */
const recordConsole = () => {
  const messages: string[] = []
  const original = { error: console.error, warn: console.warn }
  console.error = (...args: unknown[]) =>
    messages.push(args.map(String).join(' '))
  console.warn = (...args: unknown[]) =>
    messages.push(args.map(String).join(' '))
  const onError = (event: ErrorEvent) => messages.push(String(event.message))
  const onRejection = (event: PromiseRejectionEvent) =>
    messages.push(String(event.reason))
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return {
    messages,
    stop: () => {
      console.error = original.error
      console.warn = original.warn
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    },
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => (resolve = done))
  return { promise, resolve }
}

describe('Утечки при размонтировании', () => {
  test(`LK1: после ${CYCLES} циклов монтирования и размонтирования грида со всеми плагинами сборщик мусора забирает корень грида и экземпляр таблицы`, async () => {
    const tracked: Tracked[] = []
    for (let i = 0; i < CYCLES; i++) {
      tracked.push(...(await cycle(`цикл ${i}`)))
    }
    await expectCollected(tracked)
  })

  test(`LK2: после ${CYCLES} циклов число DOM-узлов и JS-обработчиков возвращается к исходному, а на window и document не остаётся обработчиков грида`, async () => {
    const counters = await settledCounters()
    const listeners = await memory.globalListeners()
    let mountedListeners = listeners
    let last: Tracked | undefined
    for (let i = 0; i < CYCLES; i++) {
      await cycle(`цикл ${i}`, {}, async ({ container }) => {
        if (i === 0) {
          mountedListeners = await memory.globalListeners()
        }
        if (i === CYCLES - 1) {
          last = track('контейнер последнего цикла', container)
        }
      })
    }
    // Грид действительно вешает свои обработчики — иначе проверка ничего не доказывает.
    expect(
      mountedListeners.window.length + mountedListeners.document.length,
    ).toBeGreaterThan(listeners.window.length + listeners.document.length)
    const growth = async () => {
      const after = await settledCounters()
      return {
        nodes: after.nodes - counters.nodes,
        jsEventListeners: after.jsEventListeners - counters.jsEventListeners,
      }
    }
    const withinNoise = (grown: { nodes: number; jsEventListeners: number }) =>
      grown.nodes <= NOISE.nodes &&
      grown.jsEventListeners <= NOISE.jsEventListeners
    let grown = await growth()
    if (!withinNoise(grown)) {
      // Отложенная работа отпускает последний корень не сразу — как в `expectCollected`.
      await new Promise(resolve => setTimeout(resolve, 500))
      grown = await growth()
    }
    // Корень React вешает обработчики всех событий на свой контейнер: удержанный
    // контейнер — это +1 узел и ~140 обработчиков.
    const paths =
      withinNoise(grown) || !last?.ref.deref()
        ? []
        : await memory.retainingPaths(TesseraLeakMarker.name, [last.label])
    const report = `пути удержания контейнера:\n${paths.join('\n') || '(контейнер собран)'}`
    expect(grown.nodes, report).toBeLessThanOrEqual(NOISE.nodes)
    expect(grown.jsEventListeners, report).toBeLessThanOrEqual(
      NOISE.jsEventListeners,
    )
    expect(await memory.globalListeners()).toEqual(listeners)
  })

  test('LK3: размонтирование с открытым меню, поповером, тултипом, контекстным меню, в сессии правки и посреди перетаскивания не оставляет порталов, обработчиков и удержанных грида и таблицы', async () => {
    const listeners = await memory.globalListeners()
    const children = bodyChildren()
    const inline: GridProps = {
      toggles: { ...ALL_PLUGINS, enableHeaderActionMenu: false },
    }
    const states: [string, GridProps, (cycle: Cycle) => Promise<void>][] = [
      [
        'меню колонки',
        {},
        async ({ container }) => {
          await hover(headCell(container, 'country'))
          await click(
            headCell(container, 'country').querySelector<HTMLElement>(
              `[aria-label^="${tableLabels.headerMenu}"]`,
            )!,
          )
          await waitFor(() => menu() !== null)
        },
      ],
      [
        'поповер фильтра',
        inline,
        async ({ container }) => {
          await hover(headCell(container, 'country'))
          await click(
            headCell(container, 'country').querySelector<HTMLElement>(
              '.column-filter__button',
            )!,
          )
          await waitFor(
            () =>
              document.querySelector('[data-testid="filter-panel"]') !== null,
          )
        },
      ],
      [
        'тултип',
        inline,
        async ({ container }) => {
          const head = headCell(container, 'country')
          await hover(head)
          // Кнопка раскрывается со сдвигом: наводим, когда она встала.
          await hoverSettled(
            head.querySelector<HTMLElement>('.column-filter__button')!,
          )
          await waitFor(
            () => tooltip()?.textContent?.trim() === tableLabels.filter,
          )
        },
      ],
      [
        'контекстное меню',
        {},
        async ({ container }) => {
          rightClick(bodyCell(container, 'country'))
          await waitFor(() => menu() !== null)
        },
      ],
      [
        'сессия правки',
        {},
        async ({ container }) => {
          const cell = bodyCell(container, 'country')
          await hover(cell)
          await click(
            cell.querySelector<HTMLElement>(
              `[aria-label="${tableLabels.editCell}"]`,
            )!,
          )
          await waitFor(() => cell.querySelector('input') !== null)
        },
      ],
      [
        'перетаскивание колонки',
        inline,
        async ({ container }) => {
          const head = headCell(container, 'country')
          await hover(head)
          const box = head
            .querySelector<HTMLElement>('.drag__handler--column')!
            .getBoundingClientRect()
          const from = {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
          }
          await pointer.realDragHold(from, { x: from.x + 160, y: from.y })
          await waitFor(
            () =>
              document.querySelector('.data-grid-head__cell--overlay') !== null,
          )
        },
      ],
    ]
    const tracked: Tracked[] = []
    for (const [label, props, state] of states) {
      tracked.push(
        ...(await cycle(label, props, state, async () => {
          if (label === 'перетаскивание колонки') {
            await pointer.realMouseUp()
            // dnd-kit снимает обработчики document через 50 мс после отпускания.
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          expect(menu(), label).toBeNull()
          expect(dialog(), label).toBeNull()
          expect(tooltip(), label).toBeNull()
          expect(bodyChildren(), label).toBe(children)
        })),
      )
    }
    expect(await memory.globalListeners()).toEqual(listeners)
    await expectCollected(tracked)
  })

  test('LK4: размонтирование посреди ожидания loadChildren, асинхронного колбэка, затухающей подсветки и загрузки ленивого модуля: отложенная работа после размонтирования ничего не делает, а грид и таблица собираются', async () => {
    const recorder = recordConsole()
    const tracked: Tracked[] = []
    try {
      const children = deferred<unknown[]>()
      let childrenAsked = 0
      tracked.push(
        ...(await cycle(
          'ожидание loadChildren',
          {
            data: getData(60),
            toggles: {
              ...ALL_PLUGINS,
              rowExpandingHasChildren: () => true,
              rowExpandingLoadChildren: () => {
                childrenAsked++
                return children.promise as never
              },
            },
          },
          async ({ container }) => {
            container
              .querySelector<HTMLElement>(
                `[aria-label="${tableLabels.expandRow}"]`,
              )!
              .click()
            await waitFor(() => childrenAsked > 0)
          },
          async () => children.resolve([{ id: 'late', firstName: 'Late' }]),
        )),
      )

      const saved = deferred<void>()
      let edits = 0
      tracked.push(
        ...(await cycle(
          'ожидание onCellEdit',
          {
            toggles: {
              ...ALL_PLUGINS,
              onCellEdit: () => {
                edits++
                return saved.promise
              },
            },
          },
          async ({ container }) => {
            const cell = bodyCell(container, 'country')
            await hover(cell)
            await click(
              cell.querySelector<HTMLElement>(
                `[aria-label="${tableLabels.editCell}"]`,
              )!,
            )
            await waitFor(() => cell.querySelector('input') !== null)
            await userEvent.keyboard('{Control>}a{/Control}Changed{Enter}')
            await waitFor(() => edits > 0)
          },
          async () => saved.resolve(),
        )),
      )

      const until = deferred<void>()
      tracked.push(
        ...(await cycle(
          'затухающая подсветка',
          {},
          async ({ table }) => {
            const api = table as {
              highlight: (
                target: { row: string },
                options: { duration?: number; until?: PromiseLike<unknown> },
              ) => unknown
            }
            api.highlight({ row: 'item-id-1' }, { duration: 400 })
            api.highlight({ row: 'item-id-2' }, { until: until.promise })
            await frames(2)
          },
          async () => {
            until.resolve()
            await new Promise(resolve => setTimeout(resolve, 500))
          },
        )),
      )

      await holdModule(MODULE.export)
      tracked.push(
        ...(await cycle(
          'загрузка ленивого модуля',
          {},
          async ({ container }) => {
            await click(
              container.querySelector<HTMLElement>(
                '[data-testid="export-button"]',
              )!,
            )
            await frames(2)
          },
          async () => {
            await releaseModule(MODULE.export)
            await new Promise(resolve => setTimeout(resolve, 300))
          },
        )),
      )
    } finally {
      recorder.stop()
    }
    expect(recorder.messages).toEqual([])
    expect(menu()).toBeNull()
    expect(dialog()).toBeNull()
    await expectCollected(tracked)
  })
})
