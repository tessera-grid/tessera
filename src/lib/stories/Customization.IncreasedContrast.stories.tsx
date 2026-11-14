import { Meta, StoryObj } from '@storybook/react'
import type { TesseraFeatureEntry } from '../core/features'
import type { StoryProps } from './DataGridStory.types'
import { dataGridMeta } from './dataGridMeta'
import { expect } from 'storybook/test'
import { openMenu } from './__mocks__/cellGestures'
import {
  applyPseudoStates,
  guideNext,
  pollUntil,
  settle,
  stepDone,
  until,
  waitForPopup,
} from './__mocks__/catalogPlay'
import { guideControls, showControls } from './__mocks__/utils/dataGridControls'
import {
  GuideStory,
  type GuideStoryStep,
  guideArgs,
  stepAction,
} from './demos/GuideStory'

const gridTheme = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>('[data-tsr-grid]')!

/** Две выбранные строки — один раз, как только появились строки. */
const selectionDemo: TesseraFeatureEntry = {
  id: 'increasedContrastDemo',
  setup: table => {
    const t = table as {
      getCoreRowModel: () => { rows: unknown[] }
      setRowSelection?: (value: Record<string, boolean>) => void
    }
    let frame = 0
    const apply = () => {
      if (t.getCoreRowModel().rows.length === 0) {
        frame = requestAnimationFrame(apply)
        return
      }
      t.setRowSelection?.({ 'item-id-1': true, 'item-id-2': true })
    }
    apply()
    return () => cancelAnimationFrame(frame)
  },
}

/**
 * Повышенный контраст (ADR 0088): вид в режиме и по истории на клиентский сценарий S1–S2.
 * Переключите `contrast` в `Playground`: `auto` следует системе (DevTools Rendering →
 * «prefers-contrast: more»), `standard` — обычный вид.
 */
const meta = {
  ...dataGridMeta,
  parameters: { ...dataGridMeta.parameters },
  title: 'Tessera/Customization/Increased contrast',
} satisfies Meta<StoryProps>

export default meta

const args: Partial<StoryProps> = {
  contrast: 'more',
  dataNesting: 'nested',
  enableRowExpanding: true,
  enableTreeLines: true,
  initialExpanded: true,
  enableRowSelection: true,
  enableColumnPinning: true,
  enableColumnSorting: true,
  enableKeyboardNavigation: true,
  enableHeaderActionMenu: true,
  enableColumnVisibility: true,
  extraPlugins: [selectionDemo],
  columnCount: 8,
  dataCount: 40,
  containerHeight: '560',
  height: '460',
  maxHeight: '460',
}

export const IncreasedContrastPlayground: StoryObj<StoryProps> = {
  name: 'Playground',
  args,
  // Дымовой тест (ADR 0088, MC11): режим включён, выбор — контуром, дерево на месте.
  parameters: {
    requirements: ['MC11'],
    ...showControls([
      'dataNesting',
      'contrast',
      'enableColumnSorting',
      'columnSortingRemoval',
      'columnSortingMultiSort',
      'dataMode',
      'columnSortingRevertOnReject',
      'enableColumnPinning',
      'columnPinningLeafPinning',
      'enableColumnVisibility',
      'enableHeaderActionMenu',
      'headerActionMenuMode',
      'headerActionMenuThreshold',
      'enableRowSelection',
      'rowSelectionSubRows',
      'rowSelectionSelectedCount',
      'enableRowExpanding',
      'rowExpandingMaxDepth',
      'rowExpandingColumn',
      'enableTreeLines',
      'enableKeyboardNavigation',
    ]),
  },
  play: async ({ canvasElement, globals }) => {
    if (globals.catalog !== true) return
    const selected = () =>
      canvasElement.querySelector<HTMLElement>(
        '.data-grid__body-row[data-selected="true"]',
      )
    await until(() => expect(selected()).not.toBeNull())
    expect(gridTheme(canvasElement)).toHaveAttribute(
      'data-tsr-contrast',
      'more',
    )
    expect(getComputedStyle(selected()!).outlineStyle).toBe('solid')
    expect(canvasElement.querySelector('[data-tree-depth]')).not.toBeNull()
    await settle()
  },
}

const selectedRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.data-grid__body-row[data-selected="true"]')

const HOVERED_ROW = '.data-grid__body-row[data-row-id="item-id-3"]'

/** Цвет линии дерева (ADR 0102: линии — рамки элементов в ячейке отступа). */
const treeLineColor = (root: HTMLElement) =>
  getComputedStyle(
    root.querySelector<HTMLElement>('[data-tree-depth] [aria-hidden] > span')!,
  ).borderLeftColor

/** Первый непрозрачный фон от узла вверх. */
const backgroundOf = (el: HTMLElement | null): string => {
  for (; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
  }
  return 'white'
}

const luminance = ([r, g, b]: Uint8ClampedArray) => {
  const linear = (c: number) =>
    c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
  return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!)
}

/** Контраст цвета (любой записи, с прозрачностью) к фону грида. */
const contrastToBg = (root: HTMLElement, color: string) => {
  const ctx = document.createElement('canvas').getContext('2d')!
  const pixel = (...colors: string[]) => {
    for (const fill of colors) {
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, 1, 1)
    }
    return ctx.getImageData(0, 0, 1, 1).data
  }
  const bg = backgroundOf(gridTheme(root))
  const [a, b] = [luminance(pixel(bg, color)), luminance(pixel(bg))]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Заливка состояния строки — слой `--tsr-row-state` (ADR 0126). */
const rowStateColor = (row: HTMLElement) =>
  getComputedStyle(row).getPropertyValue('--tsr-row-state')

/** Рамка палитры приложения в рецепте S2. */
const RECIPE_BORDER = 'rgb(29, 78, 216)'

// --- S1 ------------------------------------------------------------------------------

/** Указатель зашёл на узел и движется по нему — как мышь пользователя. */
const hover = (target: HTMLElement) => {
  const box = target.getBoundingClientRect()
  const at = {
    bubbles: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  }
  for (const type of ['pointerover', 'pointermove'])
    target.dispatchEvent(
      new PointerEvent(type, { ...at, pointerType: 'mouse' }),
    )
  for (const type of ['mouseover', 'mousemove'])
    target.dispatchEvent(new MouseEvent(type, at))
}

const ENABLE: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Обычный контраст', en: 'Normal contrast' },
    hint: {
      ru: 'Приложение не задаёт контраст, система его не просит: выбранные строки и линии дерева — бледные тона.',
      en: "The app doesn't set contrast, and the system doesn't ask for it: selected rows and tree lines use pale tones.",
    },
    props: () => ({ contrast: 'auto' }),
  },
  {
    title: { ru: 'Повышенный контраст', en: 'Increased contrast' },
    hint: {
      ru: 'Приложение включает contrast="more": выбранные строки обведены контуром, линии дерева темнее.',
      en: 'The app turns on contrast="more": selected rows get an outline, and tree lines are darker.',
    },
    props: () => ({ contrast: 'more' }),
  },
  {
    title: { ru: 'Наведение на строку', en: 'Hovering over a row' },
    hint: {
      ru: 'Наведите указатель на строку — её обводит контур, а не только бледная заливка.',
      en: 'Hover over a row: it gets an outline, not just a pale fill.',
    },
    pseudo: { hover: HOVERED_ROW },
  },
  {
    title: { ru: 'Меню колонки', en: 'The column menu' },
    hint: {
      ru: 'У меню рамка поверх тени; пункт под указателем обведён контуром.',
      en: 'The menu has a border over its shadow; the item under the pointer is outlined.',
    },
    enter: stepAction(async (root, { signal }) => {
      const kebab = () =>
        root.querySelector<HTMLElement>(
          '.data-grid__head-cell [data-action-menu]',
        )
      await pollUntil(() => !!kebab(), signal)
      if (!document.querySelector('[role="menu"]')) kebab()!.click()
      await pollUntil(() => !!openMenu(), signal)
      const item = openMenu()!.querySelector<HTMLElement>('[role="menuitem"]')!
      hover(item)
      await pollUntil(() => item.hasAttribute('data-highlighted'), signal)
    }),
  },
]

/** S1: приложение включает повышенный контраст — тона и контуры по шагам. */
export const IncreasedContrastEnable: StoryObj<StoryProps> = {
  name: 'Enable increased contrast',
  parameters: {
    scenario: '0088/S1',
    ...guideControls(),
  },
  render: storyArgs => (
    <GuideStory
      title={{ ru: 'Повышенный контраст', en: 'Increased contrast' }}
      steps={ENABLE}
      args={guideArgs(args, storyArgs)}
    />
  ),
  play: async ({ canvasElement: canvas, globals, id, step }) => {
    if (globals.catalog !== true) return
    let line = 0
    await step(ENABLE[0].title.ru, async () => {
      await until(() => expect(selectedRow(canvas)).not.toBeNull())
      await settle()
      await until(() =>
        expect(gridTheme(canvas)).not.toHaveAttribute('data-tsr-contrast'),
      )
      await until(() =>
        expect(getComputedStyle(selectedRow(canvas)!).outlineStyle).toBe(
          'none',
        ),
      )
      line = contrastToBg(canvas, treeLineColor(canvas))
    })
    await step(ENABLE[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(gridTheme(canvas)).toHaveAttribute('data-tsr-contrast', 'more'),
      )
      await until(() => expect(selectedRow(canvas)).not.toBeNull())
      await settle()
      const row = getComputedStyle(selectedRow(canvas)!)
      await until(() => expect(row.outlineStyle).toBe('solid'))
      await until(() => expect(row.outlineWidth).toBe('1px'))
      await until(() =>
        expect(contrastToBg(canvas, treeLineColor(canvas))).toBeGreaterThan(
          line,
        ),
      )
    })
    await step(ENABLE[2].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(canvas.querySelector(HOVERED_ROW)).not.toBeNull(),
      )
      const row = canvas.querySelector<HTMLElement>(HOVERED_ROW)!
      await until(() => expect(getComputedStyle(row).outlineStyle).toBe('none'))
      // Наведение — псевдо-состояние; классы снимаются: матрица контраста ставит свои.
      await applyPseudoStates(id, ENABLE[2].pseudo!)
      await until(() =>
        expect(getComputedStyle(row).outlineStyle).toBe('solid'),
      )
      await until(() =>
        expect(contrastToBg(canvas, rowStateColor(row))).toBeGreaterThan(1),
      )
      row.classList.remove('pseudo-hover')
      await settle()
    })
    await step(ENABLE[3].title.ru, async () => {
      await guideNext(canvas)
      await stepDone(canvas)
      const menu = await waitForPopup('menu')
      await until(() =>
        expect(getComputedStyle(menu).outlineStyle).toBe('solid'),
      )
      await until(() =>
        expect(
          getComputedStyle(
            menu.querySelector<HTMLElement>(
              '[role="menuitem"][data-highlighted]',
            )!,
          ).outlineStyle,
        ).toBe('solid'),
      )
      await settle()
    })
  },
}

// --- S2 ------------------------------------------------------------------------------

/**
 * Правило приложения: свои рычаги и своя рамка палитры поверх надстройки — перебивает
 * её без `!important`.
 */
const RECIPE = `
.contrast-recipe .data-grid-theme[data-tsr-contrast='more'] {
  --tsr-sys-tint-hover: 10%;
  --tsr-sys-tint-selected: 14%;
  --border: #1d4ed8;
}
`

/** Правило приложения на время шага: уход с шага его снимает. */
const recipe = (root: HTMLElement) => {
  root.classList.add('contrast-recipe')
  return () => root.classList.remove('contrast-recipe')
}

const RECIPE_STEPS: readonly GuideStoryStep[] = [
  {
    title: { ru: 'Надстройка из коробки', en: 'The built-in setup' },
    hint: {
      ru: 'Повышенный контраст включён: рамка грида — цвет палитры приложения, тона наведения и выбора — из надстройки.',
      en: "Increased contrast is on: the grid border uses the app's palette color, and the hover and selection tones come from the built-in setup.",
    },
  },
  {
    title: { ru: 'Правило приложения', en: 'An app rule' },
    hint: {
      ru: 'Приложение задаёт свою рамку палитры и свои доли тона наведения и выбора: рамка грида синяя, заливка выбранных строк плотнее. Правило перебивает надстройку без !important.',
      en: 'The app sets its own palette border and its own mix ratios for the hover and selection tones: the grid border is blue, and selected rows have a denser fill. The rule overrides the built-in setup without !important.',
    },
    enter: recipe,
  },
]

/** S2: приложение задаёт свои рычаги и рамку палитры поверх надстройки. */
export const IncreasedContrastRecipe: StoryObj<StoryProps> = {
  name: 'Own levers and palette',
  parameters: {
    scenario: '0088/S2',
    ...guideControls(),
  },
  render: storyArgs => (
    <>
      <style>{RECIPE}</style>
      <GuideStory
        title={{ ru: 'Свои рычаги и палитра', en: 'Custom levers and palette' }}
        steps={RECIPE_STEPS}
        args={guideArgs(args, storyArgs)}
      />
    </>
  ),
  play: async ({ canvasElement: canvas, globals, step }) => {
    if (globals.catalog !== true) return
    let fill = 0
    await step(RECIPE_STEPS[0].title.ru, async () => {
      await until(() => expect(selectedRow(canvas)).not.toBeNull())
      await settle()
      expect(getComputedStyle(gridTheme(canvas)).borderTopColor).not.toBe(
        RECIPE_BORDER,
      )
      fill = contrastToBg(canvas, rowStateColor(selectedRow(canvas)!))
    })
    await step(RECIPE_STEPS[1].title.ru, async () => {
      await guideNext(canvas)
      await until(() =>
        expect(getComputedStyle(gridTheme(canvas)).borderTopColor).toBe(
          RECIPE_BORDER,
        ),
      )
      await settle()
      expect(
        contrastToBg(canvas, rowStateColor(selectedRow(canvas)!)),
      ).toBeGreaterThan(fill)
    })
  },
}
