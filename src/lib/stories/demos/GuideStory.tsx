/**
 * История сценария (ADR 0117, §6): панель шагов над гридом истории. Шаг меняет пропсы
 * грида — накопительно, от первого шага до текущего — и может выполнить действие при
 * входе в него (прокрутку). «Сначала» перемонтирует грид, как новое открытие.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
  /** Действие при входе в шаг — то, что сделал бы пользователь (прокрутка). */
  enter?: (root: HTMLElement) => void
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

/** Шаги смонтированных гайдов по их корню — их признаки читает матрица контраста. */
export const guideSteps = new WeakMap<Element, readonly GuideStoryStep[]>()

/**
 * Аргументы грида истории сценария с гайдом (ADR 0117, SN27–SN28): умолчания меты и
 * свои — аргументы Storybook, оставшиеся в URL или сессии, функции не включают; из
 * них — только тема декоратора.
 */
export const guideArgs = (
  own: Partial<StoryProps>,
  storybook: Pick<StoryProps, 'colorMode'>,
): StoryProps =>
  normalizeArgs({
    ...dataGridMeta.args,
    ...own,
    colorMode: storybook.colorMode,
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
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (root.current) guideSteps.set(root.current, steps)
  }, [steps])
  // Шаг гайда — действие истории (ADR 0124, CL16): до эффектов грида, которые он вызовет.
  const stepTitle = steps[guide.step]?.title
  useLayoutEffect(() => {
    consoleLog.action({
      plugin: 'story',
      action: `Шаг ${guide.step + 1} · ${stepTitle}`,
      source: 'story',
    })
  }, [consoleLog, guide.step, guide.run, stepTitle])
  useArgsActions(consoleLog, args)
  const enter = steps[guide.step]?.enter
  useEffect(() => {
    if (root.current) enter?.(root.current)
  }, [enter, guide.step, guide.run])
  return (
    <div
      ref={root}
      data-guide-root=""
      style={{ display: 'flex', flexDirection: 'column' }}
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
        key={`${guide.run}-${mounts}`}
        {...args}
        {...props}
        consoleLog={consoleLog}
      />
      <StoryConsole log={consoleLog} />
    </div>
  )
}
