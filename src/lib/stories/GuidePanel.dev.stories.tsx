import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor } from 'storybook/test'

import { settle } from './__mocks__/catalogPlay'
import type { StoryText } from './__mocks__/storyText'
import { shellText, type StoryShellKey } from './demos/storyShell'

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
  title: 'short' | 'long'
  stepCount: number
  stepTitle: 'short' | 'long'
  stepHint: 'none' | 'short' | 'long'
  expanded: boolean
  /** Ширина области панели, px; 0 — во всю ширину холста. */
  containerWidth: number
}

/** Действие шага: короткое и длинное название, короткое и длинное пояснение. */
interface Action {
  title: [short: StoryText, long: StoryText]
  hint: [short: StoryText, long: StoryText]
}

/** Название сценария: короткое и не помещающееся в строку панели. */
const TITLES: Record<SandboxArgs['title'], StoryText> = {
  short: { ru: 'Работа с заказами', en: 'Working with orders' },
  long: {
    ru: 'Очень длинное название сценария, которое не помещается в строку панели',
    en: 'A very long scenario title that does not fit on one line of the panel',
  },
}

const NO_HINT: StoryText = { ru: '', en: '' }

/** Шаги песочницы — правдоподобный путь пользователя по таблице заказов. */
const ACTIONS: readonly Action[] = [
  {
    title: [
      { ru: 'Открыть заказы', en: 'Open orders' },
      {
        ru: 'Открыть раздел заказов в личном кабинете',
        en: 'Open the orders section of the account',
      },
    ],
    hint: [
      { ru: 'Таблица показывает скелет.', en: 'The table shows a skeleton.' },
      {
        ru: 'Пока сервер готовит первую страницу, таблица рисует скелет по своей раскладке: колонки, ширины и служебные колонки уже на местах.',
        en: 'While the server prepares the first page, the table draws a skeleton of its layout: columns, widths, and service columns are already in place.',
      },
    ],
  },
  {
    title: [
      { ru: 'Данные пришли', en: 'Data arrived' },
      {
        ru: 'Сервер вернул первую страницу заказов',
        en: 'The server returned the first page of orders',
      },
    ],
    hint: [
      {
        ru: 'Строки встают на место скелета.',
        en: 'Rows take the place of the skeleton.',
      },
      {
        ru: 'Строки встают ровно на место скелета: заголовки не сдвигаются, полоса прокрутки появляется, только если строк больше, чем помещается.',
        en: 'Rows land exactly where the skeleton was: the headers do not shift, and a scrollbar appears only if there are more rows than fit.',
      },
    ],
  },
  {
    title: [
      { ru: 'Сортировка по дате', en: 'Sort by date' },
      {
        ru: 'Отсортировать заказы по дате оформления',
        en: 'Sort orders by the date they were placed',
      },
    ],
    hint: [
      { ru: 'Новые заказы — сверху.', en: 'Newest orders on top.' },
      {
        ru: 'Нажатие на заголовок «Дата» сортирует по убыванию: самые свежие заказы поднимаются наверх, стрелка в заголовке показывает направление.',
        en: 'Clicking the “Date” header sorts in descending order: the most recent orders move to the top, and an arrow in the header shows the direction.',
      },
    ],
  },
  {
    title: [
      { ru: 'Фильтр по статусу', en: 'Filter by status' },
      {
        ru: 'Оставить только заказы в статусе «Ожидает оплаты»',
        en: 'Keep only orders awaiting payment',
      },
    ],
    hint: [
      { ru: 'Видны только неоплаченные.', en: 'Only unpaid orders are shown.' },
      {
        ru: 'В панели фильтра колонки «Статус» отмечен один вариант; над таблицей появляется сводка условия, счётчик показывает «12 из 240».',
        en: 'One option is checked in the “Status” column filter panel; a summary of the condition appears above the table, and the counter shows “12 of 240”.',
      },
    ],
  },
  {
    title: [
      { ru: 'Поиск клиента', en: 'Find a customer' },
      {
        ru: 'Найти заказы клиента по фамилии в быстром поиске',
        en: 'Find the orders of a customer by last name with quick search',
      },
    ],
    hint: [
      { ru: 'Совпадения подсвечены.', en: 'Matches are highlighted.' },
      {
        ru: 'Быстрый поиск ищет по видимым колонкам с задержкой ввода; совпадения в ячейках подсвечены, остальные строки скрыты.',
        en: 'Quick search looks through the visible columns after a typing delay; matches in cells are highlighted, and the other rows are hidden.',
      },
    ],
  },
  {
    title: [
      { ru: 'Раскрыть заказ', en: 'Expand an order' },
      {
        ru: 'Раскрыть заказ, чтобы увидеть его позиции',
        en: 'Expand an order to see its line items',
      },
    ],
    hint: [
      { ru: 'Позиции подгружаются.', en: 'Line items are loading.' },
      {
        ru: 'Позиции заказа приходят с сервера при раскрытии: шеврон показывает ожидание, затем вложенные строки появляются с отступом и линиями дерева.',
        en: 'The line items come from the server on expand: the chevron shows the wait, then the nested rows appear indented, with tree lines.',
      },
    ],
  },
  {
    title: [
      { ru: 'Выбрать строки', en: 'Select rows' },
      { ru: 'Отметить несколько заказов флажками', en: 'Check several orders' },
    ],
    hint: [
      { ru: 'Счётчик выбранных растёт.', en: 'The selected count grows.' },
      {
        ru: 'Флажки в служебной колонке отмечают строки; нижняя панель показывает число выбранных, а «выбрать всё» учитывает фильтр.',
        en: 'Checkboxes in the service column mark rows; the status bar shows how many are selected, and “select all” respects the filter.',
      },
    ],
  },
  {
    title: [
      { ru: 'Изменить сумму', en: 'Change the amount' },
      {
        ru: 'Исправить сумму заказа прямо в ячейке',
        en: 'Fix the order amount right in the cell',
      },
    ],
    hint: [
      { ru: 'Ячейка ждёт сервер.', en: 'The cell waits for the server.' },
      {
        ru: 'После ввода значение уходит на сервер: ячейка светится ожиданием, остальные ячейки можно править, не дожидаясь ответа.',
        en: 'After input, the value goes to the server: the cell shows that it is waiting, and other cells can be edited without waiting for the response.',
      },
    ],
  },
  {
    title: [
      { ru: 'Сервер отказал', en: 'The server refused' },
      {
        ru: 'Сервер отклонил новую сумму заказа',
        en: 'The server rejected the new order amount',
      },
    ],
    hint: [
      { ru: 'Ячейка в ошибке.', en: 'The cell shows an error.' },
      {
        ru: 'Ячейка возвращает прежнее значение, вспыхивает красным и показывает причину отказа; повторная правка открывает черновик с текстом ошибки.',
        en: 'The cell returns to its previous value, flashes red, and shows the reason for the refusal; editing it again opens a draft with the error text.',
      },
    ],
  },
  {
    title: [
      { ru: 'Закрепить колонку', en: 'Pin a column' },
      {
        ru: 'Закрепить колонку «Клиент» слева',
        en: 'Pin the Customer column to the left',
      },
    ],
    hint: [
      { ru: 'Колонка не уезжает.', en: 'The column stays put.' },
      {
        ru: 'При горизонтальной прокрутке закреплённая колонка остаётся на месте, а остальные проходят под ней с тенью на границе.',
        en: 'During horizontal scrolling, the pinned column stays in place, and the others slide under it with a shadow at the edge.',
      },
    ],
  },
  {
    title: [
      { ru: 'Переставить колонки', en: 'Reorder columns' },
      {
        ru: 'Перетащить колонку «Сумма» ближе к началу',
        en: 'Drag the Amount column closer to the start',
      },
    ],
    hint: [
      { ru: 'Колонки съезжают.', en: 'Columns shift aside.' },
      {
        ru: 'Во время перетаскивания соседние колонки плавно расступаются; после броска заголовки, строки и итоги встают в новом порядке.',
        en: 'While dragging, neighboring columns smoothly make room; after the drop, headers, rows, and totals settle in the new order.',
      },
    ],
  },
  {
    title: [
      { ru: 'Скрыть колонку', en: 'Hide a column' },
      {
        ru: 'Скрыть служебную колонку «Комментарий»',
        en: 'Hide the Comment service column',
      },
    ],
    hint: [
      { ru: 'Меню «Колонки».', en: 'The “Columns” menu.' },
      {
        ru: 'В меню «Колонки» снят флажок; кнопка тулбара показывает точку активного действия, пока скрыта хотя бы одна колонка.',
        en: 'A checkbox is cleared in the “Columns” menu; the toolbar button shows an active dot while at least one column is hidden.',
      },
    ],
  },
  {
    title: [
      { ru: 'Сменить страницу', en: 'Change the page' },
      {
        ru: 'Перейти на третью страницу результатов',
        en: 'Go to the third page of results',
      },
    ],
    hint: [
      { ru: 'Новая страница.', en: 'A new page.' },
      {
        ru: 'Пагинатор переключает страницу; прокрутка возвращается к началу, выбор строк сохраняется между страницами.',
        en: 'The pager switches the page; scrolling returns to the top, and row selection is kept across pages.',
      },
    ],
  },
  {
    title: [
      { ru: 'Группировка', en: 'Grouping' },
      {
        ru: 'Сгруппировать заказы по менеджеру',
        en: 'Group orders by manager',
      },
    ],
    hint: [
      { ru: 'Группы со счётчиками.', en: 'Groups with counters.' },
      {
        ru: 'Строки собираются в группы по менеджеру; у каждой группы свой счётчик строк и сумма в футере.',
        en: 'Rows are gathered into groups by manager; each group has its own row count and a total in the footer.',
      },
    ],
  },
  {
    title: [
      { ru: 'Переставить строку', en: 'Move a row' },
      {
        ru: 'Перетащить заказ в другую группу',
        en: 'Drag an order into another group',
      },
    ],
    hint: [
      { ru: 'Превью броска.', en: 'Drop preview.' },
      {
        ru: 'Пока строка в воздухе, на месте броска виден слот с отступом уровня; пауза над свёрнутой группой раскрывает её.',
        en: 'While the row is in the air, a slot with the level indent shows where it will land; pausing over a collapsed group expands it.',
      },
    ],
  },
  {
    title: [
      { ru: 'Быстрая прокрутка', en: 'Fast scrolling' },
      {
        ru: 'Прокрутить список к концу колесом мыши',
        en: 'Scroll the list to the end with the mouse wheel',
      },
    ],
    hint: [
      { ru: 'Ячейки — скелеты.', en: 'Cells become skeletons.' },
      {
        ru: 'На большой скорости ячейки рисуются скелетами, чтобы кадр не проседал; при остановке на их место встаёт содержимое.',
        en: 'At high speed, cells are drawn as skeletons so frames do not drop; when scrolling stops, the content takes their place.',
      },
    ],
  },
  {
    title: [
      { ru: 'Наверх', en: 'Back to top' },
      {
        ru: 'Вернуться к началу списка кнопкой «Наверх»',
        en: 'Return to the start of the list with the back-to-top button',
      },
    ],
    hint: [
      { ru: 'Плавная прокрутка.', en: 'Smooth scrolling.' },
      {
        ru: 'Кнопка в нижней панели прокручивает к первой строке: издалека — прыжком, последний экран — плавно; фокус остаётся на кнопке.',
        en: 'The button in the status bar scrolls to the first row: it jumps most of the way and scrolls the last screen smoothly; focus stays on the button.',
      },
    ],
  },
  {
    title: [
      { ru: 'Обновить данные', en: 'Refresh data' },
      {
        ru: 'Обновить список, не сбрасывая фильтры',
        en: 'Refresh the list without resetting filters',
      },
    ],
    hint: [
      { ru: 'Свечение под заголовками.', en: 'A glow under the headers.' },
      {
        ru: 'Пока идёт обновление, под заголовками течёт свечение, строки приглушены и не прыгают; фильтры и выбор сохраняются.',
        en: 'While the refresh runs, a glow flows under the headers, rows are dimmed and do not jump; filters and selection are kept.',
      },
    ],
  },
  {
    title: [
      { ru: 'Выгрузить в Excel', en: 'Export to Excel' },
      {
        ru: 'Выгрузить отфильтрованные заказы в Excel',
        en: 'Export the filtered orders to Excel',
      },
    ],
    hint: [
      { ru: 'Файл скачивается.', en: 'The file downloads.' },
      {
        ru: 'Панель выгрузки предлагает строки и колонки: «как на экране», «выбранные», «все»; файл открывается в Excel с типами и закреплённой строкой заголовков.',
        en: 'The export panel offers rows and columns: “as on screen”, “selected”, or “all”; the file opens in Excel with types and a frozen header row.',
      },
    ],
  },
  {
    title: [
      { ru: 'Готово', en: 'Done' },
      { ru: 'Закрыть раздел заказов', en: 'Close the orders section' },
    ],
    hint: [
      { ru: 'Сценарий пройден.', en: 'The scenario is complete.' },
      {
        ru: 'Все действия пройдены: таблица вернулась в исходное состояние, фильтры и сортировка сохранены до следующего открытия.',
        en: 'All actions are done: the table is back in its initial state, and filters and sorting are kept until the section is opened again.',
      },
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
      hint:
        stepHint === 'none'
          ? NO_HINT
          : action.hint[stepHint === 'long' ? 1 : 0],
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
        title={TITLES[args.title]}
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
  title: 'Tessera/Common/Guide panel',
  render: args => <Sandbox {...args} />,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'short',
    stepCount: 3,
    stepTitle: 'short',
    stepHint: 'short',
    expanded: true,
    containerWidth: 0,
  },
  argTypes: {
    title: { control: 'inline-radio', options: ['short', 'long'] },
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
    title: 'long',
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
    title: 'long',
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
    const text = (key: StoryShellKey, params?: Record<string, unknown>) =>
      shellText(globals.locale, key, params)
    const next = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="guide-next"]',
    )!
    const toggle = canvasElement.querySelector<HTMLElement>(
      '[data-testid="guide-toggle"]',
    )!
    await nextStep(canvasElement)
    await expect(next).toHaveTextContent(text('guideNext'))
    // «Далее» на предпоследнем шаге: последний шаг выполняется сразу при переходе.
    await nextStep(canvasElement)
    await waitFor(() => expect(toggle).toHaveTextContent(text('guideFinished')))
    await expect(next).toHaveTextContent(text('guideDone'))
    await expect(next).toBeDisabled()
    await expect(canvasElement).not.toHaveTextContent(text('guideFinish'))
    const states = () =>
      [...canvasElement.querySelectorAll<HTMLElement>('[data-step-state]')].map(
        badge => badge.dataset.stepState,
      )
    await expect(states()).toEqual(['done', 'done', 'done'])
    // «Назад» из пройденного — к предпоследнему шагу: последний выполнился бы снова.
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>('[data-testid="guide-back"]')!,
    )
    await waitFor(() =>
      expect(toggle).toHaveTextContent(
        text('guideStepOf', { step: 2, count: 3 }),
      ),
    )
    await waitFor(() => expect(next).toBeEnabled())
    await expect(next).toHaveTextContent(text('guideNext'))
    await expect(states()).toEqual(['done', 'current', 'next'])
    await nextStep(canvasElement)
    await waitFor(() => expect(toggle).toHaveTextContent(text('guideFinished')))
    await settle()
  },
}

/** Свёрнутая панель — как в историях сценариев по умолчанию. */
export const GuidePanelCollapsed: StoryObj<SandboxArgs> = {
  name: 'Collapsed',
  args: { expanded: false },
}
