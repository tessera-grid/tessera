/**
 * Статический разбор файлов историй для стражей ADR 0151: раздел, истории по порядку,
 * их имена, сценарии и шаги гайдов — без загрузки модулей.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'

export const STORIES = join(__dirname, '..', 'stories')

export interface StoryInfo {
  /** Имя экспорта. */
  id: string
  /** Имя в каталоге: `name` истории или экспорт по словам, как у Storybook. */
  name: string
  /** `parameters.scenario`, если задан строкой. */
  scenario?: string
  /** Названия шагов гайда (`steps={…}`), если он есть. */
  steps?: string[]
}

export interface StoryFile {
  file: string
  title: string
  /** Заголовок без `Tessera/DataGrid/` или `Tessera/`. */
  section: string
  stories: StoryInfo[]
}

/** Имя истории по умолчанию в Storybook: экспорт по словам. */
const startCase = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')

export const sectionOf = (title: string) =>
  title.replace(/^Tessera\/(DataGrid\/)?/, '')

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isSatisfiesExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node

const propOf = (node: ts.Expression | undefined, name: string) => {
  if (!node) return undefined
  const object = unwrap(node)
  if (!ts.isObjectLiteralExpression(object)) return undefined
  const prop = object.properties.find(
    item => ts.isPropertyAssignment(item) && item.name.getText() === name,
  ) as ts.PropertyAssignment | undefined
  return prop?.initializer
}

const stringOf = (node: ts.Expression | undefined) =>
  node && ts.isStringLiteralLike(node) ? node.text : undefined

/** Имя массива шагов в `steps={…}` внутри истории. */
const stepsName = (node: ts.Node) => {
  let found: string | undefined
  const visit = (current: ts.Node) => {
    if (
      ts.isJsxAttribute(current) &&
      current.name.getText() === 'steps' &&
      current.initializer &&
      ts.isJsxExpression(current.initializer) &&
      current.initializer.expression &&
      ts.isIdentifier(current.initializer.expression)
    ) {
      found = current.initializer.expression.text
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

const titlesOf = (array: ts.Expression | undefined) =>
  array && ts.isArrayLiteralExpression(array)
    ? array.elements.flatMap(element => {
        // Название шага — пара `{ ru, en }`, имя шага — русское (ADR 0225, §5).
        const title = ts.isObjectLiteralExpression(element)
          ? stringOf(propOf(propOf(element, 'title'), 'ru'))
          : undefined
        return title === undefined ? [] : [title]
      })
    : undefined

const parse = (file: string): StoryFile | undefined => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(STORIES, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const initializers = new Map<string, ts.Expression | undefined>()
  const exported: string[] = []
  let title: string | undefined
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const isExported = statement.modifiers?.some(
      m => m.kind === ts.SyntaxKind.ExportKeyword,
    )
    for (const item of statement.declarationList.declarations) {
      if (!ts.isIdentifier(item.name)) continue
      initializers.set(item.name.text, item.initializer)
      title ??= stringOf(propOf(item.initializer, 'title'))
      if (isExported) exported.push(item.name.text)
    }
  }
  if (!title) return undefined
  const stories = exported.map(id => {
    const story = initializers.get(id)
    const steps = story && stepsName(story)
    return {
      id,
      name: stringOf(propOf(story, 'name')) ?? startCase(id),
      scenario: stringOf(propOf(propOf(story, 'parameters'), 'scenario')),
      steps: steps ? titlesOf(initializers.get(steps)) : undefined,
    }
  })
  return { file, title, section: sectionOf(title), stories }
}

let cached: StoryFile[] | undefined

/** Все файлы историй с метой. */
export const storyFiles = () =>
  (cached ??= readdirSync(STORIES)
    .filter(name => name.endsWith('.stories.tsx'))
    .flatMap(name => parse(name) ?? []))

/** История по имени экспорта. */
export const storyById = (id: string) => {
  for (const file of storyFiles()) {
    const story = file.stories.find(item => item.id === id)
    if (story) return { file, story }
  }
  return undefined
}
