/**
 * `play` истории сценария не делает за шаг его событие (ADR 0117, SN36): событие —
 * действие шага гайда, которое видит и человек; `play` нажимает кнопки панели и
 * проверяет. Разбор статический: `play` и функции своего файла, которые он вызывает.
 * Запуск: npx vitest run --config vitest.node.config.ts guidePlay
 */
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const STORIES = join(__dirname, '..', 'stories')

/** Помощники, которые ведут событие таблицы: перетаскивание, меню, аргументы. */
const ACTION_HELPERS = new Set([
  'beginDrag',
  'dragHold',
  'dragRowOnto',
  'firePointer',
  'openMenuBy',
  'openPopup',
  'updateArgs',
])
/** Объекты, любой вызов которых — ввод. */
const INPUT_OBJECTS = new Set(['userEvent', 'fireEvent'])
/** Методы узла и «сервера» обвязки, которые меняют таблицу. */
const ACTION_METHODS = new Set([
  'answer',
  'click',
  'dispatchEvent',
  'focus',
  'scrollBy',
  'scrollIntoView',
  'scrollTo',
])
const SCROLL_PROPS = new Set(['scrollLeft', 'scrollTop'])

/**
 * Истории, чей `play` ещё делает событие шага (ADR 0117, SN36): список только
 * сокращается — переведённая история уходит из него, иначе страж падает.
 */
const BASELINE: Record<string, string> = {
  'Console.dev.stories.tsx ConsoleFilter':
    'событие шага ещё делает play — перевод на enter',
  'Customization.IncreasedContrast.stories.tsx IncreasedContrastEnable':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.Cells.Selection.stories.tsx CellSelectionByCommand':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.Core.Footer.stories.tsx FooterPositionSwitch':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.Export.stories.tsx ExportOwnButton':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.Filtering.stories.tsx SavedViewRestore':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.PluginApi.stories.tsx PluginApiDebugActions':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.PluginApi.stories.tsx PluginApiReportAction':
    'событие шага ещё делает play — перевод на enter',
  'DataGrid.Rows.Selection.stories.tsx SelectionByRowClick':
    'событие шага ещё делает play — перевод на enter',
}

type Declarations = Map<string, ts.Node>

/** Объявления верхнего уровня файла: функции, которые может вызвать `play`. */
const declarationsOf = (source: ts.SourceFile): Declarations => {
  const all: Declarations = new Map()
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      all.set(statement.name.text, statement)
    }
    if (ts.isVariableStatement(statement)) {
      for (const item of statement.declarationList.declarations) {
        if (ts.isIdentifier(item.name) && item.initializer) {
          all.set(item.name.text, item.initializer)
        }
      }
    }
  }
  return all
}

const isFunction = (
  node: ts.Node | undefined,
): node is ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression =>
  !!node &&
  (ts.isFunctionDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node))

/** Свойство `name` в объекте истории — и под вызовом фабрики или `satisfies`. */
const propertyOf = (node: ts.Node, name: string): ts.Expression | undefined => {
  let found: ts.Expression | undefined
  const visit = (current: ts.Node) => {
    if (found || isFunction(current)) return
    if (
      ts.isPropertyAssignment(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === name
    ) {
      found = current.initializer
      return
    }
    if (
      ts.isMethodDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === name
    ) {
      found = current as unknown as ts.Expression
      return
    }
    ts.forEachChild(current, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

/** События шага в `play` и в функциях файла, до которых он доходит вызовами. */
const actionsOf = (play: ts.Node, declarations: Declarations) => {
  const found = new Set<string>()
  const seen = new Set<ts.Node>()
  const scan = (root: ts.Node) => {
    if (seen.has(root)) return
    seen.add(root)
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        if (ts.isIdentifier(callee) && ACTION_HELPERS.has(callee.text)) {
          found.add(`${callee.text}()`)
        }
        if (ts.isPropertyAccessExpression(callee)) {
          const method = callee.name.text
          const owner = callee.expression
          if (ts.isIdentifier(owner) && INPUT_OBJECTS.has(owner.text)) {
            found.add(`${owner.text}.${method}()`)
          } else if (ACTION_METHODS.has(method)) {
            found.add(`.${method}()`)
          }
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        SCROLL_PROPS.has(node.left.name.text)
      ) {
        found.add(`.${node.left.name.text} =`)
      }
      if (ts.isIdentifier(node)) {
        const declaration = declarations.get(node.text)
        const parent = node.parent
        const isName =
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          (ts.isPropertyAssignment(parent) && parent.name === node)
        if (!isName && isFunction(declaration)) scan(declaration)
      }
      ts.forEachChild(node, visit)
    }
    visit(root)
  }
  scan(play)
  return [...found].sort()
}

const storyModules = import.meta.glob<
  Record<string, { parameters?: { scenario?: string } }>
>('../stories/*.stories.tsx')

/** `<файл> <экспорт>` → события шага в его `play`. */
const violations = async () => {
  const wrong = new Map<string, string[]>()
  for (const [path, load] of Object.entries(storyModules)) {
    const { default: _meta, ...exports } = await load()
    const scenarios = Object.entries(exports)
      .filter(([, story]) => story.parameters?.scenario)
      .map(([name]) => name)
    if (!scenarios.length) continue
    const file = basename(path)
    const source = ts.createSourceFile(
      file,
      readFileSync(join(STORIES, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const declarations = declarationsOf(source)
    for (const name of scenarios) {
      const story = declarations.get(name)
      let play = story && propertyOf(story, 'play')
      if (play && ts.isIdentifier(play))
        play = declarations.get(play.text) as ts.Expression
      if (!play) continue
      const actions = actionsOf(play, declarations)
      if (actions.length) wrong.set(`${file} ${name}`, actions)
    }
  }
  return wrong
}

describe('play истории сценария (ADR 0117)', () => {
  it('SN36: play истории сценария не выполняет событий шагов — ни сам, ни помощниками своего файла: перетаскивание, нажатия и ввод (userEvent, .click(), dispatchEvent), фокус, прокрутку, ответ «сервера» и смену аргументов делает действие шага (enter); play нажимает кнопки панели гайда и проверяет. Нарушитель вне базы и запись базы, которая больше не нарушает, роняют страж', async () => {
    // Событие в помощнике файла страж видит; `enter` шагов — не `play`, их он не обходит.
    const probe = ts.createSourceFile(
      'probe.tsx',
      `
        const hold = async (canvas: HTMLElement) => { await dragHold(canvas, { x: 0, y: 0 }) }
        const STEPS = [{ title: 'a', enter: (root: HTMLElement) => root.click() }]
        export const Probe = {
          parameters: { scenario: '0000/S1' },
          play: async ({ canvasElement }) => {
            await guideNext(canvasElement)
            await hold(canvasElement)
            expect(STEPS[0].title).toBe('a')
          },
        }
        `,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const probeDeclarations = declarationsOf(probe)
    expect(
      actionsOf(
        propertyOf(probeDeclarations.get('Probe')!, 'play')!,
        probeDeclarations,
      ),
    ).toEqual(['dragHold()'])

    const found = await violations()
    const fresh = [...found]
      .filter(([story]) => !(story in BASELINE))
      .map(([story, actions]) => `${story}: ${actions.join(', ')}`)
    const stale = Object.keys(BASELINE).filter(story => !found.has(story))
    expect({ fresh, stale }).toEqual({ fresh: [], stale: [] })
  }, 60_000)
})
