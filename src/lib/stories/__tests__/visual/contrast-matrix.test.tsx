import { render } from 'vitest-browser-react'
import { page, server } from 'vitest/browser'
import { beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import baseline from './contrast-baseline.json'
import {
  BASE_COMBOS,
  COMBOS,
  type Combo,
  FORCED_COMBOS,
  FitError,
  type Finding,
  type Palette,
  applyCombo,
  auditRoots,
  comboLabel,
  fitSnapshot,
  gridsAndPopups,
  loadStories,
  pixelMeasure,
  resetCombo,
  runAxe,
  snapshot,
  style,
  styleMeasure,
} from './contrast-helpers'

// Матрица контраста (ADR 0089, CX1–CX11) по каталогу визуальных состояний (ADR 0093):
// каждая история-состояние — в двух палитрах, двух темах и двух режимах. Текст —
// 4,5:1 (крупный — 3:1), в повышенном контрасте 7:1 (4,5:1); иконки и границы контролов —
// 3:1. Нарушения, которым нужно решение по дизайну, — в `contrast-baseline.json` с
// причиной; база только сокращается. В `forced-colors` (§6, CX9–CX11) фон — по пикселям
// снимка: подложку и снятые слои браузер в стилях не отражает. Шаги гайдов (§7), поповеры
// (CX5 — они только шаги гайдов) и VR14 — набор `contrast-guides`.

// --- Каталог ------------------------------------------------------------------------

type Requirement = 'CX1' | 'CX2' | 'CX3' | 'CX4'

/** Наложения поверх тела — CX2, остальное тело — CX1. */
const OVERLAID = ['highlight', 'cellRange', 'pending', 'error']

const requirementOf = (state: string): Requirement => {
  const [area, name] = state.split('.') as [string, string]
  if (area === 'head') return 'CX3'
  if (area === 'panel') return 'CX4'
  // Поповер — состояние посреди сценария: только шаг гайда (ADR 0117), CX5 — contrast-guides.
  if (area === 'overlay') {
    throw new Error(`${state}: поповеры — шаги гайдов, а не истории-состояния`)
  }
  return OVERLAID.includes(name) ? 'CX2' : 'CX1'
}

/** Истории-состояния каталога: с `vrStates`. */
const catalogStories = async () =>
  (await loadStories()).flatMap(({ story, Story }) =>
    Story.parameters.vrStates
      ? [{ story, states: Story.parameters.vrStates, Story }]
      : [],
  )

interface StoryAudit {
  story: string
  requirement: Requirement
  states: string[]
  /** Проверенных узлов по сочетаниям: холостой проход — не проверка. */
  checked: Record<string, number>
}

const audits: StoryAudit[] = []
/** Находки обычного и повышенного режимов — по областям, `forced-colors` — CX10. */
const findings: Record<Requirement | 'CX10', Finding[]> = {
  CX1: [],
  CX2: [],
  CX3: [],
  CX4: [],
  CX10: [],
}
const axeProblems: string[] = []
/** Сочетания режима без снимка: грид или поповер не в окне (CX16). */
const fitProblems: string[] = []

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

const auditedFor = (requirement: Requirement, combos = BASE_COMBOS) => {
  const own = audits.filter(a => a.requirement === requirement)
  expect(own.length, requirement).toBeGreaterThan(0)
  for (const audit of own) {
    for (const combo of combos) {
      expect(
        audit.checked[comboLabel(combo)],
        `${audit.story} | ${comboLabel(combo)}`,
      ).toBeGreaterThan(0)
    }
  }
}

describe('Матрица контраста (ADR 0089) по каталогу (ADR 0093)', () => {
  // Один проход: история рисуется и доводится до состояния один раз, затем все
  // сочетания — пороги CX1–CX4 и axe CX7.
  beforeAll(async () => {
    // Снимок `forced-colors` видит только окно; больше окна раннер ужал бы фрейм, и
    // рамки в 1px размазались бы по соседним пикселям.
    await page.viewport(900, 720)
    for (const { story, states, Story } of await catalogStories()) {
      const requirement = requirementOf(states[0]!)
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
        const forced = combo.mode === 'forced'
        const bucket = forced ? 'CX10' : requirement
        // Снимок — только когда грид и поповеры в окне (CX16); иначе сочетание не
        // проверено, и CX9 называет причину.
        let measure = styleMeasure
        if (forced) {
          try {
            measure = pixelMeasure(await fitSnapshot(roots))
          } catch (error) {
            if (!(error instanceof FitError)) throw error
            fitProblems.push(
              `${story} | ${comboLabel(combo)}: ${error.message}`,
            )
            audit.checked[comboLabel(combo)] = 0
            continue
          }
        }
        const result = auditRoots(
          `${bucket} ${story}`,
          combo,
          roots,
          measure,
          dim,
        )
        audit.checked[comboLabel(combo)] = result.checked
        findings[bucket].push(...result.findings)
        // axe считает по стилям и не видит слоёв браузера в `forced-colors` (§6).
        if (forced) continue
        const axeResult = await runAxe(
          `CX7 ${story}`,
          combo,
          roots,
          dim !== undefined,
        )
        for (const { key, summary } of axeResult.violations) {
          seen.add(key)
          if (!(key in known)) axeProblems.push(`${key}: ${summary}`)
        }
        axeProblems.push(...axeResult.problems)
      }
      await resetCombo()
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
    await resetCombo()
    expect(BASE_COMBOS.map(comboLabel)).toHaveLength(8)
    expect(new Set(BASE_COMBOS.map(c => c.palette))).toEqual(
      new Set(['tessera', 'stories']),
    )
  })

  test('CX9: матрица обходит каталог и в forced-colors — две палитры Chromium на двух темах грида', () => {
    expect(FORCED_COMBOS.map(comboLabel).sort()).toEqual([
      'stories/dark/forced-dark',
      'stories/dark/forced-light',
      'stories/light/forced-dark',
      'stories/light/forced-light',
    ])
    expect(audits.length).toBeGreaterThan(0)
    expect(fitProblems).toEqual([])
    for (const audit of audits) {
      for (const combo of FORCED_COMBOS) {
        expect(
          audit.checked[comboLabel(combo)],
          `${audit.story} | ${comboLabel(combo)}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  test('CX10: forced-colors — текст, иконки и флажки во всех областях к фону по пикселям снимка', ({
    skip,
  }) => {
    skip(
      server.browser === 'webkit',
      'WebKit не подменяет цвета в forced-colors',
    )
    expectClean(findings.CX10)
  })

  test('CX11: фон по пикселям видит подложку браузера под текстом на заливке', async ({
    skip,
  }) => {
    skip(
      server.browser !== 'chromium',
      'подложку под строкой текста кладёт только Chromium; WebKit цвета не подменяет',
    )
    // Строка текста — в самом блоке с заливкой: подложку Chromium кладёт по нему.
    const Stand = ({ adjust }: { adjust: boolean }) => (
      <div style={{ padding: 24 }}>
        <style>{`@media (forced-colors: active) {
          .cx11 { background-color: Highlight; color: HighlightText; padding: 8px 12px; width: 240px; }
          .cx11[data-adjust] { forced-color-adjust: none; }
        }`}</style>
        <div className="cx11" data-adjust={adjust || undefined}>
          Selected row text
        </div>
      </div>
    )
    const audit = async (adjust: boolean) => {
      const screen = await render(<Stand adjust={adjust} />)
      await applyCombo(FORCED_COMBOS[0]!)
      const result = auditRoots(
        'CX11',
        FORCED_COMBOS[0]!,
        [screen.container],
        pixelMeasure(await snapshot()),
      )
      await resetCombo()
      await screen.unmount()
      return result
    }
    const plated = await audit(false)
    expect(plated.checked).toBeGreaterThan(0)
    expect(plated.findings.length).toBeGreaterThan(0)
    const clean = await audit(true)
    expect(clean.checked).toBeGreaterThan(0)
    expect(clean.findings).toEqual([])
  })

  test('CX7: axe — нарушений нет, incomplete на тексте только по разобранным причинам', () => {
    expect(audits.length).toBeGreaterThan(0)
    expect(axeProblems).toEqual([])
  })

  test('CX8: база известных нарушений только сокращается', () => {
    // У каждой записи — причина; запись, которой больше нет в прогоне, — устарела.
    // Записи шагов гайдов (CX12, CX13) сверяет набор `contrast-guides`.
    expect(
      Object.entries(known).filter(([, reason]) => !reason.trim()),
    ).toEqual([])
    expect(
      Object.keys(known).filter(
        key => !/^CX1[23] /.test(key) && !seen.has(key),
      ),
    ).toEqual([])
  })
})
