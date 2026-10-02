/**
 * Панель настроек экспорта на Base UI Popover (ADR 0044, §3, EX6–EX9): быстрые наборы,
 * оси переключателей и «Выгрузить». Грузится отдельным чанком; открытием управляет
 * эагерная кнопка. `Escape` и клик снаружи закрывают панель, фокус — на кнопку.
 */
import { type ReactNode, useId, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import clsx from 'clsx'

import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import type { Table } from '../../types'
import { useIcons } from '../../ui/icons'
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
} from './settings'
import type { ExportSettings } from './types'

import styles from './ExportPanel.module.css'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'

export interface ExportPanelProps {
  table: Table<any, any>
  axes: ExportAxes
  busy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onRun: (settings: ExportSettings, isServer: boolean) => void
}

const AxisGroup = ({
  label,
  choices,
  value,
  labelOf,
  onChange,
  testId,
}: {
  label: string
  choices: Choice<string>[]
  value: string
  labelOf: (value: string) => ReactNode
  onChange: (value: string) => void
  testId: string
}) => {
  const labelId = useId()
  return (
    <div className={styles.axis} data-testid={testId}>
      <span id={labelId} className={styles.axisLabel}>
        {label}
      </span>
      <RadioGroup
        value={value}
        onValueChange={next => onChange(String(next))}
        aria-labelledby={labelId}
        className={styles.group}
      >
        {choices.map(choice => (
          <label
            key={choice.value}
            className={styles.option}
            data-disabled={choice.disabled || undefined}
          >
            <Radio.Root
              value={choice.value}
              disabled={choice.disabled}
              className={styles.radio}
              data-value={choice.value}
            >
              <Radio.Indicator className={styles.dot} />
            </Radio.Root>
            <span>{labelOf(choice.value)}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

export const ExportPanel = ({
  table,
  axes,
  busy,
  open,
  onOpenChange,
  onRun,
}: ExportPanelProps) => {
  const themeClass = usePortalThemeClass()
  const labels = useLocalization()
  const { download: DownloadIcon } = useIcons()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const config = exportConfigOf(table)!
  const [chosen, setChosen] = useState<Partial<ExportSettings>>({})

  // Выбор, ставший недоступным (снят выбор строк), заменяется первым доступным.
  const settings = resolveSettings(axes, chosen)
  if (!settings) return null

  const choose = (next: ExportSettings) => setChosen(next)
  const isServer = whereOf(table, settings) === 'server'

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
        icon={<DownloadIcon width={18} height={18} />}
        aria-busy={busy || undefined}
        data-testid="export-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={POPUP_SIDE_OFFSET}
          className={clsx(themeClass, styles.positioner)}
        >
          <Popover.Popup
            aria-label={labels.export}
            finalFocus={triggerRef}
            className={clsx(themeClass, styles.popup)}
            data-testid="export-panel"
          >
            {config.presets && config.presets.length > 0 && (
              <div className={styles.presets} aria-label={labels.exportPresets}>
                {config.presets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className={styles.preset}
                    data-testid={`export-preset-${preset.id}`}
                    onClick={() => choose(applyPreset(axes, settings, preset))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            <AxisGroup
              label={labels.exportRows}
              testId="export-axis-rows"
              choices={axes.rows}
              value={settings.rows}
              labelOf={value => rowLabel(labels, value, axes.viewBy)}
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
              onChange={columns =>
                choose({
                  ...settings,
                  columns: columns as ExportSettings['columns'],
                })
              }
            />
            {axes.formats.length > 1 && (
              <AxisGroup
                label={labels.exportFormat}
                testId="export-axis-format"
                choices={axes.formats}
                value={settings.format}
                labelOf={formatLabel}
                onChange={format => choose({ ...settings, format })}
              />
            )}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.run}
                disabled={busy && isServer}
                data-testid="export-run"
                onClick={() => {
                  onRun(settings, isServer)
                  onOpenChange(false)
                }}
              >
                {labels.exportRun}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
