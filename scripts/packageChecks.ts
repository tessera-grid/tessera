// Пакет глазами потребителя (ADR 0091, EV7–EV9): входы, директива `'use client'` и
// приложения-фикстуры, в которые `check:package` ставит архив пакета.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Входы пакета (`exports`): `.`, `./plugins`, `./ui`. */
export const ENTRIES = ['index', 'plugins', 'ui'] as const

/** Файлы входов `dist` без директивы `'use client'` первой строкой. */
export const missingUseClient = (distDir: string): string[] =>
  ENTRIES.flatMap(entry => [`${entry}.js`, `${entry}.cjs`]).filter(file => {
    const path = join(distDir, file)
    return (
      !existsSync(path) ||
      !/^\s*(['"])use client\1;?/.test(readFileSync(path, 'utf8'))
    )
  })

/** Поля пакета для реестра и GitHub (ADR 0103, CI12): чего не хватает. */
export const missingMetadata = (root: string): string[] => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    license?: string
    repository?: { url?: string }
    homepage?: string
    bugs?: { url?: string }
    engines?: { node?: string }
  }
  const missing: string[] = []
  if (pkg.license !== 'MIT') missing.push('license: MIT')
  if (!existsSync(join(root, 'LICENSE'))) missing.push('файл LICENSE')
  if (!pkg.repository?.url) missing.push('repository.url')
  if (!pkg.homepage) missing.push('homepage')
  if (!pkg.bugs?.url) missing.push('bugs.url')
  if (!pkg.engines?.node) missing.push('engines.node')
  return missing
}

/**
 * Ошибки `tsc` (вывод `--pretty false`), которые относятся к коду фикстуры или к
 * декларациям пакета. Ошибки в чужих декларациях (`node_modules`) — не наши.
 */
export const ownTypeErrors = (output: string, pkg = '@tessera-grid/tessera') =>
  output
    .split('\n')
    .filter(line => /\berror TS\d+:/.test(line))
    .filter(
      line =>
        !line.startsWith('node_modules/') ||
        line.startsWith(`node_modules/${pkg}/`),
    )

export interface Fixture {
  name: string
  /** Зависимости приложения; архив пакета добавляет скрипт. */
  dependencies: Record<string, string>
  files: Record<string, string>
  /** Команды по порядку; любая с ненулевым кодом роняет проверку. */
  commands: string[][]
}

/** Код потребителя: все входы, хук, грид, плагин и примитив; типы — не `any`. */
const APP = `import { DataGrid, useCreateTable } from '@tessera-grid/tessera'
import { rowSelection } from '@tessera-grid/tessera/plugins'
import { Switch } from '@tessera-grid/tessera/ui'

interface Row {
  id: string
  name: string
}

const data: Row[] = [{ id: '1', name: 'Ann' }]

export const App = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }],
    data,
    plugins: [rowSelection()],
  })
  return (
    <>
      <DataGrid table={table} colorMode="auto" />
      {/* @ts-expect-error — типы пакета разрешены: число вместо таблицы — ошибка. */}
      <DataGrid table={42} />
      <Switch aria-label="On" />
    </>
  )
}
`

/** Входы в Node: ESM (\`.mts\`) и CJS (\`.cts\`, импорт компилируется в require). */
const NODE_ENTRIES = `import { DataGrid, useCreateTable } from '@tessera-grid/tessera'
import { rowSelection } from '@tessera-grid/tessera/plugins'
import { Switch } from '@tessera-grid/tessera/ui'

export const entries = [DataGrid, useCreateTable, rowSelection, Switch]
// @ts-expect-error — типы пакета разрешены: DataGrid не строка.
export const wrong: string = DataGrid
`

/** Компоненты — функции или объекты \`forwardRef\`/\`memo\`. */
const RUNTIME_CHECK = `for (const [name, value] of Object.entries(entries)) {
  const component =
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  if (!component) throw new Error(name + ': ' + typeof value)
}
`

/** \`tsc\`, который падает только на ошибках фикстуры и деклараций пакета. */
const TSC = `import { execFileSync } from 'node:child_process'

const project = process.argv[2]
let output = ''
try {
  execFileSync('npx', ['tsc', '-p', project, '--pretty', 'false'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
} catch (error) {
  output = String(error.stdout ?? '')
}
const own = (${ownTypeErrors.toString()})(output)
if (own.length > 0) {
  console.error(own.join('\\n'))
  process.exit(1)
}
`

const tsconfig = (options: Record<string, unknown>, include: string[]) =>
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        jsx: 'react-jsx',
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        ...options,
      },
      include,
    },
    null,
    2,
  )

const BUNDLER = { module: 'ESNext', moduleResolution: 'bundler' }
const REACT_TABLE = '^9'
const TYPESCRIPT = '^5'

export const FIXTURES: Fixture[] = [
  {
    name: 'react19',
    dependencies: {
      react: '^19',
      'react-dom': '^19',
      '@tanstack/react-table': REACT_TABLE,
      '@types/react': '^19',
      '@types/react-dom': '^19',
      typescript: TYPESCRIPT,
      vite: '^7',
    },
    files: {
      'app.tsx': APP,
      'main.tsx': `import '@tessera-grid/tessera/style.css'
import { createRoot } from 'react-dom/client'

import { App } from './app'

createRoot(document.getElementById('root')!).render(<App />)
`,
      'index.html': `<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>\n`,
      'tsconfig.json': tsconfig(BUNDLER, ['app.tsx', 'main.tsx']),
      // ESM в Node16. CJS — в nodenext: TanStack Table v9 только ESM, а require(esm)
      // в типах понимает лишь nodenext.
      'tsconfig.node16.json': tsconfig(
        { module: 'node16', moduleResolution: 'node16' },
        ['esm.mts'],
      ),
      'tsconfig.nodenext.json': tsconfig(
        { module: 'nodenext', moduleResolution: 'nodenext' },
        ['cjs.cts'],
      ),
      'esm.mts': NODE_ENTRIES,
      'cjs.cts': NODE_ENTRIES,
      'tsc.mjs': TSC,
      'runtime-esm.mjs': `import { DataGrid, useCreateTable } from '@tessera-grid/tessera'
import { rowSelection } from '@tessera-grid/tessera/plugins'
import { Switch } from '@tessera-grid/tessera/ui'

const entries = { DataGrid, useCreateTable, rowSelection, Switch }
${RUNTIME_CHECK}`,
      'runtime-cjs.cjs': `const { DataGrid, useCreateTable } = require('@tessera-grid/tessera')
const { rowSelection } = require('@tessera-grid/tessera/plugins')
const { Switch } = require('@tessera-grid/tessera/ui')

const entries = { DataGrid, useCreateTable, rowSelection, Switch }
${RUNTIME_CHECK}`,
      'check-css.mjs': `import { readdirSync } from 'node:fs'

const css = readdirSync('dist/assets').filter(file => file.endsWith('.css'))
if (css.length === 0) throw new Error('style.css не попал в сборку')
`,
    },
    commands: [
      ['node', 'tsc.mjs', 'tsconfig.json'],
      ['node', 'tsc.mjs', 'tsconfig.node16.json'],
      ['node', 'tsc.mjs', 'tsconfig.nodenext.json'],
      ['npx', 'vite', 'build', '--logLevel', 'error'],
      ['node', 'check-css.mjs'],
      ['node', 'runtime-esm.mjs'],
      ['node', 'runtime-cjs.cjs'],
    ],
  },
  {
    name: 'react18-types',
    dependencies: {
      react: '^18',
      'react-dom': '^18',
      '@tanstack/react-table': REACT_TABLE,
      '@types/react': '^18',
      '@types/react-dom': '^18',
      typescript: TYPESCRIPT,
    },
    files: {
      'app.tsx': APP,
      'tsc.mjs': TSC,
      'tsconfig.json': tsconfig(BUNDLER, ['app.tsx']),
    },
    commands: [['node', 'tsc.mjs', 'tsconfig.json']],
  },
]
