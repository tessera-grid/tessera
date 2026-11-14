import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnSorting,
  editHistory,
  failureLog,
  unsavedChanges,
} from '../../../plugins'
import { Bubble } from '../../../ui/Bubble'
import { PopupEntry } from '../../../ui/Popup/PopupEntry'
import { PopupItem } from '../../../ui/Popup/PopupItem'
import { cellEditingLabels } from '../../../plugins/cellEditing/labels'
import { editHistoryLabels } from '../../../plugins/editHistory/labels'
import { failureLogLabels } from '../../../plugins/failureLog/labels'
import { unsavedChangesLabels } from '../../../plugins/unsavedChanges/labels'
import { humanClick } from '../helpers'
import { tableLabels } from '../labels'
import { openSettingsSection } from '../viewSettings'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forcedColors: (active: boolean) => Promise<void>
  }
}

// Подсказки цветных точек (ADR 0224; MH1–MH2, MH4–MH6): точка записи поповера и пункта списка
// объясняется подсказкой по наведению. MH3 — в `touch`, MH7 — перф в `interaction`.

const HINT = 'What the dot means'

/** Облачко и пункт кита с подсказкой точки и без неё. */
const Kit = ({
  onShow,
  onPress,
}: {
  onShow: () => void
  onPress: () => void
}) => (
  <div
    className="data-grid-theme"
    style={{
      width: 320,
      display: 'grid',
      gap: 8,
      padding: 16,
      background: 'var(--tsr-comp-popup-bg)',
    }}
  >
    <div data-testid="entry">
      <PopupEntry
        mark={<Bubble size="dot" tone="draft" />}
        markHint={HINT}
        label="Price · row 3"
        onShow={onShow}
      >
        Server said no
      </PopupEntry>
    </div>
    <div data-testid="plain-entry">
      <PopupEntry mark={<Bubble size="dot" tone="draft" />} label="Price" />
    </div>
    <PopupItem
      render={<button type="button" />}
      data-testid="item"
      icon={<Bubble size="dot" tone="active" />}
      iconHint={HINT}
      label="Paste"
      caption="3 cells"
      onClick={onPress}
    />
    <PopupItem
      render={<button type="button" />}
      data-testid="plain-item"
      icon={<Bubble size="dot" tone="active" />}
      label="Paste"
    />
  </div>
)

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const stripOf = (entry: HTMLElement) =>
  entry.querySelector<HTMLElement>('[data-popup-entry-mark-hint]')
const iconOf = (item: HTMLElement) =>
  item.querySelector<HTMLElement>('[data-popup-item-icon]')!
const tooltipShown = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )
const tooltipGone = () =>
  ![...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === HINT,
  )
const hoverAt = async (target: HTMLElement, x: number, y: number) => {
  const box = target.getBoundingClientRect()
  await userEvent.hover(target, {
    position: { x: x, y: Math.min(y, box.height - 1) },
  })
}

const mountKit = async () => {
  const onShow = vi.fn()
  const onPress = vi.fn()
  const screen = await render(<Kit onShow={onShow} onPress={onPress} />)
  await expect.poll(() => byTestId('item')).not.toBeNull()
  return { screen, onShow, onPress }
}

afterEach(async () => {
  document.documentElement.classList.remove('dark')
  await commands.forcedColors(false)
  await userEvent.unhover(document.body)
})

describe('Подсказки цветных точек (ADR 0224)', () => {
  test('MH1: PopupEntry с markHint и PopupItem с iconHint — наведение на область точки от края пункта до подписи на всю высоту показывает подсказку; без пропа область и вид прежние', async () => {
    const { screen } = await mountKit()
    try {
      // Облачко: полоса от края облачка до подписи, на всю высоту облачка.
      const entry =
        byTestId('entry').querySelector<HTMLElement>('[data-popup-entry]')!
      const strip = stripOf(entry)!
      const label = entry.querySelector<HTMLElement>(
        '[data-popup-entry-label]',
      )!
      const entryBox = entry.getBoundingClientRect()
      const stripBox = strip.getBoundingClientRect()
      expect(stripBox.left).toBeCloseTo(entryBox.left, 0)
      expect(stripBox.top).toBeCloseTo(entryBox.top, 0)
      expect(stripBox.height).toBeCloseTo(entryBox.height, 0)
      expect(stripBox.right).toBeLessThanOrEqual(
        label.getBoundingClientRect().left + 1,
      )
      expect(stripBox.right).toBeGreaterThan(
        entry.querySelector('[data-popup-entry-mark]')!.getBoundingClientRect()
          .right,
      )
      // Наведение у самого края и внизу облачка — подсказка.
      await hoverAt(strip, 1, stripBox.height - 2)
      await expect.poll(() => tooltipShown(HINT)).toBe(true)
      await userEvent.unhover(strip)
      await expect.poll(tooltipGone).toBe(true)

      // Пункт: значок растянут от края пункта до подписи на всю высоту, подписи на одной линии.
      const item = byTestId('item')
      const icon = iconOf(item)
      const itemBox = item.getBoundingClientRect()
      const iconBox = icon.getBoundingClientRect()
      const itemLabel = item.querySelector('[data-popup-item-label]')!
      const plain = byTestId('plain-item')
      expect(iconBox.left).toBeCloseTo(itemBox.left, 0)
      expect(iconBox.top).toBeCloseTo(itemBox.top, 0)
      expect(iconBox.height).toBeCloseTo(itemBox.height, 0)
      expect(iconBox.right).toBeCloseTo(
        itemLabel.getBoundingClientRect().left,
        0,
      )
      expect(itemLabel.getBoundingClientRect().left).toBeCloseTo(
        plain.querySelector('[data-popup-item-label]')!.getBoundingClientRect()
          .left -
          plain.getBoundingClientRect().left +
          itemBox.left,
        0,
      )
      // Точка — на месте значка пункта без подсказки.
      const dot = icon.firstElementChild!.getBoundingClientRect()
      const plainDot = iconOf(plain).firstElementChild!.getBoundingClientRect()
      expect(dot.left - itemBox.left).toBeCloseTo(
        plainDot.left - plain.getBoundingClientRect().left,
        0,
      )
      await hoverAt(icon, 1, iconBox.height - 2)
      await expect.poll(() => tooltipShown(HINT)).toBe(true)
      await userEvent.unhover(icon)
      await expect.poll(tooltipGone).toBe(true)

      // Без пропа — ни полосы, ни растянутого значка, наведение подсказки не даёт.
      const plainEntry = byTestId('plain-entry')
      expect(stripOf(plainEntry)).toBeNull()
      expect(iconOf(plain).hasAttribute('data-hint')).toBe(false)
      expect(iconOf(plain).getBoundingClientRect().width).toBeLessThan(
        iconBox.width,
      )
      await userEvent.hover(iconOf(plain))
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(tooltipShown(HINT)).toBe(false)
    } finally {
      await screen.unmount()
    }
  })

  test('MH2: нажатие на область точки делает то же, что нажатие на пункт — переход облачка и нажатие пункта; фокус не уходит на область точки', async () => {
    const { screen, onShow, onPress } = await mountKit()
    try {
      const entry = byTestId('entry')
      const strip = stripOf(entry)!
      await humanClick(strip)
      expect(onShow).toHaveBeenCalledTimes(1)
      expect(strip.contains(document.activeElement)).toBe(false)

      const icon = iconOf(byTestId('item'))
      await humanClick(icon)
      expect(onPress).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(byTestId('item'))
      expect(icon.contains(document.activeElement)).toBe(false)
    } finally {
      await screen.unmount()
    }
  })
})

// --- Подсказки в поповерах таблицы -----------------------------------------------------

interface Row {
  id: string
  name: string
  price: number
}

const ROWS: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: `r${index}`,
  name: `Row ${index}`,
  price: index * 10,
}))

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    size: 160,
    meta: { dataType: 'number' },
  },
]

/** Свои тексты подсказок — каждый поповер берёт свой из словаря. */
const OWN = {
  'unsavedChanges.markHint': 'Pult hint',
  'failureLog.markHint': 'Log hint',
  viewSettingsLevelHint: 'Level hint',
  'editHistory.historyCurrentUnsaved': 'History hint',
}

interface Api {
  writeCells: (
    cells: { rowId: string; columnId: string; value: unknown }[],
    options?: { source?: string },
  ) => Promise<unknown>
  reportFailure: (report: {
    label: string
    target: unknown
    reason?: string
  }) => string
}
let api: Api

const Grid = ({ own }: { own: boolean }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Row) => row.id,
    plugins: [
      cellEditing({ saveMode: 'manual', onCommitEdits: () => {} } as never),
      columnSorting({ initialSorting: [{ id: 'name', desc: false }] }),
      editHistory(),
      unsavedChanges(),
      failureLog(),
    ] as never,
  })
  api = table as unknown as Api
  return (
    <div style={{ width: 760, height: 480 }}>
      <DataGrid
        table={table as never}
        height={440}
        localization={own ? (OWN as never) : undefined}
      />
    </div>
  )
}

const mountGrid = async (own = false) => {
  const screen = await render(<Grid own={own} />)
  await waitForGrid()
  await api.writeCells([{ rowId: 'r3', columnId: 'price', value: 99 }], {
    source: 'paste',
  })
  api.reportFailure({
    label: cellEditingLabels(tableLabels).cellDraftKind,
    target: { cell: ['r5', 'name'] },
    reason: 'Server said no',
  })
  return screen
}

const testId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
/** Открыть поповер кнопкой тулбара. */
const openBy = async (button: string, popup: string) => {
  await expect.poll(() => testId(button)).not.toBeNull()
  if (!testId(popup)) await humanClick(testId(button)!)
  await expect.poll(() => testId(popup)).not.toBeNull()
  return testId(popup)!
}
const closePopups = async () => {
  await userEvent.keyboard('{Escape}')
  await expect
    .poll(() =>
      ['unsaved-changes', 'failure-log', 'edit-history'].every(
        id => !testId(id),
      ),
    )
    .toBe(true)
}
/** Место элемента не меняется два кадра подряд — анимация въезда кончилась. */
const settledBox = async (element: HTMLElement) => {
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
  let last = ''
  for (let i = 0; i < 120; i++) {
    await frame()
    const box = element.getBoundingClientRect()
    const now = `${box.left},${box.top}`
    if (now === last) return
    last = now
  }
}

/** Наведение на область точки первого пункта поповера — текст подсказки. */
const hintOf = async (popup: HTMLElement) => {
  const area = await vi.waitFor(() => {
    const found = popup.querySelector<HTMLElement>(
      '[data-popup-entry-mark-hint], [data-popup-item-icon][data-hint]',
    )
    if (!found) throw new Error('нет области точки')
    return found
  })
  // Уровень «Настроек вида» въезжает сбоку: указатель — на область, когда она встала.
  await settledBox(area)
  await userEvent.hover(area, { position: { x: 2, y: 2 } })
  const text = await vi.waitFor(() => {
    const value = [...document.querySelectorAll('[data-tooltip-popup]')]
      .map(el => el.textContent?.trim())
      .find(Boolean)
    if (!value) throw new Error('нет подсказки')
    return value
  })
  await userEvent.unhover(area)
  return text
}

describe('Подсказки точек в поповерах таблицы (ADR 0224)', () => {
  test('MH4: пульт, журнал отказов, «Настройки вида» и история ставят подсказку точки текстом из своего словаря; localization его переопределяет', async () => {
    const expected = (own: boolean) => ({
      pult: own
        ? OWN['unsavedChanges.markHint']
        : unsavedChangesLabels(tableLabels).markHint,
      log: own
        ? OWN['failureLog.markHint']
        : failureLogLabels(tableLabels).markHint,
      level: own
        ? OWN.viewSettingsLevelHint
        : tableLabels.viewSettingsLevelHint,
      history: own
        ? OWN['editHistory.historyCurrentUnsaved']
        : editHistoryLabels(tableLabels).historyCurrentUnsaved,
    })
    for (const own of [false, true]) {
      const screen = await mountGrid(own)
      try {
        const want = expected(own)
        expect(
          await hintOf(
            await openBy('unsaved-changes-button', 'unsaved-changes'),
          ),
        ).toBe(want.pult)
        await closePopups()
        expect(
          await hintOf(await openBy('failure-log-button', 'failure-log')),
        ).toBe(want.log)
        await closePopups()
        expect(
          await hintOf(await openBy('edit-history-button', 'edit-history')),
        ).toBe(want.history)
        await closePopups()
        expect(await hintOf(await openSettingsSection('sorting'))).toBe(
          want.level,
        )
        await userEvent.keyboard('{Escape}')
      } finally {
        await screen.unmount()
      }
    }
  })

  test('MH5: точка и её область скрыты от скринридера; в пульте, журнале и «Настройках вида» смысл точки — в заголовке поповера, в истории — скрытой подписью пункта', async () => {
    const screen = await mountGrid()
    try {
      const hiddenFromReader = (popup: HTMLElement) => {
        const areas = [
          ...popup.querySelectorAll<HTMLElement>(
            '[data-popup-entry-mark], [data-popup-entry-mark-hint], [data-popup-item-icon]',
          ),
        ]
        expect(areas.length).toBeGreaterThan(0)
        for (const area of areas)
          expect(area.closest('[aria-hidden="true"]')).not.toBeNull()
      }
      const pult = await openBy('unsaved-changes-button', 'unsaved-changes')
      await expect.poll(() => stripOf(pult)).not.toBeNull()
      hiddenFromReader(pult)
      expect(pult.getAttribute('aria-label')).toBe(
        unsavedChangesLabels(tableLabels).unsavedChanges,
      )
      await closePopups()

      const log = await openBy('failure-log-button', 'failure-log')
      await expect.poll(() => stripOf(log)).not.toBeNull()
      hiddenFromReader(log)
      expect(log.getAttribute('aria-label')).toBe(
        failureLogLabels(tableLabels).failureLog,
      )
      await closePopups()

      const history = await openBy('edit-history-button', 'edit-history')
      await expect
        .poll(() => history.querySelector('[data-popup-item-icon][data-hint]'))
        .not.toBeNull()
      hiddenFromReader(history)
      const current = history.querySelector<HTMLElement>(
        '[aria-current="step"]',
      )!
      expect(current.textContent).toContain(
        editHistoryLabels(tableLabels).historyUnsaved,
      )
      await closePopups()

      const level = await openSettingsSection('sorting')
      await expect.poll(() => stripOf(level)).not.toBeNull()
      hiddenFromReader(level)
      const section = level.closest('[data-view-settings-section]') ?? level
      expect(section.textContent).toBeTruthy()
      await userEvent.keyboard('{Escape}')
    } finally {
      await screen.unmount()
    }
  })

  test('MH6: подсказка точки — axe с color-contrast в обеих темах, видна в forced-colors', async () => {
    const screen = await mountGrid()
    try {
      await inBothThemes(async () => {
        const pult = await openBy('unsaved-changes-button', 'unsaved-changes')
        const strip = await vi.waitFor(() => {
          const found = stripOf(pult)
          if (!found) throw new Error('нет полосы')
          return found
        })
        await userEvent.hover(strip, { position: { x: 2, y: 2 } })
        await expect
          .poll(() => tooltipShown(unsavedChangesLabels(tableLabels).markHint))
          .toBe(true)
        const tip = document.querySelector<HTMLElement>('[data-tooltip-popup]')!
        const result = await axe.run(tip, AXE_OPTIONS)
        expect(result.violations).toEqual([])
        await userEvent.unhover(strip)
        await closePopups()
      })
      await commands.forcedColors(true)
      const pult = await openBy('unsaved-changes-button', 'unsaved-changes')
      const strip = stripOf(pult)!
      await userEvent.hover(strip, { position: { x: 2, y: 2 } })
      await expect
        .poll(() => tooltipShown(unsavedChangesLabels(tableLabels).markHint))
        .toBe(true)
      const tip = document.querySelector<HTMLElement>('[data-tooltip-popup]')!
      const box = tip.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      // В forced-colors текст и рамка подсказки — системными цветами, не прозрачными.
      const style = getComputedStyle(tip)
      expect(style.color).not.toBe('rgba(0, 0, 0, 0)')
      expect(
        style.outlineStyle === 'none' && style.borderStyle === 'none',
      ).toBe(false)
    } finally {
      await screen.unmount()
    }
  })
})
