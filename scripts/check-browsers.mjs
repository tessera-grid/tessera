// Порог браузеров в собранном dist/style.css (ADR 0084, CB2): возможности CSS вне
// `browserslist` по данным caniuse и своим правилам; исключения — в browsers.ts.
// Запуск: `npm run check:browsers` (после `npm run build`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { checkCss } from './browsers.ts'

const root = process.cwd()
const { browserslist } = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
)
const css = readFileSync(resolve(root, 'dist/style.css'), 'utf8')

const findings = await checkCss(css, browserslist)
if (findings.length > 0) {
  for (const { feature, message } of findings) {
    console.error(`[check-browsers] ${feature}: ${message}`)
  }
  console.error(
    `[check-browsers] ${findings.length} возможностей вне порога (${browserslist.join(', ')})`,
  )
  process.exit(1)
}
console.log(
  `[check-browsers] OK — dist/style.css в пороге (${browserslist.join(', ')})`,
)
