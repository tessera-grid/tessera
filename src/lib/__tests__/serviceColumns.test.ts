/**
 * Служебные колонки по метке ядра (ADR 0165, SX1, SX2, SX4): метка и сведения колонки,
 * поля записи `ServiceColumn`, `pinSides` — поле колонки.
 * Запуск: npx vitest run --config vitest.node.config.ts serviceColumns
 */
import { describe, expect, it } from 'vitest'

import { ENGLISH_LABELS } from '../core/localization'
import {
  columnPinning,
  rowActions,
  rowDragging,
  rowExpanding,
  rowSelection,
} from '../plugins'
import { pinHeaderAction } from '../plugins/columnPinning'
import { hostTable } from './tableHost'

const NAME = { id: 'name', accessorKey: 'name', header: 'Name' }

describe('служебные колонки по метке ядра (ADR 0165)', () => {
  it('SX1: getIsActionsColumn и getServiceColumn опознают служебную колонку по метке ядра; колонка приложения с id, где есть actionColumn, — не служебная', () => {
    const table = hostTable({
      columns: [NAME, { id: 'myactionColumn', accessorKey: 'name' }],
      plugins: [rowSelection()],
    })
    const user = table.getColumn('myactionColumn')!
    expect(user.getIsActionsColumn()).toBe(false)
    expect(user.getServiceColumn()).toBeUndefined()
    const service = table.getAllLeafColumns().find(c => c.getIsActionsColumn())!
    expect(service.getServiceColumn()).toMatchObject({
      id: service.id,
      pluginId: 'rowSelection',
    })
  })

  it('SX2: подпись, ширину по кнопке и захват места колонка объявляет полями label, controlSized, fill записи ServiceColumn, getServiceColumn их отдаёт; serviceLabel, controlSized в описании и getIsRowActionsColumn нет', () => {
    const table = hostTable({
      columns: [NAME],
      plugins: [
        rowSelection(),
        rowExpanding({ column: 'always' }),
        rowDragging(),
        rowActions({ column: 'always' }),
      ],
    })
    const services = table
      .getAllLeafColumns()
      .filter(column => column.getIsActionsColumn())
    const info = Object.fromEntries(
      services.map(column => {
        const { pluginId, label, controlSized, fill } =
          column.getServiceColumn()!
        return [pluginId, { label, controlSized, fill }]
      }),
    )
    expect(info).toEqual({
      rowSelection: { label: undefined, controlSized: true, fill: undefined },
      rowExpanding: {
        label: 'expandColumn',
        controlSized: true,
        fill: undefined,
      },
      rowDragging: {
        label: 'reorderColumn',
        controlSized: undefined,
        fill: undefined,
      },
      rowActions: {
        label: 'rowActionsColumn',
        controlSized: undefined,
        fill: true,
      },
    })
    for (const column of services) {
      expect('getIsRowActionsColumn' in column).toBe(false)
      expect(Object.keys(column.columnDef)).not.toContain('serviceLabel')
      expect(Object.keys(column.columnDef)).not.toContain('controlSized')
    }
  })

  it('SX4: pinSides в описании колонки ограничивает стороны закрепления в меню и кнопке колонки; meta.pinSides не читается', () => {
    const table = hostTable({
      columns: [
        { ...NAME, pinSides: 'end' },
        { id: 'meta', accessorKey: 'name', meta: { pinSides: 'end' } },
        { id: 'both', accessorKey: 'name' },
      ],
      plugins: [columnPinning()],
    })
    const sidesOf = (id: string) => {
      const header = table
        .getHeaderGroups()[0]!
        .headers.find(item => item.column.id === id)!
      const ctx = header.getContext() as never
      return {
        menu: pinHeaderAction.menuItems!(ctx, ENGLISH_LABELS).map(
          item => item.id,
        ),
        inlineAsMenu: pinHeaderAction.inlineAsMenu!(ctx),
      }
    }
    expect(sidesOf('name')).toEqual({ menu: ['end'], inlineAsMenu: false })
    expect(sidesOf('meta')).toEqual(sidesOf('both'))
    expect(sidesOf('both')).toEqual({
      menu: ['start', 'end'],
      inlineAsMenu: true,
    })
  })
})
