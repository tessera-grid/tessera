import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'
import { composed } from '../stories'
import { STATUS_OPTIONS } from '../../__mocks__/filteringData'

// Сортировка колонок с вариантами по подписи (ADR 0063, OS8–OS9): настоящий клик по
// кнопке сортировки заголовка, порядок читается из DOM строк по `aria-rowindex`.

const collator = new Intl.Collator()

type StoryArgs = Partial<
  Parameters<typeof composed.ColumnSortingOptionLabels>[0]
>

const renderStory = async (args: StoryArgs = {}) => {
  const { container } = await render(
    <composed.ColumnSortingOptionLabels {...args} />,
  )
  await expect
    .poll(() => container.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  return container
}

const sortBy = async (container: HTMLElement, columnId: string) => {
  const button = container.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"] .column-sort__button`,
  )!
  await humanClick(button)
}

/** Строки в порядке экрана. */
const rowsInOrder = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>('.data-grid__body-row'),
  ).sort(
    (a, b) =>
      Number(a.getAttribute('aria-rowindex')) -
      Number(b.getAttribute('aria-rowindex')),
  )

const cellTexts = (container: HTMLElement, columnId: string) =>
  rowsInOrder(container).map(
    row =>
      row
        .querySelector(`.data-grid__body-cell[data-column-id="${columnId}"]`)
        ?.textContent?.trim() ?? '',
  )

describe('Сортировка по подписи', () => {
  test('OS8: клик по заголовку колонки lookup упорядочивает строки по подписи', async () => {
    const container = await renderStory()
    const before = cellTexts(container, 'managerId').filter(Boolean)
    // Защита: до сортировки имена не идут по алфавиту — иначе требование не доказать.
    expect(before).not.toEqual([...before].sort(collator.compare))

    await sortBy(container, 'managerId')
    await expect
      .poll(() => {
        const names = cellTexts(container, 'managerId').filter(Boolean)
        const asc = [...names].sort(collator.compare)
        return (
          names.join('|') === asc.join('|') ||
          names.join('|') === [...asc].reverse().join('|')
        )
      })
      .toBe(true)
    const names = cellTexts(container, 'managerId').filter(Boolean)
    expect(new Set(names).size).toBeGreaterThan(1)
  })

  test('OS9: группировка по колонке с вариантами и сортировка по ней упорядочивают строки-группы по подписи', async () => {
    const container = await renderStory({
      enableGrouping: true,
      initialGrouping: ['status'],
    })
    const groupLabels = () =>
      rowsInOrder(container)
        .filter(row => row.getAttribute('data-group-row') === 'true')
        .map(row => {
          const text = row.textContent ?? ''
          return STATUS_OPTIONS.find(option => text.includes(option.label))
            ?.label
        })
        .filter(Boolean)
    await expect.poll(() => groupLabels().length).toBeGreaterThan(2)

    await sortBy(container, 'status')
    const order = STATUS_OPTIONS.map(option => option.label)
    await expect
      .poll(() => {
        const labels = groupLabels() as string[]
        const asc = order.filter(label => labels.includes(label))
        return (
          labels.join('|') === asc.join('|') ||
          labels.join('|') === [...asc].reverse().join('|')
        )
      })
      .toBe(true)
  })
})
