/**
 * История сценария (ADR 0117, §6): панель шагов над гридом истории. Шаг меняет пропсы
 * грида — накопительно, от первого шага до текущего — и может выполнить действие при
 * входе в него (прокрутку). «Сначала» перемонтирует грид, как новое открытие.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'
import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { dataGridMeta } from '../dataGridMeta'
import type { CatalogState } from '../__mocks__/catalog'
import { getData } from '../__mocks__/data'
import { normalizeArgs } from '../__mocks__/utils/normalizeArgs'
import { type GuideStep, GuidePanel, useGuide } from './GuidePanel'
import { StoryConsole } from './StoryConsole'
import { createConsoleLog } from './consoleLog'
import { useArgsActions } from './useArgsActions'

/** Что знает шаг: аргументы истории и ответ «сервера» — строки мока по ним. */
export interface GuideContext {
  args: StoryProps
  rows: NonNullable<StoryProps['dataOverride']>
}

export interface GuideStoryStep extends GuideStep {
  /** Пропсы грида с этого шага: поверх аргументов истории и прежних шагов. */
  props?: (context: GuideContext) => Partial<StoryProps>
  /**
   * Действие при входе в шаг — то, что сделал бы пользователь (прокрутка); `app` — то,
   * что делает приложение посреди шага (данные меняются извне).
   */
  enter?: (root: HTMLElement, app: GuideApp) => void
  /** Шаг открывает грид заново: опции на время жизни таблицы (`initialPageSize`). */
  remount?: boolean
  /** Состояния каталога, которые показывает шаг: матрица контраста — во всех сочетаниях. */
  states?: CatalogState[]
  /**
   * Псевдо-состояние шага (`{ hover: '<селектор>' }`): человек наводит сам, матрица
   * контраста ставит классы `pseudo-*`.
   */
  pseudo?: Record<string, string | string[]>
  /** Короткое состояние (вспышка): матрица контраста проверяет его сразу после шага. */
  immediate?: boolean
}

/**
 * Приложение посреди шага: пропсы поверх пропсов шагов до следующего открытия грида —
 * «Сначала», шага с `remount` или шага назад.
 */
export interface GuideApp {
  update: (change: (props: Partial<StoryProps>) => Partial<StoryProps>) => void
}

/** Открытое меню или поповер таблицы. */
const OPEN_POPUP = '[role="menu"][data-open], [role="dialog"][data-open]'

const isGuideToggle = (target: EventTarget) =>
  target instanceof Element && !!target.closest('[data-testid="guide-toggle"]')

/** Шаги смонтированных гайдов по их корню — их признаки читает матрица контраста. */
export const guideSteps = new WeakMap<Element, readonly GuideStoryStep[]>()

/**
 * Аргументы грида истории сценария с гайдом (ADR 0117, SN27–SN28): умолчания меты и
 * свои — аргументы Storybook, оставшиеся в URL или сессии, функции не включают; из
 * них — только тема и язык из тулбара.
 */
export const guideArgs = (
  own: Partial<StoryProps>,
  storybook: Pick<StoryProps, 'colorMode' | 'locale'>,
): StoryProps =>
  normalizeArgs({
    ...dataGridMeta.args,
    ...own,
    colorMode: storybook.colorMode,
    locale: storybook.locale,
  } as StoryProps)

export const GuideStory = ({
  title,
  steps,
  args,
}: {
  title: string
  steps: readonly GuideStoryStep[]
  args: StoryProps
}) => {
  const guide = useGuide(steps.length)
  // Журнал консоли живёт, пока открыта история: «Сначала» его не стирает.
  const [consoleLog] = useState(createConsoleLog)
  const rows = useMemo(
    () => getData(args.dataCount, args.dataNesting),
    [args.dataCount, args.dataNesting],
  )
  const context: GuideContext = { args, rows }
  const props = steps
    .slice(0, guide.step + 1)
    .reduce<Partial<StoryProps>>(
      (all, step) => ({ ...all, ...step.props?.(context) }),
      {},
    )
  // Новое открытие грида — «Сначала» или шаг с `remount`.
  const mounts = steps
    .slice(0, guide.step + 1)
    .filter(step => step.remount).length
  // Шаг назад через действие: грид открывается заново с пропсами целевого шага (SN33).
  const [shown, setShown] = useState({ step: guide.step, rewinds: 0 })
  if (shown.step !== guide.step) {
    const undone = steps.slice(guide.step + 1, shown.step + 1)
    setShown({
      step: guide.step,
      rewinds: shown.rewinds + (undone.some(step => step.enter) ? 1 : 0),
    })
  }
  const root = useRef<HTMLDivElement>(null)
  const mount = `${guide.run}-${mounts}-${shown.rewinds}`
  const [appProps, setAppProps] = useState<{
    mount: string
    props: Partial<StoryProps>
  }>()
  const live = appProps?.mount === mount ? appProps.props : undefined
  const mountRef = useRef(mount)
  useIsomorphicLayoutEffect(() => {
    mountRef.current = mount
  }, [mount])
  const [app] = useState<GuideApp>(() => ({
    update: change =>
      setAppProps(prev => {
        const current = prev?.mount === mountRef.current ? prev.props : {}
        const props = change(current)
        return props === current && prev
          ? prev
          : { mount: mountRef.current, props }
      }),
  }))
  // Что поменяло приложение посреди шага — в консоль, как действие истории.
  useEffect(() => {
    if (appProps)
      consoleLog.log('app', `${Object.keys(appProps.props).join(', ')} changed`)
  }, [consoleLog, appProps])
  useIsomorphicLayoutEffect(() => {
    if (root.current) guideSteps.set(root.current, steps)
  }, [steps])
  // Шаг гайда — действие истории (ADR 0124, CL16): до эффектов грида, которые он вызовет.
  const stepTitle = steps[guide.step]?.title
  useIsomorphicLayoutEffect(() => {
    consoleLog.action({
      plugin: 'story',
      action: `Шаг ${guide.step + 1} · ${stepTitle}`,
      source: 'story',
    })
  }, [consoleLog, guide.step, guide.run, stepTitle])
  useArgsActions(consoleLog, args)
  const enter = steps[guide.step]?.enter
  // Нажатие на заголовок гайда — мимо поповера таблицы, и он закрывается: шаг с открытым
  // поповером заново доводит таблицу до своего состояния.
  const [reentries, setReentries] = useState(0)
  const popupAtToggle = useRef(false)
  useEffect(() => {
    if (root.current) enter?.(root.current, app)
  }, [enter, app, guide.step, guide.run, shown.rewinds, reentries])
  return (
    <div
      ref={root}
      data-guide-root=""
      style={{ display: 'flex', flexDirection: 'column' }}
      onPointerDownCapture={event => {
        popupAtToggle.current =
          isGuideToggle(event.target) && !!document.querySelector(OPEN_POPUP)
      }}
      onClick={event => {
        if (popupAtToggle.current && isGuideToggle(event.target))
          setReentries(count => count + 1)
        popupAtToggle.current = false
      }}
    >
      <GuidePanel
        title={title}
        steps={steps}
        step={guide.step}
        onBack={guide.back}
        onNext={guide.next}
        onRestart={guide.restart}
        onJump={guide.jump}
      />
      <StoryComponent
        key={mount}
        {...args}
        {...props}
        {...live}
        consoleLog={consoleLog}
      />
      <StoryConsole log={consoleLog} />
    </div>
  )
}
