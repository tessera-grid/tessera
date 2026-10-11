import Module from 'node:module'
import { fileURLToPath } from 'node:url'

import { REACT18_ROOT } from './src/lib/stories/__tests__/react18'

// Серверный рендер на React 18 в node (ADR 0091, EV4): CJS-зависимости (например,
// `use-sync-external-store`) берут `react` нативным `require` из корня, где React 19.
// Направляем их к React 18 — один экземпляр React на тест.
const root = fileURLToPath(new URL(`./${REACT18_ROOT}/`, import.meta.url))
const resolver = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string
}
const resolve = resolver._resolveFilename
resolver._resolveFilename = (request, ...rest) =>
  resolve(
    /^react(-dom)?(\/|$)/.test(request) ? root + request : request,
    ...rest,
  )
