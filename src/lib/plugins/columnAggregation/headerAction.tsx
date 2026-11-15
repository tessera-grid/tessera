/**
 * Пункт «Сводка» в кебабе заголовка (ADR 0230, §3): подсказка — текущая функция, шеврон открывает
 * вложенный список с отметкой текущей и «Без сводки» последним. Выбор не по умолчанию зажигает
 * точку на кебабе (ADR 0062).
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import type {
  HeaderAction,
  HeaderMenuItem,
  MenuAction,
} from '../../core/headerActions'
import { useIcons } from '../../ui/icons'
import { chooseAggregation } from './choose'
import { chosenAggregationOf } from './feature'
import {
  type AggregationColumn,
  canSummarize,
  currentNameOf,
  functionLabel,
  functionsOf,
} from './functions'
import { columnAggregationLabels } from './labels'

const SummaryIcon = () => {
  const { summary: Icon } = useIcons()
  return <Icon data-icon="summary" width={16} height={16} />
}

const columnOf = ({ column }: HeaderComponentProps) =>
  column as unknown as AggregationColumn

const NO_ICON = () => null

const cause = (ctx: HeaderComponentProps) => ({
  control: 'columnAggregation',
  columns: [ctx.column.id],
  menu: true,
})

export const summaryHeaderAction: HeaderAction = {
  id: 'columnAggregation',
  slot: 'rightHeaderSlot',
  placement: 'menu',
  visible: ctx =>
    ctx.column.columns.length === 0 && canSummarize(ctx.table, columnOf(ctx)),
  icon: () => <SummaryIcon />,
  label: labels => columnAggregationLabels(labels).summary,
  hint: (ctx, labels) => {
    const current = currentNameOf(ctx.table, columnOf(ctx))
    return current === null
      ? columnAggregationLabels(labels).noSummary
      : functionLabel(ctx.table, current, labels)
  },
  active: ctx => chosenAggregationOf(ctx.table, ctx.column.id) !== undefined,
  onSelect: () => {},
  submenu: (ctx, labels) => {
    const current = currentNameOf(ctx.table, columnOf(ctx))
    const set = (name: string | null) =>
      chooseAggregation(ctx.table, [ctx.column.id], name, 'pointer', cause(ctx))
    // Функции — одна группа, «Без сводки» — своя, последней.
    const items: MenuAction<HeaderComponentProps>[] = [
      {
        id: 'summaryFunctions',
        icon: NO_ICON,
        label: own => columnAggregationLabels(own).summary,
        onSelect: () => {},
        menuItems: (): HeaderMenuItem[] =>
          functionsOf(ctx.table, columnOf(ctx)).map(name => ({
            id: name,
            label: functionLabel(ctx.table, name, labels),
            active: current === name,
            onSelect: () => set(name),
          })),
      },
      {
        id: 'noSummary',
        icon: NO_ICON,
        label: own => columnAggregationLabels(own).noSummary,
        active: () => current === null,
        onSelect: () => set(null),
      },
    ]
    return { title: columnAggregationLabels(labels).summary, items }
  },
}
