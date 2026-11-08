/**
 * Совместимость окружений (ADR 0091): входы пакета импортируются без DOM (EV6), основные
 * истории рендерятся на сервере без ошибок и предупреждений (EV4). Среда — node, без
 * `window` и `document`; в `test:react18` тот же файл идёт на React 18.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const GLOBALS = ['window', 'document', 'navigator'] as const

/** Холодный импорт всего пакета и файлов историй: рядом с браузерными проектами — дольше 5 с. */
const COLD_IMPORT_TIMEOUT = 60_000

describe('Серверный рендер', () => {
  it(
    'EV6: входы `.`, `/plugins` и `/ui` импортируются в среде без window, document и navigator',
    async () => {
      // Глобалы есть, но пусты — как в node и воркерах: `typeof` в защищённом коде видит
      // 'undefined', а незащищённое обращение к свойству упало бы при импорте.
      const saved = GLOBALS.map(
        name =>
          [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
      )
      for (const name of GLOBALS) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          get: () => undefined,
        })
      }
      try {
        vi.resetModules()
        const entries = await Promise.all([
          import('../../index'),
          import('../../plugins'),
          import('../../ui'),
        ])
        expect(entries.map(entry => typeof entry)).toEqual([
          'object',
          'object',
          'object',
        ])
        // `DataGrid` — компонент в `memo` (ADR 0196, §3).
        expect(entries[0].DataGrid).toHaveProperty('$$typeof')
      } finally {
        for (const [name, descriptor] of saved) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor)
          else delete (globalThis as Record<string, unknown>)[name]
        }
      }
    },
    COLD_IMPORT_TIMEOUT,
  )

  it(
    'EV4: основные истории рендерятся на сервере без исключений и без console.error и warn',
    async () => {
      const { setProjectAnnotations, composeStories } =
        await import('@storybook/react-vite')
      const preview = (await import('../../../.storybook/preview')).default
      setProjectAnnotations([preview])
      const core = composeStories(
        await import('../stories/DataGrid.Playground.stories'),
      )
      const filtering = composeStories(
        await import('../stories/DataGrid.Filtering.stories'),
      )
      const pagination = composeStories(
        await import('../stories/DataGrid.Panels.Pagination.stories'),
      )
      const expanding = composeStories(
        await import('../stories/DataGrid.Rows.Expanding.stories'),
      )
      const stories = {
        ...core,
        ...filtering,
        ...pagination,
        ...expanding,
      } as Record<string, () => React.JSX.Element>

      const messages: string[] = []
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation((...args) =>
          messages.push(args.map(String).join(' ')),
        )
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation((...args) =>
          messages.push(args.map(String).join(' ')),
        )
      const rendered: string[] = []
      try {
        for (const [name, Story] of Object.entries(stories)) {
          const html = renderToString(<Story />)
          expect(html, name).toContain('data-grid-theme')
          rendered.push(name)
        }
      } finally {
        error.mockRestore()
        warn.mockRestore()
      }
      expect(rendered.length).toBeGreaterThan(10)
      expect(messages).toEqual([])
    },
    COLD_IMPORT_TIMEOUT,
  )
})
