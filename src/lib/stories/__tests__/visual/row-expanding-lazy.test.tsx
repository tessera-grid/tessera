import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { COLUMN_EXPANDING_ID } from '../../../../lib/plugins/rowExpanding'
import { composed } from '../stories'
import {
  getScroller,
  humanClick,
  pendingArcOf,
  revealCellButtons,
  rowState,
  scrollToEnd,
} from '../helpers'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { tableLabels } from '../labels'

// Ленивые дети строк (ADR 0054): RE17–RE18, RE20, RE23–RE25, RE30–RE33, RE37, RE40;
// подсветка прихода (ADR 0056): RE42, RE45–RE49; склейка ответов (ADR 0066): RE66.
// Грид — история RowExpanding с данными без `subRows`; `hasChildren` читает
// `childCount`, `loadChildren` отдаёт ответы, которыми управляет тест. Состояние
// читается из контракта DOM: `data-row-id`, `data-expanded`, `aria-busy`,
// `aria-expanded` тоггла, `data-error-flash` и live-область грида.

interface Person {
  id: string
  firstName: string
  lastName: string
  childCount?: number
}

const person = (id: string, childCount = 0): Person => ({
  id,
  firstName: id,
  lastName: 'Doe',
  childCount,
})
const kids = (parent: string, count: number) =>
  Array.from({ length: count }, (_, i) => person(`${parent}-c${i}`))

const ROOTS = [person('lazy', 2), person('leaf'), person('other', 1)]

const hasChildren = (row: { original: Person }) =>
  (row.original.childCount ?? 0) > 0

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Loader = (row: { id: string }) => Person[] | Promise<Person[]>

const renderLazy = (
  loadChildren: Loader,
  args: Partial<Parameters<typeof composed.RowExpandingPlayground>[0]> = {},
) =>
  render(
    <composed.RowExpandingPlayground
      dataOverride={ROOTS}
      rowExpandingHasChildren={hasChildren as never}
      rowExpandingLoadChildren={loadChildren as never}
      {...args}
    />,
  )

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const toggleOf = (id: string) =>
  rowOf(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
const liveText = () =>
  document.querySelector('[role="status"][aria-live]')?.textContent ?? ''

const waitRow = (id: string) => expect.poll(() => rowOf(id)).not.toBeNull()

describe('Row expanding: lazy children', () => {
  test('RE17: a row marked by hasChildren without subRows gets a toggle and data-expanded="false"; an unmarked row is a leaf', async () => {
    await renderLazy(() => [])
    await waitRow('lazy')
    expect(toggleOf('lazy')).not.toBeNull()
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('false')
    expect(toggleOf('leaf')).toBeNull()
    expect(rowOf('leaf')!.hasAttribute('data-expanded')).toBe(false)
  })

  test('RE18: the first expand calls loadChildren, the toggle and the row are busy, the answer shows the children under the row', async () => {
    const answer = deferred<Person[]>()
    const load = vi.fn<Loader>(() => answer.promise)
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0]![0].id).toBe('lazy')
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('aria-busy'))
      .toBe('true')
    expect(rowOf('lazy')!.getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(toggleOf('lazy')!)?.dataset.phase).toBe('pending')
    answer.resolve(kids('lazy', 2))
    await waitRow('lazy-c1')
    expect(rowOf('lazy-c0')).not.toBeNull()
    expect(rowOf('lazy')!.hasAttribute('aria-busy')).toBe(false)
    expect(toggleOf('lazy')!.hasAttribute('aria-busy')).toBe(false)
  })

  test('RE20: collapsing keeps the answer; expanding again shows the saved children at once and calls loadChildren again', async () => {
    const refresh = deferred<Person[]>()
    const load = vi
      .fn<Loader>()
      .mockReturnValueOnce(kids('lazy', 2))
      .mockReturnValueOnce(refresh.promise)
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(() => rowOf('lazy-c0')).toBeNull()
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    expect(load).toHaveBeenCalledTimes(2)
    expect(toggleOf('lazy')!.getAttribute('aria-busy')).toBe('true')
    refresh.resolve(kids('lazy', 3))
    await waitRow('lazy-c2')
  })

  test('RE23: an empty answer turns the row into a leaf until data changes; then the toggle returns', async () => {
    const screen = await renderLazy(() => [])
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(() => toggleOf('lazy')).toBeNull()
    expect(rowOf('lazy')!.hasAttribute('data-expanded')).toBe(false)
    await screen.rerender(
      <composed.RowExpandingPlayground
        dataOverride={[...ROOTS]}
        rowExpandingHasChildren={hasChildren as never}
        rowExpandingLoadChildren={(() => []) as never}
      />,
    )
    await expect.poll(() => toggleOf('lazy')).not.toBeNull()
  })

  test('RE24: a failure without a saved answer collapses the row, flashes the toggle and announces the error text', async () => {
    await renderLazy(() => Promise.reject(new Error('Server down')))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('false')
    await expect
      .poll(liveText)
      .toContain(tableLabels.announceExpandFailed('Server down'))
  })

  test('RE25: a failure with a saved answer keeps the row expanded with the old children; flash and announcement are the same', async () => {
    const load = vi
      .fn<Loader>()
      .mockReturnValueOnce(kids('lazy', 2))
      .mockImplementationOnce(() => Promise.reject('Timeout'))
    await renderLazy(load)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(toggleOf('lazy')!)
    await humanClick(toggleOf('lazy')!)
    await expect
      .poll(() => toggleOf('lazy')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    expect(rowOf('lazy-c1')).not.toBeNull()
    await expect
      .poll(liveText)
      .toContain(tableLabels.announceExpandFailed('Timeout'))
  })

  test('RE30: column "auto" shows the expanding column when a root is marked by hasChildren and no row has subRows', async () => {
    const expandingHead = () =>
      document.querySelector(
        `.data-grid__head-cell[data-column-id='${COLUMN_EXPANDING_ID}']`,
      )
    const screen = await renderLazy(() => [])
    await waitRow('lazy')
    expect(expandingHead()).not.toBeNull()
    await screen.rerender(
      <composed.RowExpandingPlayground
        dataOverride={[person('x'), person('y')]}
        rowExpandingHasChildren={hasChildren as never}
        rowExpandingLoadChildren={(() => []) as never}
      />,
    )
    await expect.poll(expandingHead).toBeNull()
  })

  test('RE31: Enter expands a lazy row from the keyboard; ARIA is right in treegrid and in table', async () => {
    const load = vi.fn<Loader>(row => kids(row.id, 1))
    const screen = await renderLazy(load, { enableKeyboardNavigation: true })
    await waitRow('lazy')
    expect(document.querySelector('[role="treegrid"]')).not.toBeNull()
    const expandCell = rowOf('lazy')!.querySelector<HTMLElement>(
      `[data-column-id='${COLUMN_EXPANDING_ID}']`,
    )!
    expandCell.focus()
    await userEvent.keyboard('{Enter}')
    await waitRow('lazy-c0')
    expect(load).toHaveBeenCalledTimes(1)
    expect(rowOf('lazy')!.getAttribute('aria-expanded')).toBe('true')
    await screen.unmount()

    await renderLazy(load)
    await waitRow('other')
    expect(document.querySelector('[role="table"]')).not.toBeNull()
    await humanClick(toggleOf('other')!)
    await waitRow('other-c0')
    expect(toggleOf('other')!.getAttribute('aria-expanded')).toBe('true')
    expect(rowOf('other')!.hasAttribute('aria-expanded')).toBe(false)
  })

  test('RE32: an expanded lazy row with children survives leaving the virtualization window, sorting and a page change', async () => {
    const many = [
      person('lazy', 2),
      ...Array.from({ length: 120 }, (_, i) =>
        person(`row-${String(i).padStart(3, '0')}`),
      ),
    ]
    const load = vi.fn<Loader>(row => kids(row.id, 2))
    const args = {
      dataOverride: many,
      rowExpandingHasChildren: hasChildren as never,
      rowExpandingLoadChildren: load as never,
    }
    const screen = await render(<composed.RowExpandingPlayground {...args} />)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await scrollToEnd('y')
    await expect.poll(() => rowOf('lazy')).toBeNull()
    getScroller().scrollTop = 0
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')

    await screen.rerender(
      <composed.RowExpandingPlayground {...args} enableColumnSorting />,
    )
    const sort = document.querySelector<HTMLElement>(
      ".data-grid__head-cell[data-column-id='firstName'] .column-sort__button",
    )!
    // Клик посреди раскрытия кнопки уходит мимо (ADR 0076).
    await revealCellButtons(sort.closest('.data-grid__head-cell')!)
    await humanClick(sort)
    await humanClick(sort)
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    await screen.unmount()

    await render(
      <composed.RowExpandingPlayground
        {...args}
        enablePagination
        paginationInitialPageSize={10}
      />,
    )
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(
      document.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.nextPage}"]`,
      )!,
    )
    await expect.poll(() => rowOf('lazy')).toBeNull()
    await humanClick(
      document.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.previousPage}"]`,
      )!,
    )
    await waitRow('lazy-c1')
    expect(rowOf('lazy')!.getAttribute('data-expanded')).toBe('true')
    // Сортировка и смена страницы не перезагружают детей.
    expect(load).toHaveBeenCalledTimes(2)
  })

  test('RE33: children of a selected parent arrive unselected; the parent selection does not change', async () => {
    const answer = deferred<Person[]>()
    await renderLazy(() => answer.promise, {
      enableRowSelection: true,
      rowSelectionSubRows: true,
    })
    await waitRow('lazy')
    const checkbox = (id: string) =>
      rowOf(id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
    await humanClick(checkbox('lazy')!)
    await expect
      .poll(() => checkbox('lazy')!.getAttribute('aria-checked'))
      .toBe('true')
    await humanClick(toggleOf('lazy')!)
    answer.resolve(kids('lazy', 2))
    await waitRow('lazy-c1')
    for (const id of ['lazy-c0', 'lazy-c1']) {
      expect(checkbox(id)!.getAttribute('aria-checked'), id).toBe('false')
    }
    expect(checkbox('lazy')!.getAttribute('aria-checked')).toBe('true')
  })

  test('RE37: a rejected onExpandRow promise without loadChildren gives the same flash and announcement', async () => {
    const tree = [{ ...person('p'), subRows: [person('p-c0')] }, person('q')]
    await render(
      <composed.RowExpandingPlayground
        dataOverride={tree}
        onExpandRow={(_row, expanded) =>
          expanded ? Promise.reject(new Error('No access')) : undefined
        }
      />,
    )
    await waitRow('p')
    await humanClick(toggleOf('p')!)
    await expect
      .poll(() => toggleOf('p')!.getAttribute('data-error-flash'))
      .toBe('on')
    expect(rowOf('p')!.getAttribute('data-expanded')).toBe('false')
    await expect
      .poll(liveText)
      .toContain(tableLabels.announceExpandFailed('No access'))
  })
})

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

/** Переопределить токены темы грида на время теста. */
const themeTokens = (vars: Record<string, string>) => {
  const style = document.createElement('style')
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  style.textContent = `.data-grid-theme.data-grid-theme { ${body} }`
  document.head.append(style)
  return () => style.remove()
}

/** Цвет, в который разрешается `value` в контексте элемента. */
const colorIn = (el: Element, value: string) => {
  const probe = document.createElement('span')
  probe.style.backgroundColor = value
  el.appendChild(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

/** Заливка вспышки строки (ADR 0134) — слой фона под текстом. */
const fill = (id: string) =>
  colorIn(
    rowOf(id)!,
    getComputedStyle(rowOf(id)!).getPropertyValue('--tsr-flash-row') ||
      'transparent',
  )
const alpha = (id: string) => toRgba(fill(id))[3]!
const arrivedFill = (id: string) =>
  colorIn(rowOf(id)!, 'var(--tsr-comp-flash-arrived-bg)')
/** Вспышка `arrived` держится: ещё не гаснет. */
const arrived = (id: string) => {
  const row = rowOf(id)
  if (!row) return null
  return (
    row.getAttribute('data-flash') === 'arrived' &&
    !row.hasAttribute('data-flash-out')
  )
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const asyncKids = (count: number) => (row: { id: string }) =>
  Promise.resolve(kids(row.id, count))

describe('Row expanding: arrival flash', () => {
  let restore = () => {}
  afterEach(async () => {
    restore()
    restore = () => {}
    await reducedMotion(false)
  })

  test('RE42: an async answer flashes the new children arrived under the text; the flash holds, fades out and the row looks as before', async () => {
    restore = themeTokens({
      '--tsr-comp-flash-duration': '400ms',
      '--tsr-comp-flash-fade-duration': '200ms',
    })
    const answer = deferred<Person[]>()
    await renderLazy(() => answer.promise)
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    answer.resolve(kids('lazy', 2))
    await waitRow('lazy-c1')
    const shown = performance.now()
    for (const id of ['lazy-c0', 'lazy-c1']) {
      expect(arrived(id), id).toBe(true)
      expect(fill(id), id).toBe(arrivedFill(id))
    }
    expect(rowOf('lazy')!.hasAttribute('data-flash')).toBe(false)
    // Держится длительность, затем гаснет переходом.
    await wait(250)
    expect(arrived('lazy-c0')).toBe(true)
    await expect.poll(() => arrived('lazy-c0')).toBe(false)
    // Длительность — из токена темы (400 мс), а не умолчание.
    expect(performance.now() - shown).toBeLessThan(900)
    expect(alpha('lazy-c0')).toBeGreaterThan(0)
    await expect.poll(() => alpha('lazy-c0')).toBe(0)
  })

  test('RE45: a flashed row that leaves the virtualization window and returns keeps its flash until the time is up; after that it returns plain', async () => {
    restore = themeTokens({ '--tsr-comp-flash-duration': '1500ms' })
    const many = [
      person('lazy', 2),
      ...Array.from({ length: 120 }, (_, i) =>
        person(`row-${String(i).padStart(3, '0')}`),
      ),
    ]
    await render(
      <composed.RowExpandingPlayground
        dataOverride={many}
        rowExpandingHasChildren={hasChildren as never}
        rowExpandingLoadChildren={asyncKids(2) as never}
      />,
    )
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    expect(arrived('lazy-c0')).toBe(true)
    await scrollToEnd('y')
    await expect.poll(() => rowOf('lazy-c0')).toBeNull()
    getScroller().scrollTop = 0
    await waitRow('lazy-c0')
    expect(arrived('lazy-c0')).toBe(true)
    expect(fill('lazy-c0')).toBe(arrivedFill('lazy-c0'))

    await scrollToEnd('y')
    await expect.poll(() => rowOf('lazy-c0')).toBeNull()
    await wait(2100)
    getScroller().scrollTop = 0
    await waitRow('lazy-c0')
    expect(rowOf('lazy-c0')!.hasAttribute('data-flash')).toBe(false)
    expect(alpha('lazy-c0')).toBe(0)
  })

  test('RE46: the flash keeps the row layout; selection and hover show through it and it does not catch the pointer', async () => {
    restore = themeTokens({ '--tsr-comp-flash-duration': '60000ms' })
    await renderLazy(asyncKids(2), {
      enableRowSelection: true,
      rowSelectionSubRows: true,
    })
    await waitRow('lazy')
    const plain = rowOf('leaf')!.getBoundingClientRect()
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    expect(arrived('lazy-c0')).toBe(true)
    const lit = rowOf('lazy-c0')!.getBoundingClientRect()
    expect([lit.width, lit.height]).toEqual([plain.width, plain.height])
    // Слой полупрозрачен: фон строки под ним виден.
    expect(alpha('lazy-c0')).toBeLessThanOrEqual(0.25)

    // Клик по вспыхнувшей строке выбирает её; под слоем — фон выбранной строки при наведении.
    await humanClick(
      rowOf('lazy-c0')!.querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await expect
      .poll(() => rowOf('lazy-c0')!.getAttribute('data-selected'))
      .toBe('true')
    await userEvent.hover(
      rowOf('lazy-c0')!.querySelector<HTMLElement>('.data-grid__body-cell')!,
    )
    await expect
      .poll(() => rowState(rowOf('lazy-c0')!))
      .toBe(
        colorIn(rowOf('lazy-c0')!, 'var(--tsr-comp-row-selected-hovered-bg)'),
      )
    expect(arrived('lazy-c0')).toBe(true)
  })

  test('RE47: with reduced motion the flash holds for the same duration and drops without a transition', async () => {
    await reducedMotion(true)
    restore = themeTokens({
      '--tsr-comp-flash-duration': '400ms',
      '--tsr-comp-flash-fade-duration': '2000ms',
    })
    await renderLazy(asyncKids(1))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c0')
    await wait(250)
    expect(arrived('lazy-c0')).toBe(true)
    expect(fill('lazy-c0')).toBe(arrivedFill('lazy-c0'))
    await expect.poll(() => arrived('lazy-c0')).toBe(false)
    // С переходом вспышка гасла бы ещё две секунды.
    expect(alpha('lazy-c0')).toBe(0)
  })

  test('RE48: an async arrival is announced with the row count, an empty answer as "No rows", the label comes from localization; a sync answer is not announced', async () => {
    const first = await renderLazy(asyncKids(2))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(liveText).toBe(tableLabels.announceChildrenLoaded(2))
    await first.unmount()

    const empty = await renderLazy(() => Promise.resolve([]))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(liveText).toBe(tableLabels.announceChildrenLoaded(0))
    await empty.unmount()

    const custom = await renderLazy(asyncKids(1), {
      localization: { announceChildrenLoaded: count => `Got ${count}` },
    })
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await expect.poll(liveText).toBe('Got 1')
    await custom.unmount()

    await renderLazy(row => kids(row.id, 2))
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await wait(100)
    expect(liveText()).toBe('')
  })

  test('RE49: text of flashed rows, plain and selected, keeps 4.5:1 over the flash and passes axe in both themes', async () => {
    restore = themeTokens({ '--tsr-comp-flash-duration': '60000ms' })
    await renderLazy(asyncKids(2), {
      enableRowSelection: true,
      rowSelectionSubRows: true,
    })
    await waitRow('lazy')
    await humanClick(toggleOf('lazy')!)
    await waitRow('lazy-c1')
    await humanClick(
      rowOf('lazy-c0')!.querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await expect
      .poll(() => rowOf('lazy-c0')!.getAttribute('data-selected'))
      .toBe('true')
    expect(arrived('lazy-c0')).toBe(true)
    expect(arrived('lazy-c1')).toBe(true)
    const grid = document.querySelector<HTMLElement>(
      '[role="table"], [role="grid"], [role="treegrid"]',
    )!
    // Цвет `top` поверх непрозрачного `bottom`.
    const over = (top: number[], bottom: number[]) => [
      ...[0, 1, 2].map(i => top[i]! * top[3]! + bottom[i]! * (1 - top[3]!)),
      1,
    ]
    await inBothThemes(async () => {
      // Вспышка — градиент фона: axe его не видит — считаем сами.
      for (const id of ['lazy-c0', 'lazy-c1']) {
        const row = rowOf(id)!
        const text = [...row.querySelectorAll<HTMLElement>('*')].find(
          el => el.childElementCount === 0 && el.textContent === id,
        )!
        const bg = over(
          toRgba(getComputedStyle(row).backgroundColor),
          backgroundOf(row.parentElement),
        )
        const lit = over(toRgba(fill(id)), bg)
        const ratio = contrast(
          over(toRgba(getComputedStyle(text).color), lit),
          lit,
        )
        expect(ratio, id).toBeGreaterThanOrEqual(4.5)
      }
      const result = await axe.run(grid, {
        ...AXE_OPTIONS,
        rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
      })
      expect(result.violations).toEqual([])
    })
  })
})

describe('Row expanding: answer batching', () => {
  let restore = () => {}
  afterEach(() => {
    restore()
    restore = () => {}
  })

  test('RE66: several lazy rows expanded by click with answers arriving as separate tasks all show their children, stop waiting and highlight the new children', async () => {
    restore = themeTokens({ '--tsr-comp-flash-duration': '5000ms' })
    const answers = { lazy: deferred<Person[]>(), other: deferred<Person[]>() }
    await renderLazy(
      row => answers[row.id as keyof typeof answers].promise as never,
    )
    await waitRow('other')
    await humanClick(toggleOf('lazy')!)
    await humanClick(toggleOf('other')!)
    await expect
      .poll(() => toggleOf('other')!.getAttribute('aria-busy'))
      .toBe('true')
    answers.lazy.resolve(kids('lazy', 2))
    await wait(0)
    answers.other.resolve(kids('other', 1))
    await waitRow('other-c0')
    for (const id of ['lazy-c0', 'lazy-c1', 'other-c0']) {
      expect(arrived(id), id).toBe(true)
    }
    for (const id of ['lazy', 'other']) {
      expect(rowOf(id)!.hasAttribute('aria-busy'), id).toBe(false)
      expect(toggleOf(id)!.hasAttribute('aria-busy'), id).toBe(false)
    }
  })
})
