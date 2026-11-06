import { composeStories } from '@storybook/react-vite'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { Bubble } from '../../../ui/Bubble'
import { PopupItem, PopupItemMark } from '../../../ui/Popup/PopupItem'
import { SelectTrigger } from '../../../ui/SelectTrigger/SelectTrigger'
import * as assembled from '../../UI.PopupAssembled.stories'
import * as calendarStories from '../../UI.Calendar.stories'
import * as checkbox from '../../UI.Checkbox.stories'
import * as checklist from '../../UI.Checklist.stories'
import * as dragCloud from '../../UI.DragCloud.stories'
import * as field from '../../UI.Field.stories'
import * as popupGroup from '../../UI.PopupGroup.stories'
import * as popupItem from '../../UI.PopupItem.stories'
import * as popupPanel from '../../UI.PopupPanel.stories'
import * as radio from '../../UI.Radio.stories'
import * as searchField from '../../UI.SearchField.stories'
import * as selectTrigger from '../../UI.SelectTrigger.stories'
import * as statusIcon from '../../UI.StatusIcon.stories'
import * as timeField from '../../UI.TimeField.stories'
import { failureShownOn } from '../helpers'
import { resolveColor, toRgba } from './a11y-helpers'

// Кит поповеров и контролов (ADR 0183, PK2–PK6, PK12–PK21, PK27–PK30) и раскладка панели (ADR 0017,
// PP11–PP13). Истории — те же, что снимает каталог; потребители проверяются по исходникам.

const Assembled = composeStories(assembled)
const Calendar = composeStories(calendarStories)
const Checkbox = composeStories(checkbox)
const Checklist = composeStories(checklist)
const Cloud = composeStories(dragCloud)
const Field = composeStories(field)
const Group = composeStories(popupGroup)
const Item = composeStories(popupItem)
const Panel = composeStories(popupPanel)
const Radio = composeStories(radio)
const Search = composeStories(searchField)
const Select = composeStories(selectTrigger)
const Status = composeStories(statusIcon)
const Time = composeStories(timeField)

const SOURCES = import.meta.glob('../../../{grid,plugins,ui}/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const sourceOf = (name: string) => {
  const keys = Object.keys(SOURCES).filter(path =>
    path.endsWith(`/${name}.tsx`),
  )
  if (keys.length !== 1) throw new Error(`${name}: ${keys.length}`)
  return SOURCES[keys[0]!]!
}

const px = (root: Element, token: string) => {
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.width = `var(${token})`
  root.append(probe)
  const value = parseFloat(getComputedStyle(probe).width)
  probe.remove()
  return value
}

const box = (el: Element) => el.getBoundingClientRect()
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const padding = (el: Element) => px(el, '--tsr-comp-popup-padding')

/** Левый и правый край текста: рамка узла без своих полей. */
const textBox = (el: Element) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect()
}

const settle = () => {
  for (const animation of document.getAnimations()) {
    const end = animation.effect?.getComputedTiming().endTime
    if (end !== Infinity) animation.finish()
  }
}

const opened = async (popup: string) => {
  const screen = await render(<Assembled.AssembledPlayground popup={popup} />)
  return screen
}

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('Раскладка поповера-панели (ADR 0017)', () => {
  test('PP11: заголовок — кеглем popup-title-font-size, полужирный, на двойном поле от верхнего и боковых краёв и до содержимого', async () => {
    await render(<Panel.PopupPanelPlayground />)
    await expect.poll(dialog).not.toBeNull()
    settle()
    const popup = dialog()
    const title = popup.querySelector('p')!
    const double = padding(popup) * 2
    const style = getComputedStyle(title)
    expect(parseFloat(style.fontSize)).toBe(
      px(popup, '--tsr-comp-popup-title-font-size'),
    )
    expect(Number(style.fontWeight)).toBeGreaterThanOrEqual(600)
    expect(textBox(title).left - box(popup).left).toBeCloseTo(double, 0)
    expect(
      box(title).top + parseFloat(style.paddingTop) - box(popup).top,
    ).toBeCloseTo(double, 0)
    const next = title.nextElementSibling!
    expect(
      box(next).top - (box(title).bottom - parseFloat(style.paddingBottom)),
    ).toBeCloseTo(double, 0)
  })

  test('PP12: кнопки внизу — у правого края, без разделителя, на двойном поле от краёв и от содержимого', async () => {
    await render(<Panel.PopupPanelPlayground />)
    await expect.poll(dialog).not.toBeNull()
    settle()
    const popup = dialog()
    const footer = popup.querySelector('[data-popup-footer]')!
    const double = padding(popup) * 2
    const last = [...footer.querySelectorAll('button')].at(-1)!
    expect(box(popup).right - box(last).right).toBeCloseTo(double, 0)
    expect(box(popup).bottom - box(last).bottom).toBeCloseTo(double, 0)
    const content = footer.previousElementSibling!
    expect(box(last).top - box(content).bottom).toBeCloseTo(double, 0)
    expect(getComputedStyle(footer).borderTopWidth).toBe('0px')
    expect(getComputedStyle(content).borderBottomWidth).toBe('0px')
  })

  test('PP13: поля и текст — на двойном поле от боковых краёв, пункты — на поле поповера, подпись в ряду кнопок — по краю содержимого', async () => {
    await opened('columns')
    const count = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-count"]',
      )
    await expect.poll(count).not.toBeNull()
    settle()
    const surface = count()!.closest<HTMLElement>('[role="dialog"]')!
    const p = padding(surface)
    const search = surface.querySelector('input')!
    const field = search.parentElement!
    expect(box(field).left - box(surface).left).toBeCloseTo(p * 2, 0)
    const mark = surface.querySelector('[role="checkbox"]')!
    const item = mark.closest('label')!
    expect(box(item).left - box(surface).left).toBeCloseTo(p, 0)
    expect(textBox(count()!).left).toBeCloseTo(box(mark).left, 0)
  })
})

describe('Блоки поповера', () => {
  test('PK2: заголовок панели связан с поповером через aria-labelledby; журнал, пульт, отметка, сводка, «Колонки» и панели фильтра собраны на PopupPanel', async () => {
    await render(<Panel.PopupPanelPlayground />)
    await expect.poll(dialog).not.toBeNull()
    const popup = dialog()
    const title = popup.querySelector('p')!
    expect(popup.getAttribute('aria-labelledby')).toBe(title.id)
    for (const name of [
      'FailureLogPopover',
      'UnsavedChangesPopover',
      'CellIssuePopup',
      'FilterSummaryPopover',
      'ColumnVisibilityMenu',
      'FilterPanel',
      'OptionFilterPanel',
      'DateFilterPanel',
    ]) {
      expect(sourceOf(name), name).toContain('<PopupPanel')
    }
    for (const name of ['ExportPanel', 'EditPopover']) {
      expect(sourceOf(name), name).toContain('<PopupFooter')
    }
  })

  test('PK3: пункт — значок, подпись с переносом, отметка и подсказка; покой, подсветка, выключение, ожидание, отказ и блокировка — одним компонентом у меню, контекстного меню, выгрузки и списков', async () => {
    const states = await render(<Item.PopupItemStates />)
    await expect
      .poll(() => document.querySelector('[data-popup-item-label]'))
      .not.toBeNull()
    settle()
    for (const part of ['icon', 'label']) {
      expect(
        document.querySelector(`[data-popup-item-${part}]`),
        part,
      ).not.toBeNull()
    }
    for (const status of ['checked', 'pending', 'failed', 'blocked']) {
      expect(
        document.querySelector(`[data-popup-item-mark="${status}"]`),
        status,
      ).not.toBeNull()
    }
    const disabled = document.querySelector<HTMLElement>('[data-disabled]')!
    expect(getComputedStyle(disabled).pointerEvents).toBe('none')
    const label = disabled.querySelector('[data-popup-item-label]')!
    expect(getComputedStyle(label).overflowWrap).toBe('anywhere')
    for (const name of [
      'MenuItems',
      'ExportPanel',
      'OptionEditors',
      'OperatorSelect',
    ]) {
      expect(sourceOf(name), name).toContain('<PopupItem')
    }
    await states.unmount()
    await render(<Item.PopupItemPlayground hint="Ctrl+K" />)
    await expect
      .poll(() => document.querySelector('[data-popup-item-hint]')?.textContent)
      .toBe('Ctrl+K')
  })

  test('PK4: подпись группы — стилем заголовка поповера, линия между группами, над кнопками панели линии нет', async () => {
    await render(<Group.PopupGroupPlayground />)
    await expect
      .poll(() => document.querySelector('[data-divided]'))
      .not.toBeNull()
    settle()
    const divided = document.querySelector<HTMLElement>('[data-divided]')!
    const groups = [...divided.parentElement!.children]
    expect(groups.length).toBeGreaterThan(1)
    const label = groups[0]!.firstElementChild!
    const style = getComputedStyle(label)
    expect(parseFloat(style.fontSize)).toBe(
      px(divided, '--tsr-comp-popup-title-font-size'),
    )
    expect(Number(style.fontWeight)).toBeGreaterThanOrEqual(600)
    expect(style.textTransform).toBe('none')
    expect(groups[0]!.hasAttribute('data-divided')).toBe(false)
    expect(sourceOf('ExportPanel')).toContain('<PopupGroup')
  })

  test('PK27: выбранный пункт — облачко, как пункт под указателем: выбран, отмечен значением и меткой; прочие без него; отметка правки варианта — справа', async () => {
    const screen = await render(
      <div className={DATA_GRID_THEME_CLASS}>
        <PopupItem data-testid="plain" label="Plain" />
        <PopupItem
          data-testid="highlighted"
          data-highlighted=""
          label="Hover"
        />
        <PopupItem data-testid="selected" data-selected="" label="Selected" />
        <PopupItem data-testid="checked" data-checked="" label="Checked" />
        <PopupItem
          data-testid="marked"
          label="Marked"
          end={<PopupItemMark status="checked" />}
        />
      </div>,
    )
    settle()
    const fill = (id: string) =>
      getComputedStyle(screen.container.querySelector(`[data-testid="${id}"]`)!)
        .backgroundColor
    const hover = fill('highlighted')
    expect(toRgba(fill('plain'))[3]).toBe(0)
    expect(toRgba(hover)[3]).toBeGreaterThan(0)
    for (const id of ['selected', 'checked', 'marked']) {
      expect(fill(id), id).toBe(hover)
    }
    expect(sourceOf('OptionEditors')).toMatch(/end=\{\s*<PopupItemMark/)
    await screen.unmount()
    // Настоящие списки: выбранный пункт залит, отметка — справа от подписи.
    for (const popup of ['pageSize', 'operatorSelect']) {
      const view = await opened(popup)
      const chosen = () =>
        document.querySelector<HTMLElement>('[role="option"][data-selected]')
      await expect.poll(chosen, { message: popup }).not.toBeNull()
      settle()
      expect(
        toRgba(getComputedStyle(chosen()!).backgroundColor)[3],
        popup,
      ).toBeGreaterThan(0)
      const label = chosen()!.querySelector('[data-popup-item-label]')!
      const mark = chosen()!.querySelector('[data-popup-item-mark="checked"]')!
      expect(box(mark).left, popup).toBeGreaterThanOrEqual(box(label).right)
      await view.unmount()
    }
  })

  test('PK28: условие сводки фильтров — запись с точкой, колонкой, кнопкой снятия и условием; у панели заголовок', async () => {
    await opened('filterSummary')
    const summary = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-summary"]')
    await expect.poll(summary).not.toBeNull()
    const entry = summary()!.querySelector('li[data-column-id="name"]')!
    expect(entry.querySelector('[data-filter-condition]')).not.toBeNull()
    expect(
      entry.querySelector('[data-testid="filter-summary-remove"]'),
    ).not.toBeNull()
    expect(entry.textContent).toContain('Name')
    expect(summary()!.querySelector('p')?.textContent).toBeTruthy()
    expect(sourceOf('FilterSummaryPopover')).toContain('<PopupEntry')
  })

  test('PK30: панель фильтра вариантов держит поля поверхности: содержимое не доходит до правого края', async () => {
    await opened('filterOptions')
    const panel = () =>
      document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
    await expect.poll(panel).not.toBeNull()
    await expect
      .poll(() => panel()!.querySelector('[data-testid="filter-options"]'))
      .not.toBeNull()
    settle()
    const surface = panel()!.parentElement!
    const p = padding(surface)
    expect(box(surface).right - box(panel()!).right).toBeCloseTo(p, 0)
    const list = panel()!.querySelector('[data-testid="filter-options"]')!
    expect(box(surface).right - box(list).right).toBeCloseTo(p * 2, 0)
  })
})

describe('Контролы', () => {
  test('PK5: поле — кольцо фокуса, ошибка со связанным текстом; поля панелей — Field, своих классов текста ошибки нет', async () => {
    const screen = await render(<Field.FieldInvalid />)
    const input = await expect
      .poll(() => screen.container.querySelector('input'))
      .not.toBeNull()
      .then(() => screen.container.querySelector('input')!)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const error = document.getElementById(
      input.getAttribute('aria-describedby')!,
    )!
    expect(error.textContent).toBeTruthy()
    await screen.unmount()

    const plain = await render(<Field.FieldPlayground />)
    await userEvent.tab()
    const focused = plain.container.querySelector('input')!
    expect(document.activeElement).toBe(focused)
    settle()
    expect(getComputedStyle(focused).borderTopColor).toBe(
      resolveColor(focused.parentElement!, 'var(--tsr-comp-focus-ring)'),
    )
    for (const name of [
      'FilterPanel',
      'ColumnVisibilityMenu',
      'OptionEditors',
    ]) {
      expect(sourceOf(name), name).toContain('<Field')
    }
    expect(sourceOf('FilterPanel')).toContain('<FieldError')
    expect(sourceOf('CellEditInput')).toContain('FieldError')
  })

  test('PK6: список вариантов — флажки, счётчики, виртуализация, ожидание и отказ; импортов ядра, shared и плагинов нет', async () => {
    const screen = await render(<Checklist.ChecklistPlayground count={500} />)
    const boxes = () => document.querySelectorAll('[role="checkbox"]').length
    await expect.poll(boxes).toBeGreaterThan(0)
    expect(boxes()).toBeLessThan(50)
    const counts = document.querySelectorAll(
      '[data-testid="filter-option-count"]',
    )
    expect(counts[1]?.textContent).toBe('7')
    await screen.unmount()
    await render(<Checklist.ChecklistStates />)
    await expect
      .poll(() => document.querySelector('[data-skeleton]'))
      .not.toBeNull()
    expect(
      document.querySelector('[data-testid="story-retry-error"]'),
    ).not.toBeNull()
    expect(sourceOf('Checklist')).not.toMatch(
      /from '[^']*\/(core|shared|plugins|grid)\//,
    )
  })

  test('PK12: поле поиска — лупа, поле, крестик при тексте и кнопка-подсказка; быстрый поиск, поиск вариантов и «Колонок» — этот компонент', async () => {
    const screen = await render(<Search.SearchFieldPlayground />)
    const root = screen.container
    await expect.poll(() => root.querySelector('input')).not.toBeNull()
    expect(root.querySelector('[data-icon] svg')).not.toBeNull()
    expect(root.querySelectorAll('.data-grid__icon-button').length).toBe(2)
    await screen.unmount()
    const empty = await render(<Search.SearchFieldEmpty />)
    expect(
      empty.container.querySelectorAll('.data-grid__icon-button').length,
    ).toBe(1)
    expect(sourceOf('quickSearch/SearchField')).toContain('<KitSearchField')
    for (const name of [
      'OptionFilterPanel',
      'ColumnVisibilityMenu',
      'OptionEditors',
    ]) {
      expect(sourceOf(name), name).toContain('<SearchField')
      expect(sourceOf(name), name).not.toContain('<button')
    }
  })

  test('PK13: кнопка списка — значение и шеврон, ожидание дугой, отказ; условие фильтра и размер страницы — этот компонент', async () => {
    const screen = await render(<Select.SelectTriggerPlayground />)
    const trigger = () => screen.container.querySelector('button')!
    await expect.poll(trigger).not.toBeNull()
    expect(trigger().querySelector('svg')).not.toBeNull()
    expect(trigger().textContent).toBeTruthy()
    await screen.unmount()
    const waiting = await render(<Select.SelectTriggerWaiting />)
    expect(
      waiting.container.querySelector('button')!.getAttribute('aria-busy'),
    ).toBe('true')
    expect(waiting.container.querySelector('[data-pending-arc]')).not.toBeNull()
    await waiting.unmount()
    const cancelled: string[] = []
    const view = (failed: boolean) => (
      <div className={DATA_GRID_THEME_CLASS}>
        <SelectTrigger
          pending={!failed}
          failed={failed}
          cancelLabel="Stop"
          onCancel={() => cancelled.push('stop')}
        >
          10
        </SelectTrigger>
      </div>
    )
    const own = await render(view(false))
    const button = () => own.container.querySelector('button')!
    await userEvent.hover(button())
    await expect
      .poll(() => button().hasAttribute('data-cancel-armed'))
      .toBe(true)
    expect(button().getAttribute('aria-label')).toBe('Stop')
    await userEvent.click(button())
    expect(cancelled).toEqual(['stop'])
    await own.rerender(view(true))
    await expect.poll(() => button().getAttribute('aria-busy')).toBeNull()
    expect(failureShownOn(button())).toBe(false)
    await own.unmount()
    for (const name of ['OperatorSelect', 'PageSizeSelect']) {
      expect(sourceOf(name), name).toContain('<SelectTrigger')
    }
  })

  test('PK14: радио — кружок с точкой, кольцо фокуса, выключенное; булев фильтр и пресеты даты — этот компонент', async () => {
    const screen = await render(<Radio.RadioPlayground />)
    const radios = () => [...document.querySelectorAll('[role="radio"]')]
    await expect.poll(() => radios().length).toBeGreaterThan(0)
    const checked = radios().find(
      el => el.getAttribute('aria-checked') === 'true',
    )!
    expect(checked.querySelector('[data-radio-dot]')).not.toBeNull()
    ;(checked as HTMLElement).focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(() => (document.activeElement as HTMLElement).getAttribute('role'))
      .toBe('radio')
    expect(document.activeElement).not.toBe(checked)
    settle()
    const focused = getComputedStyle(document.activeElement!)
    expect(focused.boxShadow).not.toBe('none')
    expect(focused.borderTopColor).toBe(
      resolveColor(document.activeElement!, 'var(--tsr-comp-focus-ring)'),
    )
    await screen.unmount()
    const disabled = await render(<Radio.RadioDisabled />)
    await expect
      .poll(() => radios().some(el => el.hasAttribute('data-disabled')))
      .toBe(true)
    await disabled.unmount()
    for (const name of ['FilterPanel', 'DateFilterPanel']) {
      expect(sourceOf(name), name).toContain('<Radio')
    }
  })

  test('PK15: флажок — отмечен, частично, выключен и ждёт; выбор строк, список вариантов и редактор булевой ячейки — этот компонент, своего role="checkbox" нет', async () => {
    const screen = await render(<Checkbox.CheckboxStates />)
    const boxes = () => [
      ...screen.container.querySelectorAll('[role="checkbox"]'),
    ]
    await expect.poll(() => boxes().length).toBeGreaterThan(3)
    const value = (attr: string, text: string) =>
      boxes().some(el => el.getAttribute(attr) === text)
    expect(value('aria-checked', 'true')).toBe(true)
    expect(value('aria-checked', 'mixed')).toBe(true)
    expect(value('aria-busy', 'true')).toBe(true)
    expect(boxes().some(el => el.hasAttribute('data-disabled'))).toBe(true)
    expect(sourceOf('Checklist')).toContain('<Checkbox')
    const own = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/ui/'))
      .filter(([, text]) => text.includes('role="checkbox"'))
      .map(([path]) => path)
    expect(own).toEqual([])
  })

  test('PK16: значок состояния — фокусируемый, имя — причина, причина в тултипе, тон ошибки или обычный; отказ фильтра — этот компонент', async () => {
    const screen = await render(<Status.StatusIconPlayground />)
    const icon = () =>
      screen.container.querySelector<HTMLElement>('[role="img"]')!
    await expect.poll(icon).not.toBeNull()
    expect(icon().tabIndex).toBe(0)
    const reason = icon().getAttribute('aria-label')!
    expect(reason).toBeTruthy()
    expect(icon().dataset.tone).toBe('error')
    await userEvent.tab()
    expect(document.activeElement).toBe(icon())
    expect(getComputedStyle(icon()).outlineStyle).toBe('solid')
    await expect
      .poll(() => document.querySelector('[data-side][data-open]')?.textContent)
      .toBe(reason)
    await screen.unmount()
    const neutral = await render(<Status.StatusIconNeutral />)
    expect(
      neutral.container.querySelector<HTMLElement>('[role="img"]')!.dataset
        .tone,
    ).toBe('neutral')
    expect(sourceOf('FilterFailure')).toContain('<StatusIcon')
  })

  test('PK18: флажок только для значения — тот же вид, не нажимается, не в порядке фокуса, скринридеру — значение; CheckMark и SelectCheckbox ушли', async () => {
    const screen = await render(<Checkbox.CheckboxReadOnly />)
    const views = () => [...screen.container.querySelectorAll('[role="img"]')]
    await expect.poll(() => views().length).toBeGreaterThan(0)
    expect(views().every(el => el.getAttribute('aria-label'))).toBe(true)
    expect(screen.container.querySelector('[role="checkbox"]')).toBeNull()
    await userEvent.tab()
    expect(document.activeElement).toBe(document.body)
    for (const text of Object.values(SOURCES)) {
      expect(text).not.toMatch(/\b(CheckMark|SelectCheckbox)\b/)
    }
  })

  test('PK19: месяц и год календаря — кнопка списка и поверхность кита с пунктами', async () => {
    const screen = await render(<Calendar.CalendarPlayground />)
    const all = () => [
      ...screen.container.ownerDocument.querySelectorAll<HTMLElement>(
        '[aria-haspopup="listbox"]',
      ),
    ]
    await expect.poll(() => all().length).toBe(2)
    await userEvent.click(all()[0]!)
    const list = () => document.querySelector('[data-open] [role="listbox"]')
    await expect.poll(list).not.toBeNull()
    expect(
      list()!.querySelector('[data-popup-item-mark="checked"]'),
    ).not.toBeNull()
    expect(list()!.querySelector('[data-popup-item-label]')).not.toBeNull()
    const before = all()[0]!.textContent
    await expect
      .poll(() => list()!.querySelector('[data-highlighted]'))
      .not.toBeNull()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect.poll(list).toBeNull()
    expect(all()[0]!.textContent).not.toBe(before)
    expect(sourceOf('Calendar')).toContain('<PopupSurface')
    expect(sourceOf('Calendar')).toContain('SelectTrigger')
  })

  test('PK20: поле времени — сегменты меняются стрелками и цифрами, формат 12 или 24 часа из языка', async () => {
    const screen = await render(<Time.TimeField24 />)
    const segments = () => [
      ...screen.container.querySelectorAll<HTMLElement>('[role="spinbutton"]'),
    ]
    await expect.poll(() => segments().length).toBe(2)
    const hours = segments()[0]!
    const before = Number(hours.getAttribute('aria-valuenow'))
    hours.focus()
    await userEvent.keyboard('{ArrowUp}')
    await expect
      .poll(() => Number(segments()[0]!.getAttribute('aria-valuenow')))
      .toBe((before + 1) % 24)
    await userEvent.keyboard('07')
    await expect
      .poll(() => Number(segments()[0]!.getAttribute('aria-valuenow')))
      .toBe(7)
    await screen.unmount()
    const twelve = await render(<Time.TimeFieldPlayground language="en-US" />)
    await expect
      .poll(
        () => twelve.container.querySelectorAll('[role="spinbutton"]').length,
      )
      .toBe(3)
  })

  test('PK21: облачко — одно у строки и колонки: скругление, тень, тон ошибки и счётчик баблом; облачка строки и колонки грида собраны на нём', async () => {
    const screen = await render(<Cloud.DragCloudVariants />)
    const clouds = () => [
      ...screen.container.querySelectorAll<HTMLElement>('[data-drag-cloud]'),
    ]
    await expect.poll(() => clouds().length).toBeGreaterThan(1)
    const plain = clouds()[0]!
    const style = getComputedStyle(plain)
    expect(parseFloat(style.borderTopLeftRadius)).toBe(
      px(plain, '--tsr-comp-drag-cloud-radius'),
    )
    expect(style.boxShadow).not.toBe('none')
    expect(style.opacity).toBe(
      getComputedStyle(plain)
        .getPropertyValue('--tsr-comp-draggable-opacity')
        .trim(),
    )
    const invalid = clouds().find(el => el.hasAttribute('data-invalid'))!
    expect(getComputedStyle(invalid).backgroundColor).not.toBe(
      style.backgroundColor,
    )
    const nested = clouds()[1]!
    expect(nested.nextElementSibling?.textContent).toBe('12')
    expect(sourceOf('OverlayBodyRow')).toContain('<DragCloud')
    expect(sourceOf('OverlayHeadCell')).toContain('<DragCloud')
  })

  test('PK29: бабл несохранённого отличим от бабла отказа по оттенку, а не только по соседству', async () => {
    const hue = ([r, g, b]: number[]) => {
      const [max, min] = [Math.max(r!, g!, b!), Math.min(r!, g!, b!)]
      if (max === min) return 0
      const d = max - min
      const h =
        max === r
          ? ((g! - b!) / d + 6) % 6
          : max === g
            ? (b! - r!) / d + 2
            : (r! - g!) / d + 4
      return h * 60
    }
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark)
      const screen = await render(
        <div className={DATA_GRID_THEME_CLASS}>
          <Bubble tone="draft">1</Bubble>
          <Bubble tone="error">1</Bubble>
        </div>,
      )
      const [draft, error] = screen.container.querySelectorAll('span')
      const fill = (el: Element) => toRgba(getComputedStyle(el).backgroundColor)
      const a = hue(fill(draft!))
      const b = hue(fill(error!))
      const distance = Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
      expect(distance, dark ? 'тёмная' : 'светлая').toBeGreaterThan(15)
      await screen.unmount()
    }
  })
})
