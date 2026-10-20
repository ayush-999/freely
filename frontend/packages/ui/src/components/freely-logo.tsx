import { Megaphone } from "lucide-react"

interface FreelyLogoProps {
  className?: string
}

export function FreelyLogo({ className }: FreelyLogoProps) {
  return (
    <span
      className={`group inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground ${className ?? ""}`}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary via-primary/90 to-indigo-600 text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
        <Megaphone className="size-4.5 -rotate-12 transition-transform group-hover:rotate-0" />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
      </span>

      <span className="flex flex-col">
        <span className="flex items-center gap-1.5">
          <span className="text-base font-extrabold tracking-tight">
            Freely
          </span>
          <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-0.5 rounded-full bg-primary transition-all duration-300 group-hover:h-3" />
            <span className="h-2.5 w-0.5 rounded-full bg-primary transition-all duration-300 group-hover:h-1.5" />
            <span className="h-3 w-0.5 rounded-full bg-primary transition-all duration-300 group-hover:h-2" />
            <span className="h-1 w-0.5 rounded-full bg-primary transition-all duration-300 group-hover:h-3.5" />
          </span>
        </span>
      </span>
    </span>
  )
}
