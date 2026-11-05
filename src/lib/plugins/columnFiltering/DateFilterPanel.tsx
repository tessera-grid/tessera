/**
 * Панель фильтра даты (ADR 0047, §5): условие, пресеты, общий календарь (`shared/calendar`)
 * в поясе `timeZone` и на языке `dateLocale` таблицы, поле времени у `datetime`. Выбор дня, диапазона, пресета и
 * условия применяется сразу, ввод времени — через `debounceMs`. Модуль ленивый.
 */
import { useEffect, useId, useRef } from 'react'

import { RadioGroup } from '@base-ui/react/radio-group'

import { PopupPanel } from '../../ui/Popup/PopupPanel'
import { Radio } from '../../ui/Radio/Radio'
import { PopupItem } from '../../ui/Popup/PopupItem'
import { commonOptionsOf } from '../../core/commonFeature'
import { setColumnFilterByUser } from '../../shared/filtering/filtering'
import { useLocalization } from '../../core/localization'
import { useDebouncedCallback } from '../../util/useDebouncedCallback'
import { Button } from '../../ui/Button'
import { calendarLabels, timeFieldLabels } from '../../shared/calendar/labels'
import { Calendar, TimeField } from '../../ui/Calendar/Calendar'
import { operatorLabel, PRESET_LABEL } from './describeFilter'
import type { FilterPanelProps } from './FilterPanel'
import { OperatorSelect } from './OperatorSelect'
import type {
  ColumnFilterValue,
  DateFilter,
  DateFilterOperator,
  DateFilterPreset,
} from '../columnFilteringModel/types'

import panelStyles from './FilterPanel.module.css'
import { FilterFailure } from './FilterFailure'
import { FilterApply } from './FilterApply'
import { useFilterDraft } from './filterDraft'
import { columnFilteringLabels } from './labels'

const OPERATORS: DateFilterOperator[] = [
  'on',
  'before',
  'after',
  'between',
  'preset',
  'empty',
  'notEmpty',
]

const PRESETS: DateFilterPreset[] = [
  'today',
  'yesterday',
  'last7Days',
  'last30Days',
  'thisMonth',
  'thisYear',
]

interface Draft {
  operator: DateFilterOperator
  /** Дни — `'YYYY-MM-DD'`, время — `'HH:mm'` или `''`. */
  day: string | null
  time: string
  from: string | null
  fromTime: string
  to: string | null
  toTime: string
  preset: DateFilterPreset | null
}

const EMPTY_DRAFT: Draft = {
  operator: 'on',
  day: null,
  time: '',
  from: null,
  fromTime: '',
  to: null,
  toTime: '',
  preset: null,
}

const splitValue = (value: string | null | undefined) => {
  if (!value) return { day: null, time: '' }
  const [day, time = ''] = value.split('T')
  return { day, time: time.slice(0, 5) }
}

const draftOf = (current: DateFilter | undefined): Draft => {
  if (!current) return EMPTY_DRAFT
  const draft = { ...EMPTY_DRAFT, operator: current.operator }
  if (current.operator === 'preset') return { ...draft, preset: current.value }
  if (current.operator === 'between') {
    const from = splitValue(current.value[0])
    const to = splitValue(current.value[1])
    return {
      ...draft,
      from: from.day,
      fromTime: from.time,
      to: to.day,
      toTime: to.time,
    }
  }
  if ('value' in current) {
    const { day, time } = splitValue(current.value)
    return { ...draft, day, time }
  }
  return draft
}

const withTime = (day: string, time: string, timed: boolean) =>
  timed && time ? `${day}T${time}` : day

const filterOf = (
  draft: Draft,
  timed: boolean,
): ColumnFilterValue | undefined => {
  switch (draft.operator) {
    case 'empty':
    case 'notEmpty':
      return { operator: draft.operator }
    case 'preset':
      return draft.preset
        ? { operator: 'preset', value: draft.preset }
        : undefined
    case 'on':
      return draft.day ? { operator: 'on', value: draft.day } : undefined
    case 'before':
    case 'after':
      return draft.day
        ? {
            operator: draft.operator,
            value: withTime(draft.day, draft.time, timed),
          }
        : undefined
    case 'between':
      return draft.from || draft.to
        ? {
            operator: 'between',
            value: [
              draft.from && withTime(draft.from, draft.fromTime, timed),
              draft.to && withTime(draft.to, draft.toTime, timed),
            ],
          }
        : undefined
  }
}

const needsCalendar = (operator: DateFilterOperator) =>
  operator === 'on' ||
  operator === 'before' ||
  operator === 'after' ||
  operator === 'between'

/** Смена условия переносит выбранный день: день ↔ диапазон из одного дня. */
const switchOperator = (
  draft: Draft,
  operator: DateFilterOperator,
): Partial<Draft> => {
  if (operator === 'between' && draft.operator !== 'between' && draft.day) {
    return { operator, from: draft.day, to: draft.day }
  }
  if (draft.operator === 'between' && needsCalendar(operator) && draft.from) {
    return { operator, day: draft.from }
  }
  return { operator }
}

export const DateFilterPanel = ({
  table,
  column,
  debounceMs,
  type,
}: FilterPanelProps & { type: 'date' | 'datetime' }) => {
  const labels = useLocalization()
  const presetsId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const { timeZone, dateLocale: locale } = commonOptionsOf(table)
  const timed = type === 'datetime'
  const filterDraft = useFilterDraft({
    table,
    columnId: column.id,
    current: column.getFilterValue(),
    draftOf: current => draftOf(current as DateFilter | undefined),
    filterOf: next => filterOf(next, timed) as ColumnFilterValue | undefined,
  })
  const { draft, setDraft, server } = filterDraft

  const apply = useDebouncedCallback((next: Draft) => {
    setColumnFilterByUser(table, column.id, filterOf(next, timed))
  }, debounceMs)

  const update = (patch: Partial<Draft>, immediate = true) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    // На сервере условие уходит кнопкой «Применить» (ADR 0154).
    if (server) return
    apply.schedule(next)
    if (immediate) apply.flush()
  }

  const reset = () => {
    apply.cancel()
    setColumnFilterByUser(table, column.id, undefined)
    setDraft(EMPTY_DRAFT)
    filterDraft.forget()
  }

  // Модуль ленивый: к открытию поповера панели ещё нет, фокус ставится после загрузки.
  useEffect(() => {
    const root = rootRef.current
    if (!root || root.contains(document.activeElement)) return
    const target =
      root.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]') ??
      root.querySelector<HTMLElement>('[data-testid="filter-operator"]')
    target?.focus()
  }, [])

  const calendarProps = {
    labels: calendarLabels(labels),
    timeZone,
    locale,
    testId: 'filter-calendar',
  }

  const timeField = (
    key: 'time' | 'fromTime' | 'toTime',
    label: string,
    testId: string,
  ) => (
    <TimeField
      label={label}
      labels={timeFieldLabels(labels)}
      locale={locale?.code}
      value={draft[key]}
      onChange={value => update({ [key]: value }, false)}
      onKeyDown={event => {
        // Enter отправляет условие, как «Применить» (ADR 0154).
        if (server && event.key === 'Enter' && filterDraft.dirty) {
          event.preventDefault()
          filterDraft.commit()
        }
      }}
      testId={testId}
    />
  )

  return (
    <PopupPanel
      ref={rootRef}
      data-testid="filter-panel"
      data-filter-type={type}
      footer={
        <>
          <FilterFailure table={table} columnId={column.id} />
          <Button variant="ghost" onClick={reset} data-testid="filter-reset">
            {columnFilteringLabels(labels).filterReset}
          </Button>
          {server && <FilterApply {...filterDraft} />}
        </>
      }
    >
      <div className={panelStyles.content}>
        <OperatorSelect
          value={draft.operator}
          operators={OPERATORS}
          labelOf={operator => operatorLabel(operator, labels)}
          onChange={operator => update(switchOperator(draft, operator))}
        />
        {draft.operator === 'preset' && (
          <>
            <span id={presetsId} hidden>
              {columnFilteringLabels(labels).filterPreset}
            </span>
            <RadioGroup
              value={draft.preset ?? ''}
              onValueChange={value =>
                update({ preset: value as DateFilterPreset })
              }
              aria-labelledby={presetsId}
              className={panelStyles.options}
              data-testid="filter-presets"
            >
              {PRESETS.map(preset => (
                <PopupItem key={preset} render={<label />}>
                  <Radio value={preset} data-value={preset} />
                  <span>
                    {
                      columnFilteringLabels(labels)[
                        PRESET_LABEL[preset]
                      ] as string
                    }
                  </span>
                </PopupItem>
              ))}
            </RadioGroup>
          </>
        )}
        {draft.operator === 'between' ? (
          <Calendar
            {...calendarProps}
            mode="range"
            from={draft.from}
            to={draft.to}
            onRange={(from, to) => update({ from, to })}
          />
        ) : (
          needsCalendar(draft.operator) && (
            <Calendar
              {...calendarProps}
              mode="single"
              day={draft.day}
              onDay={day => update({ day })}
            />
          )
        )}
        {timed &&
          (draft.operator === 'before' || draft.operator === 'after') &&
          timeField(
            'time',
            columnFilteringLabels(labels).filterTime,
            'filter-time',
          )}
        {timed && draft.operator === 'between' && (
          <div className={panelStyles.range}>
            {timeField(
              'fromTime',
              columnFilteringLabels(labels).filterTimeFrom,
              'filter-time-from',
            )}
            {timeField(
              'toTime',
              columnFilteringLabels(labels).filterTimeTo,
              'filter-time-to',
            )}
          </div>
        )}
      </div>
    </PopupPanel>
  )
}
