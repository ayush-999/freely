import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  MessageSquare,
  ShieldCheck,
  Timer,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

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
              className="transition-shadow hover:shadow-md"
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
            <Card key={item.step}>
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
      <section>
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Ready to be heard?
            </h2>
            <p className="max-w-md text-muted-foreground">
              Join Freely today and turn every concern into a tracked,
              time-bound conversation.
            </p>
            <Button size="lg" asChild>
              <Link to={APP_ROUTES.register}>
                Create your account
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
