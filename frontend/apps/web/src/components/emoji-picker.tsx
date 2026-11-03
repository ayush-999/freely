import { useEffect, useRef, useState } from "react"
import { Smile } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis:
      "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🤓 🥳 🤗 🤔 🫡 😐 😶 🙄 😏 😬 😴 😌 😢 😭 😤 😡 🥺 😱 🤯 🥵 🥶 🤒 🤧 😷".split(
        " "
      ),
  },
  {
    label: "Gestures",
    emojis: "👍 👎 👏 🙌 🙏 🤝 💪 👌 ✌️ 🤞 🤟 🤘 👋 🫶 ✊ 👊 ☝️ 👀 🧠".split(
      " "
    ),
  },
  {
    label: "Symbols",
    emojis:
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💯 ✨ 🔥 ⭐ 🌟 🎉 🎊 🏆 ✅ ❌ ⚠️ ❓ ❗ 💡 📢 📌 🔔".split(
        " "
      ),
  },
  {
    label: "Nature & more",
    emojis: "🌞 🌙 🌈 ☀️ ⛈️ 🌸 🌳 🐶 🐱 🦁 🍎 ☕ 🍕 ⚽ 🎵 🚀 🏠 📍 💼 📚".split(
      " "
    ),
  },
] as const

/** Splices ``text`` into ``value`` at the field's caret (or the end). */
export function insertAtSelection(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  text: string
) {
  const start = field?.selectionStart ?? value.length
  const end = field?.selectionEnd ?? start
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + text.length,
  }
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  /** Which side of the button the panel opens towards. */
  side?: "top" | "bottom"
  align?: "left" | "right"
  className?: string
}

export function EmojiPicker({
  onSelect,
  side = "top",
  align = "right",
  className,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    // Capture phase so Escape closes only the picker, not a surrounding dialog.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Add emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Add emoji"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full text-muted-foreground hover:text-amber-500!"
      >
        <Smile aria-hidden="true" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className={cn(
            "absolute z-50 w-72 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {EMOJI_GROUPS.map((group) => (
              <section key={group.label}>
                <h3 className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h3>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      className="flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
