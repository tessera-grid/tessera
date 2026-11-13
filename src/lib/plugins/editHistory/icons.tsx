/** Иконки истории из переопределяемого набора `icons` (ADR 0222). */
import { useIcons } from '../../ui/icons'

export const UndoIcon = () => {
  const { undo: Icon } = useIcons()
  return <Icon width={16} height={16} />
}

export const RedoIcon = () => {
  const { redo: Icon } = useIcons()
  return <Icon width={16} height={16} />
}

export const HistoryIcon = () => {
  const { editHistory: Icon } = useIcons()
  return <Icon width={16} height={16} />
}
