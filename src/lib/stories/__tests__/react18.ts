// Прогон на React 18 (ADR 0091, EV1): те же браузерные наборы, что у `npm test`, но
// React и React DOM — 18 из отдельного проекта `tools/react18`. Исключения — с причиной;
// список только сокращается: исправили набор — уберите запись.

/** Корень проекта с React 18: свои `node_modules`, чтобы пиры корня (React 19) не мешали. */
export const REACT18_ROOT = 'tools/react18/node_modules'

/** Серверный рендер в node (EV4, EV6): в `test:react18` — свой проект `react18-unit`. */
export const SSR_SUITE = 'src/lib/__tests__/ssr.test.tsx'

export interface React18Exclusion {
  file: string
  reason: string
}

export const REACT18_EXCLUSIONS: React18Exclusion[] = []
