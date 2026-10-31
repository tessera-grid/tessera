/**
 * Граф импортов `src/lib` для стражей слоёв (ADR 0163): рёбра относительных импортов,
 * реэкспортов и динамических `import()` без тестов и историй; у каждого модуля — слой.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIB = fileURLToPath(new URL('..', import.meta.url))
const SRC = resolve(LIB, '..')

/** Слой модуля (ADR 0163, §1); `entry` — входы пакета, `vendor` — исходники пакета (ADR 0143). */
export type Layer =
  'util' | 'ui' | 'core' | 'grid' | 'shared' | 'plugins' | 'entry' | 'vendor'

/** Какие слои может импортировать слой; вендор — как пакет, любому слою. */
export const ALLOWED: Record<Layer, readonly Layer[]> = {
  util: [],
  ui: ['util'],
  core: ['util'],
  grid: ['core', 'ui', 'util'],
  shared: ['core', 'ui', 'util'],
  plugins: ['core', 'ui', 'util', 'shared'],
  entry: ['util', 'ui', 'core', 'grid', 'shared', 'plugins'],
  vendor: [],
}

export interface Module {
  /** Путь от `src/`: `lib/core/features.ts`, `index.ts`. */
  path: string
  layer: Layer
  /** Папка плагина для слоя `plugins`. */
  plugin?: string
}

export interface Edge {
  from: Module
  to: Module
  typeOnly: boolean
}

const SKIPPED_DIRS = new Set(['__tests__', 'stories', '__mocks__'])

const toPath = (file: string) => relative(SRC, file).split('\\').join('/')

export const moduleOf = (path: string): Module => {
  const parts = path.split('/')
  if (parts[0] === 'vendor') return { path, layer: 'vendor' }
  if (parts[0] !== 'lib') return { path, layer: 'entry' }
  const [, area, name] = parts
  if (area === 'plugins') {
    return name === 'index.ts'
      ? { path, layer: 'entry' }
      : { path, layer: 'plugins', plugin: name }
  }
  // `lib/types.ts` — типы TanStack с контрактом `commonFeature`: часть ядра.
  if (area === 'types.ts') return { path, layer: 'core' }
  return { path, layer: area as Layer }
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return SKIPPED_DIRS.has(name) ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)
      ? [path]
      : []
  })

const isFile = (path: string) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

const resolveImport = (from: string, specifier: string) => {
  const base = resolve(dirname(from), specifier)
  return [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    base,
  ].find(isFile)
}

const IMPORT =
  /(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g

/** Модули `src/lib` и входы `src/*.ts`, без тестов и историй. */
export const modules = (): Module[] =>
  [
    ...sourceFiles(LIB),
    ...readdirSync(SRC)
      .filter(name => /\.ts$/.test(name))
      .map(name => join(SRC, name)),
  ].map(file => moduleOf(toPath(file)))

let cached: Edge[] | undefined

/** Рёбра графа; импорт только типов — тоже ребро. */
export const edges = (): Edge[] => {
  if (cached) return cached
  cached = modules().flatMap(from => {
    const file = join(SRC, from.path)
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(IMPORT)].flatMap(match => {
      const target = resolveImport(file, match[2] ?? match[3])
      return target
        ? [{ from, to: moduleOf(toPath(target)), typeOnly: !!match[1] }]
        : []
    })
  })
  return cached
}

/** Текст модуля по пути от `src/`. */
export const sourceOf = (path: string) => readFileSync(join(SRC, path), 'utf8')

/** Ключ ребра для базы: `lib/core/a.ts -> lib/ui/b.ts`. */
export const edgeKey = ({ from, to }: Edge) => `${from.path} -> ${to.path}`
