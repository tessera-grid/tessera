/**
 * Статический разбор языка историй (ADR 0225): кириллица вне поля `ru`, пары `{ ru, en }`
 * шагов и названий гайдов, имена шагов `play`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

export const STORIES = fileURLToPath(new URL('../stories', import.meta.url))

const CYRILLIC = /[А-Яа-яЁё]/

/** Файлы кода историй без тестов: путь от `src/lib/stories` через `/`. */
export const storySources = (): string[] => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__') walk(path)
      } else if (/\.tsx?$/.test(name)) {
        files.push(relative(STORIES, path).split(sep).join('/'))
      }
    }
  }
  walk(STORIES)
  return files.sort()
}

const sourceCache = new Map<string, ts.SourceFile>()

export const parseStory = (file: string) => {
  let source = sourceCache.get(file)
  if (!source) {
    source = ts.createSourceFile(
      file,
      readFileSync(join(STORIES, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    sourceCache.set(file, source)
  }
  return source
}

const nameOf = (node: ts.PropertyAssignment) =>
  ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
    ? node.name.text
    : node.name.getText()

/** Узел внутри значения свойства `ru`: русский текст пары. */
const insideRu = (node: ts.Node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isPropertyAssignment(current) && nameOf(current) === 'ru') {
      return true
    }
  }
  return false
}

/** Строки, шаблоны и JSX-текст с кириллицей вне поля `ru`: `строка: текст`. */
export const cyrillicOutsideRu = (file: string): string[] => {
  const source = parseStory(file)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isJsxText(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      CYRILLIC.test(node.text) &&
      !insideRu(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      found.push(`${line + 1}: ${node.text.trim().slice(0, 60)}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const propOf = (object: ts.ObjectLiteralExpression, name: string) =>
  (
    object.properties.find(
      item => ts.isPropertyAssignment(item) && nameOf(item) === name,
    ) as ts.PropertyAssignment | undefined
  )?.initializer

const textOf = (node: ts.Expression | undefined) =>
  node && (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))
    ? node.getText().slice(1, -1)
    : undefined

export interface Pair {
  ru?: string
  en?: string
  /** Значение — не литерал пары: его проверяют типы. */
  dynamic?: boolean
}

/** Пара `{ ru, en }` из выражения: литерал объекта или иное. */
export const pairOf = (node: ts.Expression | undefined): Pair => {
  if (!node) return {}
  if (ts.isParenthesizedExpression(node)) return pairOf(node.expression)
  if (ts.isStringLiteralLike(node)) return { ru: node.text }
  if (!ts.isObjectLiteralExpression(node)) return { dynamic: true }
  return { ru: textOf(propOf(node, 'ru')), en: textOf(propOf(node, 'en')) }
}

export interface GuideText {
  file: string
  line: number
  /** `title` и `hint` шага или `title` у `GuideStory`. */
  what: 'step title' | 'step hint' | 'guide title'
  pair: Pair
}

/** Тексты гайдов файла: названия и пояснения шагов, названия `GuideStory`. */
export const guideTexts = (file: string): GuideText[] => {
  const source = parseStory(file)
  const texts: GuideText[] = []
  const lineOf = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart()).line + 1
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const title = propOf(node, 'title')
      const hint = propOf(node, 'hint')
      if (title && hint) {
        texts.push({
          file,
          line: lineOf(title),
          what: 'step title',
          pair: pairOf(title),
        })
        texts.push({
          file,
          line: lineOf(hint),
          what: 'step hint',
          pair: pairOf(hint),
        })
      }
    }
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText() === 'GuideStory'
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText() === 'title' &&
          attribute.initializer
        ) {
          const value = ts.isJsxExpression(attribute.initializer)
            ? attribute.initializer.expression
            : attribute.initializer
          texts.push({
            file,
            line: lineOf(attribute),
            what: 'guide title',
            pair: pairOf(value as ts.Expression | undefined),
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return texts
}

/** Вызов внутри `play` истории сценария: у объекта истории есть `parameters.scenario`. */
const inScenarioPlay = (node: ts.Node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isObjectLiteralExpression(current)) continue
    const parameters = propOf(current, 'parameters')
    if (!propOf(current, 'play')) continue
    return (
      !!parameters &&
      ts.isObjectLiteralExpression(parameters) &&
      !!propOf(parameters, 'scenario')
    )
  }
  return false
}

/** Имена шагов `play` историй сценариев, которые не берутся из `title.ru` шага. */
export const playStepsNotByTitle = (file: string): string[] => {
  const source = parseStory(file)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'step' &&
      inScenarioPlay(node)
    ) {
      const name = node.arguments[0]
      const text = name?.getText().replace(/\s+/g, '') ?? ''
      if (!/\.title\.ru$/.test(text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        found.push(`${file}:${line + 1}: step(${text.slice(0, 40)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
