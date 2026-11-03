import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Copy, Mail, MessageCircle, Share2, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { getApiErrorMessage } from "@workspace/utils"

const shareTargets = [
  {
    label: "WhatsApp",
    Icon: MessageCircle,
    href: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    label: "Facebook",
    Icon: Share2,
    href: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: "X",
    Icon: Share2,
    href: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    label: "Telegram",
    Icon: MessageCircle,
    href: (url: string, title: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    label: "Email",
    Icon: Mail,
    href: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
]

export function SharePostDialog({
  url,
  onClose,
}: {
  url: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  async function copyLink() {
    setError(null)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch (copyError) {
      setError(getApiErrorMessage(copyError, "Could not copy the link"))
    }
  }

  async function shareNatively() {
    if (!navigator.share) return
    setError(null)
    try {
      await navigator.share({ title: "Check out this post", url })
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return
      setError(getApiErrorMessage(shareError, "Could not share the post"))
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-post-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="share-post-title" className="text-base font-semibold">
              Share post
            </h2>
            <p className="text-xs text-muted-foreground">
              Copy the link or share it with an app.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            readOnly
            aria-label="Post link"
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <Button type="button" onClick={() => void copyLink()}>
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {typeof navigator.share === "function" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void shareNatively()}
            >
              <Share2 aria-hidden="true" />
              More apps
            </Button>
          )}
          {shareTargets.map(({ label, Icon, href }) => (
            <a
              key={label}
              href={href(url, "Check out this post")}
              target={label === "Email" ? undefined : "_blank"}
              rel={label === "Email" ? undefined : "noopener noreferrer"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </a>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    </div>,
    document.body
  )
}
