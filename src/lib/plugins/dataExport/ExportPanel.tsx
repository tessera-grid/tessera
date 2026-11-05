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
import { Check } from 'lucide-react'

import { useLocalization } from '../../core/localization'
import type { Table } from '../../types'
import { Button } from '../../ui/Button'
import { type TableIcons, useIcons } from '../../ui/icons'
import { PopupGroup } from '../../ui/Popup/PopupGroup'
import { PopupItem, PopupItemMark } from '../../ui/Popup/PopupItem'
import { PopupFooter } from '../../ui/Popup/PopupPanel'
import { PopupSurface } from '../../ui/Popup/PopupSurface'
import { Segments } from '../../ui/Segments'
import type { ButtonStatesProps } from '../../ui/buttonStates'
import { ToolbarButton } from '../../ui/ToolbarButton'
import { rowLabel } from './rowLabel'
import {
  applyPreset,
  type Choice,
  type ExportAxes,
  exportConfigOf,
  exportsOnServer,
  resolveSettings,
  warnUnusablePresets,
  whereOf,
} from '../dataExportModel/settings'
import type { ExportSettings } from '../dataExportModel/types'

import styles from './ExportPanel.module.css'
import { useFinalFocus } from '../../ui/Popup/finalFocus'
import { dataExportLabels } from './labels'

export interface ExportPanelProps {
  table: Table<any, any>
  axes: ExportAxes
  busy: boolean
  /** Клиентская выгрузка асинхронным форматом: блик и блокировка кнопки. */
  pending: boolean
  /** Выгрузка отказала: дуга останавливается (ADR 0177, §2). */
  failed?: boolean
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
  /** Линия над группой — у всех, кроме первой. */
  divided: boolean
}

/** Ось «Формат» — сегментами: вариантов немного и подписи короткие (ADR 0074, EP1). */
const FormatGroup = ({
  label,
  choices,
  value,
  labelOf,
  onChange,
  divided,
}: GroupProps) => {
  const labelId = useId()
  return (
    <PopupGroup
      divided={divided}
      label={label}
      labelRender={<span id={labelId} />}
      data-testid="export-axis-format"
    >
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
    </PopupGroup>
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
  divided,
}: GroupProps & { iconOf: (value: string) => ReactNode; testId: string }) => {
  const labelId = useId()
  return (
    <PopupGroup
      divided={divided}
      label={label}
      labelRender={<span id={labelId} />}
      data-testid={testId}
    >
      <RadioGroup
        value={value}
        onValueChange={next => onChange(String(next))}
        aria-labelledby={labelId}
        className={styles.items}
      >
        {choices.map(choice => (
          <PopupItem
            key={choice.value}
            wrap
            render={
              <Radio.Root value={choice.value} disabled={choice.disabled} />
            }
            className={styles.item}
            data-value={choice.value}
            icon={iconOf(choice.value)}
            label={labelOf(choice.value)}
            end={
              <PopupItemMark>
                <Radio.Indicator className={styles.check} keepMounted>
                  <Check width={14} height={14} />
                </Radio.Indicator>
              </PopupItemMark>
            }
          />
        ))}
      </RadioGroup>
    </PopupGroup>
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
  failed,
  open,
  onOpenChange,
  onRun,
  cancel,
}: ExportPanelProps) => {
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
    !exportsOnServer(table) && table.options.partialData
      ? table.getCoreRowModel().rows.length
      : undefined

  const columnLabel = (value: string) =>
    value === 'all'
      ? dataExportLabels(labels).exportColumnsAll
      : dataExportLabels(labels).exportColumnsVisible
  const formatLabel = (value: string) =>
    config.formats.find(format => format.id === value)?.label ?? value

  warnUnusablePresets(table, axes, config.presets)
  const hasPresets = !!config.presets && config.presets.length > 0
  const hasFormat = axes.formats.length > 1

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <ToolbarButton
        ref={triggerRef}
        label={dataExportLabels(labels).export}
        icon={<DownloadIcon width={16} height={16} />}
        pending={pending}
        failed={failed}
        aria-busy={busy || undefined}
        {...cancel}
        data-testid="export-button"
        render={<Popover.Trigger />}
      />
      <Popover.Portal>
        <PopupSurface
          positioner={<Popover.Positioner side="bottom" align="end" />}
          popup={
            <Popover.Popup
              aria-label={dataExportLabels(labels).export}
              ref={popupRef}
              finalFocus={finalFocus}
              data-testid="export-panel"
            />
          }
          className={styles.popup}
        >
          {hasPresets && (
            <PopupGroup
              role="group"
              aria-label={dataExportLabels(labels).exportPresets}
              label={dataExportLabels(labels).exportPresets}
              labelRender={<span aria-hidden />}
            >
              {config.presets!.map(preset => (
                <PopupItem
                  key={preset.id}
                  wrap
                  render={<button type="button" />}
                  className={styles.item}
                  data-testid={`export-preset-${preset.id}`}
                  onClick={() => choose(applyPreset(axes, settings, preset))}
                  label={preset.label}
                />
              ))}
            </PopupGroup>
          )}
          {hasFormat && (
            <FormatGroup
              divided={hasPresets}
              label={dataExportLabels(labels).exportFormat}
              choices={axes.formats}
              value={settings.format}
              labelOf={formatLabel}
              onChange={format => choose({ ...settings, format })}
            />
          )}
          <AxisGroup
            divided={hasPresets || hasFormat}
            label={dataExportLabels(labels).exportRows}
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
            divided
            label={dataExportLabels(labels).exportColumns}
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
          <PopupFooter>
            <Button
              variant="ghost"
              disabled={busy && isServer}
              data-testid="export-run"
              onClick={() => {
                onRun(settings, isServer)
                onOpenChange(false)
              }}
            >
              {dataExportLabels(labels).exportRun}
            </Button>
          </PopupFooter>
        </PopupSurface>
      </Popover.Portal>
    </Popover.Root>
  )
}
