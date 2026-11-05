/**
 * Демо-сценарии истории в свёрнутом аккордеоне «Демо · N шагов»: панель не занимает
 * места, пока её не открыли. Внутри — пронумерованные карточки шагов: что сделать,
 * что увидеть и свои контролы. Вёрстка на токенах темы Storybook (--card / --border /
 * --muted…), без внешних UI-зависимостей.
 */
import {
  type ButtonHTMLAttributes,
  Children,
  createContext,
  type InputHTMLAttributes,
  isValidElement,
  type ReactNode,
  useContext,
  useId,
  useState,
} from 'react'

/** «1 шаг», «2 шага», «5 шагов». */
const steps = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'шаг'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'шага'
        : 'шагов'
  return `${count} ${word}`
}

const StepNumber = createContext(0)

/** Скругление рамки грида: `--tsr-sys-radius` → `--radius-md`. */
const RADIUS = 'var(--radius-md, 8px)'

export const DemoPanel = ({
  title = 'Демо',
  status,
  children,
}: {
  title?: string
  /**
   * Что ждёт ответа прямо сейчас (подтверждение и т. п.) — в строке заголовка, пока
   * аккордеон свёрнут; высота строки не меняется, таблица не прыгает.
   */
  status?: ReactNode
  children: ReactNode
}) => {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const items = Children.toArray(children).filter(isValidElement)
  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px 0',
        color: 'var(--foreground)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          minHeight: 28,
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(open => !open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            border: '1px solid var(--border)',
            // Скругление рамки грида (`--tsr-sys-radius`).
            borderRadius: RADIUS,
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : undefined,
            }}
          >
            ▸
          </span>
          <strong>{title}</strong>
          <span style={{ color: 'var(--muted-foreground)' }}>
            · {steps(items.length)}
          </span>
        </button>
        {!expanded && status}
      </div>
      {expanded && (
        <ol
          id={id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 8,
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {items.map((item, index) => (
            <StepNumber.Provider key={item.key ?? index} value={index + 1}>
              {item}
            </StepNumber.Provider>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Шаг: номер и заголовок, пояснение, контролы внизу карточки. */
export const DemoItem = ({
  title,
  hint,
  children,
}: {
  title: string
  hint: ReactNode
  children?: ReactNode
}) => {
  const number = useContext(StepNumber)
  return (
    <li
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: RADIUS,
        background: 'var(--card)',
        color: 'var(--card-foreground)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 20,
            height: 20,
            borderRadius: 999,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {number}
        </span>
        <strong>{title}</strong>
      </div>
      <span style={{ color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
        {hint}
      </span>
      {children && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          {children}
        </div>
      )}
    </li>
  )
}

/** Текст рядом с контролами шага (вопрос, состояние). */
export const DemoNote = ({ children }: { children: ReactNode }) => (
  <span style={{ fontWeight: 500 }}>{children}</span>
)

const control = {
  height: 28,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: RADIUS,
  background: 'var(--background)',
  color: 'var(--foreground)',
  font: 'inherit',
} as const

type Tone = 'default' | 'primary' | 'danger'

const TONES: Record<Tone, object> = {
  default: {},
  primary: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    borderColor: 'var(--primary)',
  },
  danger: {
    background: 'var(--destructive)',
    color: 'var(--primary-foreground)',
    borderColor: 'var(--destructive)',
  },
}

export const DemoButton = ({
  tone = 'default',
  pressed,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone
  /** Включённый переключатель: кнопка выглядит нажатой. */
  pressed?: boolean
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    style={{
      ...control,
      cursor: 'pointer',
      ...TONES[tone],
      ...(props.disabled && { opacity: 0.45, cursor: 'not-allowed' }),
      ...(pressed && {
        background: 'var(--muted)',
        boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 15%)',
      }),
      ...style,
    }}
    {...props}
  />
)

export const DemoInput = ({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input style={{ ...control, flex: 1, minWidth: 0, ...style }} {...props} />
)
