/**
 * Панель настроек экспорта на Base UI Popover (ADR 0044, §3, EX6–EX9; ADR 0074): быстрые
 * наборы, формат сегментами, оси пунктами меню и «Выгрузить». Грузится отдельным чанком; открытием управляет
 * эагерная кнопка. `Escape` и клик снаружи закрывают панель, фокус — на кнопку.
 */
import { reportAction, sourceOf } from '../../core/debugActions'
import { type ReactNode, useId, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import clsx from 'clsx'
import { Check } from 'lucide-react'

import { useLocalization } from '../../core/localization'
import { usePortalThemeData, usePortalThemeClass } from '../../ui/theme'
import type { Table } from '../../types'
import { Button } from '../../ui/Button'
import { type TableIcons, useIcons } from '../../ui/icons'
import { Segments } from '../../ui/Segments'
import type { ButtonStatesProps } from '../../ui/buttonStates'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { rowLabel } from './rowLabel'
import {
  applyPreset,
  type Choice,
  type ExportAxes,
  exportConfigOf,
  resolveSettings,
  warnUnusablePresets,
  whereOf,
} from '../dataExportModel/settings'
import type { ExportSettings } from '../dataExportModel/types'

import styles from './ExportPanel.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { useFinalFocus } from '../../ui/Popup/finalFocus'

export interface ExportPanelProps {
  table: Table<any, any>
  axes: ExportAxes
  busy: boolean
  /** Клиентская выгрузка асинхронным форматом: блик и блокировка кнопки. */
  pending: boolean
  /** Текст отметки отказа выгрузки (ADR 0136). */
  failure?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRun: (settings: ExportSettings, isServer: boolean) => void
  /** «Стоп» кнопки, пока выгрузка ждёт (ADR 0153). */
  cancel?: Pick<ButtonStatesProps, 'onCancel' | 'cancelLabel'>
}

interface GroupProps {
  label: string
  choices: Choice<string>[]
  value: string
  labelOf: (value: string) => ReactNode
  onChange: (value: string) => void
}

/** Ось «Формат» — сегментами: вариантов немного и подписи короткие (ADR 0074, EP1). */
const FormatGroup = ({
  label,
  choices,
  value,
  labelOf,
  onChange,
}: GroupProps) => {
  const labelId = useId()
  return (
    <div className={styles.group} data-testid="export-axis-format">
      <span id={labelId} className={styles.groupLabel}>
        {label}
      </span>
      <Segments
        value={value}
        options={choices.map(choice => ({
          value: choice.value,
          label: labelOf(choice.value),
          disabled: choice.disabled,
        }))}
        onValueChange={onChange}
        aria-labelledby={labelId}
        className={styles.segments}
      />
    </div>
  )
}

/**
 * Ось пунктами, как в меню действий: иконка, подпись, галочка справа (ADR 0074, EP2).
 * Логика — радиогруппа: выбран один, стрелки переводят выбор.
 */
const AxisGroup = ({
  label,
  choices,
  value,
  labelOf,
  iconOf,
  onChange,
  testId,
}: GroupProps & { iconOf: (value: string) => ReactNode; testId: string }) => {
  const labelId = useId()
  return (
    <div className={styles.group} data-testid={testId}>
      <span id={labelId} className={styles.groupLabel}>
        {label}
      </span>
      <RadioGroup
        value={value}
        onValueChange={next => onChange(String(next))}
        aria-labelledby={labelId}
        className={styles.items}
      >
        {choices.map(choice => (
          <Radio.Root
            key={choice.value}
            value={choice.value}
            disabled={choice.disabled}
            className={styles.item}
            data-value={choice.value}
          >
            <span className={styles.itemIcon} aria-hidden>
              {iconOf(choice.value)}
            </span>
            <span className={styles.itemLabel}>{labelOf(choice.value)}</span>
            <span className={styles.itemCheck} aria-hidden>
              <Radio.Indicator className={styles.check} keepMounted>
                <Check width={14} height={14} />
              </Radio.Indicator>
            </span>
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  )
}

const ROW_ICONS: Record<
  ExportSettings['rows'],
  (icons: TableIcons) => TableIcons[keyof TableIcons]
> = {
  all: icons => icons.exportRowsAll,
  view: icons => icons.exportRowsView,
  page: icons => icons.exportRowsPage,
  selected: icons => icons.exportRowsSelected,
}

export const ExportPanel = ({
  table,
  axes,
  busy,
  pending,
  failure,
  open,
  onOpenChange,
  onRun,
  cancel,
}: ExportPanelProps) => {
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const labels = useLocalization()
  const icons = useIcons()
  const DownloadIcon = icons.download
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { popupRef, finalFocus } = useFinalFocus(triggerRef)
  const config = exportConfigOf(table)!
  const [chosen, setChosen] = useState<Partial<ExportSettings>>({})

  // Выбор, ставший недоступным (снят выбор строк), заменяется первым доступным.
  const settings = resolveSettings(axes, chosen)
  if (!settings) return null

  const choose = (next: ExportSettings) => {
    reportAction(table, {
      plugin: 'dataExport',
      action: 'chooseSettings',
      detail: next,
      source: sourceOf(globalThis.event),
    })
    setChosen(next)
  }
  const isServer = whereOf(table, settings) === 'server'

  // Лента без серверной выгрузки: «все строки» — только загруженные (ADR 0081).
  const loaded =
    !config.server && (table.options as { partialData?: boolean }).partialData
      ? table.getCoreRowModel().rows.length
      : undefined

  const columnLabel = (value: string) =>
    value === 'all' ? labels.exportColumnsAll : labels.exportColumnsVisible
  const formatLabel = (value: string) =>
    config.formats.find(format => format.id === value)?.label ?? value

  warnUnusablePresets(table, axes, config.presets)

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={labels.export}
        icon={<DownloadIcon width={16} height={16} />}
        pending={pending}
        failure={failure}
        aria-busy={busy || undefined}
        {...cancel}
        data-testid="export-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, styles.positioner)}
          {...themeData}
        >
          <Popover.Popup
            aria-label={labels.export}
            ref={popupRef}
            finalFocus={finalFocus}
            className={clsx(themeClass, styles.popup)}
            data-testid="export-panel"
          >
            {config.presets && config.presets.length > 0 && (
              <div
                className={styles.group}
                role="group"
                aria-label={labels.exportPresets}
              >
                <span className={styles.groupLabel} aria-hidden>
                  {labels.exportPresets}
                </span>
                {config.presets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className={styles.item}
                    data-testid={`export-preset-${preset.id}`}
                    onClick={() => choose(applyPreset(axes, settings, preset))}
                  >
                    <span className={styles.itemLabel}>{preset.label}</span>
                  </button>
                ))}
              </div>
            )}
            {axes.formats.length > 1 && (
              <FormatGroup
                label={labels.exportFormat}
                choices={axes.formats}
                value={settings.format}
                labelOf={formatLabel}
                onChange={format => choose({ ...settings, format })}
              />
            )}
            <AxisGroup
              label={labels.exportRows}
              testId="export-axis-rows"
              choices={axes.rows}
              value={settings.rows}
              labelOf={value => rowLabel(labels, value, axes.viewBy, loaded)}
              iconOf={value => {
                const Icon = ROW_ICONS[value as ExportSettings['rows']](icons)
                return <Icon width={16} height={16} />
              }}
              onChange={rows =>
                choose({ ...settings, rows: rows as ExportSettings['rows'] })
              }
            />
            <AxisGroup
              label={labels.exportColumns}
              testId="export-axis-columns"
              choices={axes.columns}
              value={settings.columns}
              labelOf={columnLabel}
              iconOf={value => {
                const Icon =
                  value === 'all'
                    ? icons.exportColumnsAll
                    : icons.exportColumnsVisible
                return <Icon width={16} height={16} />
              }}
              onChange={columns =>
                choose({
                  ...settings,
                  columns: columns as ExportSettings['columns'],
                })
              }
            />
            <div className={styles.footer}>
              <Button
                variant="ghost"
                disabled={busy && isServer}
                data-testid="export-run"
                onClick={() => {
                  onRun(settings, isServer)
                  onOpenChange(false)
                }}
              >
                {labels.exportRun}
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
