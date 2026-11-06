// Tree-shaking плагинов (ADR 0010, IV3): потребитель, импортирующий один плагин из
// `@tessera-grid/tessera/plugins`, не получает в сборке кода остальных. Для каждого
// плагина собираем vite-приложение из одного импорта поверх `dist` и смотрим, модули
// каких плагинов (`dist/lib/plugins/<плагин>/`) попали в сборку. Запуск: после
// `npm run build` — `npm run check:tree-shaking`. Интерфейс несёт свою модель
// (ADR 0120, MP11): ему разрешены модели по цепочке `entry.model`, модели интерфейс — нет.
// `DataGrid` с `useCreateTable` без плагинов не тянет модулей плагинов кроме базы, а размер
// его сборки после gzip держится в бюджете `scripts/core-budget.json` (ADR 0163, LB3–LB4), импорта
// `@dnd-kit/*` в ней нет: перетаскивание — в плагинах (ADR 0168, DM2).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build } from 'vite'

const root = process.cwd()
const dist = resolve(root, 'dist/plugins.js')
const distIndex = resolve(root, 'dist/index.js')
const budgetPath = resolve(root, 'scripts/core-budget.json')
/** Допуск бюджета: рост больше него роняет проверку, уменьшение — подсказка (LB4). */
const BUDGET_TOLERANCE = 0.01
const work = resolve(root, 'node_modules/.cache/check-tree-shaking')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })

const exported = await import(pathToFileURL(dist).href)
/** Экспорты-фабрики плагинов: вызов без аргументов даёт запись с `id`. */
const plugins = Object.entries(exported)
  .filter(([, value]) => {
    if (typeof value !== 'function') return false
    try {
      return typeof value()?.id === 'string'
    } catch {
      return false
    }
  })
  .map(([name]) => name)

/** Модели, которые несёт плагин: цепочка `entry.model` его записи. */
const modelsOf = name => {
  const ids = new Set()
  for (let model = exported[name]().model; model; model = model.model) {
    ids.add(model.id)
  }
  return ids
}

const PLUGIN_MODULE = /\/dist\/lib\/plugins\/([^/]+)\//

const importPath = file => JSON.stringify(file.split('\\').join('/'))

/** Сборка приложения из одного импорта: каталоги плагинов в ней и размер после gzip. */
const bundle = async (name, source) => {
  const entry = resolve(work, `${name}.js`)
  writeFileSync(entry, source)
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['es'], fileName: name },
      rollupOptions: {
        external: [
          /^react(\/|$)/,
          /^react-dom(\/|$)/,
          /^@tanstack\//,
          /^@dnd-kit\//,
        ],
      },
    },
  })
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap(output => output.output)
    .filter(chunk => chunk.type === 'chunk')
  const pluginDirs = new Set(
    chunks
      .flatMap(chunk => chunk.moduleIds)
      .map(id => PLUGIN_MODULE.exec(id.split('\\').join('/'))?.[1])
      .filter(Boolean),
  )
  const gzip = chunks.reduce(
    (sum, chunk) => sum + gzipSync(chunk.code).length,
    0,
  )
  const externals = new Set(
    chunks.flatMap(chunk => [...chunk.imports, ...chunk.dynamicImports]),
  )
  const modules = chunks.flatMap(chunk => chunk.moduleIds)
  return { plugins: pluginDirs, gzip, externals, modules }
}

/** Каталоги плагинов, чьи модули попали в сборку потребителя с одним импортом. */
const bundledPlugins = async name =>
  (
    await bundle(
      name,
      `import { ${name} } from ${importPath(dist)}\nconsole.log(${name})\n`,
    )
  ).plugins

const failures = []
for (const name of plugins) {
  const included = await bundledPlugins(name)
  if (!included.has(name)) {
    failures.push(
      `${name}: в сборке нет модулей самого плагина — проверка его не видит`,
    )
    continue
  }
  const models = modelsOf(name)
  const leaked = [...included].filter(
    other => other !== name && !models.has(other),
  )
  if (leaked.length > 0) {
    failures.push(`${name}: в сборку попали ${leaked.join(', ')}`)
  }
}

// LB3–LB4: `DataGrid` без плагинов. База каталогов плагинов только сокращается.
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'))
const grid = await bundle(
  'dataGrid',
  `import { DataGrid, useCreateTable } from ${importPath(distIndex)}\nconsole.log(DataGrid, useCreateTable)\n`,
)
for (const name of [...grid.plugins].sort()) {
  if (!(name in budget.pluginModules)) {
    failures.push(`DataGrid без плагинов: в сборку попал плагин ${name}`)
  }
}
// DM2: перетаскивание — в плагинах, dnd-kit без них в сборку не попадает (ADR 0168).
for (const id of [...grid.externals].sort()) {
  if (id.startsWith('@dnd-kit/')) {
    failures.push(`DataGrid без плагинов: в сборке импорт ${id}`)
  }
}
// CH10, CH13: механика выделения ячеек, контекстного меню и линий дерева — в плагинах,
// без них в сборку не попадает (ADR 0170).
const FLAG_MECHANICS = [
  ['выделения ячеек', /cellSelection|clipboard/i],
  ['контекстного меню', /contextMenu/i],
  ['линий дерева', /treeLines|treeBranches/i],
  // PK11: список вариантов и календарь кита — только у плагинов (ADR 0183).
  ['списка вариантов кита', /\/ui\/Checklist\//],
  ['календаря кита', /\/ui\/Calendar\//],
]
for (const id of grid.modules) {
  const path = id.split('\\').join('/')
  // Только модули библиотеки: у Base UI свои модули меню в `dist/node_modules`.
  const at = path.lastIndexOf('/dist/lib/')
  if (at < 0) continue
  const own = path.slice(at)
  for (const [name, pattern] of FLAG_MECHANICS) {
    if (pattern.test(own)) {
      failures.push(`DataGrid без плагинов: в сборке модуль ${name} ${path}`)
    }
  }
}
for (const [name, reason] of Object.entries(budget.pluginModules)) {
  if (!grid.plugins.has(name)) {
    failures.push(
      `DataGrid без плагинов: ${name} в сборке нет — уберите запись из core-budget.json`,
    )
  }
  if (reason.length < 10) {
    failures.push(`core-budget.json: у ${name} нет причины`)
  }
}
const limit = Math.floor(budget.gzipBytes * (1 + BUDGET_TOLERANCE))
if (grid.gzip > limit) {
  failures.push(
    `DataGrid без плагинов: ${grid.gzip} байт gzip больше бюджета ${budget.gzipBytes} + 1 % — новое значение записывают в core-budget.json осознанно`,
  )
} else if (grid.gzip < budget.gzipBytes * (1 - BUDGET_TOLERANCE)) {
  console.log(
    `[check-tree-shaking] DataGrid без плагинов — ${grid.gzip} байт gzip: меньше бюджета ${budget.gzipBytes}, снизьте запись в core-budget.json`,
  )
}
rmSync(work, { recursive: true, force: true })

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[check-tree-shaking] ${failure}`)
  }
  process.exit(1)
}
console.log(
  `[check-tree-shaking] OK — ${plugins.length} плагинов, импорт одного не тянет остальные; DataGrid без плагинов — ${grid.gzip} байт gzip (бюджет ${budget.gzipBytes})`,
)
