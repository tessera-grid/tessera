/**
 * Типы публичного API для стражей имён (ADR 0106): одна программа TypeScript на
 * входы пакета и маппер историй, свойства типа — по имени экспорта.
 */
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const root = fileURLToPath(new URL('../../../', import.meta.url))

export const ENTRY = {
  index: `${root}src/index.ts`,
  plugins: `${root}src/plugins.ts`,
  useCreateTable: `${root}src/lib/core/useCreateTable.ts`,
  storyToggles: `${root}src/lib/stories/__mocks__/utils/argsToPlugins.ts`,
} as const

let cached: { program: ts.Program; checker: ts.TypeChecker } | undefined

const typeProgram = () => {
  if (!cached) {
    const configPath = `${root}tsconfig.json`
    const config = ts.readConfigFile(configPath, ts.sys.readFile).config
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root)
    const program = ts.createProgram({
      rootNames: Object.values(ENTRY),
      options: { ...options, noEmit: true },
    })
    cached = { program, checker: program.getTypeChecker() }
  }
  return cached
}

const exportsOf = (file: string) => {
  const { program, checker } = typeProgram()
  const source = program.getSourceFile(file)
  if (!source) throw new Error(`нет файла ${file}`)
  return checker.getExportsOfModule(checker.getSymbolAtLocation(source)!)
}

/** Имена экспортов модуля (значения и типы). */
export const exportNames = (file: string) =>
  exportsOf(file).map(symbol => symbol.name)

const exportSymbol = (file: string, name: string) => {
  const symbol = exportsOf(file).find(item => item.name === name)
  if (!symbol) throw new Error(`нет экспорта ${name} в ${file}`)
  const { checker } = typeProgram()
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol
}

export interface PropInfo {
  name: string
  /** Тип без `undefined`, строкой. */
  type: string
  isFunction: boolean
}

const propsOfType = (type: ts.Type): PropInfo[] => {
  const { checker } = typeProgram()
  return checker
    .getPropertiesOfType(checker.getNonNullableType(type))
    .map(prop => {
      const propType = checker.getNonNullableType(checker.getTypeOfSymbol(prop))
      const parts = propType.isUnion() ? propType.types : [propType]
      return {
        name: prop.name,
        type: checker.typeToString(propType),
        isFunction: parts.some(part => part.getCallSignatures().length > 0),
      }
    })
}

/** Свойства экспортированного типа (интерфейс или псевдоним). */
export const typeProps = (file: string, name: string) => {
  const { checker } = typeProgram()
  return propsOfType(checker.getDeclaredTypeOfSymbol(exportSymbol(file, name)))
}

/** Свойства первого параметра экспортированной функции. */
export const firstParamProps = (file: string, name: string) => {
  const { checker } = typeProgram()
  const symbol = exportSymbol(file, name)
  const signature = checker.getTypeOfSymbol(symbol).getCallSignatures()[0]
  const param = signature?.getParameters()[0]
  return param ? propsOfType(checker.getTypeOfSymbol(param)) : []
}
