// Порог браузеров в собранном CSS (ADR 0084, CB2): возможности вне `browserslist`
// по данным caniuse (doiuse) плюс свои правила для того, чего в caniuse нет.
// Запуск: `npm run check:browsers` (после `npm run build`).

import doiuse from 'doiuse'
import postcss, { type AtRule, type Declaration } from 'postcss'

export interface BrowserFinding {
  feature: string
  message: string
}

interface ExtraRule {
  feature: string
  message: string
  decl?: (decl: Declaration) => boolean
  atRule?: (rule: AtRule) => boolean
}

const value = (pattern: RegExp) => (decl: Declaration) =>
  pattern.test(decl.value)
const prop = (pattern: RegExp) => (decl: Declaration) => pattern.test(decl.prop)

/**
 * Возможности вне порога, которых нет в данных doiuse: свойство, значение или
 * at-правило с версиями, где они появились.
 */
export const EXTRA_RULES: ExtraRule[] = [
  {
    feature: 'interpolate-size',
    message: 'interpolate-size — Chrome 129+, нет в Firefox и Safari',
    decl: prop(/^interpolate-size$/),
  },
  {
    feature: 'calc-size',
    message: 'calc-size() — Chrome 129+, нет в Firefox и Safari',
    decl: value(/\bcalc-size\(/),
  },
  {
    feature: 'light-dark',
    message: 'light-dark() — Chrome 123+, Safari 17.5+',
    decl: value(/\blight-dark\(/),
  },
  {
    feature: 'starting-style',
    message: '@starting-style — Chrome 117+, Firefox 129+, Safari 17.5+',
    atRule: rule => rule.name === 'starting-style',
  },
  {
    feature: 'field-sizing',
    message: 'field-sizing — Chrome 123+, нет в Firefox и Safari',
    decl: prop(/^field-sizing$/),
  },
  {
    feature: 'anchor-positioning',
    message: 'anchor positioning — Chrome 125+, нет в Firefox и Safari 16.4',
    decl: decl =>
      /^(anchor-name|position-anchor|position-area|position-try)/.test(
        decl.prop,
      ) || /\banchor(-size)?\(/.test(decl.value),
  },
  {
    feature: 'view-transitions',
    message: 'view-transition-name — Chrome 111+, Safari 18+, Firefox 144+',
    decl: prop(/^view-transition-/),
  },
  {
    feature: 'text-wrap-balance',
    message: 'text-wrap: balance/pretty — Chrome 114+, Safari 17.5+',
    decl: decl =>
      /^text-wrap(-style)?$/.test(decl.prop) &&
      /\b(balance|pretty|stable)\b/.test(decl.value),
  },
  {
    feature: 'scroll-driven-animations',
    message: 'animation-timeline — Chrome 115+, нет в Firefox и Safari 16.4',
    decl: decl =>
      /^(animation-timeline|scroll-timeline|view-timeline)/.test(decl.prop),
  },
  {
    feature: 'css-scope',
    message: '@scope — Chrome 118+, Safari 17.4+',
    atRule: rule => rule.name === 'scope',
  },
  {
    feature: 'content-alt-text',
    message: 'альтернативный текст content: … / … — Chrome 77+, Safari 17.4+',
    decl: decl => decl.prop === 'content' && /\s\/\s/.test(decl.value),
  },
]

/**
 * Найденное в пороге, но безвредное — с причиной. Список только сокращается:
 * исправили — уберите запись.
 */
export const EXCEPTIONS: Record<string, string> = {
  'css-masks':
    'частично в Chrome/Edge 111–119 без префикса; сборка добавляет -webkit-mask',
  'css3-cursors': 'на iOS нет курсора — значения курсора там не нужны',
  'css3-cursors-grab': 'на iOS нет курсора — grab/grabbing там не нужны',
  'css-resize':
    'resize — сброс Tailwind preflight; на iOS ручки нет и не нужно',
  'css-touch-action':
    'настольный Safari без касаний; на iOS Safari touch-action есть',
  'text-decoration':
    'частично — только сокращённая запись; сборка выводит -webkit-text-decoration',
  'extended-system-fonts':
    'ui-monospace и др. в стеке шрифтов с запасными — без них берётся следующий',
  'css-text-indent':
    'text-indent: 0 из preflight; частично — each-line/hanging',
  'css-display-contents':
    'утилита Tailwind «contents» не используется гридом; строки ARIA на display: contents не держим',
  'intrinsic-width':
    'частично в Firefox — значения stretch; используются fit-content/max-content',
  'css-clip-path':
    'частично — фигуры SVG; используется только inset() для скрытия текста',
  'content-alt-text':
    'короткая форма счётчика панели (ADR 0083): в Safari 16.4–17.3 запасное объявление — скринридер читает и короткую форму',
}

export const findUnsupported = async (
  css: string,
  browsers: string[],
): Promise<BrowserFinding[]> => {
  const findings: BrowserFinding[] = []
  await postcss([
    doiuse({
      browsers,
      onFeatureUsage: (usage: BrowserFinding) =>
        findings.push({ feature: usage.feature, message: usage.message }),
    }),
    {
      postcssPlugin: 'tessera-extra-browser-rules',
      Declaration: decl => {
        for (const rule of EXTRA_RULES) {
          if (rule.decl?.(decl)) {
            findings.push({ feature: rule.feature, message: rule.message })
          }
        }
      },
      AtRule: atRule => {
        for (const rule of EXTRA_RULES) {
          if (rule.atRule?.(atRule)) {
            findings.push({ feature: rule.feature, message: rule.message })
          }
        }
      },
    },
  ]).process(css, { from: undefined })
  return findings
}

/** Возможности вне порога без исключения — по одной записи на возможность. */
export const checkCss = async (
  css: string,
  browsers: string[],
): Promise<BrowserFinding[]> => {
  const seen = new Map<string, BrowserFinding>()
  for (const finding of await findUnsupported(css, browsers)) {
    if (!(finding.feature in EXCEPTIONS) && !seen.has(finding.feature)) {
      seen.set(finding.feature, finding)
    }
  }
  return [...seen.values()]
}
