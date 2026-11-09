import { beforeAll, describe, test } from 'vitest'

import { columns as mockColumns } from '../../__mocks__/columns'
import { getData } from '../../__mocks__/data'
import {
  Grid,
  expectCollected,
  frames,
  mount,
  settled,
  track,
  warmUpDocument,
  type Tracked,
} from '../memory.helpers'

// Память движка строк (ADR 0200, EN26): словарь хранилища правится на месте, записи смен и
// подсказки виртуализатору отпускают прежнее после прохода — удалённая и заменённая строка не
// живут до следующих смен. Строки — вне окна виртуализации: их не держат пропсы отрисовки.

beforeAll(warmUpDocument)

type Row = { id: string }
type ModelTable = {
  getCoreRowModel: () => { rowsById: Record<string, object> }
}

describe('Память движка строк', () => {
  test('EN26: удалённая и заменённая строка и их объекты данных уходят из памяти сразу после смены data — словарь, записи смен и подсказки виртуализатору их не держат', async () => {
    const box: { table?: ModelTable } = {}
    const onTable = (table: object) => (box.table = table as ModelTable)
    let data: Row[] = getData(200).map((row: Row) => ({ ...row }))
    const columns = mockColumns.map(column => ({ ...column }))
    const mounted = mount(
      <Grid data={data} columns={columns} onTable={onTable} />,
    )
    const rerender = async () => {
      mounted.render(<Grid data={data} columns={columns} onTable={onTable} />)
      await frames(2)
      await settled(mounted.container)
    }
    try {
      await settled(mounted.container)
      // Данные первого рендера держит TanStack (`leaks.ts`): отслеживаются данные второй смены.
      data = data.map(row => ({ ...row }))
      await rerender()
      const rowOf = (id: string) => box.table!.getCoreRowModel().rowsById[id]!
      // Только id: локальная ссылка теста держала бы объект.
      const removedId = data[150]!.id
      const editedId = data[151]!.id
      const tracked: Tracked[] = [
        track('удалённая строка', rowOf(removedId)),
        track('данные удалённой строки', data[150]!),
        track('прежняя строка правки', rowOf(editedId)),
        track('прежние данные правки', data[151]!),
      ]
      data = data
        .filter(row => row.id !== removedId)
        .map(row => (row.id === editedId ? { ...row } : row))
      await rerender()
      // React держит пропсы двух последних отрисовок хоста теста (`leaks.ts`).
      await rerender()
      await rerender()
      await expectCollected(tracked)
    } finally {
      mounted.unmount()
    }
  }, 60_000)
})
