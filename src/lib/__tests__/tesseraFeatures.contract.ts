/**
 * Компайл-тайм проверка вывода `TesseraFeatures` из набора плагинов (не рантайм-тест).
 * Если вывод схлопнется в `never` или потеряет фичи записи, здесь появится ошибка `tsc`.
 */
import type { TesseraFeatures } from '../core/features'
import type { columnSorting } from '../plugins/columnSorting'
import type { rowExpanding } from '../plugins/rowExpanding'
import type { TableState } from '../types'

type Expect<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false

type Sorting = ReturnType<typeof columnSorting>
type Expanding = ReturnType<typeof rowExpanding>
type HooksOnly = { id: string; hooks: Record<string, unknown> }

type Empty = TesseraFeatures<readonly []>
type WithPlugins = TesseraFeatures<readonly [Sorting, Expanding]>
type WithHooksOnly = TesseraFeatures<readonly [Sorting, HooksOnly]>

type _E1 = Expect<HasKey<TableState<Empty>, 'columnPinning'>>
type _P1 = Expect<IsNever<WithPlugins> extends false ? true : false>
type _P2 = Expect<HasKey<TableState<WithPlugins>, 'sorting'>>
type _P3 = Expect<HasKey<TableState<WithPlugins>, 'expanded'>>
type _H1 = Expect<HasKey<TableState<WithHooksOnly>, 'sorting'>>
