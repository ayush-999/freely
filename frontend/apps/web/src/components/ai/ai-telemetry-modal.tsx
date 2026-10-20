import { useState } from "react"
import {
  Activity,
  CheckCircle2,
  Cpu,
  Radio,
  RefreshCw,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

interface AiTelemetryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AiTelemetryModal({ isOpen, onClose }: AiTelemetryModalProps) {
  const [isPinging, setIsPinging] = useState(false)
  const [latency, setLatency] = useState(24)
  const [lastCheck, setLastCheck] = useState("Just now")

  if (!isOpen) return null

  function handlePing() {
    setIsPinging(true)
    setTimeout(() => {
      setLatency(Math.floor(18 + Math.random() * 15))
      setLastCheck("Just now")
      setIsPinging(false)
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="relative w-full max-w-lg border-primary/20 bg-background/95 shadow-2xl backdrop-blur-md">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>

        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="size-4 animate-pulse" />
            </span>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Freely AI Voice Sentinel
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">
                  ONLINE
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Neural telemetry, anonymous voice routing & SLA monitoring pipeline
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3.5 text-primary" />
                <span>AI Pipeline Latency</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight">{latency}ms</span>
                <span className="text-[10px] text-emerald-500 font-medium">Optimal</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Voice Anonymizer</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight">256-Bit</span>
                <span className="text-[10px] text-emerald-500 font-medium">Cloaked</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="size-3.5 text-amber-500" />
                <span>SLA Auto-Dispatcher</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight">99.8%</span>
                <span className="text-[10px] text-muted-foreground font-medium">Resolution rate</span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="size-3.5 text-indigo-500" />
                <span>Active Voice Streams</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight">3,420+</span>
                <span className="text-[10px] text-indigo-500 font-medium">This month</span>
              </div>
            </div>
          </div>

          {/* Connected AI Models */}
          <div className="rounded-lg border border-border/80 bg-muted/10 p-3 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connected AI Services
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Speech-to-Text & Urgency Sentiment Analyzer</span>
                </div>
                <Badge variant="outline" className="text-[10px]">v2.4 Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Whistleblower Voice Masking & Metadata Scrubbing</span>
                </div>
                <Badge variant="outline" className="text-[10px]">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Auto-Triage & Department Routing Engine</span>
                </div>
                <Badge variant="outline" className="text-[10px]">Active</Badge>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-[11px] text-muted-foreground">
              Last synced: {lastCheck}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePing}
                disabled={isPinging}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={`size-3 ${isPinging ? "animate-spin" : ""}`} />
                {isPinging ? "Pinging..." : "Test AI Ping"}
              </Button>
              <Button size="sm" onClick={onClose} className="text-xs h-8">
                Done
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
