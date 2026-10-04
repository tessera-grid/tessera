import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { Stories, bodyRows, renderGrid } from '../helpers'
import { waitForGrid } from './core-helpers'

// Уровень 1 (ADR 0033): снимки дерева доступности Chromium через CDP — то, что
// браузер отдаёт скринридеру. Каждое требование — свой тест `AX<n>`; снимок
// фильтруется до строк, относящихся к требованию.

const axTree = (
  commands as unknown as {
    axTree: (root?: 'grid' | 'document') => Promise<string>
  }
).axTree

/** Строки снимка, чья роль (первое слово) входит в `roles`. */
const pick = (tree: string, roles: string[]) =>
  tree
    .split('\n')
    .filter(line => roles.includes(line.trim().split(' ')[0]))
    .join('\n')

describe('Дерево доступности (AX)', () => {
  test('AX1: грид с сортировкой и выбором — роли, имена, multiselectable, selected', async () => {
    await renderGrid({
      columnCount: 3,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableColumnSorting: true,
      enableRowSelection: true,
    })
    await waitForGrid()
    await userEvent.click(
      bodyRows()[1].querySelector<HTMLElement>('.row-select-checkbox')!,
    )
    await expect
      .poll(() => bodyRows()[1].getAttribute('aria-selected'))
      .toBe('true')

    expect(await axTree()).toMatchSnapshot()
  })

  test('AX2: treegrid с раскрытой группой — level и expanded у строк', async () => {
    await render(
      <Stories.RowGrouping
        enableKeyboardNavigation
        enableRowExpanding
        initialGrouping={['gender']}
        containerHeight={400}
        height={300}
      />,
    )
    const firstGroup = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-group-row="true"][data-index="0"]',
      )
    await expect.poll(firstGroup).toBeTruthy()
    await userEvent.click(
      firstGroup()!.querySelector<HTMLElement>(
        '.data-grid__body-cell button[aria-label]',
      )!,
    )
    await expect
      .poll(() => firstGroup()!.getAttribute('aria-expanded'))
      .toBe('true')

    // Первые строки тела: группа, её подстроки и следующая группа.
    const rows = pick(await axTree(), ['treegrid', 'row'])
      .split('\n')
      .slice(0, 6)
      .join('\n')
    expect(rows).toMatchSnapshot()
  })

  test('AX3: поле редактора с ошибкой — textbox invalid и alert с текстом', async () => {
    await renderGrid({
      columnCount: 6,
      dataCount: 3,
      enableKeyboardNavigation: true,
      enableCellEditing: true,
      validateCellEdit: (value: string) =>
        /^\d+$/.test(value) ? null : 'Digits only',
    })
    await waitForGrid()
    const age = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-index="0"] .data-grid__body-cell[data-column-id="age"]',
    )!
    age.focus()
    await userEvent.keyboard('{Enter}')
    const input = () =>
      document.querySelector<HTMLInputElement>('.data-grid__body-cell input')
    await expect.poll(input).toBeTruthy()
    await userEvent.clear(input()!)
    await userEvent.type(input()!, 'x{Enter}')
    await expect.poll(() => input()?.getAttribute('aria-invalid')).toBe('true')

    expect(pick(await axTree(), ['textbox', 'alert'])).toMatchSnapshot()
  })

  test('AX4: загрузка — корень busy, progressbar "Loading"', async () => {
    await renderGrid({ columnCount: 3, dataCount: 3, enableLoading: true })
    await waitForGrid()

    expect(
      pick(await axTree('document'), ['table', 'progressbar']),
    ).toMatchSnapshot()
  })

  test('AX5: скелет первой загрузки — нет таблицы, есть status "Loading"', async () => {
    await renderGrid({ columnCount: 3, dataCount: 3, enableSkeleton: true })
    await expect
      .poll(() => document.querySelector('.data-grid__body--skeleton'))
      .toBeTruthy()

    expect(
      pick(await axTree('document'), ['table', 'grid', 'status']),
    ).toMatchSnapshot()
  })

  test('AX6: служебные колонки и футер — именованные заголовки, строка футера из gridcell', async () => {
    await renderGrid({
      columnCount: 2,
      dataCount: 2,
      enableKeyboardNavigation: true,
      enableRowExpanding: true,
      // Колонка раскрытия нужна и на плоских данных (ADR 0050).
      rowExpandingColumn: 'always',
      enableRowDragging: true,
      enableRowActions: true,
      enableFooter: true,
    })
    await waitForGrid()

    const tree = await axTree()
    const lines = tree.split('\n')
    const headers = pick(tree, ['columnheader'])
    // Строка футера — последняя строка дерева с её ячейками.
    const lastRow = lines.map(l => l.trim().split(' ')[0]).lastIndexOf('row')
    expect(`${headers}\n${lines.slice(lastRow).join('\n')}`).toMatchSnapshot()
  })

  test('AX7: без keyboardNavigation — table/cell без gridcell и multiselectable', async () => {
    await renderGrid({ columnCount: 2, dataCount: 2, enableRowSelection: true })
    await waitForGrid()

    const tree = await axTree()
    expect(tree).not.toMatch(/gridcell|multiselectable/)
    expect(tree).toMatchSnapshot()
  })
})
