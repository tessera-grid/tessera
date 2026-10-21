import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor } from 'storybook/test'

import { settle } from './__mocks__/catalogPlay'

import {
  MIN_PANEL_WIDTH,
  type GuideStep,
  GuidePanel,
  useGuide,
} from './demos/GuidePanel'

/**
 * Песочница панели сценария (ADR 0117): число шагов (путь по таблице заказов), длина названий и пояснений, свёрнута
 * или раскрыта. Файл `*.dev.stories.tsx` — только в `storybook dev` и тестах, в сборку
 * Storybook не попадает (`.storybook/main.ts`).
 */
interface SandboxArgs {
  title: string
  stepCount: number
  stepTitle: 'short' | 'long'
  stepHint: 'none' | 'short' | 'long'
  expanded: boolean
  /** Ширина области панели, px; 0 — во всю ширину холста. */
  containerWidth: number
}

/** Действие шага: короткое и длинное название, короткое и длинное пояснение. */
interface Action {
  title: [short: string, long: string]
  hint: [short: string, long: string]
}

/** Шаги песочницы — правдоподобный путь пользователя по таблице заказов. */
const ACTIONS: readonly Action[] = [
  {
    title: ['Открыть заказы', 'Открыть раздел заказов в личном кабинете'],
    hint: [
      'Таблица показывает скелет.',
      'Пока сервер готовит первую страницу, таблица рисует скелет по своей раскладке: колонки, ширины и служебные колонки уже на местах.',
    ],
  },
  {
    title: ['Данные пришли', 'Сервер вернул первую страницу заказов'],
    hint: [
      'Строки встают на место скелета.',
      'Строки встают ровно на место скелета: заголовки не сдвигаются, полоса прокрутки появляется, только если строк больше, чем помещается.',
    ],
  },
  {
    title: ['Сортировка по дате', 'Отсортировать заказы по дате оформления'],
    hint: [
      'Новые заказы — сверху.',
      'Нажатие на заголовок «Дата» сортирует по убыванию: самые свежие заказы поднимаются наверх, стрелка в заголовке показывает направление.',
    ],
  },
  {
    title: [
      'Фильтр по статусу',
      'Оставить только заказы в статусе «Ожидает оплаты»',
    ],
    hint: [
      'Видны только неоплаченные.',
      'В панели фильтра колонки «Статус» отмечен один вариант; над таблицей появляется сводка условия, счётчик показывает «12 из 240».',
    ],
  },
  {
    title: [
      'Поиск клиента',
      'Найти заказы клиента по фамилии в быстром поиске',
    ],
    hint: [
      'Совпадения подсвечены.',
      'Быстрый поиск ищет по видимым колонкам с задержкой ввода; совпадения в ячейках подсвечены, остальные строки скрыты.',
    ],
  },
  {
    title: ['Раскрыть заказ', 'Раскрыть заказ, чтобы увидеть его позиции'],
    hint: [
      'Позиции подгружаются.',
      'Позиции заказа приходят с сервера при раскрытии: шеврон показывает ожидание, затем вложенные строки появляются с отступом и линиями дерева.',
    ],
  },
  {
    title: ['Выбрать строки', 'Отметить несколько заказов флажками'],
    hint: [
      'Счётчик выбранных растёт.',
      'Флажки в служебной колонке отмечают строки; нижняя панель показывает число выбранных, а «выбрать всё» учитывает фильтр.',
    ],
  },
  {
    title: ['Изменить сумму', 'Исправить сумму заказа прямо в ячейке'],
    hint: [
      'Ячейка ждёт сервер.',
      'После ввода значение уходит на сервер: ячейка светится ожиданием, остальные ячейки можно править, не дожидаясь ответа.',
    ],
  },
  {
    title: ['Сервер отказал', 'Сервер отклонил новую сумму заказа'],
    hint: [
      'Ячейка в ошибке.',
      'Ячейка возвращает прежнее значение, вспыхивает красным и показывает причину отказа; повторная правка открывает черновик с текстом ошибки.',
    ],
  },
  {
    title: ['Закрепить колонку', 'Закрепить колонку «Клиент» слева'],
    hint: [
      'Колонка не уезжает.',
      'При горизонтальной прокрутке закреплённая колонка остаётся на месте, а остальные проходят под ней с тенью на границе.',
    ],
  },
  {
    title: ['Переставить колонки', 'Перетащить колонку «Сумма» ближе к началу'],
    hint: [
      'Колонки съезжают.',
      'Во время перетаскивания соседние колонки плавно расступаются; после броска заголовки, строки и итоги встают в новом порядке.',
    ],
  },
  {
    title: ['Скрыть колонку', 'Скрыть служебную колонку «Комментарий»'],
    hint: [
      'Меню «Колонки».',
      'В меню «Колонки» снят флажок; кнопка тулбара показывает точку активного действия, пока скрыта хотя бы одна колонка.',
    ],
  },
  {
    title: ['Сменить страницу', 'Перейти на третью страницу результатов'],
    hint: [
      'Новая страница.',
      'Пагинатор переключает страницу; прокрутка возвращается к началу, выбор строк сохраняется между страницами.',
    ],
  },
  {
    title: ['Группировка', 'Сгруппировать заказы по менеджеру'],
    hint: [
      'Группы со счётчиками.',
      'Строки собираются в группы по менеджеру; у каждой группы свой счётчик строк и сумма в футере.',
    ],
  },
  {
    title: ['Переставить строку', 'Перетащить заказ в другую группу'],
    hint: [
      'Превью броска.',
      'Пока строка в воздухе, на месте броска виден слот с отступом уровня; пауза над свёрнутой группой раскрывает её.',
    ],
  },
  {
    title: ['Быстрая прокрутка', 'Прокрутить список к концу колесом мыши'],
    hint: [
      'Ячейки — скелеты.',
      'На большой скорости ячейки рисуются скелетами, чтобы кадр не проседал; при остановке на их место встаёт содержимое.',
    ],
  },
  {
    title: ['Наверх', 'Вернуться к началу списка кнопкой «Наверх»'],
    hint: [
      'Плавная прокрутка.',
      'Кнопка в нижней панели прокручивает к первой строке: издалека — прыжком, последний экран — плавно; фокус остаётся на кнопке.',
    ],
  },
  {
    title: ['Обновить данные', 'Обновить список, не сбрасывая фильтры'],
    hint: [
      'Свечение под заголовками.',
      'Пока идёт обновление, под заголовками течёт свечение, строки приглушены и не прыгают; фильтры и выбор сохраняются.',
    ],
  },
  {
    title: ['Выгрузить в Excel', 'Выгрузить отфильтрованные заказы в Excel'],
    hint: [
      'Файл скачивается.',
      'Панель выгрузки предлагает строки и колонки: «как на экране», «выбранные», «все»; файл открывается в Excel с типами и закреплённой строкой заголовков.',
    ],
  },
  {
    title: ['Готово', 'Закрыть раздел заказов'],
    hint: [
      'Сценарий пройден.',
      'Все действия пройдены: таблица вернулась в исходное состояние, фильтры и сортировка сохранены до следующего открытия.',
    ],
  },
]

const makeSteps = ({
  stepCount,
  stepTitle,
  stepHint,
}: SandboxArgs): GuideStep[] =>
  Array.from({ length: Math.max(1, stepCount) }, (_, i) => {
    const action = ACTIONS[i % ACTIONS.length]!
    return {
      title: action.title[stepTitle === 'long' ? 1 : 0],
      hint: stepHint === 'none' ? '' : action.hint[stepHint === 'long' ? 1 : 0],
    }
  })

const Sandbox = (args: SandboxArgs) => {
  const steps = makeSteps(args)
  const guide = useGuide(steps.length)
  return (
    <div
      data-testid="sandbox"
      style={{ width: args.containerWidth || undefined, maxWidth: '100%' }}
    >
      <GuidePanel
        // Смена `expanded` в панели Controls — новое исходное состояние панели.
        key={String(args.expanded)}
        title={args.title}
        steps={steps}
        step={Math.min(guide.step, steps.length - 1)}
        onBack={guide.back}
        onNext={guide.next}
        onRestart={guide.restart}
        onJump={guide.jump}
        defaultExpanded={args.expanded}
      />
    </div>
  )
}

const meta = {
  title: 'Tessera/DEV/Guide panel',
  render: args => <Sandbox {...args} />,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Работа с заказами',
    stepCount: 3,
    stepTitle: 'short',
    stepHint: 'short',
    expanded: true,
    containerWidth: 0,
  },
  argTypes: {
    title: { control: 'text' },
    stepCount: { control: { type: 'range', min: 1, max: 20 } },
    stepTitle: { control: 'inline-radio', options: ['short', 'long'] },
    stepHint: {
      control: 'inline-radio',
      options: ['none', 'short', 'long'],
    },
    expanded: { control: 'boolean' },
    containerWidth: { control: { type: 'range', min: 0, max: 1200, step: 20 } },
  },
} satisfies Meta<SandboxArgs>

export default meta

/** «Далее», когда шаг дождался своей анимации и кнопка снова активна. */
const nextStep = async (canvas: HTMLElement) => {
  const next = canvas.querySelector<HTMLButtonElement>(
    '[data-testid="guide-next"]',
  )!
  await waitFor(() => expect(next).toBeEnabled(), { timeout: 5000 })
  await userEvent.click(next)
}

/** Все параметры в панели Controls. */
export const GuidePanelPlayground: StoryObj<SandboxArgs> = {
  name: 'Playground',
}

/**
 * Много шагов с длинными текстами: лента прокручивается вручную, активный шаг по центру,
 * края с шагами за ними затемнены; перенос названий и пояснений.
 */
export const GuidePanelManySteps: StoryObj<SandboxArgs> = {
  name: 'Many long steps',
  parameters: { requirements: ['SN18'] },
  args: {
    title:
      'Очень длинное название сценария, которое не помещается в строку панели',
    stepCount: 12,
    stepTitle: 'long',
    stepHint: 'long',
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    const steps = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide-steps"]',
    )!
    for (let i = 0; i < 5; i++) await nextStep(canvasElement)
    await settle()
    const view = steps.getBoundingClientRect()
    const active = steps
      .querySelector('[aria-current="step"]')!
      .getBoundingClientRect()
    await expect(steps.dataset.slider).toBe('true')
    await expect(
      Math.abs(active.left + active.width / 2 - (view.left + view.width / 2)),
    ).toBeLessThan(1)
    // Затемнены оба края: шаги есть и слева, и справа.
    const transparentStops = getComputedStyle(steps).maskImage.match(
      /transparent|rgba\(0, 0, 0, 0\)/g,
    )
    await expect(transparentStops).toHaveLength(2)
    // Ручная прокрутка: в начало — затемнён только правый край, колесо листает вбок,
    // в конец — только левый.
    const fades = () =>
      [
        ...getComputedStyle(steps).maskImage.matchAll(
          /transparent|rgba\(0, 0, 0, 0\)/g,
        ),
      ].length
    steps.scrollLeft = 0
    await waitFor(() => expect(fades()).toBe(1))
    await expect(getComputedStyle(steps).maskImage).toMatch(
      /^linear-gradient\(to right, (rgb\(0, 0, 0\)|#000)/,
    )
    steps.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }),
    )
    await waitFor(() => expect(steps.scrollLeft).toBeGreaterThan(200))
    await waitFor(() => expect(fades()).toBe(2))
    steps.scrollLeft = steps.scrollWidth
    await waitFor(() => expect(fades()).toBe(1))
    await expect(getComputedStyle(steps).maskImage).toMatch(
      /(rgb\(0, 0, 0\)|#000)[^)]*\)$/,
    )
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        '[data-testid="guide-restart"]',
      )!,
    )
    await settle()
  },
}

/**
 * Узкий экран (360 px): кнопки переносятся, а не вылезают за карточку; шаг — почти на всю
 * ширину окна, соседи — в затемнении по краям.
 */
export const GuidePanelNarrow: StoryObj<SandboxArgs> = {
  name: 'Narrow',
  parameters: { requirements: ['SN19'] },
  args: {
    title:
      'Очень длинное название сценария, которое не помещается в строку панели',
    stepCount: 8,
    stepTitle: 'long',
    stepHint: 'short',
    containerWidth: 360,
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    const sandbox = canvasElement.querySelector<HTMLElement>(
      '[data-testid="sandbox"]',
    )!
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide"]',
    )!
    const steps = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide-steps"]',
    )!
    // Ничего не вылезает за карточку: ни кнопки, ни шаги.
    const box = card.getBoundingClientRect()
    // Кнопки управления; шаги ленты уходят за окно прокрутки законно.
    for (const button of card.querySelectorAll(
      'button:not([data-step-button])',
    )) {
      const { left, right } = button.getBoundingClientRect()
      await expect(left).toBeGreaterThanOrEqual(box.left)
      await expect(right).toBeLessThanOrEqual(box.right)
    }
    await expect(sandbox.scrollWidth).toBeLessThanOrEqual(sandbox.clientWidth)
    await nextStep(canvasElement)
    await nextStep(canvasElement)
    await settle()
    // Активный шаг виден целиком, по центру окна шагов.
    const view = steps.getBoundingClientRect()
    const active = steps
      .querySelector('[aria-current="step"]')!
      .getBoundingClientRect()
    await expect(active.left).toBeGreaterThanOrEqual(view.left)
    await expect(active.right).toBeLessThanOrEqual(view.right)
    await expect(
      Math.abs(active.left + active.width / 2 - (view.left + view.width / 2)),
    ).toBeLessThan(1)
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        '[data-testid="guide-restart"]',
      )!,
    )
    await settle()
  },
}

/** Контейнер уже минимума (240 px): карточка держит свою ширину и не сжимается. */
export const GuidePanelMinWidth: StoryObj<SandboxArgs> = {
  name: 'Below minimum width',
  parameters: { requirements: ['SN20'] },
  args: { stepCount: 6, stepTitle: 'long', containerWidth: 240 },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    const card = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide"]',
    )!
    await expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      MIN_PANEL_WIDTH,
    )
  },
}

/** Сценарий пройден целиком: переход на последний шаг выполняет его, затем «Пройдено», все шаги зелёные. */
export const GuidePanelCompleted: StoryObj<SandboxArgs> = {
  name: 'Completed',
  parameters: { requirements: ['SN16'] },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    const next = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="guide-next"]',
    )!
    const toggle = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide-toggle"]',
    )!
    await nextStep(canvasElement)
    await expect(next).toHaveTextContent('Далее')
    // «Далее» на предпоследнем шаге: последний шаг выполняется сразу при переходе.
    await nextStep(canvasElement)
    await waitFor(() => expect(toggle).toHaveTextContent('пройден'))
    await expect(next).toHaveTextContent('Пройдено')
    await expect(next).toBeDisabled()
    await expect(canvasElement).not.toHaveTextContent('Закончить')
    const states = () =>
      [...canvasElement.querySelectorAll<HTMLElement>('[data-step-state]')].map(
        badge => badge.dataset.stepState,
      )
    await expect(states()).toEqual(['done', 'done', 'done'])
    // «Назад» из пройденного — к предпоследнему шагу: последний выполнился бы снова.
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>('[data-testid="guide-back"]')!,
    )
    await waitFor(() => expect(toggle).toHaveTextContent('шаг 2 из 3'))
    await waitFor(() => expect(next).toBeEnabled())
    await expect(next).toHaveTextContent('Далее')
    await expect(states()).toEqual(['done', 'current', 'next'])
    await nextStep(canvasElement)
    await waitFor(() => expect(toggle).toHaveTextContent('пройден'))
    await settle()
  },
}

/** Свёрнутая панель — как в историях сценариев по умолчанию. */
export const GuidePanelCollapsed: StoryObj<SandboxArgs> = {
  name: 'Collapsed',
  args: { expanded: false },
}
