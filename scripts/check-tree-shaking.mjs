// Tree-shaking плагинов (ADR 0010, IV3): потребитель, импортирующий один плагин из
// `@tessera-grid/tessera/plugins`, не получает в сборке кода остальных. Для каждого
// плагина собираем vite-приложение из одного импорта поверх `dist` и смотрим, модули
// каких плагинов (`dist/lib/plugins/<плагин>/`) попали в сборку. Запуск: после
// `npm run build` — `npm run check:tree-shaking`.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'vite'

const root = process.cwd()
const dist = resolve(root, 'dist/plugins.js')
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

const PLUGIN_MODULE = /\/dist\/lib\/plugins\/([^/]+)\//

/** Каталоги плагинов, чьи модули попали в сборку потребителя с одним импортом. */
const bundledPlugins = async name => {
  const entry = resolve(work, `${name}.js`)
  writeFileSync(
    entry,
    `import { ${name} } from ${JSON.stringify(dist.split('\\').join('/'))}\nconsole.log(${name})\n`,
  )
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
  const moduleIds = (Array.isArray(result) ? result : [result])
    .flatMap(output => output.output)
    .filter(chunk => chunk.type === 'chunk')
    .flatMap(chunk => chunk.moduleIds)
  return new Set(
    moduleIds
      .map(id => PLUGIN_MODULE.exec(id.split('\\').join('/'))?.[1])
      .filter(Boolean),
  )
}

const failures = []
for (const name of plugins) {
  const included = await bundledPlugins(name)
  if (!included.has(name)) {
    failures.push(
      `${name}: в сборке нет модулей самого плагина — проверка его не видит`,
    )
    continue
  }
  const leaked = [...included].filter(other => other !== name)
  if (leaked.length > 0) {
    failures.push(`${name}: в сборку попали ${leaked.join(', ')}`)
  }
}
rmSync(work, { recursive: true, force: true })

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[check-tree-shaking] ${failure}`)
  }
  process.exit(1)
}
console.log(
  `[check-tree-shaking] OK — ${plugins.length} плагинов, импорт одного не тянет остальные`,
)
