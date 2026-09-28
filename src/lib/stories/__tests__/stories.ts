// Истории DataGrid как фикстуры тестов: все группы в одном объекте.
import { composeStories } from '@storybook/react-vite'

import * as cells from '../DataGrid.Cells.stories'
import * as columns from '../DataGrid.Columns.stories'
import * as rows from '../DataGrid.Rows.stories'
import * as general from '../DataGrid.stories'

export const composed = {
  ...composeStories(general),
  ...composeStories(columns),
  ...composeStories(rows),
  ...composeStories(cells),
}
