import { OnChangeFn } from '@tanstack/react-table'

export interface FieldType {
  id: string
  name: 'id' | 'name' | 'description' | 'price'
  label: string
  width: number
  type: string
}

export interface ItemType {
  id: string
  name: string
  description: string
  price: number
}

export interface MyTableState {
  hiddenCells: Record<string, boolean>
}

export interface MyTableOptions {
  onChangeHiddenCells: OnChangeFn<MyTableState['hiddenCells']>
}

export interface MyTableHooks {
  rowDownloadAction: { onDownload: (fileId: string) => void }
}
