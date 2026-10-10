/**
 * Порог поддерживаемых браузеров (ADR 0084): `browserslist` и цель сборки (CB1),
 * проверка собранного CSS по caniuse и своим правилам (CB2).
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  BROWSER_TARGETS,
  BUILD_TARGET,
  SAMSUNG_TARGET,
} from '../../../browser-targets'
import { checkCss, EXCEPTIONS } from '../../../scripts/browsers'
import viteConfig from '../../../vite.config'

const { browserslist } = JSON.parse(
  readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'),
) as { browserslist: string[] }

describe('Порог браузеров', () => {
  it('CB1: browserslist фиксирует порог Chrome и Edge 111, Firefox 128, Safari и iOS Safari 17.1, Opera 97, Samsung Internet 22, Chrome и Opera на Android последние; build.target совпадает', () => {
    expect(browserslist).toEqual([
      `chrome >= ${BROWSER_TARGETS.chrome}`,
      `edge >= ${BROWSER_TARGETS.edge}`,
      `firefox >= ${BROWSER_TARGETS.firefox}`,
      `safari >= ${BROWSER_TARGETS.safari}`,
      `ios_saf >= ${BROWSER_TARGETS.ios}`,
      `opera >= ${BROWSER_TARGETS.opera}`,
      `samsung >= ${SAMSUNG_TARGET}`,
      'last 1 and_chr version',
      'last 1 op_mob version',
    ])
    expect(BROWSER_TARGETS).toEqual({
      chrome: '111',
      edge: '111',
      firefox: '128',
      safari: '17.1',
      ios: '17.1',
      opera: '97',
    })
    expect(SAMSUNG_TARGET).toBe('22')
    expect(
      (viteConfig as { build?: { target?: unknown } }).build?.target,
    ).toEqual(BUILD_TARGET)
  })

  it('CB2: CSS вне порога по caniuse и своим правилам — находка, кроме исключений с причиной; interpolate-size — красный', async () => {
    const features = async (css: string) =>
      (await checkCss(css, browserslist)).map(finding => finding.feature)

    expect(await features('.a{color:red;display:grid}')).toEqual([])
    expect(await features('.a{interpolate-size:allow-keywords}')).toEqual([
      'interpolate-size',
    ])
    expect(await features('.a{width:calc-size(auto, size)}')).toEqual([
      'calc-size',
    ])
    // Ветка caniuse (doiuse) и свои правила для того, чего в caniuse нет.
    expect(await features('.a{content-visibility:auto}')).toEqual([
      'css-content-visibility',
    ])
    expect(await features('.a{text-wrap:balance}')).toEqual([
      'text-wrap-balance',
    ])
    expect(await features('@starting-style{.a{opacity:0}}')).toEqual([
      'starting-style',
    ])
    expect(await features('.a{overflow-clip-margin:border-box}')).toEqual([
      'overflow-clip-margin',
    ])
    expect(await features('.a{touch-action:pan-y}')).toEqual([])
    for (const [feature, reason] of Object.entries(EXCEPTIONS)) {
      expect(reason.trim().length, feature).toBeGreaterThan(10)
    }
  })
})
