import { useRef, useCallback } from 'react'

/**
 * Hook to debounce click handlers, preventing double-click issues.
 *
 * Use this for buttons that:
 * - Replace themselves with different UI on click
 * - Remove their parent element on click
 * - Toggle visibility of overlapping elements
 *
 * @param callback - The click handler to debounce
 * @param delay - Minimum ms between allowed clicks (default: 150ms)
 * @returns Debounced click handler
 *
 * @example
 * const handleClick = useDebouncedClick(() => onRemoveTag(id), 150)
 * <button onClick={handleClick}>×</button>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedClick<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 150
): (...args: Parameters<T>) => void {
  const lastClickRef = useRef<number>(0)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastClickRef.current < delay) {
        return // Ignore click within debounce window
      }
      lastClickRef.current = now
      callback(...args)
    },
    [callback, delay]
  )
}

/**
 * Creates a debounced click handler inline (no hook rules).
 * Use when you can't use hooks (e.g., in map callbacks).
 *
 * @example
 * {tags.map(tag => (
 *   <button onClick={createDebouncedHandler(() => onRemove(tag.id))}>×</button>
 * ))}
 */
const clickTimestamps = new WeakMap<object, number>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDebouncedHandler<T extends (...args: any[]) => void>(
  callback: T,
  key: object = callback,
  delay: number = 150
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    const now = Date.now()
    const lastClick = clickTimestamps.get(key) ?? 0
    if (now - lastClick < delay) {
      return
    }
    clickTimestamps.set(key, now)
    callback(...args)
  }
}
