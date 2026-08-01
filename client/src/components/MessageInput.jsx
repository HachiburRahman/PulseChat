import { useEffect, useRef, useState } from 'react'
import { LuPaperclip, LuSendHorizontal, LuSmile, LuSparkles, LuX } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { useSocket } from '@/hooks/useSocket'
import { uploadFile, firebaseReady } from '@/firebase/firebase'
import { AI_TRIGGER, STORAGE } from '@/utils/constants'
import { isAiPrompt } from '@/utils/format'
import { Button } from './ui/Button'

const QUICK_EMOJI = ['👍', '🔥', '🎉', '😂', '🙌', '👀', '✅', '❤️', '🤔', '🚀', '😅', '💡']
const MAX_UPLOAD = 8 * 1024 * 1024

/**
 * Mounted with `key={roomId}` by ChatWindow, so switching rooms remounts this
 * component. That is what lets the draft, upload and error state all reset from
 * their initialisers instead of being patched up inside an effect.
 */
export function MessageInput({ roomId, isAiRoom = false, placeholder }) {
  const { sendMessage, notifyTyping, stopTyping } = useChat()
  const { user } = useAuth()
  const { live } = useSocket()

  const draftKey = STORAGE.draftPrefix + roomId

  const [text, setText] = useState(() => localStorage.getItem(draftKey) || '')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [upload, setUpload] = useState(null) // { name, percent }
  const [error, setError] = useState(null)

  const areaRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => areaRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [])

  // -- drafts survive switching rooms mid-sentence --------------------
  useEffect(() => {
    if (text) localStorage.setItem(draftKey, text)
    else localStorage.removeItem(draftKey)
  }, [text, draftKey])

  // -- auto-grow ------------------------------------------------------
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [text])

  const aiMode = isAiRoom || isAiPrompt(text)

  const submit = () => {
    const content = text.trim()
    if (!content || !live) return
    sendMessage({ roomId, content })
    setText('')
    setEmojiOpen(false)
    requestAnimationFrame(() => areaRef.current?.focus())
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') setEmojiOpen(false)
  }

  const onChange = (e) => {
    setText(e.target.value)
    if (e.target.value) notifyTyping(roomId)
    else stopTyping(roomId)
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_UPLOAD) {
      setError(`"${file.name}" is over 8 MB.`)
      return
    }

    setError(null)
    setUpload({ name: file.name, percent: 0 })
    try {
      const result = await uploadFile(file, {
        userId: user?._id,
        onProgress: (percent) => setUpload((u) => (u ? { ...u, percent } : u)),
      })
      sendMessage({
        roomId,
        content: result.url,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        fileName: result.name,
      })
    } catch {
      setError('Upload failed. Check your Firebase Storage rules and try again.')
    } finally {
      setUpload(null)
    }
  }

  const insertAiTrigger = () => {
    setText((t) => (isAiPrompt(t) ? t : `${AI_TRIGGER} ${t}`.trimEnd() + ' ').trimStart())
    areaRef.current?.focus()
  }

  return (
    <div className="border-t border-line bg-elev/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-4xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:pb-4">
        {/* status strips */}
        {aiMode && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-ai/25 bg-ai-soft px-3 py-1.5 animate-fade">
            <LuSparkles className="h-3.5 w-3.5 shrink-0 text-ai" />
            <span className="text-xs text-ai">
              {isAiRoom
                ? 'Pulse AI will answer and stream its reply live.'
                : 'Pulse AI will answer this in the room for everyone.'}
            </span>
          </div>
        )}

        {upload && (
          <div className="mb-2 rounded-lg border border-line bg-surface px-3 py-2 animate-fade">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs text-ink-2">Uploading {upload.name}</span>
              <span className="font-mono text-[0.625rem] tabular-nums text-ink-3">
                {upload.percent}%
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-signal transition-[width] duration-200"
                style={{ width: `${upload.percent}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-1.5 animate-fade">
            <span className="flex-1 text-xs text-danger">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <LuX className="h-3.5 w-3.5 text-danger" />
            </button>
          </div>
        )}

        {!live && (
          <div className="mb-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-3">
            Reconnecting to the realtime server…
          </div>
        )}

        {/* composer */}
        <div
          className={cn(
            'relative flex items-end gap-1.5 rounded-2xl border bg-surface p-1.5',
            'transition-colors duration-200 focus-within:border-signal/60',
            'focus-within:ring-4 focus-within:ring-signal/10',
            aiMode ? 'border-ai/35' : 'border-line',
          )}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
            accept="image/*,.pdf,.txt,.md,.zip,.json,.csv"
          />

          <IconBtn
            label={
              firebaseReady ? 'Attach a file' : 'Attach (local preview — Firebase not configured)'
            }
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(upload)}
          >
            <LuPaperclip className="h-[18px] w-[18px]" />
          </IconBtn>

          <div className="relative">
            <IconBtn label="Emoji" onClick={() => setEmojiOpen((v) => !v)} active={emojiOpen}>
              <LuSmile className="h-[18px] w-[18px]" />
            </IconBtn>

            {emojiOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
                <div className="absolute bottom-12 left-0 z-20 grid w-56 grid-cols-6 gap-1 rounded-2xl border border-line bg-elev p-2 shadow-pop animate-rise">
                  {QUICK_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setText((t) => t + emoji)
                        setEmojiOpen(false)
                        areaRef.current?.focus()
                      }}
                      className="grid h-8 place-items-center rounded-lg text-base transition hover:bg-surface-2"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {!isAiRoom && (
            <IconBtn
              label="Ask Pulse AI in this room"
              onClick={insertAiTrigger}
              active={aiMode}
              tone="ai"
            >
              <LuSparkles className="h-[18px] w-[18px]" />
            </IconBtn>
          )}

          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={() => stopTyping(roomId)}
            placeholder={
              placeholder ||
              (isAiRoom
                ? 'Ask Pulse AI anything…'
                : `Message — type ${AI_TRIGGER} to summon the assistant`)
            }
            className="max-h-42 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.9375rem] leading-snug text-ink placeholder:text-ink-3/80 focus:outline-none"
          />

          <Button
            variant="signal"
            size="icon"
            onClick={submit}
            disabled={!text.trim() || !live}
            aria-label="Send message"
            className="h-10 w-10 rounded-xl"
          >
            <LuSendHorizontal className="h-[18px] w-[18px]" />
          </Button>
        </div>

        <p className="mt-2 hidden px-1 text-[0.6875rem] text-ink-3 sm:block">
          <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[0.625rem]">
            Enter
          </kbd>{' '}
          to send ·{' '}
          <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[0.625rem]">
            Shift + Enter
          </kbd>{' '}
          for a new line
        </p>
      </div>
    </div>
  )
}

function IconBtn({ children, label, onClick, active, disabled, tone = 'signal' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'no-tap grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? tone === 'ai'
            ? 'bg-ai-soft text-ai'
            : 'bg-signal-soft text-signal'
          : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
