// Строгая проверка справочника API (ADR 0113, DC7, DC15): TypeDoc по конфигу сайта без
// вывода страниц — предупреждение роняет проверку; описание с кириллицей — тоже.
// Запуск из корня: `npm run docs:api`.

import { fileURLToPath } from 'node:url'

import { Application, LogLevel } from 'typedoc'

import config from '../typedoc.config.mjs'

const CYRILLIC = /[А-Яа-яЁё]/

const textOf = comment =>
  comment
    ? [
        ...(comment.summary ?? []),
        ...(comment.blockTags ?? []).flatMap(tag => tag.content),
      ]
        .map(part => part.text)
        .join('')
    : ''

/** Описания справочника с кириллицей: путь отражения и начало текста. */
export const russianComments = project => {
  const found = []
  const seen = new Set()
  const visit = (node, path) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) return node.forEach(child => visit(child, path))
    const here = node.name ? `${path}/${node.name}` : path
    const text = textOf(node.comment)
    if (CYRILLIC.test(text)) found.push(`${here}: ${text.slice(0, 80)}`)
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'parent' && value && typeof value === 'object')
        visit(value, here)
    }
  }
  visit(project, '')
  return found
}

// Пути конфига — от папки сайта.
process.chdir(fileURLToPath(new URL('..', import.meta.url)))

const app = await Application.bootstrapWithPlugins({
  ...config,
  options: undefined,
  treatWarningsAsErrors: true,
  logLevel: LogLevel.Warn,
})
const project = await app.convert()
if (!project) process.exit(1)
app.validate(project)
if (app.logger.hasErrors() || app.logger.hasWarnings()) {
  console.error('[docs:api] TypeDoc reported problems — see above')
  process.exit(1)
}
const russian = russianComments(
  app.serializer.projectToObject(project, process.cwd()),
)
if (russian.length) {
  console.error(
    `[docs:api] ${russian.length} API descriptions are not in English (ADR 0113, §5a):`,
  )
  for (const line of russian) console.error(`  ${line}`)
  process.exit(1)
}
console.log(
  '[docs:api] API reference: no warnings, all descriptions in English',
)
