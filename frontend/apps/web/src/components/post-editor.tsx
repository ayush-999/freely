import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { getApiErrorMessage } from "@workspace/utils"

import { EmojiPicker, insertAtSelection } from "@/components/emoji-picker"

/** Inline editor that replaces a post's text while the author edits it. */
export function PostEditor({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string
  onSave: (body: string) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = value.trim()
  const unchanged = trimmed === initialValue.trim()

  function addEmoji(emoji: string) {
    const field = fieldRef.current
    const next = insertAtSelection(field, value, emoji)
    setValue(next.value)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(next.caret, next.caret)
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed || unchanged) return
    setBusy(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Could not save your changes"))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        ref={fieldRef}
        autoFocus
        aria-label="Edit post"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel()
        }}
        className="min-h-28 resize-y rounded-lg border-border/70 bg-muted/30 px-4 py-3 text-sm shadow-none focus-visible:bg-background"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <EmojiPicker side="bottom" align="left" onSelect={addEmoji} />
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !trimmed || unchanged}
          >
            Save changes
          </Button>
        </div>
      </div>
    </form>
  )
}
