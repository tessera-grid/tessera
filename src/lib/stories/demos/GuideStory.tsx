/**
 * История сценария (ADR 0117, §6): панель шагов над гридом истории. Шаг меняет пропсы
 * грида — накопительно, от первого шага до текущего — и может выполнить действие при
 * входе в него (прокрутку). «Сначала» перемонтирует грид, как новое открытие.
 */
import { useEffect, useMemo, useRef } from 'react'

import { StoryComponent } from '../DataGridStory'
import type { StoryProps } from '../DataGridStory.types'
import { getData } from '../__mocks__/data'
import { type GuideStep, GuidePanel, useGuide } from './GuidePanel'

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
}

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
  const enter = steps[guide.step]?.enter
  useEffect(() => {
    if (root.current) enter?.(root.current)
  }, [enter, guide.step, guide.run])
  return (
    <div ref={root} style={{ display: 'flex', flexDirection: 'column' }}>
      <GuidePanel
        title={title}
        steps={steps}
        step={guide.step}
        onBack={guide.back}
        onNext={guide.next}
        onRestart={guide.restart}
        onJump={guide.jump}
      />
      <StoryComponent key={`${guide.run}-${mounts}`} {...args} {...props} />
    </div>
  )
}
