/**
 * Нейтральные заглушки для демо-историй: кнопки — нативные `<button>`,
 * переключатель догфудит библиотечный `Switch`, иконки — lucide. Оформление
 * берёт цвета из токенов темы.
 */
import { ChangeEvent, CSSProperties, ReactNode, useId } from 'react'

import { Download, Lock, SquarePen, Trash2 } from 'lucide-react'

import { Switch as LibSwitch } from '../../ui/Switch'
import notFoundSvg from '../../../../assets/404.svg?raw'

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

/**
 * Цвет картинки — доля текста грида на его фоне по светлоте исходного цвета: тёмные
 * детали темнее в светлой теме и светлее в тёмной. Исходные цвета почти белые, поэтому
 * шкала растянута, а белое чуть отходит от фона.
 */
const toThemeColor = (hex: string) => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const lightness = (Math.max(...channels) + Math.min(...channels)) / 2 / 255
  const share = Math.min(100, Math.round(8 + (1 - lightness) * 200))
  return `color-mix(in oklab, var(--tsr-comp-control-color) ${share}%, var(--tsr-comp-bg))`
}

const notFoundViewBox = /viewBox="([^"]+)"/.exec(notFoundSvg)![1]
const notFoundMarkup = notFoundSvg
  .replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')
  .replace(
    /(fill|stroke|stop-color)="(#[0-9a-f]{6})"/gi,
    (_, property: string, hex: string) =>
      `style="${property}: ${toThemeColor(hex)}"`,
  )

export const NoDataStub = ({ label }: { label: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'calc(var(--tsr-ref-space-1) * 2)',
      boxSizing: 'border-box',
      height: '100%',
      // Отступы — как у заглушек библиотеки (FilterStub, LoadErrorStub).
      padding: 'calc(var(--tsr-ref-space-4) * 2) var(--tsr-ref-space-4)',
      overflow: 'hidden',
      textAlign: 'center',
      // Токен текста грида: повышенный контраст поднимает его до 7:1 (ADR 0088).
      color: 'var(--tsr-comp-control-color)',
    }}
  >
    {/* Сжимается в низком и узком гриде, чтобы подпись оставалась видна. */}
    <svg
      viewBox={notFoundViewBox}
      width={160}
      height={160}
      aria-hidden
      style={{ minHeight: 0, maxWidth: '100%', flexShrink: 1 }}
      dangerouslySetInnerHTML={{ __html: notFoundMarkup }}
    />
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
