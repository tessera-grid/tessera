// Декларации пакета для потребителя (ADR 0091, EV7–EV8): относительные импорты `.d.ts`
// с расширением — их находит `moduleResolution: node16`; копия дерева в `.d.cts` —
// типы для `require`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.d.ts']

/**
 * Дописывает к относительным импортам декларации `.js` (модуль-файл) или `/index.js`
 * (папка с `index`). `sourceDir` — папка исходника этой декларации.
 */
export const withExtensions = (content: string, sourceDir: string): string =>
  content.replace(
    SPECIFIER,
    (match, head: string, quote: string, spec: string) => {
      if (/\.(c|m)?js$|\.css$/.test(spec)) return match
      const base = resolve(sourceDir, spec)
      const isFile = SOURCE_EXTENSIONS.some(ext => existsSync(base + ext))
      const isFolder =
        !isFile &&
        ['index.ts', 'index.tsx'].some(name => existsSync(join(base, name)))
      const target = isFolder ? `${spec}/index.js` : `${spec}.js`
      return `${head}${quote}${target}${quote}`
    },
  )

/** Декларация для `require`: относительные `.js` становятся `.cjs`. */
export const toCommonJs = (content: string): string =>
  content.replace(
    SPECIFIER,
    (match, head: string, quote: string, spec: string) =>
      `${head}${quote}${spec.replace(/\.js$/, '.cjs')}${quote}`,
  )

const declarations = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : declarations(path)
    }
    return entry.name.endsWith('.d.ts') ? [path] : []
  })

/** Пишет рядом с каждой `.d.ts` в `outDir` её `.d.cts`. */
export const writeCommonJsDeclarations = (outDir: string): number => {
  const files = declarations(outDir)
  for (const file of files) {
    writeFileSync(
      file.replace(/\.d\.ts$/, '.d.cts'),
      toCommonJs(readFileSync(file, 'utf8')),
    )
  }
  return files.length
}
