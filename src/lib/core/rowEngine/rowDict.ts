/**
 * Словарь id → строка, который меняется на месте (ADR 0200, §2, EN30): текущая версия читает живой
 * словарь без прокси, прежняя — живой словарь и обратные записи смен после неё. Ссылки идут от
 * старых версий к новым: удалённую строку держат только прежние модели, пока их держит кто-то ещё.
 */
const ABSENT = Symbol('absent')

export interface DictVersion {
  /** Значения ключей в этой версии, которые сменились при переходе к следующей. */
  undo?: Map<string, unknown>
  next?: DictVersion
}

export interface DictWriter<T> {
  set: (id: string, value: T) => void
  delete: (id: string) => void
  /** Версия, в которую пишет правка. */
  version: DictVersion
}

export class RowDict<T> {
  private readonly live: Record<string, T>
  private head: DictVersion = {}
  private readonly views = new WeakMap<DictVersion, Record<string, T>>()

  constructor(live: Record<string, T> = Object.create(null)) {
    this.live = live
  }

  version(): DictVersion {
    return this.head
  }

  /** Словарь версии: текущая — сам живой словарь, прежняя — вид на него. */
  at(version: DictVersion): Record<string, T> {
    if (version === this.head) return this.live
    let view = this.views.get(version)
    if (!view) {
      view = this.viewOf(version)
      this.views.set(version, view)
    }
    return view
  }

  /** Новая версия: прежние значения правленых ключей уходят в обратные записи прежней. */
  edit(): DictWriter<T> {
    const old = this.head
    const undo = new Map<string, unknown>()
    const version: DictVersion = {}
    old.undo = undo
    old.next = version
    this.head = version
    const live = this.live
    const remember = (id: string) => {
      if (!undo.has(id)) undo.set(id, id in live ? live[id] : ABSENT)
    }
    return {
      version,
      set: (id, value) => {
        remember(id)
        live[id] = value
      },
      delete: id => {
        remember(id)
        delete live[id]
      },
    }
  }

  private viewOf(version: DictVersion): Record<string, T> {
    const live = this.live
    const read = (key: string): unknown => {
      for (let v: DictVersion | undefined = version; v?.next; v = v.next) {
        if (v.undo!.has(key)) {
          const value = v.undo!.get(key)
          return value === ABSENT ? undefined : value
        }
      }
      return live[key]
    }
    let flat: Record<string, unknown> | undefined
    const flatten = () => {
      if (flat) return flat
      const chain: DictVersion[] = []
      for (let v: DictVersion | undefined = version; v?.next; v = v.next) {
        chain.push(v)
      }
      flat = Object.create(null) as Record<string, unknown>
      for (const key in live) flat[key] = live[key]
      for (let i = chain.length - 1; i >= 0; i--) {
        for (const [key, value] of chain[i]!.undo!) {
          if (value === ABSENT) delete flat[key]
          else flat[key] = value
        }
      }
      return flat
    }
    return new Proxy(Object.create(null) as Record<string, T>, {
      get: (_, key) => (typeof key === 'string' ? read(key) : undefined),
      has: (_, key) => typeof key === 'string' && read(key) !== undefined,
      set: () => false,
      deleteProperty: () => false,
      ownKeys: () => Object.keys(flatten()),
      getOwnPropertyDescriptor: (_, key) => {
        const value = typeof key === 'string' ? read(key) : undefined
        return value === undefined
          ? undefined
          : { value, writable: false, enumerable: true, configurable: true }
      },
    })
  }
}

interface DictModel<T> {
  rows: T[]
  flatRows: T[]
  readonly rowsById: Record<string, T>
}

const stores = new WeakMap<
  object,
  { dict: RowDict<unknown>; version: DictVersion }
>()

/** Модель версии словаря: `rowsById` — словарь своей версии и после следующих правок. */
export const dictModel = <T>(
  dict: RowDict<T>,
  version: DictVersion,
  rows: T[],
  flatRows: T[],
): DictModel<T> => {
  const model = {
    rows,
    flatRows,
    get rowsById() {
      return dict.at(version)
    },
  }
  stores.set(model, { dict: dict as RowDict<unknown>, version })
  return model
}

/**
 * Правка словаря модели: модель — текущая версия своего словаря. Иначе (модель без словаря с
 * версиями или уже не текущая) — новый словарь копией.
 */
export const editDictOf = <T>(model: {
  rowsById: Record<string, T>
}): { dict: RowDict<T>; writer: DictWriter<T> } => {
  const store = stores.get(model)
  if (store && store.dict.version() === store.version) {
    const dict = store.dict as RowDict<T>
    return { dict, writer: dict.edit() }
  }
  const copy = Object.create(null) as Record<string, T>
  const from = model.rowsById
  for (const key of Object.keys(from)) copy[key] = from[key]!
  const dict = new RowDict(copy)
  return { dict, writer: dict.edit() }
}
