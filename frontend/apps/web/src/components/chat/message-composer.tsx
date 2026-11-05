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
}: {
  disabled: boolean
  busy: boolean
  onSend: (text: string) => Promise<boolean>
  onTyping: (active: boolean) => void
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
      className="border-t p-3"
    >
      <label className="sr-only" htmlFor="chat-message">
        Message
      </label>
      <Textarea
        id="chat-message"
        ref={field}
        rows={2}
        maxLength={8000}
        value={text}
        disabled={disabled || busy}
        placeholder={
          disabled ? "Verify all devices to send a message" : "Write a message…"
        }
        className="max-h-40 min-h-20 resize-y border-0 bg-muted/40"
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
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
          <span className="text-xs text-muted-foreground">
            Shift + Enter for a new line
          </span>
        </div>
        <Button
          type="submit"
          disabled={disabled || busy || !text.trim()}
          size="sm"
        >
          <Send className="size-4" />
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  )
}
