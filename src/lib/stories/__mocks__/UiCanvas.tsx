// Холст историй UI-примитивов `/ui`: тема грида и, по выбору, кусок грида — рамка, строка
// шапки и строка тела на токенах темы; кнопка стоит в заголовке, ячейке или строке и
// проявляется при наведении, как в гриде; заглушка — в пустом теле под шапкой.
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useRef,
} from 'react'

import { LocalizationProvider } from '../../core/localization'
import '../../ui/theme/theme.css'
import { DATA_GRID_THEME_CLASS, ThemeScope } from '../../ui/theme'

import styles from './UiCanvas.module.css'
import { RU_LABELS } from './localization.ru'
import { storyGridLocale } from './storyLabels'
import { useStoryLocale } from './storyLocale'

const HOSTS = {
  cell: { className: 'data-grid__body-cell', 'data-cell-interact': 'true' },
  head: { className: `data-grid__head-cell ${styles.head}` },
  row: { className: 'data-grid__body-row', 'data-row-interact': 'true' },
}

const frameStyle: CSSProperties = {
  boxSizing: 'border-box',
  overflow: 'hidden',
  border:
    'var(--tsr-comp-frame-border-width) solid var(--tsr-comp-frame-border-color)',
  borderRadius: 'var(--tsr-comp-frame-radius)',
  background: 'var(--tsr-comp-row-bg)',
  color: 'var(--tsr-comp-fg)',
  fontSize: 'var(--tsr-comp-cell-font-size)',
}

const lineStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  boxSizing: 'border-box',
  padding: '0 var(--tsr-comp-cell-content-padding-x)',
}

const headStyle: CSSProperties = {
  ...lineStyle,
  height: 'var(--tsr-comp-head-row-height)',
}

const bodyStyle: CSSProperties = {
  ...lineStyle,
  height: 'var(--tsr-comp-row-height)',
}

const text: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
}

interface UiCanvasProps {
  /** Место в куске грида: заголовок, ячейка или строка тела, всё пустое тело (заглушка). */
  host?: keyof typeof HOSTS | 'body'
  /** Текст места: заголовка, ячейки или строки. */
  caption?: string
  /** Заголовок колонки над ячейкой или строкой. */
  column?: string
  /** Соседняя колонка справа от заголовка: граница между ними, как у грипа ширины. */
  nextColumn?: string
  /** Ширина места: колонки заголовка или всего куска грида. */
  width?: number
  /** Высота пустого тела под шапкой (`host="body"`). */
  bodyHeight?: number
  children: ReactNode
}

/** Ширина соседней колонки справа. */
const NEXT_WIDTH = 160

const Grid = ({
  host,
  caption,
  column = 'Column',
  nextColumn,
  width,
  bodyHeight = 320,
  children,
}: Required<Pick<UiCanvasProps, 'host'>> & Omit<UiCanvasProps, 'host'>) => (
  <div
    style={{
      ...frameStyle,
      width: nextColumn && width ? width + NEXT_WIDTH : width,
    }}
  >
    {host === 'head' && nextColumn ? (
      <div style={{ display: 'flex', background: 'var(--tsr-comp-head-bg)' }}>
        <div {...HOSTS.head} style={{ ...headStyle, width, flex: 'none' }}>
          <span style={text}>{caption}</span>
          {children}
        </div>
        <div className={styles.head} style={{ ...headStyle, flex: 1 }}>
          <span style={text}>{nextColumn}</span>
        </div>
      </div>
    ) : host === 'head' ? (
      <div {...HOSTS.head} style={headStyle}>
        <span style={text}>{caption}</span>
        {children}
      </div>
    ) : (
      <div className={styles.head} style={headStyle}>
        <span style={text}>{column}</span>
      </div>
    )}
    {host === 'body' ? (
      // Сетка растягивает содержимое на всё тело: заглушка встаёт по его центру.
      <div style={{ display: 'grid', height: bodyHeight }}>{children}</div>
    ) : host === 'row' ? (
      <div {...HOSTS.row} style={bodyStyle}>
        <span style={text}>{caption}</span>
        {children}
      </div>
    ) : (
      <div style={{ ...bodyStyle, padding: 0 }}>
        {host === 'cell' ? (
          <div
            {...HOSTS.cell}
            style={{ ...lineStyle, flex: 1, alignSelf: 'stretch' }}
          >
            <span style={text}>{caption}</span>
            {children}
          </div>
        ) : null}
      </div>
    )}
  </div>
)

/** Хост логгера темы: предупреждение о смеси палитр — для грида, не для холста историй. */
const SILENT = { options: { logLevel: 'silent' as const } }

/**
 * Тема порталов (поповеры, тултипы) — как у грида: `.dark` у предка холста (тумблер темы
 * Storybook) делает тёмными и их (ADR 0090). Подписи компонентов, которые читают словарь
 * таблицы, — на языке тулбара, как в таблице историй.
 */
export const UiCanvas = (props: UiCanvasProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const locale = useStoryLocale()
  return (
    <LocalizationProvider
      localization={locale === 'ru' ? RU_LABELS : undefined}
      locale={storyGridLocale(locale)}
    >
      <ThemeScope
        colorMode="auto"
        contrast="auto"
        rootRef={rootRef}
        host={SILENT}
      >
        <Canvas rootRef={rootRef} {...props} />
      </ThemeScope>
    </LocalizationProvider>
  )
}

const Canvas = ({
  host,
  width,
  children,
  rootRef,
  ...rest
}: UiCanvasProps & { rootRef: RefObject<HTMLDivElement | null> }) => (
  <div
    ref={rootRef}
    className={DATA_GRID_THEME_CLASS}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      color: 'var(--tsr-sys-fg)',
    }}
  >
    {host ? (
      <Grid host={host} width={width} {...rest}>
        {children}
      </Grid>
    ) : (
      children
    )}
  </div>
)
