/**
 * «Настройки вида» в тестах (ADR 0215): открыть кнопку, раздел и меню колонок настоящими нажатиями.
 * Части поповера — по `data-*`, общие с историями (`__mocks__/viewSettings`).
 */
import { expect } from 'vitest'
import { userEvent } from 'vitest/browser'

import {
  viewSettingsButton,
  viewSettingsLevel,
  viewSettingsPopover,
  viewSettingsRow,
  viewSettingsSectionOpen,
} from '../__mocks__/viewSettings'

export {
  viewSettingsButton,
  viewSettingsLevel,
  viewSettingsPopover,
  viewSettingsRow,
  viewSettingsSectionOpen,
}

type Click = (element: HTMLElement) => Promise<unknown>

interface OpenOptions {
  root?: ParentNode
  /** Нажатие: по умолчанию `userEvent.click`; где важен фокус — `humanClick`. */
  click?: Click
}

const defaultClick: Click = element => userEvent.click(element)

/** Кнопка «Настроек вида» — триггер Base UI: ленивый модуль поповера пришёл. */
export const viewSettingsReady = (root: ParentNode = document) =>
  !!viewSettingsButton(root)?.hasAttribute('data-base-ui-click-trigger')

/** Открыть «Настройки вида»; вернуть поповер. */
export const openSettings = async ({
  root = document,
  click = defaultClick,
}: OpenOptions = {}) => {
  await expect.poll(() => viewSettingsReady(root)).toBe(true)
  if (!viewSettingsPopover()) await click(viewSettingsButton(root)!)
  await expect.poll(viewSettingsPopover).not.toBeNull()
  return viewSettingsPopover()!
}

/** Открыть раздел «Настроек вида»; вернуть его уровень. */
export const openSettingsSection = async (
  id: string,
  options: OpenOptions = {},
) => {
  await openSettings(options)
  await expect.poll(() => viewSettingsRow(id)).not.toBeNull()
  await (options.click ?? defaultClick)(viewSettingsRow(id)!)
  await expect.poll(() => viewSettingsSectionOpen(id)).not.toBeNull()
  return viewSettingsSectionOpen(id)!
}

export const columnsMenu = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')

/** Открыть меню колонок — раздел «Колонки» «Настроек вида». */
export const openColumnsMenu = async (options: OpenOptions = {}) => {
  await openSettingsSection('columns', options)
  await expect.poll(columnsMenu).not.toBeNull()
  return columnsMenu()!
}

/** Поповер в DOM, в том числе закрывающийся: фокус на кнопку он вернёт в конце закрытия. */
export const viewSettingsMounted = () =>
  document.querySelector<HTMLElement>('[data-testid="view-settings-popover"]')

/** Закрыть «Настройки вида» клавишей Escape и дождаться конца закрытия. */
export const closeSettings = async () => {
  if (!viewSettingsMounted()) return
  await userEvent.keyboard('{Escape}')
  await expect.poll(viewSettingsMounted).toBeNull()
}
