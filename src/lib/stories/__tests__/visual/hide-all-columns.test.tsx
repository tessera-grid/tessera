import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import axe from 'axe-core'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering, columnVisibility } from '../../../plugins'
import { Stories, humanClick, revealCellButtons } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { tableLabels } from '../labels'

// Скрытие всех колонок и корень «Все колонки» меню (ADR 0133, HA1–HA3, HA6–HA7, HA9,
// HA11–HA12).
// Модель корня (HA4–HA5) — модульный `columnVisibility`, подписи (HA8) — `localization`.

const columnsOf = (ids: string[], locked: string[] = []) =>
  ids.map(id => ({
    id,
    accessorKey: id,
    header: id.toUpperCase(),
    ...(locked.includes(id) ? { enableHiding: false } : {}),
  }))
const rowOf = (ids: string[]) => [
  { id: '1', ...Object.fromEntries(ids.map(id => [id, id])) },
]

const grid = (ids: string[], args: Record<string, unknown> = {}) => (
  <Stories.ColumnVisibilityPlayground
    containerHeight={600}
    height={500}
    columnsOverride={columnsOf(ids, args.locked as string[] | undefined)}
    dataOverride={rowOf(ids)}
    {...args}
  />
)

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const button = () => byTestId('column-visibility-button')
const menu = () => byTestId('column-visibility-menu')
const root = () =>
  byTestId('column-visibility-all')?.querySelector<HTMLElement>(
    '[role="checkbox"]',
  ) ?? null
const checkbox = (id: string) =>
  menu()!.querySelector<HTMLElement>(
    `[data-column-id="${id}"] [role="checkbox"]`,
  )!
const headIds = () =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__head-cell')]
    .map(cell => cell.getAttribute('data-column-id'))
    // Служебные колонки (выбор строк) в меню не попадают и видны всегда.
    .filter(id => id && !id.startsWith('actionColumn'))
const stub = () => byTestId('columns-hidden-stub')
const count = () => byTestId('column-visibility-count')?.textContent

const mount = async (node: Parameters<typeof render>[0]) => {
  const result = await render(node)
  // Поповер грузится лениво: ждём настоящий триггер Base UI.
  await expect
    .poll(() => button()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)
  return result
}

const openMenu = async () => {
  await userEvent.click(button()!)
  await expect.poll(() => menu()?.hasAttribute('data-open')).toBe(true)
  await Promise.all(
    menu()!
      .getAnimations({ subtree: true })
      .map(animation => animation.finished.catch(() => undefined)),
  )
}

const KEBAB = `[aria-label="${tableLabels.headerMenu}"]`
const kebabOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"] ${KEBAB}`,
  )
const hideFromKebab = async (id: string) => {
  await revealCellButtons(kebabOf(id)!.closest('.data-grid__head-cell')!)
  await userEvent.click(kebabOf(id)!)
  const item = () =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      each => each.textContent?.trim() === tableLabels.hideColumn,
    )
  await expect.poll(item).toBeTruthy()
  await userEvent.click(item()!)
}

describe('Скрытие всех колонок', () => {
  test('HA1: последнюю видимую колонку можно скрыть галочкой меню и пунктом «Скрыть колонку» в кебабе заголовка; колонки с enableHiding: false не скрываются', async () => {
    const view = await mount(grid(['a', 'b', 'locked'], { locked: ['locked'] }))
    await openMenu()
    expect(checkbox('locked').hasAttribute('data-disabled')).toBe(true)
    await userEvent.click(checkbox('a'))
    // «b» — последняя видимая скрываемая, «locked» видна: галочка «b» доступна.
    expect(checkbox('b').hasAttribute('data-disabled')).toBe(false)
    await userEvent.click(checkbox('b'))
    await expect.poll(headIds).toEqual(['locked'])
    await view.unmount()

    const only = await mount(grid(['a', 'b']))
    await openMenu()
    await userEvent.click(checkbox('a'))
    await userEvent.click(checkbox('b'))
    await expect.poll(stub).not.toBeNull()
    expect(headIds()).toEqual([])
    await only.unmount()

    await mount(grid(['only'], { enableHeaderActionMenu: true }))
    await hideFromKebab('only')
    await expect.poll(stub).not.toBeNull()
    expect(headIds()).toEqual([])
  })

  test('HA2: корень «Все колонки» над деревом не прокручивается, колонки под ним — уровнем ниже; три состояния, пустой и промежуточный показывают все, отмеченный скрывает все', async () => {
    const ids = Array.from({ length: 30 }, (_, index) => `c${index}`)
    await mount(grid(ids))
    await openMenu()
    const scroller = menu()!.querySelector<HTMLElement>('ul')!.parentElement!
    expect(scroller.contains(root())).toBe(false)
    expect(
      root()!.compareDocumentPosition(scroller) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Шаг уровня — поворот (10px), зазор до галочки (12px) и полгалочки (8px).
    const rootLeft = root()!.getBoundingClientRect().left
    expect(checkbox('c0').getBoundingClientRect().left - rootLeft).toBeCloseTo(
      30,
      0,
    )
    const rootTop = root()!.getBoundingClientRect().top
    scroller.scrollTop = scroller.scrollHeight
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
    expect(root()!.getBoundingClientRect().top).toBe(rootTop)
    scroller.scrollTop = 0

    expect(root()!.getAttribute('aria-checked')).toBe('true')
    await userEvent.click(root()!)
    await expect.poll(stub).not.toBeNull()
    expect(root()!.getAttribute('aria-checked')).toBe('false')

    await userEvent.click(root()!)
    await expect.poll(() => headIds().length).toBeGreaterThan(0)
    expect(root()!.getAttribute('aria-checked')).toBe('true')

    await userEvent.click(checkbox('c0'))
    await expect.poll(() => root()!.getAttribute('aria-checked')).toBe('mixed')
    await userEvent.click(root()!)
    await expect.poll(() => root()!.getAttribute('aria-checked')).toBe('true')
    await expect.poll(headIds).toContain('c0')
  })

  test('HA3: корень доступен с клавиатуры — Tab из поиска, пробел переключает; в промежуточном состоянии aria-checked="mixed"', async () => {
    await mount(grid(['a', 'b', 'c']))
    await openMenu()
    const search = menu()!.querySelector<HTMLInputElement>('input')!
    search.focus()
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(root())
    await userEvent.keyboard(' ')
    await expect.poll(stub).not.toBeNull()
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(checkbox('a'))
    await userEvent.keyboard(' ')
    await expect.poll(() => root()!.getAttribute('aria-checked')).toBe('mixed')
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await userEvent.keyboard(' ')
    await expect.poll(headIds).toEqual(['a', 'b', 'c'])
  })

  test('HA6: в подвале меню — «Выбрано N колонок» и «Сбросить», без «Показать все»; N — видимые колонки всей таблицы, поиск его не меняет', async () => {
    await mount(grid(['a', 'b', 'c', 'locked'], { locked: ['locked'] }))
    await openMenu()
    expect(count()).toBe(tableLabels.selectedColumns(4))
    const footerButtons = () =>
      [...menu()!.querySelectorAll('button')].map(each => each.textContent)
    expect(footerButtons()).toEqual([tableLabels.resetColumns])

    await userEvent.click(checkbox('a'))
    await expect.poll(count).toBe(tableLabels.selectedColumns(3))
    await userEvent.type(menu()!.querySelector('input')!, 'b')
    await expect
      .poll(() => menu()!.querySelectorAll('[data-column-id]').length)
      .toBe(1)
    expect(count()).toBe(tableLabels.selectedColumns(3))
    await userEvent.clear(menu()!.querySelector('input')!)
    // Промежуточный корень показывает все, отмеченный — скрывает все, кроме защищённой.
    await userEvent.click(root()!)
    await expect.poll(count).toBe(tableLabels.selectedColumns(4))
    await userEvent.click(root()!)
    await expect.poll(count).toBe(tableLabels.selectedColumns(1))
  })

  test('HA7: скрыта последняя колонка — заглушка «все колонки скрыты»; после кебаба заголовка фокус на её кнопке', async () => {
    await mount(grid(['a'], { enableHeaderActionMenu: true }))
    await hideFromKebab('a')
    await expect.poll(stub).not.toBeNull()
    await expect
      .poll(() => document.activeElement)
      .toBe(byTestId('columns-hidden-show-all'))
  })

  test('HA9: корень и подпись счётчика проходят axe с контрастом в обеих темах', async () => {
    await mount(grid(['a', 'b', 'c']))
    await openMenu()
    await userEvent.click(checkbox('a'))
    await expect.poll(() => root()!.getAttribute('aria-checked')).toBe('mixed')
    await inBothThemes(async () => {
      const { violations } = await axe.run(
        {
          include: [
            byTestId('column-visibility-all')!,
            byTestId('column-visibility-count')!,
          ],
        },
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
    })
  })

  test('HA11: меню «Колонки», сводка «Фильтры» и панель вариантов фильтра — шириной --tsr-comp-column-menu-width, по умолчанию равной пределу меню --tsr-comp-popup-max-width', async () => {
    await render(<FilteringHost />)
    await expect
      .poll(() => button()?.hasAttribute('data-base-ui-click-trigger'))
      .toBe(true)
    // Предел меню, вычисленный браузером в теме грида.
    const probe = document.createElement('div')
    probe.style.width = 'var(--tsr-comp-popup-max-width)'
    document.querySelector('.data-grid-theme')!.append(probe)
    const limit = getComputedStyle(probe).width
    probe.remove()
    expect(limit).toBe('320px')
    const widthOf = (id: string) => getComputedStyle(byTestId(id)!).width

    await openMenu()
    expect(widthOf('column-visibility-menu')).toBe(limit)
    await userEvent.keyboard('{Escape}')
    await expect.poll(menu).toBeNull()

    const status = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="status"]',
    )!
    await userEvent.hover(status)
    await humanClick(
      status.querySelector<HTMLElement>('.column-filter__button')!,
    )
    await expect.poll(() => byTestId('filter-panel')).not.toBeNull()
    expect(widthOf('filter-panel')).toBe(limit)
    await userEvent.click(
      byTestId('filter-panel')!.querySelector<HTMLElement>(
        '[role="checkbox"]',
      )!,
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => byTestId('filter-panel')).toBeNull()

    await expect
      .poll(() =>
        byTestId('filter-summary-button')!.getAttribute('aria-disabled'),
      )
      .not.toBe('true')
    await humanClick(byTestId('filter-summary-button')!)
    await expect.poll(() => byTestId('filter-summary')).not.toBeNull()
    expect(widthOf('filter-summary')).toBe(limit)
  })

  test('HA12: дерево меню — линиями дерева таблицы: ветки от флажка всех колонок и от групп, вертикаль уровня под центром галочки родителя, поворот, скругление и зазор до галочки как у дерева строк', async () => {
    await mount(
      <Stories.ColumnVisibilityPlayground
        containerHeight={600}
        height={500}
        headerNesting="nested"
        enableRowSelection={false}
      />,
    )
    await openMenu()
    const partsOf = (row: Element) =>
      [...row.querySelectorAll<HTMLElement>('[aria-hidden] > span')].map(
        part => ({
          kind: /joinedElbow/i.test(part.className)
            ? 'joined'
            : /elbow/i.test(part.className)
              ? 'elbow'
              : /stub/i.test(part.className)
                ? 'stub'
                : 'rail',
          // Вертикаль — левая рамка части: её середина.
          x:
            part.getBoundingClientRect().left +
            parseFloat(getComputedStyle(part).borderLeftWidth) / 2,
        }),
      )
    const centerOf = (box: HTMLElement) => {
      const rect = box.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    const rowOf = (id: string) =>
      menu()!.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!

    // Корень: отросток к первому уровню под своей галочкой.
    const rootParts = partsOf(byTestId('column-visibility-all')!)
    expect(rootParts.map(part => part.kind)).toEqual(['stub'])
    expect(rootParts[0]!.x).toBeCloseTo(centerOf(root()!), 0)

    // Группа «name» — не последняя на первом уровне: поворот на сквозной линии корня и
    // отросток к своим колонкам под своей галочкой.
    const group = partsOf(rowOf('name'))
    expect(group.map(part => part.kind)).toEqual(['joined', 'rail', 'stub'])
    expect(group[0]!.x).toBeCloseTo(centerOf(root()!), 0)
    expect(group[2]!.x).toBeCloseTo(centerOf(checkbox('name')), 0)

    // Последняя колонка группы: сквозная линия корня и поворот от группы.
    const last = partsOf(rowOf('lastName'))
    expect(last.map(part => part.kind)).toEqual(['rail', 'elbow'])
    expect(last[0]!.x).toBeCloseTo(centerOf(root()!), 0)
    expect(last[1]!.x).toBeCloseTo(centerOf(checkbox('name')), 0)
    expect(
      checkbox('lastName').getBoundingClientRect().left -
        checkbox('name').getBoundingClientRect().left,
    ).toBeCloseTo(30, 0)
    // Поворот, скругление и зазор до галочки — как у дерева строк.
    const elbow = [
      ...rowOf('lastName').querySelectorAll<HTMLElement>(
        '[aria-hidden] > span',
      ),
    ].find(part => /elbow/i.test(part.className))!
    const elbowBox = elbow.getBoundingClientRect()
    expect(elbowBox.width).toBeCloseTo(10.75, 1)
    expect(getComputedStyle(elbow).borderBottomLeftRadius).toBe('9px')
    expect(
      checkbox('lastName').getBoundingClientRect().left - elbowBox.right,
    ).toBeCloseTo(12, 0)

    // Последний узел первого уровня — простой поворот без сквозной линии корня.
    const topLevel = [
      ...menu()!.querySelectorAll<HTMLElement>('[data-column-id]'),
    ].filter(row => {
      const parts = partsOf(row)
      return parts.length > 0 && parts[0]!.kind !== 'rail'
    })
    expect(partsOf(topLevel.at(-1)!)[0]!.kind).toBe('elbow')
  })
})

const FILTERING_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'status', accessorKey: 'status', header: 'Status', filter: 'select' },
]
const FILTERING_DATA = [
  { id: '1', name: 'A', status: 'open' },
  { id: '2', name: 'B', status: 'closed' },
]
const FILTERING_PLUGINS = [columnFiltering(), columnVisibility()]

/** Таблица с тремя панелями со списком: «Колонки», «Фильтры» и чек-лист вариантов. */
const FilteringHost = () => {
  const table = useCreateTable({
    columns: FILTERING_COLUMNS as never,
    data: FILTERING_DATA,
    enableToolbar: true,
    plugins: FILTERING_PLUGINS,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid table={table} />
    </div>
  )
}
