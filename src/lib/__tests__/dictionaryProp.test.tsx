/**
 * Точный тип пропа `localization` (ADR 0182, §9; AN21). Требование проверяет компилятор:
 * лишняя директива `@ts-expect-error` роняет `npm run typecheck`.
 * Запуск: npx vitest run --config vitest.node.config.ts dictionaryProp
 */
import { describe, expect, it } from 'vitest'

import { DataGrid } from '../grid/DataGrid'
import ru from '../stories/__mocks__/localization.ru.json'

const table = null as never

describe('Тип пропа localization', () => {
  it('AN21: проп localization отвергает при компиляции ключ, которого нет в типе словаря, и в литерале, и в значении с известным типом; словарь с произвольными ключами (Record<string, string>, any) проходит', () => {
    const prefixTypo = { ...ru, 'paginaton.pageRange': 'x' }
    const otherPrefix = { ...ru, 'paging.pageRange': 'x' }
    const keyTypo = { ...ru, 'pagination.pageRang': 'x' }
    const fetched: Record<string, string> = { 'paginaton.pageRange': 'x' }
    const parsed: unknown = JSON.parse('{}')

    const elements = [
      <DataGrid table={table} localization={ru} />,
      <DataGrid
        table={table}
        localization={{
          'pagination.pageRange': from => from.toFixed(0),
        }}
      />,
      <DataGrid table={table} localization={fetched} />,
      <DataGrid table={table} localization={parsed as any} />,
      // @ts-expect-error — опечатка в префиксе владельца
      <DataGrid table={table} localization={prefixTypo} />,
      // @ts-expect-error — совсем другой префикс
      <DataGrid table={table} localization={otherPrefix} />,
      // @ts-expect-error — опечатка в ключе владельца
      <DataGrid table={table} localization={keyTypo} />,
      // @ts-expect-error — опечатка в литерале
      <DataGrid table={table} localization={{ 'pagination.pageRang': 'x' }} />,
    ]
    expect(elements).toHaveLength(8)
  })
})
