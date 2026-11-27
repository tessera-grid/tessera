import type { ReactNode } from 'react'
import { cleanup, render } from 'vitest-browser-react'
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
import { parkPointer } from '../pointer'
import { CATALOG_STATES } from '../../__mocks__/catalog'
import { PSEUDO_CLASS, applyPseudoStates } from '../../__mocks__/catalogPlay'
import { type DemoStoryStep, guideSteps } from '../../demos/DemoStory'
import { both } from '../storyText.helpers'

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

const PSEUDO_CLASSES = Object.values(PSEUDO_CLASS)

const stepsIn = (container: HTMLElement) => {
  const root = container.querySelector('[data-guide-root]')
  return root ? guideSteps.get(root) : undefined
}

const combosOf = (step: DemoStoryStep) => (step.states ? COMBOS : STEP_COMBOS)

/** Узлы псевдо-состояния шага. */
const pseudoTargets = (step: DemoStoryStep) =>
  Object.entries(step.pseudo ?? {}).flatMap(([state, selectors]) =>
    [selectors].flat().flatMap(selector =>
      [...document.querySelectorAll(selector)].map(el => ({
        el,
        className: PSEUDO_CLASS[state]!,
      })),
    ),
  )

/** Остановка проигрывания после шага с `immediate` (CX15). */
class StopReplay extends Error {}

/** Вспышка итога (ADR 0134): живёт по таймеру, переходом её не довести. */
const FLASHES = '[data-flash], [data-column-flash]'
/**
 * Быстрая прокрутка (ADR 0008): ячейки — скелеты, пока режим не кончится. Прокрутка рывком в
 * шаге и возврат прокрутки после axe её включают.
 */
const FAST_SCROLL = '[data-fast-scrolling]'
/** Предел ожидания конца вспышек и быстрой прокрутки, мс (CX19–CX20). */
const SETTLE_WAIT = 5000

let lastProgress = performance.now()
const reportProgress = (label: string) => {
  const now = performance.now()
  if (now - lastProgress < 30_000) return
  lastProgress = now
  // eslint-disable-next-line no-console -- прогресс длительных снимков внутри одной истории
  console.log(`[contrast-guides] ${label}`)
}

/** Узлов `selector` в гриде не осталось; `false` — не за предел. */
const settled = async (container: HTMLElement, selector: string) => {
  const started = performance.now()
  while (container.querySelector(selector)) {
    if (performance.now() - started > SETTLE_WAIT) return false
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
  step: DemoStoryStep,
  combos: readonly Combo[],
  storyId: string,
  finish: boolean,
) => {
  const audit =
    result.audits.find(a => `${a.story} › ${a.step}` === label) ??
    (() => {
      const created: StepAudit = {
        story: label.split(' › ')[0]!,
        step: step.title.ru,
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
  if (finish && !(await settled(container, FLASHES))) {
    result.guard.push(
      `${label}: вспышка итога не кончилась за ${SETTLE_WAIT} мс`,
    )
  }
  // Перед каждым сочетанием (CX20): снимок застал бы скелеты, а текст прочитан из стилей.
  const scrollProblem = `${label}: быстрая прокрутка не кончилась за ${SETTLE_WAIT} мс`
  const settleScroll = async () => {
    if (!finish || result.guard.includes(scrollProblem)) return
    if (!(await settled(container, FAST_SCROLL))) {
      result.guard.push(scrollProblem)
    }
  }
  for (const combo of combos) {
    reportProgress(`${label} | ${comboLabel(combo)}`)
    await applyCombo(combo, { finish })
    await settleScroll()
    const forced = combo.mode === 'forced'
    let before: Shot | null = null
    if (forced && step.pseudo) {
      // Действие шага наводит указатель само (`pointAt`), и смена сочетания может
      // повторить его: база — без наведения.
      for (const el of document.querySelectorAll(
        PSEUDO_CLASSES.map(c => `.${c}`).join(','),
      )) {
        el.classList.remove(...PSEUDO_CLASSES)
      }
      await frame()
      before = await shoot(combo)
    }
    // Смена сочетания может перемонтировать узел и снять класс псевдосостояния.
    if (step.pseudo) await applyPseudoStates(storyId, step.pseudo)
    const { grids, popups } = gridsAndPopups(container)
    const roots = [...grids, ...popups]
    const body = container.querySelector('.data-grid__body')
    const opacity = body ? Number(style(body).opacity) : 1
    // Приглушённое тело обновления (ADR 0094) — по прозрачности, а не по состоянию.
    const dim = opacity < 0.99 ? opacity : undefined
    let measure = styleMeasure
    if (forced) {
      let shot = await shoot(combo)
      // React может заменить узел или перезаписать className во время снимка.
      // Сравниваем только снимок, на котором целевое состояние сохранилось.
      if (
        shot &&
        step.pseudo &&
        pseudoTargets(step).some(
          ({ el, className }) => !el.classList.contains(className),
        )
      ) {
        await applyPseudoStates(storyId, step.pseudo)
        shot = await shoot(combo)
      }
      if (!shot) {
        audit.checked[comboLabel(combo)] = 0
        continue
      }
      measure = pixelMeasure(shot)
      if (before) {
        for (const { el, className } of pseudoTargets(step)) {
          if (!el.classList.contains(className)) {
            result.pseudo.push(
              `${label} | ${comboLabel(combo)}: ${className} исчез во время снимка`,
            )
            continue
          }
          const { changed, system } = pseudoChange(before, shot, el)
          // WebKit режим только эмулирует: заливка наведения остаётся, важен системный контур.
          const unseen = forcing ? system < changed / 2 : system === 0
          if (changed === 0 || unseen) {
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
  let panel: readonly DemoStoryStep[] | undefined
  await parkPointer()
  const screen = await render(<Story />)
  const runStep = async (title: string, play: () => Promise<void>) => {
    reportProgress(`${story} › ${title}`)
    await play()
    panel ??= stepsIn(screen.container)
    const step = panel?.find(s => s.title.ru === title)
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
  // unmount снимает React, но оставляет контейнер и запись корня до общего cleanup.
  await cleanup()
  // Страж: каждый шаг панели проверен один раз.
  const titles = (panel ?? []).map(s => s.title.ru)
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
    await parkPointer()
    const replay = await render(<Story />)
    await applyCombo(combo, { finish: false })
    try {
      await Story.play!({
        canvasElement: replay.container,
        step: async (name: string, play: () => Promise<void>) => {
          await play()
          if (name !== title) return
          const step = stepsIn(replay.container)!.find(
            s => s.title.ru === title,
          )!
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
    await cleanup()
  }
  return result
}

// --- Стенды механизмов (CX13–CX16) --------------------------------------------------

/**
 * Стенд-гайд без грида: корень темы для обхода, шаги в реестре гайдов; `play` проходит
 * шаги по порядку, действие шага — `enter`.
 */
const stand = (
  steps: readonly DemoStoryStep[],
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
          .cx20-scroll { forced-color-adjust: none; background: white; color: black; }
        }
        .cx19-flash[data-flash] { color: #d0d0d0; }
        .cx20-scroll[data-fast-scrolling] { color: #d0d0d0; }
      `}</style>
      <div
        className="data-grid-theme theme-wrapper cx-stand"
        data-tsr-grid=""
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
        await step(s.title.ru, async () => {
          s.enter?.(canvasElement, { update: () => {} })
        })
      }
    },
  }) as unknown as ComposedState
}

const REST: DemoStoryStep = {
  title: both('Покой'),
  hint: both('Стенд в покое.'),
}

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

const CHROMIUM = server.browser === 'chromium'
// WebKit снимает кадры для всей матрицы. На Windows 348 из 400 историй заняли три часа.
const MATRIX_TIMEOUT = (server.browser === 'webkit' ? 5 : 3) * 60 * 60 * 1000
const hasFindings = (result: GuideResult) =>
  result.findings.some(finding => checked(finding.key)) ||
  result.axeViolations.length > 0 ||
  result.axeProblems.length > 0 ||
  result.pseudo.length > 0 ||
  result.fit.length > 0 ||
  result.guard.length > 0

/** Только истории, чьё имя содержит строку, — для разбора; общие реестры тогда не сверяются. */
const ONLY = import.meta.env.VITE_CONTRAST_ONLY as string | undefined
const newContrastProblems = ({ findings }: GuideResult) =>
  findings
    .filter(finding => !(finding.key in known) && checked(finding.key))
    .map(
      finding =>
        `${finding.key} — ${finding.ratio.toFixed(2)}:1 < ${finding.need}:1`,
    )

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
        !(story in WITHOUT_GUIDE) &&
        (!ONLY || `${path} ${story}`.includes(ONLY)),
    )
    for (const { story, Story } of guides) {
      // eslint-disable-next-line no-console -- прогресс долгой матрицы контраста
      console.log(`[contrast-guides] ${walked + 1}/${guides.length} ${story}`)
      let result = await walkGuide(story, Story)
      // Случайный кадр подтверждается повтором. В Chromium повторяем только историю
      // с новой находкой: известные записи базы не удлиняют обход.
      const fresh = result.findings.some(finding => !(finding.key in known))
      if ((!CHROMIUM || fresh) && hasFindings(result))
        result = await walkGuide(story, Story)
      const problems = [
        ...result.guard,
        ...newContrastProblems(result),
        ...result.axeProblems,
        ...result.axeViolations
          .filter(violation => !(violation.key in known))
          .map(violation => `${violation.key}: ${violation.summary}`),
      ]
      if (problems.length > 0) {
        // eslint-disable-next-line no-console -- причина сбоя видна до окончания всей матрицы
        console.log('[contrast-guides]', problems.join('\n'))
      }
      for (const key of Object.keys(all) as (keyof GuideResult)[]) {
        ;(all[key] as unknown[]).push(...result[key])
      }
      walked++
    }
    hide.remove()
  }, MATRIX_TIMEOUT)

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
    expect(newContrastProblems(all)).toEqual([])
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

  // После матрицы снимки WebKit могут занять больше общего тайм-аута.
  test(
    'CX13: сочетания шага — обычный режим в двух темах и forced-colors в двух палитрах, шаг со states — все двенадцать; axe в обычных',
    { timeout: 60_000 },
    async () => {
      for (const audit of all.audits) {
        const want = audit.states.length ? COMBOS.map(comboLabel) : STEP_LABELS
        expect(Object.keys(audit.checked).sort(), audit.step).toEqual(
          want.sort(),
        )
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
          [
            REST,
            {
              title: both('Состояние'),
              hint: both(''),
              states: ['body.hover'],
            },
          ],
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
          result.audits.find(a => a.step === REST.title.ru)!.checked,
        ).sort(),
      ).toEqual(STEP_LABELS)
    },
  )

  // В WebKit три проверки снимков могут не уложиться в общий тайм-аут.
  test.each([
    { target: 'cx14-visible', violations: 0 },
    { target: 'cx14-hidden', violations: 2 },
    { target: 'cx14-custom', violations: 2 },
  ])(
    'CX14: псевдо-состояние шага видно в forced-colors системным цветом ($target)',
    async ({ target, violations }) => {
      expect(all.pseudo).toEqual([])
      const result = await walkGuide(
        `Стенд CX14 ${target}`,
        stand(
          [
            REST,
            {
              title: both('Наведение'),
              hint: both(''),
              pseudo: { hover: `.${target}` },
            },
          ],
          <>
            <div className="cx14-visible">Visible hover</div>
            <div className="cx14-hidden">Hidden hover</div>
            <div className="cx14-custom">Own color hover</div>
          </>,
        ),
      )
      expect(result.guard).toEqual([])
      expect(result.pseudo).toHaveLength(violations)
    },
    60_000,
  )

  test.each([true, false])(
    'CX15: контраст вспышки во всех сочетаниях шага (immediate: %s)',
    async immediate => {
      // Доведённый переход скрывает вспышку, а без доводки она видна во всех сочетаниях.
      const flash = (root: HTMLElement) => {
        root
          .querySelector('.cx15-flash')!
          .animate([{ color: '#d0d0d0' }, { color: '#000' }], {
            duration: 20_000,
            fill: 'forwards',
          })
      }
      const result = await walkGuide(
        `Стенд CX15 ${immediate}`,
        stand(
          [
            REST,
            { title: both('Вспышка'), hint: both(''), enter: flash, immediate },
          ],
          <div className="cx15-flash">Flash text</div>,
        ),
      )
      expect(result.guard).toEqual([])
      const flagged = new Set(
        result.findings
          .filter(f => f.key.includes('Вспышка') && checked(f.key))
          .map(f => f.key.split(' | ')[1]),
      )
      const expected = immediate
        ? STEP_COMBOS.map(comboLabel).filter(checked).sort()
        : []
      expect([...flagged].sort()).toEqual(expected)
    },
    60_000,
  )

  test('CX16: снимок forced-colors — только когда документ в окне; гайд выше окна роняет проверку с причиной', async () => {
    expect(all.fit).toEqual([])
    const tall = await walkGuide(
      'Стенд CX16',
      stand([REST], <div>Tall stand</div>, 2000),
    )
    expect(tall.fit.length).toBeGreaterThan(0)
    expect(tall.fit[0]).toMatch(/проверяемая область больше окна/)
  })

  test('CX22: узел под затемнением края прокручиваемой области не проверяется; тот же узел вне затемнения — проверяется', async () => {
    // Область с затемнением снизу: бледная строка у нижнего края — под ним, такая же сверху — нет.
    const result = await walkGuide(
      'Стенд CX22',
      stand(
        [REST],
        <div
          data-fade-bottom=""
          style={{
            height: 120,
            overflow: 'auto',
            ['--tsr-scroll-fade-below' as string]: '200px',
          }}
        >
          <div aria-label="clear-row" style={{ color: '#c0c0c0' }}>
            Pale text
          </div>
          <div style={{ height: 60 }} />
          <div aria-label="faded-row" style={{ color: '#c0c0c0' }}>
            Pale text
          </div>
          <div style={{ height: 200 }} />
        </div>,
      ),
    )
    const keys = result.findings.filter(f => checked(f.key)).map(f => f.key)
    expect(keys.some(key => key.includes('clear-row'))).toBe(true)
    expect(keys.filter(key => key.includes('faded-row'))).toEqual([])
  })

  test.each([true, false])(
    'CX19: проверка вспышки в обычном шаге (затухает: %s)',
    async ends => {
      // Вспышка: текст светлый, пока на узле `data-flash`; таймер снимает его через 600 мс.
      const flash = (root: HTMLElement) => {
        const el = root.querySelector('.cx19-flash')!
        el.setAttribute('data-flash', 'reverted')
        if (ends) setTimeout(() => el.removeAttribute('data-flash'), 600)
      }
      const settled = await walkGuide(
        `Стенд CX19 ${ends}`,
        stand(
          [REST, { title: both('Отказ'), hint: both(''), enter: flash }],
          <div className="cx19-flash">Flash text</div>,
        ),
      )
      if (!ends) {
        expect(settled.guard).toEqual([
          'Стенд CX19 false › Отказ: вспышка итога не кончилась за 5000 мс',
        ])
        return
      }
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
    },
    30_000,
  )

  test.each([true, false])(
    'CX20: проверка быстрой прокрутки в обычном шаге (завершается: %s)',
    async ends => {
      // Режим: текст светлый, пока на узле `data-fast-scrolling`; таймер снимает его через
      // 300 мс, смена темы включает снова — как возврат прокрутки после axe.
      let watch: MutationObserver | undefined
      const scroll = (root: HTMLElement) => {
        const el = root.querySelector('.cx20-scroll')!
        const start = () => {
          el.setAttribute('data-fast-scrolling', '')
          if (ends)
            setTimeout(() => el.removeAttribute('data-fast-scrolling'), 300)
        }
        start()
        if (!ends) return
        watch = new MutationObserver(start)
        watch.observe(document.documentElement, { attributeFilter: ['class'] })
      }
      const quiet = await walkGuide(
        `Стенд CX20 ${ends}`,
        stand(
          [REST, { title: both('Рывок'), hint: both(''), enter: scroll }],
          <div className="cx20-scroll">Row text</div>,
        ),
      ).finally(() => watch?.disconnect())
      if (!ends) {
        expect(quiet.guard).toEqual([
          'Стенд CX20 false › Рывок: быстрая прокрутка не кончилась за 5000 мс',
        ])
        return
      }
      expect(quiet.guard).toEqual([])
      const audit = quiet.audits.find(a => a.step === 'Рывок')!
      for (const label of STEP_LABELS) {
        expect(audit.checked[label], label).toBeGreaterThan(0)
      }
      expect(
        quiet.findings
          .filter(f => f.key.includes('Рывок') && checked(f.key))
          .map(f => f.key),
      ).toEqual([])
    },
    30_000,
  )

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
