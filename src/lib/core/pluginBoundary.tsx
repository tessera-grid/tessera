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

const guardTemplate = (template: Template, pluginId: string): Template =>
  typeof template !== 'function'
    ? template
    : (ctx: { table: unknown }) => (
        <PluginErrorBoundary pluginId={pluginId} table={ctx.table}>
          {createElement(template as ComponentType<object>, ctx)}
        </PluginErrorBoundary>
      )

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
