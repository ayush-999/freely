import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { EllipsisVertical, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export interface PostMenuItem {
  key: string
  label: string
  Icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

type Position = { top?: number; bottom?: number; right: number }

const ITEM_HEIGHT = 40

/** "More" dropdown for a post; rendered in a portal so card edges never clip it. */
export function PostMenu({ items }: { items: PostMenuItem[] }) {
  const [position, setPosition] = useState<Position | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = position !== null

  useEffect(() => {
    if (!open) return

    function close() {
      setPosition(null)
    }
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !buttonRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        close()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [open])

  function toggle() {
    if (open) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const menuHeight = items.length * ITEM_HEIGHT + 8
    const right = window.innerWidth - rect.right
    setPosition(
      window.innerHeight - rect.bottom > menuHeight + 12
        ? { top: rect.bottom + 6, right }
        : { bottom: window.innerHeight - rect.top + 6, right }
    )
  }

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
        onClick={toggle}
        className="rounded-full text-muted-foreground"
      >
        <EllipsisVertical aria-hidden="true" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position}
            className="fixed z-50 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {items.map(({ key, label, Icon, onSelect, destructive }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosition(null)
                  onSelect()
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-sm px-3 text-left text-sm transition-colors focus-visible:outline-none",
                  destructive
                    ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
                    : "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
                )}
              > 
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4",
                    !destructive && "text-muted-foreground"
                  )}
                />
                {label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
