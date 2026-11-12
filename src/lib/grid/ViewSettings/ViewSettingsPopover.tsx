/**
 * Поповер «Настроек вида» (ADR 0215, §3): первый уровень — строка на раздел с коротким значением; раздел —
 * строка «назад» и уровни простого раздела или своя панель плагина. Снятие и сброс — функции
 * раздела: пути плагина с каналом действий и серверным действием.
 */
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { Popover } from '@base-ui/react/popover'

import { sourceOf } from '../../core/debugActions'
import { type TableLabels, useLocalization } from '../../core/localization'
import {
  type ViewSettingsPanel,
  type ViewSettingsSection,
  shownViewSettingsSections,
} from '../../core/viewSettings'
import type { Table } from '../../types'
import { Bubble } from '../../ui/Bubble/Bubble'
import { Button } from '../../ui/Button'
import { type TableIcons, useIcons } from '../../ui/icons'
import { LoadErrorBlock } from '../../ui/LoadMoreError/LoadMoreError'
import { ItemButton } from '../../ui/Popup/ItemButton'
import { PopupEntry } from '../../ui/Popup/PopupEntry'
import { PopupNavItem } from '../../ui/Popup/PopupNavItem'
import { PopupPanel } from '../../ui/Popup/PopupPanel'
import { PopupSkeletonRows } from '../../ui/Popup/PopupSkeletonRows'
import {
  PopupLevelBack,
  PopupLevels,
  usePopupLevels,
} from '../../ui/Popup/PopupLevels'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { useScrollFade } from '../../ui/Popup/useScrollFade'
import { StatusIcon } from '../../ui/StatusIcon/StatusIcon'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { Tooltip } from '../../ui/Tooltip'

import styles from './ViewSettings.module.css'

interface ViewSettingsPopoverProps {
  table: Table<any, any>
  label: string
  icon: ReactNode
  count: number
  open: boolean
  onOpenChange: (open: boolean, details?: unknown) => void
}

const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** Раздел открывается: своя панель — всегда, простой — когда у него есть уровни. */
const openable = (section: ViewSettingsSection, table: unknown) =>
  !!section.panel || (!!section.levels && section.active(table))

const SectionIcon = ({ name }: { name: string }) => {
  const Icon = useIcons()[name as keyof TableIcons]
  return Icon ? <Icon width={16} height={16} /> : null
}

const SectionRow = ({
  section,
  table,
  labels,
  onOpen,
}: {
  section: ViewSettingsSection
  table: unknown
  labels: TableLabels
  onOpen: () => void
}) => {
  const canOpen = openable(section, table)
  const name = section.label(labels)
  const value = section.value(table, labels)
  const full = section.description?.(table, labels) ?? value
  const descriptionId = useId()
  return (
    <PopupNavItem
      icon={<SectionIcon name={section.icon} />}
      label={name}
      value={value}
      disabled={!canOpen}
      // Имя — видимый текст строки; полное значение — описанием (VW4).
      aria-describedby={descriptionId}
      data-view-settings-section={section.id}
      data-active={section.active(table) || undefined}
      onClick={onOpen}
    >
      <span id={descriptionId} hidden>
        {labels.viewSettingsSectionName(name, full)}
      </span>
    </PopupNavItem>
  )
}

const SectionLevels = ({
  section,
  table,
  labels,
  onRemove,
}: {
  section: ViewSettingsSection
  table: unknown
  labels: TableLabels
  onRemove: (index: number, count: number) => void
}) => {
  const { clear: ClearIcon, hideColumn: HiddenIcon } = useIcons()
  const listRef = useScrollFade<HTMLUListElement>()
  const levels = section.levels?.(table, labels) ?? []
  return (
    <ul ref={listRef} className={styles.levels} data-popup-scroller="">
      {levels.map((level, index) => (
        <li
          key={level.id}
          data-view-settings-level={level.id}
          data-hidden-column={level.hidden || undefined}
        >
          <PopupEntry
            fit
            mark={<Bubble size="dot" tone="active" />}
            label={
              level.hidden ? (
                <span className={styles.levelLabel}>
                  <span className={styles.levelName}>{level.label}</span>
                  {/* Колонка уровня скрыта — значок у её имени (ADR 0215, §3). */}
                  <StatusIcon
                    tone="neutral"
                    reason={labels.viewSettingsHiddenColumn}
                    icon={<HiddenIcon width={14} height={14} aria-hidden />}
                    data-testid="view-settings-hidden"
                  />
                </span>
              ) : (
                level.label
              )
            }
            actions={
              <ItemButton
                label={level.removeLabel}
                onClick={event => {
                  onRemove(index, levels.length)
                  level.remove(sourceOf(event))
                }}
                data-view-settings-remove=""
                data-testid="view-settings-remove"
              >
                <ClearIcon />
              </ItemButton>
            }
          >
            {level.description !== undefined && (
              <Tooltip title={level.description} overflowOnly>
                <span
                  className={styles.description}
                  data-view-settings-description=""
                >
                  {capitalized(level.description)}
                </span>
              </Tooltip>
            )}
          </PopupEntry>
        </li>
      ))}
    </ul>
  )
}

const PANEL_SKELETON_ROWS = 4

/**
 * Своя панель раздела: строки-скелеты, пока модуль грузится; не загрузился — блок ошибки кита с
 * повтором на их месте, как отказ списка вариантов (ADR 0215, VW17).
 */
const SectionPanel = ({
  panel,
  table,
  name,
  labels,
}: {
  panel: ViewSettingsPanel
  table: unknown
  name: string
  labels: TableLabels
}) => {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    // Повтор уже начал загрузку заново (`reload` в нажатии): эффект подписывается на неё.
    panel.load().then(undefined, () => {
      if (alive) setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [panel, attempt])
  if (failed)
    return (
      <div className={styles.panelError} role="alert">
        <LoadErrorBlock
          title={labels.loadFailed(name)}
          retryLabel={labels.loadMoreRetry}
          onRetry={() => {
            void panel.reload().catch(() => {})
            setFailed(false)
            setAttempt(count => count + 1)
          }}
          testId="view-settings-panel-retry"
        />
      </div>
    )
  return (
    <panel.Component
      table={table}
      fallback={<PopupSkeletonRows count={PANEL_SKELETON_ROWS} />}
    />
  )
}

export const ViewSettingsPopover = ({
  table,
  label,
  icon,
  count,
  open,
  onOpenChange,
}: ViewSettingsPopoverProps) => {
  const labels = useLocalization()
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Переход между уровнями — сдвигом, как разделы меню (ADR 0079; ADR 0215, §3).
  const levels = usePopupLevels()
  const { levelRef } = levels
  const [sectionId, setSectionId] = useState<string | undefined>(undefined)
  // Куда поставить фокус после смены уровня или снятия (VW7).
  const focusAfter = useRef<
    | { kind: 'section' }
    | { kind: 'row'; id: string }
    | { kind: 'removed'; index: number }
    | undefined
  >(undefined)

  const sections = shownViewSettingsSections(table)
  const current = sections.find(section => section.id === sectionId)
  // Простой раздел опустел — первый уровень, фокус на строке раздела.
  const shown =
    current && (current.panel || current.active(table)) ? current : undefined

  useLayoutEffect(() => {
    const target = focusAfter.current
    // Только текущий уровень: снимок уходящего — на своём слое.
    const popup = levelRef.current
    if (!target || !popup) return
    focusAfter.current = undefined
    if (target.kind === 'row') {
      popup
        .querySelector<HTMLElement>(
          `[data-view-settings-section="${target.id}"]`,
        )
        ?.focus()
      return
    }
    if (target.kind === 'removed' && !shown && sectionId) {
      popup
        .querySelector<HTMLElement>(
          `[data-view-settings-section="${sectionId}"]`,
        )
        ?.focus()
      return
    }
    if (target.kind === 'removed') {
      if (popup.contains(document.activeElement)) return
      const removes = popup.querySelectorAll<HTMLElement>(
        '[data-view-settings-remove]',
      )
      ;(
        removes[Math.min(target.index, removes.length - 1)] ??
        popup.querySelector<HTMLElement>('[data-view-settings-reset]') ??
        popup.querySelector<HTMLElement>('[data-popup-level-back]')
      )?.focus()
      return
    }
    // Вход в раздел: на первый элемент; своя панель ставит фокус сама.
    if (shown?.panel) return
    ;(
      popup.querySelector<HTMLElement>('[data-view-settings-remove]') ??
      popup.querySelector<HTMLElement>('[data-popup-level-back]')
    )?.focus()
  })

  const enter = (id: string) => {
    focusAfter.current = { kind: 'section' }
    levels.go('forward')
    setSectionId(id)
  }
  const back = () => {
    if (sectionId) focusAfter.current = { kind: 'row', id: sectionId }
    levels.go('back')
    setSectionId(undefined)
  }

  const reset = shown?.reset
  const level = shown ? (
    <PopupPanel
      className={styles.panel}
      footer={
        reset && !shown.panel ? (
          <Button
            variant="ghost"
            onClick={event => {
              focusAfter.current = { kind: 'removed', index: 0 }
              levels.go('back')
              reset.run(table, sourceOf(event))
            }}
            data-view-settings-reset=""
            data-testid="view-settings-reset"
          >
            {reset.label(labels)}
          </Button>
        ) : undefined
      }
    >
      <PopupLevelBack
        label={shown.label(labels)}
        ariaLabel={labels.menuBack(shown.label(labels))}
        onClick={back}
      />
      <div className={styles.section} data-view-settings-open={shown.id}>
        {shown.panel ? (
          <SectionPanel
            panel={shown.panel}
            table={table}
            name={shown.label(labels)}
            labels={labels}
          />
        ) : (
          <SectionLevels
            section={shown}
            table={table}
            labels={labels}
            onRemove={(index, count) => {
              focusAfter.current = { kind: 'removed', index }
              // Последний уровень снят — раздел пуст, назад на первый уровень.
              if (count === 1) levels.go('back')
            }}
          />
        )}
      </div>
    </PopupPanel>
  ) : (
    <PopupPanel title={labels.viewSettings} className={styles.panel}>
      <div className={styles.rows} data-view-settings-sections="">
        {sections.map(section => (
          <SectionRow
            key={section.id}
            section={section}
            table={table}
            labels={labels}
            onOpen={() => enter(section.id)}
          />
        ))}
      </div>
    </PopupPanel>
  )

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) setSectionId(undefined)
        onOpenChange(next, details)
      }}
    >
      <ToolbarButton
        ref={triggerRef}
        label={label}
        icon={icon}
        active={count > 0}
        count={count}
        data-testid="view-settings-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={labels.viewSettings}
              finalFocus={triggerRef}
              data-testid="view-settings-popover"
            />
          }
          className={styles.popup}
        >
          <PopupLevels levels={levels} levelKey={shown?.id ?? 'sections'}>
            {level}
          </PopupLevels>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
