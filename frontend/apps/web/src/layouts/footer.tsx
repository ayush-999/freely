import { Bot, ShieldCheck } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

interface FooterProps {
  apiOk: boolean | null
  onOpenTelemetry: () => void
}

export function Footer({ apiOk, onOpenTelemetry }: FooterProps) {
  return (
    <footer className="border-t bg-white dark:bg-background py-4 transition-colors">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                apiOk === null && "animate-pulse bg-muted-foreground/40",
                apiOk === true && "bg-emerald-500",
                apiOk === false && "bg-destructive"
              )}
            />
            <span className="font-medium">
              {apiOk === null && "Checking API..."}
              {apiOk === true && "Core API Online"}
              {apiOk === false && "API Unreachable"}
            </span>
          </div>

          <span className="text-border" aria-hidden="true">
            •
          </span>

          <button
            onClick={onOpenTelemetry}
            className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Bot className="size-3.5 text-primary" />
            <span>AI Neural Pipeline:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          </button>

          <span className="text-border" aria-hidden="true">
            •
          </span>

          <div className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="size-3 text-emerald-500" />
            <span>Voice Shield 256-Bit</span>
          </div>

          <span className="text-border" aria-hidden="true">
            •
          </span>

          <button
            onClick={onOpenTelemetry}
            className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 md:inline-flex"
            title="Click to view AI Telemetry & Pipeline Health"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>AI Sentinel</span>
            <Badge
              variant="outline"
              className="h-3.5 border-primary/20 px-1 py-0 text-[9px] text-primary"
            >
              v2.4
            </Badge>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <span className="size-1.5 animate-ping rounded-full bg-primary" />
            <span>Amplifying Every Voice</span>
          </div>

          <div className="flex h-3 items-end gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-primary/50" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-primary/70 delay-75" />
            <span className="h-2 w-0.5 animate-pulse rounded-full bg-primary/50 delay-150" />
          </div>
        </div>
      </div>
    </footer>
  )
}
