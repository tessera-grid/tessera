import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import { parkPointer } from '../pointer'
import {
  headCellById,
  renderColumnPinning,
  revealPin,
} from './column-pinning-helpers'
import { composed } from '../stories'

// Визуальные тесты схлопывания действий слота в кебаб-меню (AM10–AM18).
// Чёрный ящик над раскладкой: истории `HeaderActionMenu` / `RowActionMenu` через
// composeStories, реальный Chromium. Один тест = одно требование (AM<n>).

const HEAD_CELL = '.data-grid__head-cell'
/** Заголовки реальных (не сервисных) колонок. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
const KEBAB = '[aria-label^="Column options"]'
const ROW_KEBAB = '[aria-label="Row options"]'
const ACTION_CELL =
  '.data-grid__body-cell[data-column-id="actionColumn__rowActions"]'

const dataHeadCells = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>(DATA_HEAD_CELL)).filter(
    cell => cell.getAttribute('aria-colindex') !== null,
  )

const menuItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

const menuItemByText = (text: string) =>
  menuItems().find(i => i.textContent?.trim() === text)

const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => menuItems().length).toBe(0)
}

async function renderHeaderMenu(args: Record<string, unknown> = {}) {
  const view = await render(<composed.HeaderActionMenu {...args} />)
  await expect
    .poll(() => dataHeadCells(view.container).length)
    .toBeGreaterThan(3)
  return view
}

async function renderRowMenu(args: Record<string, unknown> = {}) {
  const view = await render(<composed.RowActionMenu {...args} />)
  await expect
    .poll(() => view.container.querySelector(ACTION_CELL))
    .not.toBeNull()
  return view
}

describe('Action menu — header', () => {
  test('AM10: применимых дескрипторов ≥ порога → один кебаб на колонку, инлайн-кнопок нет', async () => {
    const { container } = await renderHeaderMenu()

    const columns = dataHeadCells(container)
    const kebabs = container.querySelectorAll(`${DATA_HEAD_CELL} ${KEBAB}`)

    expect(kebabs.length).toBe(columns.length)
    // Инлайн-кнопки мигрированных плагинов уехали в меню.
    expect(
      container.querySelectorAll(`${HEAD_CELL} .column-pin__button`).length,
    ).toBe(0)
    expect(
      container.querySelectorAll(`${HEAD_CELL} .column-sort__button`).length,
    ).toBe(0)
    expect(
      container.querySelectorAll(`${HEAD_CELL} .column-group__button`).length,
    ).toBe(0)
  })

  test('AM11: меню делится на подгруппы; сортировка развёрнута в asc/desc/сброс', async () => {
    const { container } = await renderHeaderMenu()

    await userEvent.click(
      dataHeadCells(container)[0].querySelector<HTMLElement>(KEBAB)!,
    )
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)

    const labels = menuItems().map(i => i.textContent?.trim())
    // Три подгруппы: пиннинг | сортировка (3 пункта) | группировка.
    expect(document.querySelectorAll('[role="group"]').length).toBe(3)
    expect(labels).toEqual(
      expect.arrayContaining([
        'Sort ascending',
        'Sort descending',
        'Clear sorting',
      ]),
    )

    await closeMenu()
  })

  test('AM12: live-переключение плагина-меню — off даёт инлайн, on даёт кебаб (без ремоунта)', async () => {
    const view = await renderHeaderMenu({ enableHeaderActionMenu: false })

    // Меню выключено: три инлайн-кнопки, кебаба нет.
    expect(
      view.container.querySelectorAll(`${HEAD_CELL} .column-pin__button`)
        .length,
    ).toBeGreaterThan(0)
    expect(
      view.container.querySelectorAll(`${HEAD_CELL} ${KEBAB}`).length,
    ).toBe(0)

    // Тот же инстанс, включаем меню → схлопывание.
    view.rerender(<composed.HeaderActionMenu enableHeaderActionMenu />)
    await expect
      .poll(
        () => view.container.querySelectorAll(`${HEAD_CELL} ${KEBAB}`).length,
      )
      .toBeGreaterThan(0)
    expect(
      view.container.querySelectorAll(`${HEAD_CELL} .column-pin__button`)
        .length,
    ).toBe(0)
  })

  test('AM13: пункт меню исполняет действие — пиннинг из меню закрепляет столбец, label реактивен', async () => {
    const { container } = await renderHeaderMenu()

    const firstCol = dataHeadCells(container)[0]
    const colId = firstCol.getAttribute('data-column-id')!

    await userEvent.click(firstCol.querySelector<HTMLElement>(KEBAB)!)
    await expect.poll(() => menuItemByText('Pin column')).toBeTruthy()
    await userEvent.click(menuItemByText('Pin column')!)

    const pinnedCell = () =>
      container.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id='${colId}']`,
      )
    await expect
      .poll(() => pinnedCell()?.getAttribute('data-cell-pinned'))
      .toBe('left')

    // Переоткрываем меню того же столбца — подпись стала «Unpin column».
    await userEvent.click(pinnedCell()!.querySelector<HTMLElement>(KEBAB)!)
    await expect.poll(() => menuItemByText('Unpin column')).toBeTruthy()

    await closeMenu()
  })

  test('AM14: resize-грип (countsAsHeaderAction:false) не влияет на порог кебаба', async () => {
    // Story включает ресайз; действия те же три → всё равно схлопнуто.
    const withResize = await renderHeaderMenu({ enableColumnSizing: true })
    expect(
      withResize.container.querySelectorAll(`${DATA_HEAD_CELL} ${KEBAB}`)
        .length,
    ).toBe(dataHeadCells(withResize.container).length)
    expect(
      withResize.container.querySelectorAll(
        `${HEAD_CELL}[data-column-resizable='true']`,
      ).length,
    ).toBeGreaterThan(0)

    // Без ресайза схлопывание такое же — грип не менял решение.
    const noResize = await renderHeaderMenu({ enableColumnSizing: false })
    expect(
      noResize.container.querySelectorAll(`${DATA_HEAD_CELL} ${KEBAB}`).length,
    ).toBe(dataHeadCells(noResize.container).length)
  })

  test('AM18: инлайн-паритет — мигрированная кнопка сохраняет DOM опаковой (класс/иконка/aria)', async () => {
    const { container } = await renderHeaderMenu({
      enableHeaderActionMenu: false,
    })

    const pin = container.querySelector<HTMLElement>(
      `${HEAD_CELL} .column-pin__button`,
    )!
    expect(pin).toBeTruthy()
    expect(pin.getAttribute('aria-label')).toBe('Pin column')
    expect(pin.querySelector('svg')).toBeTruthy()
    expect(
      pin.closest('.cell__button')?.getAttribute('data-button-active'),
    ).toBe('false')
  })

  test('AM24: кебаб заголовка скрыт в покое, появляется по наведению и остаётся видимым, пока меню открыто', async () => {
    const { container } = await renderHeaderMenu()
    // Лениво догруженный триггер заменяет заглушку — кебаб перечитываем каждый раз.
    const kebab = () =>
      dataHeadCells(container)[0].querySelector<HTMLElement>(KEBAB)!
    const opacity = () =>
      getComputedStyle(kebab().closest('.cell__button')!).opacity

    await parkPointer()
    await expect.poll(opacity).toBe('0')

    await userEvent.hover(dataHeadCells(container)[0])
    await expect.poll(opacity).toBe('1')

    await humanClick(kebab())
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    await userEvent.hover(dataHeadCells(container)[1])
    expect(opacity()).toBe('1')

    // Escape возвращает фокус на кебаб — с клавиатурным фокусом он виден; снимаем
    // фокус, и в покое кебаб снова скрыт.
    await closeMenu()
    await expect.poll(opacity).toBe('1')
    ;(document.activeElement as HTMLElement | null)?.blur()
    await parkPointer()
    await expect.poll(opacity).toBe('0')
  })

  test('AM25: кебаб заголовка не гаснет, пока меню закрывается и фокус возвращается на него', async () => {
    const { container } = await renderHeaderMenu()
    const kebab = () =>
      dataHeadCells(container)[0].querySelector<HTMLElement>(KEBAB)!
    const opacity = () =>
      Number(getComputedStyle(kebab().closest('.cell__button')!).opacity)

    await userEvent.hover(dataHeadCells(container)[0])
    await expect.poll(opacity).toBe(1)
    await humanClick(kebab())
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    await userEvent.hover(dataHeadCells(container)[1])

    // Каждый кадр от Escape до возврата фокуса на кебаб и ещё полсекунды после.
    const samples: number[] = []
    let sampling = true
    const sample = () => {
      samples.push(opacity())
      if (sampling) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.activeElement).toBe(kebab())
    await new Promise(resolve => setTimeout(resolve, 500))
    sampling = false

    expect(Math.min(...samples)).toBe(1)
    ;(document.activeElement as HTMLElement | null)?.blur()
    await parkPointer()
    await expect.poll(opacity).toBe(0)
  })

  test('AM27: инлайн-действие с мини-меню не гаснет, пока меню закрывается и фокус возвращается на него', async () => {
    const container = await renderColumnPinning()
    // Закрепление двусторонней колонки — инлайн-кнопка с мини-меню сторон.
    const pin = () =>
      headCellById(container, 'firstName').querySelector<HTMLElement>(
        '.column-pin__button',
      )!
    const opacity = () =>
      Number(getComputedStyle(pin().closest('.cell__button')!).opacity)

    await userEvent.click(await revealPin(headCellById(container, 'firstName')))
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    await userEvent.hover(headCellById(container, 'lastName'))
    await expect.poll(opacity).toBe(1)

    // Каждый кадр от Escape до возврата фокуса на кнопку и ещё полсекунды после.
    const samples: number[] = []
    let sampling = true
    const sample = () => {
      samples.push(opacity())
      if (sampling) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.activeElement).toBe(pin())
    await new Promise(resolve => setTimeout(resolve, 500))
    sampling = false

    expect(Math.min(...samples)).toBe(1)
    ;(document.activeElement as HTMLElement | null)?.blur()
    await parkPointer()
    await expect.poll(opacity).toBe(0)
  })
})

describe('Action menu — row', () => {
  test('AM15: RowAction в actionRowSlot схлопываются в per-row overflow-кебаб', async () => {
    const { container } = await renderRowMenu()

    const cell = container.querySelector<HTMLElement>(ACTION_CELL)!
    const kebab = cell.querySelector<HTMLElement>(ROW_KEBAB)!
    expect(kebab).toBeTruthy()

    await humanClick(kebab)
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    expect(menuItems().map(i => i.textContent?.trim())).toEqual(
      expect.arrayContaining(['Edit', 'Duplicate', 'Delete']),
    )

    await closeMenu()
  })

  test('AM34: три одиночных действия строки — без разделителей; в кебабе заголовка разделитель только у сортировки', async () => {
    const divider = (group: Element) =>
      getComputedStyle(group).borderTopWidth !== '0px'
    const row = await renderRowMenu()
    await humanClick(
      row.container
        .querySelector<HTMLElement>(ACTION_CELL)!
        .querySelector<HTMLElement>(ROW_KEBAB)!,
    )
    await expect.poll(() => menuItems().length).toBe(3)
    const rowGroups = [...document.querySelectorAll('[role="group"]')]
    expect(rowGroups).toHaveLength(3)
    expect(rowGroups.map(divider)).toEqual([false, false, false])
    await closeMenu()
    await row.unmount()

    const header = await renderHeaderMenu()
    await userEvent.click(
      dataHeadCells(header.container)[0].querySelector<HTMLElement>(KEBAB)!,
    )
    await expect.poll(() => menuItems().length).toBeGreaterThan(3)
    const groups = [...document.querySelectorAll('[role="group"]')]
    const sizes = groups.map(
      group => group.querySelectorAll('[role="menuitem"]').length,
    )
    const expected = sizes.map(
      (size, index) => index > 0 && (size > 1 || sizes[index - 1]! > 1),
    )
    expect(sizes).toContain(3)
    expect(groups.map(divider)).toEqual(expected)
    await closeMenu()
  })

  test('AM16: инлайн-действия строки — row__button (ревил по hover строки), не cell__button', async () => {
    const { container } = await renderRowMenu({ enableRowActionMenu: false })

    const cell = container.querySelector<HTMLElement>(ACTION_CELL)!
    expect(cell.querySelectorAll('.row__button').length).toBe(3)
    expect(cell.querySelectorAll('.cell__button').length).toBe(0)
  })

  test('AM19: ширина колонки действий сужается при схлопывании, растёт при инлайне', async () => {
    const view = await renderRowMenu({ enableRowActionMenu: true })
    const cellWidth = () =>
      view.container
        .querySelector<HTMLElement>(ACTION_CELL)!
        .getBoundingClientRect().width

    const collapsed = cellWidth()

    // Тот же инстанс, выключаем меню → инлайн-кнопки → колонка шире.
    view.rerender(<composed.RowActionMenu enableRowActionMenu={false} />)
    await expect.poll(() => cellWidth()).toBeGreaterThan(collapsed)
  })

  test('AM17: row-кебаб скрыт в покое и остаётся видимым при открытом меню', async () => {
    const { container } = await renderRowMenu()

    const cell = container.querySelector<HTMLElement>(ACTION_CELL)!
    const wrap = () => cell.querySelector<HTMLElement>('.row__button')!

    // В покое обёртка скрыта (row__button--hidden), строка не под hover.
    expect(wrap().className).toContain('row__button--hidden')

    // Открываем меню → обёртка теряет --hidden (видима, даже когда курсор в портале).
    await humanClick(cell.querySelector<HTMLElement>(ROW_KEBAB)!)
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    await expect
      .poll(() => wrap().className.includes('row__button--hidden'))
      .toBe(false)

    await closeMenu()
  })

  test('AM26: row-кебаб не гаснет, пока меню закрывается и фокус возвращается на него', async () => {
    const { container } = await renderRowMenu()
    const cells = () =>
      Array.from(container.querySelectorAll<HTMLElement>(ACTION_CELL))
    const kebab = () => cells()[0].querySelector<HTMLElement>(ROW_KEBAB)!
    // Видимость чипа — по прозрачности значка: обёртка чипа не гаснет (ADR 0017, MO5).
    const opacity = () => {
      const color = getComputedStyle(kebab()).color
      const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(color)?.[1]
      return alpha === undefined ? 1 : Number(alpha)
    }

    await humanClick(kebab())
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    // Указатель — вне строки: в другой строке под ним оказалось бы само меню.
    await userEvent.hover(dataHeadCells(container)[1])
    await expect.poll(opacity).toBe(1)

    // Каждый кадр от Escape до возврата фокуса на кебаб и ещё полсекунды после.
    const samples: number[] = []
    let sampling = true
    const sample = () => {
      samples.push(opacity())
      if (sampling) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.activeElement).toBe(kebab())
    await new Promise(resolve => setTimeout(resolve, 500))
    sampling = false

    expect(Math.min(...samples)).toBe(1)
    ;(document.activeElement as HTMLElement | null)?.blur()
    await parkPointer()
    await expect.poll(opacity).toBe(0)
  })
})
