/**
 * Изоляция падений рендера плагина (ADR 0037): компонент плагина рендерится внутри
 * границы, помеченной `id` плагина. Упавший компонент рисует `fallback`, ошибка уходит
 * в реестр таблицы; грид и соседние компоненты продолжают работать.
 */
import {
  Component,
  createElement,
  type ComponentType,
  type ReactNode,
} from 'react'

import type { ColumnDef } from '../types'

import { reportPluginError } from './pluginDiagnostics'

interface PluginErrorBoundaryProps {
  pluginId: string
  table: unknown
  /** Что рисовать вместо упавшего компонента; по умолчанию — ничего. */
  fallback?: ReactNode
  children?: ReactNode
}

export class PluginErrorBoundary extends Component<
  PluginErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    reportPluginError(this.props.table, this.props.pluginId, error)
  }

  render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children
  }
}

type Template = ColumnDef<any, any, any>['cell']

// Обёртка — тип компонента ячейки: новая на каждую пересборку колонок перемонтировала бы
// все служебные ячейки (PE7–PE8).
const guarded = new WeakMap<object, Map<string, Template>>()

const guardTemplate = (template: Template, pluginId: string): Template => {
  if (typeof template !== 'function') return template
  let byPlugin = guarded.get(template)
  if (!byPlugin) guarded.set(template, (byPlugin = new Map()))
  let wrapper = byPlugin.get(pluginId)
  if (!wrapper) {
    wrapper = (ctx: { table: unknown }) => (
      <PluginErrorBoundary pluginId={pluginId} table={ctx.table}>
        {createElement(template as ComponentType<object>, ctx)}
      </PluginErrorBoundary>
    )
    byPlugin.set(pluginId, wrapper)
  }
  return wrapper
}

/** Оборачивает `cell`/`header` сервисной колонки (и её вложенных колонок) в границу плагина. */
export const withPluginBoundary = (
  def: ColumnDef<any, any, any>,
  pluginId: string,
): ColumnDef<any, any, any> => {
  const nested = (def as { columns?: ColumnDef<any, any, any>[] }).columns
  return {
    ...def,
    ...(def.cell ? { cell: guardTemplate(def.cell, pluginId) } : {}),
    ...(def.header
      ? { header: guardTemplate(def.header as Template, pluginId) as never }
      : {}),
    ...(nested
      ? { columns: nested.map(column => withPluginBoundary(column, pluginId)) }
      : {}),
  } as ColumnDef<any, any, any>
}
