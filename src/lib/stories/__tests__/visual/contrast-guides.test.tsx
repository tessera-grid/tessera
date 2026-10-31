import type { ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { page, server } from 'vitest/browser'
import { beforeAll, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import baseline from './contrast-baseline.json'
import {
  COMBOS,
  type Combo,
  type ComposedState,
  FitError,
  type Finding,
  STEP_COMBOS,
  type Shot,
  applyCombo,
  auditRoots,
  comboLabel,
  fitSnapshot,
  frame,
  gridsAndPopups,
  loadStories,
  pixelMeasure,
  pseudoChange,
  resetCombo,
  runAxe,
  snapshot,
  style,
  styleMeasure,
} from './contrast-helpers'
import { CATALOG_STATES } from '../../__mocks__/catalog'
import { applyPseudoStates } from '../../__mocks__/catalogPlay'
import { type GuideStoryStep, guideSteps } from '../../demos/GuideStory'

// Шаги гайдов в матрице контраста (ADR 0089, §7, CX12–CX16): промежуточные состояния
// фич существуют только как шаги гайдов. Набор проходит каждый гайд тем же `play`, что
// тесты каталога, и после каждого шага проверяет пороги в сочетаниях шага; признаки
// шага (`states`, `pseudo`, `immediate`) — единственное, что обход читает у истории.
// Здесь же VR14 (ADR 0093): реестр каталога покрыт историями и шагами.

/** Проверка одного шага: проверенных узлов по сочетаниям. */
interface StepAudit {
  story: string
  step: string
  states: string[]
  checked: Record<string, number>
}

interface GuideResult {
  audits: StepAudit[]
  findings: Finding[]
  /** Ключи нарушений axe — для базы. */
  axeViolations: { key: string; summary: string }[]
  axeProblems: string[]
  /** Псевдо-состояние без системного цвета в режиме (CX14). */
  pseudo: string[]
  /** Снимок не сделан: документ выше окна или поповер не встал (CX16). */
  fit: string[]
  /** Шаги `play` против шагов панели и падения `play` (CX12). */
  guard: string[]
}

const emptyResult = (): GuideResult => ({
  audits: [],
  findings: [],
  axeViolations: [],
  axeProblems: [],
  pseudo: [],
  fit: [],
  guard: [],
})

const PSEUDO_CLASSES = [
  'pseudo-hover',
  'pseudo-focus',
  'pseudo-focus-visible',
  'pseudo-active',
]

const stepsIn = (container: HTMLElement) => {
  const root = container.querySelector('[data-guide-root]')
  return root ? guideSteps.get(root) : undefined
}

const combosOf = (step: GuideStoryStep) => (step.states ? COMBOS : STEP_COMBOS)

/** Узлы псевдо-состояния шага. */
const pseudoTargets = (step: GuideStoryStep) =>
  Object.values(step.pseudo ?? {})
    .flat()
    .flatMap(selector => [...document.querySelectorAll(selector)])

/** Остановка проигрывания после шага с `immediate` (CX15). */
class StopReplay extends Error {}

/** Вспышка итога (ADR 0134): живёт по таймеру, переходом её не довести. */
const FLASHES = '[data-flash], [data-column-flash]'
/** Предел ожидания конца вспышек шага, мс (CX19). */
const FLASH_WAIT = 5000

/** Вспышки в гриде кончились; `false` — не за предел. */
const settleFlashes = async (container: HTMLElement) => {
  const started = performance.now()
  while (container.querySelector(FLASHES)) {
    if (performance.now() - started > FLASH_WAIT) return false
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  return true
}

/**
 * Проверка шага в сочетаниях: пороги по стилям или пикселям, axe в обычных; для
 * `pseudo` — снимки до и после в режиме. `finish: false` — короткое состояние.
 */
const auditStep = async (
  result: GuideResult,
  label: string,
  container: HTMLElement,
  step: GuideStoryStep,
  combos: readonly Combo[],
  storyId: string,
  finish: boolean,
) => {
  const audit =
    result.audits.find(a => `${a.story} › ${a.step}` === label) ??
    (() => {
      const created: StepAudit = {
        story: label.split(' › ')[0]!,
        step: step.title,
        states: step.states ?? [],
        checked: {},
      }
      result.audits.push(created)
      return created
    })()
  const shoot = async (combo: Combo) => {
    try {
      const { grids, popups } = gridsAndPopups(container)
      return await fitSnapshot([...grids, ...popups], { finish })
    } catch (error) {
      if (!(error instanceof FitError)) throw error
      result.fit.push(`${label} | ${comboLabel(combo)}: ${error.message}`)
      return null
    }
  }
  // Обычный шаг — в покое (CX19): иначе сочетания застанут разные фазы вспышки, а снимок
  // режима и цвет текста из стилей — разные моменты.
  if (finish && !(await settleFlashes(container))) {
    result.guard.push(
      `${label}: вспышка итога не кончилась за ${FLASH_WAIT} мс`,
    )
  }
  // Псевдо-состояние: снимки режима до него, затем классы `pseudo-*`.
  const before = new Map<string, Shot | null>()
  if (step.pseudo) {
    for (const combo of combos.filter(c => c.mode === 'forced')) {
      await applyCombo(combo, { finish })
      // Действие шага наводит указатель само (`pointAt`), и смена сочетания может
      // повторить его: база — без наведения.
      for (const el of document.querySelectorAll(
        PSEUDO_CLASSES.map(c => `.${c}`).join(','),
      )) {
        el.classList.remove(...PSEUDO_CLASSES)
      }
      await frame()
      before.set(comboLabel(combo), await shoot(combo))
    }
    await applyPseudoStates(storyId, step.pseudo)
  }
  for (const combo of combos) {
    await applyCombo(combo, { finish })
    const { grids, popups } = gridsAndPopups(container)
    const roots = [...grids, ...popups]
    const body = container.querySelector('.data-grid__body')
    const opacity = body ? Number(style(body).opacity) : 1
    // Приглушённое тело обновления (ADR 0094) — по прозрачности, а не по состоянию.
    const dim = opacity < 0.99 ? opacity : undefined
    const forced = combo.mode === 'forced'
    let measure = styleMeasure
    if (forced) {
      const shot = await shoot(combo)
      if (!shot) {
        audit.checked[comboLabel(combo)] = 0
        continue
      }
      measure = pixelMeasure(shot)
      const was = before.get(comboLabel(combo))
      if (was) {
        for (const el of pseudoTargets(step)) {
          const { changed, system } = pseudoChange(was, shot, el)
          if (changed === 0 || system < changed / 2) {
            result.pseudo.push(
              `${label} | ${comboLabel(combo)} | ${el.className}: отличается ${changed} px, системного цвета ${system}`,
            )
          }
        }
      }
    }
    const audited = auditRoots(`CX12 ${label}`, combo, roots, measure, dim)
    audit.checked[comboLabel(combo)] = audited.checked
    result.findings.push(...audited.findings)
    if (forced) continue
    // Под открытым поповером текст грида перекрыт — axe считает поповер.
    const axeResult = await runAxe(
      `CX13 ${label}`,
      combo,
      popups.length ? popups : roots,
      dim !== undefined,
    )
    result.axeViolations.push(...axeResult.violations)
    result.axeProblems.push(...axeResult.problems)
  }
  for (const el of document.querySelectorAll(
    PSEUDO_CLASSES.map(c => `.${c}`).join(','),
  )) {
    el.classList.remove(...PSEUDO_CLASSES)
  }
  await resetCombo()
}

/**
 * Проходит гайд его `play` со своим `step`: после каждого шага — проверка (CX12). Шаг с
 * `immediate` проверяется сразу в первом своём сочетании, остальные — своими
 * проигрываниями с сочетанием, заданным заранее (CX15).
 */
const walkGuide = async (story: string, Story: ComposedState) => {
  const result = emptyResult()
  const played: string[] = []
  const later: { title: string; combo: Combo }[] = []
  let panel: readonly GuideStoryStep[] | undefined
  const screen = await render(<Story />)
  const runStep = async (title: string, play: () => Promise<void>) => {
    await play()
    panel ??= stepsIn(screen.container)
    const step = panel?.find(s => s.title === title)
    if (!step) {
      result.guard.push(`${story}: шаг play «${title}» — не шаг панели`)
      return
    }
    played.push(title)
    const combos = combosOf(step)
    const now = step.immediate ? combos.slice(0, 1) : combos
    if (step.immediate) {
      later.push(...combos.slice(1).map(combo => ({ title, combo })))
    }
    await auditStep(
      result,
      `${story} › ${title}`,
      screen.container,
      step,
      now,
      Story.id,
      !step.immediate,
    )
  }
  try {
    await Story.play!({ canvasElement: screen.container, step: runStep })
  } catch (error) {
    result.guard.push(`${story}: play упал — ${(error as Error).message}`)
  }
  await resetCombo()
  await screen.unmount()
  // Страж: каждый шаг панели проверен один раз.
  const titles = (panel ?? []).map(s => s.title)
  if (!panel) result.guard.push(`${story}: панель гайда не найдена`)
  for (const title of titles) {
    const times = played.filter(t => t === title).length
    const audited = result.audits.some(a => a.step === title)
    if (times !== 1 || !audited) {
      result.guard.push(
        `${story}: шаг «${title}» пройден ${times} раз, проверен — ${audited ? 'да' : 'нет'}`,
      )
    }
  }
  for (const { title, combo } of later) {
    const replay = await render(<Story />)
    await applyCombo(combo, { finish: false })
    try {
      await Story.play!({
        canvasElement: replay.container,
        step: async (name: string, play: () => Promise<void>) => {
          await play()
          if (name !== title) return
          const step = stepsIn(replay.container)!.find(s => s.title === title)!
          await auditStep(
            result,
            `${story} › ${title}`,
            replay.container,
            step,
            [combo],
            Story.id,
            false,
          )
          throw new StopReplay()
        },
      })
    } catch (error) {
      if (!(error instanceof StopReplay)) {
        result.guard.push(
          `${story}: проигрывание до «${title}» упало — ${(error as Error).message}`,
        )
      }
    }
    await resetCombo()
    await replay.unmount()
  }
  return result
}

// --- Стенды механизмов (CX13–CX16) --------------------------------------------------

/**
 * Стенд-гайд без грида: корень темы для обхода, шаги в реестре гайдов; `play` проходит
 * шаги по порядку, действие шага — `enter`.
 */
const stand = (
  steps: readonly GuideStoryStep[],
  children: ReactNode,
  height?: number,
): ComposedState => {
  const Stand = () => (
    <div
      data-guide-root=""
      ref={el => {
        if (el) guideSteps.set(el, steps)
      }}
      style={{ padding: 16 }}
    >
      <style>{`
        .cx-stand { background: white; color: black; font: 14px/20px sans-serif; padding: 8px; }
        .cx-stand div { padding: 4px 8px; margin: 4px 0; }
        @media (forced-colors: active) {
          .cx14-visible.pseudo-hover { outline: 2px solid Highlight; }
          .cx14-custom.pseudo-hover { forced-color-adjust: none; outline: 2px solid rgb(255, 0, 255); }
          .cx15-flash { forced-color-adjust: none; background: white; }
          .cx19-flash { forced-color-adjust: none; background: white; color: black; }
        }
        .cx19-flash[data-flash] { color: #d0d0d0; }
      `}</style>
      <div
        className="data-grid-theme theme-wrapper cx-stand"
        style={{ height }}
      >
        {children}
      </div>
    </div>
  )
  return Object.assign(Stand, {
    id: 'contrast-guides--stand',
    storyName: 'Stand',
    parameters: {},
    play: async ({
      canvasElement,
      step,
    }: {
      canvasElement: HTMLElement
      step: (title: string, play: () => Promise<void>) => Promise<void>
    }) => {
      for (const s of steps) {
        await step(s.title, async () => {
          s.enter?.(canvasElement, { update: () => {} })
        })
      }
    },
  }) as unknown as ComposedState
}

const REST: GuideStoryStep = { title: 'Покой', hint: 'Стенд в покое.' }

// --- Прогон -------------------------------------------------------------------------

const all = emptyResult()
let walked = 0

const known = baseline as Record<string, string>

/**
 * WebKit не подменяет цвета в forced-colors (§6): его находки в сочетаниях режима — не
 * проверка (CX5, CX10, CX15).
 */
const forcing = server.browser !== 'webkit'
const checked = (key: string) => forcing || !key.includes('/forced-')

/** Истории сценариев без гайда — с причиной; их вид проверяет каталог. */
const WITHOUT_GUIDE: Record<string, string> = {}
const OWN_KEYS = /^CX1[23] /

describe('Шаги гайдов в матрице контраста (ADR 0089, §7)', () => {
  beforeAll(async () => {
    // Окно матрицы (§6): снимок без сжатия; консоль истории — не грид, на время обхода
    // скрыта.
    await page.viewport(900, 720)
    const hide = document.createElement('style')
    hide.textContent =
      '[data-testid="story-console"] { display: none !important; }'
    document.head.append(hide)
    const guides = (await loadStories()).filter(
      ({ path, story, Story }) =>
        Story.parameters.scenario &&
        !path.includes('.dev.stories') &&
        !(story in WITHOUT_GUIDE),
    )
    for (const { story, Story } of guides) {
      const result = await walkGuide(story, Story)
      for (const key of Object.keys(all) as (keyof GuideResult)[]) {
        ;(all[key] as unknown[]).push(...result[key])
      }
      walked++
    }
    hide.remove()
  }, 3_600_000)

  test('CX12: каждый шаг каждого гайда проверен тем же play в каждом своём сочетании, пороги CX1–CX5 и CX10 держатся', () => {
    expect(walked).toBeGreaterThan(0)
    expect(all.guard).toEqual([])
    for (const audit of all.audits) {
      const combos = audit.states.length ? COMBOS : STEP_COMBOS
      // В обычном режиме проверять нечего (скелет без колонок) — холостой проход честен.
      const empty = combos
        .filter(combo => combo.mode !== 'forced')
        .every(combo => audit.checked[comboLabel(combo)] === 0)
      if (empty) continue
      for (const combo of combos) {
        expect(
          audit.checked[comboLabel(combo)],
          `${audit.story} › ${audit.step} | ${comboLabel(combo)}`,
        ).toBeGreaterThan(0)
      }
    }
    const seen = new Set([
      ...all.findings.map(f => f.key),
      ...all.axeViolations.map(v => v.key),
    ])
    expect(
      all.findings
        .filter(f => !(f.key in known))
        .filter(f => checked(f.key))
        .map(f => `${f.key} — ${f.ratio.toFixed(2)}:1 < ${f.need}:1`),
    ).toEqual([])
    // База шагов только сокращается, как CX8.
    expect(
      Object.keys(known).filter(key => OWN_KEYS.test(key) && !seen.has(key)),
    ).toEqual([])
  })

  test('CX5: поповеры — пункт в покое, под указателем и выбранный, тултип — каждое состояние overlay проверено шагом гайда во всех сочетаниях', () => {
    const popups = all.audits.filter(audit =>
      audit.states.some(state => state.startsWith('overlay.')),
    )
    const covered = new Set(popups.flatMap(audit => audit.states))
    expect(
      CATALOG_STATES.overlay
        .map(state => `overlay.${state}`)
        .filter(state => !covered.has(state)),
    ).toEqual([])
    for (const audit of popups) {
      for (const combo of COMBOS) {
        expect(
          audit.checked[comboLabel(combo)],
          `${audit.story} › ${audit.step} | ${comboLabel(combo)}`,
        ).toBeGreaterThan(0)
      }
    }
    const labels = popups.map(audit => `${audit.story} › ${audit.step}`)
    expect(
      all.findings
        .filter(f => labels.some(label => f.key.includes(label)))
        .filter(f => !(f.key in known))
        .filter(f => checked(f.key))
        .map(f => `${f.key} — ${f.ratio.toFixed(2)}:1 < ${f.need}:1`),
    ).toEqual([])
  })

  /** Сочетания шага без состояний каталога — явно, не из STEP_COMBOS. */
  const STEP_LABELS = [
    'stories/dark/standard',
    'stories/light/forced-dark',
    'stories/light/forced-light',
    'stories/light/standard',
  ]

  test('CX13: сочетания шага — обычный режим в двух темах и forced-colors в двух палитрах, шаг со states — все двенадцать; axe в обычных', async () => {
    for (const audit of all.audits) {
      const want = audit.states.length ? COMBOS.map(comboLabel) : STEP_LABELS
      expect(Object.keys(audit.checked).sort(), audit.step).toEqual(want.sort())
    }
    expect(
      all.axeViolations
        .filter(v => !(v.key in known))
        .map(v => `${v.key}: ${v.summary}`),
    ).toEqual([])
    expect(all.axeProblems).toEqual([])
    // Стенд: шаг с состоянием каталога — во всех двенадцати.
    const result = await walkGuide(
      'Стенд CX13',
      stand(
        [REST, { title: 'Состояние', hint: '', states: ['body.hover'] }],
        <div>Row text</div>,
      ),
    )
    expect(result.guard).toEqual([])
    const audit = result.audits.find(a => a.step === 'Состояние')!
    expect(Object.keys(audit.checked).sort()).toEqual(
      COMBOS.map(comboLabel).sort(),
    )
    expect(
      Object.keys(
        result.audits.find(a => a.step === REST.title)!.checked,
      ).sort(),
    ).toEqual(STEP_LABELS)
  })

  test('CX14: псевдо-состояние шага ставится классами pseudo-* и видно в forced-colors системным цветом', async () => {
    expect(all.pseudo).toEqual([])
    const walk = (target: string) =>
      walkGuide(
        `Стенд CX14 ${target}`,
        stand(
          [
            REST,
            { title: 'Наведение', hint: '', pseudo: { hover: `.${target}` } },
          ],
          <>
            <div className="cx14-visible">Visible hover</div>
            <div className="cx14-hidden">Hidden hover</div>
            <div className="cx14-custom">Own color hover</div>
          </>,
        ),
      )
    const visible = await walk('cx14-visible')
    expect(visible.guard).toEqual([])
    expect(visible.pseudo).toEqual([])
    // Наведение без отличия и наведение своим, не системным цветом — нарушения.
    const hidden = await walk('cx14-hidden')
    expect(hidden.pseudo).toHaveLength(2)
    const custom = await walk('cx14-custom')
    expect(custom.pseudo).toHaveLength(2)
    // Три стенда со снимками до и после в сочетаниях режима: в WebKit ~9 с без нагрузки.
  }, 60_000)

  test('CX15: шаг с immediate проверен сразу, без доведения переходов, во всех своих сочетаниях', async () => {
    // Вспышка: текст светлеет и за 4 с темнеет до чёрного — доведённый переход её прячет.
    const flash = (root: HTMLElement) => {
      root
        .querySelector('.cx15-flash')!
        .animate([{ color: '#d0d0d0' }, { color: '#000' }], {
          duration: 4000,
          fill: 'forwards',
        })
    }
    const walk = (immediate: boolean) =>
      walkGuide(
        `Стенд CX15 ${immediate}`,
        stand(
          [REST, { title: 'Вспышка', hint: '', enter: flash, immediate }],
          <div className="cx15-flash">Flash text</div>,
        ),
      )
    const short = await walk(true)
    expect(short.guard).toEqual([])
    const flagged = new Set(
      short.findings
        .filter(f => f.key.includes('Вспышка') && checked(f.key))
        .map(f => f.key.split(' | ')[1]),
    )
    expect([...flagged].sort()).toEqual(
      STEP_COMBOS.map(comboLabel).filter(checked).sort(),
    )
    const settled = await walk(false)
    expect(
      settled.findings.filter(f => f.key.includes('Вспышка') && checked(f.key)),
    ).toEqual([])
  })

  test('CX16: снимок forced-colors — только когда документ в окне; гайд выше окна роняет проверку с причиной', async () => {
    expect(all.fit).toEqual([])
    const tall = await walkGuide(
      'Стенд CX16',
      stand([REST], <div>Tall stand</div>, 2000),
    )
    expect(tall.fit.length).toBeGreaterThan(0)
    expect(tall.fit[0]).toMatch(/проверяемая область больше окна/)
  })

  test('CX19: шаг без immediate проверяется после конца вспышки итога во всех своих сочетаниях; вспышка, не кончившаяся за предел, — сбой стража', async () => {
    // Вспышка: текст светлый, пока на узле `data-flash`; таймер снимает его через 600 мс.
    const flash = (ends: boolean) => (root: HTMLElement) => {
      const el = root.querySelector('.cx19-flash')!
      el.setAttribute('data-flash', 'reverted')
      if (ends) setTimeout(() => el.removeAttribute('data-flash'), 600)
    }
    const walk = (ends: boolean) =>
      walkGuide(
        `Стенд CX19 ${ends}`,
        stand(
          [REST, { title: 'Отказ', hint: '', enter: flash(ends) }],
          <div className="cx19-flash">Flash text</div>,
        ),
      )
    const settled = await walk(true)
    expect(settled.guard).toEqual([])
    const audit = settled.audits.find(a => a.step === 'Отказ')!
    for (const label of STEP_LABELS) {
      expect(audit.checked[label], label).toBeGreaterThan(0)
    }
    expect(
      settled.findings
        .filter(f => f.key.includes('Отказ') && checked(f.key))
        .map(f => f.key),
    ).toEqual([])
    const endless = await walk(false)
    expect(endless.guard).toEqual([
      'Стенд CX19 false › Отказ: вспышка итога не кончилась за 5000 мс',
    ])
  }, 30_000)

  test('DG2: каждое состояние drag.* объявлено шагом гайда истории сценария перетаскивания и проверено матрицей во всех сочетаниях шага', () => {
    const dragging = ['/Rows/Dragging/', '/Columns/Dragging/']
    const covered = new Set(
      all.audits
        .filter(a => dragging.some(title => a.story.includes(title)))
        .filter(a => COMBOS.every(combo => a.checked[comboLabel(combo)]! > 0))
        .flatMap(a => a.states),
    )
    expect(
      CATALOG_STATES.drag
        .map(state => `drag.${state}`)
        .filter(state => !covered.has(state)),
    ).toEqual([])
  })

  test('VR14: каждое состояние реестра объявлено историей каталога или шагом гайда и проверено во всех двенадцати сочетаниях', async () => {
    // Истории с `vrStates` матрица проверяет во всех сочетаниях (CX1–CX5, CX9).
    const fromStories = (await loadStories()).flatMap(
      ({ Story }) => Story.parameters.vrStates ?? [],
    )
    const fromSteps = all.audits
      .filter(a => COMBOS.every(combo => a.checked[comboLabel(combo)]! > 0))
      .flatMap(a => a.states)
    const covered = new Set([...fromStories, ...fromSteps])
    const registry = Object.entries(CATALOG_STATES).flatMap(([area, states]) =>
      states.map(state => `${area}.${state}`),
    )
    expect(registry.filter(state => !covered.has(state))).toEqual([])
  })
})

describe('Снимок области (ADR 0089, §6)', () => {
  // Окно матрицы (§6): снимок без сжатия.
  beforeAll(() => page.viewport(900, 720))

  /** Квадрат 40×40 с углом в (10, 10) окна. */
  const square = (color: string) => {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed',
      left: '10px',
      top: '10px',
      width: '40px',
      height: '40px',
      background: color,
    })
    document.body.append(el)
    return el
  }

  test('CX17: снимок находит свою область, когда соседний узел страницы ушёл между запросом снимка и снимком', async () => {
    const neighbour = document.createElement('div')
    document.body.append(neighbour)
    const target = square('rgb(255, 0, 0)')
    const pending = snapshot(target, { left: 10, top: 10 })
    // Снимок уже запрошен, раннер узел ещё не нашёл.
    setTimeout(() => neighbour.remove())
    try {
      const shot = await pending
      expect(shot(30, 30)).toEqual([255, 0, 0, 1])
    } finally {
      neighbour.remove()
      target.remove()
    }
  })

  test('CX18: область, которую нельзя снять, роняет снимок за его предел с сообщением, а не держит обход до тайм-аута хука', async () => {
    const hidden = square('rgb(0, 0, 255)')
    hidden.style.visibility = 'hidden'
    const started = performance.now()
    try {
      await expect(
        snapshot(hidden, { left: 10, top: 10 }, { timeout: 1000 }),
      ).rejects.toThrow(/снимок области не снят за 1000 мс/)
      expect(performance.now() - started).toBeLessThan(5000)
    } finally {
      hidden.remove()
    }
  }, 30_000)
})
