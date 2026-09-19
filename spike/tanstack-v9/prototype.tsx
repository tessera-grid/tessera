/**
 * СПАЙК v9 — сборка таблицы на нативном v9 API + гранулярные подписки.
 *
 * Этот файл — ТИПОВОЙ прототип: его задача — скомпилироваться против реальных типов
 * v9 рядом с существующим v8-кодом (проверяется `npm run typecheck:spike`). Рантайм
 * ре-рендеров меряется уже в реальном приложении (следующий шаг плана) — здесь важна
 * эргономика и то, что типовая история сходится.
 *
 * Демонстрирует:
 *  - `useTable` + `tableFeatures({...})` с нашей `commonFeature` и встроенными фичами;
 *  - row-модель сортировки как СЛОТ (`sortedRowModel`), а не опция;
 *  - presence-based сборку через `buildTableFeatures` (Q2);
 *  - гранулярную подписку `useSelector(table.atoms.<slice>)` — прямая замена
 *    нашего `useSubscribeStore` (Q-реактивность, снос Pub-Sub);
 *  - нативный `table.FlexRender` вместо самописного `render`→`columnDef` (Q1).
 */
import {
  createColumnHelper,
  createSortedRowModel,
  columnVisibilityFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from '@tanstack/table-v9'
import { useSelector } from '@tanstack/react-store'

import { commonFeature } from './commonFeature'

interface Person {
  id: string
  name: string
  age: number
}

// Набор фич. Для типобезопасного пути собираем ЛИТЕРАЛОМ (см. вывод Q2 в registry.ts):
// так `tableFeatures()` статически валидирует, что слот `sortedRowModel` требует
// `rowSortingFeature`, а `createColumnHelper<typeof features>` выводит API колонок.
const features = tableFeatures({
  coreReactivityFeature: undefined as never, // адаптер useTable подставит reactReactivity()
  commonFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
})

const columnHelper = createColumnHelper<typeof features, Person>()

// `columnHelper.columns([...])` (новый метод v9) корректно выводит гетерогенные
// TValue колонок в один присваиваемый массив.
const columns = columnHelper.columns([
  columnHelper.accessor('name', { header: 'Имя', sortFn: 'alphanumeric' }),
  columnHelper.accessor('age', { header: 'Возраст' }),
])

const data: Person[] = [
  { id: '1', name: 'Борис', age: 40 },
  { id: '2', name: 'Анна', age: 31 },
]

export function SpikeTable() {
  // Второй аргумент-селектор: подписка верхнего компонента сужена до пустого объекта —
  // он НЕ ре-рендерится на смену состояния; точечные подписки уходят вниз по дереву.
  const table = useTable(
    {
      features,
      columns,
      data,
      getRowId: row => row.id,
      // `hooks`/`slots` — теперь ОПЦИИ commonFeature, а не глобальные дженерики (Q5).
      hooks: {},
      slots: {},
    },
    () => ({}),
  )

  return (
    <div>
      <SortingBadge table={table} />
      <table>
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Гранулярный подписчик: ре-рендерится ТОЛЬКО при смене среза `sorting`.
 * Это прямой аналог нашего `useSubscribeStore(() => [primitives])`, но штатный.
 */
function SortingBadge({
  table,
}: {
  table: ReturnType<typeof useTable<typeof features, Person, object>>
}) {
  const sorting = useSelector(table.atoms.sorting, s => s)
  return <span>Сортировок активно: {sorting?.length ?? 0}</span>
}
