import axe from 'axe-core'
import { includeConditionalArg } from 'storybook/internal/csf'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type {
  ContextMenuAction,
  DisabledResult,
  HeaderAction,
  RowAction,
} from '../../../core/headerActions'
import { __resetLogger } from '../../../util/logger'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import type { DataGridProps } from '../../../grid/dataGridTypes'
import {
  columnSorting,
  contextMenu,
  headerActionMenu,
  pagination,
  rowActionMenu,
  rowActions,
} from '../../../plugins'
import { failureShownOn, humanClick, pendingArcOf } from '../helpers'
import { composed, rowAsyncArgs } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { rowsTopDown, waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Асинхронные и заблокированные пункты меню действий (ADR 0078, MI1–MI14,
// MI16–MI21, MI24): проверка доступности промисом из `disabled`, причина блокировки,
// ожидание и отказ промиса из `onSelect` на кебабе, в пункте и на инлайн-кнопке.
// Промисы тестовых действий — в руках теста.

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

const targetOf = (ctx: unknown) => {
  const { row, column } = ctx as {
    row?: { id: string }
    column: { id: string }
  }
  return row ? row.id : `column:${column.id}`
}

interface Check {
  id: string
  target: string
  signal: AbortSignal
  answer: Deferred<DisabledResult>
}
interface Run {
  id: string
  target: string
  done: Deferred<void>
}

/** Свежие дескрипторы на каждый тест: признак «асинхронный» живёт на объекте. */
const makeProbe = () => {
  const checks: Check[] = []
  const runs: Run[] = []
  let editCount = 0
  let archiveCount = 0

  const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
  const checking = (id: string) => (ctx: unknown, signal: AbortSignal) => {
    const answer = deferred<DisabledResult>()
    checks.push({ id, target: targetOf(ctx), signal, answer })
    return answer.promise
  }
  const running = (id: string) => (ctx: unknown) => {
    const done = deferred<void>()
    runs.push({ id, target: targetOf(ctx), done })
    return done.promise
  }
  const row = (
    id: string,
    order: number,
    label: string,
    rest: Partial<RowAction>,
  ): RowAction => ({
    id,
    slot: 'actionRowSlot',
    order,
    icon: icon(label[0]!),
    label: () => label,
    onSelect: () => {},
    ...rest,
  })

  const rowActionsList: RowAction[] = [
    row('archive', 0, 'Archive', {
      disabled: checking('archive'),
      onSelect: () => {
        archiveCount += 1
      },
    }),
    row('edit', 1, 'Edit', {
      disabled: () => false,
      onSelect: () => {
        editCount += 1
      },
    }),
    row('locked', 2, 'Locked', {
      disabled: () => ({ kind: 'forbidden', reason: 'No rights' }),
    }),
    row('remove', 3, 'Remove', { onSelect: running('remove') }),
    row('exportRow', 4, 'Export', { onSelect: running('exportRow') }),
    row('archived', 5, 'Archived', { disabled: () => ({ kind: 'done' }) }),
  ]
  const headerCheck: HeaderAction = {
    id: 'headerCheck',
    slot: 'rightHeaderSlot',
    order: 10,
    icon: icon('H'),
    label: () => 'Freeze',
    disabled: checking('headerCheck'),
    onSelect: () => {},
  }
  const contextActions: ContextMenuAction[] = [
    {
      id: 'share',
      icon: icon('S'),
      label: () => 'Share',
      disabled: checking('share'),
      onSelect: () => {},
    },
    {
      id: 'recalculate',
      icon: icon('R'),
      label: () => 'Recalculate',
      onSelect: running('recalculate'),
    },
  ]
  const plugin = definePlugin()({
    id: 'asyncProbe',
    slotActions: [...rowActionsList, headerCheck],
    contextMenuActions: contextActions,
  })
  return {
    plugin,
    checks,
    runs,
    editCount: () => editCount,
    archiveCount: () => archiveCount,
    lastCheck: (id: string) => checks.filter(check => check.id === id).at(-1)!,
    lastRun: (id: string, target = 'r1') =>
      runs.filter(run => run.id === id && run.target === target).at(-1)!,
  }
}

type Probe = ReturnType<typeof makeProbe>

const DATA = Array.from({ length: 300 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${String(i).padStart(3, '0')}`,
}))

interface GridProps extends Partial<
  Pick<DataGridProps, 'icons' | 'localization'>
> {
  probe: Probe
  menu?: boolean
  keyboard?: boolean
  paged?: boolean
}

const Grid = ({
  probe,
  menu = true,
  keyboard = false,
  paged = false,
  ...gridProps
}: GridProps) => {
  const table = useCreateTable({
    enableKeyboardNavigation: keyboard,
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [
      probe.plugin(),
      rowActions(),
      ...(menu
        ? [
            rowActionMenu({ mode: 'always' }),
            headerActionMenu({ mode: 'always' }),
          ]
        : []),
      contextMenu(),
      columnSorting(),
      ...(paged ? [pagination({ initialPageSize: 20 })] : []),
    ] as never,
  })
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={table as never} {...gridProps} />
    </div>
  )
}

const renderGrid = async (props: Partial<GridProps> = {}) => {
  const probe = props.probe ?? makeProbe()
  const screen = await render(<Grid {...props} probe={probe} />)
  await waitForGrid()
  return { probe, screen }
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const rowKebab = (id: string) =>
  rowEl(id)?.querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.rowMenu}"]`,
  ) ?? null
const nameCell = (id: string) =>
  rowEl(id)!.querySelector<HTMLElement>('[data-column-id="name"]')!
const headCell = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"]',
  )!
const headKebab = () =>
  headCell().querySelector<HTMLElement>(
    `[aria-label^="${tableLabels.headerMenu}"]`,
  )!
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
]
const item = (label: string) =>
  items().find(
    el => el.querySelector('[class*="itemLabel"]')?.textContent === label,
  )
const description = (el: Element | null | undefined) => {
  const id = el?.getAttribute('aria-describedby')
  return id ? (document.getElementById(id)?.textContent ?? null) : null
}
const isDisabled = (el: Element | undefined) =>
  el?.getAttribute('aria-disabled') === 'true'
const isPending = (el: Element | undefined) => el?.hasAttribute('data-pending')
const failedIcon = (el: Element | undefined) =>
  el?.querySelector('[data-action-failed]') ?? null
const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
/** Открыт ли тултип с этим текстом (у поповера тоже есть `data-side`). */
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const openRowMenu = async (id = 'r1') => {
  await userEvent.hover(nameCell(id))
  await expect.poll(() => rowKebab(id)).not.toBeNull()
  await humanClick(rowKebab(id)!)
  // Модуль меню ленивый: под нагрузкой полного прогона Firefox открывает дольше секунды.
  await expect.poll(() => items().length, { timeout: 4000 }).toBeGreaterThan(0)
}
const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => items().length).toBe(0)
}
/** Увести указатель с грида — кебаб без наведения. */
const parkPointer = async () => {
  await userEvent.hover(document.body, { position: { x: 1, y: 1 } })
}
/** Запустить долгое действие из кебаба строки. */
const runFromMenu = async (label: string, id = 'r1') => {
  await openRowMenu(id)
  await humanClick(item(label)!)
  await expect.poll(() => items().length).toBe(0)
}
const kebabWrapper = (id = 'r1') => rowKebab(id)!.closest('.row__button')!
const errorDot = (id = 'r1') =>
  rowKebab(id)!.querySelector<HTMLElement>('[data-error-indicator]')!

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('Проверка доступности пунктов', () => {
  test('MI1: disabled вернул промис — меню открыто сразу, пункт в ожидании (лоадер у правого края вместо блика, заблокирован, «Checking availability»), остальные доступны; ответ false делает пункт доступным', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()

    const archive = item('Archive')!
    expect(isPending(archive)).toBe(true)
    expect(isDisabled(archive)).toBe(true)
    expect(description(archive)).toBe(tableLabels.availabilityChecking)
    const spinner = archive.querySelector<HTMLElement>('[data-item-spinner]')!
    expect(spinner.closest('[class*="itemCheck"]')).not.toBeNull()
    expect(getComputedStyle(spinner).animationName).not.toBe('none')
    expect(getComputedStyle(archive, '::after').content).toBe('none')
    expect(isDisabled(item('Edit'))).toBe(false)
    expect(isPending(item('Edit'))).toBe(false)

    probe.lastCheck('archive').answer.resolve(false)
    await expect.poll(() => isPending(item('Archive'))).toBe(false)
    expect(isDisabled(item('Archive'))).toBe(false)
    expect(description(item('Archive'))).toBeNull()
    expect(item('Archive')!.querySelector('[data-item-spinner]')).toBeNull()
    await closeMenu()
  })

  test('MI2: проверка начинается при наведении на кебаб и переиспользуется при открытии; пока меню открыто, не повторяется', async () => {
    const { probe } = await renderGrid()
    await userEvent.hover(headCell())
    await userEvent.hover(headKebab())
    await expect
      .poll(() => probe.checks.filter(c => c.id === 'headerCheck').length)
      .toBe(1)
    expect(probe.lastCheck('headerCheck').target).toBe('column:name')

    await humanClick(headKebab())
    await expect.poll(() => item('Freeze')).toBeTruthy()
    expect(probe.checks.filter(c => c.id === 'headerCheck').length).toBe(1)
    expect(isPending(item('Freeze'))).toBe(true)

    probe.lastCheck('headerCheck').answer.resolve(true)
    await expect.poll(() => isPending(item('Freeze'))).toBe(false)
    expect(isDisabled(item('Freeze'))).toBe(true)
    // Наведение по пунктам перерисовывает меню — новых проверок нет.
    await userEvent.hover(items()[0]!)
    await userEvent.hover(items()[1]!)
    await sleep(100)
    expect(probe.checks.filter(c => c.id === 'headerCheck').length).toBe(1)
    await closeMenu()
  })

  test('MI3: закрытие меню прерывает проверку (signal.aborted), поздний ответ не меняет следующую сессию', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()
    const first = probe.lastCheck('archive')
    expect(first.signal.aborted).toBe(false)
    await closeMenu()
    expect(first.signal.aborted).toBe(true)

    await openRowMenu()
    const second = probe.lastCheck('archive')
    expect(second).not.toBe(first)
    first.answer.resolve(true)
    await sleep(50)
    expect(isPending(item('Archive'))).toBe(true)
    second.answer.resolve(false)
    await expect.poll(() => isDisabled(item('Archive'))).toBe(false)
    await closeMenu()
  })

  test('MI4: проверка не удалась — пункт доступен, иконка ошибки с текстом; нажатие проверяет заново: «можно» выполняет действие и закрывает меню, «нельзя» показывает причину', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()
    probe
      .lastCheck('archive')
      .answer.reject(new Error('Permission service is down'))
    await expect.poll(() => isPending(item('Archive'))).toBe(false)

    const archive = item('Archive')!
    expect(isDisabled(archive)).toBe(false)
    expect(archive.querySelector('[data-check-failed] svg')).not.toBeNull()
    expect(description(archive)).toBe('Permission service is down')
    await userEvent.hover(archive)
    await expect.poll(tooltipShown('Permission service is down')).toBe(true)

    // Повтор: «нельзя» — замок, действие не выполнено, меню открыто.
    const before = probe.checks.length
    await humanClick(archive)
    expect(probe.checks.length).toBe(before + 1)
    expect(isPending(item('Archive'))).toBe(true)
    expect(items().length).toBeGreaterThan(0)
    probe
      .lastCheck('archive')
      .answer.resolve({ kind: 'forbidden', reason: 'No rights' })
    await expect
      .poll(() => item('Archive')!.querySelector('[data-action-blocked]'))
      .not.toBeNull()
    expect(probe.archiveCount()).toBe(0)
    await closeMenu()

    // Повтор: «можно» — действие выполняется, меню закрывается.
    await openRowMenu()
    probe.lastCheck('archive').answer.reject(new Error('down'))
    await expect.poll(() => isDisabled(item('Archive'))).toBe(false)
    await expect.poll(() => isPending(item('Archive'))).toBe(false)
    await humanClick(item('Archive')!)
    probe.lastCheck('archive').answer.resolve(false)
    await expect.poll(() => items().length).toBe(0)
    expect(probe.archiveCount()).toBe(1)
  })

  test('MI5: пока проверки завершаются, пункты не появляются, не исчезают, не меняют порядок и высоту — при любом ответе', async () => {
    const { probe } = await renderGrid()
    const labels = () =>
      items().map(el => el.querySelector('[class*="itemLabel"]')?.textContent)
    const heights = () => items().map(el => el.offsetHeight)
    const menuHeight = () =>
      document.querySelector<HTMLElement>('[role="menu"]')!.offsetHeight

    for (const answer of [{ kind: 'done' } as const, false]) {
      await openRowMenu()
      const before = {
        labels: labels(),
        heights: heights(),
        menu: menuHeight(),
      }
      probe.lastCheck('archive').answer.resolve(answer)
      await expect.poll(() => isPending(item('Archive'))).toBe(false)
      expect(isDisabled(item('Archive'))).toBe(answer !== false)
      expect(labels()).toEqual(before.labels)
      expect(heights()).toEqual(before.heights)
      expect(menuHeight()).toBe(before.menu)
      await closeMenu()
    }
  })
})

describe('Закрытие меню', () => {
  test('MI26: закрывающееся меню не сбрасывает итог проверки и отметку отказа в пункте до конца закрытия', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    probe.lastRun('remove').done.reject(new Error('locked'))
    await expect.poll(() => errorDot().dataset.shown).toBe('true')

    await openRowMenu()
    probe.lastCheck('archive').answer.resolve(false)
    await expect.poll(() => isPending(item('Archive'))).toBe(false)

    const frames: { pending: boolean; failed: boolean }[] = []
    await userEvent.keyboard('{Escape}')
    while (items().length > 0) {
      frames.push({
        pending: !!isPending(item('Archive')),
        failed: failedIcon(item('Remove')) !== null,
      })
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    expect(frames.length).toBeGreaterThan(1)
    expect(frames.every(frame => !frame.pending && frame.failed)).toBe(true)

    await openRowMenu()
    expect(failedIcon(item('Remove'))).toBeNull()
    expect(isPending(item('Archive'))).toBe(true)
    await closeMenu()
  })
})

describe('Причина блокировки и клавиатура', () => {
  test('MI6: причина «запрещено» с текстом — замок у правого края на месте галочки; без текста (true или forbidden без reason) — пункт заблокирован без значка', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()
    const locked = item('Locked')!
    const icon = locked.querySelector<HTMLElement>('[data-action-blocked]')!
    expect(icon.className).toMatch(/itemCheck/)
    expect(icon.querySelector('svg')).not.toBeNull()
    expect(isDisabled(locked)).toBe(true)
    expect(locked.textContent).toBe('LLocked')

    probe.lastCheck('archive').answer.resolve(true)
    await expect.poll(() => isPending(item('Archive'))).toBe(false)
    expect(isDisabled(item('Archive'))).toBe(true)
    expect(
      item('Archive')!.querySelector('[class*="itemCheck"] svg'),
    ).toBeNull()
    await closeMenu()

    await openRowMenu()
    probe.lastCheck('archive').answer.resolve({ kind: 'forbidden' })
    await expect.poll(() => isPending(item('Archive'))).toBe(false)
    expect(isDisabled(item('Archive'))).toBe(true)
    expect(
      item('Archive')!.querySelector('[class*="itemCheck"] svg'),
    ).toBeNull()
    expect(item('Edit')!.querySelector('[data-action-blocked]')).toBeNull()
    await closeMenu()
  })

  test('MI27: причина «уже сделано» (kind done) — галочка цветом акцента у правого края, пункт заблокирован', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()
    probe.lastCheck('archive').answer.resolve({ kind: 'done' })
    await expect
      .poll(() => item('Archive')!.querySelector('[data-action-done] svg'))
      .not.toBeNull()
    const archive = item('Archive')!
    expect(isDisabled(archive)).toBe(true)
    expect(archive.querySelector('[data-action-blocked]')).toBeNull()
    const mark = archive.querySelector<HTMLElement>('[data-action-done]')!
    const accent = document.createElement('span')
    accent.style.color = 'var(--tsr-comp-accent)'
    mark.appendChild(accent)
    expect(getComputedStyle(mark).color).toBe(getComputedStyle(accent).color)
    accent.remove()
    await closeMenu()
  })

  test('MI28: текст причины — в тултипе (наведение и стрелки) и в aria-describedby; у доступного пункта и причины без текста описания нет', async () => {
    const { probe } = await renderGrid()
    await openRowMenu()
    const locked = item('Locked')!
    expect(description(locked)).toBe('No rights')
    await userEvent.hover(locked)
    await expect.poll(tooltipShown('No rights')).toBe(true)
    await userEvent.hover(item('Edit')!)
    await expect.poll(tooltipShown('No rights')).toBe(false)
    expect(item('Edit')!.getAttribute('aria-describedby')).toBeNull()

    // Стрелками на ждущий пункт: ответ «нельзя» оставляет фокус и показывает причину.
    await userEvent.keyboard('{Home}')
    await expect.poll(() => document.activeElement).toBe(item('Archive'))
    probe.lastCheck('archive').answer.resolve({
      kind: 'done',
      reason: 'Already archived',
    })
    await expect.poll(tooltipShown('Already archived')).toBe(true)
    expect(document.activeElement).toBe(item('Archive'))
    expect(description(item('Archive'))).toBe('Already archived')
    await closeMenu()

    await openRowMenu()
    probe.lastCheck('archive').answer.resolve(true)
    await expect.poll(() => isPending(item('Archive'))).toBe(false)
    expect(isDisabled(item('Archive'))).toBe(true)
    expect(item('Archive')!.getAttribute('aria-describedby')).toBeNull()
    await closeMenu()
  })

  test.each([false, true])(
    'MI7: стрелки проходят по заблокированным и ждущим пунктам, Enter их не запускает (keyboardNavigation: %s)',
    async keyboard => {
      const { probe } = await renderGrid({ keyboard })
      await openRowMenu()
      await userEvent.keyboard('{ArrowDown}')
      await expect.poll(() => document.activeElement).toBe(item('Archive'))
      await userEvent.keyboard('{Enter}')
      expect(items().length).toBeGreaterThan(0)

      await userEvent.keyboard('{ArrowDown}')
      await expect.poll(() => document.activeElement).toBe(item('Edit'))
      await userEvent.keyboard('{ArrowDown}')
      await expect.poll(() => document.activeElement).toBe(item('Locked'))
      await userEvent.keyboard('{Enter}')
      expect(items().length).toBeGreaterThan(0)
      expect(probe.editCount()).toBe(0)
      await closeMenu()
    },
  )
})

describe('Долгое действие', () => {
  test('MI8: onSelect вернул промис — меню закрывается, у кебаба дуга ожидания и он виден без наведения, имя перечисляет ждущие действия; тултипа у занятого кебаба нет (ADR 0127)', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    await parkPointer()

    expect(rowKebab('r1')!.getAttribute('aria-busy')).toBe('true')
    expect(kebabWrapper().getAttribute('class')).not.toContain('--hidden')
    expect(rowKebab('r1')!.getAttribute('aria-label')).toBe(
      'Row options. Running: Remove',
    )
    expect(pendingArcOf(rowKebab('r1')!)?.dataset.phase).toBe('pending')
    await userEvent.hover(rowKebab('r1')!)
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(tooltipShown('Row options. Running: Remove')()).toBe(false)

    probe.lastRun('remove').done.resolve()
    await expect
      .poll(() => rowKebab('r1')!.getAttribute('aria-busy'))
      .toBeNull()
    expect(rowKebab('r1')!.getAttribute('aria-label')).toBe(tableLabels.rowMenu)
  })

  test('MI9: пока действие ждёт, его пункт в этой цели предлагает отмену (ADR 0153); другие пункты той же цели и то же действие в другой строке работают', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')

    await openRowMenu()
    const cancelRemove = item(tableLabels.cancelAction('Remove'))
    expect(item('Remove')).toBeUndefined()
    expect(isDisabled(cancelRemove)).toBe(false)
    expect(isPending(cancelRemove)).toBe(true)
    expect(isDisabled(item('Export'))).toBe(false)
    await humanClick(item('Export')!)
    await expect.poll(() => probe.runs.length).toBe(2)
    // Выбор пункта закрывает меню: следующее открывается после него.
    await expect.poll(() => items().length).toBe(0)

    await runFromMenu('Remove', 'r2')
    expect(probe.runs.map(run => `${run.id}@${run.target}`)).toEqual([
      'remove@r1',
      'exportRow@r1',
      'remove@r2',
    ])
    probe.runs.forEach(run => run.done.resolve())
  })

  test('MI10: два ждущих действия одного кебаба — блик гаснет после последнего, список в имени сокращается', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    await runFromMenu('Export')
    const label = () => rowKebab('r1')!.getAttribute('aria-label')
    expect(label()).toBe('Row options. Running: Remove, Export')

    probe.lastRun('remove').done.resolve()
    await expect.poll(label).toBe('Row options. Running: Export')
    expect(rowKebab('r1')!.getAttribute('aria-busy')).toBe('true')

    probe.lastRun('exportRow').done.resolve()
    await expect.poll(label).toBe(tableLabels.rowMenu)
    expect(rowKebab('r1')!.getAttribute('aria-busy')).toBeNull()
  })

  test('MI11: объявления с именем действия — успех и отказ с текстом', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    probe.lastRun('remove').done.resolve()
    await expect.poll(() => liveRegion().textContent).toBe('Remove: done')

    await runFromMenu('Remove')
    probe.lastRun('remove').done.reject(new Error('Row is locked'))
    await expect
      .poll(() => liveRegion().textContent)
      .toBe(tableLabels.announceActionFailed('Remove', 'Row is locked'))
  })
})

describe('Отказ действия', () => {
  test('MI12: отказ — дуга кебаба останавливается, отметка ошибки появляется сразу, без красного контура, кебаб виден без наведения, тултип и имя называют упавшее действие', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    await parkPointer()
    probe.lastRun('remove').done.reject(new Error('Row is locked'))

    await expect.poll(() => errorDot().dataset.shown).toBe('true')
    expect(kebabWrapper().getAttribute('class')).not.toContain('--hidden')
    // Дуга встала и гаснет, контур не краснеет; отметка проявляется без задержки.
    const kebab = rowKebab('r1')!
    const arc = pendingArcOf(kebab)!
    expect(getComputedStyle(arc).animationPlayState).toContain('paused')
    expect(parseFloat(getComputedStyle(errorDot()).transitionDelay)).toBe(0)
    await expect.poll(() => pendingArcOf(kebab)).toBeNull()
    await expect.poll(() => getComputedStyle(errorDot()).opacity).toBe('1')
    expect(rowKebab('r1')!.getAttribute('aria-label')).toBe(
      'Row options. Failed: Remove',
    )
    await userEvent.hover(rowKebab('r1')!)
    await expect.poll(tooltipShown('Row options. Failed: Remove')).toBe(true)
  })

  test('MI13: открытие меню снимает отметку с кебаба, после закрытия ошибки в пункте нет', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    probe.lastRun('remove').done.reject(new Error('Row is locked'))
    await expect.poll(() => errorDot().dataset.shown).toBe('true')

    await openRowMenu()
    await expect.poll(() => errorDot().dataset.shown).toBe('false')
    expect(rowKebab('r1')!.getAttribute('aria-label')).toBe(tableLabels.rowMenu)
    expect(failedIcon(item('Remove'))).not.toBeNull()
    await closeMenu()

    await openRowMenu()
    expect(failedIcon(item('Remove'))).toBeNull()
    await closeMenu()
  })

  test('MI14: упавший пункт — иконка ошибки на месте галочки, полный текст в тултипе (наведение и стрелки) и в aria-describedby; пункт доступен для повтора', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    probe
      .lastRun('remove')
      .done.reject(new Error('Row is locked by another user'))
    await expect.poll(() => errorDot().dataset.shown).toBe('true')

    await openRowMenu()
    const remove = item('Remove')!
    const icon = failedIcon(remove)!
    expect(icon.className).toMatch(/itemCheck/)
    expect(icon.querySelector('svg')).not.toBeNull()
    expect(isDisabled(remove)).toBe(false)
    expect(description(remove)).toBe('Row is locked by another user')

    const errorShown = tooltipShown('Row is locked by another user')
    await userEvent.hover(remove)
    await expect.poll(errorShown).toBe(true)
    await userEvent.hover(item('Edit')!)
    await expect.poll(errorShown).toBe(false)

    // С клавиатуры: переход стрелками на упавший пункт. Откуда начинают стрелки после
    // наведения, решает движок (WebKit — не с пункта под указателем), поэтому идём до
    // пункта, а не на заданное число шагов.
    for (let i = 0; i < 6 && document.activeElement !== item('Remove'); i++) {
      await userEvent.keyboard('{ArrowDown}')
    }
    await expect.poll(() => document.activeElement).toBe(item('Remove'))
    await expect.poll(errorShown).toBe(true)

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => probe.runs.length).toBe(2)
  })

  test('MI16: иконку ошибки заменяет icons.actionFailed, подписи — localization', async () => {
    const { probe } = await renderGrid({
      icons: { actionFailed: () => <svg data-testid="custom-failed" /> },
      localization: {
        actionsFailed: (names: string) => `Сбой: ${names}`,
        announceActionFailed: (name: string, error: string) =>
          `${name} — ошибка: ${error}`,
      },
    })
    await runFromMenu('Remove')
    probe.lastRun('remove').done.reject(new Error('locked'))
    await expect
      .poll(() => rowKebab('r1')!.getAttribute('aria-label'))
      .toBe('Row options. Сбой: Remove')
    await expect
      .poll(() => liveRegion().textContent)
      .toBe('Remove — ошибка: locked')

    await openRowMenu()
    expect(
      item('Remove')!.querySelector('[data-testid="custom-failed"]'),
    ).not.toBeNull()
    await closeMenu()
  })
})

describe('Контекстное меню, виртуализация, инлайн-кнопка', () => {
  test('MI17: контекстное меню — проверка при открытии, ожидание и ошибка пункта видны при следующем открытии той же ячейки', async () => {
    const { probe } = await renderGrid()
    const openContext = async () => {
      await userEvent.click(nameCell('r1'), { button: 'right' })
      await expect.poll(() => item('Share')).toBeTruthy()
    }

    await openContext()
    expect(probe.lastCheck('share').target).toBe('r1')
    expect(isPending(item('Share'))).toBe(true)
    probe.lastCheck('share').answer.resolve(false)
    await expect.poll(() => isDisabled(item('Share'))).toBe(false)

    await humanClick(item('Recalculate')!)
    await expect.poll(() => items().length).toBe(0)
    await openContext()
    // Ждущий пункт предлагает отмену (ADR 0153).
    const cancelRecalculate = item(tableLabels.cancelAction('Recalculate'))
    expect(isPending(cancelRecalculate)).toBe(true)
    expect(isDisabled(cancelRecalculate)).toBe(false)
    await closeMenu()

    probe.lastRun('recalculate').done.reject(new Error('timeout'))
    await openContext()
    expect(failedIcon(item('Recalculate'))).not.toBeNull()
    expect(description(item('Recalculate'))).toBe('timeout')
    await closeMenu()
    await openContext()
    expect(failedIcon(item('Recalculate'))).toBeNull()
    await closeMenu()
  })

  test('MI18: ожидание и ошибка кебаба строки переживают уход строки из окна виртуализации и возврат, сортировку и смену страницы', async () => {
    const { probe, screen } = await renderGrid()
    await runFromMenu('Remove')

    scroller().scrollTop = 6000
    await expect.poll(() => rowEl('r1')).toBeNull()
    scroller().scrollTop = 0
    await expect
      .poll(() => rowKebab('r1')?.getAttribute('aria-busy'))
      .toBe('true')

    // Сортировка по убыванию уводит r1 вниз; возврат — снова наверху.
    await userEvent.hover(headCell())
    await humanClick(headKebab())
    await humanClick(
      items().find(el => el.textContent?.includes(tableLabels.sortDescending))!,
    )
    await expect.poll(() => rowEl('r1')).toBeNull()
    probe.lastRun('remove').done.reject(new Error('locked'))
    await userEvent.hover(headCell())
    await humanClick(headKebab())
    await humanClick(
      items().find(el => el.textContent?.includes(tableLabels.clearSort))!,
    )
    await expect.poll(() => errorDot()?.dataset.shown).toBe('true')
    await screen.unmount()

    // Страница: ожидание на первой странице, уход на вторую и возврат.
    const paged = await renderGrid({ paged: true })
    await runFromMenu('Remove')
    await humanClick(
      document.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.nextPage}"]`,
      )!,
    )
    await expect.poll(() => rowEl('r1')).toBeNull()
    await humanClick(
      document.querySelector<HTMLElement>(
        `[aria-label="${tableLabels.previousPage}"]`,
      )!,
    )
    await expect
      .poll(() => rowKebab('r1')?.getAttribute('aria-busy'))
      .toBe('true')
    paged.probe.lastRun('remove').done.resolve()
  })

  test('MI19: инлайн-кнопка с промисом onSelect — кольцо ожидания и aria-busy, повторное нажатие не запускает действие, отказ — отметка с причиной и объявление', async () => {
    const { probe } = await renderGrid({ menu: false })
    const button = () =>
      rowEl('r1')!.querySelector<HTMLElement>('[aria-label="Remove"]')!
    await userEvent.hover(nameCell('r1'))
    await humanClick(button())
    await expect.poll(() => button().getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(button())?.dataset.phase).toBe('pending')
    await humanClick(button())
    expect(probe.runs.length).toBe(1)

    probe.lastRun('remove').done.reject(new Error('locked'))
    await expect.poll(() => failureShownOn(button())).toBe(true)
    expect(button().getAttribute('aria-busy')).toBeNull()
    expect(button()).toHaveAccessibleDescription(
      tableLabels.actionFailedRetry('locked'),
    )
    await expect
      .poll(() => liveRegion().textContent)
      .toBe(tableLabels.announceActionFailed('Remove', 'locked'))
  })

  test('MI20: инлайн-кнопка с асинхронным disabled заблокирована, dev-предупреждение один раз, рендер не вызывает disabled повторно', async () => {
    __resetLogger()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { probe } = await renderGrid({ menu: false })
      for (const id of ['r1', 'r2', 'r3']) {
        await userEvent.hover(nameCell(id))
      }
      const archive = rowEl('r2')!.querySelector<HTMLElement>(
        '[aria-label="Archive"]',
      )!
      expect(archive.hasAttribute('disabled')).toBe(true)
      const probes = probe.checks.filter(check => check.id === 'archive')
      expect(probes.length).toBe(1)
      expect(probes[0]!.signal.aborted).toBe(true)
      expect(
        warn.mock.calls.filter(call =>
          String(call.join(' ')).includes('«archive»: асинхронный disabled'),
        ).length,
      ).toBe(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('MI21: axe и контраст новых состояний (лоадер пункта, причина, иконка и отметка ошибки) в обеих темах', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove', 'r2')
    probe.lastRun('remove', 'r2').done.reject(new Error('locked'))
    await runFromMenu('Remove')
    probe.lastRun('remove').done.reject(new Error('locked'))
    await expect.poll(() => errorDot().dataset.shown).toBe('true')
    await openRowMenu()
    await expect.poll(() => failedIcon(item('Remove'))).not.toBeNull()

    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    await inBothThemes(async () => {
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!
      const { violations } = await axe.run(menu, options)
      expect(violations.map(v => v.id)).toEqual([])

      const popupBg = backgroundOf(menu)
      const spinner = item('Archive')!.querySelector('[data-item-spinner]')!
      expect(
        contrast(toRgba(getComputedStyle(spinner).borderTopColor), popupBg),
      ).toBeGreaterThanOrEqual(3)
      const reason = item('Locked')!.querySelector('[data-action-blocked]')!
      const done = item('Archived')!.querySelector('[data-action-done]')!
      expect(
        contrast(toRgba(getComputedStyle(done).color), popupBg),
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrast(toRgba(getComputedStyle(reason).color), popupBg),
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrast(
          toRgba(getComputedStyle(failedIcon(item('Remove'))!).color),
          popupBg,
        ),
      ).toBeGreaterThanOrEqual(3)
      const dot = errorDot('r2')
      expect(
        contrast(
          toRgba(getComputedStyle(dot).backgroundColor),
          backgroundOf(rowEl('r2')),
        ),
      ).toBeGreaterThanOrEqual(3)
    })
    await closeMenu()
  })
})

describe('Свет во время прокрутки', () => {
  test('MI25: пока грид прокручивается, анимации дуги кнопок на паузе; после остановки прокрутки идут снова', async () => {
    const { probe } = await renderGrid()
    await runFromMenu('Remove')
    await parkPointer()
    /** Состояние всех анимаций дуги кнопки (ADR 0127) — одно на всех или 'mixed'. */
    const playState = () => {
      const states = new Set(
        getComputedStyle(pendingArcOf(rowKebab('r1')!)!)
          .animationPlayState.split(',')
          .map(state => state.trim()),
      )
      return states.size === 1 ? [...states][0] : 'mixed'
    }
    await expect.poll(playState).toBe('running')

    const states: string[] = []
    for (let step = 0; step < 6; step += 1) {
      scroller().scrollTop += 4
      await new Promise(resolve => requestAnimationFrame(resolve))
      if (scroller().hasAttribute('data-scrolling')) states.push(playState()!)
    }
    expect(states.length).toBeGreaterThan(0)
    expect(new Set(states)).toEqual(new Set(['paused']))

    await expect
      .poll(() => scroller().hasAttribute('data-scrolling'))
      .toBe(false)
    expect(playState()).toBe('running')
    probe.lastRun('remove').done.resolve()
  })
})

describe('Демо-истории', () => {
  test('MI24: асинхронный набор действий в «Rows/Actions — Playground» — ожидание, отказ и причина видны в интерфейсе', async () => {
    // Storybook отбрасывает аргументы со скрытым условием контрола — composeStories нет:
    // набор, выбранный в Controls, должен пройти этот фильтр.
    const story = composed.RowActionsPlayground
    const args = { ...story.args, ...rowAsyncArgs } as Record<string, unknown>
    const argTypes = story.argTypes as Record<string, never>
    for (const key of Object.keys(rowAsyncArgs)) {
      expect(
        includeConditionalArg(argTypes[key] ?? {}, args, {}),
        `${story.storyName}: ${key}`,
      ).toBe(true)
    }

    const view = await render(
      <composed.RowActionsPlayground {...rowAsyncArgs} />,
    )
    await waitForGrid()
    const kebabOf = (row: HTMLElement) =>
      row.querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
    const first = rowsTopDown()[0]!
    await userEvent.hover(first)
    await expect.poll(() => kebabOf(first)).not.toBeNull()
    await humanClick(kebabOf(first)!)
    await expect.poll(() => isPending(item('Archive'))).toBe(true)
    await expect
      .poll(() => description(item('Archive')), { timeout: 5000 })
      .toBe('Already archived')
    expect(item('Archive')!.querySelector('[data-action-done]')).not.toBeNull()
    await humanClick(item('Delete')!)
    await expect
      .poll(() => kebabOf(first)?.getAttribute('aria-busy'))
      .toBe('true')
    await expect
      .poll(() => kebabOf(first)?.getAttribute('aria-label'), { timeout: 5000 })
      .toBe('Row options. Failed: Delete')
    await view.unmount()
  })
})

describe('Узкая колонка: действие в кебабе (ADR 0127, ADR 0111)', () => {
  test('IR18: узкая колонка — асинхронное действие заголовка ушло в кебаб: дуга ожидания и отметка отказа у кебаба, у пункта — спиннер и значок ошибки', async () => {
    const runs: Deferred<void>[] = []
    const recount: HeaderAction = {
      id: 'recount',
      slot: 'rightHeaderSlot',
      order: 0,
      icon: () => <span aria-hidden>R</span>,
      label: () => 'Recount',
      onSelect: () => {
        const done = deferred<void>()
        runs.push(done)
        return done.promise
      },
    }
    const narrow = definePlugin()({ id: 'narrowProbe', slotActions: [recount] })
    const NarrowGrid = () => {
      const table = useCreateTable({
        columns: [
          {
            id: 'name',
            accessorKey: 'name',
            header: 'Name',
            size: 64,
            minSize: 64,
          },
        ] as never,
        data: DATA.slice(0, 10),
        getRowId: (row: (typeof DATA)[number]) => row.id,
        plugins: [narrow(), columnSorting(), headerActionMenu()] as never,
      })
      return (
        <div style={{ width: 400, height: 300 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<NarrowGrid />)
    await waitForGrid()
    const kebab = () =>
      headCell().querySelector<HTMLElement>(
        `[aria-label^="${tableLabels.headerMenu}"]`,
      )
    await userEvent.hover(headCell())
    await expect.poll(kebab).not.toBeNull()
    expect(
      headCell().querySelector('[aria-label="Recount"]'),
      'действие ушло в кебаб',
    ).toBeNull()

    const openKebab = async (label = 'Recount') => {
      await userEvent.hover(headCell())
      await humanClick(kebab()!)
      await expect.poll(() => item(label)).toBeTruthy()
    }
    await openKebab()
    await humanClick(item('Recount')!)
    await expect.poll(() => items().length).toBe(0)
    await expect.poll(() => kebab()!.getAttribute('aria-busy')).toBe('true')
    expect(pendingArcOf(kebab()!)?.dataset.phase).toBe('pending')
    // Ждущий пункт предлагает отмену (ADR 0153).
    const cancelRecount = tableLabels.cancelAction('Recount')
    await openKebab(cancelRecount)
    expect(item(cancelRecount)!.closest('[data-pending]')).not.toBeNull()
    await closeMenu()

    runs.at(-1)!.reject(new Error('Busy'))
    await expect
      .poll(() =>
        kebab()!
          .querySelector<HTMLElement>('[data-error-indicator]')
          ?.getAttribute('data-shown'),
      )
      .toBe('true')
    await openKebab()
    expect(failedIcon(item('Recount'))).not.toBeNull()
    await closeMenu()
  })
})
