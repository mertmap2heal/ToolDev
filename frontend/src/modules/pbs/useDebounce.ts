import { useState, useEffect } from 'react'

/**
 * Returns a debounced value that updates after `delay` ms of no changes.
 * The immediate value updates on every change; the debounced value lags.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
