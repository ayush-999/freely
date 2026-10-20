import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  Clock,
  Megaphone,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ComingSoonModal } from "@/components/coming-soon-modal"
import { RaiseVoiceModal } from "@/components/raise-voice-modal"
import { config } from "@/config/config"

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Social feed",
    description:
      "Share updates with your network. Post publicly, to followers, your department, or privately — you control the audience.",
  },
  {
    icon: ShieldCheck,
    title: "Grievance management",
    description:
      "File grievances in seconds and follow every step of the resolution process with full transparency.",
  },
  {
    icon: Timer,
    title: "SLA tracking",
    description:
      "Every grievance carries a service-level agreement, so responses and resolutions are always on the clock.",
  },
  {
    icon: Briefcase,
    title: "Jobs & recruitment",
    description:
      "Discover openings from verified organizations and apply without leaving the platform.",
  },
  {
    icon: Building2,
    title: "Organizations",
    description:
      "Departments and companies get public profiles, structured workflows, and direct lines to the people they serve.",
  },
  {
    icon: Bell,
    title: "Real-time notifications",
    description:
      "Status changes, comments, and mentions reach you instantly — nothing slips through the cracks.",
  },
] as const

const STEPS = [
  {
    step: "01",
    title: "Create your account",
    description:
      "Pick a handle, verify your identity, and join your organization or community.",
  },
  {
    step: "02",
    title: "Post, report, apply",
    description:
      "Share on the feed, file a grievance with a public tracking ID, or apply for a job.",
  },
  {
    step: "03",
    title: "Track everything",
    description:
      "Follow progress in real time with SLA-backed timelines and instant notifications.",
  },
] as const

/** Static marketing landing page shown at the root path. */
export function LandingPage() {
  const [isRaiseVoiceOpen, setIsRaiseVoiceOpen] = useState(false)
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false)

  return (
    <div className="flex flex-col gap-20 pb-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pt-14 text-center">
        <Badge variant="secondary" className="px-3 py-1">
          Grievances · Social · Jobs — one platform
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Your voice, heard — and answered
        </h1>
        <p className="max-w-2xl text-lg text-balance text-muted-foreground">
          Freely combines a professional social network with transparent
          grievance management and recruitment. Raise issues, track them to
          resolution, and stay connected with the organizations that matter to
          you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to={APP_ROUTES.register}>
              Get started
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>

          <Button size="lg" variant="outline" asChild>
            <Link to={APP_ROUTES.feed}>Explore the feed</Link>
          </Button>
        </div>
      </section>

      {/* Dedicated 'Raise Voice' Showcase Section */}
      <section
        id="raise-voice"
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-primary/5 via-card to-background p-6 shadow-none sm:p-10"
      >
        <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-10">
          {/* Section Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              <Sparkles className="size-3.5 animate-pulse text-amber-500" />
              Core Accountability Engine
            </Badge>
            <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Raise Your Voice. Track Every Second. Demand Real Answers.
            </h2>
            <p className="max-w-2xl text-sm text-balance text-muted-foreground sm:text-base">
              Traditional complaint boxes are bureaucratic black holes where
              issues go to die. Freely transforms your concern into an
              immutable, time-bound, SLA-backed resolution process with full
              whistleblower protection and AI transcription.
            </p>
          </div>

          {/* 4 Core Pillars Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-background/80 backdrop-blur-xs transition-all hover:shadow-sm">
              <CardHeader className="p-5">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-primary">
                  <Mic className="size-5 text-indigo-500 dark:text-indigo-500" />
                </div>
                <CardTitle className="text-base font-bold">
                  AI Voice & Speech Structuring
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Speak naturally or drop rough notes. Our built-in AI assistant
                  transcribes, extracts facts, and formats your grievance into a
                  legally compliant complaint.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-background/80 backdrop-blur-xs transition-all hover:shadow-sm">
              <CardHeader className="p-5">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-primary">
                  <Clock className="size-5 text-amber-600 dark:text-amber-600" />
                </div>
                <CardTitle className="text-base font-bold">
                  Statutory SLA Resolution Clocks
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Every issue is locked to an enforceable countdown (12h to
                  72h). Timers run publicly so departments cannot delay, bury,
                  or dismiss your report.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-background/80 backdrop-blur-xs transition-all hover:shadow-sm">
              <CardHeader className="p-5">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-primary">
                  <ShieldCheck className="size-5 text-emerald-500 dark:text-emerald-600" />
                </div>
                <CardTitle className="text-base font-bold">
                  256-Bit Anonymity Shield
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Blow the whistle on safety violations, corruption, or
                  workplace retaliation. Cryptographic protection guarantees
                  your identity is never compromised.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/60 bg-background/80 backdrop-blur-xs transition-all hover:shadow-sm">
              <CardHeader className="p-5">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-red-500/10 text-primary">
                  <Megaphone className="size-5 text-red-600 dark:text-red-600" />
                </div>
                <CardTitle className="text-base font-bold">
                  Public Escalation & Audit
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Track progress with an immutable public ticket ID (#GRV-XXXX).
                  Lapsed deadlines automatically trigger escalation to
                  supervisory authorities.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Interactive Live Grievance Showcase & Action Banner */}
          <div className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="group flex max-w-xl flex-col gap-2 transition-colors"
              title="Click to try filing your voice"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[11px] text-emerald-600 dark:text-emerald-400"
                >
                  #GRV-2026-8941
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  ⚡ Active SLA: 18h 42m Remaining
                </Badge>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Protected Anonymous Voice
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary sm:text-base">
                Example: "Severe Drinking Water Contamination in Sector 4"
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Routed to Municipal Water Works • SLA clock verified • Public
                status viewable by all citizens. Click to launch the intake
                assistant.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() =>
                  config.aiVoiceEnabled
                    ? setIsRaiseVoiceOpen(true)
                    : setIsComingSoonOpen(true)
                }
                className="relative w-full cursor-pointer gap-2 overflow-hidden bg-primary px-6 font-bold text-primary-foreground transition-all"
              >
                <Sparkles className="size-4.5 animate-pulse text-amber-600" />
                <span>Raise Your Voice Now</span>
                <ArrowRight className="ml-1 size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="w-full px-6 font-bold"
              >
                <Link to={APP_ROUTES.track}>Track a Grievance</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything in one place
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Built for citizens, employees, and organizations that value
            accountability.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="border border-border/60 bg-linear-to-br from-primary/3 via-card to-purple-500/5 shadow-none transition-all hover:shadow-sm"
            >
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            From sign-up to resolution in three steps.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((item) => (
            <Card
              key={item.step}
              className="border border-border/60 bg-linear-to-br from-primary/3 via-card to-amber-500/5 shadow-none transition-all hover:shadow-sm"
            >
              <CardHeader>
                <span className="text-sm font-semibold text-primary">
                  {item.step}
                </span>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-primary/5 via-card to-background p-6 shadow-none sm:p-10">
        <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center gap-4 py-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Ready to be heard?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Join Freely today and turn every concern into a tracked, time-bound
            conversation.
          </p>
          <Button size="lg" asChild>
            <Link to={APP_ROUTES.register}>
              Create your account
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Raise Voice Interactive Modal */}
      <RaiseVoiceModal
        isOpen={isRaiseVoiceOpen}
        onClose={() => setIsRaiseVoiceOpen(false)}
      />
      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
      />
    </div>
  )
}
