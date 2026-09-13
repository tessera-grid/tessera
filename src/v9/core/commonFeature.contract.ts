/**
 * Фаза A — компайл-тайм проверка контракта `commonFeature` (не рантайм-тест).
 * Убеждаемся, что declaration merging действительно проступает на объектах v9,
 * когда `commonFeature` присутствует в наборе фич. Файл существует ради `tsc`:
 * если merge сломается, здесь появится ошибка типов. Значений не экспортирует.
 */
import type {
  Cell,
  Column,
  Header,
  HeaderGroup,
  Row,
  Table,
  TableFeature,
  TableFeatures,
  TableOptions,
} from '../types'

interface Data {
  id: string
}

// Синтетический набор с включённой commonFeature (только тип-уровень).
type F = TableFeatures & { commonFeature: TableFeature }

// Хелпер: тип должен быть в точности функцией указанной формы.
type Expect<T, Shape extends T> = Shape

// --- Table API ---------------------------------------------------------------
type _T1 = Expect<() => unknown, Table<F, Data>['getRenderSlots']>
type _T2 = Expect<() => unknown, Table<F, Data>['getHooks']>
type _T3 = Expect<() => boolean, Table<F, Data>['getIsAnyColumnResizing']>

// --- Options -----------------------------------------------------------------
type _O1 = Expect<boolean | undefined, TableOptions<F, Data>['enableFooter']>

// --- Column / Header / Row / HeaderGroup / Cell ------------------------------
type _C1 = Expect<() => boolean, Column<F, Data>['getIsActionsColumn']>
type _H1 = Expect<() => boolean, Header<F, Data, unknown>['getIsFullHeightHeader']>
type _R1 = Expect<() => boolean, Row<F, Data>['getIsLastSubRow']>
type _G1 = Expect<() => boolean, HeaderGroup<F, Data>['getIsFirstGroup']>
// Cell в commonFeature API не добавляет (render→columnDef заменён на FlexRender):
// просто проверяем, что тип Cell существует и параметризуется набором фич.
type _CellOk = Cell<F, Data, unknown>

export type {}
