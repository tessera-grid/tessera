/**
 * Нейтральные заглушки для демо-историй: кнопки — нативные `<button>`,
 * переключатель догфудит библиотечный `Switch`, иконки — lucide. Оформление
 * берёт цвета из токенов темы (--card / --border / --muted-foreground / --radius).
 */
import { ChangeEvent, CSSProperties, ReactNode, useId } from 'react'

import { Download, Lock, SquarePen, Trash2 } from 'lucide-react'

import { Switch as LibSwitch } from '../../ui/Switch'

/* ---------- Layout ---------- */

interface BoxProps {
  children?: ReactNode
  style?: CSSProperties
  className?: string
  // MUI-пропсы (container/item/xs/justify/...) принимаются и игнорируются
  [key: string]: unknown
}

const Div = ({ children, style, className }: BoxProps) => (
  <div className={className} style={style}>
    {children}
  </div>
)

export const Grid = Div
export const Card = ({ children, style, className }: BoxProps) => (
  <div
    className={className}
    style={{
      border: '1px solid var(--border)',
      padding: 16,
      borderRadius: 'var(--radius)',
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      ...style,
    }}
  >
    {children}
  </div>
)
export const CardContent = Div
export const Box = Div

/* ---------- Controls ---------- */

interface ButtonProps {
  children?: ReactNode
  disabled?: boolean
  onClick?: () => void
  [key: string]: unknown
}

export const Button = ({ children, disabled, onClick }: ButtonProps) => (
  <button type="button" disabled={disabled} onClick={onClick}>
    {children}
  </button>
)

export const Switch = ({
  checked,
  onChange,
}: {
  checked?: boolean
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}) => (
  <LibSwitch
    checked={checked}
    onCheckedChange={next =>
      onChange?.({
        target: { checked: next },
      } as unknown as ChangeEvent<HTMLInputElement>)
    }
  />
)

export const NoDataStub = ({ label }: { label: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'var(--muted-foreground)',
    }}
  >
    {label}
  </div>
)

/* ---------- Typography ---------- */

export const OverflowTypography = ({
  children,
}: {
  children?: ReactNode
  typographyProps?: unknown
}) => (
  <span
    style={{
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
)

/* ---------- Icons (lucide) ---------- */

type IconProps = {
  width?: number | string
  height?: number | string
  [key: string]: unknown
}

const ICON_BY_NAME: Record<string, (props: IconProps) => ReactNode> = {
  Lock,
  FileExport: Download,
}

export const Icon = ({
  iconName,
  size: _size,
  ...rest
}: { iconName: string; size?: string } & IconProps) => {
  const Cmp = ICON_BY_NAME[iconName] ?? SquarePen

  return <Cmp width={16} height={16} {...rest} />
}

export const DeleteIcon = (props: IconProps) => (
  <Trash2 width={16} height={16} {...props} />
)

export const EditTableColIcon = (props: IconProps) => (
  <SquarePen width={16} height={16} {...props} />
)

/* ---------- Storybook actions ---------- */

export const action =
  (name: string) =>
  (...args: unknown[]) =>
    // eslint-disable-next-line no-console
    console.log(name, ...args)

/* Утилита на случай нужды в стабильных id внутри демо */
export const useDemoId = useId
