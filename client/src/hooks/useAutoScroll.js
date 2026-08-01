import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Keeps a scroll container pinned to the newest message — but only while the
 * reader is already at the bottom. Scroll up to read history and new messages
 * stop yanking you back down; a "jump to latest" affordance takes over instead.
 */
export function useAutoScroll(deps = [], { threshold = 140 } = {}) {
  const ref = useRef(null)
  const [pinned, setPinned] = useState(true)
  const pinnedRef = useRef(true)

  const setPin = useCallback((value) => {
    pinnedRef.current = value
    setPinned(value)
  }, [])

  const scrollToBottom = useCallback(
    (behavior = 'smooth') => {
      const el = ref.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior })
      setPin(true)
    },
    [setPin],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      setPin(distance < threshold)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [threshold, setPin])

  useLayoutEffect(() => {
    if (!pinnedRef.current) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, pinned, scrollToBottom }
}
