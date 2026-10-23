import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { definePlugin } from '../../../core/definePlugin'
import type { HeaderAction } from '../../../core/headerActions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { LAZY_PENDING_DELAY_MS } from '../../../core/lazyOpening'
import { headerActionMenu } from '../../../plugins'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Загрузка содержимого панели действия перед открытием (ADR 0024, AM28–AM30):
// ожидание на кнопке, его отмена, ошибка загрузки. `preload` тестового действия —
// промис, которым управляет тест.

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: () => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: () => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = () => fail(new Error('chunk failed'))
  })
  promise.catch(() => {})
  return { promise, resolve, reject }
}

let load = deferred()
let preloadCalls = 0

const probeAction: HeaderAction = {
  id: 'probe',
  slot: 'rightHeaderSlot',
  order: 0,
  icon: () => <span aria-hidden>P</span>,
  label: () => 'Probe',
  onSelect: () => {},
  className: () => 'probe__button',
  panel: () => <div data-testid="probe-panel">Probe panel</div>,
  preload: () => {
    preloadCalls += 1
    return load.promise
  },
}

const probe = definePlugin()({
  id: 'probe',
  slotActions: [probeAction],
})

const Grid = ({ withMenu }: { withMenu: boolean }) => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: [{ id: '1', name: 'Alice' }],
    plugins: [
      probe(),
      ...(withMenu ? [headerActionMenu({ mode: 'always' })] : []),
    ],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const head = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"]',
  )!
const inlineButton = () => head().querySelector<HTMLElement>('.probe__button')!
const kebab = () =>
  head().querySelector<HTMLElement>(`[aria-label="${tableLabels.headerMenu}"]`)!
const panel = () => document.querySelector('[data-testid="probe-panel"]')
const menuItem = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(el =>
    el.textContent?.trim().endsWith('Probe'),
  )
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const renderGrid = async (withMenu: boolean) => {
  load = deferred()
  preloadCalls = 0
  const screen = await render(<Grid withMenu={withMenu} />)
  await waitForGrid()
  // Кнопки — из ленивого чанка: ждём настоящую кнопку вместо заглушки.
  const trigger = withMenu ? kebab : inlineButton
  await expect
    .poll(() => trigger()?.id.startsWith('base-ui') ?? false)
    .toBe(true)
  return screen
}

const clickInline = async () => {
  await userEvent.hover(head())
  await humanClick(inlineButton())
}

const chooseFromKebab = async () => {
  await userEvent.hover(head())
  await humanClick(kebab())
  await expect.poll(menuItem).toBeTruthy()
  await humanClick(menuItem()!)
}

describe('Панель действия — загрузка содержимого', () => {
  test('AM28: пока preload дольше порога, кнопка — инлайн или кебаб — в ожидании (aria-busy, видна); быстрая загрузка ожидания не показывает; поповер открывается после загрузки', async () => {
    // Медленная загрузка, инлайн-кнопка.
    const inline = await renderGrid(false)
    await clickInline()
    expect(inlineButton().getAttribute('aria-busy')).toBeNull()
    expect(panel()).toBeNull()
    await expect
      .poll(() => inlineButton().getAttribute('aria-busy'))
      .toBe('true')
    expect(
      inlineButton()
        .closest('.cell__button')!
        .getAttribute('data-button-active'),
    ).toBe('true')
    load.resolve()
    await expect.poll(panel).not.toBeNull()
    expect(inlineButton().getAttribute('aria-busy')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()

    // Быстрая загрузка: ожидания нет ни в одном кадре.
    load = deferred()
    const busy: (string | null)[] = []
    const watch = new MutationObserver(() =>
      busy.push(inlineButton()?.getAttribute('aria-busy') ?? null),
    )
    watch.observe(head(), { attributes: true, subtree: true })
    await clickInline()
    await sleep(LAZY_PENDING_DELAY_MS / 3)
    load.resolve()
    await expect.poll(panel).not.toBeNull()
    await sleep(LAZY_PENDING_DELAY_MS)
    watch.disconnect()
    expect(busy).not.toContain('true')
    await userEvent.keyboard('{Escape}')
    await inline.unmount()

    // Медленная загрузка через пункт кебаба: ожидание на кебабе, меню открыто.
    await renderGrid(true)
    await chooseFromKebab()
    await expect.poll(() => kebab().getAttribute('aria-busy')).toBe('true')
    expect(menuItem()).toBeTruthy()
    expect(panel()).toBeNull()
    load.resolve()
    await expect.poll(panel).not.toBeNull()
    expect(kebab().getAttribute('aria-busy')).toBeNull()
    await expect.poll(menuItem).toBeUndefined()
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
  })

  test('AM29: Escape и уход фокуса с кнопки отменяют ожидание — поповер после загрузки не открывается; у кебаба ожидание отменяет закрытие меню', async () => {
    const inline = await renderGrid(false)
    await clickInline()
    await expect
      .poll(() => inlineButton().getAttribute('aria-busy'))
      .toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => inlineButton().getAttribute('aria-busy')).toBeNull()
    load.resolve()
    await sleep(100)
    expect(panel()).toBeNull()

    load = deferred()
    await clickInline()
    await expect
      .poll(() => inlineButton().getAttribute('aria-busy'))
      .toBe('true')
    inlineButton().blur()
    await expect.poll(() => inlineButton().getAttribute('aria-busy')).toBeNull()
    load.resolve()
    await sleep(100)
    expect(panel()).toBeNull()
    await inline.unmount()

    await renderGrid(true)
    await chooseFromKebab()
    await expect.poll(() => kebab().getAttribute('aria-busy')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await expect.poll(menuItem).toBeUndefined()
    expect(kebab().getAttribute('aria-busy')).toBeNull()
    load.resolve()
    await sleep(100)
    expect(panel()).toBeNull()
  })

  test('AM30: ошибка preload не открывает поповер — кнопка вспыхивает ошибкой, объявляется loadFailed; следующий клик снова зовёт preload', async () => {
    await renderGrid(false)
    const region = document.querySelector<HTMLElement>(
      '[role="status"][aria-live="polite"]',
    )!
    const messages: string[] = []
    const observer = new MutationObserver(() => {
      const text = region.textContent ?? ''
      if (text) messages.push(text)
    })
    observer.observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    await clickInline()
    load.reject()
    await expect
      .poll(() => inlineButton().getAttribute('data-error-flash'))
      .toBe('on')
    await expect.poll(() => messages).toContain(tableLabels.loadFailed('Probe'))
    await sleep(100)
    expect(panel()).toBeNull()
    expect(inlineButton().getAttribute('aria-busy')).toBeNull()
    observer.disconnect()

    load = deferred()
    const callsBefore = preloadCalls
    await humanClick(inlineButton())
    expect(preloadCalls).toBeGreaterThan(callsBefore)
    load.resolve()
    await expect.poll(panel).not.toBeNull()
  })
})
