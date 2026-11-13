/**
 * Тон опасного действия (ADR 0206): `tone` в публичных типах кнопок и дескрипторов (DX9) и
 * страж подписей опасных действий без тона (DX11).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { ENTRY, exportNames, typeProps } from './publicTypes'

/** Программа TypeScript публичных типов строится дольше умолчания теста. */
const TYPES_TIMEOUT = 120_000

const LIB = fileURLToPath(new URL('..', import.meta.url))

/** Опасные действия: ключ словаря → подпись по умолчанию и файл словаря. */
const DANGER_KEYS = {
  failureDiscard: ['Discard change', 'core/localization/labels.ts'],
  cellDraftRollback: ['Roll back', 'plugins/cellEditing/labels.ts'],
  rowInsertDiscard: ['Remove row', 'plugins/cellEditing/labels.ts'],
  draftDiscard: ['Discard', 'plugins/unsavedChanges/labels.ts'],
  draftDiscardAll: ['Discard all', 'plugins/unsavedChanges/labels.ts'],
} as const

/** Подписи опасных действий строкой — встроенные и демо-действие «Delete». */
const DANGER_LABELS = new Set<string>([
  'Delete',
  ...Object.values(DANGER_KEYS).map(([label]) => label),
])

/** Кнопка, пункт или дескриптор с опасной подписью без тона: место → причина. */
const EXCEPTIONS: Record<string, string> = {}

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : []
  })

/** Подпись или ключ опасного действия. */
const isDangerMention = (node: ts.Node) =>
  (ts.isStringLiteralLike(node) &&
    (DANGER_LABELS.has(node.text) || node.text in DANGER_KEYS)) ||
  (ts.isPropertyAccessExpression(node) && node.name.text in DANGER_KEYS)

const propName = (prop: ts.ObjectLiteralElementLike) =>
  prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
    ? prop.name.text
    : undefined

/** Дескриптор действия — объект с `onSelect`; у него свой тон. */
const isDescriptor = (node: ts.Node): node is ts.ObjectLiteralExpression =>
  ts.isObjectLiteralExpression(node) &&
  node.properties.some(prop => propName(prop) === 'onSelect')

const LABEL_ATTRS = new Set(['label', 'aria-label', 'title'])

const opening = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  ts.isJsxElement(node) ? node.openingElement : node

/**
 * Носитель упоминания: дескриптор, внутри которого оно стоит, или элемент JSX, у которого оно —
 * подпись (атрибут или содержимое). Остальное — словарь, справочник действий, проверки клавиш.
 */
const carrierOf = (mention: ts.Node) => {
  let child: ts.Node = mention
  for (let node = mention.parent; node; child = node, node = node.parent) {
    if (isDescriptor(node))
      return {
        node,
        toned: node.properties.some(prop => propName(prop) === 'tone'),
      }
    if (ts.isJsxAttribute(node) && !LABEL_ATTRS.has(node.name.getText()))
      return undefined
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const inChildren =
        ts.isJsxElement(node) && node.children.some(item => item === child)
      const inAttrs = child === opening(node) || ts.isJsxAttributes(child)
      if (!inChildren && !inAttrs) return undefined
      return {
        node: opening(node),
        toned: opening(node).attributes.properties.some(
          attr => ts.isJsxAttribute(attr) && attr.name.getText() === 'tone',
        ),
      }
    }
    if (ts.isFunctionDeclaration(node) || ts.isSourceFile(node))
      return undefined
  }
  return undefined
}

/** Носители опасных подписей без тона: `файл:строка` → текст упоминания. */
const untoned = () => {
  const found: Record<string, string> = {}
  for (const file of sources(LIB)) {
    const text = readFileSync(file, 'utf8')
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const visit = (node: ts.Node) => {
      if (isDangerMention(node)) {
        const carrier = carrierOf(node)
        if (carrier && !carrier.toned) {
          const { line } = source.getLineAndCharacterOfPosition(
            carrier.node.getStart(),
          )
          const at = `${relative(LIB, file).replaceAll('\\', '/')}:${line + 1}`
          found[at] = node.getText()
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return found
}

describe('Тон опасного действия (ADR 0206)', () => {
  it(
    'DX9: тип tone?: "danger" — в публичных типах пропсов Button, IconButton и производных кнопок /ui и у дескрипторов действий SlotAction и ContextMenuAction (наследники MenuAction) — значением или функцией контекста; тип ActionTone — из главного входа',
    () => {
      expect(exportNames(ENTRY.index)).toContain('ActionTone')
      const buttons = exportNames(ENTRY.ui).filter(name =>
        /^(Button|IconButton|.+Button)Props$/.test(name),
      )
      expect(buttons).toEqual(
        expect.arrayContaining(['ButtonProps', 'IconButtonProps']),
      )
      for (const name of buttons) {
        const tone = typeProps(ENTRY.ui, name).find(
          prop => prop.name === 'tone',
        )
        expect(tone?.type, name).toBe('"danger"')
      }
      for (const name of ['SlotAction', 'ContextMenuAction']) {
        const tone = typeProps(ENTRY.index, name).find(
          prop => prop.name === 'tone',
        )
        expect(tone?.type, name).toContain('"danger"')
        expect(tone?.isFunction, `${name}: тон функцией контекста`).toBe(true)
      }
    },
    TYPES_TIMEOUT,
  )

  it('DX11: кнопка, пункт или дескриптор действия в src/lib (код и истории) с подписью опасного действия — «Delete», «Remove row», «Discard», «Discard all», «Discard change», «Roll back» и их ключи словаря — без tone: "danger" роняет тест; исключения — с причиной', () => {
    // Подписи и ключи — те, что в словарях.
    for (const [key, [label, file]] of Object.entries(DANGER_KEYS))
      expect(readFileSync(join(LIB, file), 'utf8'), key).toContain(
        `${key}: '${label}'`,
      )
    const found = untoned()
    const unexpected = Object.entries(found)
      .filter(([at]) => !(at in EXCEPTIONS))
      .map(([at, mention]) => `${at} ${mention}`)
    expect(
      unexpected,
      "опасное действие без tone: 'danger' (ADR 0206)",
    ).toEqual([])
    // Список только сокращается: ушедшее место снимает исключение.
    expect(
      Object.keys(EXCEPTIONS).filter(at => !(at in found)),
      'устаревшие исключения',
    ).toEqual([])
    for (const why of Object.values(EXCEPTIONS))
      expect(why.length).toBeGreaterThan(10)
  })
})
