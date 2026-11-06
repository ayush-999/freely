import { useRef, useState, type FormEvent } from "react"
import { Send } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { EmojiPicker, insertAtSelection } from "@/components/emoji-picker"

export function MessageComposer({
  disabled,
  busy,
  onSend,
  onTyping,
  disabledReason,
}: {
  disabled: boolean
  busy: boolean
  onSend: (text: string) => Promise<boolean>
  onTyping: (active: boolean) => void
  disabledReason?: string
}) {
  const [text, setText] = useState("")
  const field = useRef<HTMLTextAreaElement>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled || busy || !text.trim()) return
    const submitted = text
    if (await onSend(submitted))
      setText((current) => (current === submitted ? "" : current))
  }
  return (
    <form
      onSubmit={(event) => {
        void submit(event)
      }}
      className="shrink-0 border-t bg-card px-3 py-3 md:px-5"
    >
      <label className="sr-only" htmlFor="chat-message">
        Message
      </label>
      <div className="flex items-end gap-2 rounded-2xl border bg-background/60 p-2">
        {!disabled && (
          <EmojiPicker
            align="left"
            onSelect={(emoji) => {
              const next = insertAtSelection(field.current, text, emoji)
              if (next.value.length > 8000) return
              setText(next.value)
              onTyping(true)
              requestAnimationFrame(() => {
                field.current?.focus()
                field.current?.setSelectionRange(next.caret, next.caret)
              })
            }}
          />
        )}
        <Textarea
          id="chat-message"
          ref={field}
          rows={1}
          maxLength={8000}
          value={text}
          disabled={disabled || busy}
          placeholder={
            disabled
              ? (disabledReason ?? "Messaging is connecting…")
              : "Write a message…"
          }
          className="max-h-28 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => {
            setText(event.target.value)
            onTyping(!!event.target.value.trim())
          }}
          onBlur={() => onTyping(false)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button
          type="submit"
          disabled={disabled || busy || !text.trim()}
          size="sm"
          className="size-9 shrink-0 rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700"
          aria-label={busy ? "Sending…" : "Send"}
        >
          <Send className="size-4" />
          <span className="sr-only">{busy ? "Sending…" : "Send"}</span>
        </Button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Shift + Enter for a new line
      </p>
    </form>
  )
}
