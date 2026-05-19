/**
 * Checkbox — RF-1 primitive. Port of `_chrome.css` `.check`.
 *
 * A 14px square checkbox: themed border, accent-filled when checked, with a
 * white tick. `_chrome.css` draws the tick with a CSS `::after`; inline style
 * cannot, so the tick is a small overlaid `<Check>` glyph.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import {
  forwardRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react'
import { Check } from 'lucide-react'
import { FOCUS_RING } from './tokens'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Pixel size of the box (default 14, the `_chrome.css` `.check` size). */
  boxSize?: number
}

/** A 14px accent checkbox. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { boxSize = 14, checked, defaultChecked, style, ...rest },
  ref,
) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // Track checked for the visual overlay (controlled or uncontrolled).
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const isChecked = checked ?? internalChecked

  const boxStyle: CSSProperties = {
    width: boxSize,
    height: boxSize,
    border: `1px solid ${
      isChecked
        ? 'var(--theme-accent)'
        : hovered
          ? 'var(--theme-accent)'
          : 'var(--border-strong)'
    }`,
    background: isChecked ? 'var(--theme-accent)' : 'var(--theme-bg)',
    borderRadius: 3,
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: focused ? FOCUS_RING : undefined,
    opacity: rest.disabled ? 0.5 : 1,
    transition: 'background-color 80ms ease-out, border-color 80ms ease-out',
  }

  return (
    <span
      style={{ display: 'inline-flex', position: 'relative', ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => {
          if (checked === undefined) setInternalChecked(e.target.checked)
          rest.onChange?.(e)
        }}
        onFocus={(e) => {
          setFocused(true)
          rest.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          rest.onBlur?.(e)
        }}
        {...rest}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          width: boxSize,
          height: boxSize,
          opacity: 0,
          cursor: rest.disabled ? 'not-allowed' : 'pointer',
        }}
      />
      <span aria-hidden="true" style={boxStyle}>
        {isChecked && (
          <Check size={Math.round(boxSize * 0.78)} strokeWidth={3} color="#fff" />
        )}
      </span>
    </span>
  )
})
