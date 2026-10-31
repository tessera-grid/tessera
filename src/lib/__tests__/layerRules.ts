/**
 * Нарушения правил слоёв и контракта для стражей ADR 0163: каждая функция отдаёт
 * отсортированный список, страж сверяет его с базой `architecture.baseline.ts`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildTesseraFeatures } from '../core/features'
import { pluginFactories } from './builtinPlugins'
import { ENTRY, featureMapEntries, typeProps } from './publicTypes'
import {
  ALLOWED,
  type Edge,
  edgeKey,
  edges,
  type Module,
  modules,
  sourceOf,
} from './importGraph'

interface Entry {
  id: string
  model?: Entry
  features?: Record<string, unknown>
  options?: Record<string, unknown>
  configure?: (args: unknown) => { options?: Record<string, unknown> }
}

const DECISIONS = fileURLToPath(
  new URL('../../../docs/decisions/', import.meta.url),
)

const unique = (items: string[]) => [...new Set(items)].sort()

const pluginFolders = () =>
  new Set(modules().flatMap(module => module.plugin ?? []))

/** Плагины записи и её цепочки `entry.model`: первым — сама запись. */
const chainEntries = (entry: Entry) => {
  const chain: Entry[] = []
  for (let item: Entry | undefined = entry; item; item = item.model) {
    chain.push(item)
  }
  return chain
}

let chains: Map<string, Entry[]> | undefined

/** Цепочка `entry.model` по папке плагина: интерфейс и модели, которые он несёт. */
const pluginChains = () => {
  if (chains) return chains
  const folders = pluginFolders()
  chains = new Map(
    pluginFactories().map(([name, factory]) => {
      const chain = chainEntries(factory() as Entry)
      for (const [index, item] of chain.entries()) {
        const folder = index === 0 ? name : item.id
        if (!folders.has(folder)) {
          throw new Error(`нет папки plugins/${folder} у плагина ${item.id}`)
        }
      }
      return [name, chain]
    }),
  )
  return chains
}

const chainFolders = (plugin: string) => {
  const chain = pluginChains().get(plugin)
  return chain ? [plugin, ...chain.slice(1).map(item => item.id)] : [plugin]
}

/** Плагины одной цепочки с `plugin`: его модели и интерфейсы, которые несут его. */
const familyOf = (plugin: string) =>
  new Set([
    ...chainFolders(plugin),
    ...[...pluginChains().keys()].filter(other =>
      chainFolders(other).includes(plugin),
    ),
  ])

const isAllowed = ({ from, to }: Edge) => {
  if (to.layer === 'vendor' || from.layer === 'entry') return true
  if (from.layer === 'plugins' && to.layer === 'plugins') {
    return chainFolders(from.plugin!).includes(to.plugin!)
  }
  if (from.layer === to.layer) return true
  return ALLOWED[from.layer].includes(to.layer)
}

/** LB1: рёбра в запрещённый слой. */
export const layerViolations = () =>
  unique(
    edges()
      .filter(edge => !isAllowed(edge))
      .map(edgeKey),
  )

/** LB2: модули ядра, у которых все импортёры вне ядра — плагины или `shared/`. */
export const corePluginOnlyModules = () => {
  const importers = new Map<string, Module[]>()
  for (const { from, to } of edges()) {
    if (to.layer !== 'core' || from.layer === 'core') continue
    importers.set(to.path, [...(importers.get(to.path) ?? []), from])
  }
  return unique(
    [...importers]
      .filter(([, from]) =>
        from.every(item => item.layer === 'plugins' || item.layer === 'shared'),
      )
      .map(([path]) => path),
  )
}

/** Аргументы, с которыми плагины выставляют разные опции. */
const ARG_SETS: unknown[] = [{}, { enabled: false }]

const optionKeysOf = (entry: Entry) =>
  ARG_SETS.flatMap(args => {
    try {
      return Object.keys({
        ...entry.options,
        ...entry.configure?.(args).options,
      })
    } catch {
      return Object.keys(entry.options ?? {})
    }
  })

/** Плагины, которые выставляют ключ опций таблицы. */
const optionEmitters = () => {
  const emitters = new Map<string, Set<string>>()
  for (const [name, chain] of pluginChains()) {
    for (const [index, entry] of chain.entries()) {
      const folder = index === 0 ? name : entry.id
      for (const key of optionKeysOf(entry)) {
        emitters.set(key, (emitters.get(key) ?? new Set()).add(folder))
      }
    }
  }
  return emitters
}

const OPTION_READ =
  /\boptions(?:\s+as\s+[^)]+)?\)?\s*\??\.\s*([A-Za-z_$][\w$]*)/g

/** Деструктуризация `const { a, b: c } = ….options`. */
const OPTION_DESTRUCTURE = /\{([^{}]*)\}\s*=\s*[\w$.]*\boptions\b(?!\s*[.?])/g

/** Ключи опций, которые читает исходник: обращением и деструктуризацией. */
const optionKeysRead = (source: string) => [
  ...[...source.matchAll(OPTION_READ)].map(match => match[1]),
  ...[...source.matchAll(OPTION_DESTRUCTURE)].flatMap(match =>
    match[1]
      .split(',')
      .map(part => part.split(/[:=]/)[0].trim())
      .filter(key => /^[A-Za-z_$][\w$]*$/.test(key)),
  ),
]

/** Плагины, которые приносят фичу, — по ключу фичи в `features` записи. */
const featureBringers = () => {
  const bringers = new Map<string, Set<string>>()
  for (const [name, chain] of pluginChains()) {
    for (const [index, entry] of chain.entries()) {
      const folder = index === 0 ? name : entry.id
      for (const feature of Object.keys(entry.features ?? {})) {
        bringers.set(feature, (bringers.get(feature) ?? new Set()).add(folder))
      }
    }
  }
  return bringers
}

const addOwners = (
  owners: Map<string, Set<string>>,
  key: string,
  folders: Iterable<string>,
) => {
  const set = owners.get(key) ?? new Set<string>()
  for (const folder of folders) {
    for (const member of familyOf(folder)) set.add(member)
  }
  owners.set(key, set)
}

/**
 * Владельцы ключей опций (ADR 0167, PO4): собственный ключ — плагинов, которые его
 * выставляют; стоковый ключ фичи — плагинов, которые её приносят; ключи ядра и фич ядра
 * общие и в карту не входят.
 */
export const optionOwners = () => {
  const coreFeatures = new Set(Object.keys(buildTesseraFeatures([])))
  const shared = new Set([
    ...coreOptionKeys(),
    ...propNames('StockTableOptionsCore'),
  ])
  const owners = new Map<string, Set<string>>()
  const bringers = featureBringers()
  for (const entry of featureMapEntries(
    ENTRY.contract,
    'TableOptionsFeatureMap',
  )) {
    const by = bringers.get(entry.name)
    if (!isStock(entry.file) || coreFeatures.has(entry.name) || !by) continue
    for (const key of entry.props) {
      if (!shared.has(key)) addOwners(owners, key, by)
    }
  }
  const stock = new Set(stockTableOptionKeys())
  for (const [key, emitters] of optionEmitters()) {
    if (!shared.has(key) && !stock.has(key)) addOwners(owners, key, emitters)
  }
  return owners
}

/** Плагины, которые импортируют модуль `shared/` — сами или через другие модули `shared/`. */
export const sharedUsers = () => {
  const importers = new Map<string, Module[]>()
  for (const { from, to } of edges()) {
    if (to.layer !== 'shared') continue
    importers.set(to.path, [...(importers.get(to.path) ?? []), from])
  }
  const users = new Map<string, Set<string>>()
  const visit = (path: string, seen: Set<string>): Set<string> => {
    const known = users.get(path)
    if (known) return known
    const found = new Set<string>()
    if (seen.has(path)) return found
    seen.add(path)
    for (const from of importers.get(path) ?? []) {
      if (from.layer === 'plugins') found.add(from.plugin!)
      if (from.layer === 'shared') {
        for (const plugin of visit(from.path, seen)) found.add(plugin)
      }
    }
    users.set(path, found)
    return found
  }
  for (const path of importers.keys()) visit(path, new Set())
  return users
}

/** LB5: чтения ключей опций плагина вне его семьи и вне его кода в `shared/` — `файл: ключ`. */
export const foreignOptionReads = () => {
  const owners = optionOwners()
  const users = sharedUsers()
  const readers = (module: Module) =>
    module.plugin !== undefined
      ? [module.plugin]
      : module.layer === 'shared'
        ? [...(users.get(module.path) ?? [])]
        : []
  return unique(
    modules()
      .filter(module => module.layer !== 'entry')
      .flatMap(module =>
        optionKeysRead(sourceOf(module.path))
          .filter(key => {
            const allowed = owners.get(key)
            return (
              allowed !== undefined &&
              !readers(module).some(reader => allowed.has(reader))
            )
          })
          .map(key => `${module.path}: ${key}`),
      ),
  )
}

/** Путь модуля `lib/…` по имени файла объявления. */
const libPathOf = (file: string) => {
  const index = file.replace(/\\/g, '/').lastIndexOf('/src/lib/')
  return index < 0 ? undefined : file.replace(/\\/g, '/').slice(index + 5)
}

/**
 * PO1: ключи `options` встроенных плагинов без объявления — `папка: ключ`. Объявление —
 * опция ядра, стоковая опция TanStack или запись `TableOptions_FeatureMap` из файла
 * семьи плагина.
 */
export const undeclaredOptionKeys = () => {
  const declared = new Set([...coreOptionKeys(), ...stockTableOptionKeys()])
  const pluginOf = new Map(
    modules().map(module => [module.path, module.plugin] as const),
  )
  const declaredBy = new Map<string, Set<string>>()
  for (const entry of featureMapEntries(
    ENTRY.contract,
    'TableOptionsFeatureMap',
  )) {
    const path = libPathOf(entry.file)
    const plugin = path === undefined ? undefined : pluginOf.get(path)
    if (plugin === undefined) continue
    for (const key of entry.props) {
      declaredBy.set(key, (declaredBy.get(key) ?? new Set()).add(plugin))
    }
  }
  return unique(
    [...optionEmitters()].flatMap(([key, emitters]) =>
      declared.has(key)
        ? []
        : [...emitters]
            .filter(
              emitter =>
                ![...familyOf(emitter)].some(member =>
                  declaredBy.get(key)?.has(member),
                ),
            )
            .map(emitter => `${emitter}: ${key}`),
    ),
  )
}

/** LB7: модули, которые дополняют `ColumnMeta` TanStack. */
export const columnMetaAugmentations = () =>
  unique(
    modules()
      .filter(module =>
        /\binterface\s+ColumnMeta\b/.test(sourceOf(module.path)),
      )
      .map(module => module.path),
  )

const OPTION_CAST = /\.options\s+as\s+(?:any\b|unknown\s+as\b|\{)/g

/** LB9: число приведений `….options` к `any`, `unknown as …` и литералу — по модулю. */
export const optionCasts = () =>
  Object.fromEntries(
    modules()
      .map(
        module =>
          [
            module.path,
            sourceOf(module.path).match(OPTION_CAST)?.length ?? 0,
          ] as const,
      )
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  )

const propNames = (name: string) =>
  typeProps(ENTRY.contract, name).map(prop => prop.name)

const isStock = (file: string) => /[\\/]node_modules[\\/]/.test(file)

/** Свойства записей карты фич: стоковых TanStack или фич Tessera. */
const featureMapProps = (name: string, stock: boolean) =>
  unique(
    featureMapEntries(ENTRY.contract, name)
      .filter(entry => isStock(entry.file) === stock)
      .flatMap(entry => entry.props),
  )

/** Ключи опций таблицы стоковых фич TanStack. */
export const stockTableOptionKeys = () =>
  unique([
    ...propNames('StockTableOptionsCore'),
    ...featureMapProps('TableOptionsFeatureMap', true),
  ])

/** Ключи опций таблицы, которые объявляют фичи Tessera в карте фич. */
export const ownTableOptionKeys = () =>
  featureMapProps('TableOptionsFeatureMap', false)

/** Ключи опций таблицы, которые выставляют встроенные плагины. */
export const pluginOptionKeys = () => unique([...optionEmitters().keys()])

/** Ключи опций ядра `CommonOptions`. */
export const coreOptionKeys = () => unique(propNames('CommonOptions'))

/** Поля описания колонки стоковых фич TanStack. */
export const stockColumnDefFields = () =>
  unique([
    ...propNames('StockColumnDefBase'),
    ...propNames('StockAccessorKeyColumnDef'),
    ...propNames('StockAccessorFnColumnDef'),
    ...propNames('StockGroupColumnDef'),
    ...featureMapProps('ColumnDefFeatureMap', true),
  ])

/** Свои поля описания колонки: записи фич Tessera в `ColumnDef_FeatureMap`. */
export const ownColumnDefFields = () =>
  featureMapProps('ColumnDefFeatureMap', false)

/** Поля публичной записи плагина `TablePlugin`. */
export const pluginEntryKeys = () => unique(propNames('TablePlugin'))

/** Поля внутренней записи `TesseraFeatureEntry` сверх `TablePlugin`. */
export const internalEntryKeys = () => {
  const publicKeys = new Set(pluginEntryKeys())
  return unique(propNames('TesseraFeatureEntry')).filter(
    key => !publicKeys.has(key),
  )
}

/** LB10: ADR с номером больше `after` без строки `- **Слой:** …` в шапке. */
export const adrsWithoutLayer = (after: number) =>
  readdirSync(DECISIONS)
    .filter(name => Number(/^(\d{4})-/.exec(name)?.[1] ?? 0) > after)
    .filter(
      name =>
        !/^- \*\*Слой:\*\*/m.test(readFileSync(`${DECISIONS}${name}`, 'utf8')),
    )
    .sort()
