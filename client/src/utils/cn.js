/** Tiny class-name joiner — drops falsy values, flattens arrays. */
export function cn(...parts) {
  const out = []
  for (const part of parts) {
    if (!part) continue
    if (Array.isArray(part)) {
      const nested = cn(...part)
      if (nested) out.push(nested)
    } else if (typeof part === 'object') {
      for (const [key, on] of Object.entries(part)) if (on) out.push(key)
    } else {
      out.push(part)
    }
  }
  return out.join(' ')
}
