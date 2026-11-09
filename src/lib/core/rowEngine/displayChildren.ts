/**
 * Дети строки в порядке показа (ADR 0200, §4): стадия, которая меняет состав или порядок детей
 * (фильтр, сортировка), записывает их в своём выходе, не трогая `subRows` строк. Запись
 * выхода ищется по цепочке стадий; без записи — `row.subRows`.
 */
interface ChildrenLayer {
  own: ReadonlyMap<string, readonly object[]>
  /** Модель входа стадии: её записи — ниже по цепочке. */
  input?: object
}

const layers = new WeakMap<object, ChildrenLayer>()

export const childrenOf = <
  TRow extends { id: string; subRows: readonly object[] },
>(
  model: object,
  row: TRow,
): readonly TRow[] => {
  for (
    let layer = layers.get(model);
    layer;
    layer = layer.input && layers.get(layer.input)
  ) {
    const own = layer.own.get(row.id)
    if (own) return own as readonly TRow[]
  }
  return row.subRows as readonly TRow[]
}

/** Дети показа в выходе стадии; прочие строки — как во входе. */
export const setChildren = (
  output: object,
  own: ReadonlyMap<string, readonly object[]>,
  input?: object,
) => {
  layers.set(output, { own, input })
}

/** Выход стадии отдаёт детей показа входа без своих записей. */
export const passChildren = (output: object, input: object) => {
  if (output !== input && layers.has(input))
    setChildren(output, new Map(), input)
}
