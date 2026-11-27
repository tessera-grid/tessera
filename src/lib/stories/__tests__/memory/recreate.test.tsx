import { beforeAll, describe, expect, test } from 'vitest'

import { columns as mockColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import { argsToPlugins } from '../../__mocks__/utils/argsToPlugins'
import {
  ALL_PLUGINS,
  Grid,
  RETAINED_NOISE,
  countAlive,
  expectCollected,
  expectFlat,
  frames,
  measureSlope,
  mount,
  settled,
  settledDom,
  track,
  waitFor,
  warmUpDocument,
  type Tracked,
} from '../memory.helpers'

// Утечки при пересоздании таблицы (ADR 0092, LK5–LK6): новые `columns` и `data` и
// новый набор плагинов на живом гриде. Прежние данные, строки и записи плагинов
// собираются, узлы и обработчики не растут с числом смен.

const CHANGES = 20
/** Круги переключений: каждый плагин выключается раз за круг. */
const ROUNDS = 3

beforeAll(warmUpDocument)

type Row = { id: string }
type ModelTable = { getRowModel: () => { rows: object[] } }

const freshData = () => getData(60).map((row: Row) => ({ ...row }))

/** Окно колонок может измениться после первого стабильного кадра раскладки. */
const waitForQuietGrid = async (container: HTMLElement) => {
  let changedAt = performance.now()
  const observer = new MutationObserver(() => {
    changedAt = performance.now()
  })
  observer.observe(container, { childList: true, subtree: true })
  try {
    await waitFor(() => performance.now() - changedAt >= 300)
  } finally {
    observer.disconnect()
  }
}
const freshColumns = () => mockColumns.map(column => ({ ...column }))

/**
 * Без ленты: с пагинацией она инертна, а набор ниже переключает плагины по одному;
 * навигация — опция ядра, а не плагин (ADR 0170, §1).
 */
const TOGGLE_ORDER = (
  Object.keys(ALL_PLUGINS) as (keyof typeof ALL_PLUGINS)[]
).filter(name => name !== 'enableKeyboardNavigation')

describe('Утечки при пересоздании таблицы', () => {
  test(`LK5: ${CHANGES} смен columns и data — прежние массивы данных собираются, число удержанных прежних объектов строк не растёт с числом смен, узлы и обработчики не растут`, async () => {
    const box: { table?: ModelTable } = {}
    const onTable = (table: object) => (box.table = table as ModelTable)
    // Данные приходят после монтирования, как с сервера: таблица держит опции первого
    // рендера (`leaks.ts`), а с ними — только пустой массив.
    let data: Row[] = []
    const mounted = mount(
      <Grid data={data} columns={freshColumns()} onTable={onTable} />,
    )
    await frames(2)

    const arrays: Tracked[] = []
    const rows: Tracked[] = []
    let tracking = false
    const change = async (index: number) => {
      if (tracking) {
        arrays.push(track(`данные ${index}`, data))
        rows.push(track(`строка ${index}`, box.table!.getRowModel().rows[0]!))
      }
      data = freshData()
      mounted.render(
        <Grid data={data} columns={freshColumns()} onTable={onTable} />,
      )
      await settledDom(mounted.container)
    }
    try {
      // Пустые данные первого рендера — заглушка «нет данных» (ADR 0123): таблица с
      // DnD-контекстами монтируется на первых данных и держит их пропсами (`leaks.ts`).
      await change(-2)
      await change(-1)
      await settled(mounted.container)
      tracking = true
      let index = 0
      while (index < CHANGES) {
        await change(index++)
      }
      const afterN = await countAlive(rows)
      while (index < CHANGES * 3) {
        await change(index++)
      }
      // Последняя смена отпускает данные предпоследней, текущие живы.
      await expectCollected(arrays.slice(0, -1))
      // Строки держат пропсы fiber без перерисовки — их число ограничено (`leaks.ts`).
      const after3N = await countAlive(rows)
      expect(
        after3N,
        `удержано строк: после ${CHANGES} — ${afterN}, после ${CHANGES * 3} — ${after3N}`,
      ).toBeLessThanOrEqual(afterN + RETAINED_NOISE)

      tracking = false
      expectFlat(
        await measureSlope(async index => {
          await change(index)
          await waitForQuietGrid(mounted.container)
        }),
      )
    } finally {
      mounted.unmount()
    }
  }, 120_000)

  test(`LK6: ${ROUNDS} круга переключений набора плагинов на лету (каждый плагин выключается раз за круг) — наборы второго круга собраны, узлы и обработчики не растут`, async () => {
    const data = freshData()
    const columns = freshColumns()
    const pluginsFor = (index: number) =>
      argsToPlugins({
        ...ALL_PLUGINS,
        [TOGGLE_ORDER[index % TOGGLE_ORDER.length]!]: false,
      })
    let plugins = pluginsFor(0)
    const mounted = mount(
      <Grid data={data} columns={columns} plugins={plugins} />,
    )
    await settled(mounted.container)

    const tracked: Tracked[] = []
    const change = async (index: number) => {
      tracked.push(track(`записи плагинов ${index}`, plugins[0]!))
      plugins = pluginsFor(index + 1)
      mounted.render(<Grid data={data} columns={columns} plugins={plugins} />)
      await frames(2)
    }
    try {
      for (let i = 0; i < TOGGLE_ORDER.length * ROUNDS; i++) {
        await change(i)
      }
      // Первый круг — прогрев: его наборы держат опции первого рендера и, в React 18,
      // пропсы хост-элементов с разовой сменой атрибутов после монтирования; наборы
      // последнего круга — последние пропсы компонентов под memo до их следующей
      // отрисовки (`leaks.ts`): за круг каждый плагин переключается, и его компоненты
      // перерисовываются.
      await expectCollected(
        tracked.slice(TOGGLE_ORDER.length, TOGGLE_ORDER.length * 2),
      )
      // Каждый замер — после целого круга, с тем же выключенным плагином.
      const toggles = TOGGLE_ORDER.length
      expectFlat(
        await measureSlope(
          async index => {
            await change(index)
            if ((index + 1) % toggles !== 0) return
            await settledDom(mounted.container)
            await waitForQuietGrid(mounted.container)
          },
          { warmup: toggles, cycles: toggles },
        ),
      )
    } finally {
      mounted.unmount()
    }
  }, 120_000)
})
