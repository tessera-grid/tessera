import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSorting } from '../../../plugins/columnSorting'
import {
  dataExport,
  exportFormats,
  type ExportOptions,
} from '../../../plugins/dataExport'
import { pagination } from '../../../plugins/pagination'
import { rowSelection } from '../../../plugins/rowSelection'
import { AXE_OPTIONS } from './a11y-helpers'
import { failureShownOn } from '../helpers'

// Плагин dataExport (ADR 0044): кнопка тулбара, панель настроек, скачивание, серверный
// режим. Оси, сбор данных и CSV (EX2–EX5, EX10–EX22, EX24, EX29–EX30) — модульные тесты
// `src/lib/__tests__/export.test.ts`. Скачивание перехватывается подменой
// `URL.createObjectURL` и `HTMLAnchorElement.click`; состояние читается из DOM/ARIA.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'note', accessorKey: 'note', header: 'Note' },
]
const DATA = [
  { id: '1', name: 'Ann', note: 'a,b' },
  { id: '2', name: 'Bob', note: 'plain' },
]

interface Download {
  name: string
  text: () => Promise<string>
}

const captureDownloads = () => {
  const downloads: Download[] = []
  let lastBlob: Blob | undefined
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    lastBlob = blob as Blob
    return 'blob:export-test'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = lastBlob!
    downloads.push({ name: this.download, text: () => blob.text() })
  })
  return downloads
}

afterEach(() => vi.restoreAllMocks())

const reducedMotion = (
  commands as unknown as { reducedMotion: (reduce: boolean) => Promise<void> }
).reducedMotion

const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-button"]')
const panel = () =>
  document.querySelector<HTMLElement>('[data-testid="export-panel"]')
const radio = (axis: string, value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="export-axis-${axis}"] [role="radio"][data-value="${value}"]`,
  )
const isChecked = (el: HTMLElement | null) =>
  el?.getAttribute('aria-checked') === 'true'
const isDisabled = (el: HTMLElement | null) =>
  el?.getAttribute('aria-disabled') === 'true' ||
  el?.hasAttribute('data-disabled')
const run = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-run"]')
const preset = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="export-preset-${id}"]`)

const CustomDownloadIcon = () => <svg data-testid="custom-download-icon" />

const JSON_FORMAT = {
  id: 'json',
  label: 'JSON',
  extension: 'json',
  mimeType: 'application/json',
  serialize: ({ rows }: { rows: unknown[][] }) => JSON.stringify(rows),
}

type Factory = () => unknown

const WITH_SCOPES: readonly Factory[] = [
  () => columnSorting(),
  () => pagination(),
  () => rowSelection(),
]

const Grid = ({
  options,
  enableToolbar = true,
  extraPlugins = [],
  withExport = true,
  colorMode,
  localization,
  icons,
}: {
  options?: ExportOptions
  enableToolbar?: boolean
  extraPlugins?: readonly Factory[]
  withExport?: boolean
  colorMode?: 'light' | 'dark'
  localization?: Record<string, unknown>
  icons?: Record<string, unknown>
}) => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableToolbar,
    plugins: [
      ...extraPlugins.map(plugin => plugin()),
      ...(withExport ? [dataExport(options)] : []),
    ] as never,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid
        table={table as never}
        colorMode={colorMode}
        localization={localization as never}
        icons={icons as never}
      />
    </div>
  )
}

const renderGrid = async (props: Parameters<typeof Grid>[0] = {}) => {
  const screen = await render(<Grid {...props} />)
  await expect
    .poll(() => document.querySelector('[role="toolbar"]'))
    .not.toBeNull()
  return screen
}

const openPanel = async () => {
  await expect.poll(button).not.toBeNull()
  await userEvent.click(button()!)
  await expect.poll(panel).not.toBeNull()
}

const selectFirstRow = async () => {
  await userEvent.click(
    document.querySelector<HTMLElement>(
      '.data-grid__body-row .row-select-checkbox',
    )!,
  )
}

const runExport = async () => {
  await userEvent.click(run()!)
  await expect.poll(panel).toBeNull()
}

describe('dataExport — кнопка и панель', () => {
  test('EX1: the plugin adds the Export button; none without it or with enabled:false', async () => {
    const withPlugin = await renderGrid()
    await expect.poll(button).not.toBeNull()
    await withPlugin.unmount()

    const without = await renderGrid({ withExport: false })
    expect(button()).toBeNull()
    await without.unmount()

    const disabled = await renderGrid({ options: { enabled: false } })
    expect(button()).toBeNull()
    await disabled.unmount()
  })

  test('EX6: one available combination exports on click; otherwise the panel opens; Escape returns focus to the button', async () => {
    const downloads = captureDownloads()
    const single = await renderGrid({
      options: { allow: { columns: ['visible'] } },
    })
    await expect.poll(button).not.toBeNull()
    await userEvent.click(button()!)
    await expect.poll(() => downloads.length).toBe(1)
    expect(panel()).toBeNull()
    await single.unmount()

    await renderGrid({ extraPlugins: WITH_SCOPES })
    await openPanel()
    expect(downloads).toHaveLength(1)

    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
    await expect.poll(() => document.activeElement).toBe(button())
  })

  test('EX7: the panel has a radio group per axis; plugin-less values are absent, disallowed ones disabled, the format axis hides with one format; Selected is disabled until a row is selected', async () => {
    const limited = await renderGrid({
      extraPlugins: [() => columnSorting(), () => rowSelection()],
      options: {
        formats: [exportFormats.csv(), JSON_FORMAT],
        allow: { rows: ['all', 'selected'] },
      },
    })
    await openPanel()
    expect(radio('rows', 'all')).not.toBeNull()
    expect(radio('rows', 'page')).toBeNull()
    expect(isDisabled(radio('rows', 'view'))).toBe(true)
    expect(isDisabled(radio('rows', 'selected'))).toBe(true)
    expect(radio('format', 'json')).not.toBeNull()
    expect(panel()!.querySelectorAll('[role="radiogroup"]')).toHaveLength(3)

    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
    await selectFirstRow()
    await userEvent.click(button()!)
    await expect.poll(panel).not.toBeNull()
    expect(isDisabled(radio('rows', 'selected'))).toBe(false)
    await limited.unmount()

    await renderGrid({ extraPlugins: WITH_SCOPES })
    await openPanel()
    expect(radio('format', 'csv')).toBeNull()
    expect(panel()!.querySelectorAll('[role="radiogroup"]')).toHaveLength(2)
  })

  test('EX8: a quick set fills its axes and exports nothing; without presets there is no row of sets', async () => {
    const downloads = captureDownloads()
    const withSets = await renderGrid({
      extraPlugins: WITH_SCOPES,
      options: {
        presets: [
          {
            id: 'sel',
            label: 'Selection, all columns',
            rows: 'selected',
            columns: 'all',
          },
        ],
      },
    })
    await selectFirstRow()
    await openPanel()
    expect(isChecked(radio('rows', 'all'))).toBe(true)

    await userEvent.click(preset('sel')!)
    await expect.poll(() => isChecked(radio('rows', 'selected'))).toBe(true)
    expect(isChecked(radio('columns', 'all'))).toBe(true)
    expect(downloads).toHaveLength(0)
    await withSets.unmount()

    await renderGrid({ extraPlugins: WITH_SCOPES })
    await openPanel()
    expect(preset('sel')).toBeNull()
  })

  test('EX9: the last choice is remembered for the table lifetime and restored on the next open', async () => {
    await renderGrid({ extraPlugins: WITH_SCOPES })
    await openPanel()
    await userEvent.click(radio('rows', 'view')!)
    await userEvent.click(radio('columns', 'all')!)
    await expect.poll(() => isChecked(radio('columns', 'all'))).toBe(true)

    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
    await userEvent.click(button()!)
    await expect.poll(panel).not.toBeNull()
    expect(isChecked(radio('rows', 'view'))).toBe(true)
    expect(isChecked(radio('columns', 'all'))).toBe(true)
  })
})

describe('dataExport — скачивание', () => {
  test('EX23: Export downloads filename.extension with the serialized content for the chosen settings; filename is a string or a function; the format comes from the settings', async () => {
    const downloads = captureDownloads()
    const direct = await renderGrid({
      options: {
        filename: 'people',
        allow: { columns: ['visible'] },
        formats: [exportFormats.csv({ bom: false })],
      },
    })
    await expect.poll(button).not.toBeNull()
    await userEvent.click(button()!)
    await expect.poll(() => downloads.length).toBe(1)
    expect(downloads[0].name).toBe('people.csv')
    expect(await downloads[0].text()).toBe(
      'Name,Note\r\nAnn,"a,b"\r\nBob,plain',
    )
    await direct.unmount()

    await renderGrid({
      extraPlugins: WITH_SCOPES,
      options: {
        formats: [exportFormats.csv(), JSON_FORMAT],
        filename: (settings, format) => `${settings.rows}-${format.id}`,
      },
    })
    await openPanel()
    await userEvent.click(radio('format', 'json')!)
    await expect.poll(() => isChecked(radio('format', 'json'))).toBe(true)
    await runExport()

    await expect.poll(() => downloads.length).toBe(2)
    expect(downloads[1].name).toBe('all-json.json')
    expect(await downloads[1].text()).toBe('[["Ann","a,b"],["Bob","plain"]]')
  })

  test('EX25: onExported is called after the download with settings, format, rowCount, filename and columns', async () => {
    captureDownloads()
    const onExported = vi.fn()
    await renderGrid({
      options: {
        filename: 'people',
        allow: { columns: ['visible'] },
        onExported,
      },
    })
    await expect.poll(button).not.toBeNull()
    await userEvent.click(button()!)

    await expect.poll(() => onExported.mock.calls.length).toBe(1)
    const request = onExported.mock.calls[0][0]
    expect(request.settings).toEqual({
      rows: 'all',
      columns: 'visible',
      format: 'csv',
    })
    expect(request.format.id).toBe('csv')
    expect(request.rowCount).toBe(2)
    expect(request.filename).toBe('people')
    // Колонки несут и раскладку для листа (ADR 0073, §2): ширину, закрепление.
    expect(request.columns).toMatchObject([
      { id: 'name', header: 'Name' },
      { id: 'note', header: 'Note' },
    ])
  })
})

describe('dataExport — серверный режим', () => {
  const serverGrid = (options: ExportOptions) =>
    renderGrid({
      options: { server: true, ...options },
      extraPlugins: [() => columnSorting(), () => rowSelection()],
    })

  test('EX26: server:true — all, view and selected call onExport (selected with the rowIds of all selected) and download nothing', async () => {
    const downloads = captureDownloads()
    const onExport = vi.fn()
    await serverGrid({ onExport })
    await selectFirstRow()

    for (const rows of ['all', 'view', 'selected']) {
      await openPanel()
      await userEvent.click(radio('rows', rows)!)
      await expect.poll(() => isChecked(radio('rows', rows))).toBe(true)
      await runExport()
    }
    await expect.poll(() => onExport.mock.calls.length).toBe(3)
    expect(
      onExport.mock.calls.map(([request]) => request.settings.rows),
    ).toEqual(['all', 'view', 'selected'])
    expect(onExport.mock.calls[0][0].rowIds).toBeUndefined()
    expect(onExport.mock.calls[2][0].rowIds).toEqual(['1'])
    expect(onExport.mock.calls[0][0].columns).toEqual([
      { id: 'name', header: 'Name' },
      { id: 'note', header: 'Note' },
    ])
    expect(downloads).toHaveLength(0)
  })

  test('EX27: server:true — page downloads on the client and calls onExported, not onExport', async () => {
    const downloads = captureDownloads()
    const onExport = vi.fn()
    const onExported = vi.fn()
    await renderGrid({
      options: { server: true, onExport, onExported },
      extraPlugins: [() => pagination({ server: true, rowCount: 2 })],
    })
    await openPanel()
    await userEvent.click(radio('rows', 'page')!)
    await expect.poll(() => isChecked(radio('rows', 'page'))).toBe(true)
    await runExport()

    await expect.poll(() => downloads.length).toBe(1)
    expect(onExported).toHaveBeenCalledTimes(1)
    expect(onExported.mock.calls[0][0].settings.rows).toBe('page')
    expect(onExport).not.toHaveBeenCalled()
  })

  test('EX28: while onExport is pending the button is aria-busy and server export is blocked; a rejection clears the busy state and marks the button with the reason, without a console error', async () => {
    let finish!: () => void
    const onExport = vi.fn(
      () => new Promise<void>(resolve => (finish = resolve)),
    )
    const pending = await renderGrid({
      options: { server: true, onExport },
      extraPlugins: [() => pagination({ server: true, rowCount: 2 })],
    })
    await openPanel()
    await runExport()
    await expect.poll(() => button()!.getAttribute('aria-busy')).toBe('true')

    await userEvent.click(button()!)
    await expect.poll(panel).not.toBeNull()
    expect(run()!.disabled).toBe(true)
    await userEvent.click(radio('rows', 'page')!)
    await expect.poll(() => run()!.disabled).toBe(false)
    expect(onExport).toHaveBeenCalledTimes(1)

    finish()
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    await pending.unmount()

    // Отказ промиса снимает занятость и отмечает кнопку причиной; в консоль не пишется.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rejected = vi.fn(() => Promise.reject(new Error('server down')))
    await serverGrid({ onExport: rejected })
    await openPanel()
    await runExport()
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    await expect.poll(() => failureShownOn(button())).toBe(true)
    const reason = button()!.getAttribute('aria-describedby')!.split(' ')[0]!
    expect(document.getElementById(reason)!.textContent).toContain(
      'server down',
    )
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('dataExport — вид панели (ADR 0074)', () => {
  const PRESETS = [
    { id: 'everything', label: 'Everything', rows: 'all' as const },
  ]
  const groups = () => [...panel()!.children] as HTMLElement[]
  const items = (axis: string) => [
    ...panel()!.querySelectorAll<HTMLElement>(
      `[data-testid="export-axis-${axis}"] [role="radio"]`,
    ),
  ]
  /** Галочка пункта: всегда в разметке, показана у выбранного (`data-checked`). */
  const checkOf = (item: HTMLElement) =>
    item.lastElementChild!.firstElementChild as HTMLElement
  const fullPanel = () =>
    renderGrid({
      extraPlugins: WITH_SCOPES,
      options: {
        formats: [exportFormats.csv(), JSON_FORMAT],
        presets: PRESETS,
      },
    })

  test('EP1: порядок — пресеты, «Формат» сегментами, «Строки», «Колонки»; «Выгрузить» последней', async () => {
    await fullPanel()
    await openPanel()
    const order = groups().map(
      el =>
        el.dataset.testid ??
        (el.querySelector('[data-testid^="export-preset-"]')
          ? 'presets'
          : el.querySelector('[data-testid="export-run"]')
            ? 'run'
            : '?'),
    )
    expect(order).toEqual([
      'presets',
      'export-axis-format',
      'export-axis-rows',
      'export-axis-columns',
      'run',
    ])
    const format = panel()!.querySelector('[data-testid="export-axis-format"]')!
    expect(format.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(format.querySelectorAll('[role="radio"]')).toHaveLength(2)
  })

  test('EP2: группы как в меню действий — подпись и разделитель, без фона; левые края подписей, иконок и сегментов совпадают', async () => {
    await fullPanel()
    await openPanel()
    const all = groups()
    for (const [index, group] of all.entries()) {
      const style = getComputedStyle(group)
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(style.borderTopWidth).toBe(index === 0 ? '0px' : '1px')
    }
    for (const group of all.slice(0, -1)) {
      const label = group.firstElementChild as HTMLElement
      expect(getComputedStyle(label).textTransform).toBe('uppercase')
    }
    // Видимый край: у подписи — начало текста (после её отступа), у дорожки и иконки —
    // внешний край.
    const left = (el: HTMLElement, padded = false) =>
      el.getBoundingClientRect().left +
      (padded ? parseFloat(getComputedStyle(el).paddingLeft) : 0)
    const label = (axis: string) =>
      panel()!.querySelector<HTMLElement>(
        `[data-testid="export-axis-${axis}"] > span`,
      )!
    const edge = left(label('format'), true)
    expect(
      left(
        panel()!.querySelector<HTMLElement>(
          '[data-testid="export-axis-format"] [role="radiogroup"]',
        )!,
      ),
    ).toBeCloseTo(edge, 0)
    expect(left(label('rows'), true)).toBeCloseTo(edge, 0)
    expect(
      left(items('rows')[0]!.firstElementChild as HTMLElement),
    ).toBeCloseTo(edge, 0)
  })

  test('EP3: варианты — пункты с иконкой из icons и галочкой у выбранного; логика радиогруппы со стрелками и пропуском недоступного', async () => {
    const RowsIcon = () => <svg data-testid="custom-rows-icon" />
    await renderGrid({
      extraPlugins: WITH_SCOPES,
      icons: { exportRowsAll: RowsIcon },
    })
    await openPanel()
    const rows = items('rows')
    expect(rows.map(item => item.dataset.value)).toEqual([
      'all',
      'view',
      'page',
      'selected',
    ])
    expect(
      rows[0]!.querySelector('[data-testid="custom-rows-icon"]'),
    ).not.toBeNull()
    expect(rows[1]!.firstElementChild!.querySelector('svg')).not.toBeNull()
    const checked = () =>
      items('rows')
        .filter(item => item.getAttribute('aria-checked') === 'true')
        .map(item => item.dataset.value)
    const withCheck = () =>
      items('rows')
        .filter(item => checkOf(item).hasAttribute('data-checked'))
        .map(item => item.dataset.value)
    expect(checked()).toEqual(['all'])
    expect(withCheck()).toEqual(['all'])

    await userEvent.click(radio('rows', 'page')!)
    await expect.poll(checked).toEqual(['page'])
    expect(withCheck()).toEqual(['page'])

    // «Выбранные» недоступны без выбора: стрелка вниз со страницы — на «Все строки».
    radio('rows', 'page')!.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(checked).toEqual(['all'])
    expect(withCheck()).toEqual(['all'])
  })

  test('EP4: единственный доступный вариант оси выбран по умолчанию и отмечен галочкой', async () => {
    await renderGrid({
      options: { formats: [exportFormats.csv(), JSON_FORMAT] },
    })
    await openPanel()
    const rows = items('rows')
    expect(rows.map(item => item.dataset.value)).toEqual(['all'])
    expect(rows[0]!.getAttribute('aria-checked')).toBe('true')
    document.getAnimations().forEach(animation => animation.finish())
    expect(checkOf(rows[0]!).hasAttribute('data-checked')).toBe(true)
    expect(getComputedStyle(checkOf(rows[0]!)).opacity).toBe('1')
  })
  test('EP5: галочка выбранного проявляется анимацией токена --tsr-comp-popup-check-transition; у невыбранных скрыта; при «меньше движения» — сразу', async () => {
    await renderGrid({ extraPlugins: WITH_SCOPES })
    await openPanel()
    const check = (value: string) =>
      checkOf(items('rows').find(item => item.dataset.value === value)!)
    document.getAnimations().forEach(animation => animation.finish())
    expect(getComputedStyle(check('page')).opacity).toBe('0')
    expect(getComputedStyle(check('all')).opacity).toBe('1')
    const style = getComputedStyle(check('page'))
    expect(style.transitionProperty).toBe('opacity, transform')

    await userEvent.click(radio('rows', 'page')!)
    await expect
      .poll(() => check('page').hasAttribute('data-checked'))
      .toBe(true)
    // Появление идёт анимацией: прозрачность ещё в пути, затем — видна.
    expect(
      check('page')
        .getAnimations()
        .some(
          animation =>
            (animation as CSSTransition).transitionProperty === 'opacity',
        ),
    ).toBe(true)
    document.getAnimations().forEach(animation => animation.finish())
    expect(getComputedStyle(check('page')).opacity).toBe('1')
    expect(getComputedStyle(check('all')).opacity).toBe('0')

    await reducedMotion(true)
    try {
      await userEvent.click(radio('rows', 'all')!)
      await expect
        .poll(() => check('all').hasAttribute('data-checked'))
        .toBe(true)
      expect(check('all').getAnimations()).toHaveLength(0)
      expect(getComputedStyle(check('all')).opacity).toBe('1')
    } finally {
      await reducedMotion(false)
    }
  })
})

describe('dataExport — подписи и доступность', () => {
  test('EX31: labels come from localization, the icon from icons; the label is the accessible name and the tooltip; groups are named', async () => {
    await renderGrid({
      extraPlugins: WITH_SCOPES,
      localization: {
        export: 'Выгрузить',
        exportRows: 'Строки',
        exportRun: 'Скачать',
        exportAll: 'Все данные',
      },
      icons: { download: CustomDownloadIcon },
    })
    await expect.poll(button).not.toBeNull()
    expect(button()!.getAttribute('aria-label')).toBe('Выгрузить')
    expect(
      button()!.querySelector('[data-testid="custom-download-icon"]'),
    ).not.toBeNull()

    await userEvent.hover(button()!)
    await expect
      .poll(() => document.querySelector('[data-side]')?.textContent ?? '')
      .toContain('Выгрузить')

    await openPanel()
    expect(run()!.textContent).toBe('Скачать')
    const group = panel()!.querySelector<HTMLElement>(
      '[data-testid="export-axis-rows"] [role="radiogroup"]',
    )!
    expect(
      document.getElementById(group.getAttribute('aria-labelledby')!)
        ?.textContent,
    ).toBe('Строки')
    expect(panel()!.textContent).toContain('Все данные')
  })

  test('EX32: the toolbar button and the panel pass axe with color-contrast in both themes', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      const screen = await renderGrid({
        colorMode,
        extraPlugins: WITH_SCOPES,
        options: {
          formats: [exportFormats.csv(), JSON_FORMAT],
          presets: [{ id: 'all', label: 'Everything', rows: 'all' }],
        },
      })
      await openPanel()
      // Контраст — по конечным цветам, а не посреди проявления поповера.
      document
        .getAnimations()
        .filter(
          animation => animation.effect?.getTiming().iterations !== Infinity,
        )
        .forEach(animation => animation.finish())

      const { violations } = await axe.run(
        {
          include: [document.querySelector('[role="toolbar"]')!, panel()!],
          exclude: [['[data-base-ui-focus-guard]']],
        },
        {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        },
      )
      expect(
        violations.map(v => v.id),
        colorMode,
      ).toEqual([])
      await screen.unmount()
    }
  })
})
