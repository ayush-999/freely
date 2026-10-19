import { Loader2 } from "lucide-react"

export function LoadingFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
