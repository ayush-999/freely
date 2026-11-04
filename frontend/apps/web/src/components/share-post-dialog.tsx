import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Copy, Share2, X } from "lucide-react"
import {
  FaFacebookF,
  FaTelegram,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6"
import { MdEmail } from "react-icons/md"

import { Button } from "@workspace/ui/components/button"
import { getApiErrorMessage } from "@workspace/utils"

const shareTargets = [
  {
    label: "WhatsApp",
    Icon: FaWhatsapp,
    iconClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    href: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    label: "Facebook",
    Icon: FaFacebookF,
    iconClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    href: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: "X",
    Icon: FaXTwitter,
    iconClassName: "bg-foreground/10 text-foreground",
    href: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    label: "Telegram",
    Icon: FaTelegram,
    iconClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    href: (url: string, title: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    label: "Email",
    Icon: MdEmail,
    iconClassName: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
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
      if (shareError instanceof Error && shareError.name === "AbortError")
        return
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
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-primary/[0.04] px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Share2 aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2
                id="share-post-title"
                className="text-lg font-semibold tracking-tight"
              >
                Share this post
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Send this post to someone you know.
              </p>
            </div>
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

        <div className="space-y-6 p-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="share-post-link"
                className="text-sm font-semibold"
              >
                Your share link
              </label>
              {copied && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check aria-hidden="true" className="size-3.5" />
                  Link copied
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-muted/40 p-1.5 shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
              <input
                id="share-post-link"
                readOnly
                aria-label="Post link"
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
              />
              <Button type="button" size="sm" onClick={() => void copyLink()}>
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm font-semibold">Share via</span>
              <span className="h-px flex-1 bg-border/70" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {typeof navigator.share === "function" && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-16 justify-start gap-3 rounded-xl px-3 text-left hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => void shareNatively()}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Share2 aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      More apps
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      Use another app
                    </span>
                  </span>
                </Button>
              )}
              {shareTargets.map(({ label, Icon, iconClassName, href }) => (
                <a
                  key={label}
                  href={href(url, "Check out this post")}
                  target={label === "Email" ? undefined : "_blank"}
                  rel={label === "Email" ? undefined : "noopener noreferrer"}
                  className="group inline-flex min-h-16 items-center gap-3 rounded-xl border border-border/80 bg-background px-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {label}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
