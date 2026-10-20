import { useEffect, useState } from "react"
import {
  Activity,
  ChevronRight,
  Radio,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"

interface AiVoiceTickerProps {
  onOpenTelemetry: () => void
}

const LIVE_INSIGHTS = [
  {
    icon: Radio,
    color: "text-emerald-500",
    text: "Voice Network Active: Over 3,420 citizen voices amplified & routed via AI this month.",
  },
  {
    icon: Sparkles,
    color: "text-primary",
    text: "AI Sentinel v2.4: Real-time grievance urgency detection & automatic SLA guarantee active.",
  },
  {
    icon: ShieldCheck,
    color: "text-indigo-400",
    text: "Whistleblower Shield Armed: 100% biometric cloaking with zero personal metadata retention.",
  },
]

export function AiVoiceTicker({ onOpenTelemetry }: AiVoiceTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % LIVE_INSIGHTS.length)
    }, 4800)
    return () => clearInterval(timer)
  }, [])

  if (isDismissed) return null

  const current = LIVE_INSIGHTS[currentIndex]
  const IconComponent = current.icon

  return (
    <aside
      aria-label="AI Voice Live Sentinel"
      className="border-b border-primary/20 bg-white/90 dark:bg-background/90 px-3 py-1.5 text-xs text-foreground transition-all"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {/* Pulsing beacon indicator */}
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>

          <button
            onClick={() =>
              setCurrentIndex((prev) => (prev + 1) % LIVE_INSIGHTS.length)
            }
            className="flex cursor-pointer items-center gap-1.5 truncate text-left text-xs transition-opacity hover:opacity-80"
            title="Click to view next AI telemetry update"
          >
            <IconComponent className={`size-3.5 shrink-0 ${current.color}`} />
            <span className="truncate font-medium">{current.text}</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onOpenTelemetry}
            className="hidden cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 sm:inline-flex"
          >
            <Activity className="size-3" />
            AI Telemetry
            <ChevronRight className="size-3" />
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss AI ticker banner"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
