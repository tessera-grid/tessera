import { composeStories } from '@storybook/react-vite'
import { userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS } from '../../../ui/theme'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, editHistory } from '../../../plugins'
import { Bubble } from '../../../ui/Bubble'
import { CellIssue } from '../../../ui/CellIssue'
import { UiCanvas } from '../../__mocks__/UiCanvas'
import { ItemButton } from '../../../ui/Popup/ItemButton'
import { PopupEntry } from '../../../ui/Popup/PopupEntry'
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
import { viewSettingsLevel, viewSettingsSectionOpen } from '../viewSettings'

// Кит поповеров и контролов (ADR 0183, PK2–PK6, PK12–PK21, PK27–PK30, PK32) и раскладка панели по
// двум линиям (PK33). Истории — те же, что снимает каталог; потребители проверяются по исходникам.

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

describe('Раскладка поповера-панели (ADR 0183, PK33)', () => {
  test('PK33: две линии от края — рамки на поле поповера со всех сторон, текст на линии текста пунктов; между заголовком, содержимым и кнопками — двойное поле; слот значка меню у всех пунктов или ни у кого', async () => {
    const view = await render(<Panel.PopupPanelPlayground />)
    await expect.poll(dialog).not.toBeNull()
    settle()
    const popup = dialog()
    const p = padding(popup)
    const textLine = p + px(popup, '--tsr-comp-popup-item-padding-x')
    const title = popup.querySelector<HTMLElement>('[data-popup-level-title]')!
    const style = getComputedStyle(title)
    expect(parseFloat(style.fontSize)).toBe(
      px(popup, '--tsr-comp-popup-title-font-size'),
    )
    expect(Number(style.fontWeight)).toBeGreaterThanOrEqual(600)
    // Заголовок: текст — на линии текста пунктов, сверху — поле поповера.
    expect(
      textBox(title.querySelector('[data-popup-item-label]')!).left -
        box(popup).left,
    ).toBeCloseTo(textLine, 0)
    expect(box(title).top - box(popup).top).toBeCloseTo(p, 0)
    const content = title.nextElementSibling!
    // Шапка — строкой высоты пункта, от неё до содержимого — двойное поле.
    expect(box(content).top - box(title).bottom).toBeCloseTo(p * 2, 0)
    // Кнопки: рамка последней — на поле поповера справа и снизу, от содержимого — двойное поле.
    const footer = popup.querySelector('[data-popup-footer]')!
    const last = [...footer.querySelectorAll('button')].at(-1)!
    expect(box(popup).right - box(last).right).toBeCloseTo(p, 0)
    expect(box(popup).bottom - box(last).bottom).toBeCloseTo(p, 0)
    const body = footer.previousElementSibling!
    expect(box(last).top - box(body).bottom).toBeCloseTo(p * 2, 0)
    expect(getComputedStyle(footer).borderTopWidth).toBe('0px')
    expect(getComputedStyle(body).borderBottomWidth).toBe('0px')
    await view.unmount()

    // «Колонки»: поле поиска и пункты — на поле поповера, счётчик — на линии текста.
    await opened('columns')
    const count = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-count"]',
      )
    await expect.poll(count).not.toBeNull()
    settle()
    const surface = count()!.closest<HTMLElement>('[role="dialog"]')!
    const field = surface.querySelector('input')!
    expect(box(field).left - box(surface).left).toBeCloseTo(p, 0)
    // Раздел «Настроек вида»: над полем — строка «назад», от неё — двойное поле (ADR 0215).
    const back = surface.querySelector('[data-popup-level-back]')!
    expect(box(back).top - box(surface).top).toBeCloseTo(p, 0)
    expect(box(field).top - box(back).bottom).toBeCloseTo(p * 2, 0)
    const item = surface.querySelector('[role="checkbox"]')!.closest('label')!
    expect(box(item).left - box(surface).left).toBeCloseTo(p, 0)
    expect(box(surface).right - box(item).right).toBeCloseTo(p, 0)
    expect(textBox(count()!).left - box(surface).left).toBeCloseTo(textLine, 0)
    await cleanup()

    // Меню без значков: текст пунктов — на линии текста, пустого слота значка нет.
    await render(<Group.PopupGroupWithoutLabels />)
    const label = () =>
      document.querySelector<HTMLElement>('[data-popup-item-label]')
    await expect.poll(label).not.toBeNull()
    settle()
    const menu = label()!.closest<HTMLElement>(
      '[role="menu"], [role="dialog"]',
    )!
    const menuItem = label()!.parentElement!
    expect(menuItem.querySelector('[data-popup-item-icon]')).toBeNull()
    expect(textBox(label()!).left - box(menu).left).toBeCloseTo(
      padding(menu) + px(menu, '--tsr-comp-popup-item-padding-x'),
      0,
    )
  })
})

describe('Блоки поповера', () => {
  test('PK2: заголовок панели связан с поповером через aria-labelledby; журнал, пульт, отметка, сводка, «Колонки» и панели фильтра собраны на PopupPanel', async () => {
    await render(<Panel.PopupPanelPlayground />)
    await expect.poll(dialog).not.toBeNull()
    const popup = dialog()
    const title = popup.querySelector<HTMLElement>('[data-popup-level-title]')!
    expect(popup.getAttribute('aria-labelledby')).toBe(title.id)
    for (const name of [
      'FailureLogPopover',
      'UnsavedChangesPopover',
      'CellIssuePopup',
      'ViewSettingsPopover',
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

  test('PK4: подпись группы — стилем заголовка поповера, на поле поповера сверху и снизу, линия между группами, над кнопками панели линии нет', async () => {
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
    // Под подписью — поле поповера: от подписи до первого пункта группы.
    const field = px(divided, '--tsr-comp-popup-padding')
    expect(parseFloat(style.paddingBottom)).toBe(field)
    expect(
      Math.round(
        label.nextElementSibling!.getBoundingClientRect().top -
          label.getBoundingClientRect().bottom,
      ),
    ).toBe(0)
    const second = groups[1]!.firstElementChild!
    expect(parseFloat(getComputedStyle(second).paddingTop)).toBe(field)
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

  test('PK28: условие в разделе «Фильтр» «Настроек вида» — запись с точкой, колонкой, кнопкой снятия и условием; у раздела — строка «назад»', async () => {
    await opened('view')
    const section = () => viewSettingsSectionOpen('filter')
    await expect.poll(section).not.toBeNull()
    const entry = section()!.querySelector('[data-view-settings-level="name"]')!
    expect(
      entry.querySelector('[data-view-settings-description]'),
    ).not.toBeNull()
    expect(
      entry.querySelector('[data-testid="view-settings-remove"]'),
    ).not.toBeNull()
    expect(entry.textContent).toContain('Name')
    expect(
      viewSettingsLevel()!.querySelector('[data-popup-level-back]')
        ?.textContent,
    ).toBeTruthy()
    expect(sourceOf('ViewSettingsPopover')).toContain('<PopupEntry')
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
    // Список вариантов — на поле поверхности, как пункты (PK33).
    const list = panel()!.querySelector('[data-testid="filter-options"]')!
    expect(box(surface).right - box(list).right).toBeCloseTo(p, 0)
  })

  test('PK32: поповер, модуль которого приходит по первому нажатию, появляется и уходит переходом поверхности — с первого открытия и при каждом следующем; отметка ячейки', async () => {
    const popup = () =>
      document.querySelector<HTMLElement>('[data-testid="cell-issue-popover"]')
    // Состояния перехода, в которых побывал попап: первый кадр открытия и уход.
    const seen = new Set<string>()
    const observer = new MutationObserver(() => {
      for (const state of ['data-starting-style', 'data-ending-style'])
        if (popup()?.hasAttribute(state)) seen.add(state)
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-starting-style', 'data-ending-style'],
    })
    const screen = await render(
      <UiCanvas>
        <CellIssue reason="The server refused the value" label="Save failed" />
      </UiCanvas>,
    )
    const trigger = () =>
      document.querySelector<HTMLElement>('[data-cell-issue]')!
    try {
      for (const round of ['первое открытие', 'повторное открытие']) {
        seen.clear()
        // eslint-disable-next-line no-await-in-loop
        await userEvent.click(trigger())
        // eslint-disable-next-line no-await-in-loop
        await expect
          .poll(() => popup() && !popup()!.hasAttribute('data-starting-style'))
          .toBe(true)
        expect(seen.has('data-starting-style'), `${round}: появление`).toBe(
          true,
        )
        // eslint-disable-next-line no-await-in-loop
        await userEvent.keyboard('{Escape}')
        // eslint-disable-next-line no-await-in-loop
        await expect.poll(popup).toBeNull()
        expect(seen.has('data-ending-style'), `${round}: уход`).toBe(true)
      }
    } finally {
      observer.disconnect()
      await screen.unmount()
    }
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

const STYLES = import.meta.glob('../../../{grid,plugins,ui}/**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const styleOf = (name: string) => {
  const keys = Object.keys(STYLES).filter(path =>
    path.endsWith(`/${name}.module.css`),
  )
  if (keys.length !== 1) throw new Error(`${name}: ${keys.length}`)
  return STYLES[keys[0]!]!
}

/** Затемнение у верхнего и нижнего края, px: длины маски области прокрутки. */
const fadeOf = (el: Element) => {
  const mask = getComputedStyle(el).maskImage
  const match =
    /rgb\(0, 0, 0\) ([\d.]+)px, rgb\(0, 0, 0\) (?:calc\(100% - ([\d.]+)px\)|100%)/.exec(
      mask,
    )
  if (!match) return null
  // Прокрутка в Firefox и WebKit — дробными пикселями.
  return {
    top: Math.round(Number(match[1])),
    bottom: Math.round(Number(match[2] ?? 0)),
  }
}
const scrollable = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('*')].find(
    el =>
      el.scrollHeight > el.clientHeight + 4 &&
      getComputedStyle(el).overflowY === 'auto',
  ) ?? null
const scrollTo = async (el: HTMLElement, top: number) => {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
  await new Promise(resolve => requestAnimationFrame(resolve))
}
/** Выбранный пункт стоит посередине списка — не у края под затемнением. */
const centered = (list: HTMLElement, selected: HTMLElement) => {
  const outer = list.getBoundingClientRect()
  const inner = selected.getBoundingClientRect()
  return (
    Math.abs(inner.top + inner.height / 2 - (outer.top + outer.height / 2)) <=
    inner.height / 2
  )
}

describe('Затемнение краёв прокрутки (ADR 0183, PK31)', () => {
  test('PK31: прокручиваемая область поповера затемнена у края, за которым есть ещё содержимое: затемнение растёт с прокруткой до токена --tsr-comp-popup-scroll-fade, у края без содержимого его нет, полоса прокрутки и тень поверхности не гаснут; во всех прокручиваемых списках поповеров; выбранный год и время открываются посередине списка', async () => {
    // Список вариантов: рост затемнения с прокруткой и края без содержимого.
    const screen = await render(<Checklist.ChecklistPlayground count={500} />)
    await expect.poll(() => scrollable(document)).not.toBeNull()
    const list = scrollable(document)!
    const token = px(list, '--tsr-comp-popup-scroll-fade')
    expect(token).toBeGreaterThan(0)
    await expect.poll(() => fadeOf(list)).toEqual({ top: 0, bottom: token })
    await scrollTo(list, token / 4)
    await expect.poll(() => fadeOf(list)?.top).toBe(Math.round(list.scrollTop))
    expect(fadeOf(list)!.top).toBeGreaterThan(0)
    expect(fadeOf(list)!.top).toBeLessThan(token)
    await scrollTo(list, token * 10)
    await expect.poll(() => fadeOf(list)?.top).toBe(token)
    await scrollTo(list, list.scrollHeight)
    await expect.poll(() => fadeOf(list)).toEqual({ top: token, bottom: 0 })
    // Полоса прокрутки — без маски: второй слой маски открывает её во всю ширину.
    const scrollbar = list.offsetWidth - list.clientWidth
    expect(getComputedStyle(list).maskSize).toBe(
      `${scrollbar ? `calc(100% - ${scrollbar}px)` : '100%'} 100%, ${scrollbar}px 100%`,
    )
    await screen.unmount()

    // Колонки времени: затемнение на колонке, поверхность — без маски и с тенью; выбранный час
    // посередине.
    const time = await render(<Time.TimeField24 />)
    const opener = () =>
      time.container.querySelector<HTMLElement>(
        'button[aria-haspopup="dialog"]',
      )
    await expect.poll(opener).not.toBeNull()
    await userEvent.click(opener()!)
    // Колонки часов и минут; выбранный час получает фокус, минута — нет: посередине обе.
    const columns = () =>
      [
        ...(dialog()?.querySelectorAll<HTMLElement>(
          '[aria-label] > [aria-pressed="true"]',
        ) ?? []),
      ].map(pressed => pressed.parentElement!)
    const hours = () => columns()[0] ?? null
    await expect.poll(() => columns().length).toBe(2)
    settle()
    for (const column of columns())
      await expect
        .poll(() =>
          centered(column, column.querySelector('[aria-pressed="true"]')!),
        )
        .toBe(true)
    // Посередине длинного списка содержимое есть за обоими краями.
    await expect.poll(() => fadeOf(hours()!)?.top).toBeGreaterThan(0)
    expect(fadeOf(hours()!)!.bottom).toBeGreaterThan(0)
    expect(getComputedStyle(dialog()).maskImage).toBe('none')
    expect(getComputedStyle(dialog()).boxShadow).not.toBe('none')
    await userEvent.keyboard('{Escape}')
    await time.unmount()

    // Список лет: выбранный год посередине, края затемнены.
    const calendar = await render(<Calendar.CalendarPlayground />)
    const triggers = () => [
      ...document.querySelectorAll<HTMLElement>('[aria-haspopup="listbox"]'),
    ]
    await expect.poll(() => triggers().length).toBe(2)
    await userEvent.click(triggers()[1]!)
    const years = () =>
      document.querySelector<HTMLElement>('[data-open] [role="listbox"]')
    await expect.poll(years).not.toBeNull()
    const yearList = () => scrollable(years()!.parentElement!) ?? years()!
    const year = () =>
      years()!.querySelector<HTMLElement>('[aria-selected="true"]')!
    await expect.poll(() => centered(yearList(), year())).toBe(true)
    await expect.poll(() => fadeOf(yearList())?.top).toBeGreaterThan(0)
    expect(fadeOf(yearList())!.bottom).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    await calendar.unmount()

    // Все прокручиваемые списки поповеров — на затемнении кита.
    for (const name of [
      'Checklist',
      'OptionEditors',
      'ColumnVisibilityMenu',
      'FailureLogPopover',
      'UnsavedChangesPopover',
      'ViewSettingsPopover',
      'Calendar',
      'TimeField',
    ])
      expect(sourceOf(name), name).toMatch(/useScrollFade[<(]/)
    for (const name of [
      'Checklist',
      'OptionEditors',
      'ColumnVisibilityMenu',
      'Calendar',
      'TimeField',
    ])
      expect(styleOf(name), name).toContain('composes: scrollFade from')
    for (const name of ['FailureLog', 'UnsavedChanges', 'ViewSettings'])
      expect(styleOf(name), name).toContain('composes: cardsScroll from')
  })
})

/** Рамка поля: сам узел или ближайший предок с рамкой. */
const frameOf = (el: Element) => {
  for (let node: Element | null = el; node; node = node.parentElement)
    if (parseFloat(getComputedStyle(node).borderTopWidth) > 0) return node
  throw new Error('нет рамки')
}
const iconBox = (el: Element) =>
  el.querySelector('svg')!.getBoundingClientRect()
/** Центр значка от правой рамки: значки разной ширины стоят в одном месте компактной кнопки. */
const iconCenterFromRight = (frame: Element, icon: DOMRect) =>
  box(frame).right - (icon.left + icon.width / 2)

const Glyph = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
    <rect width={16} height={16} />
  </svg>
)

/** Пункты с кнопкой и с меткой, запись в одну строку и с содержимым — в одной теме. */
const Rows = () => (
  <div
    className={DATA_GRID_THEME_CLASS}
    // Шрифт и кегль — как у поверхности поповера, где пункты и записи живут.
    style={{
      padding: 24,
      width: 340,
      display: 'grid',
      gap: 8,
      fontFamily: 'var(--tsr-comp-font-family)',
      fontSize: 'var(--tsr-comp-popup-font-size)',
    }}
  >
    <PopupItem
      data-testid="with-button"
      icon={<Glyph />}
      label="Apply"
      end={
        <ItemButton label="Discard">
          <Glyph />
        </ItemButton>
      }
    />
    <PopupItem
      data-testid="with-mark"
      icon={<Glyph />}
      label="Apply"
      end={<PopupItemMark status="checked" />}
    />
    <div data-testid="entry-line">
      <PopupEntry
        mark={<Bubble size="dot" tone="draft" />}
        label="Edit cell"
        actions={
          <ItemButton label="Discard">
            <Glyph />
          </ItemButton>
        }
      />
    </div>
    <div data-testid="entry-body">
      <PopupEntry
        mark={<Bubble size="dot" tone="error" />}
        label="Edit cell"
        onShow={() => {}}
        actions={
          <ItemButton label="Close">
            <Glyph />
          </ItemButton>
        }
      >
        The server refused the value.
      </PopupEntry>
    </div>
  </div>
)
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const entryOf = (id: string) =>
  byTestId(id).querySelector<HTMLElement>('[data-popup-entry]')!

describe('Пункт, запись и поле по линиям поповера (ADR 0183, PK34–PK36)', () => {
  test('PK34: кнопка справа в пункте и записи — ItemButton, компактный квадрат; пункт и запись вмещают её целиком: строка с кнопкой высотой пункта, значок кнопки — на поле пункта от правого края, как метка пункта', async () => {
    const screen = await render(<Rows />)
    await expect.poll(() => byTestId('with-button')).not.toBeNull()
    const item = byTestId('with-button')
    const marked = byTestId('with-mark')
    const height = px(item, '--tsr-comp-popup-item-min-height')
    const fieldX = px(item, '--tsr-comp-popup-item-padding-x')
    const compact = px(item, '--tsr-comp-button-size-compact')
    for (const host of [item, entryOf('entry-line'), entryOf('entry-body')]) {
      const button = host.querySelector('[data-item-button]')!
      const b = box(button)
      // Компактный квадрат.
      expect(b.width).toBeCloseTo(compact, 0)
      expect(b.height).toBeCloseTo(compact, 0)
      // Целиком внутри пункта или записи.
      expect(b.top).toBeGreaterThanOrEqual(box(host).top - 0.5)
      expect(b.right).toBeLessThanOrEqual(box(host).right + 0.5)
      // Поле над кнопкой — остаток до высоты пункта.
      expect(b.top - box(host).top).toBeCloseTo((height - compact) / 2, 0)
      // Значок — на поле пункта от правого края, как метка пункта.
      expect(box(host).right - iconBox(button).right).toBeCloseTo(fieldX, 0)
    }
    expect(box(item).height).toBeCloseTo(height, 0)
    expect(box(item).height).toBeCloseTo(box(marked).height, 0)
    const mark = marked.querySelector('[data-popup-item-mark]')!
    expect(box(marked).right - iconBox(mark).right).toBeCloseTo(fieldX, 0)
    await screen.unmount()
  })

  test('PK35: поле ввода, поиск, выпадающий список и поле времени держат текст на одном поле от рамки; значок справа — шеврон, часы, крестик — на одном отступе от рамки', async () => {
    const offsets: Record<string, { text: number; icon?: number }> = {}

    let view = await render(<Field.FieldPlayground />)
    await expect
      .poll(() => view.container.querySelector('input'))
      .not.toBeNull()
    let input = view.container.querySelector('input')!
    offsets.field = {
      text:
        parseFloat(getComputedStyle(input).borderLeftWidth) +
        parseFloat(getComputedStyle(input).paddingLeft) +
        box(input).left -
        box(frameOf(input)).left,
    }
    const padX = px(input.parentElement!, '--tsr-comp-field-padding-x')
    await view.unmount()

    view = await render(<Search.SearchFieldPlayground />)
    await expect
      .poll(() => view.container.querySelector('input'))
      .not.toBeNull()
    input = view.container.querySelector('input')!
    const searchFrame = frameOf(input)
    const searchIcons = [
      ...searchFrame.parentElement!.querySelectorAll('svg'),
    ].map(svg => svg.getBoundingClientRect())
    // Лупа — на поле текста, крестик — справа.
    offsets.search = {
      text: searchIcons[0]!.left - box(searchFrame).left,
      icon: iconCenterFromRight(searchFrame, searchIcons.at(-1)!),
    }
    await view.unmount()

    view = await render(<Select.SelectTriggerPlayground />)
    const trigger = () =>
      view.container.querySelector<HTMLElement>('button[aria-haspopup]')
    await expect.poll(trigger).not.toBeNull()
    offsets.select = {
      text:
        textBox(trigger()!.querySelector('span') ?? trigger()!).left -
        box(trigger()!).left,
      icon: iconCenterFromRight(trigger()!, iconBox(trigger()!)),
    }
    await view.unmount()

    view = await render(<Time.TimeFieldPlayground />)
    const segment = () =>
      view.container.querySelector<HTMLElement>('[role="spinbutton"]')
    await expect.poll(segment).not.toBeNull()
    const timeFrame = frameOf(segment()!)
    const slot =
      px(timeFrame, '--tsr-ref-space-1') +
      px(timeFrame, '--tsr-comp-button-size-compact') / 2
    offsets.time = {
      text: textBox(segment()!).left - box(timeFrame).left,
      icon: iconCenterFromRight(
        timeFrame,
        iconBox(timeFrame.querySelector('button[aria-haspopup]')!),
      ),
    }
    await view.unmount()

    // Текст — на поле от рамки: рамка 1px и `--tsr-comp-field-padding-x`.
    for (const [name, { text }] of Object.entries(offsets))
      expect(text, name).toBeCloseTo(padX + 1, 0)
    // Значки справа — на одном месте: центр компактной кнопки у рамки.
    expect(offsets.select!.icon).toBeCloseTo(slot, 0)
    expect(offsets.search!.icon).toBeCloseTo(offsets.select!.icon!, 0)
    expect(offsets.time!.icon).toBeCloseTo(offsets.select!.icon!, 0)
  })

  test('PK36: строка подписи записи — как пункт списка: поля сверху и по бокам, место значка шириной значка с точкой по центру; подпись — на линии текста пунктов со значком, однострочная запись — высотой пункта, кнопки — на поле пункта от края', async () => {
    const screen = await render(<Rows />)
    await expect.poll(() => byTestId('with-mark')).not.toBeNull()
    const item = byTestId('with-mark')
    const height = px(item, '--tsr-comp-popup-item-min-height')
    const iconSize = px(item, '--tsr-comp-button-icon-size')
    const fieldX = px(item, '--tsr-comp-popup-item-padding-x')
    const itemIcon = item.querySelector('[data-popup-item-icon]')!
    const itemLabel = item.querySelector('[data-popup-item-label]')!
    for (const id of ['entry-line', 'entry-body']) {
      const entry = entryOf(id)
      const mark = entry.querySelector('[data-popup-entry-mark]')!
      const label = entry.querySelector('[data-popup-entry-label]')!
      // Место значка — как у пункта: та же ширина и левый край, точка по центру.
      expect(box(mark).width, id).toBeCloseTo(iconSize, 0)
      expect(box(mark).left - box(entry).left, id).toBeCloseTo(
        box(itemIcon).left - box(item).left,
        0,
      )
      const dot = box(mark.firstElementChild!)
      expect(dot.left + dot.width / 2, id).toBeCloseTo(
        box(mark).left + box(mark).width / 2,
        0,
      )
      // Подпись — на линии текста пункта со значком, по горизонтали и по вертикали.
      expect(textBox(label).left - box(entry).left, id).toBeCloseTo(
        textBox(itemLabel).left - box(item).left,
        0,
      )
      expect(textBox(label).top - box(entry).top, id).toBeCloseTo(
        textBox(itemLabel).top - box(item).top,
        0,
      )
      // Кнопки — на поле пункта от края.
      expect(
        box(entry).right -
          iconBox(entry.querySelector('[data-item-button]')!).right,
        id,
      ).toBeCloseTo(fieldX, 0)
    }
    // Однострочная запись — высотой пункта.
    expect(box(entryOf('entry-line')).height).toBeCloseTo(height, 0)
    expect(box(entryOf('entry-body')).height).toBeGreaterThan(height)
    await screen.unmount()
  })
})

/** Таблица с историей правок: стенд «К исходному виду» для BN12. */
let historyApi:
  | { writeCells: (cells: unknown[], options: unknown) => Promise<unknown> }
  | undefined
const HISTORY_ROWS = [{ id: 'r1', name: 'Row 1' }]
const HistoryHost = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: HISTORY_ROWS,
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      cellEditing({ onCellEdit: () => {} } as never),
      editHistory(),
    ] as never,
  })
  historyApi = table as never
  return (
    <div style={{ width: 600, height: 300 }}>
      <DataGrid table={table as never} height={260} />
    </div>
  )
}

describe('Вариант кнопки по месту (ADR 0097, §4а)', () => {
  /** Поповеры таблицы из истории «Поповеры таблицы». */
  const POPUP_IDS = [
    'columnMenu',
    'inlineMenu',
    'filterText',
    'operatorSelect',
    'filterOptions',
    'filterDate',
    'view',
    'contextMenu',
    'handleMenu',
    'columns',
    'export',
    'pageSize',
    'dateEdit',
    'optionEdit',
    'cellIssue',
    'failureLog',
    'unsavedChanges',
    'editHistory',
  ]
  /** Кнопка, которую поповер показывает, когда его содержимое пришло: её ждём перед проверкой. */
  const EXPECTED: Record<string, string> = {
    filterText: '[data-testid="filter-reset"]',
    filterOptions: '[data-testid="filter-select-all"]',
    filterDate: '[data-testid="filter-reset"]',
    export: '[data-testid="export-run"]',
    dateEdit: '[data-testid="edit-clear-value"]',
    optionEdit: '[data-testid="edit-clear-value"]',
    failureLog: '[data-action="clear-all"]',
    unsavedChanges: '[data-action="apply-all"]',
  }
  /** Поповеры верхнего уровня: вложенные списки — внутри своих. */
  const topPopups = () =>
    [...document.querySelectorAll<HTMLElement>('[data-side]')].filter(
      popup =>
        popup.getBoundingClientRect().height > 0 &&
        !popup.parentElement?.closest('[data-side]'),
    )
  /** Кнопки с подписью — база кита `Button`. */
  const textButtons = (root: ParentNode) => [
    ...root.querySelectorAll<HTMLElement>('.data-grid__button[data-variant]'),
  ]
  /** Поповер и его кнопки перестали меняться: ленивые панели пришли. */
  const settled = async () => {
    let last = ''
    let same = 0
    await expect
      .poll(
        () => {
          const now = topPopups()
            .map(
              popup =>
                `${popup.textContent?.length}:${textButtons(popup).length}`,
            )
            .join('|')
          same = now !== '' && now === last ? same + 1 : 0
          last = now
          return same
        },
        { interval: 250, timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(3)
  }
  const verdict = (popup: HTMLElement) => {
    const buttons = textButtons(popup)
    const outlines = buttons.filter(
      button => button.dataset.variant === 'outline',
    )
    return {
      buttons: buttons.map(
        button => `${button.textContent?.trim()}:${button.dataset.variant}`,
      ),
      // Рамка — у одного главного действия и только рядом с другим действием.
      ok:
        outlines.length === 0 || (outlines.length === 1 && buttons.length > 1),
    }
  }

  test('BN12: кнопки с подписью в поповерах — ghost; outline — только у главного действия, когда кнопок действий в поповере несколько; одно действие — ghost', async () => {
    let seen = 0
    let outlined = 0
    for (const id of POPUP_IDS) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await opened(id)
      try {
        if (EXPECTED[id])
          // eslint-disable-next-line no-await-in-loop
          await expect
            .poll(() => document.querySelector('[data-side] ' + EXPECTED[id]), {
              timeout: 10_000,
              message: id,
            })
            .not.toBeNull()
        // eslint-disable-next-line no-await-in-loop
        await settled()
        for (const popup of topPopups()) {
          const { buttons, ok } = verdict(popup)
          seen += buttons.length
          outlined += buttons.filter(b => b.endsWith(':outline')).length
          expect(ok, `${id}: ${buttons.join(', ')}`).toBe(true)
        }
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await screen.unmount()
      }
    }
    // Проверка не пустая: кнопки нашлись, главное действие пары — с рамкой («Apply all»).
    expect(seen).toBeGreaterThan(5)
    expect(outlined).toBeGreaterThan(0)

    // История с правкой: «К исходному виду» — одно действие, без рамки.
    const history = await render(<HistoryHost />)
    try {
      await expect.poll(() => historyApi).toBeTruthy()
      await historyApi!.writeCells(
        [{ rowId: 'r1', columnId: 'name', value: 'Changed' }],
        {
          source: 'paste',
        },
      )
      const button = () =>
        document.querySelector<HTMLElement>(
          '[data-testid="edit-history-button"]',
        )
      await expect.poll(button).not.toBeNull()
      await userEvent.click(button()!)
      const original = () =>
        document.querySelector<HTMLElement>(
          '[data-side] [data-action="back-to-original"]',
        )
      await expect.poll(original).not.toBeNull()
      expect(original()!.dataset.variant).toBe('ghost')
    } finally {
      await history.unmount()
    }

    // Поповер отметки с одним главным действием — без рамки; с двумя — рамка у главного.
    for (const actions of [
      [{ id: 'retry', label: 'Retry', primary: true, onSelect: () => {} }],
      [
        {
          id: 'discard',
          label: 'Discard',
          tone: 'danger' as const,
          onSelect: () => {},
        },
        { id: 'retry', label: 'Retry', primary: true, onSelect: () => {} },
      ],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await render(
        <UiCanvas>
          <CellIssue
            reason="The server refused the value"
            label="Save failed"
            actions={actions}
          />
        </UiCanvas>,
      )
      try {
        // eslint-disable-next-line no-await-in-loop
        await userEvent.click(
          document.querySelector<HTMLElement>('[data-cell-issue]')!,
        )
        const retry = () =>
          document.querySelector<HTMLElement>(
            '[data-side] [data-action="retry"]',
          )
        // eslint-disable-next-line no-await-in-loop
        await expect.poll(retry).not.toBeNull()
        expect(retry()!.dataset.variant, `${actions.length} действий`).toBe(
          actions.length > 1 ? 'outline' : 'ghost',
        )
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await screen.unmount()
      }
    }
  }, 180_000)
})
