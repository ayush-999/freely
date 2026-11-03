import { Link } from "react-router-dom"
import {
  BriefcaseBusiness,
  HatGlasses,
  Heart,
  MessageCircle,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"

const perks = [
  {
    Icon: HatGlasses,
    title: "Post as yourself",
    text: "Use your @handle and choose who sees each post.",
    tone: "bg-emerald-500/10 text-emerald-500",
  },
  {
    Icon: MessageCircle,
    title: "Messaging",
    text: "Chat with people directly.",
    tone: "bg-fuchsia-500/10 text-fuchsia-500",
    soon: true,
  },
  {
    Icon: Heart,
    title: "Join the conversation",
    text: "Like, comment on and bookmark posts.",
    tone: "bg-rose-500/10 text-rose-500",
  },
  {
    Icon: BriefcaseBusiness,
    title: "Apply for jobs",
    text: "Send applications from your profile.",
    tone: "bg-sky-500/10 text-sky-500",
  },
] as const

export function GuestLoginCard() {
  return (
    <Card className="gap-0 overflow-hidden border-border/70 p-0 hover:shadow-sm">
      <div className="space-y-1 bg-gradient-to-br from-primary/10 to-transparent px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold">Log in to do more</h2>
        <p className="text-xs text-muted-foreground">
          You are browsing and posting anonymously. Log in to unlock:
        </p>
      </div>

      <ul className="space-y-3.5 px-4 py-4">
        {perks.map((perk) => (
          <li key={perk.title} className="flex items-start gap-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${perk.tone}`}
            >
              <perk.Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm leading-tight font-medium">
                {perk.title}
                {"soon" in perk && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    Soon
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {perk.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 p-4">
        <Button asChild>
          <Link to={APP_ROUTES.login}>Log in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.register}>Create an account</Link>
        </Button>
      </div>
    </Card>
  )
}
