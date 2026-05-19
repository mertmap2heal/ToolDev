/**
 * Button — RF-1 primitive. Port of `_chrome.css` `.btn` / `.btn.primary` /
 * `.btn.ghost` / `.btn.sm` / `.btn .caret` / `.btn-split`.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { BORDER_STRONG, FOCUS_RING } from './tokens'

export type ButtonVariant = 'default' | 'primary' | 'ghost'
export type ButtonSize = 'md' | 'sm'

interface CommonButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render a trailing chevron caret (`.btn .caret`). */
  caret?: boolean
  children?: ReactNode
}

type ButtonAsButton = CommonButtonProps & {
  as?: 'button'
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

type ButtonAsAnchor = CommonButtonProps & {
  as: 'a'
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

/** Resolve the base + variant + size styles into one inline-style object. */
function buttonStyle(
  variant: ButtonVariant,
  size: ButtonSize,
  hovered: boolean,
  focused: boolean,
  disabled: boolean,
): CSSProperties {
  const base: CSSProperties = {
    height: size === 'sm' ? 26 : 30,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: size === 'sm' ? '0 8px' : '0 12px',
    fontSize: size === 'sm' ? 12 : 13,
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 80ms ease-out, border-color 80ms ease-out',
    boxShadow: focused ? FOCUS_RING : undefined,
  }

  if (variant === 'primary') {
    return {
      ...base,
      background:
        hovered && !disabled ? 'var(--theme-accent-hover)' : 'var(--theme-accent)',
      borderColor:
        hovered && !disabled ? 'var(--theme-accent-hover)' : 'var(--theme-accent)',
      color: '#fff',
    }
  }
  if (variant === 'ghost') {
    return {
      ...base,
      background: hovered && !disabled ? 'var(--theme-surface)' : 'transparent',
      borderColor: 'transparent',
      color: 'var(--theme-text)',
    }
  }
  // default
  return {
    ...base,
    background: hovered && !disabled ? 'var(--theme-surface)' : 'var(--theme-bg)',
    borderColor: hovered && !disabled ? BORDER_STRONG : 'var(--theme-border)',
    color: 'var(--theme-text)',
  }
}

/**
 * The shared chrome button. Renders a `<button>` by default, or an `<a>`
 * when `as="a"` (the `_chrome.css` `.btn` is used as both).
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const { variant = 'default', size = 'md', caret = false, children, ...rest } = props
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)

    const disabled =
      props.as !== 'a' && (rest as ButtonHTMLAttributes<HTMLButtonElement>).disabled === true

    const style = {
      ...buttonStyle(variant, size, hovered, focused, disabled),
      ...((rest as { style?: CSSProperties }).style ?? {}),
    }

    const caretEl = caret ? (
      <ChevronDown
        size={14}
        aria-hidden="true"
        style={{ color: 'var(--theme-text-muted)', marginLeft: 2, flexShrink: 0 }}
      />
    ) : null

    const interaction = {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    }

    if (props.as === 'a') {
      const { as: _as, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
        as?: string
      }
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          {...anchorRest}
          {...interaction}
          style={style}
        >
          {children}
          {caretEl}
        </a>
      )
    }

    const { as: _as, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement> & {
      as?: string
    }
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        {...buttonRest}
        {...interaction}
        style={style}
      >
        {children}
        {caretEl}
      </button>
    )
  },
)

export interface ButtonSplitProps {
  /** Exactly two `Button` elements — joined into one split control. */
  children: [ReactNode, ReactNode]
  /** Optional accessible group label. */
  'aria-label'?: string
}

/**
 * ButtonSplit — `_chrome.css` `.btn-split`: two buttons joined with a shared
 * radius (`6px 0 0 6px` / `0 6px 6px 0`) and no inner border.
 *
 * Pass two `<Button>` children; the join radii are applied by wrapping each in
 * a container that overrides `borderRadius` / `borderLeft`.
 */
export function ButtonSplit({ children, ...rest }: ButtonSplitProps) {
  const [first, second] = children
  return (
    <span style={{ display: 'inline-flex' }} role="group" {...rest}>
      <span style={{ borderRadius: '6px 0 0 6px' }} data-split="first">
        {first}
      </span>
      <span
        style={{ borderRadius: '0 6px 6px 0', marginLeft: -1 }}
        data-split="second"
      >
        {second}
      </span>
    </span>
  )
}
