import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { ComingSoonModal } from "@/components/coming-soon-modal"
import { config } from "@/config/config"

const VOICE_PRESETS = [
  {
    label: "💧 Contaminated Water",
    category: "Public Utilities & Water Works",
    title: "Drinking water contamination in Sector 4 residential sector",
    transcript:
      "For the past 4 days, the tap water supply in Sector 4 has had a foul sewage smell and yellowish tint. Multiple families reported skin rashes and stomach infections. We called municipal helpline but received no ticket. We demand immediate water quality testing and tanker supply.",
    urgency: 88,
    sentiment: "Urgent & High Hazard",
    sla: "24 Hours Guaranteed",
  },
  {
    label: "⚠️ Dangerous Road Potholes",
    category: "Municipal Roads & Public Safety",
    title: "Deep unbarricaded road craters causing daily two-wheeler accidents",
    transcript:
      "There are 3 severe potholes on the main junction right after the flyover. Due to unlit street lamps, two motorcycle riders fell yesterday night. Please repair and barricade this immediately before a fatal casualty occurs.",
    urgency: 74,
    sentiment: "High Risk Concern",
    sla: "48 Hours Guaranteed",
  },
  {
    label: "⚖️ Retaliation / Misconduct",
    category: "Internal Ethics & Whistleblower Bureau",
    title: "Retaliatory suspension threat following safety audit disclosure",
    transcript:
      "After documenting fire safety violations in block C during internal inspections, department supervisor threatened demotion and punitive transfer. Filing anonymously to demand independent audit review.",
    urgency: 92,
    sentiment: "Critical Ethics Violation",
    sla: "12 Hours Fast-Track",
  },
]

export function AiVoiceCopilot() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [copied, setCopied] = useState(false)

  const [voiceText, setVoiceText] = useState("")
  const [selectedTitle, setSelectedTitle] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(
    "Civic Infrastructure & Public Services"
  )
  const [urgencyScore, setUrgencyScore] = useState(72)
  const [sentimentTone, setSentimentTone] = useState("Assertive Public Concern")
  const [slaTarget, setSlaTarget] = useState("24 Hours Guaranteed")
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [audioWaves, setAudioWaves] = useState([20, 35, 45, 25, 35, 50, 25, 20])

  // Listen for programmatic open events
  useEffect(() => {
    function handleOpenStudio() {
      if (config.aiVoiceEnabled) setIsOpen(true)
      else setIsComingSoonOpen(true)
    }
    window.addEventListener("freely:open-voice-studio", handleOpenStudio)
    return () =>
      window.removeEventListener("freely:open-voice-studio", handleOpenStudio)
  }, [])

  // Wave visualizer effect when recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setAudioWaves([
          Math.floor(20 + Math.random() * 80),
          Math.floor(30 + Math.random() * 70),
          Math.floor(40 + Math.random() * 60),
          Math.floor(25 + Math.random() * 75),
          Math.floor(35 + Math.random() * 65),
          Math.floor(50 + Math.random() * 50),
          Math.floor(20 + Math.random() * 70),
          Math.floor(15 + Math.random() * 55),
        ])
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isRecording])

  function handleToggleRecord() {
    if (!isRecording) {
      setIsRecording(true)
      // Simulate live speech recognition
      const sample =
        VOICE_PRESETS[Math.floor(Math.random() * VOICE_PRESETS.length)]
      let currentIndex = 0
      const words = sample.transcript.split(" ")
      setVoiceText("")
      setSelectedTitle(sample.title)
      setSelectedCategory(sample.category)
      setUrgencyScore(sample.urgency)
      setSentimentTone(sample.sentiment)
      setSlaTarget(sample.sla)

      const speechTimer = setInterval(() => {
        currentIndex += 2
        setVoiceText(words.slice(0, currentIndex).join(" "))
        if (currentIndex >= words.length) {
          clearInterval(speechTimer)
          setIsRecording(false)
        }
      }, 180)
    } else {
      setIsRecording(false)
    }
  }

  function handleSelectPreset(preset: (typeof VOICE_PRESETS)[0]) {
    setSelectedTitle(preset.title)
    setVoiceText(preset.transcript)
    setSelectedCategory(preset.category)
    setUrgencyScore(preset.urgency)
    setSentimentTone(preset.sentiment)
    setSlaTarget(preset.sla)
  }

  function handlePolishWithAi() {
    if (!voiceText.trim()) return
    setIsPolishing(true)
    setTimeout(() => {
      setVoiceText(
        (prev) =>
          `[AI Polished & Legally Structured]\n` +
          `SUMMARY: ${selectedTitle || "Public Welfare Concern"}\n` +
          `FACTUAL STATEMENT: ${prev.replace(/^\[AI Polished.*?\n\n/s, "")}\n\n` +
          `REQUESTED RELIEF: Immediate on-site inspection, accountability log disclosure, and formal remediation under statutory SLA.`
      )
      setIsPolishing(false)
    }, 700)
  }

  function handleCopy() {
    if (!voiceText) return
    navigator.clipboard.writeText(
      `${selectedTitle ? selectedTitle + "\n\n" : ""}${voiceText}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDeployToOfficialGrievance() {
    // Navigate to grievance submit page with prefilled draft
    navigate(APP_ROUTES.grievances.new, {
      state: {
        title: selectedTitle || voiceText.slice(0, 60) + "...",
        description: voiceText,
        is_anonymous: isAnonymous,
        priority:
          urgencyScore > 80 ? "urgent" : urgencyScore > 50 ? "high" : "medium",
      },
    })
    setIsOpen(false)
  }

  return (
    <>
      {/* Floating Trigger Dock */}
      <div className="fixed right-5 bottom-5 z-40 flex items-center gap-2">
        {!isOpen && (
          <button
            onClick={() => {
              if (config.aiVoiceEnabled) setIsOpen(true)
              else setIsComingSoonOpen(true)
            }}
            className="group relative flex cursor-pointer items-center gap-0 rounded-full border border-primary/40 bg-background/95 p-3 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:gap-3 hover:border-primary hover:px-4 hover:py-2.5 hover:shadow-primary/20 focus-visible:gap-3 focus-visible:px-4 focus-visible:py-2.5"
            aria-label="Open Freely AI Voice Studio"
          >
            {/* Glowing ring animation */}
            <span className="absolute -inset-0.5 -z-10 animate-pulse rounded-full bg-gradient-to-r from-primary to-indigo-500 opacity-60 blur-xs transition-opacity group-hover:opacity-100" />

            <div className="flex items-center gap-1.5">
              <Mic className="size-6 text-primary" />
            </div>

            <div className="flex max-w-0 items-center gap-3 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-65 group-hover:opacity-100 group-focus-visible:max-w-65 group-focus-visible:opacity-100">
              {/* Equalizer mini preview */}
              <div className="flex h-3.5 shrink-0 items-end gap-0.5">
                <span className="h-2 w-0.5 animate-pulse rounded-full bg-primary" />
                <span className="h-3 w-0.5 animate-pulse rounded-full bg-primary delay-75" />
                <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-primary delay-150" />
                <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-primary delay-100" />
              </div>

              <span className="shrink-0 text-xs font-semibold tracking-wide text-foreground">
                Raise Voice with AI
              </span>

              <Badge
                variant="secondary"
                className="ml-1 shrink-0 bg-primary/10 font-mono text-[10px] text-primary hover:bg-primary/20"
              >
                <Sparkles className="mr-0.5 size-2.5" />
                Live
              </Badge>
            </div>
          </button>
        )}
      </div>

      {/* Expanded AI Voice Studio Panel */}
      {isOpen && (
        <div className="fixed right-5 bottom-5 z-50 w-[95vw] max-w-lg animate-in duration-300 slide-in-from-bottom-5">
          <Card className="border-primary/30 bg-background/95 shadow-2xl backdrop-blur-xl">
            {/* Studio Header */}
            <CardHeader className="border-b bg-muted/20 pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                    <Radio className="size-4 animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
                      Freely AI Voice Studio
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                        v2.4
                      </span>
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Speak freely • AI transcription & smart urgency routing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Minimize"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5 p-4 text-xs">
              {/* Dynamic Sound Wave & Recording Banner */}
              <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 via-transparent to-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        isRecording
                          ? "animate-ping bg-red-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {isRecording
                        ? "Listening to your voice..."
                        : "Voice Stream Ready"}
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-emerald-500" />
                    Biometrics Encrypted
                  </span>
                </div>

                {/* Audio Wave Visualizer Bars */}
                <div className="flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-border/50 bg-background/60 px-4">
                  {(isRecording
                    ? audioWaves
                    : [20, 35, 45, 25, 35, 50, 25, 20]
                  ).map((height, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 rounded-full transition-all duration-100",
                        isRecording
                          ? "bg-gradient-to-t from-red-500 to-amber-400"
                          : "bg-primary/60"
                      )}
                      style={{ height: `${Math.max(12, height)}%` }}
                    />
                  ))}
                </div>

                {/* Mic & Simulator Controls */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={handleToggleRecord}
                    className="h-8 flex-1 gap-1.5 text-xs font-semibold shadow-xs"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="size-3.5 animate-pulse" /> Stop Voice
                        Input
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5" /> Start Speaking Voice
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1">
                    {VOICE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPreset(preset)}
                        className="rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary hover:text-foreground"
                        title={preset.title}
                      >
                        {preset.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Voice Transcript / Draft Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <Bot className="size-3 text-primary" />
                    Live Voice Statement
                  </label>
                  {voiceText && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[10px] hover:text-foreground"
                      >
                        {copied ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => {
                          setVoiceText("")
                          setSelectedTitle("")
                        }}
                        className="flex items-center gap-1 text-[10px] hover:text-destructive"
                      >
                        <RotateCcw className="size-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>

                <textarea
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="Click 'Start Speaking Voice' or type your concern freely here. Your words are translated and analyzed in real-time..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-input bg-background/80 p-2.5 font-sans text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                />
              </div>

              {/* AI Real-Time Insights & Urgency Gauge */}
              {voiceText && (
                <div className="animate-in space-y-2 rounded-lg border bg-muted/30 p-2.5 duration-200 fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Zap className="size-3 text-amber-500" />
                      AI Urgency Level:
                    </span>
                    <span
                      className={cn(
                        "font-bold",
                        urgencyScore > 80
                          ? "text-red-500"
                          : urgencyScore > 50
                            ? "text-amber-500"
                            : "text-emerald-500"
                      )}
                    >
                      {urgencyScore}% — {sentimentTone}
                    </span>
                  </div>

                  {/* Urgency Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        urgencyScore > 80
                          ? "bg-red-500"
                          : urgencyScore > 50
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      )}
                      style={{ width: `${urgencyScore}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground">
                        Recommended Routing:
                      </span>
                      <span className="block truncate">{selectedCategory}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-foreground">
                        Guaranteed SLA:
                      </span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {slaTarget}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Whistleblower Anonymizer Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={cn(
                      "size-4",
                      isAnonymous ? "text-emerald-500" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <span className="block text-[11px] font-semibold text-foreground">
                      Whistleblower Anonymizer
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isAnonymous
                        ? "Voice acoustic features & metadata scrubbed"
                        : "Filing publicly under verified profile"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isAnonymous ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                      isAnonymous ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePolishWithAi}
                  disabled={!voiceText || isPolishing}
                  className="h-8 gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10"
                >
                  <Wand2
                    className={cn("size-3", isPolishing && "animate-spin")}
                  />
                  {isPolishing ? "Polishing..." : "Polish with AI"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleDeployToOfficialGrievance}
                  disabled={!voiceText}
                  className="h-8 flex-1 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  Raise Official Grievance
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <ComingSoonModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
      />
    </>
  )
}
