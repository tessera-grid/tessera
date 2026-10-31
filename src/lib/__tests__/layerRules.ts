/**
 * Нарушения правил слоёв и контракта для стражей ADR 0163: каждая функция отдаёт
 * отсортированный список, страж сверяет его с базой `architecture.baseline.ts`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
const ARG_SETS: unknown[] = [{}, { enabled: false }, { server: true }]

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

/**
 * LB5: чтения собственных ключей опций плагина вне его цепочки — `файл: ключ`.
 * `foreignKeys` — ключи TanStack и ядра: их страж не считает.
 */
export const foreignOptionReads = (foreignKeys: ReadonlySet<string>) => {
  const owners = new Map(
    [...optionEmitters()]
      .filter(([key]) => !foreignKeys.has(key))
      .map(([key, emitters]) => [
        key,
        new Set([...emitters].flatMap(emitter => [...familyOf(emitter)])),
      ]),
  )
  return unique(
    modules()
      .filter(module => module.layer !== 'entry')
      .flatMap(module =>
        [...sourceOf(module.path).matchAll(OPTION_READ)]
          .map(match => match[1])
          .filter(key => {
            const allowed = owners.get(key)
            return (
              allowed !== undefined &&
              !(module.plugin !== undefined && allowed.has(module.plugin))
            )
          })
          .map(key => `${module.path}: ${key}`),
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

/** Поля записи плагина `TesseraFeatureEntry`. */
export const pluginEntryKeys = () => unique(propNames('TesseraFeatureEntry'))

/** LB10: ADR с номером больше `after` без строки `- **Слой:** …` в шапке. */
export const adrsWithoutLayer = (after: number) =>
  readdirSync(DECISIONS)
    .filter(name => Number(/^(\d{4})-/.exec(name)?.[1] ?? 0) > after)
    .filter(
      name =>
        !/^- \*\*Слой:\*\*/m.test(readFileSync(`${DECISIONS}${name}`, 'utf8')),
    )
    .sort()
