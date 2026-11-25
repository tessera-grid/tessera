import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  type DemoStoryStep,
  DemoStory,
  guideArgs,
  stepAction,
} from '../../demos/DemoStory'
import { pollUntil, settle, until } from '../../__mocks__/catalogPlay'
import { tapButton } from '../../__mocks__/touchGuides'
import { both } from '../storyText.helpers'

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const stepButton = (index: number) =>
  document.querySelector<HTMLButtonElement>(`[data-step-button="${index}"]`)!
const guideRoot = () =>
  document.querySelector<HTMLElement>('[data-guide-root]')!
const cellAt = (root: ParentNode, index: number) =>
  root.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="firstName"]`,
  )
const clickCell = async (index: number) => {
  const cell = cellAt(document, index)!
  cell.setAttribute('data-testid', 'guide-atomic-cell')
  try {
    await page.getByTestId('guide-atomic-cell').click()
  } finally {
    cell.removeAttribute('data-testid')
  }
}
const replayDone = () =>
  expect
    .poll(() => guideRoot().hasAttribute('data-guide-replaying'))
    .toBe(false)
const args = () =>
  guideArgs(
    { dataCount: 20, height: 320 },
    { colorMode: 'light', locale: 'en' },
  )

const watchRings = () => {
  let count = 0
  const observer = new MutationObserver(records => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (
          node.nodeType === 1 &&
          (node as Element).hasAttribute('data-guide-click')
        )
          count++
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return { count: () => count, stop: () => observer.disconnect() }
}

describe('атомарные шаги гайда (ADR 0117)', () => {
  test('SN75: atomicSteps не меняет прежние гайды; последовательный шаг выполняет только своё действие, прямой переход, откат и восстановление молча проходят предыдущие и показывают только целевой', async () => {
    const runs = { first: 0, second: 0 }
    const steps: readonly DemoStoryStep[] = [
      { title: both('В покое'), hint: both('Действия нет.') },
      {
        title: both('Первое касание'),
        hint: both('Коснулись первой ячейки.'),
        enter: stepAction(async (root, { signal }) => {
          await pollUntil(() => !!cellAt(root, 1), signal)
          runs.first++
          tapButton(cellAt(root, 1))
        }),
      },
      {
        title: both('Второе касание'),
        hint: both('Коснулись второй ячейки.'),
        enter: stepAction(async (root, { signal }) => {
          await pollUntil(() => !!cellAt(root, 4), signal)
          runs.second++
          tapButton(cellAt(root, 4))
        }),
      },
    ]
    const mount = (atomicSteps: boolean) =>
      render(
        <DemoStory
          title={both('Атомарные касания')}
          steps={steps}
          args={args()}
          showActions
          atomicSteps={atomicSteps}
        />,
      )
    const rings = watchRings()
    let screen = await mount(true)
    try {
      await expect.poll(() => cellAt(document, 1)).not.toBeNull()
      await settle()
      await userEvent.click(byId('guide-toggle'))
      await userEvent.click(byId('guide-next'))
      await expect.poll(() => runs.first).toBe(1)
      expect(runs.second).toBe(0)
      await expect.poll(rings.count).toBeGreaterThan(0)
      const perTap = rings.count()
      const sequential = cellAt(document, 1)!.hasAttribute('data-touched')

      await userEvent.click(byId('guide-next'))
      await expect.poll(() => runs.second).toBe(1)
      expect(runs.first).toBe(1)
      await expect.poll(rings.count).toBe(perTap * 2)
      expect(cellAt(document, 1)!.hasAttribute('data-touched')).toBe(false)
      expect(cellAt(document, 4)!.hasAttribute('data-touched')).toBe(true)
      expect(sequential).toBe(true)
      await screen.unmount()

      runs.first = 0
      runs.second = 0
      screen = await mount(true)
      await expect.poll(() => cellAt(document, 1)).not.toBeNull()
      await settle()
      await userEvent.click(byId('guide-toggle'))
      const beforeDirect = rings.count()
      await userEvent.click(stepButton(2))
      await expect.poll(() => runs.second).toBe(1)
      await replayDone()
      expect(runs.first).toBe(1)
      await expect.poll(() => rings.count() - beforeDirect).toBe(perTap)
      expect(cellAt(document, 1)!.hasAttribute('data-touched')).toBe(false)
      expect(cellAt(document, 4)!.hasAttribute('data-touched')).toBe(true)

      const beforeBack = rings.count()
      await userEvent.click(byId('guide-back'))
      await until(() =>
        expect(guideRoot()).toHaveAttribute('data-step-action', 'done:1'),
      )
      await replayDone()
      expect(runs.first).toBe(2)
      expect(runs.second).toBe(1)
      await expect.poll(() => rings.count() - beforeBack).toBe(perTap)
      expect(cellAt(document, 1)!.hasAttribute('data-touched')).toBe(true)

      await userEvent.click(cellAt(document, 4)!)
      await expect
        .poll(() => document.querySelector('[data-testid="guide-changed"]'))
        .not.toBeNull()
      const beforeRestore = rings.count()
      await userEvent.click(byId('guide-next'))
      await until(() =>
        expect(guideRoot()).toHaveAttribute('data-step-action', 'done:2'),
      )
      await replayDone()
      expect(runs.first).toBe(3)
      expect(runs.second).toBe(2)
      await expect.poll(() => rings.count() - beforeRestore).toBe(perTap)
      expect(cellAt(document, 4)!.hasAttribute('data-touched')).toBe(true)
      await screen.unmount()

      runs.first = 0
      runs.second = 0
      screen = await mount(false)
      await expect.poll(() => cellAt(document, 1)).not.toBeNull()
      await settle()
      await userEvent.click(byId('guide-toggle'))
      await userEvent.click(stepButton(2))
      await expect.poll(() => runs.second).toBe(1)
      expect(runs.first).toBe(0)
      expect(cellAt(document, 4)!.hasAttribute('data-touched')).toBe(true)
    } finally {
      rings.stop()
      await screen.unmount()
    }
  })

  test('SN76: восстановление ждёт stepAction, применяет пропсы и remount по порядку, блокирует ввод и переходы, а «Сначала» отменяет его', async () => {
    const gate = { release: false }
    const runs = {
      firstStarted: 0,
      firstDone: 0,
      second: 0,
      resets: 0,
      firstRows: '',
      secondRows: '',
    }
    const rowCount = (root: ParentNode) =>
      root.querySelector('[role="table"]')?.getAttribute('aria-rowcount') ?? ''
    const steps: readonly DemoStoryStep[] = [
      { title: both('В покое'), hint: both('Действия нет.') },
      {
        title: both('Двадцать строк'),
        hint: both('Асинхронный шаг.'),
        props: () => ({ dataCount: 20 }),
        enter: stepAction(async (root, { signal }) => {
          runs.firstStarted++
          await pollUntil(() => gate.release, signal, 60_000)
          runs.firstRows = rowCount(root)
          runs.firstDone++
        }),
      },
      {
        title: both('Сорок строк'),
        hint: both('Шаг открывает таблицу заново.'),
        props: () => ({ dataCount: 40 }),
        remount: true,
        enter: stepAction(async (root, { signal }) => {
          await pollUntil(() => rowCount(root) === '41', signal)
          runs.secondRows = rowCount(root)
          runs.second++
        }),
      },
    ]
    const screen = await render(
      <DemoStory
        title={both('Ожидание восстановления')}
        steps={steps}
        args={args()}
        atomicSteps
        reset={() => {
          runs.resets++
        }}
      />,
    )
    try {
      await expect.poll(() => cellAt(document, 1)).not.toBeNull()
      await settle()
      await userEvent.click(byId('guide-toggle'))
      await userEvent.click(stepButton(2))
      await expect.poll(() => runs.firstStarted).toBe(1)
      expect(runs.second).toBe(0)
      expect(stepButton(2).parentElement).toHaveAttribute(
        'aria-current',
        'step',
      )
      expect(guideRoot()).toHaveAttribute('data-guide-replaying', '')

      await clickCell(1)
      expect(document.querySelector('[data-testid="guide-changed"]')).toBeNull()
      expect(runs.second).toBe(0)

      expect(stepButton(1).disabled).toBe(true)
      stepButton(1).click()
      expect(runs.firstStarted).toBe(1)
      await userEvent.click(byId('guide-restart'))
      await expect.poll(() => stepButton(1).disabled).toBe(false)
      await userEvent.click(stepButton(1))
      await expect.poll(() => runs.firstStarted).toBe(2)
      expect(runs.firstDone).toBe(0)
      expect(runs.second).toBe(0)
      gate.release = true
      await expect.poll(() => runs.firstDone).toBe(1)
      await replayDone()
      expect(runs.firstRows).toBe('21')
      expect(runs.second).toBe(0)

      await clickCell(1)
      await expect
        .poll(() => document.querySelector('[data-testid="guide-changed"]'))
        .not.toBeNull()
      gate.release = false
      const before = runs.resets
      await userEvent.click(stepButton(2))
      await expect.poll(() => runs.firstStarted).toBe(3)
      gate.release = true
      await expect.poll(() => runs.second).toBe(1)
      await replayDone()
      expect(runs.firstDone).toBe(2)
      expect(runs.secondRows).toBe('41')
      expect(runs.resets).toBe(before + 2)
    } finally {
      gate.release = true
      await screen.unmount()
    }
  })
})
