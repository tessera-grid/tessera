import axe from 'axe-core'
import { composeStories } from '@storybook/react-vite'
import { addons, composeConfigs, mockChannel } from 'storybook/preview-api'
import { render } from 'vitest-browser-react'
import { beforeAll, describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import baseline from './contrast-baseline.json'
import { contrast, effectiveBg, toRgba } from './a11y-helpers'
import { CATALOG_STATES, PALETTE_ROLES } from '../../__mocks__/catalog'

// Матрица контраста (ADR 0089, CX1–CX8) по каталогу визуальных состояний (ADR 0093,
// VR14): каждая история-состояние — в двух палитрах, двух темах и двух режимах. Текст —
// 4,5:1 (крупный — 3:1), в повышенном контрасте 7:1 (4,5:1); иконки и границы контролов —
// 3:1. Нарушения, которым нужно решение по дизайну, — в `contrast-baseline.json` с
// причиной; база только сокращается.

type Palette = 'tessera' | 'stories'
type Theme = 'light' | 'dark'
type Mode = 'standard' | 'more'
interface Combo {
  palette: Palette
  theme: Theme
  mode: Mode
}

const COMBOS: Combo[] = (['tessera', 'stories'] as const).flatMap(palette =>
  (['light', 'dark'] as const).flatMap(theme =>
    (['standard', 'more'] as const).map(mode => ({ palette, theme, mode })),
  ),
)
const comboLabel = (c: Combo) => `${c.palette}/${c.theme}/${c.mode}`

const html = document.documentElement
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

const finishTransitions = () =>
  document
    .getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .forEach(animation => animation.finish())

const applyCombo = async (combo: Combo) => {
  html.classList.toggle('dark', combo.theme === 'dark')
  if (combo.mode === 'more') html.setAttribute('data-tsr-contrast', 'more')
  else html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) {
    if (combo.palette === 'tessera') html.style.setProperty(role, 'initial')
    else html.style.removeProperty(role)
  }
  await frame()
  finishTransitions()
  await frame()
}

const resetCombo = () => {
  html.classList.remove('dark')
  html.removeAttribute('data-tsr-contrast')
  for (const role of PALETTE_ROLES) html.style.removeProperty(role)
}

// --- Обход узлов -------------------------------------------------------------------

const style = (el: Element) => getComputedStyle(el)

/** Суммарная прозрачность элемента и предков. */
const opacityOf = (el: Element) => {
  let opacity = 1
  for (let e: Element | null = el; e; e = e.parentElement) {
    opacity *= Number(style(e).opacity)
  }
  return opacity
}

/** Элемент виден: есть размер, не скрыт, прозрачность не ниже `min`. */
const visible = (el: Element, min = 0.9) => {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return false
  if (style(el).visibility !== 'visible') return false
  return opacityOf(el) >= min
}

/** Выключенное WCAG освобождает от контраста. */
const disabled = (el: Element) =>
  !!el.closest(
    '[disabled], [aria-disabled="true"], [data-disabled]:not([data-disabled="false"])',
  )

const ownText = (el: Element) =>
  [...el.childNodes].some(
    node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim(),
  )

const REGIONS: [string, string][] = [
  ['menu', '[role="menu"]'],
  ['popup', '[data-side]'],
  ['toolbar', '[role="toolbar"]'],
  ['head', '.data-grid__head-cell'],
  ['footer', '[class*="footer"]'],
  ['row', '.data-grid__body-row'],
]

/** Стабильное имя узла: область, строка, колонка, подпись. */
const describeNode = (el: Element) => {
  const region =
    REGIONS.find(([, selector]) => el.closest(selector))?.[0] ?? 'panel'
  const row = el.closest('[data-row-id]')?.getAttribute('data-row-id')
  const column = el.closest('[data-column-id]')?.getAttribute('data-column-id')
  const named =
    el.closest('[aria-label]')?.getAttribute('aria-label') ??
    el.closest('[role]')?.getAttribute('role') ??
    el.tagName.toLowerCase()
  return [region, row, column, named].filter(Boolean).join('/')
}

const CONTROLS =
  'button, a[href], [role="button"], [role^="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"]'

const isLarge = (el: Element) => {
  const s = style(el)
  const size = parseFloat(s.fontSize)
  return size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
}

interface Finding {
  key: string
  ratio: number
  need: number
}

/**
 * Нарушения порогов в корнях для одного сочетания. `dim` — приглушённое тело при
 * обновлении данных (ADR 0094, GL12): его тексты сводятся по прозрачности и держат 3:1.
 */
const auditRoots = (
  scenario: string,
  combo: Combo,
  roots: Element[],
  dim?: number,
) => {
  const more = combo.mode === 'more'
  const found = new Map<string, Finding>()
  let checked = 0
  const report = (kind: string, el: Element, ratio: number, need: number) => {
    checked++
    if (ratio + 0.005 >= need) return
    const key = `${scenario} | ${comboLabel(combo)} | ${kind} | ${describeNode(el)}`
    const prev = found.get(key)
    if (!prev || prev.ratio > ratio) found.set(key, { key, ratio, need })
  }
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (disabled(el)) continue
      // Прозрачная краска не рисует ничего: так скрыты кнопки строки до наведения.
      const painted = (color: string) => toRgba(color)[3]! > 0
      const dimmed = dim !== undefined && !!el.closest('.data-grid__body')
      if (
        dimmed &&
        visible(el, dim * 0.9) &&
        ownText(el) &&
        painted(style(el).color)
      ) {
        const bg = effectiveBg(el)
        const opacity = opacityOf(el)
        const shown = toRgba(style(el).color)
          .slice(0, 3)
          .map((c, i) => c * opacity + bg[i]! * (1 - opacity))
        report('text', el, contrast([...shown, 1], bg), 3)
      }
      if (!visible(el)) continue
      if (!dimmed && ownText(el) && painted(style(el).color)) {
        const need = isLarge(el) ? (more ? 4.5 : 3) : more ? 7 : 4.5
        report(
          'text',
          el,
          contrast(toRgba(style(el).color), effectiveBg(el)),
          need,
        )
      }
      // Иконка контрола — WCAG 1.4.11; декоративная графика (стрелка поповера) — нет.
      if (el instanceof SVGSVGElement && el.closest(CONTROLS)) {
        const s = style(el)
        const paint = s.stroke !== 'none' ? s.stroke : s.fill
        if (
          paint &&
          paint !== 'none' &&
          !paint.startsWith('url') &&
          painted(paint)
        ) {
          report('icon', el, contrast(toRgba(paint), effectiveBg(el)), 3)
        }
      }
      if (el.getAttribute('role') === 'checkbox') {
        const s = style(el)
        const fill = toRgba(s.backgroundColor)
        const around = effectiveBg(el.parentElement!)
        const ratio =
          fill[3]! > 0.99
            ? contrast(fill, around)
            : contrast(toRgba(s.borderTopColor), around)
        report('control', el, ratio, 3)
      }
    }
  }
  return { findings: [...found.values()], checked }
}

// --- axe (CX7) ----------------------------------------------------------------------

/**
 * Разобранные причины, по которым axe не считает контраст (`messageKey` проверки):
 * каждую закрывает свой расчёт CX1–CX5, у каждой — обоснование. Ошибка axe
 * (`error-occurred`) снимает правило целиком — разобранной не бывает.
 */
const ALLOWED_INCOMPLETE: Record<string, string> = {
  bgGradient:
    'фон ячейки — сплошные слои подсветки и диапазона; effectiveBg складывает их, CX2',
  pseudoContent:
    'линии дерева и отметки — псевдоэлементы без текста; текст строки считает CX1',
  shortTextContent:
    'номер приоритета и счётчики из одной-двух цифр; их контраст считает CX3–CX4',
  elmPartiallyObscured:
    'пункты за краем прокручиваемого списка панели; их контраст считает CX5 без учёта прокрутки',
  bgOverlap:
    'в стопке под текстом — прозрачный слой блика ячейки или грид под непрозрачным поповером; фон — у предков, его складывает effectiveBg, CX1–CX5',
}

const reasonOf = (node: axe.NodeResult) => {
  const check = [...node.any, ...node.all, ...node.none][0]
  return check?.id === 'error-occurred'
    ? `ошибка axe: ${(check.data as { message?: string } | null)?.message}`
    : (check?.data as { messageKey?: string } | null)?.messageKey
}

const nodeName = (node: axe.NodeResult) => {
  const el = document.querySelector(node.target.join(' '))
  return el ? describeNode(el) : node.target.join(' ')
}

// --- Каталог ------------------------------------------------------------------------

type Requirement = 'CX1' | 'CX2' | 'CX3' | 'CX4' | 'CX5'

/** Наложения поверх тела — CX2, остальное тело — CX1. */
const OVERLAID = ['highlight', 'cellRange', 'pending', 'error']

const requirementOf = (state: string): Requirement => {
  const [area, name] = state.split('.') as [string, string]
  if (area === 'head') return 'CX3'
  if (area === 'panel') return 'CX4'
  if (area === 'overlay') return 'CX5'
  return OVERLAID.includes(name) ? 'CX2' : 'CX1'
}

/** История из `composeStories`: компонент, параметры и `play`. */
interface ComposedState {
  (): React.JSX.Element
  storyName?: string
  parameters: { vrStates?: string[] }
  play?: (context: { canvasElement: HTMLElement }) => Promise<void>
}

interface CatalogStory {
  title: string
  name: string
  states: string[]
  Story: ComposedState
}

/** Истории-состояния каталога: с псевдо-состояниями и на холсте каталога, как в Vitest. */
const catalogStories = async (): Promise<CatalogStory[]> => {
  // Аддон псевдо-состояний берёт канал при импорте, а `play` шлёт в него событие
  // отрисовки: канал ставится до импорта, иначе каждый `getChannel` даёт новый.
  if (!addons.hasChannel()) addons.setChannel(mockChannel())
  const pseudoStates = await import('storybook-addon-pseudo-states/preview')
  const modules = import.meta.glob<Record<string, unknown>>(
    '../../*.stories.tsx',
    { eager: true },
  )
  const annotations = composeConfigs([
    pseudoStates,
    { initialGlobals: { catalog: true } },
  ])
  return Object.values(modules).flatMap(module => {
    const title = (module.default as { title: string }).title
    const stories = Object.values(
      composeStories(
        module as Parameters<typeof composeStories>[0],
        annotations,
      ),
    ) as unknown as ComposedState[]
    return stories
      .filter(Story => Story.parameters.vrStates)
      .map(Story => ({
        title,
        name: Story.storyName!,
        states: Story.parameters.vrStates!,
        Story,
      }))
  })
}

const gridsAndPopups = (container: HTMLElement) => {
  const grids = [
    ...container.querySelectorAll('.data-grid-theme[class*="theme-wrapper"]'),
  ]
  const popups = [
    ...document.querySelectorAll('[role="menu"], [role="dialog"], [data-side]'),
  ].filter(el => !container.contains(el))
  const outer = popups.filter(
    el => !popups.some(other => other !== el && other.contains(el)),
  )
  return { grids, popups: outer }
}

interface StoryAudit {
  story: string
  requirement: Requirement
  states: string[]
  /** Проверенных узлов по сочетаниям: холостой проход — не проверка. */
  checked: Record<string, number>
}

const audits: StoryAudit[] = []
const findings: Record<Requirement, Finding[]> = {
  CX1: [],
  CX2: [],
  CX3: [],
  CX4: [],
  CX5: [],
}
const axeProblems: string[] = []

// --- База известных нарушений (CX8) -------------------------------------------------

const known = baseline as Record<string, string>
const seen = new Set<string>()

const expectClean = (list: Finding[]) => {
  for (const f of list) seen.add(f.key)
  const unexpected = list
    .filter(f => !(f.key in known))
    .map(f => `${f.key} — ${f.ratio.toFixed(2)}:1 < ${f.need}:1`)
  expect(unexpected).toEqual([])
}

const auditedFor = (requirement: Requirement) => {
  const own = audits.filter(a => a.requirement === requirement)
  expect(own.length, requirement).toBeGreaterThan(0)
  for (const audit of own) {
    for (const combo of COMBOS) {
      expect(
        audit.checked[comboLabel(combo)],
        `${audit.story} | ${comboLabel(combo)}`,
      ).toBeGreaterThan(0)
    }
  }
}

describe('Матрица контраста (ADR 0089) по каталогу (ADR 0093)', () => {
  // Один проход: история рисуется и доводится до состояния один раз, затем все
  // сочетания — пороги CX1–CX5 и axe CX7.
  beforeAll(async () => {
    for (const { title, name, states, Story } of await catalogStories()) {
      const requirement = requirementOf(states[0]!)
      const story = `${title.replace('Tessera/', '')}/${name}`
      const screen = await render(<Story />)
      await Story.play?.({ canvasElement: screen.container })
      const audit: StoryAudit = { story, requirement, states, checked: {} }
      for (const combo of COMBOS) {
        await applyCombo(combo)
        const { grids, popups } = gridsAndPopups(screen.container)
        const roots = [...grids, ...popups]
        const dim = states.includes('body.refreshing')
          ? Number(
              style(screen.container.querySelector('.data-grid__body')!)
                .opacity,
            )
          : undefined
        const result = auditRoots(`${requirement} ${story}`, combo, roots, dim)
        audit.checked[comboLabel(combo)] = result.checked
        findings[requirement].push(...result.findings)

        const rule =
          combo.mode === 'more' ? 'color-contrast-enhanced' : 'color-contrast'
        // Под открытым поповером текст грида перекрыт — axe его не считает; тот же
        // грид без поповера проверяют истории тела и шапки.
        for (const root of requirement === 'CX5' ? popups : roots) {
          // Приглушённое тело обновления держит 3:1 (ADR 0094, GL12) — его считает
          // аудит выше; пороги axe к нему не относятся.
          const dimmedBody =
            dim === undefined
              ? []
              : [...root.querySelectorAll('.data-grid__body')]
          const result = await axe.run(
            { include: [root], exclude: dimmedBody },
            { runOnly: [rule] },
          )
          for (const v of result.violations) {
            for (const node of v.nodes) {
              const key = `CX7 ${story} | ${comboLabel(combo)} | axe | ${nodeName(node)}`
              seen.add(key)
              if (!(key in known)) {
                axeProblems.push(`${key}: ${node.failureSummary}`)
              }
            }
          }
          for (const v of result.incomplete) {
            for (const node of v.nodes) {
              const reason = reasonOf(node)
              if (reason && reason in ALLOWED_INCOMPLETE) continue
              axeProblems.push(
                `CX7 incomplete ${story} | ${comboLabel(combo)} | ${nodeName(node)} | ${reason ?? 'без причины'}`,
              )
            }
          }
        }
      }
      resetCombo()
      audits.push(audit)
      await screen.unmount()
    }
  }, 900_000)

  test('CX1: тело — текст, иконки и флажки во всех состояниях строки и видах ячейки, обе темы, оба режима', () => {
    auditedFor('CX1')
    expectClean(findings.CX1)
  })

  test('CX2: наложения — подсветка трёх тонов, диапазон ячеек, ожидание и ошибка ячейки', () => {
    auditedFor('CX2')
    expectClean(findings.CX2)
  })

  test('CX3: шапка и футер — покой, наведение, активная сортировка, закрепление', () => {
    auditedFor('CX3')
    expectClean(findings.CX3)
  })

  test('CX4: панели — тулбар, быстрый поиск, пагинация, счётчик выбранного', () => {
    auditedFor('CX4')
    expectClean(findings.CX4)
  })

  test('CX5: поповеры — пункт в покое, под указателем и выбранный, тултип', () => {
    auditedFor('CX5')
    expectClean(findings.CX5)
  })

  test('CX6: матрица идёт на двух палитрах — запасной и палитре историй', async () => {
    const [{ Story }] = await catalogStories()
    const screen = await render(<Story />)
    const wrapper = () =>
      screen.container.querySelector(
        '.data-grid-theme[class*="theme-wrapper"]',
      )!
    await expect.poll(wrapper).toBeTruthy()
    const border = async (palette: Palette) => {
      await applyCombo({ palette, theme: 'light', mode: 'more' })
      return style(wrapper()).borderTopColor
    }
    // Палитры различаются там, где надстройка поднимает запасную роль.
    expect(await border('tessera')).not.toBe(await border('stories'))
    resetCombo()
    expect(COMBOS.map(comboLabel)).toHaveLength(8)
    expect(new Set(COMBOS.map(c => c.palette))).toEqual(
      new Set(['tessera', 'stories']),
    )
  })

  test('CX7: axe — нарушений нет, incomplete на тексте только по разобранным причинам', () => {
    expect(audits.length).toBeGreaterThan(0)
    expect(axeProblems).toEqual([])
  })

  test('VR14: матрица контраста обходит истории каталога в двух темах, палитрах и режимах контраста', () => {
    const audited = new Set(audits.flatMap(a => a.states))
    const registry = Object.entries(CATALOG_STATES).flatMap(([area, states]) =>
      states.map(state => `${area}.${state}`),
    )
    expect(registry.filter(state => !audited.has(state))).toEqual([])
    for (const audit of audits) {
      expect(Object.keys(audit.checked).sort(), audit.story).toEqual(
        COMBOS.map(comboLabel).sort(),
      )
    }
  })

  test('CX8: база известных нарушений только сокращается', () => {
    // У каждой записи — причина; запись, которой больше нет в прогоне, — устарела.
    expect(
      Object.entries(known).filter(([, reason]) => !reason.trim()),
    ).toEqual([])
    expect(Object.keys(known).filter(key => !seen.has(key))).toEqual([])
  })
})
