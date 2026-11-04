import axe from 'axe-core'
import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import { useState } from 'react'

import { definePlugin } from '../../../core/definePlugin'
import { ILLUSTRATION_SIZE, type StubsOverride } from '../../../core/stubs'
import type { LabelDictionary } from '../../../core/localization'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnVisibility,
  dataExport,
  pagination,
  quickSearch,
} from '../../../plugins'
import type { TableIcons } from '../../../ui/icons'
import { EmptyStateIllustration } from '../../../ui/icons/EmptyStateIllustration'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme/types'
import { Stub } from '../../../ui/Stub'
import { humanClick } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'
import { tableLabels } from '../labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'

// Заглушки пустой таблицы (ADR 0123, ES4–ES15): реестр причин, тексты из `localization`,
// иллюстрация из `icons`, проп `stubs`, тулбар без колонок. ES1–ES3 — модульные `stubs`.

interface Row {
  id: string
  name: string
  city: string
}

const ROWS: Row[] = [
  { id: '1', name: 'Alice', city: 'Rome' },
  { id: '2', name: 'Bob', city: 'Oslo' },
]
const NO_ROWS: Row[] = []
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]
const NO_COLUMNS: typeof COLUMNS = []
const ALL_HIDDEN = { name: false, city: false }

/** Своя причина автора плагина — главнее встроенных. */
const offline = definePlugin<{ enabled?: boolean }>()({
  id: 'offline',
  stubs: [
    {
      id: 'offline',
      priority: 5,
      placement: 'grid',
      when: () => true,
      title: () => 'You are offline',
      media: 'emptyState',
      testId: 'offline-stub',
    },
  ],
})

interface HostProps {
  data?: Row[]
  columns?: unknown[]
  loadError?: unknown
  columnVisibility?: Record<string, boolean>
  initialColumnFilters?: unknown[]
  withOffline?: boolean
  stubs?: StubsOverride
  localization?: LabelDictionary
  icons?: Partial<TableIcons>
  colorMode?: 'light' | 'dark'
  gridHeight?: number
}

const Host = ({
  data = ROWS,
  columns = COLUMNS,
  loadError,
  columnVisibility: visibility,
  initialColumnFilters,
  withOffline,
  gridHeight = 380,
  ...props
}: HostProps) => {
  // Набор плагинов — договор на время жизни таблицы: стенд его не меняет.
  const [plugins] = useState(() => [
    quickSearch(),
    columnFiltering({ initialColumnFilters: initialColumnFilters as never }),
    columnVisibility(),
    dataExport(),
    pagination(),
    ...(withOffline ? [offline()] : []),
  ])
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
    loadError,
    onRetry: () => {},
    ...(visibility && {
      state: { columnVisibility: visibility },
      handlers: { onColumnVisibilityChange: () => {} },
    }),
  } as never)
  return (
    <div
      style={{
        height: gridHeight + 40,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DataGrid table={table as never} height={gridHeight} {...props} />
    </div>
  )
}

/** Видимость колонок у приложения: «Show all» меняет его состояние. */
const OwnVisibility = () => {
  const [visibility, setVisibility] =
    useState<Record<string, boolean>>(ALL_HIDDEN)
  const [plugins] = useState(() => [columnVisibility(), quickSearch()])
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
    state: { columnVisibility: visibility },
    handlers: {
      onColumnVisibilityChange: (updater: unknown) =>
        setVisibility(old =>
          typeof updater === 'function' ? updater(old) : updater,
        ),
    },
  } as never)
  return (
    <div style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        data-testid="hide-all"
        onClick={() => setVisibility(ALL_HIDDEN)}
      >
        hide
      </button>
      <DataGrid table={table as never} height={380} />
    </div>
  )
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)
const byTestId = (id: string) => q(`[data-testid="${id}"]`)
const bodyRows = () => document.querySelectorAll('.data-grid__body-row')
const liveText = () =>
  [...document.querySelectorAll<HTMLElement>('[role="status"]')]
    .map(node => node.textContent)
    .join(' ')

const STUBS = {
  noData: { props: { data: NO_ROWS }, testId: 'no-data-stub' },
  noColumns: {
    props: { columns: NO_COLUMNS },
    testId: 'no-columns-stub',
  },
  columnsHidden: {
    props: { columnVisibility: ALL_HIDDEN },
    testId: 'columns-hidden-stub',
  },
  filtered: {
    props: {
      initialColumnFilters: [
        { id: 'name', value: { operator: 'contains', value: 'zzz' } },
      ],
    },
    testId: 'filter-stub',
  },
  loadError: {
    props: { data: NO_ROWS, loadError: new Error('Server responded 503') },
    testId: 'load-error-stub',
  },
} satisfies Record<string, { props: HostProps; testId: string }>

describe('Заглушки пустой таблицы (ADR 0123)', () => {
  test('ES4: заголовки, описания и подписи действий заглушек — из localization', async () => {
    const localization: LabelDictionary = {
      noData: 'Пусто',
      noColumnsTitle: 'Колонок нет',
      'columnVisibility.columnsHiddenTitle': 'Всё скрыто',
      'columnVisibility.showAllColumns': 'Показать',
      'filtering.noRowsMatchFilters': 'Ничего',
      'filtering.resetFilters': 'Сбросить',
      loadFailedTitle: 'Не загрузилось',
      loadRetry: 'Ещё раз',
    }
    const expected: Record<keyof typeof STUBS, string[]> = {
      noData: ['Пусто'],
      noColumns: ['Колонок нет'],
      columnsHidden: ['Всё скрыто', 'Показать'],
      filtered: ['Ничего', 'Сбросить'],
      loadError: ['Не загрузилось', 'Server responded 503', 'Ещё раз'],
    }
    for (const [id, { props, testId }] of Object.entries(STUBS)) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await render(
        <Host {...props} localization={localization} />,
      )
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(() => byTestId(testId)).not.toBeNull()
      for (const text of expected[id as keyof typeof STUBS]) {
        expect(byTestId(testId)!.textContent, id).toContain(text)
      }
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })

  test('ES5: после загрузки без видимых колонок данных — заглушка с иллюстрацией и noColumnsTitle вместо таблицы; тулбар и нижняя панель остаются; строк без ячеек нет', async () => {
    await render(<Host columns={NO_COLUMNS} />)
    await expect.poll(() => byTestId('no-columns-stub')).not.toBeNull()
    const stub = byTestId('no-columns-stub')!
    expect(stub.textContent).toContain(tableLabels.noColumnsTitle)
    expect(stub.querySelector('svg')).not.toBeNull()
    expect(bodyRows()).toHaveLength(0)
    expect(q('.data-grid__head')).toBeNull()
    expect(byTestId('data-grid-toolbar')).not.toBeNull()
    expect(byTestId('pagination')).not.toBeNull()
  })

  test('ES6: колонки есть, все скрыты состоянием приложения — заглушка columnsHiddenTitle с «Show all», кнопка возвращает видимость', async () => {
    await render(<OwnVisibility />)
    await expect.poll(() => byTestId('columns-hidden-stub')).not.toBeNull()
    const stub = byTestId('columns-hidden-stub')!
    expect(stub.textContent).toContain(
      columnVisibilityLabels(tableLabels).columnsHiddenTitle,
    )
    expect(byTestId('no-columns-stub')).toBeNull()
    await humanClick(byTestId('columns-hidden-show-all')!)
    await expect.poll(() => bodyRows().length).toBe(2)
    expect(byTestId('columns-hidden-stub')).toBeNull()
  })

  test('ES7: строк нет — заглушка библиотеки по умолчанию: иллюстрация и noData', async () => {
    await render(<Host data={NO_ROWS} />)
    await expect.poll(() => byTestId('no-data-stub')).not.toBeNull()
    const stub = byTestId('no-data-stub')!
    expect(stub.textContent).toContain(tableLabels.noData)
    expect(stub.querySelector('svg')).not.toBeNull()
  })

  test('ES8: stubs по id — узел или функция от { action }; меняет вид заглушки, а не выбор причины', async () => {
    const node = await render(
      <Host
        data={NO_ROWS}
        stubs={{ noData: <span data-testid="own-empty">Nothing yet</span> }}
      />,
    )
    await expect.poll(() => byTestId('own-empty')).not.toBeNull()
    expect(byTestId('no-data-stub')!.textContent).toBe('Nothing yet')
    await node.unmount()

    // Своя noData не меняет выбор: без колонок — noColumns по умолчанию.
    const choice = await render(
      <Host
        data={NO_ROWS}
        columns={NO_COLUMNS}
        stubs={{ noData: <span data-testid="own-empty">Nothing yet</span> }}
      />,
    )
    await expect.poll(() => byTestId('no-columns-stub')).not.toBeNull()
    expect(byTestId('own-empty')).toBeNull()
    await choice.unmount()

    await render(
      <Host
        columnVisibility={ALL_HIDDEN}
        stubs={{
          columnsHidden: ({ action }) => (
            <button type="button" data-testid="own-show" onClick={action}>
              Bring them back
            </button>
          ),
        }}
      />,
    )
    await expect.poll(() => byTestId('own-show')).not.toBeNull()
    expect(typeof byTestId('own-show')!.onclick).toBe('function')
  })

  test('ES9: иллюстрация каждой встроенной заглушки — общая icons.emptyState, по умолчанию в цветах темы; переопределяется через icons', async () => {
    for (const { props, testId } of Object.values(STUBS)) {
      const standard = await render(<Host {...props} />)
      await expect.poll(() => byTestId(testId)).not.toBeNull()
      const markup = byTestId(testId)!.querySelector('svg')!.innerHTML
      expect(markup, testId).toContain('var(--tsr-comp-control-color)')
      expect(markup, testId).toContain('var(--tsr-comp-bg)')
      await standard.unmount()

      const own = await render(
        <Host
          {...props}
          icons={{ emptyState: () => <svg data-testid="own-illustration" /> }}
        />,
      )
      await expect.poll(() => byTestId(testId)).not.toBeNull()
      expect(
        byTestId(testId)!.contains(byTestId('own-illustration')),
        testId,
      ).toBe(true)
      await own.unmount()
    }
  })

  test('ES10: без видимых колонок поиск и «Экспорт» выключены, «Фильтры» доступны при активных фильтрах, «Колонки» — если колонки есть, иначе выключена', async () => {
    const disabled = (id: string) =>
      byTestId(id)!.getAttribute('aria-disabled') === 'true' ||
      (byTestId(id) as HTMLButtonElement).disabled

    const hidden = await render(
      <Host
        columnVisibility={ALL_HIDDEN}
        initialColumnFilters={[
          { id: 'name', value: { operator: 'contains', value: 'a' } },
        ]}
      />,
    )
    await expect.poll(() => byTestId('columns-hidden-stub')).not.toBeNull()
    await expect.poll(() => byTestId('quick-search')).not.toBeNull()
    expect(disabled('quick-search')).toBe(true)
    expect(disabled('export-button')).toBe(true)
    expect(disabled('filter-summary-button')).toBe(false)
    expect(disabled('column-visibility-button')).toBe(false)
    await hidden.unmount()

    await render(<Host columns={NO_COLUMNS} />)
    await expect.poll(() => byTestId('no-columns-stub')).not.toBeNull()
    await expect.poll(() => byTestId('quick-search')).not.toBeNull()
    expect(disabled('quick-search')).toBe(true)
    expect(disabled('export-button')).toBe(true)
    expect(disabled('filter-summary-button')).toBe(true)
    expect(disabled('column-visibility-button')).toBe(true)
  })

  test('ES11: примитив Stub из /ui на токенах кита — встроенные заглушки рисуются им', async () => {
    await render(
      <>
        <div className="data-grid-theme">
          <Stub
            data-testid="kit-stub"
            media={<svg width={24} height={24} />}
            title="Title"
            description="Details"
            action={<button type="button">Act</button>}
          />
        </div>
        <Host data={NO_ROWS} />
      </>,
    )
    await expect.poll(() => byTestId('no-data-stub')).not.toBeNull()
    const kit = byTestId('kit-stub')!
    expect(kit.textContent).toBe('TitleDetailsAct')
    // Встроенная — тот же примитив: тот же класс корня.
    expect(byTestId('no-data-stub')!.className).toContain(
      kit.className.split(' ')[0],
    )
    const probe = document.createElement('span')
    probe.style.width = 'calc(var(--tsr-ref-space-1) * 2)'
    probe.style.position = 'absolute'
    kit.append(probe)
    expect(getComputedStyle(kit).rowGap).toBe(
      `${probe.getBoundingClientRect().width}px`,
    )
    probe.remove()
  })

  test('ES12: появление заглушки объявляется скринридеру её заголовком', async () => {
    await render(<OwnVisibility />)
    await expect.poll(() => byTestId('columns-hidden-stub')).not.toBeNull()
    await humanClick(byTestId('columns-hidden-show-all')!)
    await expect.poll(() => bodyRows().length).toBe(2)
    await humanClick(byTestId('hide-all')!)
    await expect
      .poll(liveText)
      .toContain(columnVisibilityLabels(tableLabels).columnsHiddenTitle)
  })

  test('ES13: axe с color-contrast у каждой встроенной заглушки в светлой и тёмной темах', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      for (const [id, { props, testId }] of Object.entries(STUBS)) {
        // eslint-disable-next-line no-await-in-loop
        const screen = await render(<Host {...props} colorMode={colorMode} />)
        // eslint-disable-next-line no-await-in-loop
        await expect.poll(() => byTestId(testId)).not.toBeNull()
        // eslint-disable-next-line no-await-in-loop
        const { violations } = await axe.run(
          q('.data-grid-theme') ?? document.body,
          {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          },
        )
        expect(violations, `${id} ${colorMode}`).toEqual([])
        // eslint-disable-next-line no-await-in-loop
        await screen.unmount()
      }
    }
  })

  test('ES14: definePlugin({ stubs }) добавляет запись в реестр; её id переопределяется в stubs грида', async () => {
    const standard = await render(<Host withOffline />)
    await expect.poll(() => byTestId('offline-stub')).not.toBeNull()
    expect(byTestId('offline-stub')!.textContent).toContain('You are offline')
    expect(bodyRows()).toHaveLength(0)
    await standard.unmount()

    await render(
      <Host
        withOffline
        stubs={{ offline: <span data-testid="own-offline">Reconnecting</span> }}
      />,
    )
    await expect.poll(() => byTestId('own-offline')).not.toBeNull()
  })

  test('ES15: иллюстрация целиком или никак — в низком гриде скрыта и заголовок виден, место выросло — в полный размер; вместо таблицы и под шапкой', async () => {
    for (const { props, testId } of [STUBS.noData, STUBS.filtered]) {
      const stub = () => byTestId(testId)!
      const media = () => stub().firstElementChild as HTMLElement
      const view = await render(<Host {...props} gridHeight={180} />)
      await expect.poll(() => byTestId(testId)).not.toBeNull()
      await expect.poll(() => media().hidden, { message: testId }).toBe(true)
      const box = stub().getBoundingClientRect()
      const title = stub().querySelector('p')!.getBoundingClientRect()
      expect(title.top, testId).toBeGreaterThanOrEqual(box.top)
      expect(title.bottom, testId).toBeLessThanOrEqual(box.bottom)

      await view.rerender(<Host {...props} gridHeight={600} />)
      await expect.poll(() => media().hidden, { message: testId }).toBe(false)
      expect(
        media().querySelector('svg')!.getBoundingClientRect().height,
        testId,
      ).toBe(ILLUSTRATION_SIZE)
      const shown = stub().getBoundingClientRect()
      expect(
        media().getBoundingClientRect().top,
        testId,
      ).toBeGreaterThanOrEqual(shown.top)
      await view.unmount()
    }
  })

  test('ES16: Stub size="compact" — отступы и кегль поповера, иллюстрация стороной --tsr-comp-stub-media-size-compact; в рамке по содержимому и под масштабом поповера иллюстрация не прячется', async () => {
    // Дробная высота строк: целые округления частей превышали бы рамку по содержимому.
    const Frame = ({ size }: { size: 'default' | 'compact' }) => (
      <div
        className={DATA_GRID_THEME_CLASS}
        style={{ width: 280, transform: 'scale(0.9)', lineHeight: '19.7px' }}
      >
        <style>{'[data-testid^="es16"] * { line-height: 19.7px; }'}</style>
        <Stub
          size={size}
          media={<EmptyStateIllustration />}
          title="No failures"
          description="Nothing here"
          data-testid={`es16-${size}`}
        />
      </div>
    )
    const view = await render(
      <>
        <Frame size="default" />
        <Frame size="compact" />
      </>,
    )
    try {
      const stub = (size: string) => byTestId(`es16-${size}`)!
      await expect.poll(() => byTestId('es16-compact')).not.toBeNull()
      const compact = stub('compact')
      const media = compact.firstElementChild as HTMLElement
      // Несколько кадров ResizeObserver: иллюстрация так и не прячется.
      for (let frame = 0; frame < 5; frame++)
        await new Promise(requestAnimationFrame)
      expect(media.hidden).toBe(false)
      expect(compact.getAttribute('data-media-hidden')).toBeNull()

      const probe = document.createElement('span')
      probe.style.width = 'var(--tsr-comp-stub-media-size-compact)'
      probe.style.display = 'block'
      compact.parentElement!.append(probe)
      const token = parseFloat(getComputedStyle(probe).width)
      probe.remove()
      expect(token).toBeGreaterThan(0)
      expect(
        parseFloat(getComputedStyle(media.querySelector('svg')!).height),
      ).toBe(token)

      const own = getComputedStyle(compact)
      const base = getComputedStyle(stub('default'))
      expect(parseFloat(own.paddingTop)).toBeLessThan(
        parseFloat(base.paddingTop),
      )
      expect(parseFloat(own.fontSize)).toBeLessThan(parseFloat(base.fontSize))
      const popupFont = document.createElement('span')
      popupFont.style.fontSize = 'var(--tsr-comp-popup-font-size)'
      compact.parentElement!.append(popupFont)
      expect(own.fontSize).toBe(getComputedStyle(popupFont).fontSize)
      popupFont.remove()
    } finally {
      await view.unmount()
    }
  })
})
