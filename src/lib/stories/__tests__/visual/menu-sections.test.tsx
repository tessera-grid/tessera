import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, onTestFinished, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type {
  ContextMenuAction,
  HeaderAction,
  MenuAction,
  RowAction,
} from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  contextMenu,
  headerActionMenu,
  rowActionMenu,
  rowActions,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { composed, rowNestedArgs } from '../stories'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { rowsTopDown, waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Вложенные разделы меню действий (ADR 0079, NM1–NM16, NM19): смена содержимого на
// месте, навигация, фокус, асинхронный раздел. Промисы раздела — в руках теста.

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

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

/** Свежие дескрипторы на тест: загрузки и выборы считает тест. */
const makeProbe = () => {
  const loads: { signal: AbortSignal; answer: Deferred<MenuAction[]> }[] = []
  const selected: string[] = []
  let refreshCount = 0
  const labelSet = new Set<string>()
  const checks: Deferred<boolean>[] = []
  const runs: Deferred<void>[] = []

  const icon = (letter: string) => () => <span aria-hidden>{letter}</span>
  const leaf = (id: string, label: string): MenuAction => ({
    id,
    icon: icon(label[0]!),
    label: () => label,
    onSelect: () => {
      selected.push(id)
    },
  })
  const projects: MenuAction = {
    id: 'projects',
    icon: icon('P'),
    label: () => 'Projects',
    onSelect: () => {},
    submenu: () => ({
      title: 'Projects',
      items: [leaf('tessera', 'Tessera'), leaf('website', 'Website')],
    }),
  }
  const remote: MenuAction[] = [
    leaf('inbox', 'Inbox'),
    projects,
    {
      id: 'share',
      icon: icon('S'),
      label: () => 'Share',
      disabled: () => {
        const answer = deferred<boolean>()
        checks.push(answer)
        return answer.promise
      },
      onSelect: () => {},
    },
    {
      id: 'sync',
      icon: icon('Y'),
      label: () => 'Sync',
      onSelect: () => {
        const done = deferred<void>()
        runs.push(done)
        return done.promise
      },
    },
  ]
  const sections: MenuAction[] = [
    leaf('edit', 'Edit something rather long'),
    {
      id: 'pin',
      icon: icon('P'),
      label: () => 'Pin',
      hint: () => 'Left',
      onSelect: () => {
        selected.push('pin-itself')
      },
      submenu: () => ({
        title: 'Pin',
        items: [leaf('left', 'Left'), leaf('right', 'Right')],
      }),
    },
    {
      id: 'move',
      icon: icon('M'),
      label: () => 'Move to',
      onSelect: () => {},
      submenu: () => ({
        title: 'Move to',
        items: signal => {
          const answer = deferred<MenuAction[]>()
          loads.push({ signal, answer })
          return answer.promise
        },
      }),
    },
    leaf('delete', 'Delete'),
    {
      id: 'refresh',
      icon: icon('R'),
      label: () => 'Refresh',
      closeOnSelect: false,
      onSelect: () => {
        refreshCount += 1
      },
    },
    {
      id: 'labels',
      icon: icon('L'),
      label: () => 'Labels',
      hint: () => (labelSet.size > 0 ? String(labelSet.size) : undefined),
      onSelect: () => {},
      submenu: () => ({
        title: 'Labels',
        closeOnSelect: false,
        items: [
          {
            id: 'vip',
            icon: icon('V'),
            label: () => 'VIP',
            active: () => labelSet.has('vip'),
            onSelect: () => {
              if (labelSet.has('vip')) labelSet.delete('vip')
              else labelSet.add('vip')
            },
          },
          {
            id: 'later',
            icon: icon('L'),
            label: () => 'Later',
            active: () => labelSet.has('later'),
            onSelect: () => {
              const done = deferred<void>()
              runs.push(done)
              return done.promise
            },
          },
          { ...leaf('clear', 'Clear labels'), closeOnSelect: true },
        ],
      }),
    },
  ]
  const rowList: RowAction[] = sections.map((action, order) => ({
    ...action,
    slot: 'actionRowSlot',
    order,
  }))
  const header: HeaderAction = {
    id: 'freeze',
    slot: 'rightHeaderSlot',
    order: 20,
    icon: icon('F'),
    label: () => 'Freeze',
    onSelect: () => {},
    submenu: () => ({
      title: 'Freeze',
      items: [leaf('freezeStart', 'At start'), leaf('freezeEnd', 'At end')],
    }),
  }
  const context: ContextMenuAction[] = sections as ContextMenuAction[]
  return {
    plugin: definePlugin()({
      id: 'sectionsProbe',
      slotActions: [...rowList, header],
      contextMenuActions: context,
    }),
    loads,
    selected,
    checks,
    runs,
    remote,
    lastLoad: () => loads.at(-1)!,
    refreshCount: () => refreshCount,
  }
}

type Probe = ReturnType<typeof makeProbe>

const DATA = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))

const Grid = ({
  probe,
  menu = true,
  keyboard = false,
  width = 640,
}: {
  probe: Probe
  menu?: boolean
  keyboard?: boolean
  width?: number | string
}) => {
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
    ] as never,
  })
  return (
    <div style={{ width, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const renderGrid = async (props: Partial<Parameters<typeof Grid>[0]> = {}) => {
  const probe = props.probe ?? makeProbe()
  await render(<Grid {...props} probe={probe} />)
  await waitForGrid()
  return probe
}

const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )!
const rowKebab = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
const nameCell = (id = 'r1') =>
  rowEl(id).querySelector<HTMLElement>('[data-column-id="name"]')!
const items = () => [
  ...document.querySelectorAll<HTMLElement>(
    '[role="menuitem"], [role="menuitemcheckbox"]',
  ),
]
const item = (label: string) =>
  items().find(
    el => el.querySelector('[data-popup-item-label]')?.textContent === label,
  )
const backRow = () =>
  document.querySelector<HTMLElement>('[role="menuitem"][data-menu-back]')
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const wrap = () => menu()?.querySelector<HTMLElement>('[data-menu-sections]')
const level = () => menu()?.querySelector<HTMLElement>('[data-menu-level]')
const ghost = () =>
  menu()?.querySelector<HTMLElement>('[data-menu-ghost] > *') ?? null
const liveRegion = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const settle = async () => {
  await frame()
  await Promise.all(
    document
      .getAnimations()
      .filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => undefined)),
  )
}
const translateX = (el: Element) =>
  new DOMMatrix(getComputedStyle(el).transform).m41

const openRowMenu = async (id = 'r1') => {
  await userEvent.hover(nameCell(id))
  await expect.poll(() => rowKebab(id)).not.toBeNull()
  await humanClick(rowKebab(id)!)
  await expect.poll(() => items().length).toBeGreaterThan(0)
  await settle()
}
const closeMenu = async () => {
  for (let i = 0; i < 4 && items().length > 0; i += 1) {
    await userEvent.keyboard('{Escape}')
    await settle()
  }
  await expect.poll(() => items().length).toBe(0)
}
const enter = async (label: string) => {
  await humanClick(item(label)!)
  await expect.poll(() => backRow()).not.toBeNull()
}

afterEach(async () => {
  await reducedMotion(false)
  document.documentElement.classList.remove('dark')
})

describe('Раздел и смена содержимого', () => {
  test('NM1: действие с submenu — шеврон у правого края и hint перед ним; нажатие открывает раздел в том же окне, onSelect не вызывается', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    const pin = item('Pin')!
    expect(pin.getAttribute('aria-haspopup')).toBe('menu')
    const check = pin.querySelector('[data-popup-item-mark]')!
    expect(check.querySelector('svg')).not.toBeNull()
    const hint = pin.querySelector<HTMLElement>('[data-popup-item-hint]')!
    expect(hint.textContent).toBe('Left')
    expect(hint.getBoundingClientRect().right).toBeLessThanOrEqual(
      check.getBoundingClientRect().left,
    )
    expect(item('Edit something rather long')!.querySelector('svg')).toBeNull()

    const popup = menu()
    await enter('Pin')
    expect(menu()).toBe(popup)
    expect(document.querySelectorAll('[role="menu"]').length).toBe(1)
    expect(item('Left')).toBeTruthy()
    expect(probe.selected).toEqual([])
    await closeMenu()
  })

  test('NM2: вход — уровень уезжает влево, новый приезжает справа, окно плавно подстраивает размер; возврат — в обратную сторону', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    // Замедляем переход: видимое положение уровней проверяется уже после того, как
    // фокус встал на пункт въезжающего уровня.
    menu()!.style.setProperty('--tsr-comp-motion-duration', '1200ms')
    const before = wrap()!.getBoundingClientRect()

    await humanClick(item('Pin')!)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(document.activeElement).toBe(item('Left'))
    const box = wrap()!.getBoundingClientRect()
    expect(level()!.getBoundingClientRect().left).toBeGreaterThan(box.left + 20)
    expect(ghost()!.getBoundingClientRect().left).toBeLessThan(box.left - 20)
    expect(wrap()!.scrollLeft).toBe(0)
    const sizing = wrap()!
      .getAnimations()
      .map(a => (a as CSSTransition).transitionProperty)
    expect(sizing).toEqual(expect.arrayContaining(['width', 'height']))
    await settle()
    expect(translateX(level()!)).toBe(0)
    await expect.poll(ghost).toBeNull()
    const after = wrap()!.getBoundingClientRect()
    expect(after.width).toBeLessThan(before.width)
    expect(after.height).toBeLessThan(before.height)
    expect(after.width).toBe(level()!.offsetWidth)

    await humanClick(backRow()!)
    await new Promise(resolve => setTimeout(resolve, 300))
    const back = wrap()!.getBoundingClientRect()
    expect(level()!.getBoundingClientRect().left).toBeLessThan(back.left - 20)
    expect(ghost()!.getBoundingClientRect().left).toBeGreaterThan(
      back.left + 20,
    )
    await settle()
    expect(wrap()!.getBoundingClientRect().width).toBe(before.width)

    // Уровни одной ширины: первый пункт въезжающего уровня целиком за краем окна —
    // фокус на нём не должен прокручивать окно и съедать сдвиг.
    await enter('Move to')
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Projects')).toBeTruthy()
    await settle()
    await humanClick(item('Projects')!)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(document.activeElement).toBe(item('Tessera'))
    const same = wrap()!.getBoundingClientRect()
    expect(level()!.getBoundingClientRect().left).toBeGreaterThan(
      same.left + 20,
    )
    expect(ghost()!.getBoundingClientRect().left).toBeLessThan(same.left - 20)
    expect(wrap()!.scrollLeft).toBe(0)
    await settle()
    await closeMenu()
  })

  test('NM3: первая строка раздела — «‹ Название» с разделителем; нажатие возвращает уровень выше', async () => {
    await renderGrid()
    await openRowMenu()
    await enter('Pin')
    const back = backRow()!
    expect(items()[0]).toBe(back)
    expect(back.textContent).toBe('Pin')
    expect(back.querySelector('svg')).not.toBeNull()
    // Отдельный разделитель, а не граница строки: подсветка строки остаётся скруглённой.
    expect(getComputedStyle(back).borderBottomWidth).toBe('0px')
    expect(getComputedStyle(back).borderBottomLeftRadius).not.toBe('0px')
    const separator = back.nextElementSibling as HTMLElement
    expect(separator.getAttribute('role')).toBe('separator')
    expect(separator.getBoundingClientRect().height).toBe(1)
    const divider = document.createElement('span')
    divider.style.color = 'var(--tsr-comp-popup-divider-color)'
    menu()!.appendChild(divider)
    expect(getComputedStyle(separator).backgroundColor).toBe(
      getComputedStyle(divider).color,
    )
    divider.remove()

    await humanClick(back)
    await settle()
    expect(backRow()).toBeNull()
    expect(item('Pin')).toBeTruthy()
    await closeMenu()
  })

  test.each([false, true])(
    'NM4: ArrowRight и Enter — вход, ArrowLeft и Escape — назад, Escape на корне закрывает меню (keyboardNavigation: %s)',
    async keyboard => {
      await renderGrid({ keyboard })
      await openRowMenu()
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      await expect.poll(() => document.activeElement).toBe(item('Pin'))
      await userEvent.keyboard('{ArrowRight}')
      await expect.poll(() => backRow()).not.toBeNull()
      await settle()
      await userEvent.keyboard('{ArrowLeft}')
      await expect.poll(() => backRow()).toBeNull()
      await settle()

      await expect.poll(() => document.activeElement).toBe(item('Pin'))
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => backRow()).not.toBeNull()
      await settle()
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => backRow()).toBeNull()
      expect(items().length).toBeGreaterThan(0)
      await settle()
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => items().length).toBe(0)
    },
  )

  test('NM5: при входе фокус на первом пункте раздела, при возврате — на пункте, из которого заходили', async () => {
    await renderGrid()
    await openRowMenu()
    await enter('Pin')
    await settle()
    expect(document.activeElement).toBe(item('Left'))
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(item('Right'))

    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect(document.activeElement).toBe(item('Pin'))
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => document.activeElement).toBe(item('Move to'))
    await closeMenu()
  })

  test('NM6: раздел внутри раздела работает так же — вход, строка «назад», возврат по уровням', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Move to')
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Projects')).toBeTruthy()
    await settle()
    await humanClick(item('Projects')!)
    await expect.poll(() => item('Tessera')).toBeTruthy()
    await settle()
    expect(backRow()!.textContent).toBe('Projects')

    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect(backRow()!.textContent).toBe('Move to')
    expect(document.activeElement).toBe(item('Projects'))
    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    expect(backRow()).toBeNull()
    await closeMenu()
  })

  test('NM7: выбор пункта раздела выполняет действие и закрывает всё меню; следующее открытие — с корня', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Pin')
    await settle()
    await humanClick(item('Right')!)
    await expect.poll(() => items().length).toBe(0)
    expect(probe.selected).toEqual(['right'])

    await openRowMenu()
    expect(backRow()).toBeNull()
    expect(item('Pin')).toBeTruthy()
    await closeMenu()
  })

  test('NM8: при уменьшенном движении смена раздела мгновенная — без сдвига и без анимации размера', async () => {
    await reducedMotion(true)
    await renderGrid()
    await openRowMenu()
    await humanClick(item('Pin')!)
    await frame()
    await frame()
    expect(translateX(level()!)).toBe(0)
    expect(ghost()).toBeNull()
    expect(wrap()!.getBoundingClientRect().width).toBe(level()!.offsetWidth)
    expect(getComputedStyle(wrap()!).transitionDuration).toMatch(/^0s/)
    await closeMenu()
  })

  test('NM9: окно остаётся прижатым к кебабу и не выходит за край экрана при смене размера', async () => {
    const probe = await renderGrid({ width: '100vw' })
    await openRowMenu()
    const kebab = rowKebab()!.getBoundingClientRect()
    const near = () => {
      const popup = menu()!.getBoundingClientRect()
      return (
        Math.min(
          Math.abs(popup.top - kebab.bottom),
          Math.abs(popup.bottom - kebab.top),
        ) < 16
      )
    }
    expect(near()).toBe(true)
    await enter('Move to')
    probe.lastLoad().answer.resolve([
      {
        id: 'wide',
        icon: () => null,
        label: () => 'A really very long destination folder name for testing',
        onSelect: () => {},
      },
    ])
    await expect.poll(() => items().length).toBe(2)
    await settle()
    await frame()
    const popup = menu()!.getBoundingClientRect()
    expect(popup.right).toBeLessThanOrEqual(window.innerWidth)
    expect(popup.left).toBeGreaterThanOrEqual(0)
    expect(near()).toBe(true)
    await closeMenu()
  })
})

describe('Асинхронный раздел', () => {
  test('NM10: items промисом — раздел открывается сразу со скелетом строк, пункты появляются после ответа', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await humanClick(item('Move to')!)
    // Сразу, без ожидания ответа: уже в следующем кадре — раздел со скелетом.
    await frame()
    expect(backRow()!.textContent).toBe('Move to')
    expect(level()!.querySelectorAll('[data-menu-skeleton]').length).toBe(3)
    expect(item('Inbox')).toBeUndefined()

    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Inbox')).toBeTruthy()
    expect(level()!.querySelector('[data-menu-skeleton]')).toBeNull()
    await closeMenu()
  })

  test('NM11: загрузка начинается при наведении на пункт-раздел и переиспользуется при входе; закрытие меню прерывает её', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    expect(probe.loads.length).toBe(0)
    await userEvent.hover(item('Move to')!)
    await expect.poll(() => probe.loads.length).toBe(1)
    await enter('Move to')
    expect(probe.loads.length).toBe(1)
    const { signal } = probe.lastLoad()
    expect(signal.aborted).toBe(false)

    await closeMenu()
    expect(signal.aborted).toBe(true)
  })

  test("NM12: отказ загрузки — строка «Couldn't load» с иконкой ошибки и текстом в тултипе и aria-describedby; нажатие загружает заново", async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Move to')
    probe.lastLoad().answer.reject(new Error('Folder service is down'))
    const failed = () =>
      menu()?.querySelector<HTMLElement>('[data-section-failed]')
    await expect.poll(failed).not.toBeNull()
    expect(failed()!.textContent).toBe(tableLabels.sectionLoadFailed)
    expect(
      failed()!.querySelector('[data-popup-item-mark="failed"] svg'),
    ).not.toBeNull()
    const describedBy = failed()!.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)!.textContent).toBe(
      'Folder service is down',
    )
    await userEvent.hover(failed()!)
    await expect.poll(tooltipShown('Folder service is down')).toBe(true)

    await humanClick(failed()!)
    expect(probe.loads.length).toBe(2)
    expect(level()!.querySelectorAll('[data-menu-skeleton]').length).toBe(3)
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Inbox')).toBeTruthy()
    await closeMenu()
  })

  test('NM13: пункты раздела получают состояния ADR 0078 — проверку доступности при входе, ожидание действия на строке и в имени кебаба', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Move to')
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Share')).toBeTruthy()
    await expect.poll(() => probe.checks.length).toBe(1)
    expect(item('Share')!.hasAttribute('data-pending')).toBe(true)
    probe.checks[0]!.resolve(true)
    await expect
      .poll(() => item('Share')!.hasAttribute('data-pending'))
      .toBe(false)
    expect(item('Share')!.getAttribute('aria-disabled')).toBe('true')

    await humanClick(item('Sync')!)
    await expect.poll(() => items().length).toBe(0)
    await expect
      .poll(() => rowKebab()!.getAttribute('aria-label'))
      .toBe('Row options. Running: Sync')
    // Ожидание — на строке-цели, а не на кебабе (ADR 0177, §1).
    expect(
      rowKebab()!
        .closest('.data-grid__body-row')!
        .querySelector('[aria-busy="true"]'),
    ).not.toBeNull()
    probe.runs[0]!.resolve()
    await expect
      .poll(() => rowKebab()!.getAttribute('aria-label'))
      .toBe(tableLabels.rowMenu)
  })

  test('NM26: при уменьшенном движении скелет, отказ и пункты асинхронного раздела меняют размер окна без ошибки «ResizeObserver loop»', async () => {
    const loops: string[] = []
    const onError = (event: ErrorEvent) => {
      if (event.message.includes('ResizeObserver loop'))
        loops.push(event.message)
    }
    window.addEventListener('error', onError)
    onTestFinished(() => window.removeEventListener('error', onError))
    await reducedMotion(true)
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Move to')
    await settle()
    probe.lastLoad().answer.reject(new Error('Folder service is down'))
    const failed = () =>
      menu()?.querySelector<HTMLElement>('[data-section-failed]')
    await expect.poll(failed).not.toBeNull()
    await settle()
    await humanClick(failed()!)
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Inbox')).toBeTruthy()
    await settle()
    await settle()
    expect(loops).toEqual([])
    expect(wrap()!.getBoundingClientRect().width).toBe(level()!.offsetWidth)
    await closeMenu()
  })
})

describe('Где работает, доступность', () => {
  test('NM14: разделы работают в кебабе заголовка и в контекстном меню', async () => {
    const probe = await renderGrid()
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="name"]',
    )!
    await userEvent.hover(head)
    const headKebab = head.querySelector<HTMLElement>(
      `[aria-label^="${tableLabels.headerMenu}"]`,
    )!
    await humanClick(headKebab)
    await expect.poll(() => item('Freeze')).toBeTruthy()
    await settle()
    await enter('Freeze')
    expect(item('At end')).toBeTruthy()
    await closeMenu()

    await userEvent.click(nameCell(), { button: 'right' })
    await expect.poll(() => item('Pin')).toBeTruthy()
    await settle()
    await enter('Pin')
    await settle()
    await humanClick(item('Left')!)
    await expect.poll(() => items().length).toBe(0)
    expect(probe.selected).toEqual(['left'])
  })

  test('NM20: инлайн-кнопка с submenu открывает мини-меню сразу в её разделе, без строки «назад»', async () => {
    const probe = await renderGrid({ menu: false })
    await userEvent.hover(nameCell())
    const pinButton =
      rowEl('r1').querySelector<HTMLElement>('[aria-label="Pin"]')!
    await humanClick(pinButton)
    await expect.poll(() => item('Left')).toBeTruthy()
    expect(backRow()).toBeNull()
    await settle()
    await humanClick(item('Right')!)
    await expect.poll(() => items().length).toBe(0)
    expect(probe.selected).toEqual(['right'])

    await userEvent.hover(nameCell())
    const moveButton = rowEl('r1').querySelector<HTMLElement>(
      '[aria-label="Move to"]',
    )!
    await humanClick(moveButton)
    await expect
      .poll(() => menu()?.querySelectorAll('[data-menu-skeleton]').length)
      .toBe(3)
    probe.lastLoad().answer.resolve(probe.remote)
    await expect.poll(() => item('Inbox')).toBeTruthy()
    await settle()
    await humanClick(item('Projects')!)
    await expect.poll(() => backRow()?.textContent).toBe('Projects')
    await closeMenu()
  })

  test('NM15: пункт-раздел — aria-haspopup="menu"; у меню при входе aria-label — название раздела, вход объявляется; строка «назад» — «Back, <название>»', async () => {
    await renderGrid()
    await openRowMenu()
    expect(item('Pin')!.getAttribute('aria-haspopup')).toBe('menu')
    expect(item('Delete')!.hasAttribute('aria-haspopup')).toBe(false)
    expect(menu()!.getAttribute('aria-label')).toBeNull()
    await enter('Pin')
    expect(menu()!.getAttribute('aria-label')).toBe('Pin')
    expect(backRow()!.getAttribute('aria-label')).toBe('Back, Pin')
    await expect.poll(() => liveRegion().textContent).toBe('Pin menu')
    await closeMenu()
  })

  test('NM16: axe и контраст шеврона, hint, строки «назад» и скелета в обеих темах', async () => {
    await renderGrid()
    await openRowMenu()
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const check = async () => {
      const { violations } = await axe.run(menu()!, options)
      expect(violations.map(v => v.id)).toEqual([])
    }
    await inBothThemes(async () => {
      await check()
      const bg = backgroundOf(menu())
      const pin = item('Pin')!
      const chevron = pin.querySelector('[data-popup-item-mark]')!
      expect(
        contrast(toRgba(getComputedStyle(chevron).color), bg),
      ).toBeGreaterThanOrEqual(3)
      const hint = pin.querySelector('[data-popup-item-hint]')!
      expect(
        contrast(toRgba(getComputedStyle(hint).color), bg),
      ).toBeGreaterThanOrEqual(4.5)
    })
    await enter('Move to')
    await settle()
    await inBothThemes(async () => {
      await check()
      const bg = backgroundOf(menu())
      expect(
        contrast(toRgba(getComputedStyle(backRow()!).color), bg),
      ).toBeGreaterThanOrEqual(4.5)
      const skeleton = level()!.querySelector(
        '[data-menu-skeleton] > *',
      ) as HTMLElement
      expect(
        contrast(toRgba(getComputedStyle(skeleton).backgroundColor), bg),
      ).toBeGreaterThan(1.05)
    })
    await closeMenu()
  })
})

describe('Демо-история', () => {
  test('NM19: набор действий с разделами в «Rows/Actions — Playground» — статус со значением, третий уровень, асинхронный раздел с отказом и повтором', async () => {
    await render(<composed.RowActionsPlayground {...rowNestedArgs} />)
    await waitForGrid()
    const first = rowsTopDown()[0]!
    const kebab = () =>
      first.querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)
    await userEvent.hover(first)
    await expect.poll(kebab).not.toBeNull()
    await humanClick(kebab()!)
    await expect.poll(() => item('Assign to')).toBeTruthy()
    // Один набор демо-действий: пункты других наборов не подмешаны.
    expect(item('Duplicate')).toBeUndefined()
    expect(items().filter(el => el.textContent === 'Delete').length).toBe(1)
    await settle()
    await enter('Assign to')
    await expect.poll(() => item('Sales'), { timeout: 5000 }).toBeTruthy()
    await settle()
    await humanClick(item('Sales')!)
    await expect.poll(() => item('Anna Petrova')).toBeTruthy()
    await settle()
    await userEvent.keyboard('{ArrowLeft}')
    await settle()
    await userEvent.keyboard('{ArrowLeft}')
    await settle()

    await enter('Labels')
    const failed = () =>
      menu()?.querySelector<HTMLElement>('[data-section-failed]')
    await expect.poll(failed, { timeout: 5000 }).not.toBeNull()
    await humanClick(failed()!)
    await expect.poll(() => item('VIP'), { timeout: 5000 }).toBeTruthy()
    await closeMenu()

    // Статус: выбор в разделе меняет значение у пункта.
    await userEvent.hover(first)
    await humanClick(kebab()!)
    await expect.poll(() => item('Status')).toBeTruthy()
    expect(
      item('Status')!.querySelector('[data-popup-item-hint]')!.textContent,
    ).toBe('Active')
    await settle()
    await enter('Status')
    await settle()
    await humanClick(item('Paused')!)
    await expect.poll(() => items().length).toBe(0)
    await userEvent.hover(first)
    await humanClick(kebab()!)
    await expect
      .poll(
        () =>
          item('Status')?.querySelector('[data-popup-item-hint]')?.textContent,
      )
      .toBe('Paused')
    await closeMenu()
  })
})

describe('Меню, которое не закрывается', () => {
  test('NM21: closeOnSelect: false у пункта — выбор кликом, Enter и Space выполняет действие, меню остаётся на том же уровне, фокус — на том же пункте', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await humanClick(item('Refresh')!)
    expect(probe.refreshCount()).toBe(1)
    await settle()
    expect(items().length).toBeGreaterThan(0)
    expect(backRow()).toBeNull()
    expect(document.activeElement).toBe(item('Refresh'))

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => probe.refreshCount()).toBe(2)
    await userEvent.keyboard(' ')
    await expect.poll(() => probe.refreshCount()).toBe(3)
    expect(items().length).toBeGreaterThan(0)
    expect(document.activeElement).toBe(item('Refresh'))
    await closeMenu()
  })

  test('NM22: closeOnSelect: false у раздела действует на все его пункты; closeOnSelect: true у пункта переопределяет раздел и закрывает меню', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Labels')
    await settle()
    await humanClick(item('VIP')!)
    await settle()
    expect(items().length).toBeGreaterThan(0)
    expect(backRow()!.textContent).toBe('Labels')

    await humanClick(item('Clear labels')!)
    await expect.poll(() => items().length).toBe(0)
    expect(probe.selected).toContain('clear')
  })

  test('NM23: после выбора без закрытия состояние пункта обновляется сразу, даже если оно живёт у приложения; при возврате — и hint родителя', async () => {
    await renderGrid()
    await openRowMenu()
    expect(item('Labels')!.querySelector('[data-popup-item-hint]')).toBeNull()
    await enter('Labels')
    await settle()
    const check = () =>
      item('VIP')!.querySelector('[data-popup-item-mark] svg') !== null
    expect(check()).toBe(false)
    await humanClick(item('VIP')!)
    await expect.poll(check).toBe(true)
    await humanClick(item('VIP')!)
    await expect.poll(check).toBe(false)
    await humanClick(item('VIP')!)
    await expect.poll(check).toBe(true)

    await humanClick(backRow()!)
    await settle()
    expect(
      item('Labels')!.querySelector('[data-popup-item-hint]')!.textContent,
    ).toBe('1')
    await closeMenu()
  })

  test('NM24: асинхронное действие пункта, не закрывающего меню, — лоадер в пункте, отказ — иконкой ошибки с текстом в тултипе; меню открыто', async () => {
    const probe = await renderGrid()
    await openRowMenu()
    await enter('Labels')
    await settle()
    await humanClick(item('Later')!)
    // Ждущий пункт предлагает отмену (ADR 0153).
    const cancelLater = tableLabels.cancelAction('Later')
    await expect
      .poll(() => item(cancelLater)?.querySelector('[data-item-spinner]'))
      .toBeTruthy()
    expect(items().length).toBeGreaterThan(0)

    probe.runs.at(-1)!.reject(new Error('Label was not saved'))
    await expect
      .poll(() => item('Later')!.querySelector('[data-action-failed] svg'))
      .not.toBeNull()
    expect(item('Later')!.querySelector('[data-item-spinner]')).toBeNull()
    expect(items().length).toBeGreaterThan(0)
    // Курсор уходит и возвращается: headless WebKit не шлёт наведение на элемент,
    // появившийся под неподвижным курсором.
    await userEvent.unhover(item('Later')!)
    await userEvent.hover(item('Later')!)
    await expect.poll(tooltipShown('Label was not saved')).toBe(true)
    await closeMenu()
  })

  test('NM25: пункт с active и closeOnSelect: false — роль menuitemcheckbox и aria-checked по состоянию; остальные — menuitem', async () => {
    await renderGrid()
    await openRowMenu()
    const refresh = document.querySelector('[data-action-id="refresh"]')!
    expect(refresh.getAttribute('role')).toBe('menuitem')
    await enter('Labels')
    await settle()
    const vip = () => document.querySelector('[data-action-id="vip"]')!
    expect(vip().getAttribute('role')).toBe('menuitemcheckbox')
    expect(vip().getAttribute('aria-checked')).toBe('false')
    await humanClick(vip() as HTMLElement)
    await expect.poll(() => vip().getAttribute('aria-checked')).toBe('true')
    const clear = document.querySelector('[data-action-id="clear"]')!
    expect(clear.getAttribute('role')).toBe('menuitem')
    expect(clear.hasAttribute('aria-checked')).toBe(false)
    await closeMenu()
  })
})
