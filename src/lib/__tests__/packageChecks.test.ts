/**
 * Пакет глазами потребителя (ADR 0091, EV7–EV9): фикстуры `check:package`, декларации
 * для node16 и `require`, директива `'use client'` во входах. Сам архив проверяет
 * `npm run check:package` после сборки.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import viteConfig from '../../../vite.config'
import {
  toCommonJs,
  withExtensions,
  writeCommonJsDeclarations,
} from '../../../scripts/declarations'
import {
  ENTRIES,
  FIXTURES,
  missingUseClient,
  ownTypeErrors,
} from '../../../scripts/packageChecks'

const dirs: string[] = []
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tessera-package-test-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('Пакет глазами потребителя', () => {
  it('EV7: фикстуры check:package — ESM на Vite со строгим TS и style.css, Node16 и nodenext, require и import в Node, типы с @types/react@18; tsc падает на своих ошибках, а не на чужих', () => {
    const react19 = FIXTURES.find(fixture => fixture.name === 'react19')!
    const react18 = FIXTURES.find(fixture => fixture.name === 'react18-types')!
    const commands = react19.commands.map(command => command.join(' '))

    expect(react19.files['main.tsx']).toContain(
      "import '@tessera-grid/tessera/style.css'",
    )
    expect(JSON.parse(react19.files['tsconfig.json']!)).toMatchObject({
      compilerOptions: { strict: true, moduleResolution: 'bundler' },
    })
    expect(JSON.parse(react19.files['tsconfig.node16.json']!)).toMatchObject({
      compilerOptions: { moduleResolution: 'node16' },
      include: ['esm.mts'],
    })
    expect(JSON.parse(react19.files['tsconfig.nodenext.json']!)).toMatchObject({
      compilerOptions: { moduleResolution: 'nodenext' },
      include: ['cjs.cts'],
    })
    expect(commands).toEqual([
      'node tsc.mjs tsconfig.json',
      'node tsc.mjs tsconfig.node16.json',
      'node tsc.mjs tsconfig.nodenext.json',
      'npx vite build --logLevel error',
      'node check-css.mjs',
      'node runtime-esm.mjs',
      'node runtime-cjs.cjs',
    ])
    expect(react18.dependencies['@types/react']).toBe('^18')
    // Код потребителя без приведений: таблица из useCreateTable идёт в DataGrid как есть.
    expect(react19.files['app.tsx']).toContain('<DataGrid table={table}')
    expect(react19.files['app.tsx']).not.toContain('as never')

    const output = [
      "app.tsx(3,1): error TS2322: Type 'number' is not assignable.",
      "node_modules/@dnd-kit/core/dist/a.d.ts(9,1): error TS2503: Cannot find namespace 'JSX'.",
      'node_modules/@tessera-grid/tessera/dist/index.d.ts(1,1): error TS2307: Cannot find module.',
      'Found 3 errors.',
    ].join('\n')
    expect(ownTypeErrors(output)).toEqual([
      "app.tsx(3,1): error TS2322: Type 'number' is not assignable.",
      'node_modules/@tessera-grid/tessera/dist/index.d.ts(1,1): error TS2307: Cannot find module.',
    ])
  })

  it('EV8: декларации для node16 — относительные импорты с .js или /index.js; рядом .d.cts с импортами .cjs', () => {
    const src = tempDir()
    mkdirSync(join(src, 'lib', 'core'), { recursive: true })
    writeFileSync(join(src, 'lib', 'core', 'table.ts'), '')
    writeFileSync(join(src, 'lib', 'core', 'index.ts'), '')
    const declaration = [
      "export { a } from './lib/core/table';",
      "export type { B } from './lib/core';",
      "export * from './styles.css';",
      "export * from './already.js';",
      "export { c } from '@tanstack/react-table';",
      "type T = import('./lib/core/table').T;",
    ].join('\n')

    const node16 = withExtensions(declaration, src)
    expect(node16.split('\n')).toEqual([
      "export { a } from './lib/core/table.js';",
      "export type { B } from './lib/core/index.js';",
      "export * from './styles.css';",
      "export * from './already.js';",
      "export { c } from '@tanstack/react-table';",
      "type T = import('./lib/core/table.js').T;",
    ])
    expect(toCommonJs(node16).split('\n')).toEqual([
      "export { a } from './lib/core/table.cjs';",
      "export type { B } from './lib/core/index.cjs';",
      "export * from './styles.css';",
      "export * from './already.cjs';",
      "export { c } from '@tanstack/react-table';",
      "type T = import('./lib/core/table.cjs').T;",
    ])

    const dist = tempDir()
    mkdirSync(join(dist, 'lib'), { recursive: true })
    mkdirSync(join(dist, 'node_modules', 'dep'), { recursive: true })
    writeFileSync(join(dist, 'index.d.ts'), "export * from './lib/a.js'")
    writeFileSync(join(dist, 'lib', 'a.d.ts'), 'export const a: 1')
    writeFileSync(join(dist, 'node_modules', 'dep', 'x.d.ts'), '')
    expect(writeCommonJsDeclarations(dist)).toBe(2)
    expect(readFileSync(join(dist, 'index.d.cts'), 'utf8')).toBe(
      "export * from './lib/a.cjs'",
    )
  })

  it("EV9: входы dist начинаются с 'use client' — сборка ставит баннер только входам", () => {
    const output = (
      viteConfig as {
        build: {
          rollupOptions: {
            output: { banner: (chunk: { isEntry: boolean }) => string }
          }
        }
      }
    ).build.rollupOptions.output
    expect(output.banner({ isEntry: true })).toBe("'use client';")
    expect(output.banner({ isEntry: false })).toBe('')

    const dist = tempDir()
    for (const entry of ENTRIES) {
      writeFileSync(join(dist, `${entry}.js`), `'use client';\nexport {}`)
      writeFileSync(join(dist, `${entry}.cjs`), `"use client";exports.a=1`)
    }
    expect(missingUseClient(dist)).toEqual([])
    writeFileSync(join(dist, 'ui.cjs'), `exports.a=1`)
    rmSync(join(dist, 'plugins.js'))
    expect(missingUseClient(dist)).toEqual(['plugins.js', 'ui.cjs'])
  })
})
