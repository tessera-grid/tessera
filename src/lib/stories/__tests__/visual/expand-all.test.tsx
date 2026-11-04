import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'
import type { SVGProps } from 'react'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { rowExpanding } from '../../../plugins'
import { tableLabels } from '../labels'
import { rowExpandingLabels } from '../../../plugins/rowExpanding/labels'

// «Раскрыть всё» кнопкой в шапке колонки раскрытия (ADR 0160): ленивые строки окна грузят
// детей по нажатию и при прокрутке (EA3), имя, подсказка, мышь, клавиатура, словарь и
// значки (EA4).

interface Item {
  id: string
  name: string
  subRows?: Item[]
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const BUTTON = '.row-expand-all-button'
const ROOTS = 60

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const button = () => document.querySelector<HTMLElement>(BUTTON)
const container = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

/** Открыт ли тултип с этим текстом. */
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )

describe('«Раскрыть всё» кнопкой в шапке (ADR 0160)', () => {
  test('EA3: клиентское ленивое дерево — нажатие кнопки запрашивает детей у ленивых строк в окне, прокрутка — у пришедших; программное expanded: true загрузку не начинает', async () => {
    const asked: string[] = []
    const roots: Item[] = Array.from({ length: ROOTS }, (_, i) => ({
      id: `r${i}`,
      name: `Root ${i}`,
    }))
    const Grid = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: roots,
        getRowId: (row: Item) => row.id,
        plugins: [
          rowExpanding({
            initialExpanded: true,
            hasChildren: () => true,
            loadChildren: (row: { id: string }) => {
              asked.push(row.id)
              return [{ id: `${row.id}.0`, name: `Child of ${row.id}` }]
            },
          } as never),
        ] as never,
      })
      return (
        <div style={{ width: 360, height: 320 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<Grid />)
    try {
      await expect.poll(() => rowOf('r3')).not.toBeNull()
      for (let i = 0; i < 4; i++) await nextFrame()
      // `expanded: true` приложения — без загрузки.
      expect(asked).toEqual([])

      await userEvent.click(button()!)
      await expect.poll(() => rowOf('r0.0')).not.toBeNull()
      const shown = asked.length
      expect(shown).toBeGreaterThan(0)
      expect(asked).not.toContain(`r${ROOTS - 1}`)
      // Только строки окна: прочие корни детей не просили.
      expect(shown).toBeLessThan(ROOTS / 2)

      // Прокрутка к концу — запрашивают пришедшие.
      container().scrollTop = container().scrollHeight
      await expect.poll(() => asked).toContain(`r${ROOTS - 1}`)
      // Пришедшие строки раскрылись и удлинили список — снова к концу.
      await expect
        .poll(() => {
          container().scrollTop = container().scrollHeight
          return rowOf(`r${ROOTS - 1}.0`)
        })
        .not.toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('EA4: кнопка в шапке колонки раскрытия — «Раскрыть всё», если есть свёрнутые, иначе «Свернуть всё»; имя и тултип по состоянию; мышь и клавиатура; подписи — словарь, значки — icons', async () => {
    const data: Item[] = [
      {
        id: 'a',
        name: 'A',
        subRows: [
          { id: 'a1', name: 'A1', subRows: [{ id: 'a11', name: 'A11' }] },
        ],
      },
      { id: 'b', name: 'B', subRows: [{ id: 'b1', name: 'B1' }] },
      { id: 'c', name: 'C' },
    ]
    const ExpandAllIcon = (props: SVGProps<SVGSVGElement>) => (
      <svg data-testid="own-expand-all" {...props} />
    )
    const Grid = ({ own = false }: { own?: boolean }) => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data,
        getRowId: (row: Item) => row.id,
        getSubRows: (row: Item) => row.subRows,
        plugins: [rowExpanding({ maxDepth: 2 })] as never,
      } as never)
      return (
        <div style={{ width: 360, height: 320 }}>
          <DataGrid
            table={table as never}
            {...(own && {
              localization: {
                'rowExpanding.expandAll': 'Open everything',
                'rowExpanding.collapseAll': 'Close everything',
              } as never,
              icons: { expandAll: ExpandAllIcon } as never,
            })}
          />
        </div>
      )
    }

    const screen = await render(<Grid />)
    try {
      await expect.poll(button).not.toBeNull()
      expect(button()).toHaveAccessibleName(
        rowExpandingLabels(tableLabels).expandAll,
      )
      // Мышь: раскрыто всё на всех уровнях, имя и тултип — «Свернуть всё».
      await userEvent.click(button()!)
      await expect.poll(() => rowOf('a11')).not.toBeNull()
      expect(rowOf('b1')).not.toBeNull()
      expect(button()).toHaveAccessibleName(
        rowExpandingLabels(tableLabels).collapseAll,
      )
      // Указатель уже над кнопкой после нажатия: уводим и наводим снова.
      await userEvent.hover(rowOf('c')!)
      await userEvent.hover(button()!)
      await expect
        .poll(tooltipShown(rowExpandingLabels(tableLabels).collapseAll))
        .toBe(true)

      // Свёрнута одна строка — снова «Раскрыть всё».
      await userEvent.click(
        rowOf('b')!.querySelector<HTMLElement>('.row-expand-button')!,
      )
      await expect.poll(() => rowOf('b1')).toBeNull()
      expect(button()).toHaveAccessibleName(
        rowExpandingLabels(tableLabels).expandAll,
      )

      // Клавиатура: Enter на кнопке раскрывает всё, ещё раз — сворачивает всё.
      button()!.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => rowOf('b1')).not.toBeNull()
      expect(button()).toHaveAccessibleName(
        rowExpandingLabels(tableLabels).collapseAll,
      )
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => rowOf('a1')).toBeNull()
      expect(rowOf('b1')).toBeNull()
      expect(button()).toHaveAccessibleName(
        rowExpandingLabels(tableLabels).expandAll,
      )
    } finally {
      await screen.unmount()
    }

    // Подписи — из словаря, значок — из icons.
    const own = await render(<Grid own />)
    try {
      await expect.poll(button).not.toBeNull()
      expect(button()).toHaveAccessibleName('Open everything')
      expect(
        button()!.querySelector('[data-testid="own-expand-all"]'),
      ).not.toBeNull()
      await userEvent.click(button()!)
      await expect
        .poll(() => button()?.getAttribute('aria-label'))
        .toBe('Close everything')
    } finally {
      await own.unmount()
    }
  })
})
