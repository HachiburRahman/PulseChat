import { AVATAR_HUES, AI_TRIGGER } from './constants'

const DAY = 86_400_000

export function initials(name = '?') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function hueFor(id = '') {
  let hash = 0
  for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + String(id).charCodeAt(i)) | 0
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]
}

export function clockTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Compact stamp for conversation rows: 14:02 / Yesterday / Mon / 12 Mar. */
export function shortStamp(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  if (diff <= 0) return clockTime(d)
  if (diff <= DAY) return 'Yesterday'
  if (diff < DAY * 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** Day divider label rendered between message groups. */
export function dayLabel(value) {
  const d = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  if (diff <= 0) return 'Today'
  if (diff <= DAY) return 'Yesterday'
  return d.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export function sameDay(a, b) {
  if (!a || !b) return false
  const x = new Date(a)
  const y = new Date(b)
  return (
    x.getDate() === y.getDate() &&
    x.getMonth() === y.getMonth() &&
    x.getFullYear() === y.getFullYear()
  )
}

export function lastSeenLabel(value) {
  if (!value) return 'Offline'
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return 'Active just now'
  if (diff < 3_600_000) return `Active ${Math.floor(diff / 60_000)}m ago`
  if (diff < DAY) return `Active ${Math.floor(diff / 3_600_000)}h ago`
  return `Last seen ${shortStamp(value)}`
}

export function isAiPrompt(text = '') {
  return text.trim().toLowerCase().startsWith(AI_TRIGGER)
}

/** Human title for a room — group name, or the other member of a DM. */
export function roomTitle(room, meId) {
  if (!room) return ''
  if (room.isGroup) return room.name || 'Untitled room'
  const other = room.members?.find((m) => m._id !== meId)
  return other?.name || room.name || 'Direct message'
}

export function roomPeer(room, meId) {
  if (!room || room.isGroup) return null
  return room.members?.find((m) => m._id !== meId) || null
}

/** One-line preview used in the conversation list. */
export function previewOf(message, meId) {
  if (!message) return 'No messages yet'
  const mine = (message.sender?._id || message.sender) === meId
  const who = message.isAi ? '' : mine ? 'You: ' : senderPrefix(message)
  if (message.type === 'image') return `${who}📷 Photo`
  if (message.type === 'file') return `${who}📎 ${message.fileName || 'File'}`
  return who + String(message.content || '').replace(/\s+/g, ' ').slice(0, 90)
}

function senderPrefix(message) {
  const name = message.sender?.name
  return name ? `${name.split(' ')[0]}: ` : ''
}
