import { SvgIcon, SvgIconProps } from './SvgIcon'

// The checked / indeterminate checkbox marks now come from lucide (Check /
// Minus) rendered inside a CSS-styled box. This in-house outline glyph remains
// only as the overridable `checkboxOutline` default and is unused by the
// built-in checkbox.

/** Чекбокс — пустой (переопределяемый дефолт `checkboxOutline`) */
export const CheckboxOutlineIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </SvgIcon>
)
