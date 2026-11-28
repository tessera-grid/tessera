import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { publicStoryIds } from '../../../scripts/storyIds'
import {
  cssVariables,
  iconKeys,
  labelKeys,
} from '../../../website/src/lib/reference'
import { translationStatus } from '../../../website/src/lib/translation'

// Сайт документации (ADR 0113): файлы `website/`, конфиги и workflow читаются как текст —
// пакеты сайта тесты библиотеки не импортируют (DC1). Сборку и деплой проверяют
// `npm run docs:build` и первый прогон на GitHub.

const ROOT = resolve(__dirname, '../../..')
const WEBSITE = join(ROOT, 'website')
const DOCS = join(WEBSITE, 'src/content/docs')
const read = (...path: string[]) => readFileSync(join(ROOT, ...path), 'utf8')

const SITE_PACKAGES = [
  'astro',
  '@astrojs/starlight',
  'starlight-typedoc',
  'typedoc',
  'typedoc-plugin-markdown',
]

/** Страницы сайта без сгенерированного справочника: путь от `docs/` и текст. */
const pages = (dir = DOCS): { id: string; text: string }[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return relative(DOCS, path).split('/').at(-1) === 'api' ? [] : pages(path)
    return /\.mdx?$/.test(entry.name)
      ? [{ id: relative(DOCS, path), text: readFileSync(path, 'utf8') }]
      : []
  })

const frontmatter = (text: string) =>
  text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''

const revisionOf = (text: string) => {
  const match = frontmatter(text).match(/^revision: (\d+)$/m)
  return match ? Number(match[1]) : undefined
}

describe('Docs site', () => {
  it('DC1: сайт — Starlight в website/ со своим package.json и base /tessera/; корень не зависит от пакетов сайта, сборка и тесты библиотеки сайт не трогают', () => {
    const site = JSON.parse(read('website/package.json'))
    for (const name of SITE_PACKAGES)
      expect(site.devDependencies, name).toHaveProperty(name)
    const root = JSON.parse(read('package.json'))
    for (const name of SITE_PACKAGES) {
      expect(root.dependencies ?? {}, name).not.toHaveProperty(name)
      expect(root.devDependencies ?? {}, name).not.toHaveProperty(name)
    }
    const config = read('website/astro.config.mjs')
    expect(config).toContain("from '@astrojs/starlight'")
    expect(config).toMatch(/BASE = '\/tessera\/'/)
    expect(config).toMatch(/base: BASE/)
    expect(read('vite.config.ts')).not.toMatch(/website/)
    for (const file of readdirSync(ROOT).filter(name =>
      /^vitest\..*config\.ts$/.test(name),
    ))
      expect(read(file), file).not.toMatch(/website/)
  })

  it('DC2: английская локаль в корне, русская в /ru/; у каждой русской страницы есть английская пара', () => {
    const config = read('website/astro.config.mjs')
    expect(config).toMatch(/defaultLocale: 'root'/)
    expect(config).toMatch(/root: \{ label: 'English', lang: 'en' \}/)
    expect(config).toMatch(/ru: \{ label: 'Русский', lang: 'ru' \}/)
    const ids = new Set(pages().map(page => page.id))
    const russian = [...ids].filter(id => id.startsWith('ru/'))
    expect(russian.length).toBeGreaterThan(0)
    for (const id of russian)
      expect(ids.has(id.slice('ru/'.length)), id).toBe(true)
  })

  it('DC3: у пары страниц revision; русская с меньшим показывает плашку «перевод устарел», с большим — роняет проверку', () => {
    expect(translationStatus(2, 2)).toBe('current')
    expect(translationStatus(3, 2)).toBe('outdated')
    expect(translationStatus(2, 3)).toBe('ahead')
    const banner = read('website/src/components/Banner.astro')
    expect(banner).toContain("=== 'outdated'")
    expect(read('website/astro.config.mjs')).toContain(
      "Banner: './src/components/Banner.astro'",
    )
    const byId = new Map(pages().map(page => [page.id, page.text]))
    for (const [id, text] of byId) {
      if (!id.startsWith('ru/')) continue
      const english = byId.get(id.slice('ru/'.length))!
      const [en, ru] = [revisionOf(english), revisionOf(text)]
      expect(en, `${id}: revision английской`).toBeDefined()
      expect(ru, `${id}: revision русской`).toBeDefined()
      expect(translationStatus(en, ru), id).not.toBe('ahead')
    }
  })

  it('DC4: навигация — восемь разделов по порядку, Features делится на Columns, Rows, Cells, Data', () => {
    const sidebar = read('website/sidebar.mjs')
    const list = sidebar.slice(sidebar.indexOf('export const sidebar'))
    const order = [
      ...list.matchAll(/^ {2}(?:group\('([^']+)'|(typeDocSidebarGroup))/gm),
    ].map(match => match[1] ?? 'API reference')
    expect(order).toEqual([
      'Getting started',
      'Core',
      'Features',
      'Customization',
      'Plugin authoring',
      'Accessibility',
      'API reference',
      'Resources',
    ])
    expect(sidebar).toContain("export const API_LABEL = 'API reference'")
    const features = list.slice(
      list.indexOf("group('Features'"),
      list.indexOf("group('Customization'"),
    )
    expect([...features.matchAll(/'features\/(\w+)'/g)].map(m => m[1])).toEqual(
      ['columns', 'rows', 'cells', 'data'],
    )
    expect(read('website/astro.config.mjs')).toMatch(
      /sidebar: \{ label: API_LABEL/,
    )
  })

  it('DC7: справочник API генерируется из входов ., /plugins и /ui при сборке и не хранится в git; предупреждение TypeDoc роняет docs:build; ci.yml собирает сайт на каждый пуш', () => {
    const config = read('website/typedoc.config.mjs')
    expect(config).toMatch(
      /entryPoints: \['\.\.\/src\/index\.ts', '\.\.\/src\/plugins\.ts', '\.\.\/src\/ui\.ts'\]/,
    )
    expect(read('.gitignore')).toContain('website/src/content/docs/api')
    const check = read('website/scripts/check-api.mjs')
    expect(check).toContain('treatWarningsAsErrors: true')
    expect(check).toMatch(/hasWarnings\(\)[\s\S]*process\.exit\(1\)/)
    const build = read('scripts/docs-build.mjs')
    expect(build.indexOf("'scripts/check-api.mjs'")).toBeGreaterThan(-1)
    expect(build.indexOf("'scripts/check-api.mjs'")).toBeLessThan(
      build.indexOf("'astro', 'build'"),
    )
    const ci = read('.github/workflows/ci.yml')
    expect(ci).toMatch(/push:\n\s+branches: \[master\]/)
    const docs = ci.slice(ci.indexOf('\n  docs:'))
    expect(docs).toContain('run: npm ci --prefix website')
    expect(docs).toContain('run: npm run docs:build')
  })

  it('DC8: списки CSS-переменных, ключей localization и icons — из кода; имя, упомянутое на странице, существует в коде', () => {
    const variables = new Set(cssVariables())
    const labels = new Set(labelKeys().map(entry => entry.key))
    const icons = new Set(iconKeys().map(entry => entry.key))
    expect(variables.has('--tsr-comp-accent')).toBe(true)
    expect(labels.has('table')).toBe(true)
    expect(labels.has('pagination.rowsPerPage')).toBe(true)
    expect(icons.has('drag')).toBe(true)
    const owners = new Set(
      [...labels]
        .filter(key => key.includes('.'))
        .map(key => key.split('.')[0]),
    )
    for (const kind of ['css', 'labels', 'icons'])
      expect(
        pages().some(page =>
          page.text.includes(`<ReferenceTable kind="${kind}"`),
        ),
        kind,
      ).toBe(true)
    for (const { id, text } of pages()) {
      // `--tsr-comp-*` — шаблон имени, а не переменная.
      for (const [name, wildcard] of text.matchAll(/--tsr-[a-z0-9-]+(\*)?/g))
        if (!wildcard) expect(variables.has(name), `${id}: ${name}`).toBe(true)
      for (const [, key] of text.matchAll(/`icons\.(\w+)`/g))
        expect(icons.has(key), `${id}: icons.${key}`).toBe(true)
      for (const [, owner, key] of text.matchAll(/`(\w+)\.(\w+)`/g))
        if (owners.has(owner))
          expect(labels.has(`${owner}.${key}`), `${id}: ${owner}.${key}`).toBe(
            true,
          )
    }
  })

  it('DC9: код страниц — из website/snippets, общий для обеих локалей и в typecheck; блоков tsx, ts, jsx в страницах нет', () => {
    const tsconfig = read('tsconfig.json')
    expect(tsconfig).toMatch(/"include": \[[^\]]*"website\/snippets"/)
    expect(tsconfig).toContain('"@tessera-grid/tessera": ["./src/index.ts"]')
    let imports = 0
    for (const { id, text } of pages()) {
      expect(text, id).not.toMatch(/^```(tsx|ts|jsx)\b/m)
      for (const [, path] of text.matchAll(/from '([^']+)\?raw'/g)) {
        imports++
        const file = resolve(DOCS, id, '..', path)
        expect(relative(WEBSITE, file), `${id}: ${path}`).toMatch(/^snippets\//)
        expect(existsSync(file), `${id}: ${path}`).toBe(true)
      }
    }
    expect(imports).toBeGreaterThan(0)
  })

  it('DC11: Storybook публикуется в /tessera/storybook/ публичной сборкой; каждая ссылка «Open in Storybook» ведёт на существующую в ней историю', () => {
    const build = read('scripts/docs-build.mjs')
    expect(build).toContain("'build-storybook:public'")
    expect(build).toContain("join(website, 'dist', 'storybook')")
    expect(read('website/src/lib/storybook.mjs')).toContain(
      "STORYBOOK_DIR = 'storybook'",
    )
    const ids = publicStoryIds(ROOT)
    let links = 0
    for (const { id, text } of pages())
      for (const [, story] of text.matchAll(/<StoryLink\s+id="([^"]+)"/g)) {
        links++
        expect(ids.has(story), `${id}: ${story}`).toBe(true)
      }
    expect(links).toBeGreaterThan(0)
  })

  it('DC12: release.yml после гейта публикует сайт и Storybook в GitHub Pages; есть ручной запуск; на сайте видна версия из package.json', () => {
    const release = read('.github/workflows/release.yml')
    const job = release.slice(release.indexOf('\n  docs:'))
    expect(job).toContain('needs: [barrier, prerelease]')
    expect(job).toContain('uses: ./.github/workflows/docs.yml')
    const docs = read('.github/workflows/docs.yml')
    expect(docs).toMatch(/^ {2}workflow_dispatch:/m)
    expect(docs).toMatch(/^ {2}workflow_call:/m)
    expect(docs).toContain('run: npm run docs:build\n')
    expect(docs).toContain('path: website/dist')
    expect(docs).toMatch(/uses: actions\/deploy-pages@v\d+/)
    const title = read('website/src/components/SiteTitle.astro')
    expect(title).toContain("import pkg from '../../../package.json'")
    expect(title).toContain('v{pkg.version}')
  })

  it('DC14: README.md — английская витрина со ссылками на сайт и Storybook, README.ru.md — она же на русском; руководства в README нет', () => {
    const SITE = 'https://tessera-grid.github.io/tessera/'
    const english = read('README.md')
    const russian = read('README.ru.md')
    for (const [text, name] of [
      [english, 'README.md'],
      [russian, 'README.ru.md'],
    ]) {
      expect(text, name).toContain('npm install @tessera-grid/tessera')
      expect(text, name).toMatch(/```tsx\n[\s\S]*useCreateTable[\s\S]*```/)
      expect(text, name).toContain(SITE)
      expect(text, name).toMatch(/storybook|chromatic\.com/i)
      expect(text.split('\n').length, name).toBeLessThan(120)
    }
    expect(english).not.toMatch(/[А-Яа-яЁё]/)
    expect(russian).toMatch(/[А-Яа-яЁё]/)
    expect(english).toContain('README.ru.md')
    expect(russian).toContain('README.md')
  })

  it('DC15: JSDoc публичных деклараций ., /plugins и /ui и их членов — на английском; тип вне экспорта назван в intentionallyNotExported с причиной', () => {
    const entries = ['index.ts', 'plugins.ts', 'ui.ts'].map(file =>
      join(ROOT, 'src', file),
    )
    const configPath = join(ROOT, 'tsconfig.json')
    const config = ts.readConfigFile(configPath, ts.sys.readFile).config
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, ROOT)
    const program = ts.createProgram({
      rootNames: entries,
      options: { ...options, noEmit: true },
    })
    const checker = program.getTypeChecker()
    const russian: string[] = []
    const seen = new Set<ts.Symbol>()
    const docsOf = (node: ts.Node) =>
      ts
        .getJSDocCommentsAndTags(node)
        .filter(ts.isJSDoc)
        .map(doc => doc.getText())
    const visit = (symbol: ts.Symbol, path: string, depth: number) => {
      if (seen.has(symbol) || depth > 2) return
      seen.add(symbol)
      for (const declaration of symbol.declarations ?? []) {
        if (declaration.getSourceFile().fileName.includes('node_modules'))
          continue
        for (const doc of docsOf(declaration))
          if (/[А-Яа-яЁё]/.test(doc))
            russian.push(`${path}: ${doc.slice(0, 80)}`)
      }
      const type = checker.getDeclaredTypeOfSymbol(symbol)
      const members =
        symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)
          ? checker.getPropertiesOfType(type)
          : []
      for (const member of members)
        visit(member, `${path}.${member.name}`, depth + 1)
    }
    for (const entry of entries) {
      const module = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!
      for (const exported of checker.getExportsOfModule(module)) {
        const symbol =
          exported.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exported)
            : exported
        visit(symbol, exported.name, 0)
      }
    }
    expect(russian).toEqual([])

    const typedoc = read('website/typedoc.config.mjs')
    const internal = typedoc.slice(
      typedoc.indexOf('const INTERNAL = {'),
      typedoc.indexOf('\n}\n'),
    )
    const names = [...internal.matchAll(/^ {2}(\w+): '([^']+)',$/gm)]
    expect(names.length).toBeGreaterThan(0)
    for (const [, name, reason] of names)
      expect(reason.trim().length, name).toBeGreaterThan(0)
    expect(typedoc).toContain('intentionallyNotExported: Object.keys(INTERNAL)')
    expect(typedoc).toMatch(/notExported: true/)
  })
})
